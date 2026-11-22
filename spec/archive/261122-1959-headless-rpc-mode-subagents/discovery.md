# Discovery: Headless RPC-mode subagents

Work item: `261122-1959-headless-rpc-mode-subagents`
Status: Ready for spec
Created: 2026-11-22
Updated: 2026-11-22
Assurance: medium (user confirmed 2026-11-22) - new launch surface crosses spawn, messaging, completion, and resume paths; stateful registry and resume compatibility; tmux regression cost is meaningful but local and reversible.

Source: [handoff.md](./handoff.md) from pi-voice-assistant (roadmap `261109-1834-a-y-a-roadmap`, register B16). `handoff.md` is unverified source material; the intake below governs.

## Objective

Let a parent Pi running without a tmux client (A.Y.A.: `pi --mode rpc` in Termux behind `aya-bridge`) spawn, steer, resume, and receive results from subagents with the same tool contract as the tmux path, without adding laptop-irrelevant weight.

## Desired outcome

Under `pi --mode rpc` without `$TMUX`, `subagent` launches a child and returns immediately, completion arrives as a steer message, `subagent_message` steers and resumes, and running state is visible through RPC-visible channels. tmux users see no behavior change.

## Repository and domain context

- Fact: the only surface layer is `pi-extension/subagents/tmux.ts`; `isMuxAvailable()` delegates to `isTmuxAvailable()` (`$TMUX` plus tmux binary). Spawn and resume are gated at `index.ts:3135` and `index.ts:3591`.
- Fact: `tmux.ts` exposes a narrow seam: `createSurface`/`createSurfaceSplit`, `sendCommand`, `submitText`, `sendLongCommand`, `readScreen`, `closeSurface`, pane-existence polling, `completionSuffix`.
- Fact: completion, status transitions, and questions are delivered with `pi.sendMessage(..., { triggerTurn: true, deliverAs: "steer" })`. `subagent_result` messages already carry structured `details` (name, agent, exitCode, elapsed, sessionFile, sessionId, errorMessage, interrupted, resumeSupported, stats) (`index.ts:3194-3216` and siblings).
- Fact: the running-children widget passes a TUI component factory to `ctx.ui.setWidget` (`index.ts:891`). Pi RPC ignores component factories and only forwards string-array widgets, so nothing is visible in RPC today (Pi `docs/rpc-extension-ui.md`, installed Pi 1.6.0; repo lockfile 1.1.0).
- Fact: Pi RPC supports fire-and-forget `notify`, `setStatus`, `setWidget` (string arrays); `ctx.mode === "rpc"` with `ctx.hasUI === true` (Pi `docs/rpc-extension-ui.md`).
- Fact: Pi `--mode json` runs one invocation and exits after its prompts; it accepts no stdin commands (Pi `docs/json.md`). Pi `--mode rpc` accepts `prompt`, `steer`, `follow_up`, and shuts down on stdin EOF (Pi `docs/rpc.md`).
- Fact (pi-voice-assistant): the bridge starts `pi --mode rpc` directly (`bridge/src/pi-rpc.ts`), stops it after `idleTimeoutMinutes` (default 30, `bridge/src/config.ts`), ties wake lock to status transitions (`bridge/src/conversation.ts:67`), and already consumes `setWidget` and `setStatus` (`bridge/src/conversation.ts:1107-1124`).
- External fact: Android 12+ phantom process killer trims app child processes above a system-wide default of 32 (XDA, termux-app issue #2366).
- Related backlog: B3 (background non-split launch mode, candidate `pi -p` or hidden tmux pane/session). User chose to keep B3 separate at intake, then asked whether combining makes sense; revisited in the current frontier.

## Handoff intake

Kinds were inferred (old-format handoff without Claims or Suggestions sections).

| Line | Kind | Check | User verdict |
| --- | --- | --- | --- |
| R1 | Requirement: headless launch surface, profiles stay source of truth | - | in scope |
| R2 | Requirement: same tool contract (immediate return, steer completion, concurrency, auto-exit/finalisation) | - | in scope |
| R3 | Requirement: `subagent_message` steer and resume headless | - | in scope |
| R4 | Requirement: status via RPC-visible channels plus parseable form | - | in scope |
| R5 | Requirement: discoverable child session file and log path | - | in scope |
| R6 | Requirement: explicit documented parent-exit behavior | - | in scope |
| R7 | Requirement: mobile constraints (concurrency cap, wake-lock hook, clean failure on kill, modest memory) | - | changed: generic opt-in only, see D3 |
| R8 | Requirement: same auth/settings/agent dir/trust, no credentials in args or logs | - | in scope |
| R9 | Requirement: no tmux regression | - | in scope |
| C1 | Claim: README says tmux-only | verified: `README.md:5` | - |
| C2 | Claim: tmux.ts sole surface; needs `$TMUX` plus binary | verified: `pi-extension/subagents/tmux.ts:47-53` | - |
| C3 | Claim: subagent cannot launch under A.Y.A. RPC | verified: `index.ts:3135`, `index.ts:3591`, pi-voice-assistant `bridge/src/pi-rpc.ts` | - |
| C4 | Claim: completion delivered as steer message | verified: `index.ts` `deliverAs: "steer"` | - |
| C5 | Claim: widget tracks running children | verified for TUI only; component factory is ignored in RPC (`index.ts:891`, Pi `docs/rpc-extension-ui.md`) | - |
| C6 | Claim: RPC supports setWidget text, setStatus, notify | verified: Pi `docs/rpc-extension-ui.md` | - |
| C7 | Claim: bridge idle-stops Pi; wake lock only during turns; Android may kill Termux processes | verified for bridge (`bridge/src/config.ts`, `conversation.ts:67`); Android killing unverifiable locally (external sources agree) | - |
| S1 | Suggestion: child as `pi --mode rpc` or `--mode json` | json contradicted for R3 (`docs/json.md`) | not adopted (D1) |
| S2 | Suggestion: steer through child RPC stdin | - | not adopted (D1) |
| S3 | Suggestion: structured status via setStatus JSON, custom entry, or tool-result details | - | adopted as D4 (setStatus JSON plus existing result details; no custom entry) |
| S4 | Suggestion: detached children plus inbox for next parent session | - | not adopted (D2) |
| S5 | Suggestion: parent keep-alive plus "children running?" query | - | adopted as D2 (host-driven; query is the D4 running signal) |
| S6 | Suggestion: host holds termux-wake-lock while children run | - | adopted as D3 (host-owned, extension supplies running count only) |
| Q1 | Open question: rpc vs json and steering mapping | - | resolved as D1 |
| Q2 | Open question: inbox vs keep-alive | - | resolved as D2 |
| Q3 | Open question: structured status format and versioning | - | resolved as D4 |
| Q4 | Open question: automatic vs explicit headless | - | resolved as D5 |
| Q5 | Open question: non-Pi harnesses headless | - | resolved by D1: every harness already runs inside a pane, so all use the detached surface |

## Scope

R1-R9 as recorded in the intake table, with R7 limited to generic opt-in behavior, plus former backlog B3 (per-profile opt-in non-split launch inside tmux, D7).

B3 original text (backlog, added 2026-11-18, session subagent-only capability registry planning): an opt-in profile flag that runs a subagent without splitting the current tmux window while keeping status, messaging, resume, and result delivery; candidates were a hidden or background tmux pane or session, or a `pi -p` process (`pi -p` cannot be steered, see Repository context).

## Out of scope

- A.Y.A.-specific UI and Android notifications (owned by A.Y.A.).
- Any Termux-specific code in the extension (user constraint at intake).
- Bridge changes, wake-lock handling, and Android notifications in pi-voice-assistant (separate A.Y.A. item).
- Post-crash result inbox or watcher re-adoption (D2).
- `pi --mode rpc` pipe children and `pi -p` children (D1).

## Constraints and invariants

- User decision: no feature may add Termux-specific behavior or dead weight to the laptop tmux setup; new behavior must be generic and inert when unused.
- R9: tmux launch, messaging, completion, resume, and existing tests unchanged.
- RPC emissions (D4) are sent only when their content changes; RPC lines carry no per-second elapsed counter, so the 1 s widget interval cannot flood the RPC stream or keep waking the host.
- Fact: launch scripts already pass package-owned env explicitly (`PI_CODING_AGENT_DIR`, capability env, `PI_SUBAGENT_*`, `index.ts:2287-2306`); other environment (PATH, provider env keys) comes from the tmux server, as with today's split panes. The detached server is started from the parent's environment; credentials never enter argv or logs (R8).
- Existing runtime-safety invariants hold on any new surface: launch scripts via `shellEscape`/`sendLongCommand`, per-launch done files, no live text in argv, no automatic replay, confirmed-loss before releasing running entries.

## Confirmed decisions

| ID | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- |
| - | Title "Headless RPC-mode subagents" | User choice at intake | intake round 1 | - |
| - | All of R1-R9 in scope; R7 generic only | User choice at intake | intake round 1 | - |
| D3 | Optional `maxConcurrent` in `config.json`; unset means unlimited (current behavior); a spawn over the cap fails with a clear error; no queue. Wake lock stays host-owned, driven by the R4 running count; no Termux code in the extension. Clean failure on kill reuses existing exit-code and pane-loss paths. | Inert on laptop; guards invisible fan-out against Android phantom-process trimming | round 2 | A queue or per-profile caps are requested |
| D1 | Headless surface is a private detached tmux server (`tmux -L <socket> new-session -d`), reusing the `tmux.ts` seam, launch scripts, done files, paste steering, question envelope, activity, and resume. Requires the tmux binary but no `$TMUX`. | Smallest change; about 5.7 MB extra RSS; per-message progress plus status strip is enough for A.Y.A.; all harnesses (Pi, Claude, AGY, model chain) ride the same surface | round 3 | Live token-level child streaming in A.Y.A. becomes a requirement |
| D7 | Merge backlog B3: a per-profile opt-in field routes a child to the detached server even inside an attached tmux session (no split). Includes profile validation, `docs/agent-definitions.md`, the shipped profile skill, and tmux-path tests. B3 removed from `spec/backlog.md`. | Same surface as D1; small marginal cost | round 4 | - |
| D2 | Parent exit: the host (A.Y.A. bridge) keeps the parent alive while the running count is above zero; children are never killed by the extension on parent exit. Each child pane is tagged with its session path; after a parent restart, `subagent_message` to a name whose tagged pane is still live steers that pane instead of resuming (never a second process on the same session file). Orphan results stay in their session files and are not delivered automatically. Applies to both split and detached surfaces. | Closes the existing double-process corruption hole (`index.ts:3797-3804`) without new persisted state | round 5 | Post-crash completion notifications become a requirement (then re-adopt) |
| D4 | Only when `ctx.mode === "rpc"`, the parent extension's own code (no model tools) emits: a plain string-lines `setWidget("subagent-status")`; a `setStatus("subagents")` whose text is versioned compact JSON (`{"v":1,"running":[{name, agent, state, sessionFile?}]}`) used by the host for the running count, wake lock, idle-stop, and transcript paths; and `notify` on child finish or failure. Existing `subagent_result` message `details` are documented as the completion contract. TUI behavior unchanged. | Existing widget is a TUI component factory that RPC drops; D2 and D3 need a reliable machine-readable running signal | round 6 | Bridge needs fields beyond v1 (bump `v`) |
| D5 | Headless activates automatically when `$TMUX` is unset; attached tmux sessions keep today's split behavior | No A.Y.A. config needed; laptop tmux path unchanged | round 2 | A user needs headless inside tmux (see D7) |

## Open questions and prerequisites

All consequential branches are resolved. Remaining planning-level details (non-blocking, owner: To Spec): private socket naming (recommend one fixed per-user socket so `tmux -L <socket> attach` shows all children), per-child session vs window layout in the detached server, the B3 profile field name, and the exact tag mechanism for D2 (tmux pane user option).

Resolved branch evidence:

- D2 Parent exit (R6). Facts: `session_shutdown` aborts watchers and clears `runningSubagents` but never kills panes (`index.ts:2981-3003`), so children already outlive the parent; results are then not delivered. The name registry is written at launch (`index.ts:3277-3292`), and the A.Y.A. bridge reopens the same session file on restart (`bridge/src/conversation.ts:318-324`). Risk: after a parent restart, `subagent_message` to a still-running orphan takes the resume path and can start a second process on the same session file (in-process reservations do not survive restart).
- D4 Structured status (R4): reuse `subagent_result` details plus RPC-only text widget and status key.
- D2 risk detail: the only resume-while-running guard compares against the in-memory `runningSubagents` map (`index.ts:3797-3804`, whose comment states two processes on one `.jsonl` corrupt it); steering also matches only that map (`index.ts:3594-3599`). After a parent restart the map is empty, so a live orphan's name falls through to resume.

D1 evidence gathered in round 2 follow-up:

- Fact: a fresh private tmux server (`tmux -L <s> -f /dev/null new-session -d`) with one pane and a full 2000-line scrollback measured about 5.7 MB RSS on macOS (2026-11-22). Each child Pi Node process dominates memory in either option.
- Fact: A.Y.A. talks only to the parent Pi in both options; neither exposes child output to A.Y.A. automatically. Both need the same R4 (RPC widget/status from the parent) and R5 (session and log paths) work.
- Fact: Pi RPC `prompt`, `steer`, and `follow_up` pass through extension input handlers (`disposition: "handled"`, Pi `docs/rpc-commands.md`), so the private `ask_question` envelope can travel over an RPC child stdin.
- Inference: observability differs only in grain. Detached tmux offers activity snapshots (current event or tool), incremental session JSONL (completed messages), and screen capture. RPC pipes additionally offer a live structured event stream (text deltas, tool start/end) that the extension could tee to a per-child events log for A.Y.A. to tail.

## Current frontier

Round 2 answered 2026-11-22: assurance medium, D3, D5 confirmed. D1 reopened as a discussion (RAM and phone observability); D7 deferred until D1.

Round 3 answered 2026-11-22: D1 detached tmux.

Round 4 answered 2026-11-22: D7 merge. Round 5 answered: D2 keep-alive plus steering guard. Round 6 answered: D4 text box, JSON running signal, and notify (after clarifying these are extension-code emissions, not model tools).

Frontier empty. Shared-understanding synthesis confirmed by the user 2026-11-22.

## Proposed test seams and acceptance evidence

- Unit (`test/test.ts`): surface selection (no `$TMUX` -> detached; profile opt-in inside tmux -> detached; default inside tmux -> split; no tmux binary -> existing error with updated hint); socket-qualified tmux argv; RPC-only emission gating and change-only behavior; `subagents` status JSON v1 shape; `maxConcurrent` unset vs over-cap rejection; D2 guard (live tagged pane -> steer, none -> resume); B3 profile field validation.
- Non-model integration (`test/integration/`): detached server create, paste-steer, capture, close, pane tag lookup, without `$TMUX`.
- Execution-gated end-to-end: `pi --mode rpc` parent under `env -u TMUX` spawns a cheap child, receives the `subagent_result` steer, sees `setWidget`/`setStatus`/`notify` records, steers and resumes; parent restart with a live child steers instead of double-launching.
- R9: existing unit and tmux surface tests pass unchanged.
- A.Y.A. consumption (bridge parsing, wake lock, Android notifications) is verified later in the A.Y.A. repository.

## Resume state

Next action: run `/skill:to-spec 261122-1959-headless-rpc-mode-subagents`.

## Readiness for To Spec

- [x] Every consequential branch is resolved or explicitly out of scope.
- [x] Facts are distinguished from user decisions and hypotheses.
- [x] Requirements, constraints, and non-goals are clear.
- [x] Acceptance evidence and proposed test seams are defined.
- [x] The user confirmed shared understanding.
