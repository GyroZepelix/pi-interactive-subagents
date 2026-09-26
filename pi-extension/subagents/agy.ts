import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { shellEscape } from "./tmux.ts";

export const AGY_LOGICAL_TOOL_MAP = {
  read: "view_file",
  grep: "grep_search",
  find: "find_by_name",
  ls: "list_dir",
} as const;

export type AgyLogicalTool = keyof typeof AGY_LOGICAL_TOOL_MAP;
export type AgyNativeTool = (typeof AGY_LOGICAL_TOOL_MAP)[AgyLogicalTool];

export function translateAgyTools(tools: readonly string[]): AgyNativeTool[] {
  return tools.map((tool) => {
    const native = AGY_LOGICAL_TOOL_MAP[tool as AgyLogicalTool];
    if (!native) throw new Error(`Unsupported AGY built-in tool: ${tool}`);
    return native;
  });
}

export function buildAgyAgentName(profileName: string, uniqueId = randomUUID()): string {
  const slug = profileName
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "subagent";
  const suffix = uniqueId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!suffix) throw new Error("AGY agent unique ID contains unsupported characters");
  return `pi-${slug}-${suffix}`;
}

export function serializeAgyAgent(params: {
  name: string;
  description?: string;
  nativeTools: readonly string[];
  identity: string;
}): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(params.name)) {
    throw new Error("AGY agent name contains unsupported characters");
  }
  if (!params.identity.trim()) throw new Error("AGY agent identity must not be empty");
  const description = params.description?.trim() || `Pi subagent profile ${params.name}`;
  const tools = params.nativeTools.map((tool) => `  - ${tool}`).join("\n");
  return [
    "---",
    `name: ${params.name}`,
    `description: ${JSON.stringify(description)}`,
    tools ? "tools:" : "tools: []",
    ...(tools ? tools.split("\n") : []),
    "mainAgent: true",
    "subagent: false",
    "---",
    params.identity.trim(),
    "",
  ].join("\n");
}

export function agyAgentDefinitionPath(root: string, agentName: string): string {
  return join(root, ".agents", "agents", agentName, "agent.md");
}

export function writeAgyAgent(root: string, agentName: string, markdown: string): string {
  const path = agyAgentDefinitionPath(root, agentName);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, markdown, { encoding: "utf8", mode: 0o600 });
  return path;
}

export interface AgyUsage {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
}

export type ParsedAgyResult =
  | { ok: true; response: string; conversationId: string; usage: AgyUsage | null }
  | { ok: false; error: string; status?: string };

function finiteNonnegative(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function boundedDiagnostic(value: string, max = 4000): string {
  const normalized = value.trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max)}…`;
}

export function parseAgyResult(raw: string, stderr = ""): ParsedAgyResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const stderrDetail = boundedDiagnostic(stderr);
    return {
      ok: false,
      error: `AGY returned invalid JSON: ${detail}${stderrDetail ? `; stderr: ${stderrDetail}` : ""}`,
    };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "AGY returned a JSON value that is not a result object" };
  }
  const result = parsed as Record<string, unknown>;
  const status = typeof result.status === "string" ? result.status.trim().toUpperCase() : "";
  if (!status) return { ok: false, error: "AGY result is missing a valid terminal status" };

  if (status === "SUCCESS") {
    if (Array.isArray(result.denied_actions) && result.denied_actions.length > 0) {
      const denied = boundedDiagnostic(JSON.stringify(result.denied_actions));
      const stderrDetail = boundedDiagnostic(stderr);
      return {
        ok: false,
        status,
        error: `AGY denied one or more actions: ${denied}${stderrDetail ? `; stderr: ${stderrDetail}` : ""}`,
      };
    }
    if (typeof result.response !== "string" || !result.response.trim()) {
      return { ok: false, status, error: "AGY reported success without a non-empty response" };
    }
    if (
      typeof result.conversation_id !== "string" ||
      !result.conversation_id.trim() ||
      /[\x00-\x1f\x7f]/.test(result.conversation_id)
    ) {
      return { ok: false, status, error: "AGY reported success without a valid conversation ID; resume is unavailable" };
    }
    let usage: AgyUsage | null = null;
    if (result.usage && typeof result.usage === "object" && !Array.isArray(result.usage)) {
      const values = result.usage as Record<string, unknown>;
      usage = {
        inputTokens: finiteNonnegative(values.input_tokens),
        outputTokens: finiteNonnegative(values.output_tokens),
        thinkingTokens: finiteNonnegative(values.thinking_tokens),
        cacheReadTokens: finiteNonnegative(values.cache_read_tokens),
        totalTokens: finiteNonnegative(values.total_tokens),
      };
    }
    return {
      ok: true,
      response: result.response,
      conversationId: result.conversation_id,
      usage,
    };
  }

  const structured = typeof result.error === "string" ? boundedDiagnostic(result.error) : "";
  const stderrDetail = boundedDiagnostic(stderr);
  const terminalStatuses = new Set(["ERROR", "CANCELLED", "CANCELED", "INTERRUPTED"]);
  const state = terminalStatuses.has(status) ? `AGY ${status.toLowerCase()}` : `AGY returned non-terminal or unknown status ${JSON.stringify(status)}`;
  return {
    ok: false,
    status,
    error: `${state}${structured ? `: ${structured}` : ""}${stderrDetail ? `; stderr: ${stderrDetail}` : ""}`,
  };
}

interface AgyResumeStateBase {
  harness: "agy";
  conversationId: string | null;
  profileName: string;
  runtimeName: string;
  description: string;
  cwd: string;
  model: string | null;
  effort: string | null;
  identity: string;
  logicalTools: string[];
  nativeTools: string[];
  agentRoot: string;
  agentName: string;
  agentMarkdown: string;
}

export interface AgyResumeStateV1 extends AgyResumeStateBase {
  version: 1;
}

export interface AgyResumeStateV2 extends AgyResumeStateBase {
  version: 2;
  additionalWorkspaceRoots: string[];
}

export type AgyResumeState = AgyResumeStateV1 | AgyResumeStateV2;

const STATE_FIELDS_V1 = new Set([
  "version", "harness", "conversationId", "profileName", "runtimeName", "description", "cwd",
  "model", "effort", "identity", "logicalTools", "nativeTools", "agentRoot",
  "agentName", "agentMarkdown",
]);
const STATE_FIELDS_V2 = new Set([...STATE_FIELDS_V1, "additionalWorkspaceRoots"]);
const AGY_EFFORTS = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);

function validCleanString(value: unknown): value is string {
  return typeof value === "string" && !!value.trim() && value === value.trim() && !/[\x00-\x1f\x7f]/.test(value);
}

export function deriveAgyAdditionalWorkspaceRoots(parentCwd: string, childCwd: string): string[] {
  const resolvedParent = resolve(parentCwd);
  return resolvedParent === resolve(childCwd) ? [] : [resolvedParent];
}

export function agyAdditionalWorkspaceRoots(state: AgyResumeState): readonly string[] {
  return state.version === 2 ? state.additionalWorkspaceRoots : [];
}

function isResolvedAbsolutePath(value: unknown): value is string {
  return typeof value === "string" && isAbsolute(value) && resolve(value) === value;
}

export function isAgyResumeState(value: unknown): value is AgyResumeState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  const fields = state.version === 1 ? STATE_FIELDS_V1 : state.version === 2 ? STATE_FIELDS_V2 : null;
  if (!fields || Object.keys(state).length !== fields.size || Object.keys(state).some((key) => !fields.has(key))) return false;
  if (state.harness !== "agy") return false;
  if (state.version === 2) {
    if (!Array.isArray(state.additionalWorkspaceRoots)) return false;
    if (!state.additionalWorkspaceRoots.every(isResolvedAbsolutePath)) return false;
    if (new Set(state.additionalWorkspaceRoots).size !== state.additionalWorkspaceRoots.length) return false;
    if (state.additionalWorkspaceRoots.includes(state.cwd as string) || state.additionalWorkspaceRoots.includes(state.agentRoot as string)) return false;
  }
  if (state.conversationId !== null && !validCleanString(state.conversationId)) return false;
  if (!validCleanString(state.profileName) || !validCleanString(state.runtimeName) || !validCleanString(state.description)) return false;
  if (!isResolvedAbsolutePath(state.cwd)) return false;
  if (state.model !== null && !validCleanString(state.model)) return false;
  if (state.effort !== null && (typeof state.effort !== "string" || !AGY_EFFORTS.has(state.effort))) return false;
  if (typeof state.identity !== "string" || !state.identity.trim()) return false;
  if (!Array.isArray(state.logicalTools) || !state.logicalTools.every((tool) => typeof tool === "string")) return false;
  if (!Array.isArray(state.nativeTools) || !state.nativeTools.every((tool) => typeof tool === "string")) return false;
  if (new Set(state.logicalTools).size !== state.logicalTools.length || new Set(state.nativeTools).size !== state.nativeTools.length) return false;
  let translated: string[];
  try { translated = translateAgyTools(state.logicalTools); } catch { return false; }
  if (JSON.stringify(translated) !== JSON.stringify(state.nativeTools)) return false;
  if (!isResolvedAbsolutePath(state.agentRoot)) return false;
  if (typeof state.agentName !== "string" || !/^[a-zA-Z0-9_-]+$/.test(state.agentName)) return false;
  if (typeof state.agentMarkdown !== "string" || !state.agentMarkdown) return false;
  if (state.agentMarkdown !== serializeAgyAgent({
    name: state.agentName,
    description: state.description,
    nativeTools: state.nativeTools,
    identity: state.identity,
  })) return false;
  return true;
}

export function writeAgyResumeState(path: string, state: AgyResumeState): void {
  if (!isAgyResumeState(state)) throw new Error("Refusing to persist invalid AGY resume state");
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}-${randomUUID()}`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), { encoding: "utf8", mode: 0o600 });
  renameSync(tmp, path);
}

export function readAgyResumeState(path: string): AgyResumeState | null {
  try {
    if (!existsSync(path) || !statSync(path).isFile()) return null;
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return isAgyResumeState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function validateAgyReplayState(state: AgyResumeState): string | null {
  const expected = agyAgentDefinitionPath(state.agentRoot, state.agentName);
  try {
    if (!statSync(state.cwd).isDirectory()) return `stored cwd is not a directory: ${state.cwd}`;
    if (!statSync(state.agentRoot).isDirectory()) return `generated agent workspace is unavailable: ${state.agentRoot}`;
    for (const root of agyAdditionalWorkspaceRoots(state)) {
      if (!statSync(root).isDirectory()) return `additional workspace is not a directory: ${root}`;
    }
    if (!statSync(expected).isFile()) return `generated agent definition is unavailable: ${expected}`;
    if (readFileSync(expected, "utf8") !== state.agentMarkdown) return `generated agent definition no longer matches the stored capability contract: ${expected}`;
  } catch (error) {
    return `stored AGY replay state is unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
  return null;
}

export function buildAgyCommand(params: {
  agentRoot: string;
  additionalWorkspaceRoots: readonly string[];
  agentName: string;
  taskFile: string;
  stdoutFile: string;
  stderrFile: string;
  model: string | null;
  effort: string | null;
  conversationId?: string | null;
}): string {
  const seenWorkspaceRoots = new Set([params.agentRoot]);
  const additionalWorkspaceRoots: string[] = [];
  for (const root of params.additionalWorkspaceRoots) {
    if (!isResolvedAbsolutePath(root)) {
      throw new Error(`AGY additional workspace must be an absolute resolved path: ${root}`);
    }
    if (!seenWorkspaceRoots.has(root)) {
      seenWorkspaceRoots.add(root);
      additionalWorkspaceRoots.push(root);
    }
  }
  const parts = [
    "agy",
    "--output-format", "json",
    "--add-dir", shellEscape(params.agentRoot),
    ...additionalWorkspaceRoots.flatMap((root) => ["--add-dir", shellEscape(root)]),
    "--agent", shellEscape(params.agentName),
  ];
  if (params.model) parts.push("--model", shellEscape(params.model));
  if (params.effort) parts.push("--effort", shellEscape(params.effort));
  if (params.conversationId) parts.push("--conversation", shellEscape(params.conversationId));
  parts.push("--print", `\"$(cat -- ${shellEscape(params.taskFile)})\"`);
  return `${parts.join(" ")} > ${shellEscape(params.stdoutFile)} 2> ${shellEscape(params.stderrFile)}; ` +
    `agy_exit=$?; echo '__SUBAGENT_DONE_'$agy_exit'__'`;
}
