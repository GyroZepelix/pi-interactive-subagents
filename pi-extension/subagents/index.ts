import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getAgentDir, keyHint } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import { Box, Text, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  unlinkSync,
  statSync,
  realpathSync,
} from "node:fs";
import {
  isMuxAvailable,
  isCommandAvailable,
  muxSetupHint,
  createSurfaceOfKind,
  findLiveTaggedPane,
  tagSurface,
  type LiveTaggedPaneLookup,
  type SurfaceKind,
  sendCommand,
  sendLongCommand,
  submitText,
  pollForExit,
  closeSurface,
  shellEscape,
  readScreen,
  completionSuffix,
} from "./tmux.ts";

import {
  countSessionEntryLines,
  findLastAssistantMessage,
  findLastAssistantProviderError,
  getNewEntries,
  getSessionId,
  readNameRegistry,
  readSubagentLoadout,
  isSubagentLoadout,
  registerName,
  resolveNameInRegistry,
  seedSubagentSessionFile,
  summarizeSessionStats,
  writeSubagentLoadout,
  type SessionStats,
  type SubagentLoadout,
} from "./session.ts";
import {
  type StatusSnapshot,
  type SubagentStatusState,
  advanceStatusState,
  capStatusLines,
  classifyStatus,
  createStatusState,
  forceStatusAfterInterrupt,
  formatStatusAggregate,
  formatTransitionLine,
  observeStatus,
  loadStatusConfig,
} from "./status.ts";
import {
  getSubagentActivityFile,
  readSubagentActivityFile,
  type ActivityReadResult,
  type SubagentActivityState,
} from "./activity.ts";
import {
  discoverAgentDefinitions,
  formatAgentDiagnostic,
  type AgentDefinition,
  type AgentModelChainTarget,
  type IdentitySystemPromptMode,
  type SubagentSessionMode,
} from "./agents.ts";
import {
  encodeMcpServerReferences,
  SUBAGENT_BUILTIN_TOOLS_ENV,
  SUBAGENT_CAPABILITY_VERSION_ENV,
  SUBAGENT_MCP_REFERENCES_ENV,
  SUBAGENT_MCP_SUPPORT_TOOLS_ENV,
  SUBAGENT_MODEL_CHAIN_ENV,
} from "./subagent-protocol.ts";
import {
  verifyMcpServerReferences,
  type McpServerReference,
  type McpSupportTool,
} from "./mcp-config.ts";
import {
  encodeQuestionAnswer,
  questionAcknowledgmentPath,
  questionRequestPath,
  readQuestionAcknowledgment,
  readQuestionRequest,
  removeMatchingQuestionAcknowledgment,
  removeMatchingQuestionRequest,
} from "./question-protocol.ts";
import {
  agyAdditionalWorkspaceRoots,
  agyAgentDefinitionPath,
  buildAgyAgentName,
  buildAgyCommand,
  checkAgyPermissionPolicy,
  deriveAgyAdditionalWorkspaceRoots,
  parseAgyResult,
  agyWorkspaceRoots,
  readAgyResumeState,
  serializeAgyAgent,
  translateAgyTools,
  validateAgyReplayState,
  writeAgyAgent,
  writeAgyResumeState,
  type AgyResumeState,
  type AgyUsage,
} from "./agy.ts";
import {
  readModelChainState,
  runModelChain,
  writeModelChainState,
  type ChainAttemptProvenance,
  type ModelChainState,
} from "./model-chain.ts";

/** Absolute path to `pi-extension/subagents`. https://github.com/nodejs/node/issues/37845 */
const SUBAGENTS_DIR = dirname(fileURLToPath(import.meta.url));
const SPAWNING_EXTENSION_PATH = realpathSync(fileURLToPath(import.meta.url));

// Survive /reload: clear timers and abort poll loops from the previous module load.
// /reload re-imports this file, giving fresh module-level state, but closures from
// the old module keep running. See https://github.com/HazAT/pi-interactive-subagents/issues/5
const WIDGET_INTERVAL_KEY = Symbol.for("pi-subagents/widget-interval");
const STATUS_INTERVAL_KEY = Symbol.for("pi-subagents/status-interval");
const POLL_ABORT_KEY = Symbol.for("pi-subagents/poll-abort-controller");

{
  const prevInterval = (globalThis as any)[WIDGET_INTERVAL_KEY];
  if (prevInterval) {
    clearInterval(prevInterval);
    (globalThis as any)[WIDGET_INTERVAL_KEY] = null;
  }
  const prevStatusInterval = (globalThis as any)[STATUS_INTERVAL_KEY];
  if (prevStatusInterval) {
    clearInterval(prevStatusInterval);
    (globalThis as any)[STATUS_INTERVAL_KEY] = null;
  }
  const prevAbort = (globalThis as any)[POLL_ABORT_KEY] as AbortController | undefined;
  if (prevAbort) prevAbort.abort();
  (globalThis as any)[POLL_ABORT_KEY] = new AbortController();
}

function getModuleAbortSignal(): AbortSignal {
  return ((globalThis as any)[POLL_ABORT_KEY] as AbortController).signal;
}

const SubagentParams = Type.Object({
  agent: Type.String({
    description:
      "Which configured agent profile to spawn. This loads the profile's model, tool loadout, and " +
      "system prompt. Must be one of the available definitions; hidden definitions remain directly selectable.",
  }),
  task: Type.String({ description: "Task/prompt for the sub-agent" }),
  name: Type.Optional(
    Type.String({
      description:
        "Optional runtime display and addressing name for the subagent. Defaults to the agent name. " +
        "It does not select the profile; use `agent` for that.",
    }),
  ),
  model: Type.Optional(Type.String({ description: "Model override (overrides agent default)" })),
  cwd: Type.Optional(
    Type.String({
      description:
        "Working directory for the sub-agent. The agent starts in this folder and picks up its local .pi/ config, CLAUDE.md, skills, and extensions. Use for role-specific subfolders.",
    }),
  ),
});

type AgentDefaults = Partial<
  Pick<
    AgentDefinition,
    | "model"
    | "builtinTools"
    | "skills"
    | "thinking"
    | "subagentAgents"
    | "autoExit"
    | "interactive"
    | "systemPromptMode"
    | "sessionMode"
    | "cwd"
    | "cli"
    | "body"
    | "disableModelInvocation"
  >
>;

/**
 * The full subagent lifecycle/spawning toolset registered by this extension.
 * An agent is granted these (and this extension is loaded into its child
 * process) only when its frontmatter declares a non-empty `subagent_agents`.
 */
const SPAWNING_TOOLS = [
  "subagent",
  "subagent_message",
  "subagents_list",
] as const;

/** Built-in tools pi provides natively — no extension needs to be loaded. */
const BUILTIN_TOOLS = new Set([
  "read",
  "write",
  "edit",
  "bash",
  "powershell",
  "grep",
  "find",
  "ls",
]);

/** Resolve the global agent config directory, respecting Pi configuration. */
function getAgentConfigDir(): string {
  return getAgentDir();
}

function isExistingFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * When this process was spawned as a restricted subagent, the parent pins the
 * set of agents it may itself spawn via PI_SUBAGENT_ALLOWED. `null` means no
 * restriction (top-level session, or an unrestricted child).
 */
function parseSubagentAllowlist(raw: string | undefined): Set<string> | null {
  if (raw === undefined) return null;
  return new Set(raw.split(",").map((value) => value.trim()).filter(Boolean));
}

const SUBAGENT_ALLOWLIST = parseSubagentAllowlist(process.env.PI_SUBAGENT_ALLOWED);

async function discoverDefinitionsForContext(
  ctx: Pick<ExtensionContext, "cwd" | "isProjectTrusted">,
) {
  return discoverAgentDefinitions({
    cwd: ctx.cwd,
    projectTrusted: ctx.isProjectTrusted(),
    allowedNames: SUBAGENT_ALLOWLIST,
  });
}

function agentDiscoveryHint(
  discovery: Awaited<ReturnType<typeof discoverDefinitionsForContext>>,
): string {
  const expectedProject = discovery.projectAgentsDir ?? join("<project>", ".pi", "agents");
  return `Add a profile under ${discovery.globalAgentsDir} or ${expectedProject}.`;
}

function formatDiscoveryDiagnostics(
  discovery: Awaited<ReturnType<typeof discoverDefinitionsForContext>>,
): string {
  if (discovery.diagnostics.length === 0) return "";
  return `\nInvalid definitions:\n${discovery.diagnostics.map(formatAgentDiagnostic).join("\n")}`;
}

/** `subagents_list` note for optional MCP servers skipped at discovery. */
function unavailableMcpSuffix(agent: { mcpServersUnavailable?: readonly string[] }): string {
  const names = agent.mcpServersUnavailable ?? [];
  return names.length > 0 ? ` (optional MCP unavailable: ${names.join(", ")})` : "";
}

function resolveSubagentPaths(
  params: Static<typeof SubagentParams>,
  agentDefs: AgentDefaults | null,
  activeCwd = process.cwd(),
): { effectiveCwd: string | null; localAgentDir: string | null; effectiveAgentDir: string } {
  const rawCwd = params.cwd ?? agentDefs?.cwd ?? null;
  const cwdIsFromAgent = !params.cwd && agentDefs?.cwd != null;
  const cwdBase = cwdIsFromAgent ? getAgentConfigDir() : activeCwd;
  const effectiveCwd = rawCwd
    ? rawCwd.startsWith("/")
      ? rawCwd
      : join(cwdBase, rawCwd)
    : null;
  const localAgentDir = effectiveCwd ? join(effectiveCwd, ".pi", "agent") : null;
  const effectiveAgentDir =
    localAgentDir && existsSync(localAgentDir) ? localAgentDir : getAgentConfigDir();
  return { effectiveCwd, localAgentDir, effectiveAgentDir };
}

function getDefaultSessionDirFor(cwd: string, agentDir: string): string {
  const safePath = `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
  const sessionDir = join(agentDir, "sessions", safePath);
  if (!existsSync(sessionDir)) {
    mkdirSync(sessionDir, { recursive: true });
  }
  return sessionDir;
}

function resolveEffectiveSessionMode(
  params: Static<typeof SubagentParams>,
  agentDefs: AgentDefaults | null,
): SubagentSessionMode {
  return agentDefs?.sessionMode ?? "standalone";
}

function resolveLaunchBehavior(
  params: Static<typeof SubagentParams>,
  agentDefs: AgentDefaults | null,
): {
  sessionMode: SubagentSessionMode;
  seededSessionMode: "lineage-only" | "fork" | null;
  inheritsConversationContext: boolean;
  taskDelivery: "direct" | "artifact";
} {
  const sessionMode = resolveEffectiveSessionMode(params, agentDefs);
  const inheritsConversationContext = sessionMode === "fork";
  return {
    sessionMode,
    seededSessionMode: sessionMode === "standalone" ? null : sessionMode,
    inheritsConversationContext,
    taskDelivery: inheritsConversationContext ? "direct" : "artifact",
  };
}

/**
 * Decide whether a subagent is interactive (user-driven, long-running).
 *
 * Resolution order:
 *   1. Explicit `interactive` frontmatter field on the agent.
 *   2. Default: the inverse of `auto-exit`. Agents that auto-exit are
 *      autonomous and the parent session should be woken on stall/recovery
 *      transitions. Agents that do not auto-exit are user-driven in their own
 *      pane, where stall pings are noise.
 */
function resolveEffectiveInteractive(
  _params: Static<typeof SubagentParams>,
  agentDefs: AgentDefaults | null,
): boolean {
  if (agentDefs?.interactive != null) return agentDefs.interactive;
  return !(agentDefs?.autoExit ?? false);
}

/**
 * Fill omitted Pi-harness profile fields with their Pi defaults:
 * `auto-exit: true`, `system-prompt: append`, and `session-mode: lineage-only`.
 * Explicit values are kept unchanged. Claude and AGY definitions are returned
 * as-is because those harnesses do not use these fields.
 */
function applyPiProfileDefaults(agent: AgentDefinition): AgentDefinition {
  if ((agent.cli ?? "pi") !== "pi") return agent;
  return {
    ...agent,
    autoExit: agent.autoExit ?? true,
    // A Pi profile body is required; keep the loadout invariant (mode set only
    // with identity text) for any body-less definition built in code.
    systemPromptMode: agent.systemPromptMode ?? (agent.body ? "append" : undefined),
    sessionMode: agent.sessionMode ?? "lineage-only",
  };
}

function buildSubagentTask(params: {
  task: string;
  body?: string;
  systemPromptMode?: IdentitySystemPromptMode;
  autoExit: boolean;
  inheritsConversationContext: boolean;
}): string {
  const identityInSystemPrompt = !!params.systemPromptMode && !!params.body;
  const roleBlock = params.body && !identityInSystemPrompt ? `\n\n${params.body}` : "";
  if (params.inheritsConversationContext) {
    return `${roleBlock}\n\n${params.task}`.trim();
  }

  const modeHint = params.autoExit
    ? "Complete your task autonomously. When you are finished, simply stop. Your session ends automatically."
    : "Complete your task. The user can interact with you at any time, and the session ends when the user exits the pane.";
  const summaryInstruction = params.autoExit
    ? "Your FINAL assistant message should summarize what you accomplished."
    : "Your FINAL assistant message (before the user exits) should summarize what you accomplished.";
  return `${roleBlock}\n\n${modeHint}\n\n${params.task}\n\n${summaryInstruction}`;
}


async function findAgentDefinitionForTest(
  agentName: string,
  cwd = process.cwd(),
  projectTrusted = true,
): Promise<AgentDefinition | null> {
  const discovery = await discoverAgentDefinitions({ cwd, projectTrusted });
  return discovery.agents.find((agent) => agent.name === agentName) ?? null;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

/** Compact token count: 850, 3.2k, 45k. */
function formatTokens(n: number): string {
  return n < 1000 ? String(n) : n < 10000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n / 1000)}k`;
}

/**
 * Known context-window sizes by model id substring, used for the context-usage
 * gauge. Unknown models fall back to a window-less "Nk ctx" label.
 */
function contextWindowFor(model: string | null | undefined): number | undefined {
  if (!model) return undefined;
  const m = model.toLowerCase();
  if (m.includes("claude")) return 200_000;
  if (m.includes("gpt-4.1") || m.includes("gpt-4o")) return 128_000;
  if (m.includes("gemini")) return 1_000_000;
  return undefined;
}

/** Minimal model-registry shape used to resolve context windows. */
interface ContextWindowRegistry {
  find?(provider: string, modelId: string): { contextWindow?: unknown } | undefined;
  getAll?(): ReadonlyArray<{ id?: unknown; contextWindow?: unknown }>;
}

function validContextWindow(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * Resolve a model's context window: registry `find(provider, model)`, then the
 * first registry entry whose id matches, then the static `contextWindowFor`
 * table. Invalid windows and registry errors fall through to the next step.
 */
function resolveContextWindow(
  model: string | null | undefined,
  provider: string | null | undefined,
  registry?: ContextWindowRegistry | null,
): number | undefined {
  if (model && registry) {
    if (provider) {
      try {
        const window = validContextWindow(registry.find?.(provider, model)?.contextWindow);
        if (window) return window;
      } catch {
        // fall through to id-only lookup
      }
    }
    try {
      const match = registry.getAll?.().find((m) => m?.id === model);
      const window = validContextWindow(match?.contextWindow);
      if (window) return window;
    } catch {
      // fall through to static table
    }
  }
  return contextWindowFor(model);
}

/** Context-usage gauge: "18.0%/200k" when window known, else "37k ctx". */
function formatContextUsage(tokens: number, contextWindow: number | undefined): string {
  if (!contextWindow) return `${formatTokens(tokens)} ctx`;
  const pct = (tokens / contextWindow) * 100;
  const maxStr =
    contextWindow >= 1_000_000
      ? `${(contextWindow / 1_000_000).toFixed(1)}M`
      : `${Math.round(contextWindow / 1000)}k`;
  return `${pct.toFixed(1)}%/${maxStr}`;
}

/**
 * Build the dim usage line for a completed subagent, mirroring the format of
 * the in-process subagents extension: "↑in ↓out R… W… $cost · ctx".
 * `theme.fg` is applied by the caller; this returns plain segments joined.
 */
function formatUsageSegments(stats: SessionStats): string[] {
  const segs: string[] = [];
  if (stats.inputTokens) segs.push(`↑${formatTokens(stats.inputTokens)}`);
  if (stats.outputTokens) segs.push(`↓${formatTokens(stats.outputTokens)}`);
  if (stats.cacheReadTokens) segs.push(`R${formatTokens(stats.cacheReadTokens)}`);
  if (stats.cacheWriteTokens) segs.push(`W${formatTokens(stats.cacheWriteTokens)}`);
  if (stats.cost) segs.push(`$${stats.cost.toFixed(3)}`);
  return segs;
}

/** ANSI colors for widget status icons (raw, since the widget bypasses theme). */
const ICON_GREEN = "\x1b[38;2;126;186;103m";
const ICON_YELLOW = "\x1b[38;2;214;181;94m";
const ICON_RED = "\x1b[38;2;224;108;117m";
const ICON_DIM = "\x1b[38;2;128;128;128m";

/** Map a live status kind to a colored single-char icon for the widget. */
function widgetIcon(kind: StatusSnapshot["kind"]): string {
  switch (kind) {
    case "active":
    case "running":
      return `${ICON_YELLOW}⟳${RST}`;
    case "stalled":
      return `${ICON_RED}⟳${RST}`;
    case "waiting":
    case "starting":
    default:
      return `${ICON_DIM}○${RST}`;
  }
}

/**
 * Wait long enough for a freshly created pane to finish shell startup.
 *
 * Some environments do extra shell-init work before the prompt is ready
 * (for example direnv/devenv), so the delay is configurable for users who hit
 * dropped commands. Keep the historical default at 500ms.
 */
function getShellReadyDelayMs(): number {
  const raw = process.env.PI_SUBAGENT_SHELL_READY_DELAY_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 500;
}

function muxUnavailableResult() {
  return {
    content: [
      {
        type: "text" as const,
        text: `Subagents require tmux. ${muxSetupHint()}`,
      },
    ],
    details: { error: "tmux not available" },
  };
}

/**
 * Build the internal artifact directory path for the current session.
 * Used by the subagents extension to stash task files, system prompts, and
 * launch scripts for sub-agents. Path convention:
 *   <sessionDir>/artifacts/<session-id>/
 */
function getArtifactDir(sessionDir: string, sessionId: string): string {
  return join(sessionDir, "artifacts", sessionId);
}

/**
 * Per-launch exit-code file written by the launch script (`completionSuffix`)
 * and consumed by `pollForExit`. Every launch and resume uses a fresh id, so a
 * leftover file can never finish a later run. Creates the parent directory.
 */
function prepareSubagentDoneFile(artifactDir: string, launchId: string): string {
  const doneFile = join(artifactDir, "subagent-done", `${launchId}.code`);
  mkdirSync(dirname(doneFile), { recursive: true });
  return doneFile;
}

const statusConfig = loadStatusConfig();

/**
 * Choose where a child pane goes. A new spawn uses the private detached
 * server when the parent has no tmux client or its profile sets
 * `background: true`; a resume is detached only without a tmux client
 * (inside tmux a resume always splits). Everything else splits as before.
 */
function selectSurfaceKind(options: {
  purpose: "spawn" | "resume";
  background?: boolean;
  attached?: boolean;
}): SurfaceKind {
  const attached = options.attached ?? !!process.env.TMUX;
  if (!attached) return "detached";
  if (options.purpose === "spawn" && options.background === true) return "detached";
  return "split";
}

/**
 * Best-effort pane tag recording the child's session (or AGY state) path and
 * completion file, so a later parent can detect a still-live child and steer
 * it instead of resuming a second process on the same session.
 */
function tagChildSurface(surface: string, sessionPath: string, doneFile?: string): void {
  try {
    tagSurface(surface, { sessionPath, doneFile });
  } catch {
    // Tagging needs tmux 3.0+; a failed tag must never break the launch.
  }
}

/** Optional `maxConcurrent` from config.json; undefined means unlimited. */
let launchCap: number | undefined = statusConfig.maxConcurrent;
/** Launches of this parent that reserved a slot but have not registered yet. */
let inFlightLaunches = 0;

/**
 * Reserve a concurrency slot for a spawn or resume before any pane exists.
 * Counts this parent's running children plus in-flight launches. Inert when
 * `maxConcurrent` is unset. Steering never reserves a slot.
 */
function reserveLaunchSlot(cap: number | undefined = launchCap): { release(): void } | { error: string } {
  if (cap === undefined) return { release() {} };
  const active = runningSubagents.size + inFlightLaunches;
  if (active >= cap) {
    return {
      error:
        `Subagent concurrency limit reached: ${active} of maxConcurrent ${cap} are running or launching. ` +
        `Wait for a running subagent to finish, then retry. No pane was created.`,
    };
  }
  inFlightLaunches += 1;
  let released = false;
  return {
    release() {
      if (released) return;
      released = true;
      inFlightLaunches -= 1;
    },
  };
}

function launchCapResult(error: string) {
  return {
    content: [{ type: "text" as const, text: error }],
    details: { error, status: "over-cap" },
  };
}

function formatWidgetRightLabel(snapshot: StatusSnapshot): string {
  if (snapshot.kind === "starting") return " starting… ";
  if (snapshot.kind === "running") return ` running ${snapshot.elapsedText} `;
  if (snapshot.kind === "active") {
    const label = snapshot.activityLabel ?? snapshot.activeScope;
    const duration = snapshot.activeDurationText ? ` ${snapshot.activeDurationText}` : "";
    return label ? ` active · ${label}${duration} ` : " active ";
  }
  if (snapshot.kind === "waiting") {
    const duration = snapshot.waitingDurationText ? ` ${snapshot.waitingDurationText}` : "";
    const detail = snapshot.statusLabel ? ` · ${snapshot.statusLabel}` : "";
    return ` waiting${duration}${detail} `;
  }

  const detail = snapshot.statusLabel ? ` · ${snapshot.statusLabel}` : "";
  const duration = snapshot.snapshotProblemText ? ` ${snapshot.snapshotProblemText}` : "";
  return ` stalled${detail}${duration} `;
}

function resolveResultPresentation(
  result: Pick<
    SubagentResult,
    | "exitCode"
    | "elapsed"
    | "summary"
    | "sessionFile"
    | "sessionId"
    | "errorMessage"
    | "interrupted"
    | "resumeSupported"
    | "cli"
  >,
  name: string,
): string {
  // Name is the persistent handle. AGY only advertises a follow-up after an
  // exact conversation snapshot was successfully persisted.
  const sessionRef = result.cli === "agy" && result.resumeSupported === false
    ? ""
    : `\n\nFollow up with subagent_message({ name: "${name}", message: "…" })`;

  if (result.interrupted) {
    const isResumable = result.resumeSupported !== false;
    const preservedState = isResumable
      ? result.cli === "agy"
        ? "Its running entry was removed and its exact prior AGY conversation snapshot was preserved. "
        : "Its running entry was removed and its Pi session was preserved. "
      : "Its running entry was removed. ";
    const recovery = isResumable
      ? result.cli === "agy"
        ? "Use subagent_message with the same name to continue the last successfully persisted AGY conversation."
        : `Use subagent_message with the same name to resume it; the interrupted message may ` +
          "already have been accepted, so review the session before replaying work."
      : result.cli === "agy"
        ? "No valid AGY conversation snapshot was persisted, so same-name resume is unavailable."
        : "Claude Code sessions cannot be resumed through subagent_message.";
    return (
      `Sub-agent "${name}" was interrupted because its tmux pane disappeared. ` +
      preservedState + recovery + (isResumable ? sessionRef : "")
    );
  }

  if (result.errorMessage) {
    if (result.cli === "agy") {
      return (
        `AGY sub-agent "${name}" failed after ${formatElapsed(result.elapsed)}.\n\n` +
        `Error: ${result.errorMessage}\n\n` +
        `No successful AGY result or new resumable conversation state was recorded.`
      );
    }
    // Auto-retry exhausted or other Pi agent-loop error.
    return (
      `Sub-agent "${name}" failed after ${formatElapsed(result.elapsed)} ` +
      `(provider/agent error — auto-retry exhausted).\n\n` +
      `Error: ${result.errorMessage}\n\n` +
      `The subagent did not produce a result. You can retry by spawning a new ` +
      `subagent or resume the session with subagent_message.${sessionRef}`
    );
  }

  return result.exitCode !== 0
    ? `Sub-agent "${name}" failed (exit code ${result.exitCode}).\n\n${result.summary}${sessionRef}`
    : `Sub-agent "${name}" completed (${formatElapsed(result.elapsed)}).\n\n${result.summary}${sessionRef}`;
}

/**
 * Result from running a single subagent.
 */
interface SubagentResult {
  name: string;
  task: string;
  cli?: "pi" | "claude" | "agy";
  summary: string;
  sessionFile?: string;
  /** Canonical session header id, used for follow-ups via subagent_message. */
  sessionId?: string;
  claudeSessionId?: string;
  agyConversationId?: string;
  /** Internal native resume snapshot path; never included in public result details. */
  agyStateFile?: string;
  agyUsage?: AgyUsage | null;
  exitCode: number;
  elapsed: number;
  error?: string;
  /** Provider/agent error message when auto-retry exhausted (overload, rate limit, etc.). */
  errorMessage?: string;
  /** Validated terminal provider evidence used only by model-chain classification. */
  providerError?: string;
  chainAttempts?: ChainAttemptProvenance[];
  chainWinnerIndex?: number;
  /** True when the externally owned tmux pane disappeared before completion. */
  interrupted?: boolean;
  /** Whether this child can resume through subagent_message. */
  resumeSupported?: boolean;
  /** Best-effort persistence diagnostic after a valid external result. */
  persistenceError?: string;
  /** Aggregate usage/model/tool stats parsed from the completed session file. */
  stats?: SessionStats;
}

/**
 * State for a launched (but not yet completed) subagent.
 */
interface RunningSubagent {
  id: string;
  name: string;
  task: string;
  agent?: string;
  surface: string;
  startTime: number;
  sessionFile: string;
  launchScriptFile?: string;
  activityFile?: string;
  activity?: SubagentActivityState;
  activityRead?: {
    ok: boolean;
    reason?: "missing" | "invalid" | "wrong-id";
    error?: string;
    field?: string;
  };
  abortController?: AbortController;
  cli?: "pi" | "claude" | "agy";
  sentinelFile?: string;
  /** Exit-code file written by the launch script after the child exits. */
  doneFile?: string;
  agyStdoutFile?: string;
  agyStderrFile?: string;
  agyStateFile?: string;
  agyRegistryPersisted?: boolean;
  chainTarget?: {
    controllerId: string;
    startedAt: number;
    index: number;
    count: number;
    harness: "agy" | "pi";
    model: string;
  };
  statusState: SubagentStatusState;
  /** Keep chain attempts visible in the widget without intermediate parent status steers. */
  suppressStatusMessages?: boolean;
  /** Serializes acknowledgment for an idle waiting child so one activity
   * advance cannot confirm two concurrently submitted generic replies. */
  pendingWaitingReply?: boolean;
  /** Correlated ask_question state registered from the child's atomic request. */
  pendingQuestion?: {
    id: string;
    answerSubmitted: boolean;
    confirmationPending: boolean;
    sawWaiting: boolean;
  };
  /**
   * When true, status transitions (stalled/recovered) do not wake the parent
   * session via a steer message. The widget still updates locally. Used for
   * long-running agents where the user drives the conversation in the
   * subagent's pane (e.g. planner).
   */
  interactive: boolean;
}

/** All currently running subagents, keyed by id. */
const runningSubagents = new Map<string, RunningSubagent>();

// When this extension is loaded inside a subagent that itself spawns children
// (for example, a coordinator delegating to configured children),
// `subagent-runtime-control.ts` runs in the same process and needs to know whether
// this session still has children in flight so it can suppress auto-exit and keep
// the session open until they report back. Expose a live count through a shared
// process-global symbol; the runtime control assumes zero when it is absent.
const RUNNING_CHILDREN_COUNT_KEY = Symbol.for("pi-subagents/running-children-count");
(globalThis as any)[RUNNING_CHILDREN_COUNT_KEY] = () => runningSubagents.size;

// ── Widget management ──

/** Latest ExtensionContext from session_start, used for widget updates. */
let latestCtx: ExtensionContext | null = null;
/** Latest ExtensionAPI, used to deliver ask_question notifications from the watcher. */
let latestPi: ExtensionAPI | null = null;
/**
 * Raw model registry captured at session_start. Renderers run on every TUI
 * frame and must never read ctx getters, which throw after session replacement.
 */
let latestModelRegistry: ContextWindowRegistry | null = null;
/** Set first in session_shutdown; gates late async result delivery. */
let sessionShutDown = false;

/**
 * Deliver an async subagent message. After this instance's session_shutdown
 * the captured `pi` is stale, so delivery is skipped; any throw from a stale
 * API is contained so watcher callbacks never produce unhandled rejections.
 */
function deliverSubagentMessage(
  pi: Pick<ExtensionAPI, "sendMessage">,
  message: Parameters<ExtensionAPI["sendMessage"]>[0],
  options?: Parameters<ExtensionAPI["sendMessage"]>[1],
): void {
  if (sessionShutDown) return;
  try {
    pi.sendMessage(message, options);
  } catch {
    // Stale extension API after session replacement; nothing to deliver to.
  }
  notifyRpcResult(message);
}

/**
 * In RPC mode, surface each `subagent_result` as a host notification
 * (`info` on success, `error` on failure or interruption). TUI is unchanged.
 */
function notifyRpcResult(message: Parameters<ExtensionAPI["sendMessage"]>[0]): void {
  if (message.customType !== "subagent_result") return;
  const ctx = latestCtx;
  if (!ctx || ctx.mode !== "rpc" || !ctx.hasUI) return;
  const details = (message.details ?? {}) as Record<string, unknown>;
  const name = typeof details.name === "string" ? details.name : "subagent";
  const exitCode = typeof details.exitCode === "number" ? details.exitCode : 1;
  const failed = exitCode !== 0 || !!details.error || !!details.errorMessage || !!details.interrupted;
  try {
    ctx.ui.notify(
      failed ? `Subagent "${name}" failed.` : `Subagent "${name}" finished.`,
      failed ? "error" : "info",
    );
  } catch {
    // Stale context after session replacement; the steer message still carries the result.
  }
}

/** Interval timer for widget re-renders. */
let widgetInterval: ReturnType<typeof setInterval> | null = null;

/** Interval timer for status transition checks. */
let statusInterval: ReturnType<typeof setInterval> | null = null;

function formatElapsedMMSS(startTime: number): string {
  const seconds = Math.floor((Date.now() - startTime) / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const ACCENT = "\x1b[38;2;77;163;255m";
const RST = "\x1b[0m";

/**
 * Build a bordered content line: │left          right│
 * Left content is truncated if needed, right is preserved, padded to fill width.
 */
function borderLine(left: string, right: string, width: number): string {
  if (width <= 0) return "";
  if (width === 1) return `${ACCENT}│${RST}`;

  // width = total visible chars for the whole line including │ and │
  const contentWidth = Math.max(0, width - 2); // space inside the two │ chars
  const rightVis = visibleWidth(right);

  // If the status chunk alone is too wide, prefer preserving it in compact form
  // rather than overflowing the terminal.
  if (rightVis >= contentWidth) {
    const truncRight = truncateToWidth(right, contentWidth);
    const rightPad = Math.max(0, contentWidth - visibleWidth(truncRight));
    return `${ACCENT}│${RST}${truncRight}${" ".repeat(rightPad)}${ACCENT}│${RST}`;
  }

  const maxLeft = Math.max(0, contentWidth - rightVis);
  const truncLeft = truncateToWidth(left, maxLeft);
  const leftVis = visibleWidth(truncLeft);
  const pad = Math.max(0, contentWidth - leftVis - rightVis);
  return `${ACCENT}│${RST}${truncLeft}${" ".repeat(pad)}${right}${ACCENT}│${RST}`;
}

/**
 * Build the bordered top line: ╭─ Title ──── info ─╮
 * All chars are accounted for within `width`.
 */
function borderTop(title: string, info: string, width: number): string {
  if (width <= 0) return "";
  if (width === 1) return `${ACCENT}╭${RST}`;

  // ╭─ Title ───...─── info ─╮
  // overhead: ╭─ (2) + space around title (2) + space around info (2) + ─╮ (2) = but we simplify
  const inner = Math.max(0, width - 2); // inside ╭ and ╮
  const titlePart = `─ ${title} `;
  const infoPart = ` ${info} ─`;
  const fillLen = Math.max(0, inner - titlePart.length - infoPart.length);
  const fill = "─".repeat(fillLen);
  const content = `${titlePart}${fill}${infoPart}`.slice(0, inner).padEnd(inner, "─");
  return `${ACCENT}╭${content}╮${RST}`;
}

/**
 * Build the bordered bottom line: ╰──────────────────╯
 */
function borderBottom(width: number): string {
  if (width <= 0) return "";
  if (width === 1) return `${ACCENT}╰${RST}`;

  const inner = Math.max(0, width - 2);
  return `${ACCENT}╰${"─".repeat(inner)}╯${RST}`;
}

function renderSubagentWidgetLines(agents: RunningSubagent[], width: number): string[] {
  const count = agents.length;
  const title = "Subagents";
  const info = `${count} running`;

  const lines: string[] = [borderTop(title, info, width)];

  for (const agent of agents) {
    const elapsed = formatElapsedMMSS(agent.chainTarget?.startedAt ?? agent.startTime);
    const harnessTag = agent.cli === "agy" ? "agy" : null;
    const chainTag = agent.chainTarget
      ? `target ${agent.chainTarget.index}/${agent.chainTarget.count} · ${agent.chainTarget.harness} · ${agent.chainTarget.model}`
      : null;
    const tags = [agent.agent, chainTag ?? harnessTag].filter((tag): tag is string => !!tag);
    const agentTag = tags.length > 0 ? ` (${tags.join(" · ")})` : "";
    const snapshot = classifyStatus(agent.statusState, Date.now());
    const icon = widgetIcon(snapshot.kind);
    const left = ` ${icon} ${elapsed}  ${agent.name}${agentTag} `;
    const right = statusConfig.enabled
      ? formatWidgetRightLabel(snapshot)
      : agent.cli === "claude" || agent.cli === "agy"
        ? " running… "
        : " starting… ";

    lines.push(borderLine(left, right, width));
  }

  lines.push(borderBottom(width));
  return lines;
}

/** Last RPC emissions, so each record is sent only when its content changes. */
let lastRpcWidget: string | null = null;
let lastRpcStatus: string | null = null;

function resetRpcStatusCache(): void {
  lastRpcWidget = null;
  lastRpcStatus = null;
}

function rpcAgentLabel(agent: RunningSubagent): string {
  const harness = agent.chainTarget
    ? `target ${agent.chainTarget.index}/${agent.chainTarget.count} ${agent.chainTarget.harness} ${agent.chainTarget.model}`
    : agent.cli === "agy" || agent.cli === "claude"
      ? agent.cli
      : null;
  const tags = [agent.agent, harness].filter((tag): tag is string => !!tag);
  return tags.length > 0 ? `${agent.name} (${tags.join(", ")})` : agent.name;
}

/** Pi children own a transcript; Claude and AGY have no Pi session file. */
function rpcSessionFile(agent: RunningSubagent): string | undefined {
  return agent.cli === "claude" || agent.cli === "agy" ? undefined : agent.sessionFile;
}

/**
 * Plain string lines for the RPC widget. No per-second elapsed text, so the
 * 1 s refresh cannot produce a stream of changed records.
 */
function buildRpcWidgetLines(agents: RunningSubagent[], now = Date.now()): string[] {
  return [
    `Subagents: ${agents.length} running`,
    ...agents.map((agent) => `- ${rpcAgentLabel(agent)}: ${classifyStatus(agent.statusState, now).kind}`),
  ];
}

/** Versioned machine-readable running state for RPC hosts (`subagents` status key). */
function buildRpcStatusJson(agents: RunningSubagent[], now = Date.now()): string {
  return JSON.stringify({
    v: 1,
    running: agents.map((agent) => {
      const sessionFile = rpcSessionFile(agent);
      return {
        name: agent.name,
        ...(agent.agent ? { agent: agent.agent } : {}),
        state: classifyStatus(agent.statusState, now).kind,
        ...(sessionFile ? { sessionFile } : {}),
      };
    }),
  });
}

/**
 * RPC mode drops TUI component widgets, so emit a string-lines widget and a
 * `subagents` JSON status instead, each only when its content changes, and
 * clear both when no child runs.
 */
function updateRpcStatus(ctx: ExtensionContext): void {
  if (runningSubagents.size === 0) {
    if (lastRpcWidget !== null) ctx.ui.setWidget("subagent-status", undefined);
    if (lastRpcStatus !== null) ctx.ui.setStatus("subagents", undefined);
    resetRpcStatusCache();
    if (widgetInterval) {
      clearInterval(widgetInterval);
      widgetInterval = null;
      (globalThis as any)[WIDGET_INTERVAL_KEY] = null;
    }
    return;
  }

  const agents = Array.from(runningSubagents.values());
  const now = Date.now();
  const lines = buildRpcWidgetLines(agents, now);
  const widgetKey = JSON.stringify(lines);
  if (widgetKey !== lastRpcWidget) {
    ctx.ui.setWidget("subagent-status", lines, { placement: "aboveEditor" });
    lastRpcWidget = widgetKey;
  }
  const status = buildRpcStatusJson(agents, now);
  if (status !== lastRpcStatus) {
    ctx.ui.setStatus("subagents", status);
    lastRpcStatus = status;
  }
}

function updateWidget() {
  if (!latestCtx?.hasUI) return;

  if (latestCtx.mode === "rpc") {
    updateRpcStatus(latestCtx);
    return;
  }

  if (runningSubagents.size === 0) {
    latestCtx.ui.setWidget("subagent-status", undefined);
    if (widgetInterval) {
      clearInterval(widgetInterval);
      widgetInterval = null;
      (globalThis as any)[WIDGET_INTERVAL_KEY] = null;
    }
    return;
  }

  latestCtx.ui.setWidget(
    "subagent-status",
    (_tui: any, _theme: any) => {
      return {
        invalidate() {},
        render(width: number) {
          return renderSubagentWidgetLines(Array.from(runningSubagents.values()), width);
        },
      };
    },
    { placement: "aboveEditor" },
  );
}

const SUBAGENT_CONTROL_TOOLS = ["ask_question"] as const;

function buildVersionedCapabilityEnvironment(
  builtinTools: readonly string[],
  allowedAgents: readonly string[],
  mcpServerReferences?: readonly McpServerReference[],
  mcpSupportTools?: readonly McpSupportTool[],
): string[] {
  return [
    `${SUBAGENT_BUILTIN_TOOLS_ENV}=${shellEscape(builtinTools.join(","))}`,
    // Versions 2 and 3 loadouts share capability protocol 2: registry scopes
    // only extend the canonical MCP reference shape the child re-verifies.
    `${SUBAGENT_CAPABILITY_VERSION_ENV}=${mcpServerReferences === undefined ? "1" : "2"}`,
    `PI_SUBAGENT_ALLOWED=${shellEscape(allowedAgents.join(","))}`,
    ...(mcpServerReferences === undefined
      ? []
      : [
        `${SUBAGENT_MCP_REFERENCES_ENV}=${shellEscape(encodeMcpServerReferences(mcpServerReferences))}`,
        `${SUBAGENT_MCP_SUPPORT_TOOLS_ENV}=${shellEscape((mcpSupportTools ?? []).join(","))}`,
      ]),
  ];
}

function buildProfileCapabilityEnvironment(
  capabilities: PreparedAgentSandbox,
  allowedAgents: readonly string[],
): string[] {
  if (capabilities.grantSpawning !== (allowedAgents.length > 0)) {
    throw new Error("Profile capability environment has inconsistent nested-spawn state");
  }
  return buildVersionedCapabilityEnvironment(
    capabilities.builtinTools,
    allowedAgents,
    capabilities.mcpServerReferences,
    capabilities.mcpSupportTools,
  );
}

function buildResumeCapabilityEnvironment(loadout: SubagentLoadout): string[] {
  const allowedAgents = loadout.spawnable ?? [];
  if ("version" in loadout) {
    return buildVersionedCapabilityEnvironment(
      loadout.builtinTools,
      allowedAgents,
      loadout.version === 1 ? undefined : loadout.mcpServerReferences,
      loadout.version === 1 ? undefined : loadout.mcpSupportTools,
    );
  }
  return [`PI_SUBAGENT_ALLOWED=${shellEscape(allowedAgents.join(","))}`];
}

interface PreparedAgentSandbox {
  builtinTools: string[];
  extensionPaths: string[];
  grantSpawning: boolean;
  mcpServerReferences: McpServerReference[];
  mcpSupportTools: McpSupportTool[];
  /** Exact profile skill files passed to a Pi child with `--skill`. */
  skillPaths: string[];
  /** False adds `--no-skills` so only `skillPaths` load. */
  inheritSkills: boolean;
}

interface PreparedSingleAgentLaunch {
  harness: "pi" | "claude" | "agy";
  effectiveModel?: string;
  effectiveThinking?: AgentDefinition["thinking"];
  effectiveInteractive: boolean;
  effectiveCwd: string | null;
  effectiveAgentDir: string;
  targetCwdForSession: string;
  launchBehavior: ReturnType<typeof resolveLaunchBehavior>;
  grantSpawning: boolean;
  identity: string | null;
  /** System-prompt placement of the body; undefined when it rides in the task. */
  systemPromptMode?: IdentitySystemPromptMode;
  fullTask: string;
  loadout: SubagentLoadout | null;
  capabilities: PreparedAgentSandbox;
  capabilityEnvironment: string[];
  agyNativeTools: string[];
}

interface PreparedChainTarget {
  definition: AgentDefinition;
  target: AgentModelChainTarget;
  launch: PreparedSingleAgentLaunch;
}

interface PreparedModelChainLaunch {
  chainTargets: PreparedChainTarget[];
}

type PreparedAgentLaunch = PreparedSingleAgentLaunch | PreparedModelChainLaunch;

function prepareAgentSandbox(
  agent: AgentDefinition,
): { sandbox: PreparedAgentSandbox } | { error: string } {
  const requestedExtensionPaths = [...(agent.extensionPaths ?? [])];
  const missingPath = requestedExtensionPaths.find((extensionPath) => !isExistingFile(extensionPath));
  if (missingPath) {
    return {
      error:
        `Agent "${agent.name}" resolves extension "${missingPath}", but that file is no longer available. ` +
        `Restore or reinstall the configured package, or update extensions in ${agent.filePath}.`,
    };
  }

  const skillPaths = [...(agent.skillPaths ?? [])];
  const missingSkill = skillPaths.find((skillPath) => !isExistingFile(skillPath));
  if (missingSkill) {
    return {
      error:
        `Agent "${agent.name}" resolves skill "${missingSkill}", but that file is no longer available. ` +
        `Restore the skill, or update skills in ${agent.filePath}.`,
    };
  }

  const grantSpawning = agent.subagentAgents.length > 0;
  const selectsSpawningExtension = requestedExtensionPaths.some(
    (extensionPath) => resolve(extensionPath) === SPAWNING_EXTENSION_PATH,
  );
  if (selectsSpawningExtension && !grantSpawning) {
    return {
      error:
        `Agent "${agent.name}" selects the subagent spawning extension without a subagent_agents grant. ` +
        `Add explicit nested agent names or remove that extension from ${agent.filePath}.`,
    };
  }

  return {
    sandbox: {
      builtinTools: [...agent.builtinTools],
      extensionPaths: requestedExtensionPaths.filter(
        (extensionPath) => resolve(extensionPath) !== SPAWNING_EXTENSION_PATH,
      ),
      grantSpawning,
      mcpServerReferences: [...(agent.mcpServerReferences ?? [])],
      mcpSupportTools: [...(agent.mcpSupportTools ?? [])],
      skillPaths,
      inheritSkills: agent.inheritSkills ?? true,
    },
  };
}

function prepareAgentLaunch(
  params: Static<typeof SubagentParams>,
  agent: AgentDefinition,
  sandbox: PreparedAgentSandbox,
  activeCwd: string,
): { launch: PreparedAgentLaunch } | { error: string } {
  if (agent.modelChain && params.model !== undefined) {
    return {
      error:
        `Agent "${agent.name}" declares model-chain, so the runtime model override is not allowed. ` +
        `Change the ordered targets in ${agent.filePath} or omit model.`,
    };
  }
  const modelOverride = params.model?.trim();
  if (params.model !== undefined && !modelOverride) {
    return { error: "The runtime model override must not be empty." };
  }
  const cwdOverride = params.cwd?.trim();
  if (params.cwd !== undefined && !cwdOverride) {
    return { error: "The runtime cwd override must not be empty." };
  }

  const normalizedParams: Static<typeof SubagentParams> = {
    ...params,
    ...(params.model !== undefined ? { model: modelOverride } : {}),
    ...(params.cwd !== undefined ? { cwd: cwdOverride } : {}),
  };

  if (agent.modelChain) {
    const chainTargets: PreparedChainTarget[] = [];
    for (const target of agent.modelChain) {
      const definition: AgentDefinition = applyPiProfileDefaults({
        ...agent,
        modelChain: undefined,
        cli: target.cli,
        model: target.model,
        thinking: target.thinking,
        extensions: target.extensions,
        extensionPaths: target.extensionPaths,
        skills: [],
        skillPaths: [],
        inheritSkills: undefined,
        subagentAgents: [],
        autoExit: true,
        interactive: false,
        systemPromptMode: target.systemPromptMode,
        sessionMode: target.sessionMode,
      });
      const targetSandbox = prepareAgentSandbox(definition);
      if ("error" in targetSandbox) return targetSandbox;
      const preparedTarget = prepareAgentLaunch(
        normalizedParams,
        definition,
        targetSandbox.sandbox,
        activeCwd,
      );
      if ("error" in preparedTarget) return preparedTarget;
      if ("chainTargets" in preparedTarget.launch) {
        return { error: `Agent "${agent.name}" produced a nested model-chain launch` };
      }
      chainTargets.push({ definition, target, launch: preparedTarget.launch });
    }
    return { launch: { chainTargets } };
  }

  agent = applyPiProfileDefaults(agent);
  const effectiveModel = normalizedParams.model ?? agent.model;
  const effectiveThinking = agent.thinking;
  const effectiveInteractive = resolveEffectiveInteractive(normalizedParams, agent);
  const { effectiveCwd, effectiveAgentDir } = resolveSubagentPaths(
    normalizedParams,
    agent,
    activeCwd,
  );
  const targetCwdForSession = effectiveCwd ?? activeCwd;
  const launchBehavior = resolveLaunchBehavior(normalizedParams, agent);
  const grantSpawning = sandbox.grantSpawning;
  const identity = agent.body ?? null;
  // `task` routes the body into the first user message, exactly like an unset
  // mode: no system-prompt flag and a null loadout identity.
  const systemPromptMode: IdentitySystemPromptMode | undefined =
    agent.systemPromptMode === "task" ? undefined : agent.systemPromptMode;
  const fullTask = buildSubagentTask({
    task: normalizedParams.task,
    body: agent.body,
    systemPromptMode,
    autoExit: agent.autoExit ?? false,
    inheritsConversationContext: launchBehavior.inheritsConversationContext,
  });

  const capabilityEnvironment = buildProfileCapabilityEnvironment(
    sandbox,
    grantSpawning ? agent.subagentAgents : [],
  );
  const harness = agent.cli ?? "pi";
  let agyNativeTools: string[] = [];
  if (harness === "agy") {
    try {
      agyNativeTools = translateAgyTools(sandbox.builtinTools);
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
  const loadoutBase = {
    agent: normalizedParams.agent ?? null,
    builtinTools: [...sandbox.builtinTools],
    extensionPaths: [...sandbox.extensionPaths],
    grantSpawning,
    mcpServerReferences: [...sandbox.mcpServerReferences],
    mcpSupportTools: [...sandbox.mcpSupportTools],
    model: effectiveModel ?? null,
    thinking: effectiveThinking ?? null,
    systemPromptMode: systemPromptMode ?? null,
    identity: systemPromptMode && identity ? identity : null,
    spawnable: grantSpawning ? [...agent.subagentAgents] : null,
    autoExit: agent.autoExit ?? false,
    cwd: targetCwdForSession,
    agentDir: effectiveAgentDir,
  };
  // Version 3 is written only when registry or skill state must be replayed,
  // so profiles without it keep byte-identical version 2 snapshots.
  const needsRegistryLoadout =
    sandbox.skillPaths.length > 0 ||
    !sandbox.inheritSkills ||
    sandbox.mcpServerReferences.some((reference) =>
      reference.scope === "global-registry" || reference.scope === "project-registry"
    );
  const loadout: SubagentLoadout | null = harness !== "pi"
    ? null
    : needsRegistryLoadout
      ? {
        version: 3,
        capabilityMode: "registry-capabilities",
        ...loadoutBase,
        skillPaths: [...sandbox.skillPaths],
        inheritSkills: sandbox.inheritSkills,
      }
      : { version: 2, capabilityMode: "mcp-capabilities", ...loadoutBase };
  if (loadout && !isSubagentLoadout(loadout)) {
    return {
      error:
        `Agent "${agent.name}" produced an invalid sandbox snapshot. ` +
        `Check its model, nested agent names, working directory, and tool configuration in ${agent.filePath}.`,
    };
  }
  if (loadout) {
    const replayError = validateLoadoutPreflight(loadout);
    if (replayError) {
      return {
        error:
          `Agent "${agent.name}" cannot create a safe sandbox snapshot: ${replayError}. ` +
          `Restore the exact configuration or extension input, or update ${agent.filePath}.`,
      };
    }
  }

  return {
    launch: {
      harness,
      effectiveModel,
      effectiveThinking,
      effectiveInteractive,
      effectiveCwd,
      effectiveAgentDir,
      targetCwdForSession,
      launchBehavior,
      grantSpawning,
      identity,
      systemPromptMode,
      fullTask,
      loadout,
      capabilities: sandbox,
      capabilityEnvironment,
      agyNativeTools,
    },
  };
}

function validateLoadoutExtensionPaths(loadout: SubagentLoadout): string | null {
  const runtimeControlPath = join(SUBAGENTS_DIR, "subagent-runtime-control.ts");
  if (!isExistingFile(runtimeControlPath)) {
    return `sandbox runtime control is missing: ${runtimeControlPath}`;
  }

  const activationControlPath = join(SUBAGENTS_DIR, "subagent-capability-activation.ts");
  if ("version" in loadout) {
    if (!isExistingFile(activationControlPath)) {
      return `sandbox capability activation control is missing: ${activationControlPath}`;
    }
    if (loadout.grantSpawning && !isExistingFile(SPAWNING_EXTENSION_PATH)) {
      return `sandbox spawning control is missing: ${SPAWNING_EXTENSION_PATH}`;
    }
  } else {
    const tools = loadout.toolAllowlist.split(",");
    const needsExtension = tools.some((tool) =>
      !BUILTIN_TOOLS.has(tool) && !(SUBAGENT_CONTROL_TOOLS as readonly string[]).includes(tool),
    );
    if (needsExtension && loadout.extensionPaths.length === 0) {
      return "sandbox snapshot has extension-backed tools but no extension paths";
    }
    const grantsSpawning = SPAWNING_TOOLS.every((tool) => tools.includes(tool));
    if (
      grantsSpawning &&
      !loadout.extensionPaths.some((path) => resolve(path) === SPAWNING_EXTENSION_PATH)
    ) {
      return "sandbox snapshot grants spawning without the spawning extension path";
    }
  }

  for (const extensionPath of loadout.extensionPaths) {
    if (!isExistingFile(extensionPath)) {
      return `sandbox extension is missing: ${extensionPath}`;
    }
  }

  if ("version" in loadout) {
    try {
      const canonicalProfilePaths = loadout.extensionPaths.map((path) => realpathSync(path));
      const nonCanonicalIndex = canonicalProfilePaths.findIndex(
        (canonicalPath, index) => canonicalPath !== loadout.extensionPaths[index],
      );
      if (nonCanonicalIndex >= 0) {
        return `sandbox extension path is not canonical: ${loadout.extensionPaths[nonCanonicalIndex]}`;
      }
      if (new Set(canonicalProfilePaths).size !== canonicalProfilePaths.length) {
        return "sandbox snapshot has duplicate canonical extension paths";
      }
      const reservedPaths = new Set([
        realpathSync(runtimeControlPath),
        SPAWNING_EXTENSION_PATH,
        realpathSync(activationControlPath),
        ...(loadout.version !== 1
          ? [realpathSync(join(SUBAGENTS_DIR, "subagent-mcp-control.ts"))]
          : []),
      ]);
      const reservedProfilePath = canonicalProfilePaths.find((path) => reservedPaths.has(path));
      if (reservedProfilePath) {
        return `sandbox snapshot includes reserved framework path as a profile extension: ${reservedProfilePath}`;
      }
    } catch {
      return "sandbox extension path could not be canonicalized";
    }
  }
  return null;
}

function validateLoadoutPreflight(loadout: SubagentLoadout): string | null {
  const extensionError = validateLoadoutExtensionPaths(loadout);
  if (extensionError) return extensionError;
  if (!("version" in loadout) || loadout.version === 1) return null;

  if (loadout.version === 3) {
    for (const skillPath of loadout.skillPaths) {
      if (!isExistingFile(skillPath)) return `sandbox skill is missing: ${skillPath}`;
      try {
        if (realpathSync(skillPath) !== skillPath) return `sandbox skill path is not canonical: ${skillPath}`;
      } catch {
        return `sandbox skill path could not be canonicalized: ${skillPath}`;
      }
    }
  }

  const verified = verifyMcpServerReferences(loadout.mcpServerReferences);
  if ("errors" in verified) return `MCP capability identity check failed: ${verified.errors.join("; ")}`;
  if (verified.supportTools.join(",") !== loadout.mcpSupportTools.join(",")) {
    return "MCP capability support state no longer matches the selected server exposure";
  }
  return null;
}

type ArtifactKind = "sysprompt" | "task" | "message";

function buildArtifactPath(opts: {
  artifactDir: string;
  subdir: "context" | "subagent-resume";
  name: string;
  fallbackName: string;
  kind: ArtifactKind;
  uniqueId: string;
  now?: Date;
}): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(opts.uniqueId)) {
    throw new Error("Artifact unique ID contains unsupported characters");
  }
  const safeName = opts.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const timestamp = (opts.now ?? new Date())
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 23);
  return join(
    opts.artifactDir,
    opts.subdir,
    `${safeName || opts.fallbackName}-${opts.kind}-${timestamp}-${opts.uniqueId}.md`,
  );
}

/** Apply model, identity, and the snapshot's exact capability mode to a Pi command. */
function applySandboxToParts(
  parts: string[],
  loadout: SubagentLoadout,
  opts: {
    artifactDir: string;
    name: string;
    artifactId: string;
  },
): void {
  if (loadout.model) {
    const model = loadout.thinking ? `${loadout.model}:${loadout.thinking}` : loadout.model;
    parts.push("--model", shellEscape(model));
  }

  if (loadout.identity) {
    const flag = loadout.systemPromptMode === "replace" ? "--system-prompt" : "--append-system-prompt";
    const spPath = buildArtifactPath({
      artifactDir: opts.artifactDir,
      subdir: "context",
      name: opts.name,
      fallbackName: "subagent",
      kind: "sysprompt",
      uniqueId: opts.artifactId,
    });
    mkdirSync(dirname(spPath), { recursive: true });
    writeFileSync(spPath, loadout.identity, "utf8");
    parts.push(flag, shellEscape(spPath));
  }

  const runtimeControlPath = join(SUBAGENTS_DIR, "subagent-runtime-control.ts");
  parts.push("-e", shellEscape(runtimeControlPath));

  if ("version" in loadout) {
    parts.push("--no-extensions", "--no-builtin-tools");
    if (loadout.grantSpawning) parts.push("-e", shellEscape(SPAWNING_EXTENSION_PATH));

    if (loadout.version === 3) {
      if (!loadout.inheritSkills) parts.push("--no-skills");
      for (const skillPath of loadout.skillPaths) {
        parts.push("--skill", shellEscape(skillPath));
      }
    }

    if (loadout.version !== 1) {
      const hasMcp = loadout.mcpServerReferences.length > 0;
      if (hasMcp || loadout.builtinTools.includes("codemode")) {
        parts.push("-e", shellEscape("builtin:codemode"));
      }
      if (hasMcp) {
        parts.push("-e", shellEscape("builtin:tool-search"));
        parts.push("-e", shellEscape(join(SUBAGENTS_DIR, "subagent-mcp-control.ts")));
      }
    }

    for (const extensionPath of loadout.extensionPaths) {
      parts.push("-e", shellEscape(extensionPath));
    }
    parts.push("-e", shellEscape(join(SUBAGENTS_DIR, "subagent-capability-activation.ts")));
    return;
  }

  parts.push("--no-extensions", "--tools", shellEscape(loadout.toolAllowlist));
  for (const extensionPath of loadout.extensionPaths) {
    parts.push("-e", shellEscape(extensionPath));
  }
}

function activityLabel(activity: SubagentActivityState): string | undefined {
  if (activity.phase !== "active") return undefined;
  if (activity.activeScope === "tool") return activity.toolName ?? "tool";
  if (activity.activeScope === "provider") return "provider";
  if (activity.activeScope === "streaming") return "streaming";
  return activity.activeScope;
}

function applyRunningActivityRead(
  running: RunningSubagent,
  read: ActivityReadResult,
  observedAt = Date.now(),
): void {
  running.activityRead = read.ok
    ? { ok: true }
    : { ok: false, reason: read.reason, error: read.error, field: read.field };

  if (read.ok) {
    running.activity = read.activity;
    running.statusState = observeStatus(running.statusState, {
      snapshot: "present",
      updatedAt: read.activity.updatedAt,
      sequence: read.activity.sequence,
      phase: read.activity.phase,
      active: read.activity.phase === "active",
      activeScope: read.activity.activeScope,
      activeSince: read.activity.activeSince,
      waitingSince: read.activity.waitingSince,
      latestEvent: read.activity.latestEvent,
      activityLabel: activityLabel(read.activity),
    }, observedAt);
    return;
  }

  running.statusState = observeStatus(running.statusState, {
    snapshot: read.reason,
    snapshotError: read.error,
    snapshotField: read.field,
  }, observedAt);
}

function observeRunningSubagent(
  running: RunningSubagent,
  observedAt = Date.now(),
  readActivity: (activityFile: string, runningChildId: string) => ActivityReadResult =
    readSubagentActivityFile,
) {
  if (running.cli !== undefined && running.cli !== "pi") return;

  const activityFile = running.activityFile;
  const read: ActivityReadResult = activityFile
    ? readActivity(activityFile, running.id)
    : { ok: false, reason: "missing" };
  applyRunningActivityRead(running, read, observedAt);
}

/**
 * Names claimed by spawns that are mid-launch but not yet registered in
 * `runningSubagents`. Parallel `subagent` tool calls run their synchronous
 * prefix (name defaulting) before any of them finishes `launchSubagent` and
 * registers, so without this they'd all see an empty map and pick the same
 * name. Reserved synchronously when a default name is chosen and released once
 * the subagent registers (or its launch fails).
 */
const reservedNames = new Set<string>();
const reservedResumeSessions = new Set<string>();

/**
 * Return `base`, or `base-2`, `base-3`, … so the result is unique within this
 * spawner session. Considers (a) currently-running subagents, (b) names
 * reserved by parallel in-flight spawns, and (c) every name already recorded in
 * the spawner's persistent registry — so a defaulted name never collides with a
 * finished subagent either. This lets `subagent_message({ name })` address any
 * subagent of this session unambiguously, running or finished.
 *
 * `registryNames` is the set of names already taken in the registry (empty when
 * there is no session file / artifact dir yet).
 */
function runtimeNamesTaken(registryNames?: ReadonlySet<string>): Set<string> {
  const taken = new Set(Array.from(runningSubagents.values()).map((running) => running.name));
  for (const reserved of reservedNames) taken.add(reserved);
  if (registryNames) for (const name of registryNames) taken.add(name);
  return taken;
}

function uniqueRunningName(base: string, registryNames?: ReadonlySet<string>): string {
  const taken = runtimeNamesTaken(registryNames);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function claimRuntimeName(
  requestedName: string | undefined,
  defaultBase: string,
  registryNames?: ReadonlySet<string>,
): { name: string } | { error: string } {
  const explicit = requestedName !== undefined;
  const normalized = explicit ? requestedName.trim() : uniqueRunningName(defaultBase, registryNames);
  if (!normalized) return { error: "The subagent runtime name must not be empty." };
  if (/[\x00-\x1f\x7f]/.test(normalized)) {
    return { error: "The subagent runtime name must not contain control characters." };
  }
  if (explicit && runtimeNamesTaken(registryNames).has(normalized)) {
    return {
      error:
        `Subagent runtime name "${normalized}" is already running, reserved, or registered ` +
        `in this parent session. Omit name to receive an automatic suffix, or choose another name.`,
    };
  }
  reservedNames.add(normalized);
  return { name: normalized };
}

function canonicalSessionPath(sessionPath: string): string {
  try {
    return realpathSync(sessionPath);
  } catch {
    return resolve(sessionPath);
  }
}

function claimResumeSession(sessionPath: string):
  | { key: string; release: () => void }
  | { error: string } {
  const key = canonicalSessionPath(sessionPath);
  if (reservedResumeSessions.has(key)) {
    return { error: `Subagent session "${key}" is already being resumed.` };
  }
  reservedResumeSessions.add(key);
  let released = false;
  return {
    key,
    release() {
      if (released) return;
      released = true;
      reservedResumeSessions.delete(key);
    },
  };
}

function resolveRunningByName(name: string):
  | { running: RunningSubagent }
  | { error: string } {
  const requestedName = name.trim();
  if (!requestedName) {
    return { error: "Provide the exact display name of a running subagent." };
  }

  const matches = Array.from(runningSubagents.values()).filter((running) => running.name === requestedName);
  if (matches.length === 1) return { running: matches[0] };
  if (matches.length === 0) {
    const names = Array.from(runningSubagents.values()).map((r) => r.name);
    const hint = names.length
      ? ` Currently running: ${[...new Set(names)].join(", ")}.`
      : " No subagents are currently running.";
    return { error: `No running subagent named "${requestedName}".${hint}` };
  }

  const candidates = matches.map((running) => `${running.name} [${running.id}]`).join(", ");
  return { error: `Ambiguous subagent name "${requestedName}". Matches: ${candidates}` };
}

/**
 * Type a follow-up message into a running subagent's live pane. Newlines are
 * collapsed to spaces because each newline submits a turn in the child's TUI
 * editor; a multi-line message would otherwise fire as several partial turns.
 */
function steerSubagent(
  running: RunningSubagent,
  message: string,
  send: (surface: string, text: string) => void = submitText,
): { ok: true } | { error: string } {
  const flattened = message.replace(/\s*\n\s*/g, " ").trim();
  try {
    send(running.surface, flattened);
    return { ok: true };
  } catch (error: any) {
    return {
      error:
        `Failed to submit message to subagent "${running.name}" via tmux: ` +
        `${error?.message ?? String(error)}`,
    };
  }
}

const WAITING_REPLY_ACK_TIMEOUT_MS = 2_500;
const WAITING_REPLY_ACK_POLL_MS = 50;

function activityAcknowledgesReply(
  read: ActivityReadResult,
  runningChildId: string,
  baselineSequence: number,
): boolean {
  if (!read.ok || read.activity.runningChildId !== runningChildId) return false;
  if (read.activity.sequence <= baselineSequence) return false;
  return read.activity.latestEvent === "input" || read.activity.phase === "active";
}

async function waitForWaitingReplyAcknowledgment(
  running: RunningSubagent,
  baselineSequence: number,
  options: {
    timeoutMs?: number;
    pollMs?: number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
    readActivity?: (activityFile: string, runningChildId: string) => ActivityReadResult;
  } = {},
): Promise<boolean> {
  if (!running.activityFile) return false;
  const timeoutMs = options.timeoutMs ?? WAITING_REPLY_ACK_TIMEOUT_MS;
  const pollMs = options.pollMs ?? WAITING_REPLY_ACK_POLL_MS;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const readActivity = options.readActivity ?? readSubagentActivityFile;
  const deadline = now() + timeoutMs;

  for (;;) {
    const read = readActivity(running.activityFile, running.id);
    applyRunningActivityRead(running, read, now());
    if (activityAcknowledgesReply(read, running.id, baselineSequence)) return true;
    if (now() >= deadline) return false;
    await sleep(Math.min(pollMs, Math.max(0, deadline - now())));
  }
}

function clearMatchingPendingQuestion(running: RunningSubagent, id: string): boolean {
  if (running.pendingQuestion?.id !== id) return false;
  removeMatchingQuestionRequest(questionRequestPath(running.sessionFile), id);
  removeMatchingQuestionAcknowledgment(questionAcknowledgmentPath(running.sessionFile), id);
  delete running.pendingQuestion;
  return true;
}

function reconcilePendingQuestion(running: RunningSubagent): void {
  const pending = running.pendingQuestion;
  if (!pending) return;
  if (running.activity?.phase === "waiting") pending.sawWaiting = true;
  if (pending.confirmationPending) return;

  if (readQuestionAcknowledgment(questionAcknowledgmentPath(running.sessionFile)) === pending.id) {
    clearMatchingPendingQuestion(running, pending.id);
    return;
  }

  // After a submitted answer, a later non-tool active phase proves the child
  // progressed beyond question waiting even if the short-lived ack marker was
  // missed. Tool activity alone may be a sibling call from the original batch.
  const activity = running.activity;
  if (
    pending.answerSubmitted &&
    pending.sawWaiting &&
    activity?.phase === "active" &&
    activity.activeScope !== "tool" &&
    activity.latestEvent !== "input"
  ) {
    clearMatchingPendingQuestion(running, pending.id);
  }
}

async function waitForQuestionAcknowledgment(
  running: RunningSubagent,
  id: string,
  options: {
    timeoutMs?: number;
    pollMs?: number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
    readAcknowledgment?: (path: string) => string | null;
  } = {},
): Promise<boolean> {
  const timeoutMs = options.timeoutMs ?? WAITING_REPLY_ACK_TIMEOUT_MS;
  const pollMs = options.pollMs ?? WAITING_REPLY_ACK_POLL_MS;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const readAcknowledgment = options.readAcknowledgment ?? readQuestionAcknowledgment;
  const acknowledgmentFile = questionAcknowledgmentPath(running.sessionFile);
  const deadline = now() + timeoutMs;

  for (;;) {
    if (readAcknowledgment(acknowledgmentFile) === id) return true;
    if (now() >= deadline) return false;
    await sleep(Math.min(pollMs, Math.max(0, deadline - now())));
  }
}

async function handleSubagentSteer(
  params: { name?: string; message?: string },
  options: {
    send?: (surface: string, text: string) => void;
    timeoutMs?: number;
    pollMs?: number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
    readActivity?: (activityFile: string, runningChildId: string) => ActivityReadResult;
    readAcknowledgment?: (path: string) => string | null;
  } = {},
) {
  const rawMessage = params.message;
  if (typeof rawMessage !== "string" || rawMessage.trim() === "") {
    const err = "`message` is required to steer a running subagent.";
    return { content: [{ type: "text" as const, text: err }], details: { error: err } };
  }

  const resolved = resolveRunningByName(params.name ?? "");
  if ("error" in resolved) {
    return {
      content: [{ type: "text" as const, text: resolved.error }],
      details: { error: resolved.error },
    };
  }

  const running = resolved.running;
  if (running.chainTarget) {
    const err =
      `Active steering is unsupported while model-chain subagent "${running.name}" is running ` +
      `target ${running.chainTarget.index}/${running.chainTarget.count}. Wait for its single final result.`;
    return {
      content: [{ type: "text" as const, text: err }],
      details: { error: err, id: running.id, name: running.name, status: "unsupported", harness: "chain" },
    };
  }
  if (running.cli === "agy") {
    const err =
      `Active steering is unsupported for AGY subagent "${running.name}". ` +
      `Wait for its one-shot run to finish, then use the same name to continue the persisted conversation.`;
    return {
      content: [{ type: "text" as const, text: err }],
      details: { error: err, id: running.id, name: running.name, status: "unsupported" },
    };
  }
  const now = options.now ?? Date.now;
  const observedAt = now();
  observeRunningSubagent(running, observedAt, options.readActivity);
  reconcilePendingQuestion(running);

  const pendingQuestion = running.pendingQuestion;
  if (pendingQuestion) {
    if (pendingQuestion.answerSubmitted) {
      const err =
        `An answer to question ${pendingQuestion.id} from subagent "${running.name}" was already submitted. ` +
        `Do not resend automatically; wait for acknowledgment or a child-state transition.`;
      return {
        content: [{ type: "text" as const, text: err }],
        details: { error: err, id: running.id, name: running.name, questionId: pendingQuestion.id },
      };
    }

    pendingQuestion.answerSubmitted = true;
    pendingQuestion.confirmationPending = true;
    try {
      (options.send ?? submitText)(
        running.surface,
        encodeQuestionAnswer(pendingQuestion.id, rawMessage),
      );
    } catch (error: any) {
      if (running.pendingQuestion?.id === pendingQuestion.id) {
        pendingQuestion.answerSubmitted = false;
        pendingQuestion.confirmationPending = false;
      }
      const err =
        `Failed to submit answer to subagent "${running.name}" via tmux: ` +
        `${error?.message ?? String(error)}`;
      return {
        content: [{ type: "text" as const, text: err }],
        details: { error: err, id: running.id, name: running.name, questionId: pendingQuestion.id },
      };
    }

    let confirmed = false;
    try {
      confirmed = await waitForQuestionAcknowledgment(running, pendingQuestion.id, options);
    } finally {
      if (running.pendingQuestion?.id === pendingQuestion.id) {
        pendingQuestion.confirmationPending = false;
      }
    }
    updateWidget();

    if (confirmed) {
      clearMatchingPendingQuestion(running, pendingQuestion.id);
      return {
        content: [{
          type: "text" as const,
          text: `Answer delivered to question ${pendingQuestion.id} from subagent "${running.name}".`,
        }],
        details: {
          id: running.id,
          name: running.name,
          questionId: pendingQuestion.id,
          status: "delivered",
        },
      };
    }

    return {
      content: [{
        type: "text" as const,
        text:
          `Answer was submitted to question ${pendingQuestion.id} from subagent "${running.name}", ` +
          `but matching acknowledgment was not observed before the timeout. Do not resend or ` +
          `terminate it automatically because the answer may still be processed.`,
      }],
      details: {
        id: running.id,
        name: running.name,
        questionId: pendingQuestion.id,
        status: "unconfirmed",
      },
    };
  }

  const message = rawMessage.trim();
  const waitingBaseline =
    running.cli !== "claude" &&
    running.activityRead?.ok === true &&
    running.activity?.phase === "waiting"
      ? running.activity.sequence
      : null;

  if (waitingBaseline != null && running.pendingWaitingReply) {
    const err =
      `A reply to waiting subagent "${running.name}" is already awaiting confirmation. ` +
      `Do not resend automatically; wait for that call to settle.`;
    return {
      content: [{ type: "text" as const, text: err }],
      details: { error: err, id: running.id, name: running.name },
    };
  }

  if (waitingBaseline != null) running.pendingWaitingReply = true;
  const steer = steerSubagent(running, message, options.send ?? submitText);
  if ("error" in steer) {
    running.pendingWaitingReply = false;
    return {
      content: [{ type: "text" as const, text: steer.error }],
      details: { error: steer.error, id: running.id, name: running.name },
    };
  }

  if (waitingBaseline != null) {
    let confirmed = false;
    try {
      confirmed = await waitForWaitingReplyAcknowledgment(running, waitingBaseline, options);
    } finally {
      running.pendingWaitingReply = false;
    }
    updateWidget();

    if (confirmed) {
      return {
        content: [{
          type: "text" as const,
          text:
            `Message delivered to waiting subagent "${running.name}"; newer child activity ` +
            `confirmed that it consumed or started processing the reply.`,
        }],
        details: { id: running.id, name: running.name, status: "delivered" },
      };
    }

    return {
      content: [{
        type: "text" as const,
        text:
          `Message was submitted to waiting subagent "${running.name}", but delivery could not ` +
          `be confirmed before the timeout. Do not resend or terminate it automatically because ` +
          `the reply may still run. If the pane is wedged, explicitly terminate that child or pane; ` +
          `the watcher will release the running name and preserve the session for a same-name resume.`,
      }],
      details: { id: running.id, name: running.name, status: "unconfirmed" },
    };
  }

  running.statusState = forceStatusAfterInterrupt(running.statusState, observedAt);
  updateWidget();

  return {
    content: [{
      type: "text" as const,
      text:
        `Message submitted to running subagent "${running.name}". tmux accepted the input, but ` +
        `this child's activity stream cannot uniquely confirm consumption. If it exits, its result ` +
        `still arrives as a steer message.`,
    }],
    details: { id: running.id, name: running.name, status: "submitted" },
  };
}

/** Test seam for live-orphan detection and steering transport. */
let orphanPaneOps: {
  find: (sessionPath: string) => LiveTaggedPaneLookup;
  send: (surface: string, text: string) => void;
} = { find: findLiveTaggedPane, send: submitText };

type RegistryEntry = NonNullable<ReturnType<typeof resolveNameInRegistry>>;

/**
 * Parent-restart guard (D2). When the registry entry's session (or AGY state)
 * file is not owned by a child in this process but a live tagged pane for it
 * exists, steer that pane instead of resuming a second process on the same
 * session. An unknown lookup refuses the resume rather than risk a double
 * launch. Returns null when the caller may continue to resume.
 */
async function guardLiveOrphan(
  name: string,
  entry: RegistryEntry,
  rawMessage: string | undefined,
): Promise<{ content: Array<{ type: "text"; text: string }>; details: Record<string, unknown> } | null> {
  const isAgy = "harness" in entry && entry.harness === "agy";
  const sessionPath = "harness" in entry
    ? (entry.harness === "agy" ? entry.stateFile : null)
    : entry.sessionFile;
  if (!sessionPath) return null;

  // A child of this process is handled by the in-memory steering paths.
  const key = canonicalSessionPath(sessionPath);
  for (const running of runningSubagents.values()) {
    if (running.sessionFile && canonicalSessionPath(running.sessionFile) === key) return null;
    if (running.agyStateFile && canonicalSessionPath(running.agyStateFile) === key) return null;
  }

  const lookup = orphanPaneOps.find(sessionPath);
  if (lookup.status === "absent") return null;
  if (lookup.status === "unknown") {
    const err =
      `Cannot safely resume "${name}": could not determine whether its earlier run is still live in tmux ` +
      `(${lookup.error}). Retry shortly; resuming now could start a second process on the same session.`;
    return { content: [{ type: "text", text: err }], details: { error: err, name, status: "unknown" } };
  }

  if (isAgy) {
    const err =
      `AGY subagent "${name}" is still running in tmux pane ${lookup.surface} from an earlier parent session. ` +
      `Active steering is unsupported for AGY; wait for its one-shot run to finish, then use the same name to continue.`;
    return {
      content: [{ type: "text", text: err }],
      details: { error: err, name, status: "unsupported", surface: lookup.surface, orphan: true },
    };
  }

  const flattened = (rawMessage ?? "").replace(/\s*\n\s*/g, " ").trim();
  if (!flattened) {
    const err = `Subagent "${name}" is still running in tmux pane ${lookup.surface}; \`message\` is required to steer it.`;
    return { content: [{ type: "text", text: err }], details: { error: err, name, surface: lookup.surface } };
  }
  try {
    orphanPaneOps.send(lookup.surface, flattened);
  } catch (error: any) {
    const err =
      `Failed to submit message to still-running subagent "${name}" via tmux: ${error?.message ?? String(error)}`;
    return { content: [{ type: "text", text: err }], details: { error: err, name, surface: lookup.surface } };
  }
  return {
    content: [{
      type: "text",
      text:
        `Message submitted to still-running subagent "${name}" in tmux pane ${lookup.surface}. ` +
        `It was started by an earlier parent session, so its result will NOT be delivered to this session ` +
        `automatically; read its session file or use the same name again after it finishes.`,
    }],
    details: { name, status: "submitted", surface: lookup.surface, orphan: true, sessionFile: sessionPath },
  };
}

function startStatusRefresh(pi: ExtensionAPI) {
  if (!statusConfig.enabled || statusInterval) return;

  statusInterval = setInterval(() => {
    if (runningSubagents.size === 0) {
      if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
        (globalThis as any)[STATUS_INTERVAL_KEY] = null;
      }
      return;
    }

    const transitionLines: string[] = [];
    const now = Date.now();
    let shouldRefreshWidget = false;

    for (const running of runningSubagents.values()) {
      observeRunningSubagent(running, now);
      const { nextState, snapshot, transition } = advanceStatusState(running.statusState, now);
      if (nextState.currentKind !== running.statusState.currentKind) {
        shouldRefreshWidget = true;
      }
      running.statusState = nextState;

      // Interactive subagents (long-running, user-driven) intentionally don't
      // wake the parent session on stalled/recovered transitions — the user is
      // working in the subagent's pane, and a steer message here would burn an
      // orchestrator turn on a no-op "still waiting" ping. Widget still updates.
      if (transition && !running.interactive && !running.suppressStatusMessages) {
        transitionLines.push(formatTransitionLine(running.name, snapshot, transition));
      }
    }

    if (shouldRefreshWidget) updateWidget();

    if (transitionLines.length > 0) {
      const capped = capStatusLines(transitionLines, statusConfig.lineLimit);
      pi.sendMessage(
        {
          customType: "subagent_status",
          content: formatStatusAggregate(transitionLines, statusConfig.lineLimit),
          display: true,
          details: { lines: capped.visibleLines, overflow: capped.overflow },
        },
        { triggerTurn: true, deliverAs: "steer" },
      );
    }
  }, 1000);

  (globalThis as any)[STATUS_INTERVAL_KEY] = statusInterval;
}

// Resuming a finished session is always autonomous: the relaunched agent runs
// its follow-up task to completion and the harness delivers the result as a
// steer message (fire-and-forget). An interactive resume would park the pane
// waiting for the user, contradicting that result-delivery model.
function resolveResumeLaunchBehavior(): { autoExit: boolean; interactive: boolean } {
  return { autoExit: true, interactive: false };
}

export const __test__ = {
  borderLine,
  findAgentDefinition: findAgentDefinitionForTest,
  getShellReadyDelayMs,
  renderSubagentWidgetLines,
  discoverAgentDefinitions,
  resolveEffectiveSessionMode,
  resolveLaunchBehavior,
  resolveEffectiveInteractive,
  applyPiProfileDefaults,
  buildProfileCapabilityEnvironment,
  parseSubagentAllowlist,
  buildSubagentTask,
  prepareAgentSandbox,
  prepareAgentLaunch,
  validateLoadoutExtensionPaths,
  validateLoadoutPreflight,
  buildArtifactPath,
  applySandboxToParts,
  buildResumeCapabilityEnvironment,
  formatWidgetRightLabel,
  observeRunningSubagent,
  activityAcknowledgesReply,
  waitForWaitingReplyAcknowledgment,
  waitForQuestionAcknowledgment,
  reconcilePendingQuestion,
  deliverPendingQuestion,
  resolveRunningByName,
  uniqueRunningName,
  claimRuntimeName,
  canonicalSessionPath,
  claimResumeSession,
  reservedNames,
  reservedResumeSessions,
  steerSubagent,
  handleSubagentSteer,
  resolveResultPresentation,
  resolveChainResultPresentation,
  resolveResumeLaunchBehavior,
  withAgyPolicyWarning,
  watchSubagent,
  runningSubagents,
  formatElapsed,
  formatTokens,
  formatContextUsage,
  contextWindowFor,
  resolveContextWindow,
  deliverSubagentMessage,
  formatUsageSegments,
  widgetIcon,
  selectSurfaceKind,
  reserveLaunchSlot,
  guardLiveOrphan,
  buildRpcWidgetLines,
  buildRpcStatusJson,
  updateWidget,
  notifyRpcResult,
  get inFlightLaunches() {
    return inFlightLaunches;
  },
  setLaunchCapForTest(cap: number | undefined) {
    launchCap = cap;
  },
  setOrphanPaneOpsForTest(ops: typeof orphanPaneOps | null) {
    orphanPaneOps = ops ?? { find: findLiveTaggedPane, send: submitText };
  },
  setLatestCtxForTest(ctx: ExtensionContext | null) {
    latestCtx = ctx;
    resetRpcStatusCache();
  },
};

function startWidgetRefresh() {
  if (widgetInterval) return;
  updateWidget(); // immediate first render
  widgetInterval = setInterval(() => {
    updateWidget();
  }, 1000);
  (globalThis as any)[WIDGET_INTERVAL_KEY] = widgetInterval;
}

/**
 * Launch a subagent: creates the multiplexer pane, builds the command, and
 * sends it. Returns a RunningSubagent — does NOT poll.
 *
 * Call watchSubagent() on the returned object to observe completion.
 */
async function launchSubagent(
  params: typeof SubagentParams.static,
  ctx: { sessionManager: { getSessionFile(): string | null; getSessionId(): string; getSessionDir(): string }; cwd: string },
  agentDefs: AgentDefinition,
  prepared: PreparedSingleAgentLaunch,
  options?: { surface?: string; surfaceKind?: SurfaceKind },
): Promise<RunningSubagent> {
  const startTime = Date.now();
  const id = randomUUID();
  const {
    harness,
    effectiveModel,
    effectiveInteractive,
    effectiveCwd,
    effectiveAgentDir,
    targetCwdForSession,
    launchBehavior,
    grantSpawning,
    identity,
    fullTask,
    loadout,
    capabilityEnvironment,
    agyNativeTools,
  } = prepared;

  const sessionFile = ctx.sessionManager.getSessionFile();
  if (!sessionFile) throw new Error("No session file");
  const sessionId = ctx.sessionManager.getSessionId();
  const artifactDir = getArtifactDir(ctx.sessionManager.getSessionDir(), sessionId);
  const surfaceKind = options?.surfaceKind ?? selectSurfaceKind({ purpose: "spawn" });

  // AGY is an artifact-backed one-shot external harness. Build and validate its
  // complete capability and replay contract before creating a tmux pane.
  if (harness === "agy") {
    const agentRoot = join(artifactDir, "agy", "workspaces", id);
    const agentName = buildAgyAgentName(agentDefs.name, id);
    const description = agentDefs.description?.trim() || `Pi subagent profile ${agentDefs.name}`;
    const identity = agentDefs.body?.trim();
    if (!identity) throw new Error(`AGY agent "${agentDefs.name}" has no identity body`);
    const agentMarkdown = serializeAgyAgent({
      name: agentName,
      description,
      nativeTools: agyNativeTools,
      identity,
    });
    const taskFile = join(artifactDir, "agy", "tasks", `${id}.txt`);
    const stdoutFile = join(artifactDir, "agy", "results", `${id}.json`);
    const stderrFile = join(artifactDir, "agy", "results", `${id}.stderr.txt`);
    const stateFile = join(artifactDir, "agy", "state", `${id}.json`);
    mkdirSync(dirname(taskFile), { recursive: true });
    mkdirSync(dirname(stdoutFile), { recursive: true });
    writeFileSync(taskFile, params.task, { encoding: "utf8", mode: 0o600 });
    writeFileSync(stdoutFile, "", { encoding: "utf8", mode: 0o600 });
    writeFileSync(stderrFile, "", { encoding: "utf8", mode: 0o600 });
    writeAgyAgent(agentRoot, agentName, agentMarkdown);
    const resolvedChildCwd = resolve(targetCwdForSession);
    const agyState: AgyResumeState = {
      version: 2,
      harness: "agy",
      conversationId: null,
      profileName: agentDefs.name,
      runtimeName: params.name,
      description,
      cwd: resolvedChildCwd,
      model: effectiveModel ?? null,
      effort: prepared.effectiveThinking ?? null,
      identity,
      logicalTools: [...prepared.capabilities.builtinTools],
      nativeTools: [...agyNativeTools],
      agentRoot: resolve(agentRoot),
      agentName,
      agentMarkdown,
      additionalWorkspaceRoots: deriveAgyAdditionalWorkspaceRoots(ctx.cwd, resolvedChildCwd),
    };
    writeAgyResumeState(stateFile, agyState);
    const replayError = validateAgyReplayState(agyState);
    if (replayError) throw new Error(`Cannot launch AGY agent safely: ${replayError}`);
    const definitionPath = agyAgentDefinitionPath(agentRoot, agentName);
    if (!isExistingFile(definitionPath)) throw new Error(`Generated AGY agent is missing: ${definitionPath}`);

    const surfacePreCreated = !!options?.surface;
    const surface = options?.surface ?? createSurfaceOfKind(surfaceKind, params.name);
    if (!surfacePreCreated) {
      await new Promise<void>((done) => setTimeout(done, getShellReadyDelayMs()));
    }
    const doneFile = prepareSubagentDoneFile(artifactDir, id);
    tagChildSurface(surface, stateFile, doneFile);
    const agyCommand = buildAgyCommand({
      agentRoot: agyState.agentRoot,
      additionalWorkspaceRoots: agyAdditionalWorkspaceRoots(agyState),
      agentName,
      taskFile,
      stdoutFile,
      stderrFile,
      doneFile,
      model: effectiveModel ?? null,
      effort: prepared.effectiveThinking ?? null,
    });
    const command = `cd ${shellEscape(agyState.cwd)} && ${agyCommand}`;
    const launchScriptFile = join(artifactDir, "subagent-scripts", `${agentName}.sh`);
    sendLongCommand(surface, command, {
      scriptPath: launchScriptFile,
      scriptPreamble: [
        `# AGY subagent launch script for ${params.name}`,
        `# Generated: ${new Date().toISOString()}`,
        `# Surface: ${surface}`,
      ].join("\n"),
    });
    const running: RunningSubagent = {
      id,
      name: params.name,
      task: params.task,
      agent: params.agent,
      surface,
      startTime,
      sessionFile: stdoutFile,
      launchScriptFile,
      cli: "agy",
      doneFile,
      agyStdoutFile: stdoutFile,
      agyStderrFile: stderrFile,
      agyStateFile: stateFile,
      interactive: false,
      statusState: createStatusState({ source: "agy", startTimeMs: startTime }),
    };
    runningSubagents.set(id, running);
    return running;
  }

  const sessionDir = getDefaultSessionDirFor(targetCwdForSession, effectiveAgentDir);

  // Generate a deterministic session file path for this subagent.
  // This eliminates race conditions when multiple agents launch simultaneously —
  // each agent knows exactly which file is theirs.
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 23) + "Z";
  const uuid = randomUUID();
  const subagentSessionFile = join(sessionDir, `${timestamp}_${uuid}.jsonl`);

  // Use pre-created surface (parallel mode) or create a new one.
  // For new surfaces, pause briefly so the shell is ready before sending the command.
  const surfacePreCreated = !!options?.surface;
  const surface = options?.surface ?? createSurfaceOfKind(surfaceKind, params.name);
  if (!surfacePreCreated) {
    await new Promise<void>((resolve) => setTimeout(resolve, getShellReadyDelayMs()));
  }

  if (launchBehavior.seededSessionMode) {
    seedSubagentSessionFile({
      mode: launchBehavior.seededSessionMode,
      parentSessionFile: sessionFile,
      childSessionFile: subagentSessionFile,
      childCwd: targetCwdForSession,
    });
  }

  const activityFile = getSubagentActivityFile(artifactDir, id);
  mkdirSync(dirname(activityFile), { recursive: true });

  // The complete launch plan was built and validated before pane creation.
  // Only launch side effects remain below.
  // ── Claude Code CLI path ──
  if (agentDefs?.cli === "claude") {
    const sentinelFile = `/tmp/pi-claude-${id}-done`;
    const pluginDir = join(SUBAGENTS_DIR, "plugin");

    const cmdParts: string[] = [];
    cmdParts.push(`PI_CLAUDE_SENTINEL=${shellEscape(sentinelFile)}`);
    cmdParts.push("claude");
    cmdParts.push("--dangerously-skip-permissions");

    if (existsSync(pluginDir)) {
      cmdParts.push("--plugin-dir", shellEscape(pluginDir));
    }

    if (effectiveModel) {
      cmdParts.push("--model", shellEscape(effectiveModel));
    }

    const sp = identity;
    if (sp) {
      cmdParts.push("--append-system-prompt", shellEscape(sp));
    }

    // Always pass the task as the prompt — even for resumed sessions,
    // the caller's task is the follow-up instruction.
    cmdParts.push(shellEscape(params.task));

    const cdPrefix = effectiveCwd ? `cd ${shellEscape(effectiveCwd)} && ` : "";
    const doneFile = prepareSubagentDoneFile(artifactDir, id);
    tagChildSurface(surface, subagentSessionFile, doneFile);
    const command = `${cdPrefix}${cmdParts.join(" ")}${completionSuffix(doneFile)}`;

    const launchScriptName = `${(params.name || "subagent")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "subagent"}-${id}.sh`;
    const launchScriptFile = join(artifactDir, "subagent-scripts", launchScriptName);

    sendLongCommand(surface, command, {
      scriptPath: launchScriptFile,
      scriptPreamble: [
        `# Claude Code subagent launch script for ${params.name}`,
        `# Generated: ${new Date().toISOString()}`,
        `# Surface: ${surface}`,
      ].join("\n"),
    });

    const running: RunningSubagent = {
      id,
      name: params.name,
      task: params.task,
      agent: params.agent,
      surface,
      startTime,
      sessionFile: subagentSessionFile,
      launchScriptFile,
      cli: "claude",
      sentinelFile,
      doneFile,
      interactive: effectiveInteractive,
      statusState: createStatusState({
        source: "claude",
        startTimeMs: startTime,
      }),
    };

    runningSubagents.set(id, running);
    return running;
  }

  // ── Pi CLI path ──

  // Build pi command
  const parts: string[] = ["pi"];
  parts.push("--session", shellEscape(subagentSessionFile));

  // Resolve the config dir the child sees: a target-local .pi/agent/ wins,
  // else the propagated global dir. Captured once so the launch env and the
  // resume snapshot agree.
  const resolvedAgentDir = effectiveAgentDir;

  // Persist and apply the same versioned capability snapshot used by resume.
  if (!loadout) throw new Error(`Pi agent "${agentDefs.name}" has no sandbox snapshot`);
  writeSubagentLoadout(subagentSessionFile, loadout);
  applySandboxToParts(parts, loadout, {
    artifactDir,
    name: params.name,
    artifactId: id,
  });

  // Build env prefix: subagent identity + config dir propagation + spawn allowlist
  const envParts: string[] = [];

  if (resolvedAgentDir) {
    envParts.push(`PI_CODING_AGENT_DIR=${shellEscape(resolvedAgentDir)}`);
  }
  envParts.push(...capabilityEnvironment);
  envParts.push(`PI_SUBAGENT_NAME=${shellEscape(params.name)}`);
  if (params.agent) {
    envParts.push(`PI_SUBAGENT_AGENT=${shellEscape(params.agent)}`);
  }
  // The prepared snapshot carries the resolved auto-exit (Pi defaults applied).
  if (loadout.autoExit) {
    envParts.push(`PI_SUBAGENT_AUTO_EXIT=1`);
  }
  envParts.push(`PI_SUBAGENT_SESSION=${shellEscape(subagentSessionFile)}`);
  envParts.push(`PI_SUBAGENT_ID=${shellEscape(id)}`);
  envParts.push(`PI_SUBAGENT_ACTIVITY_FILE=${shellEscape(activityFile)}`);
  envParts.push(`PI_SUBAGENT_SURFACE=${shellEscape(surface)}`);
  const envPrefix = envParts.join(" ") + " ";

  // Pass the task to the sub-agent. Profile skills are discoverable through
  // `--skill` flags in the sandbox and are never invoked at startup.
  // Only full-context fork mode gets a direct task argument because it already
  // inherits the parent conversation. Blank-session modes use artifact-backed
  // handoff so the wrapper instructions arrive as the initial user message.
  let taskArg: string;
  if (launchBehavior.taskDelivery === "direct") {
    taskArg = fullTask;
  } else {
    const artifactPath = buildArtifactPath({
      artifactDir,
      subdir: "context",
      name: params.name,
      fallbackName: "subagent",
      kind: "task",
      uniqueId: id,
    });
    mkdirSync(dirname(artifactPath), { recursive: true });
    writeFileSync(artifactPath, fullTask, "utf8");
    taskArg = `@${artifactPath}`;
  }

  parts.push(shellEscape(taskArg));

  // Resolve cwd — param overrides agent default, supports absolute and relative paths.
  // This was already computed above so session placement, PI_CODING_AGENT_DIR, and cd agree.
  const cdPrefix = effectiveCwd ? `cd ${shellEscape(effectiveCwd)} && ` : "";

  const piCommand = cdPrefix + envPrefix + parts.join(" ");
  const doneFile = prepareSubagentDoneFile(artifactDir, id);
  tagChildSurface(surface, subagentSessionFile, doneFile);
  const command = `${piCommand}${completionSuffix(doneFile)}`;
  const launchScriptName = `${(params.name || "subagent")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "subagent"}-${id}.sh`;
  const launchScriptFile = join(artifactDir, "subagent-scripts", launchScriptName);
  sendLongCommand(surface, command, {
    scriptPath: launchScriptFile,
    scriptPreamble: [
      `# Subagent launch script for ${params.name}`,
      `# Generated: ${new Date().toISOString()}`,
      `# Session: ${subagentSessionFile}`,
      `# Surface: ${surface}`,
    ].join("\n"),
  });

  const running: RunningSubagent = {
    id,
    name: params.name,
    task: params.task,
    agent: params.agent,
    surface,
    startTime,
    sessionFile: subagentSessionFile,
    launchScriptFile,
    activityFile,
    doneFile,
    interactive: effectiveInteractive,
    statusState: createStatusState({
      source: "pi",
      startTimeMs: startTime,
    }),
  };

  runningSubagents.set(id, running);
  return running;
}

/**
 * Watch a launched subagent until it exits. Polls for completion, extracts
 * the summary from the session file, cleans up the surface,
 * and removes the entry from runningSubagents.
 */
const CLAUDE_SESSIONS_DIR = join(
  process.env.HOME ?? "/tmp",
  ".pi", "agent", "sessions", "claude-code",
);

function copyClaudeSession(sentinelFile: string): string | null {
  try {
    const transcriptFile = sentinelFile + ".transcript";
    if (!existsSync(transcriptFile)) return null;
    const transcriptPath = readFileSync(transcriptFile, "utf-8").trim();
    if (!transcriptPath || !existsSync(transcriptPath)) return null;
    mkdirSync(CLAUDE_SESSIONS_DIR, { recursive: true });
    const filename = transcriptPath.split("/").pop() ?? `claude-${Date.now()}.jsonl`;
    const dest = join(CLAUDE_SESSIONS_DIR, filename);
    copyFileSync(transcriptPath, dest);
    return filename;
  } catch {
    return null;
  }
}

/**
 * Register one strict atomic `ask_question` request and notify the orchestrator.
 * Correlation state stays on the running child until its exact acknowledgment
 * arrives or post-answer activity proves that question waiting ended.
 */
function deliverPendingQuestion(running: RunningSubagent): void {
  reconcilePendingQuestion(running);

  const askFile = questionRequestPath(running.sessionFile);
  if (!existsSync(askFile)) return;
  const request = readQuestionRequest(askFile);
  if (!request) {
    // Atomic publication means an invalid complete payload cannot become valid
    // later. Contain it rather than repeatedly surfacing untrusted content.
    try { unlinkSync(askFile); } catch {}
    return;
  }
  if (request.name !== running.name || request.agent !== (running.agent ?? "")) {
    removeMatchingQuestionRequest(askFile, request.id);
    return;
  }

  if (running.pendingQuestion) {
    if (running.pendingQuestion.id === request.id) {
      removeMatchingQuestionRequest(askFile, request.id);
    }
    return;
  }

  running.pendingQuestion = {
    id: request.id,
    answerSubmitted: false,
    confirmationPending: false,
    sawWaiting: running.activity?.phase === "waiting",
  };
  removeMatchingQuestionRequest(askFile, request.id);

  const name = running.name;
  const sessionId = existsSync(running.sessionFile) ? getSessionId(running.sessionFile) : null;
  const elapsed = Math.floor((Date.now() - running.startTime) / 1000);
  const replyHint = `\n\nReply with subagent_message({ name: "${name}", message: "…" }). The answer is correlated to this question and the same child run continues after it is acknowledged.`;

  latestPi?.sendMessage(
    {
      customType: "subagent_question",
      content: `Sub-agent "${name}" asks (${formatElapsed(elapsed)}):\n\n${request.question}${replyHint}`,
      display: true,
      details: {
        name,
        agent: running.agent,
        questionId: request.id,
        question: request.question,
        ...(sessionId ? { sessionId } : {}),
      },
    },
    { triggerTurn: true, deliverAs: "steer" },
  );
}

/**
 * Appends the non-blocking AGY permission-policy warning to a launch or resume
 * acknowledgment when any target uses AGY and the operator policy is missing.
 * Pi and Claude acknowledgments are returned unchanged.
 */
function withAgyPolicyWarning(
  text: string,
  harnesses: readonly string[],
  check: () => string | null = checkAgyPermissionPolicy,
): string {
  if (!harnesses.includes("agy")) return text;
  let warning: string | null;
  try {
    warning = check();
  } catch {
    warning = null;
  }
  return warning ? `${text}\n${warning}` : text;
}

function hasValidAgyResumeSnapshot(stateFile: string | undefined): boolean {
  if (!stateFile) return false;
  const state = readAgyResumeState(stateFile);
  return !!state?.conversationId && validateAgyReplayState(state) === null;
}

function cleanupRunningQuestion(running: RunningSubagent): void {
  const pending = running.pendingQuestion;
  if (pending) {
    clearMatchingPendingQuestion(running, pending.id);
    return;
  }

  // The pane may disappear between atomic publication and the watcher's first
  // registration tick. In that case recover the exact ID from the strict
  // request before removing only that request's artifacts.
  const requestFile = questionRequestPath(running.sessionFile);
  const request = readQuestionRequest(requestFile);
  if (!request) return;
  removeMatchingQuestionRequest(requestFile, request.id);
  removeMatchingQuestionAcknowledgment(
    questionAcknowledgmentPath(running.sessionFile),
    request.id,
  );
}

async function watchSubagent(
  running: RunningSubagent,
  signal: AbortSignal,
  poll: typeof pollForExit = pollForExit,
  close: (surface: string) => void = closeSurface,
): Promise<SubagentResult> {
  const { name, task, surface, startTime, sessionFile } = running;
  // Watchers are aborted only when this parent session shuts down or the
  // extension reloads. The child must outlive that (R6), so an aborted watch
  // leaves the pane running instead of closing it.
  const watchSignal = AbortSignal.any([signal, getModuleAbortSignal()]);

  try {
    const result = await poll(surface, watchSignal, {
      interval: 1000,
      sessionFile,
      sentinelFile: running.sentinelFile,
      doneFile: running.doneFile,
      onTick() {
        observeRunningSubagent(running);
        deliverPendingQuestion(running);
      },
    });

    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    if (result.reason === "interrupted") {
      cleanupRunningQuestion(running);
      runningSubagents.delete(running.id);
      return {
        name,
        task,
        summary: result.errorMessage ?? `tmux pane ${surface} no longer exists`,
        sessionFile,
        exitCode: 1,
        elapsed,
        error: "interrupted",
        cli: running.cli,
        interrupted: true,
        resumeSupported: running.cli === "agy"
          ? hasValidAgyResumeSnapshot(running.agyStateFile)
          : running.cli !== "claude",
      };
    }

    if (running.cli === "agy") {
      const stdout = running.agyStdoutFile && existsSync(running.agyStdoutFile)
        ? readFileSync(running.agyStdoutFile, "utf8")
        : "";
      const stderr = running.agyStderrFile && existsSync(running.agyStderrFile)
        ? readFileSync(running.agyStderrFile, "utf8")
        : "";
      const runState = running.agyStateFile ? readAgyResumeState(running.agyStateFile) : null;
      const parsed = parseAgyResult(stdout, stderr, runState ? agyWorkspaceRoots(runState) : []);
      close(surface);

      if (!parsed.ok || result.exitCode !== 0) {
        const failure = parsed.ok
          ? `AGY exited with code ${result.exitCode} after returning a success envelope`
          : parsed.error;
        runningSubagents.delete(running.id);
        return {
          name,
          task,
          cli: "agy",
          summary: failure,
          sessionFile,
          exitCode: result.exitCode === 0 ? 1 : result.exitCode,
          elapsed,
          errorMessage: failure,
          ...(!parsed.ok && parsed.providerError ? { providerError: parsed.providerError } : {}),
          resumeSupported: false,
        };
      }

      let persistenceError: string | undefined;
      let resumeSupported = false;
      if (running.agyRegistryPersisted === false) {
        persistenceError = "AGY result completed, but its same-name registry entry could not be persisted";
      } else if (running.agyStateFile) {
        const state = readAgyResumeState(running.agyStateFile);
        if (state) {
          try {
            writeAgyResumeState(running.agyStateFile, {
              ...state,
              conversationId: parsed.conversationId,
            });
            resumeSupported = true;
          } catch (error) {
            persistenceError = `AGY result completed, but exact resume state could not be persisted: ${error instanceof Error ? error.message : String(error)}`;
          }
        } else {
          persistenceError = "AGY result completed, but its strict resume snapshot is missing or malformed";
        }
      } else {
        persistenceError = "AGY result completed, but no resume snapshot path was recorded";
      }

      const usage = parsed.usage;
      const stats: SessionStats | undefined = usage ? {
        model: readAgyResumeState(running.agyStateFile ?? "")?.model ?? null,
        toolCount: 0,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens,
        cacheWriteTokens: 0,
        contextTokens: usage.totalTokens,
        cost: 0,
      } : undefined;
      runningSubagents.delete(running.id);
      return {
        name,
        task,
        cli: "agy",
        summary: persistenceError ? `${parsed.response}\n\n${persistenceError}.` : parsed.response,
        sessionFile,
        agyConversationId: parsed.conversationId,
        ...(running.agyStateFile ? { agyStateFile: running.agyStateFile } : {}),
        agyUsage: parsed.usage,
        exitCode: 0,
        elapsed,
        resumeSupported,
        ...(persistenceError ? { persistenceError } : {}),
        ...(stats ? { stats } : {}),
      };
    }

    if (running.cli === "claude") {
      // Claude Code result extraction
      let summary = "";

      if (running.sentinelFile) {
        try {
          summary = readFileSync(running.sentinelFile, "utf-8").trim();
        } catch {}
      }

      if (!summary) {
        summary = readScreen(surface, 200)
          .replace(/__SUBAGENT_DONE_\d+__/, "")
          .trimEnd();
      }

      if (!summary) {
        summary = result.exitCode !== 0
          ? `Claude Code exited with code ${result.exitCode}`
          : "Claude Code exited without output";
      }

      // Copy Claude session transcript
      let sessionId: string | null = null;
      if (running.sentinelFile) {
        sessionId = copyClaudeSession(running.sentinelFile);
        try { unlinkSync(running.sentinelFile); } catch {}
        try { unlinkSync(running.sentinelFile + ".transcript"); } catch {}
      }

      close(surface);
      cleanupRunningQuestion(running);
      runningSubagents.delete(running.id);

      return { name, task, summary, exitCode: result.exitCode, elapsed, ...(sessionId ? { claudeSessionId: sessionId } : {}) };
    }

    // Pi subagent result extraction
    let summary: string;
    let providerError: string | null = null;
    if (existsSync(sessionFile)) {
      const allEntries = getNewEntries(sessionFile, 0);
      providerError = findLastAssistantProviderError(allEntries);
      summary =
        findLastAssistantMessage(allEntries) ??
        (result.errorMessage
          ? `Subagent error: ${result.errorMessage}`
          : result.exitCode !== 0
            ? `Sub-agent exited with code ${result.exitCode}`
            : "Sub-agent exited without output");
    } else {
      summary = result.errorMessage
        ? `Subagent error: ${result.errorMessage}`
        : result.exitCode !== 0
          ? `Sub-agent exited with code ${result.exitCode}`
          : "Sub-agent exited without output";
    }

    const stats = existsSync(sessionFile) ? summarizeSessionStats(sessionFile) : null;
    const subagentSessionId = existsSync(sessionFile) ? getSessionId(sessionFile) : null;

    close(surface);
    cleanupRunningQuestion(running);
    runningSubagents.delete(running.id);

    return {
      name,
      task,
      summary,
      sessionFile,
      ...(subagentSessionId ? { sessionId: subagentSessionId } : {}),
      exitCode: result.exitCode,
      elapsed,
      ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
      ...(providerError ? { providerError } : {}),
      ...(stats ? { stats } : {}),
    };
  } catch (err: any) {
    if (!watchSignal.aborted) {
      try {
        close(surface);
      } catch {}
    }
    cleanupRunningQuestion(running);
    runningSubagents.delete(running.id);

    if (signal.aborted) {
      return {
        name,
        task,
        cli: running.cli,
        summary: "Subagent cancelled.",
        exitCode: 1,
        elapsed: Math.floor((Date.now() - startTime) / 1000),
        error: "cancelled",
        sessionFile,
        resumeSupported: running.cli === "agy"
          ? hasValidAgyResumeSnapshot(running.agyStateFile)
          : running.cli !== "claude",
      };
    }
    return {
      name,
      task,
      cli: running.cli,
      summary: `Subagent error: ${err?.message ?? String(err)}`,
      exitCode: 1,
      elapsed: Math.floor((Date.now() - startTime) / 1000),
      error: err?.message ?? String(err),
      resumeSupported: running.cli === "agy"
        ? hasValidAgyResumeSnapshot(running.agyStateFile)
        : running.cli !== "claude",
    };
  }
}

function chainAttemptLine(attempt: ChainAttemptProvenance): string {
  const target = `${attempt.targetIndex}/${attempt.targetCount} ${attempt.harness} ${attempt.model}`;
  return attempt.outcome === "exhausted"
    ? `${target}: exhausted (${attempt.exhaustionReason})`
    : `${target}: ${attempt.outcome}`;
}

function resolveChainResultPresentation(result: SubagentResult, name: string): string {
  const attempts = result.chainAttempts ?? [];
  const provenance = attempts.map(chainAttemptLine).join("\n");
  if (result.chainWinnerIndex !== undefined) {
    const winner = attempts[result.chainWinnerIndex];
    const resume = result.resumeSupported === false
      ? `\n\n${result.persistenceError ?? "Winner state could not be persisted"}. The result is valid, but this runtime name is not resumable.`
      : `\n\nFollow up with subagent_message({ name: "${name}", message: "…" })`;
    return (
      `Sub-agent "${name}" completed via model-chain target ${winner.targetIndex}/${winner.targetCount} ` +
      `(${winner.harness} ${winner.model}) after ${formatElapsed(result.elapsed)}.\n\n` +
      `${result.summary}${provenance ? `\n\nAttempts:\n${provenance}` : ""}${resume}`
    );
  }
  if (attempts.length > 0 && attempts.every((attempt) => attempt.outcome === "exhausted")) {
    return `Sub-agent "${name}" failed because every model-chain target was exhausted.\n\n${provenance}\n\nThis chain result is not resumable.`;
  }
  return (
    `Sub-agent "${name}" stopped at model-chain target ${attempts.length || 1}.\n\n` +
    `${result.errorMessage ? `Error: ${result.errorMessage}` : result.summary}` +
    `${provenance ? `\n\nAttempts:\n${provenance}` : ""}\n\nThis chain result is not resumable.`
  );
}

async function startPreparedModelChain(params: {
  toolParams: typeof SubagentParams.static;
  ctx: { sessionManager: { getSessionFile(): string | null; getSessionId(): string; getSessionDir(): string }; cwd: string };
  agent: AgentDefinition;
  prepared: PreparedModelChainLaunch;
  parentArtifactDir: string;
  abortController: AbortController;
  surfaceKind?: SurfaceKind;
}): Promise<{ first: RunningSubagent; completion: Promise<SubagentResult>; stateFile: string }> {
  const controllerId = randomUUID();
  const controllerStartedAt = Date.now();
  const { toolParams, ctx, agent, prepared, parentArtifactDir, abortController } = params;
  const signal = abortController.signal;
  const stateFile = resolve(join(parentArtifactDir, "model-chain", "state", `${controllerId}.json`));
  const targetCount = prepared.chainTargets.length;
  let state: ModelChainState = {
    version: 1,
    harness: "chain",
    profileName: agent.name,
    runtimeName: toolParams.name,
    currentTargetIndex: 1,
    targetCount,
    status: "running",
    attempts: [],
  };
  writeModelChainState(stateFile, state);
  if (!registerName(parentArtifactDir, toolParams.name, { harness: "chain", stateFile })) {
    throw new Error(`Could not persist strict model-chain ownership for runtime name "${toolParams.name}"`);
  }

  let first: RunningSubagent | null = null;
  const launchAttempt = async (index: number): Promise<RunningSubagent> => {
    const preparedTarget = prepared.chainTargets[index];
    state = { ...state, currentTargetIndex: index + 1, status: "running" };
    writeModelChainState(stateFile, state);
    const chainLaunch: PreparedSingleAgentLaunch = preparedTarget.target.cli === "pi"
      ? {
          ...preparedTarget.launch,
          capabilityEnvironment: [
            ...preparedTarget.launch.capabilityEnvironment,
            `${SUBAGENT_MODEL_CHAIN_ENV}=1`,
          ],
        }
      : preparedTarget.launch;
    const running = await launchSubagent(
      toolParams,
      ctx,
      preparedTarget.definition,
      chainLaunch,
      { surfaceKind: params.surfaceKind },
    );
    running.abortController = abortController;
    running.suppressStatusMessages = true;
    running.chainTarget = {
      controllerId,
      startedAt: controllerStartedAt,
      index: index + 1,
      count: targetCount,
      harness: preparedTarget.target.cli,
      model: preparedTarget.target.model,
    };
    if (!first) first = running;
    return running;
  };

  let initial: RunningSubagent;
  try {
    initial = await launchAttempt(0);
  } catch (error) {
    state = { ...state, status: "failed" };
    writeModelChainState(stateFile, state);
    throw error;
  }
  const completion = runModelChain<SubagentResult>({
    targets: prepared.chainTargets.map(({ target }) => ({ harness: target.cli, model: target.model })),
    async attempt(index) {
      const attemptStartedAt = Date.now();
      let running: RunningSubagent;
      try {
        running = index === 0 ? initial : await launchAttempt(index);
      } catch (error) {
        const target = prepared.chainTargets[index].target;
        const message = error instanceof Error ? error.message : String(error);
        const elapsed = Math.floor((Date.now() - attemptStartedAt) / 1000);
        return {
          ok: false,
          value: {
            name: toolParams.name,
            task: toolParams.task,
            cli: target.cli,
            summary: `Model-chain target ${index + 1} could not launch: ${message}`,
            exitCode: 1,
            elapsed,
            error: message,
            errorMessage: message,
            resumeSupported: false,
          },
          elapsed,
          outcome: "failed",
        };
      }
      const result = await watchSubagent(running, signal);
      const ok = result.exitCode === 0 && !result.errorMessage && !result.providerError && !result.error && !result.interrupted;
      if (ok) return { ok: true, value: result, elapsed: result.elapsed };
      const interrupted = result.interrupted || result.error === "cancelled";
      return {
        ok: false,
        value: result,
        elapsed: result.elapsed,
        ...(!interrupted && result.providerError ? { providerError: result.providerError } : {}),
        ...(result.interrupted
          ? { outcome: "interrupted" as const }
          : result.error === "cancelled"
            ? { outcome: "cancelled" as const }
            : {}),
      };
    },
    onAttempt(attempt) {
      state = {
        ...state,
        currentTargetIndex: attempt.targetIndex,
        status: attempt.outcome === "exhausted"
          ? "exhausted"
          : attempt.outcome === "succeeded"
            ? "running"
            : "failed",
        attempts: [...state.attempts, attempt],
      };
      writeModelChainState(stateFile, state);
    },
  }).then((outcome): SubagentResult => {
    const result = outcome.value;
    result.elapsed = Math.floor((Date.now() - controllerStartedAt) / 1000);
    result.chainAttempts = outcome.attempts;
    if (!outcome.ok) {
      state = { ...state, status: outcome.allExhausted ? "exhausted" : "failed", attempts: outcome.attempts };
      writeModelChainState(stateFile, state);
      if (outcome.allExhausted) {
        result.exitCode = result.exitCode || 1;
        result.errorMessage = "Every model-chain target reported terminal resource exhaustion";
        result.resumeSupported = false;
      }
      return result;
    }

    result.chainWinnerIndex = outcome.winnerIndex;
    const winner = prepared.chainTargets[outcome.winnerIndex];
    let persisted = false;
    if (winner.target.cli === "agy") {
      if (result.agyStateFile && result.resumeSupported !== false) {
        persisted = registerName(parentArtifactDir, toolParams.name, {
          harness: "agy",
          stateFile: result.agyStateFile,
        });
      }
    } else if (result.sessionFile) {
      persisted = registerName(parentArtifactDir, toolParams.name, {
        sessionFile: result.sessionFile,
        sessionId: result.sessionId ?? getSessionId(result.sessionFile),
      });
    }
    if (!persisted) {
      state = { ...state, status: "failed", attempts: outcome.attempts };
      writeModelChainState(stateFile, state);
      result.resumeSupported = false;
      result.persistenceError =
        `Model-chain target ${outcome.winnerIndex + 1} completed, but native winner ownership could not be persisted`;
    } else {
      result.resumeSupported = true;
    }
    return result;
  }).catch((error) => {
    try {
      state = { ...state, status: "failed" };
      writeModelChainState(stateFile, state);
    } catch {
      // The original controller failure remains the actionable error.
    }
    throw error;
  });

  return { first: first ?? initial, completion, stateFile };
}

export default function subagentsExtension(pi: ExtensionAPI) {
  latestPi = pi;
  // Capture the UI context for widget updates
  pi.on("session_start", (_event, ctx) => {
    latestCtx = ctx;
    try {
      latestModelRegistry = (ctx.modelRegistry as ContextWindowRegistry | undefined) ?? null;
    } catch {
      latestModelRegistry = null;
    }
    sessionShutDown = false;
    resetRpcStatusCache();
    // pi runs multiple sessions in one process. A prior session's shutdown
    // aborts the shared module poll-abort controller; install a fresh one so
    // subagents spawned in this session aren't watched against a dead signal.
    // See https://github.com/HazAT/pi-interactive-subagents/issues/5
    const prevAbort = (globalThis as any)[POLL_ABORT_KEY] as AbortController | undefined;
    if (!prevAbort || prevAbort.signal.aborted) {
      (globalThis as any)[POLL_ABORT_KEY] = new AbortController();
    }
  });

  // Clean up on session shutdown
  pi.on("session_shutdown", (_event, _ctx) => {
    // pi invalidates this instance's ctx and pi right after shutdown handlers
    // run; drop them first so late watchers and the widget never touch them.
    sessionShutDown = true;
    latestCtx = null;
    latestPi = null;
    resetRpcStatusCache();
    if (widgetInterval) {
      clearInterval(widgetInterval);
      widgetInterval = null;
      (globalThis as any)[WIDGET_INTERVAL_KEY] = null;
    }
    if (statusInterval) {
      clearInterval(statusInterval);
      statusInterval = null;
      (globalThis as any)[STATUS_INTERVAL_KEY] = null;
    }
    const moduleAbort = (globalThis as any)[POLL_ABORT_KEY] as AbortController | undefined;
    if (moduleAbort) moduleAbort.abort();
    for (const [_id, agent] of runningSubagents) {
      agent.abortController?.abort();
    }
    runningSubagents.clear();
  });

  // The spawning tools are always registered here. A new child process can
  // see them only when subagent_agents grants the spawning extension and pins
  // PI_SUBAGENT_ALLOWED. Legacy strict resumes retain their stored --tools
  // allowlist. See launchSubagent().

  // ── subagent tool ──
  pi.registerTool({
      name: "subagent",
      label: "Subagent",
      description:
        "Spawn a sub-agent in a dedicated terminal multiplexer pane. " +
        "This is a fire-and-forget async tool: the call returns immediately with only an acknowledgement. " +
        "When the sub-agent finishes, the harness AUTOMATICALLY delivers its result as a steer message that wakes you up and starts a new turn — you do not need to do anything to receive it. " +
        "DO NOT write polling loops, sleep/wait commands, tail/watch scripts, or repeatedly read session/log files to detect completion. DO NOT call subagents_list or any other tool to 'check' status. All of that is wasted work — the harness handles delivery for you. " +
        "DO NOT fabricate, assume, or summarize results after calling this tool. " +
        "After spawning, either end your turn immediately, or work on other independent tasks (including spawning more subagents in parallel). The harness will wake you with the result when it is ready.",
      promptSnippet:
        "Spawn a sub-agent in a dedicated terminal multiplexer pane. " +
        "This is a fire-and-forget async tool: the call returns immediately with only an acknowledgement. " +
        "When the sub-agent finishes, the harness AUTOMATICALLY delivers its result as a steer message that wakes you up and starts a new turn — you do not need to do anything to receive it. " +
        "DO NOT write polling loops, sleep/wait commands, tail/watch scripts, or repeatedly read session/log files to detect completion. DO NOT call subagents_list or any other tool to 'check' status. All of that is wasted work — the harness handles delivery for you. " +
        "DO NOT fabricate, assume, or summarize results after calling this tool. " +
        "After spawning, either end your turn immediately, or work on other independent tasks (including spawning more subagents in parallel). The harness will wake you with the result when it is ready.",
      parameters: SubagentParams,

      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        // Prevent self-spawning (e.g. planner spawning another planner)
        const currentAgent = process.env.PI_SUBAGENT_AGENT;
        if (params.agent && currentAgent && params.agent === currentAgent) {
          return {
            content: [
              {
                type: "text",
                text: `You are the ${currentAgent} agent — do not start another ${currentAgent}. You were spawned to do this work yourself. Complete the task directly.`,
              },
            ],
            details: { error: "self-spawn blocked" },
          };
        }

        // Resolve once from the active context. The same canonical definition is
        // used for permission checks, diagnostics, launch, and loadout capture.
        const discovery = await discoverDefinitionsForContext(ctx);
        if (!params.agent) {
          return {
            content: [{
              type: "text",
              text:
                `You must specify which agent to spawn via the "agent" field. ` +
                agentDiscoveryHint(discovery) + formatDiscoveryDiagnostics(discovery),
            }],
            details: { error: "agent required", diagnostics: discovery.diagnostics },
          };
        }
        const permittedAgents = discovery.agents.map((agent) => agent.name);
        const permittedList = permittedAgents.join(", ") || "(none)";
        const agentDefs = discovery.agents.find((agent) => agent.name === params.agent);

        if (!agentDefs) {
          const noDefinitions = discovery.agents.length === 0
            ? ` ${agentDiscoveryHint(discovery)}`
            : "";
          return {
            content: [
              {
                type: "text",
                text:
                  `You may not spawn the "${params.agent}" agent — it is not ` +
                  `${SUBAGENT_ALLOWLIST ? "in your allowlist" : "a valid known agent"}. ` +
                  `Available agents: ${permittedList}.${noDefinitions}` +
                  formatDiscoveryDiagnostics(discovery),
              },
            ],
            details: {
              error: SUBAGENT_ALLOWLIST ? "agent not in allowlist" : "unknown agent",
              diagnostics: discovery.diagnostics,
            },
          };
        }

        const preparedSandbox = prepareAgentSandbox(agentDefs);
        if ("error" in preparedSandbox) {
          return {
            content: [{ type: "text", text: preparedSandbox.error }],
            details: { error: "unresolved agent tool", agent: agentDefs.name },
          };
        }
        const preparedLaunch = prepareAgentLaunch(
          params,
          agentDefs,
          preparedSandbox.sandbox,
          ctx.cwd,
        );
        if ("error" in preparedLaunch) {
          return {
            content: [{ type: "text", text: preparedLaunch.error }],
            details: { error: "invalid agent launch", agent: agentDefs.name },
          };
        }

        // Validate every statically knowable target prerequisite before any pane is created.
        const preparedTargets = "chainTargets" in preparedLaunch.launch
          ? preparedLaunch.launch.chainTargets.map((target) => target.launch)
          : [preparedLaunch.launch];
        const preparedHarnesses = preparedTargets.map((target) => target.harness);
        if (preparedTargets.some((target) => target.harness === "agy") && !isCommandAvailable("agy")) {
          const err =
            `Agent "${agentDefs.name}" requires the Antigravity CLI executable \`agy\`, ` +
            `but it is not available on PATH. Install or expose agy and retry; no fallback was launched.`;
          return {
            content: [{ type: "text", text: err }],
            details: { error: "agy not available", agent: agentDefs.name },
          };
        }
        if (
          "chainTargets" in preparedLaunch.launch &&
          preparedTargets.some((target) => target.harness === "pi") &&
          !isCommandAvailable("pi")
        ) {
          const err =
            `Agent "${agentDefs.name}" has a Pi model-chain target, but the \`pi\` executable ` +
            `is not available on PATH. Expose pi and retry; no fallback was launched.`;
          return {
            content: [{ type: "text", text: err }],
            details: { error: "pi not available", agent: agentDefs.name },
          };
        }

        // Validate prerequisites (need mux + a session file to derive the
        // artifact dir that hosts this session's name registry).
        if (!isMuxAvailable()) {
          return muxUnavailableResult();
        }

        if (!ctx.sessionManager.getSessionFile()) {
          return {
            content: [
              {
                type: "text",
                text: "Error: no session file. Start pi with a persistent session to use subagents.",
              },
            ],
            details: { error: "no session file" },
          };
        }

        // This spawner session's artifact dir hosts its persistent name
        // registry (artifacts/<parentSessionId>/subagent-registry.json).
        const parentArtifactDir = getArtifactDir(
          ctx.sessionManager.getSessionDir(),
          ctx.sessionManager.getSessionId(),
        );

        // Optional maxConcurrent cap: reserve a slot before any pane exists.
        const launchSlot = reserveLaunchSlot();
        if ("error" in launchSlot) return launchCapResult(launchSlot.error);

        // Claim both explicit and defaulted names synchronously before any pane
        // creation. Explicit collisions fail; only omitted names are suffixed.
        const registryNames = new Set(Object.keys(readNameRegistry(parentArtifactDir)));
        const claim = claimRuntimeName(params.name, params.agent, registryNames);
        if ("error" in claim) {
          launchSlot.release();
          return {
            content: [{ type: "text", text: claim.error }],
            details: { error: "runtime name collision" },
          };
        }
        params.name = claim.name;
        // Detached when the parent has no tmux client or the profile opts into
        // background launch; otherwise today's split.
        const surfaceKind = selectSurfaceKind({ purpose: "spawn", background: agentDefs.background });

        if ("chainTargets" in preparedLaunch.launch) {
          const watcherAbort = new AbortController();
          let chain;
          try {
            chain = await startPreparedModelChain({
              toolParams: params,
              ctx,
              agent: agentDefs,
              prepared: preparedLaunch.launch,
              parentArtifactDir,
              abortController: watcherAbort,
              surfaceKind,
            });
          } finally {
            reservedNames.delete(claim.name);
            launchSlot.release();
          }
          startWidgetRefresh();
          startStatusRefresh(pi);
          chain.completion
            .then((result) => {
              updateWidget();
              const attempts = result.chainAttempts ?? [];
              const winner = result.chainWinnerIndex !== undefined
                ? attempts[result.chainWinnerIndex]
                : undefined;
              deliverSubagentMessage(
                pi,
                {
                  customType: "subagent_result",
                  content: resolveChainResultPresentation(result, params.name),
                  display: true,
                  details: {
                    name: params.name,
                    task: params.task,
                    agent: params.agent,
                    harness: "chain",
                    exitCode: result.exitCode,
                    elapsed: result.elapsed,
                    attempts,
                    ...(winner ? { winner } : {}),
                    ...(result.sessionFile ? { sessionFile: result.sessionFile } : {}),
                    ...(result.sessionId ? { sessionId: result.sessionId } : {}),
                    ...(result.agyConversationId ? { agyConversationId: result.agyConversationId } : {}),
                    ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
                    ...(result.interrupted ? { interrupted: true } : {}),
                    ...(result.persistenceError ? { persistenceError: result.persistenceError } : {}),
                    ...(result.resumeSupported !== undefined ? { resumeSupported: result.resumeSupported } : {}),
                    ...(result.stats ? { stats: result.stats } : {}),
                  },
                },
                { triggerTurn: true, deliverAs: "steer" },
              );
            })
            .catch((error) => {
              updateWidget();
              const message = error instanceof Error ? error.message : String(error);
              deliverSubagentMessage(
                pi,
                {
                  customType: "subagent_result",
                  content:
                    `Sub-agent "${params.name}" model-chain error: ${message}\n\n` +
                    `This chain result is not resumable.`,
                  display: true,
                  details: {
                    name: params.name,
                    task: params.task,
                    harness: "chain",
                    exitCode: 1,
                    error: message,
                    errorMessage: message,
                    resumeSupported: false,
                  },
                },
                { triggerTurn: true, deliverAs: "steer" },
              );
            });

          return {
            content: [{
              type: "text",
              text: withAgyPolicyWarning(
                `Sub-agent "${params.name}" launched model-chain target 1/${preparedLaunch.launch.chainTargets.length} ` +
                `and is now running in the background. Results will be delivered automatically after the chain stops.`,
                preparedHarnesses,
              ),
            }],
            details: {
              id: chain.first.id,
              name: params.name,
              task: params.task,
              agent: params.agent,
              sessionFile: chain.first.sessionFile,
              launchScriptFile: chain.first.launchScriptFile,
              harness: "chain",
              targetIndex: 1,
              targetCount: preparedLaunch.launch.chainTargets.length,
              status: "started",
            },
          };
        }

        let running;
        try {
          running = await launchSubagent(params, ctx, agentDefs, preparedLaunch.launch, { surfaceKind });
        } finally {
          reservedNames.delete(claim.name);
          launchSlot.release();
        }

        // Persist name → session so subagent_message({ name }) can resume this
        // subagent after it finishes (and after a pi restart). Done at launch,
        // not completion, so the handle exists even if the parent dies mid-run.
        if (running.cli === "agy") {
          if (!running.agyStateFile) throw new Error("AGY launch did not produce a resume snapshot path");
          running.agyRegistryPersisted = registerName(parentArtifactDir, running.name, {
            harness: "agy",
            stateFile: running.agyStateFile,
          });
        } else {
          registerName(parentArtifactDir, running.name, {
            sessionFile: running.sessionFile,
            sessionId: getSessionId(running.sessionFile),
          });
        }

        // Create a separate AbortController for the watcher
        // (the tool's signal completes when we return)
        const watcherAbort = new AbortController();
        running.abortController = watcherAbort;

        // Start widget refresh and status supervision when the first agent launches
        startWidgetRefresh();
        startStatusRefresh(pi);

        // Fire-and-forget: start watching in background
        watchSubagent(running, watcherAbort.signal)
          .then((result) => {
            updateWidget(); // reflect removal from Map immediately

            const presentation = resolveResultPresentation(result, running.name);

            deliverSubagentMessage(
              pi,
              {
                customType: "subagent_result",
                content: presentation,
                display: true,
                details: {
                  name: running.name,
                  task: running.task,
                  agent: running.agent,
                  harness: running.cli ?? "pi",
                  exitCode: result.exitCode,
                  elapsed: result.elapsed,
                  sessionFile: result.sessionFile,
                  ...(result.sessionId ? { sessionId: result.sessionId } : {}),
                  ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
                  ...(result.interrupted ? { interrupted: true } : {}),
                  ...(result.claudeSessionId ? { claudeSessionId: result.claudeSessionId } : {}),
                  ...(result.agyConversationId ? { agyConversationId: result.agyConversationId } : {}),
                  ...(result.agyUsage ? { agyUsage: result.agyUsage } : {}),
                  ...(result.persistenceError ? { persistenceError: result.persistenceError } : {}),
                  ...(result.stats ? { stats: result.stats } : {}),
                },
              },
              { triggerTurn: true, deliverAs: "steer" },
            );
          })
          .catch((err) => {
            updateWidget();
            deliverSubagentMessage(
              pi,
              {
                customType: "subagent_result",
                content: `Sub-agent "${running.name}" error: ${err?.message ?? String(err)}`,
                display: true,
                details: { name: running.name, task: running.task, error: err?.message },
              },
              { triggerTurn: true, deliverAs: "steer" },
            );
          });

        // Return immediately
        return {
          content: [
            {
              type: "text",
              text: withAgyPolicyWarning(
                `Sub-agent "${params.name}" launched and is now running in the background. ` +
                `Do NOT generate or assume any results — you have no idea what the sub-agent will do or produce. ` +
                `The results will be delivered to you automatically as a steer message when the sub-agent finishes. ` +
                `Until then, move on to other work or tell the user you're waiting.`,
                preparedHarnesses,
              ),
            },
          ],
          details: {
            id: running.id,
            name: params.name,
            task: params.task,
            agent: params.agent,
            sessionFile: running.sessionFile,
            launchScriptFile: running.launchScriptFile,
            harness: running.cli ?? "pi",
            status: "started",
          },
        };
      },

      renderCall(args, theme) {
        const partialArgs = args as Record<string, unknown>;
        const agentName =
          typeof partialArgs.agent === "string" && partialArgs.agent ? partialArgs.agent : "";
        const name =
          typeof partialArgs.name === "string" && partialArgs.name
            ? partialArgs.name
            : agentName || "(unnamed)";
        const task = typeof partialArgs.task === "string" ? partialArgs.task : "";
        // Only show the agent tag separately when a distinct cosmetic name was given.
        const agent =
          agentName && name !== agentName ? theme.fg("dim", ` (${agentName})`) : "";
        const cwdHint = typeof partialArgs.cwd === "string" && partialArgs.cwd
          ? theme.fg("dim", ` in ${partialArgs.cwd}`)
          : "";
        let text =
          "○ " +
          theme.fg("toolTitle", theme.bold(name)) +
          agent +
          cwdHint;

        // Show a one-line task preview. renderCall is called repeatedly as the
        // LLM generates tool arguments, so args.task grows token by token.
        // We keep it compact here — Ctrl+O on renderResult expands the full content.
        if (task) {
          const firstLine = task.split("\n").find((l: string) => l.trim()) ?? "";
          const preview = firstLine.length > 100 ? firstLine.slice(0, 100) + "…" : firstLine;
          if (preview) {
            text += "\n" + theme.fg("toolOutput", preview);
          }
          const totalLines = task.split("\n").length;
          if (totalLines > 1) {
            text += theme.fg("muted", ` (${totalLines} lines)`);
          }
        }

        return new Text(text, 0, 0);
      },

      renderResult(result, _opts, theme) {
        const details = result.details as any;
        const name = details?.name ?? "(unnamed)";

        // "Started" result — tool returned immediately
        if (details?.status === "started") {
          return new Text(
            theme.fg("accent", "⟳") +
              " " +
              theme.fg("toolTitle", theme.bold(name)) +
              theme.fg("dim", " — started"),
            0,
            0,
          );
        }

        // Fallback (shouldn't happen)
        const text = typeof result.content[0]?.text === "string" ? result.content[0].text : "";
        return new Text(theme.fg("dim", text), 0, 0);
      },
    });

  // ── subagents_list tool ──
  pi.registerTool({
      name: "subagents_list",
      label: "List Subagents",
      description:
        "List all valid visible subagent definitions and profile diagnostics. " +
        "Scans the configured global agents directory and the nearest trusted project .pi/agents/. " +
        "Project definitions override global definitions with the same effective name.",
      promptSnippet:
        "List all valid visible subagent definitions and profile diagnostics. " +
        "Scans the configured global agents directory and the nearest trusted project .pi/agents/. " +
        "Project definitions override global definitions with the same effective name.",
      parameters: Type.Object({}),

      async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
        const discovery = await discoverDefinitionsForContext(ctx);
        const list = discovery.agents.filter((agent) => !agent.disableModelInvocation);
        const diagnosticText = formatDiscoveryDiagnostics(discovery);

        if (list.length === 0) {
          return {
            content: [{
              type: "text",
              text:
                `No valid visible subagent definitions found. ${agentDiscoveryHint(discovery)}` +
                diagnosticText,
            }],
            details: { agents: [], diagnostics: discovery.diagnostics },
          };
        }

        const lines = list.map((a) => {
          const badge = a.source === "project" ? " (project)" : "";
          const desc = a.description ? ` — ${a.description}` : "";
          const model = a.modelChain
            ? ` [${a.modelChain.map((target) => `${target.cli}:${target.model}`).join(" → ")}]`
            : a.model
              ? ` [${a.model}]`
              : "";
          return `• ${a.name}${badge}${model}${desc}${unavailableMcpSuffix(a)}`;
        });

        return {
          content: [{ type: "text", text: lines.join("\n") + diagnosticText }],
          details: { agents: list, diagnostics: discovery.diagnostics },
        };
      },

      renderResult(result, _opts, theme) {
        const details = result.details as any;
        const agents = details?.agents ?? [];
        if (agents.length === 0) {
          const text = typeof result.content[0]?.text === "string"
            ? result.content[0].text
            : "No valid visible subagent definitions found.";
          return new Text(theme.fg("dim", text), 0, 0);
        }
        const lines = agents.map((a: any) => {
          const badge = a.source === "project" ? theme.fg("accent", " (project)") : "";
          const desc = a.description ? theme.fg("dim", ` — ${a.description}`) : "";
          const modelText = a.modelChain
            ? a.modelChain.map((target: AgentModelChainTarget) => `${target.cli}:${target.model}`).join(" → ")
            : a.model;
          const model = modelText ? theme.fg("dim", ` [${modelText}]`) : "";
          const unavailableText = unavailableMcpSuffix(a);
          const unavailable = unavailableText ? theme.fg("dim", unavailableText) : "";
          return `  ${theme.fg("toolTitle", theme.bold(a.name))}${badge}${model}${desc}${unavailable}`;
        });
        return new Text(lines.join("\n"), 0, 0);
      },
    });



  // ── subagent_message tool ──
  pi.registerTool({
      name: "subagent_message",
      label: "Message Subagent",
      description:
        "Send a message to a subagent by name. Names are unique within your session and persist after a subagent finishes, " +
        "so the SAME name works whether the subagent is running or finished: if it is still running, your message steers its live session; " +
        "if it has finished, your message resumes that session and continues it. " +
        "`name` and `message` are both required. " +
        "A pending question answer requires its exact acknowledgment; other waiting Pi messages use newer child activity, both with bounded unconfirmed fallback. Active running messages report local submission. It does NOT, by itself, emit a new result. " +
        "Resuming is a fire-and-forget async call: when the resumed sub-agent finishes, the harness AUTOMATICALLY delivers its result as a steer message that wakes you up. " +
        "DO NOT poll, sleep, tail logs, or read session files to detect completion — the harness handles delivery. " +
        "DO NOT fabricate or assume results. After calling, either end your turn or work on other independent tasks.",
      promptSnippet:
        "Message a subagent by name: steers it if running, resumes it if finished (same name either way). " +
        "`name` and `message` are required. Active steering reports submission; question replies require exact acknowledgment and other waiting Pi messages briefly await child activity. Resuming delivers its result later as a steer message. " +
        "Do not poll or fabricate results.",
      parameters: Type.Object({
        name: Type.String({
          description:
            "Exact display name of the subagent. Steers it if it is still running; resumes its session if it has finished.",
        }),
        message: Type.String({
          description:
            "The message to deliver: a follow-up instruction for a running subagent, or the next task for a resumed session.",
        }),
      }),

      renderCall(args, theme) {
        const target = args.name ?? "(unknown)";
        return new Text(
          "○ " + theme.fg("toolTitle", theme.bold(target)) + theme.fg("dim", " — message"),
          0,
          0,
        );
      },

      renderResult(result, _opts, theme) {
        const details = result.details as any;

        if (["delivered", "submitted", "unconfirmed"].includes(details?.status)) {
          const icon = details.status === "delivered" ? theme.fg("success", "✓") : theme.fg("accent", "○");
          const label = details.status === "delivered"
            ? "message delivered"
            : details.status === "submitted"
              ? "message submitted"
              : "delivery unconfirmed";
          return new Text(
            icon +
              " " +
              theme.fg("toolTitle", theme.bold(details.name ?? "subagent")) +
              theme.fg("dim", ` — ${label}`),
            0,
            0,
          );
        }

        if (details?.status === "started") {
          return new Text(
            theme.fg("accent", "⟳") +
              " " +
              theme.fg("toolTitle", theme.bold(details.name ?? "Resume")) +
              theme.fg("dim", " — resumed"),
            0,
            0,
          );
        }

        // Fallback / error
        const text = typeof result.content[0]?.text === "string" ? result.content[0].text : "";
        return new Text(theme.fg("dim", text), 0, 0);
      },

      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const requestedName = params.name?.trim();
        if (!requestedName) {
          const err = "Provide the subagent's `name` to steer (if running) or resume (if finished).";
          return { content: [{ type: "text" as const, text: err }], details: { error: err } };
        }

        if (!isMuxAvailable()) {
          return muxUnavailableResult();
        }

        // ── Steer a running subagent ──
        // A name that matches a currently-running subagent always steers it.
        const runningMatch = Array.from(runningSubagents.values()).find((r) => r.name === requestedName);
        if (runningMatch) {
          return await handleSubagentSteer({ name: requestedName, message: params.message });
        }

        // ── Resume a finished session by name ──
        const message = params.message;
        const name = requestedName; // identity preservation: the resumed run reclaims its name
        const { autoExit, interactive } = resolveResumeLaunchBehavior();
        const startTime = Date.now();
        const id = randomUUID();

        // Resolve the name to its session file via this session's registry.
        const parentArtifactDir = getArtifactDir(
          ctx.sessionManager.getSessionDir(),
          ctx.sessionManager.getSessionId(),
        );
        const entry = resolveNameInRegistry(parentArtifactDir, requestedName);
        if (!entry) {
          const known = Object.keys(readNameRegistry(parentArtifactDir));
          const err =
            `No subagent named "${requestedName}" in this session. ` +
            (known.length > 0
              ? `Known subagents: ${known.join(", ")}.`
              : "No subagents have been spawned in this session yet.");
          return { content: [{ type: "text" as const, text: err }], details: { error: err } };
        }

        if ("harness" in entry && entry.harness === "chain") {
          const state = readModelChainState(entry.stateFile);
          const status = state
            ? state.status === "running"
              ? `is still owned by model-chain target ${state.currentTargetIndex}/${state.targetCount}`
              : `ended with model-chain status ${state.status}`
            : "has an invalid model-chain ownership snapshot";
          const err =
            `Cannot resume "${requestedName}": it ${status} and no native target won. ` +
            `Spawn a new self-contained subagent task to restart the chain at target 1.`;
          return {
            content: [{ type: "text" as const, text: err }],
            details: { error: err, harness: "chain", status: state?.status ?? "invalid" },
          };
        }

        // A child left running by an earlier parent process is not in the
        // in-memory map. Steer its live tagged pane instead of resuming a
        // second process on the same session file.
        const orphanResult = await guardLiveOrphan(requestedName, entry, params.message);
        if (orphanResult) return orphanResult;

        if ("harness" in entry) {
          const state = readAgyResumeState(entry.stateFile);
          if (!state) {
            const err = `Cannot safely resume "${requestedName}": its AGY snapshot is missing or malformed.`;
            return { content: [{ type: "text" as const, text: err }], details: { error: err } };
          }
          if (state.runtimeName !== requestedName) {
            const err = `Cannot safely resume "${requestedName}": its AGY snapshot belongs to runtime name "${state.runtimeName}".`;
            return { content: [{ type: "text" as const, text: err }], details: { error: err } };
          }
          if (!state.conversationId) {
            const err = `Cannot resume "${requestedName}": no successful AGY conversation ID was persisted.`;
            return { content: [{ type: "text" as const, text: err }], details: { error: err } };
          }
          const replayError = validateAgyReplayState(state);
          if (replayError) {
            const err = `Cannot safely resume "${requestedName}": ${replayError}.`;
            return { content: [{ type: "text" as const, text: err }], details: { error: err } };
          }
          if (!isCommandAvailable("agy")) {
            const err = "Cannot resume AGY: the `agy` executable is not available on PATH.";
            return { content: [{ type: "text" as const, text: err }], details: { error: err } };
          }
          const launchSlot = reserveLaunchSlot();
          if ("error" in launchSlot) return launchCapResult(launchSlot.error);
          const resumeClaim = claimResumeSession(entry.stateFile);
          if ("error" in resumeClaim) {
            launchSlot.release();
            return { content: [{ type: "text" as const, text: resumeClaim.error }], details: { error: resumeClaim.error } };
          }

          const artifactDir = getArtifactDir(
            ctx.sessionManager.getSessionDir(),
            ctx.sessionManager.getSessionId(),
          );
          const taskFile = join(artifactDir, "agy", "resume", `${id}.txt`);
          const stdoutFile = join(artifactDir, "agy", "results", `${id}.json`);
          const stderrFile = join(artifactDir, "agy", "results", `${id}.stderr.txt`);
          mkdirSync(dirname(taskFile), { recursive: true });
          mkdirSync(dirname(stdoutFile), { recursive: true });
          writeFileSync(taskFile, message, { encoding: "utf8", mode: 0o600 });
          writeFileSync(stdoutFile, "", { encoding: "utf8", mode: 0o600 });
          writeFileSync(stderrFile, "", { encoding: "utf8", mode: 0o600 });

          let surface: string | null = null;
          let running: RunningSubagent;
          let launchScriptFile = "";
          try {
            surface = createSurfaceOfKind(selectSurfaceKind({ purpose: "resume" }), name);
            await new Promise<void>((done) => setTimeout(done, getShellReadyDelayMs()));
            const doneFile = prepareSubagentDoneFile(artifactDir, id);
            tagChildSurface(surface, entry.stateFile, doneFile);
            const command = `cd ${shellEscape(state.cwd)} && ${buildAgyCommand({
              agentRoot: state.agentRoot,
              additionalWorkspaceRoots: agyAdditionalWorkspaceRoots(state),
              agentName: state.agentName,
              taskFile,
              stdoutFile,
              stderrFile,
              doneFile,
              model: state.model,
              effort: state.effort,
              conversationId: state.conversationId,
            })}`;
            launchScriptFile = join(artifactDir, "subagent-scripts", `${state.agentName}-resume-${id}.sh`);
            sendLongCommand(surface, command, {
              scriptPath: launchScriptFile,
              scriptPreamble: [
                `# AGY subagent resume script for ${name}`,
                `# Generated: ${new Date().toISOString()}`,
                `# Conversation: ${state.conversationId}`,
                `# Surface: ${surface}`,
              ].join("\n"),
            });
            running = {
              id,
              name,
              task: message,
              agent: state.profileName,
              surface,
              startTime,
              sessionFile: stdoutFile,
              launchScriptFile,
              cli: "agy",
              doneFile,
              agyStdoutFile: stdoutFile,
              agyStderrFile: stderrFile,
              agyStateFile: entry.stateFile,
              interactive: false,
              statusState: createStatusState({ source: "agy", startTimeMs: startTime }),
            };
            runningSubagents.set(id, running);
          } catch (error) {
            if (surface) {
              try { closeSurface(surface); } catch {}
            }
            throw error;
          } finally {
            resumeClaim.release();
            launchSlot.release();
          }

          startWidgetRefresh();
          startStatusRefresh(pi);
          const watcherAbort = new AbortController();
          running.abortController = watcherAbort;
          watchSubagent(running, watcherAbort.signal)
            .then((result) => {
              updateWidget();
              const presentation = resolveResultPresentation(result, name);
              deliverSubagentMessage(
                pi,
                {
                  customType: "subagent_result",
                  content: presentation,
                  display: true,
                  details: {
                    name,
                    task: message,
                    agent: state.profileName,
                    harness: "agy",
                    exitCode: result.exitCode,
                    elapsed: result.elapsed,
                    ...(result.agyConversationId ? { agyConversationId: result.agyConversationId } : {}),
                    ...(result.agyUsage ? { agyUsage: result.agyUsage } : {}),
                    ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
                    ...(result.interrupted ? { interrupted: true } : {}),
                    ...(result.persistenceError ? { persistenceError: result.persistenceError } : {}),
                    ...(result.stats ? { stats: result.stats } : {}),
                  },
                },
                { triggerTurn: true, deliverAs: "steer" },
              );
            })
            .catch((error) => {
              updateWidget();
              deliverSubagentMessage(
                pi,
                {
                  customType: "subagent_result",
                  content: `AGY resume error: ${error instanceof Error ? error.message : String(error)}`,
                  display: true,
                  details: { name, error: error instanceof Error ? error.message : String(error) },
                },
                { triggerTurn: true, deliverAs: "steer" },
              );
            });
          return {
            content: [{ type: "text" as const, text: withAgyPolicyWarning(`AGY conversation "${name}" resumed.`, ["agy"]) }],
            details: { id, name, launchScriptFile, harness: "agy", status: "started" },
          };
        }

        const sessionPath = entry.sessionFile;
        if (!sessionPath || !existsSync(sessionPath)) {
          const err =
            `Subagent "${requestedName}" is registered but its session file is gone ` +
            `(${sessionPath}). It cannot be resumed. Spawn a fresh subagent instead.`;
          return { content: [{ type: "text" as const, text: err }], details: { error: err } };
        }

        // Guard: never resume a session that is still running — two processes
        // mutating the same .jsonl corrupts it. Steer it by name instead.
        for (const r of runningSubagents.values()) {
          if (canonicalSessionPath(r.sessionFile) === canonicalSessionPath(sessionPath)) {
            const err = `Subagent "${requestedName}" is still running as "${r.name}". Your message will steer it; resending as a steer.`;
            return await handleSubagentSteer({ name: r.name, message: params.message });
          }
        }

        // Reconstruct the sandbox from the snapshot written at spawn time.
        // Without it we cannot safely resume: relaunching bare would load every
        // global extension + the full toolset. Refuse rather than escalate.
        const loadout = readSubagentLoadout(sessionPath);
        if (!loadout) {
          const err =
            `Cannot safely resume "${requestedName}": no sandbox snapshot found for this session ` +
            `(it predates sandboxed resume, or its .loadout.json sidecar was removed). ` +
            `Resuming would relaunch with all global extensions and the full toolset, so this is refused. ` +
            `Re-run the task as a fresh subagent instead.`;
          return { content: [{ type: "text" as const, text: err }], details: { error: err } };
        }

        const extensionReplayError = validateLoadoutPreflight(loadout);
        if (extensionReplayError) {
          const err =
            `Cannot safely resume "${requestedName}": ${extensionReplayError}. ` +
            `Restore the exact extension, skill, or MCP configuration, or spawn a fresh subagent.`;
          return { content: [{ type: "text" as const, text: err }], details: { error: err } };
        }

        const resumedSessionId = entry.sessionId ?? getSessionId(sessionPath) ?? requestedName;

        // Record entry count before resuming so we can extract new messages.
        // Count lines cheaply (no per-line JSON.parse) so resuming a large
        // transcript doesn't block the UI.
        const entryCountBefore = countSessionEntryLines(sessionPath);
        const launchSlot = reserveLaunchSlot();
        if ("error" in launchSlot) return launchCapResult(launchSlot.error);
        const resumeClaim = claimResumeSession(sessionPath);
        if ("error" in resumeClaim) {
          launchSlot.release();
          return {
            content: [{ type: "text" as const, text: resumeClaim.error }],
            details: { error: resumeClaim.error },
          };
        }

        let surface: string | null = null;
        let activityFile = "";
        let launchScriptFile = "";
        let running: RunningSubagent;
        try {
          surface = createSurfaceOfKind(selectSurfaceKind({ purpose: "resume" }), name);
          await new Promise<void>((resolve) => setTimeout(resolve, getShellReadyDelayMs()));

        // Build pi resume command
        const parts = ["pi", "--session", shellEscape(sessionPath)];

        const sessionId = ctx.sessionManager.getSessionId();
        const artifactDir = getArtifactDir(ctx.sessionManager.getSessionDir(), sessionId);
        activityFile = getSubagentActivityFile(artifactDir, id);
        mkdirSync(dirname(activityFile), { recursive: true });

        // Replay the model, identity, and default-deny tool/extension sandbox.
        applySandboxToParts(parts, loadout, { artifactDir, name, artifactId: id });

        let resumeMsgFile: string | undefined;
        if (params.message) {
          resumeMsgFile = buildArtifactPath({
            artifactDir,
            subdir: "subagent-resume",
            name,
            fallbackName: "resume",
            kind: "message",
            uniqueId: id,
          });
          mkdirSync(dirname(resumeMsgFile), { recursive: true });
          writeFileSync(resumeMsgFile, message, "utf8");
          parts.push(shellEscape(`@${resumeMsgFile}`));
        }

        // Build env prefix from the snapshot only. New-mode capability values
        // use the same encoding as initial launch; both modes explicitly
        // override nested-agent inheritance, including deny-all.
        const resumeEnvParts: string[] = [];
        resumeEnvParts.push(`PI_CODING_AGENT_DIR=${shellEscape(loadout.agentDir)}`);
        resumeEnvParts.push(...buildResumeCapabilityEnvironment(loadout));
        if (loadout.agent) {
          resumeEnvParts.push(`PI_SUBAGENT_AGENT=${shellEscape(loadout.agent)}`);
        }
        resumeEnvParts.push(`PI_SUBAGENT_NAME=${shellEscape(name)}`);
        resumeEnvParts.push(`PI_SUBAGENT_SESSION=${shellEscape(sessionPath)}`);
        resumeEnvParts.push(`PI_SUBAGENT_ID=${shellEscape(id)}`);
        resumeEnvParts.push(`PI_SUBAGENT_ACTIVITY_FILE=${shellEscape(activityFile)}`);
        if (autoExit) {
          resumeEnvParts.push(`PI_SUBAGENT_AUTO_EXIT=1`);
        }
        const resumeEnvPrefix = resumeEnvParts.join(" ") + " ";

        // Resume in the subagent's original cwd so its tools and edits operate
        // where they did before.
        const resumeCdPrefix = loadout.cwd ? `cd ${shellEscape(loadout.cwd)} && ` : "";

        const doneFile = prepareSubagentDoneFile(artifactDir, id);
        tagChildSurface(surface, sessionPath, doneFile);
        const command = `${resumeCdPrefix}${resumeEnvPrefix}${parts.join(" ")}${completionSuffix(doneFile)}`;
        launchScriptFile = join(
          artifactDir,
          "subagent-scripts",
          `${name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "") || "resume"}-resume-${Date.now()}.sh`,
        );
        sendLongCommand(surface, command, {
          scriptPath: launchScriptFile,
          scriptPreamble: [
            `# Subagent resume script for ${name}`,
            `# Generated: ${new Date().toISOString()}`,
            `# Session: ${sessionPath}`,
            `# Surface: ${surface}`,
            ...(resumeMsgFile ? [`# Resume message file: ${resumeMsgFile}`] : []),
          ].join("\n"),
        });

        // Register as a running subagent for widget tracking
        running = {
          id,
          name,
          task: message,
          ...(loadout.agent ? { agent: loadout.agent } : {}),
          surface,
          startTime,
          sessionFile: sessionPath,
          launchScriptFile,
          activityFile,
          doneFile,
          interactive,
          statusState: createStatusState({
            source: "pi",
            startTimeMs: startTime,
          }),
        };
        runningSubagents.set(id, running);
        } catch (error) {
          if (surface) {
            try {
              closeSurface(surface);
            } catch {}
          }
          throw error;
        } finally {
          resumeClaim.release();
          launchSlot.release();
        }
        startWidgetRefresh();
        startStatusRefresh(pi);

        // Fire-and-forget watcher
        const watcherAbort = new AbortController();
        running.abortController = watcherAbort;

        watchSubagent(running, watcherAbort.signal)
          .then((result) => {
            updateWidget();

            const allEntries = getNewEntries(sessionPath, entryCountBefore);
            const summary = findLastAssistantMessage(allEntries) ??
              (result.errorMessage
                ? `Subagent error: ${result.errorMessage}`
                : result.exitCode !== 0
                  ? `Resumed session exited with code ${result.exitCode}`
                  : "Resumed session exited without new output");
            const presentation = resolveResultPresentation(
              { ...result, summary, sessionFile: sessionPath, sessionId: resumedSessionId },
              name,
            );

            deliverSubagentMessage(
              pi,
              {
                customType: "subagent_result",
                content: presentation,
                display: true,
                details: {
                  name,
                  task: message,
                  exitCode: result.exitCode,
                  elapsed: result.elapsed,
                  sessionFile: sessionPath,
                  sessionId: resumedSessionId,
                  ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
                  ...(result.interrupted ? { interrupted: true } : {}),
                },
              },
              { triggerTurn: true, deliverAs: "steer" },
            );
          })
          .catch((err) => {
            updateWidget();
            deliverSubagentMessage(
              pi,
              {
                customType: "subagent_result",
                content: `Resume error: ${err?.message ?? String(err)}`,
                display: true,
                details: { name, error: err?.message },
              },
              { triggerTurn: true, deliverAs: "steer" },
            );
          });

        return {
          content: [{ type: "text", text: `Session "${name}" resumed.` }],
          details: {
            id,
            name,
            sessionId: resumedSessionId,
            sessionFile: sessionPath,
            launchScriptFile,
            status: "started",
          },
        };
      },
    });

  // /subagent command — spawn a subagent by name
  pi.registerCommand("subagent", {
    description: "Spawn a subagent: /subagent <agent> <task>",
    handler: async (args, ctx) => {
      const trimmed = args.trim();
      if (!trimmed) {
        ctx.ui.notify("Usage: /subagent <agent> [task]", "warning");
        return;
      }

      const spaceIdx = trimmed.indexOf(" ");
      const agentName = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
      const task = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

      const discovery = await discoverDefinitionsForContext(ctx);
      const defs = discovery.agents.find((agent) => agent.name === agentName);
      if (!defs) {
        ctx.ui.notify(
          `Agent "${agentName}" is not a valid available definition. ` + agentDiscoveryHint(discovery) +
            formatDiscoveryDiagnostics(discovery),
          "error",
        );
        return;
      }

      const taskText = task || `You are the ${agentName} agent. Wait for instructions.`;
      const toolCall = `Use subagent with agent: "${agentName}", task: ${JSON.stringify(taskText)}`;
      pi.sendUserMessage(toolCall);
    },
  });

  // ── subagent_result message renderer ──
  pi.registerMessageRenderer("subagent_result", (message, options, theme) => {
    const details = message.details as any;
    if (!details) return undefined;

    return {
      render(width: number): string[] {
        const name = details.name ?? "subagent";
        const exitCode = details.exitCode ?? 0;
        const errorMessage = typeof details.errorMessage === "string" ? details.errorMessage : "";
        const failed = exitCode !== 0 || !!errorMessage;
        const elapsed = details.elapsed != null ? formatElapsed(details.elapsed) : "?";
        const bgFn = failed
          ? (text: string) => theme.bg("toolErrorBg", text)
          : (text: string) => theme.bg("toolSuccessBg", text);
        const stats = (details.stats ?? null) as SessionStats | null;
        const icon = failed
          ? theme.fg("error", "✗")
          : theme.fg("success", "✓");
        const agentTag = details.agent ? theme.fg("dim", ` (${details.agent})`) : "";
        const harnessTag = details.harness === "agy"
          ? theme.fg("dim", " [agy]")
          : details.harness === "chain"
            ? theme.fg("dim", details.winner
                ? ` [chain ${details.winner.targetIndex}/${details.winner.targetCount} · ${details.winner.harness}]`
                : " [chain]")
            : "";
        const modelTag = stats?.model ? theme.fg("dim", ` (${stats.model})`) : "";
        const titleSegment = `${icon} ${theme.fg("toolTitle", theme.bold(name))}${agentTag}${harnessTag}${modelTag} ${theme.fg("dim", "—")} `;

        // Success: icon already conveys "completed", so show "N tools · duration"
        // like the in-process extension. Failure: surface the failure reason.
        let header: string;
        if (failed) {
          const reason = errorMessage ? "failed (provider/agent error)" : `failed (exit ${exitCode})`;
          header = `${titleSegment}${theme.fg("error", reason)} ${theme.fg("dim", `· ${elapsed}`)}`;
        } else {
          const toolPart = stats ? `${stats.toolCount} tools · ${elapsed}` : elapsed;
          header = `${titleSegment}${theme.fg("dim", toolPart)}`;
        }

        // Usage line: ↑in ↓out R… W… $cost · context-gauge (color-coded by %).
        let usageLine: string | null = null;
        if (stats) {
          const segs = formatUsageSegments(stats).map((s) => theme.fg("dim", s));
          if (stats.contextTokens > 0) {
            const window = resolveContextWindow(stats.model, stats.provider, latestModelRegistry);
            const ctxStr = formatContextUsage(stats.contextTokens, window);
            const pct = window ? (stats.contextTokens / window) * 100 : 0;
            const coloredCtx =
              pct > 90 ? theme.fg("error", ctxStr) : pct > 70 ? theme.fg("warning", ctxStr) : theme.fg("dim", ctxStr);
            segs.push(coloredCtx);
          }
          if (segs.length > 0) usageLine = segs.join(theme.fg("dim", " "));
        }

        const rawContent = typeof message.content === "string" ? message.content : "";
        const presentationBody = details.harness === "chain" && rawContent.includes("\n\n")
          ? rawContent.split("\n\n").slice(1).join("\n\n")
          : rawContent;

        // Clean summary (remove follow-up ref and leading label for display)
        const summary = presentationBody
          .replace(/\n\nFollow up with subagent_message[\s\S]+$/, "")
          .replace(`Sub-agent "${name}" completed (${elapsed}).\n\n`, "")
          .replace(`Sub-agent "${name}" failed (exit code ${exitCode}).\n\n`, "")
          .replace(
            new RegExp(
              `^Sub-agent "${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" failed after ${elapsed} \\(provider/agent error — auto-retry exhausted\\)\\.\\n\\n`,
            ),
            "",
          );

        // Build content for the box
        const contentLines = [header];
        if (usageLine) contentLines.push(usageLine);

        if (options.expanded) {
          // Full view: complete summary + session info
          if (summary) {
            for (const line of summary.split("\n")) {
              contentLines.push(line.slice(0, width - 6));
            }
          }
          if (details.name || details.sessionFile) {
            contentLines.push("");
            if (details.name && !(details.harness === "chain" && details.resumeSupported !== true)) {
              contentLines.push(
                theme.fg(
                  "dim",
                  `Follow up:  subagent_message({ name: "${details.name}", message: "…" })`,
                ),
              );
            }
            if (details.sessionFile) {
              contentLines.push(theme.fg("muted", `Session file: ${details.sessionFile}`));
            }
          }
        } else {
          // Collapsed: preview + expand hint
          if (summary) {
            const previewLines = summary.split("\n").slice(0, 5);
            for (const line of previewLines) {
              contentLines.push(theme.fg("dim", line.slice(0, width - 6)));
            }
            const totalLines = summary.split("\n").length;
            if (totalLines > 5) {
              contentLines.push(theme.fg("muted", `… ${totalLines - 5} more lines`));
            }
          }
          contentLines.push(theme.fg("muted", keyHint("app.tools.expand", "to expand")));
        }

        // Render via Box for background + padding, with blank line above for separation
        const box = new Box(1, 1, bgFn);
        box.addChild(new Text(contentLines.join("\n"), 0, 0));
        return ["", ...box.render(width)];
      },
    };
  });

  // ── subagent_status message renderer ──
  pi.registerMessageRenderer("subagent_status", (message, options, theme) => {
    const details = message.details as any;
    const lines = Array.isArray(details?.lines) ? details.lines : [];
    const overflow = typeof details?.overflow === "number" ? details.overflow : 0;
    if (lines.length === 0 && overflow === 0) return undefined;

    return {
      render(width: number): string[] {
        const lineWidth = Math.max(0, width - 6);
        const contentLines = [
          `${theme.fg("accent", "•")} ${theme.fg("toolTitle", theme.bold("Subagent status"))}`,
          ...lines.map((line: string) => theme.fg("dim", truncateToWidth(line, lineWidth))),
        ];

        if (overflow > 0) {
          contentLines.push(theme.fg("muted", `+${overflow} more running.`));
        }
        if (!options.expanded) {
          contentLines.push(theme.fg("muted", keyHint("app.tools.expand", "to expand")));
        }

        const box = new Box(1, 1, (text: string) => theme.bg("customMessageBg", text));
        box.addChild(new Text(contentLines.join("\n"), 0, 0));
        return ["", ...box.render(width)];
      },
    };
  });

  // ── subagent_question message renderer ──
  pi.registerMessageRenderer("subagent_question", (message, options, theme) => {
    const details = message.details as any;
    if (!details) return undefined;

    return {
      render(width: number): string[] {
        const name = details.name ?? "subagent";
        const agentTag = details.agent ? theme.fg("dim", ` (${details.agent})`) : "";
        const bgFn = (text: string) => theme.bg("toolSuccessBg", text);

        const icon = theme.fg("accent", "?");
        const header = `${icon} ${theme.fg("toolTitle", theme.bold(name))}${agentTag} ${theme.fg("dim", "— asks a question")}`;

        const contentLines = [header];

        if (options.expanded) {
          contentLines.push("");
          contentLines.push(details.question ?? "");
          contentLines.push("");
          contentLines.push(
            theme.fg("dim", `Reply: subagent_message({ name: "${name}", message: "…" })`),
          );
        } else {
          const preview = (details.question ?? "").split("\n")[0].slice(0, width - 10);
          contentLines.push(theme.fg("dim", preview));
          contentLines.push(theme.fg("muted", keyHint("app.tools.expand", "to expand")));
        }

        const box = new Box(1, 1, bgFn);
        box.addChild(new Text(contentLines.join("\n"), 0, 0));
        return ["", ...box.render(width)];
      },
    };
  });

}
