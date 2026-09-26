import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";

export type ChainHarness = "agy" | "pi";
export type ChainAttemptOutcome = "succeeded" | "exhausted" | "failed" | "interrupted" | "cancelled";

export interface ChainAttemptProvenance {
  targetIndex: number;
  targetCount: number;
  harness: ChainHarness;
  model: string;
  elapsed: number;
  outcome: ChainAttemptOutcome;
  exhaustionReason?: string;
}

export interface ModelChainState {
  version: 1;
  harness: "chain";
  profileName: string;
  runtimeName: string;
  currentTargetIndex: number;
  targetCount: number;
  status: "running" | "exhausted" | "failed";
  attempts: ChainAttemptProvenance[];
}

const STATE_FIELDS = new Set([
  "version", "harness", "profileName", "runtimeName", "currentTargetIndex",
  "targetCount", "status", "attempts",
]);
const ATTEMPT_FIELDS = new Set([
  "targetIndex", "targetCount", "harness", "model", "elapsed", "outcome", "exhaustionReason",
]);
const OUTCOMES = new Set<ChainAttemptOutcome>([
  "succeeded", "exhausted", "failed", "interrupted", "cancelled",
]);

const MAX_PROVENANCE_LABEL = 200;

function cleanString(value: unknown): value is string {
  return typeof value === "string" && !!value.trim() && value === value.trim() && !/[\x00-\x1f\x7f]/.test(value);
}

function boundedProvenanceLabel(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= MAX_PROVENANCE_LABEL
    ? normalized
    : `${normalized.slice(0, MAX_PROVENANCE_LABEL - 1)}…`;
}

export function isChainAttemptProvenance(value: unknown): value is ChainAttemptProvenance {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const attempt = value as Record<string, unknown>;
  if (Object.keys(attempt).some((key) => !ATTEMPT_FIELDS.has(key))) return false;
  if (!Number.isInteger(attempt.targetIndex) || (attempt.targetIndex as number) < 1) return false;
  if (!Number.isInteger(attempt.targetCount) || (attempt.targetCount as number) < 2) return false;
  if ((attempt.targetIndex as number) > (attempt.targetCount as number)) return false;
  if (attempt.harness !== "agy" && attempt.harness !== "pi") return false;
  if (!cleanString(attempt.model) || attempt.model.length > MAX_PROVENANCE_LABEL) return false;
  if (typeof attempt.elapsed !== "number" || !Number.isFinite(attempt.elapsed) || attempt.elapsed < 0) return false;
  if (typeof attempt.outcome !== "string" || !OUTCOMES.has(attempt.outcome as ChainAttemptOutcome)) return false;
  if (attempt.outcome === "exhausted") {
    if (!cleanString(attempt.exhaustionReason) || (attempt.exhaustionReason as string).length > 240) return false;
  } else if (attempt.exhaustionReason !== undefined) {
    return false;
  }
  return true;
}

export function isModelChainState(value: unknown): value is ModelChainState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  if (Object.keys(state).length !== STATE_FIELDS.size || Object.keys(state).some((key) => !STATE_FIELDS.has(key))) return false;
  if (state.version !== 1 || state.harness !== "chain") return false;
  if (!cleanString(state.profileName) || !cleanString(state.runtimeName)) return false;
  if (!Number.isInteger(state.currentTargetIndex) || (state.currentTargetIndex as number) < 1) return false;
  if (!Number.isInteger(state.targetCount) || (state.targetCount as number) < 2) return false;
  if ((state.currentTargetIndex as number) > (state.targetCount as number)) return false;
  if (state.status !== "running" && state.status !== "exhausted" && state.status !== "failed") return false;
  if (!Array.isArray(state.attempts) || !state.attempts.every(isChainAttemptProvenance)) return false;
  if (state.attempts.some((attempt) => attempt.targetCount !== state.targetCount)) return false;
  if (state.attempts.some((attempt, index) => attempt.targetIndex !== index + 1)) return false;
  return true;
}

export function writeModelChainState(path: string, state: ModelChainState): void {
  if (!isAbsolute(path) || !isModelChainState(state)) {
    throw new Error("Refusing to persist invalid model-chain state");
  }
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}-${Math.random().toString(16).slice(2, 10)}`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), { encoding: "utf8", mode: 0o600 });
  renameSync(tmp, path);
}

export function readModelChainState(path: string): ModelChainState | null {
  try {
    if (!isAbsolute(path) || !existsSync(path) || !statSync(path).isFile()) return null;
    const value = JSON.parse(readFileSync(path, "utf8"));
    return isModelChainState(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Classify only already-validated terminal provider error evidence. The caller
 * is responsible for excluding stderr-only, malformed, denied, interrupted,
 * cancelled, pane-loss, and non-provider failures before calling this helper.
 * Returned reasons are fixed and bounded so provider payloads and credentials
 * never enter chain provenance.
 */
export function classifyExhaustion(message: string): string | null {
  const normalized = message.trim().slice(0, 4000);
  if (!normalized) return null;
  const words = normalized.replace(/[_-]+/g, " ");
  if (
    /\b(?:auth|authenticated|unauthenticated|authentication|authorization|unauthori[sz]ed|forbidden)\b/i.test(words) ||
    /\b(?:permission|access)\s+denied\b/i.test(words) ||
    /\b(?:invalid|unknown|unsupported|unavailable)\s+(?:api\s+key|credentials?|model)\b/i.test(words) ||
    /\b(?:model|api\s+key|credentials?)\s+(?:not\s+found|invalid|unknown|unsupported|unavailable)\b/i.test(words) ||
    /\b(?:configuration|config|tool)\s+(?:error|failed|invalid)\b/i.test(words)
  ) return null;
  if (/(?:^|[^0-9])429(?:[^0-9]|$)/.test(normalized)) return "terminal HTTP 429";
  if (/resource(?:_|-|\s)+exhausted/i.test(normalized)) return "resource exhausted";
  if (/\bsubscription\b.{0,80}\b(?:limit|quota|expired|exhausted|inactive)\b/i.test(normalized)) {
    return "subscription limit reached";
  }
  if (/\bbilling\b.{0,80}\b(?:limit|quota|disabled|inactive|required|exhausted)\b/i.test(normalized)) {
    return "billing limit reached";
  }
  if (/\bquota\b.{0,80}\b(?:exhausted|exceeded|depleted|reached)\b/i.test(normalized) ||
      /\b(?:exhausted|exceeded|depleted|reached)\b.{0,80}\bquota\b/i.test(normalized)) {
    return "quota exhausted";
  }
  if (/\busage(?:\s+|-|_)limit\b.{0,80}\b(?:exhausted|exceeded|reached)\b/i.test(normalized) ||
      /\b(?:exhausted|exceeded|reached)\b.{0,80}\busage(?:\s+|-|_)limit\b/i.test(normalized)) {
    return "usage limit reached";
  }
  if (/\bbudget\b.{0,80}\b(?:exhausted|exceeded|depleted|reached)\b/i.test(normalized) ||
      /\b(?:exhausted|exceeded|depleted|reached)\b.{0,80}\bbudget\b/i.test(normalized)) {
    return "budget exhausted";
  }
  if (/\bcredits?\b.{0,80}\b(?:exhausted|depleted|spent|used\s+up|insufficient|empty)\b/i.test(normalized) ||
      /\b(?:exhausted|depleted|insufficient|no)\b.{0,80}\bcredits?\b/i.test(normalized)) {
    return "credits exhausted";
  }
  return null;
}

export type ChainControllerAttempt<T> =
  | { ok: true; value: T; elapsed: number }
  | {
      ok: false;
      value: T;
      elapsed: number;
      providerError?: string;
      outcome?: "failed" | "interrupted" | "cancelled";
    };

export type ChainControllerResult<T> =
  | { ok: true; value: T; winnerIndex: number; attempts: ChainAttemptProvenance[] }
  | { ok: false; value: T; allExhausted: boolean; attempts: ChainAttemptProvenance[] };

/** Purely sequences injected attempts; it never launches more than one at once. */
export async function runModelChain<T>(params: {
  targets: readonly { harness: ChainHarness; model: string }[];
  attempt(index: number): Promise<ChainControllerAttempt<T>>;
  onAttempt?(attempt: ChainAttemptProvenance): void | Promise<void>;
}): Promise<ChainControllerResult<T>> {
  if (params.targets.length < 2) throw new Error("A model chain requires at least two targets");
  const attempts: ChainAttemptProvenance[] = [];
  let lastValue!: T;

  for (let index = 0; index < params.targets.length; index++) {
    const target = params.targets[index];
    const provenanceModel = boundedProvenanceLabel(target.model);
    const result = await params.attempt(index);
    lastValue = result.value;
    if (result.ok) {
      const provenance: ChainAttemptProvenance = {
        targetIndex: index + 1,
        targetCount: params.targets.length,
        harness: target.harness,
        model: provenanceModel,
        elapsed: result.elapsed,
        outcome: "succeeded",
      };
      attempts.push(provenance);
      await params.onAttempt?.(provenance);
      return { ok: true, value: result.value, winnerIndex: index, attempts };
    }

    const exhaustionReason = result.providerError
      ? classifyExhaustion(result.providerError)
      : null;
    const provenance: ChainAttemptProvenance = exhaustionReason
      ? {
          targetIndex: index + 1,
          targetCount: params.targets.length,
          harness: target.harness,
          model: provenanceModel,
          elapsed: result.elapsed,
          outcome: "exhausted",
          exhaustionReason,
        }
      : {
          targetIndex: index + 1,
          targetCount: params.targets.length,
          harness: target.harness,
          model: provenanceModel,
          elapsed: result.elapsed,
          outcome: result.outcome ?? "failed",
        };
    attempts.push(provenance);
    await params.onAttempt?.(provenance);
    if (!exhaustionReason) return { ok: false, value: result.value, allExhausted: false, attempts };
  }

  return { ok: false, value: lastValue, allExhausted: true, attempts };
}
