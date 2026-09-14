# Plan: Fix frozen subagent reply delivery

Work item: `260914-1641-fix-frozen-subagent-reply-delivery`
Status: Planned
Created: 2026-09-14
Updated: 2026-09-14

Assurance: medium - the fix crosses tmux transport, Pi TUI input, child lifecycle state, and asynchronous status reporting. The failure can strand a live child and lose a reply, but the change is local, testable, and reversible.

## Goal

Make `subagent_message` deliver large replies to a running Pi subagent without freezing its pane, prevent replies from being dropped during Pi's settling window, and avoid reporting confirmed delivery when a waiting child has not consumed the input.

## Context

Two retained incidents and one live frozen session establish the primary failure path:

- A child had already reached `phase: waiting` before the parent replied, ruling out turn settlement as the cause of those freezes.
- Raw live steers of 4,283 bytes and 3,219 bytes returned `status: steered`, but produced no child user entry and no activity advance.
- In the live 3,219-byte incident, the nested child PTY retained 1,022 unread input bytes while the Pi main thread was blocked in kernel `write()` from its stdin callback. The tmux pane remained alive, was not in copy mode, and the raw child TTY used `-isig`, explaining why normal input and Ctrl+C appeared dead.
- A later message delivered through the finished-session `@file` resume path succeeded. This localizes the observed freeze to live `tmux send-keys` delivery through the AMZN-signed Kiro shell-integration wrapper (`kiro-cli-term`) rather than registry, resume, model behavior, or the Pi Kiro inference provider. The wrapper is installed around shells even when the user runs Pi directly and does not invoke the Kiro CLI.
- `pi-extension/subagents/tmux.ts` currently sends the entire flattened message as literal keys and then sends Enter. Pi TUI treats bracketed paste as one paste event, while ordinary input is parsed as key sequences and can generate output while an intermediary PTY is still forwarding a large burst.
- A separate source audit found a credible settling-window loss: Pi 0.85.1 keeps `isStreaming` true through `agent_end`, while a late steer can clear `awaitingAnswer` after the agent loop's last steering-queue read. The child can then request shutdown with that reply still queued. This is not the cause of the retained idle-waiting incidents, but it affects the same reply contract and is in scope.

Relevant code and tests:

- `pi-extension/subagents/index.ts`
- `pi-extension/subagents/tmux.ts`
- `pi-extension/subagents/subagent-runtime-control.ts`
- `pi-extension/subagents/activity.ts`
- `test/test.ts`
- `test/integration/tmux-surface.test.ts`
- `test/integration/subagent-lifecycle.test.ts`

## Requirements

- R1: Deliver running-subagent text through a large-input-safe tmux path that uses bracketed paste when the target application requests it. Do not pass the message in a shell command or tmux argument that exposes it through process listings.
- R2: Preserve current name-based routing, whitespace trimming, multiline flattening, running Pi and Claude steering, and finished Pi `@file` resume behavior.
- R3: A waiting Pi child must consume one complete reply as one submitted input without PTY backpressure deadlock, truncation, duplicate submission, or an unresponsive editor.
- R4: Do not auto-exit a child while Pi reports queued messages. A reply accepted during the settling window must run before normal auto-exit is reconsidered.
- R5: When a valid waiting-child activity baseline exists, report confirmed delivery only after a newer same-child activity snapshot proves the child consumed or started processing input. A bounded timeout must report delivery as unconfirmed, without automatic resend, pane termination, or duplicate execution.
- R6: For active Pi children or Claude children where the existing activity stream cannot uniquely acknowledge a specific input, use accurate "submitted" wording rather than claiming child consumption.
- R7: Support safe operator recovery for an already wedged child: detect an externally terminated or missing pane, remove its running entry, report the interrupted delivery, preserve the session, and then allow the same runtime name to resume. The plugin must not kill or retry an ambiguous delivery automatically.
- R8: Add no dependency and make no change to profile discovery, sandbox snapshots, capability grants, registry identity, or model selection.

## Out of scope

- Replacing tmux with sockets, RPC, or a general cross-process message broker.
- Automatic termination or replay after an ambiguous delivery.
- Broad stop, interrupt, cancellation, shell-readiness, or orchestration redesign.
- Changing Pi core, the Kiro shell-integration wrapper, or the Pi Kiro inference provider.
- Supporting undocumented terminal multiplexers or hypothetical scale beyond the reproduced message sizes.
- Committing, pushing, publishing, or running model-consuming tests without explicit approval.

## Design

### Large-input-safe tmux transport

Add a dedicated text-submission primitive in `tmux.ts` for TUI messages:

1. Normalize the message in the caller as today.
2. Create a collision-resistant tmux buffer name.
3. Load the text from stdin with `tmux load-buffer -b <name> -`, keeping message content out of command arguments.
4. Paste with `tmux paste-buffer -p -d -b <name> -t <pane>`. The `-p` flag adds bracketed-paste markers when the application requested that mode, allowing Pi TUI to accumulate the complete payload before one editor update.
5. Send Enter separately only after paste succeeds.
6. Delete the named buffer on every failure path where `-d` did not already remove it.

Keep `sendCommand` and `sendLongCommand` for shell launch commands. Route only live subagent text through the new primitive.

### Waiting-child acknowledgment

Before sending to a Pi child whose validated activity phase is `waiting`, retain its running-child ID and sequence. After submission, wait for a short bounded interval for a valid same-child snapshot with a newer sequence and evidence that input or a new turn began. Return `delivered` only on that evidence. On timeout, return `unconfirmed`, retain the running entry, do not force a misleading local status transition, and provide concise recovery guidance.

Active Pi and Claude steering remain fire-and-forget, but their result text and details must say `submitted` rather than `delivered` when no unique acknowledgment is available.

### Settling-window guard

In the child `agent_end` handler, include `ctx.hasPendingMessages()` in the decision that suppresses auto-exit. Keep `awaitingAnswer` semantics, but do not request shutdown while Pi still owns steering or follow-up input. Let Pi drain the queue, run the answer turn, and reevaluate auto-exit at the later `agent_end`.

### Recovery boundary

Do not attempt automatic kill or replay after timeout because the message may have been accepted but not yet observed. Explain the ambiguous state and the explicit recovery sequence.

Make exit polling distinguish a transient capture error from a pane that no longer exists. When an operator terminates a wedged child or pane, finish the watcher with an interrupted result, remove the running entry, and keep the registered session resumable by the same name. This closes the current infinite-poll behavior after a pane disappears without adding an automatic destructive action.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D01 | Primary cause | Treat raw large-message terminal injection as the cause of the observed freezes. | The child was already waiting, tmux accepted the steer, the child recorded no input, the inner PTY retained 1,022 bytes, and Pi blocked writing from its stdin callback. | Retained parent/child JSONL, activity snapshots, live tmux/PTY/process inspection, `tmux.ts`, Pi TUI stdin path. | A controlled large-payload test fails to reproduce or bracketed paste still deadlocks. |
| D02 | Transport | Use tmux load-buffer plus bracketed paste and a separate Enter. | It keeps content out of argv and lets Pi consume a large paste as one event instead of interleaving per-key input with rendering. | tmux `send-keys`, `load-buffer`, and `paste-buffer -p` documentation; Pi TUI `stdin-buffer.js` and `terminal.js`. | The supported tmux version cannot provide bracketed paste or exact content preservation. |
| D03 | Acknowledgment | Confirm idle-waiting delivery from a newer same-child activity snapshot; otherwise report unconfirmed and do not retry. | tmux command success proves only injection, not child consumption. Automatic resend could duplicate work. | Live false-positive `status: steered`; immediate activity writes on child `input`. | Activity evidence cannot distinguish the submitted reply in a deterministic test. |
| D04 | Lifecycle | Suppress auto-exit while `ctx.hasPendingMessages()` is true. | Pi can still classify the session as streaming after its last queue read, so `awaitingAnswer` alone is insufficient. | Pi 0.85.1 extension lifecycle and agent-loop source; runtime-control event ordering. | The deterministic settling test shows Pi already guarantees a later queue drain. |
| D05 | Recovery | Keep termination operator-controlled, but make missing-pane detection converge watcher state. | An unconfirmed message has ambiguous delivery state, so automatic kill or replay risks loss or duplicate execution. The current poller otherwise ignores a vanished pane forever. | Current live wedge, `pollForExit`, watcher cleanup, and the same-name resume path. | The transport gains a correlation-safe end-to-end acknowledgment protocol. |

## Work breakdown

- [x] T01: Implement safe live text submission and bounded waiting-child acknowledgment.
  - Depends on: none
  - Scope: `pi-extension/subagents/tmux.ts`, the running-message path in `pi-extension/subagents/index.ts`, and focused helpers only.
  - Acceptance: a 4,283-byte multiline reply reaches a waiting child exactly once without wedging either PTY; waiting-child results distinguish confirmed from unconfirmed delivery; active and Claude paths use accurate submitted wording.
  - Verification: focused unit tests plus the real tmux no-model large-paste test.

- [x] T02: Close the settling-window reply loss.
  - Depends on: none
  - Scope: `pi-extension/subagents/subagent-runtime-control.ts` and its focused lifecycle tests.
  - Acceptance: a queued reply present at `agent_end` prevents shutdown, is processed in the continuation, and normal auto-exit occurs only after the reply turn completes.
  - Verification: deterministic event-order regression tests in `test/test.ts`.

- [x] T03: Add end-to-end regression and recovery coverage.
  - Depends on: T01, T02
  - Scope: `test/integration/tmux-surface.test.ts`, existing integration harness/fixtures where needed, and user-facing documentation.
  - Acceptance: no-model tests cover multi-kilobyte UTF-8 input, bracketed-paste framing, exact single submission, responsive follow-up input, cleanup after failure, timeout behavior, and watcher cleanup after an externally removed pane. README troubleshooting explains explicit stale-child recovery and does not promise automatic replay.
  - Verification: unit suite, tmux-only integration suite, package dry run, and optional approved lifecycle test.

- [x] T04: Synchronize durable architecture guidance after verification.
  - Depends on: T01, T02, T03
  - Scope: source-verified updates to `wiki/architecture.md`, `wiki/development.md`, and `wiki/conventions/runtime-safety.md` only.
  - Acceptance: the wiki describes bracketed live transport, acknowledgment limits, pending-message auto-exit protection, and the explicit recovery boundary without recording transient incident content.
  - Verification: link/path checks, fenced-code balance where applicable, and `git diff --check`.

## Acceptance criteria

- A reproduced 4,283-byte UTF-8 reply sent to an already waiting Pi child is recorded exactly once, advances child activity, and leaves the pane responsive to another short input.
- The same test does not leave unread input filling the child PTY or block Pi in terminal output.
- A forced settling-window reply is not lost and cannot trigger shutdown before Pi drains the queued message.
- Waiting-child delivery returns confirmed status only after observable child progress. Timeout returns an explicit unconfirmed status and performs no resend or kill.
- Running active Pi and Claude steering still works with accurate acknowledgment wording, and finished Pi resume remains unchanged.
- Named tmux buffers are unique and removed after success and every tested failure.
- External termination of a wedged child or pane ends its watcher, removes the running entry, reports interruption, and leaves the registered session resumable by the same name.
- Existing unit tests, tmux surface tests, and package-content checks pass with no new dependency.

## Testing decisions and seams

- Expose or inject the tmux command runner narrowly enough to test `load-buffer` stdin use, command order, unique buffer names, Enter-after-paste, and cleanup without mocking unrelated orchestration.
- Extend the real tmux surface suite with a no-model raw-input fixture that requests bracketed paste, records payload length/hash and submission count, and accepts a second short probe. Use the retained 4,283-byte size plus UTF-8 characters.
- Extend runtime-control tests so `ctx.hasPendingMessages()` is explicit in each `agent_end` case, including a deterministic late-steer case.
- Test acknowledgment with valid, stale, wrong-child, malformed, advancing, and timeout activity snapshots. Do not infer success from tmux exit status alone.
- Add focused polling coverage for transient capture failure versus a confirmed missing pane, including watcher cleanup and same-name resume eligibility.
- Keep model-consuming lifecycle verification behind explicit approval. The no-model tmux and event-order tests are the required automated gate.

## Verification plan

- `npm test`
- `node --test test/integration/tmux-surface.test.ts`
- `npm pack --dry-run --json`
- `git diff --check`
- Manual, no-model check in the current tmux environment with the Kiro shell-integration wrapper: submit the controlled 4,283-byte payload and a short follow-up, then verify exact single input, activity advance, pane responsiveness, zero stuck PTY input, and no blocked Pi write. Repeat while bypassing that wrapper to determine whether it is required for reproduction.
- Optional only after explicit approval: `node --test --test-concurrency=1 test/integration/subagent-lifecycle.test.ts`

## Risks and blockers

- Bracketed paste support is application-negotiated. Verify Pi and the supported Claude path; report an unsupported target instead of silently falling back to the raw large-key path.
- tmux buffers are server-global. Use unpredictable names, load content through stdin, and delete buffers promptly to prevent collision or retained sensitive text.
- A short acknowledgment timeout can produce false negatives on a loaded host. Treat timeout as ambiguous, never as proof of failure, and never auto-resend.
- The current frozen process cannot be repaired retroactively by installing the fix. Preserve its session and terminate the stale child explicitly after evidence collection. With current code, terminate the child process so its launch shell can emit the completion sentinel; killing only the pane may leave the parent watcher polling forever.
- The settling race is source-proven but separate from the observed idle-waiting deadlock. Keep tests and reporting distinct so one fix does not mask the other.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete.
- [x] Verification complete.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read this plan and its item.yaml completely, plus applicable repository instructions.
Implement the smallest coherent change that satisfies the Requirements and Acceptance criteria at medium assurance.
Preserve the transport, lifecycle, acknowledgment, recovery, sandbox, and non-goal decisions.
Update Progress and the Decision Log only when verified implementation evidence changes the approach.
Run all required no-model verification. Stop for approval before the model-consuming lifecycle suite, dependencies, destructive operations, external writes, commits, pushes, or scope expansion.
Record only verified evidence, failures, skipped checks, and residual uncertainty.
```

## Proposed durable knowledge updates

After implementation and verification, update the routed wiki pages to replace the current unacknowledged raw-live-message description with the verified transport and acknowledgment contract. Do not copy private session content or transient incident details into the wiki.

## Notes

External references:

- [tmux manual: send-keys, load-buffer, and paste-buffer](https://man.openbsd.org/tmux.1)
- [tmux issue 1682: PTY limits for long input](https://github.com/tmux/tmux/issues/1682)
