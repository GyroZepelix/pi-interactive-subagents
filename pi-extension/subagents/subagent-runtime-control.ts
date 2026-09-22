/**
 * Runtime control extension loaded into subagents.
 * - Shows agent identity + available tools as a styled widget above the editor (toggle with Ctrl+Alt+O)
 * - Provides an `ask_question` tool for asking the parent orchestrator a question
 *
 * Subagents do NOT self-terminate via a tool. Auto-exit agents shut down
 * automatically after Pi reports that the agent is settled; interactive agents
 * end when the human exits the pane.
 *
 * `ask_question` keeps its tool promise pending after atomically publishing a
 * correlated request. The parent submits a private answer envelope through the
 * existing tmux input path; this protected extension consumes and acknowledges
 * that envelope, resolves the tool, and lets the same agent run continue.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { writeFileSync } from "node:fs";
import { createSubagentActivityRecorder } from "./activity.ts";
import {
  QUESTION_PROTOCOL_VERSION,
  createQuestionId,
  parseQuestionAnswer,
  questionAcknowledgmentPath,
  questionRequestPath,
  removeMatchingQuestionAcknowledgment,
  removeMatchingQuestionRequest,
  writeQuestionAcknowledgment,
  writeQuestionRequest,
} from "./question-protocol.ts";

export function shouldMarkUserTookOver(agentStarted: boolean): boolean {
  return agentStarted;
}

/**
 * Number of child subagents this session itself still has in flight.
 *
 * When this extension is loaded inside a subagent that can spawn its own
 * children (for example, a coordinator delegating to configured agents), `index.ts` runs in
 * the same process and publishes a live count through a shared process-global
 * symbol. A subagent that spawns children and then writes a "waiting for
 * results" message would otherwise auto-exit the instant that turn ends —
 * killing the session before its children report back. Reading this count lets
 * the settlement handler keep the session open until every child has finished
 * and its result has been delivered.
 *
 * Returns 0 when the spawning tools are not loaded, so non-spawning agents
 * auto-exit exactly as before.
 */
export function runningChildrenCount(): number {
  const fn = (globalThis as any)[Symbol.for("pi-subagents/running-children-count")];
  if (typeof fn !== "function") return 0;
  try {
    const n = fn();
    return typeof n === "number" && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function shouldFinalizeOnAgentSettled(
  _userTookOver: boolean,
  messages: any[] | undefined,
): boolean {
  // Manual input should not strand an auto-exit subagent. If the latest agent
  // turn completed normally, close the session. Escape/abort still leaves it
  // open for inspection or another prompt.
  //
  // stopReason: "error" (e.g. exhausted retries on a provider overload) also
  // returns true — we want to shut down so the parent is woken up — but we
  // pair this with findLatestAssistantError() so the parent learns it was an
  // error, not a clean completion.
  if (messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg?.role === "assistant") {
        return msg.stopReason !== "aborted";
      }
    }
  }

  return true;
}

export interface SubagentErrorInfo {
  errorMessage: string;
  stopReason: "error";
}

/**
 * If the last assistant message in the turn ended with `stopReason: "error"`
 * (typically auto-retry exhausted on an overload / rate limit / server error),
 * return its error info so the parent orchestrator can surface a clear
 * failure instead of silently treating the run as completed.
 *
 * Returns `null` when the latest assistant turn completed normally or was
 * aborted by the user (handled separately by shouldFinalizeOnAgentSettled).
 */
export function findLatestAssistantError(
  messages: any[] | undefined,
): SubagentErrorInfo | null {
  if (!messages) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role !== "assistant") continue;
    if (msg.stopReason !== "error") return null;
    const raw = typeof msg.errorMessage === "string" ? msg.errorMessage.trim() : "";
    return {
      errorMessage: raw || "Subagent agent loop ended with stopReason=error (no errorMessage field).",
      stopReason: "error",
    };
  }
  return null;
}

export function parseDeniedTools(rawValue: string | undefined): string[] {
  return (rawValue ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export default function (pi: ExtensionAPI) {
  let toolNames: string[] = [];
  let denied: string[] = [];
  let expanded = false;

  // Read subagent identity from env vars (set by parent orchestrator)
  const subagentName = process.env.PI_SUBAGENT_NAME ?? "";
  const subagentAgent = process.env.PI_SUBAGENT_AGENT ?? "";
  const deniedToolsValue = process.env.PI_DENY_TOOLS;
  const autoExit = process.env.PI_SUBAGENT_AUTO_EXIT === "1";
  const recorder = createSubagentActivityRecorder({
    runningChildId: process.env.PI_SUBAGENT_ID,
    activityFile: process.env.PI_SUBAGENT_ACTIVITY_FILE,
  });

  function renderWidget(ctx: { ui: { setWidget: Function } }, _theme: any) {
    ctx.ui.setWidget(
      "subagent-tools",
      (_tui: any, theme: any) => {
        const box = new Box(1, 0, (text: string) => theme.bg("toolSuccessBg", text));

        const label = subagentAgent || subagentName;
        const agentTag = label ? theme.bold(theme.fg("accent", `[${label}]`)) : "";

        if (expanded) {
          // Expanded: full tool list + denied
          const countInfo = theme.fg("dim", ` — ${toolNames.length} available`);
          const hint = theme.fg("muted", "  (Ctrl+Alt+O to collapse)");

          const toolList = toolNames
            .map((name: string) => theme.fg("dim", name))
            .join(theme.fg("muted", ", "));

          let deniedLine = "";
          if (denied.length > 0) {
            const deniedList = denied
              .map((name: string) => theme.fg("error", name))
              .join(theme.fg("muted", ", "));
            deniedLine = "\n" + theme.fg("muted", "denied: ") + deniedList;
          }

          const content = new Text(
            `${agentTag}${countInfo}${hint}\n${toolList}${deniedLine}`,
            0,
            0,
          );
          box.addChild(content);
        } else {
          // Collapsed: one-line summary
          const countInfo = theme.fg("dim", ` — ${toolNames.length} tools`);
          const deniedInfo =
            denied.length > 0
              ? theme.fg("dim", " · ") + theme.fg("error", `${denied.length} denied`)
              : "";
          const hint = theme.fg("muted", "  (Ctrl+Alt+O to expand)");

          const content = new Text(`${agentTag}${countInfo}${deniedInfo}${hint}`, 0, 0);
          box.addChild(content);
        }

        return box;
      },
      { placement: "aboveEditor" },
    );
  }

  let userTookOver = false;
  let agentStarted = false;
  let latestAgentEndMessages: any[] | undefined;
  let finalized = false;
  interface PendingQuestion {
    id: string;
    sessionFile: string;
    signal?: AbortSignal;
    abortHandler?: () => void;
    resolve(answer: string): void;
    reject(error: Error): void;
  }
  let pendingQuestion: PendingQuestion | null = null;

  function clearPendingQuestion(record: PendingQuestion): void {
    if (record.signal && record.abortHandler) {
      record.signal.removeEventListener("abort", record.abortHandler);
    }
    if (pendingQuestion === record) pendingQuestion = null;
  }

  function abortError(): Error {
    const error = new Error("ask_question was aborted before an answer arrived");
    error.name = "AbortError";
    return error;
  }

  pi.on("session_start", (_event, ctx) => {
    recorder.sessionStart();
    toolNames = pi.getAllTools().map((tool) => tool.name).sort();
    denied = parseDeniedTools(deniedToolsValue);
    renderWidget(ctx, null);
  });

  pi.on("input", (event) => {
    const parsed = parseQuestionAnswer((event as any).text ?? "");
    if (parsed.private) {
      const record = pendingQuestion;
      const answer = parsed.answer;
      // Private protocol input is always contained. Malformed, stale, and
      // mismatched envelopes must never become a queued child message.
      if (!record || !answer || answer.id !== record.id) return { action: "handled" };

      try {
        writeQuestionAcknowledgment(questionAcknowledgmentPath(record.sessionFile), record.id);
      } catch {
        // Without the exact marker the parent cannot distinguish acceptance
        // from an ambiguous tmux submission, so keep waiting rather than
        // resolving an answer that can never be confirmed.
        return { action: "handled" };
      }

      recorder.input();
      removeMatchingQuestionRequest(questionRequestPath(record.sessionFile), record.id);
      clearPendingQuestion(record);
      record.resolve(answer.answer);
      return { action: "handled" };
    }

    recorder.input();
    // Ignore the initial task message that starts an autonomous subagent.
    // Only ordinary inputs after the first agent run has started count as user takeover.
    if (shouldMarkUserTookOver(agentStarted)) userTookOver = true;
    return { action: "continue" };
  });

  pi.on("before_agent_start", () => {
    recorder.beforeAgentStart();
  });

  pi.on("agent_start", () => {
    agentStarted = true;
    recorder.agentStart();
  });

  pi.on("agent_end", (event) => {
    // agent_end closes one low-level run, but Pi may still retry, compact and
    // recover, or drain queued work. Keep only the latest run outcome and leave
    // the recorder enabled for any subsequent lifecycle events.
    latestAgentEndMessages = (event as any).messages as any[] | undefined;
    recorder.agentEndWaiting();
    if (autoExit) {
      // Reset any recorded manual input marker. Auto-exit is decided by whether
      // the latest agent run completed normally, not by who initiated it.
      userTookOver = false;
    }
  });

  pi.on("agent_settled", (_event, ctx) => {
    if (finalized || !autoExit) return;

    // Never shut down while this session still has work in flight:
    //  - pendingQuestion: an ask_question is pending the orchestrator's reply.
    //  - runningChildrenCount(): this subagent spawned its own children and is
    //    waiting for their results (delivered as steered turns). Exiting now
    //    would strand those children and drop their results.
    //  - ctx.hasPendingMessages(): Pi has accepted steering/follow-up input
    //    that its current loop has not drained yet.
    // A later run can replace latestAgentEndMessages before Pi settles again.
    const hasPendingChildren = runningChildrenCount() > 0;
    const hasPendingMessages = ctx.hasPendingMessages();
    if (
      pendingQuestion ||
      hasPendingChildren ||
      hasPendingMessages ||
      !shouldFinalizeOnAgentSettled(userTookOver, latestAgentEndMessages)
    ) {
      return;
    }

    // Surface a final stopReason: "error" to the parent via the existing .exit
    // sidecar. Transient errors never reach this path because each later
    // agent_end replaces the captured outcome before settlement.
    const errorInfo = findLatestAssistantError(latestAgentEndMessages);
    const sessionFile = process.env.PI_SUBAGENT_SESSION;
    if (errorInfo && sessionFile) {
      try {
        writeFileSync(
          `${sessionFile}.exit`,
          JSON.stringify({
            type: "error",
            errorMessage: errorInfo.errorMessage,
            stopReason: errorInfo.stopReason,
          }),
        );
      } catch {
        // Best effort — even without the sidecar, watcher's session-file
        // fallback can still recover the errorMessage.
      }
    }

    finalized = true;
    recorder.agentSettledDone();
    ctx.shutdown();
  });

  pi.on("turn_start", (event) => {
    recorder.turnStart((event as any).turnIndex);
  });

  pi.on("turn_end", (event) => {
    recorder.turnEnd((event as any).turnIndex);
  });

  pi.on("before_provider_request", () => {
    recorder.beforeProviderRequest();
  });

  pi.on("after_provider_response", () => {
    recorder.afterProviderResponse();
  });

  pi.on("message_update", (event) => {
    recorder.messageUpdate((event as any).assistantMessageEvent?.type);
  });

  pi.on("tool_execution_start", (event) => {
    recorder.toolExecutionStart((event as any).toolCallId, (event as any).toolName);
  });

  pi.on("tool_call", (event) => {
    recorder.toolCall((event as any).toolCallId, (event as any).toolName);
  });

  pi.on("tool_execution_update", (event) => {
    recorder.toolExecutionUpdate((event as any).toolCallId, (event as any).toolName);
  });

  pi.on("tool_result", (event) => {
    recorder.toolResult((event as any).toolCallId, (event as any).toolName);
  });

  pi.on("tool_execution_end", (event) => {
    recorder.toolExecutionEnd((event as any).toolCallId, (event as any).toolName);
  });

  pi.on("session_shutdown", (event) => {
    const record = pendingQuestion;
    if (record) {
      removeMatchingQuestionRequest(questionRequestPath(record.sessionFile), record.id);
      removeMatchingQuestionAcknowledgment(questionAcknowledgmentPath(record.sessionFile), record.id);
      clearPendingQuestion(record);
      record.reject(abortError());
    }
    recorder.sessionShutdown((event as any).reason);
  });

  // Toggle expand/collapse with Ctrl+Alt+O
  pi.registerShortcut("ctrl+alt+o", {
    description: "Toggle subagent tools widget",
    handler: (ctx) => {
      expanded = !expanded;
      renderWidget(ctx, null);
    },
  });

  pi.registerTool({
    name: "ask_question",
    label: "ask_question",
    description:
      "Ask the orchestrator (the parent agent that spawned you) a single question and pause until they reply. " +
      "Use this when requirements are ambiguous, a decision would materially affect your work, you're blocked, " +
      "or you need information or confirmation only the orchestrator has. Prefer asking over guessing. " +
      "Your tool call stays pending while you wait; the matching answer is returned as its result, then you continue. " +
      "Ask exactly one question per call; make separate calls for unrelated questions.",
    promptSnippet:
      "Use this tool to ask the orchestrator one clarifying, missing-requirement, preference, or decision question before continuing — instead of guessing.",
    promptGuidelines: [
      "Ask exactly one question per tool call.",
      "If you need answers to multiple things, make separate ask_question calls instead of bundling them.",
      "Prefer this tool over guessing when requirements, preferences, or implementation choices are unclear.",
      "Use it when multiple valid paths exist and the right one depends on the orchestrator's intent.",
      "Give enough context in the question that the orchestrator can answer without re-reading your whole task.",
      "After asking, wait for this tool call to return the orchestrator's answer.",
    ],
    parameters: Type.Object({
      question: Type.String({
        description:
          "The single freeform question to ask the orchestrator. Include enough context to answer it directly.",
      }),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const sessionFile = process.env.PI_SUBAGENT_SESSION;
      if (!sessionFile) {
        throw new Error(
          "ask_question is only available in subagent contexts. " +
            "PI_SUBAGENT_SESSION environment variable is not set.",
        );
      }
      if (pendingQuestion) {
        throw new Error("ask_question already has a pending question in this child process");
      }
      if (params.question.trim() === "") throw new Error("ask_question requires a non-empty question");
      if (signal?.aborted) throw abortError();

      const id = createQuestionId();
      const requestFile = questionRequestPath(sessionFile);
      const acknowledgmentFile = questionAcknowledgmentPath(sessionFile);
      removeMatchingQuestionAcknowledgment(acknowledgmentFile, id);

      const answer = new Promise<string>((resolve, reject) => {
        const record: PendingQuestion = {
          id,
          sessionFile,
          signal,
          resolve,
          reject,
        };
        record.abortHandler = () => {
          if (pendingQuestion !== record) return;
          removeMatchingQuestionRequest(requestFile, id);
          removeMatchingQuestionAcknowledgment(acknowledgmentFile, id);
          clearPendingQuestion(record);
          reject(abortError());
        };
        pendingQuestion = record;
        signal?.addEventListener("abort", record.abortHandler, { once: true });
      });

      try {
        writeQuestionRequest(requestFile, {
          version: QUESTION_PROTOCOL_VERSION,
          id,
          name: process.env.PI_SUBAGENT_NAME?.trim() || "subagent",
          agent: process.env.PI_SUBAGENT_AGENT ?? "",
          question: params.question,
        });
        recorder.askQuestion();
      } catch (error) {
        const failure = error instanceof Error ? error : new Error(String(error));
        const record = pendingQuestion;
        if (record?.id === id) {
          clearPendingQuestion(record);
          record.reject(failure);
        }
        await answer.catch(() => undefined);
        throw failure;
      }

      const orchestratorAnswer = await answer;
      return {
        content: [{
          type: "text",
          text: `The orchestrator replied:\n\n${orchestratorAnswer}`,
        }],
        details: { id, question: params.question, answer: orchestratorAnswer },
      };
    },

    renderCall(args, theme) {
      const text =
        theme.fg("toolTitle", theme.bold("ask_question ")) +
        theme.fg("muted", String((args as any).question ?? ""));
      return new Text(text, 0, 0);
    },
  });

}
