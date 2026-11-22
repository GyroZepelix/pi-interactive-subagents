# Plan: Headless RPC-mode subagents

Work item: `261122-1959-headless-rpc-mode-subagents`
Status: Planned
Created: 2026-11-22
Updated: 2026-11-22 (implementation)

## Goal

A parent Pi without an attached tmux client (A.Y.A.: `pi --mode rpc` in Termux behind `aya-bridge`) can spawn, steer, resume, and receive results from subagents through a private detached tmux server, with the same tool contract as today. A profile with `background: true` launches without splitting the window inside tmux. Laptop tmux behavior is unchanged by default.

Assurance: medium - a new launch surface crosses spawn, messaging, completion, and resume; stateful name-registry and resume compatibility; tmux regression cost is meaningful but local and reversible.

## Context

- Handoff intake: `discovery.md`. `handoff.md` is unverified source material and does not override this plan.
- Discovery dossier: [discovery.md](./discovery.md) (decisions D1-D7, evidence, intake table).
- Current source: `tmux.ts` is the only surface layer; every tmux call is a bare `tmux` invocation; `isMuxAvailable()` requires `$TMUX` plus the binary and gates spawn (`index.ts:3135`) and `subagent_message` (`index.ts:3591`). Steering and the resume-while-running guard only consult the in-memory `runningSubagents` map (`index.ts:3594-3599`, `index.ts:3797-3804`). The name registry is written at launch (`index.ts:3277-3292`). `session_shutdown` aborts watchers (`index.ts:2981-3003`); the aborted watcher's catch path in `watchSubagent` then called `closeSurface`, so child panes died with the parent (corrected in I2; the earlier claim that panes were never killed was wrong). The running widget is a TUI component factory (`index.ts:891`) that Pi RPC drops. `config.json` parsing lives in `status.ts` (`parseStatusConfig`) and accepts only `status.enabled`.
- Pi RPC forwards string-array `setWidget`, `setStatus`, and `notify`; `ctx.mode` is `"rpc"` there (Pi `docs/rpc-extension-ui.md`; `ExtensionContext.mode` exists in the locked Pi 1.1.0 types).
- Local tmux is 3.8; pane user options (`set-option -p`) need tmux 3.0 or newer.

## Requirements

- R1 Headless launch: when `$TMUX` is unset and the tmux binary exists, `subagent` launches the child in a private detached tmux server; profile files remain the source of truth (D1, D5).
- R2 Same contract on the detached surface: immediate return, completion as a `subagent_result` steer message, concurrent children, unchanged auto-exit and finalization, `ask_question` round-trip, for Pi, Claude, AGY, and model-chain profiles.
- R3 `subagent_message` steers running detached children and resumes finished ones without `$TMUX`.
- R4 In `ctx.mode === "rpc"` only, the extension emits a string-lines widget, a versioned JSON `subagents` status, and a completion `notify` (D4).
- R5 Each running child's session file path (when the harness has one) is exposed in the R4 status and in existing `subagent_result` details.
- R6 Parent exit never kills children; a live orphan is steered, never resumed into a second process (D2); this behavior is documented.
- R7 Optional `maxConcurrent` cap, inert when unset; no Termux-specific code (D3).
- R8 Children keep today's env and credential handling: package-owned env passed explicitly in the launch command, no credentials in argv or logs.
- R9 No regression for tmux users: split launch, argv, layout, messaging, completion, resume, and existing tests unchanged.
- R10 (B3) Profile field `background: true` sends a new spawn to the detached server even inside tmux (D7).

## Out of scope

- A.Y.A. bridge parsing, wake lock, idle-stop policy, UI, and Android notifications (separate A.Y.A. item).
- Post-crash result inbox or watcher re-adoption of orphans; orphan results are not delivered automatically.
- `pi --mode rpc` pipe children and `pi -p` / `--mode json` children.
- Termux-specific code (for example calling `termux-wake-lock`).
- Any change to the name-registry, loadout, AGY, or model-chain sidecar schemas.
- Remembering `background` across resume (G1: resumes inside tmux split).
- Counting orphans from an earlier parent process toward `maxConcurrent`.

## Design

- Socket and layout: one fixed per-user private socket `pi-subagents` (`tmux -L pi-subagents`). Each detached child gets its own detached session (`new-session -d -P -F '#{pane_id}'`, session name from the sanitized runtime name plus a short launch id). The server starts with the parent's environment and exits when its last session closes (tmux default).
- Surface handles: detached handles encode the socket (for example `pi-subagents:%3`); `tmux.ts` parses a handle into socket plus pane id and prefixes `-L <socket>` for every primitive (`sendCommand`, `submitText`, `sendLongCommand`, `readScreen`/`readScreenAsync`, `closeSurface`, `surfaceExists`, sentinel polling). Plain `%n` handles keep today's exact argv. Detached closes skip `select-layout` rebalancing.
- Availability: `isMuxAvailable()` is true when the tmux binary exists (attached `$TMUX` or detached). The unavailable hint names installing tmux. `requireTmux()` checks only what the handle needs.
- Surface selection: a single helper chooses `detached` for a new spawn when `$TMUX` is unset or the resolved profile has `background: true`, else `split`. Resumes choose `detached` only when `$TMUX` is unset (G1). All launch and resume sites (Pi, Claude, AGY, model-chain attempts) use the helper.
- Nested children inside a detached child see `$TMUX`/`$TMUX_PANE` for the private server and keep using split there; no special case.
- Pane tag (D2): after creating any child pane (split or detached), set pane option `@pi_subagent_session` to the canonical session path (Pi/Claude session file, AGY state file). `findLiveTaggedPane(path)` lists panes with that option on the current server (when `$TMUX` is set) and on the private socket (when it exists); transport failure returns unknown, never "absent".
- Orphan steering (D2): in `subagent_message`, after the in-memory steer check and before any resume, resolve the registry entry; if a live tagged pane exists, submit the message to that pane via `submitText` and report `submitted` with a note that the result will not be delivered to this parent automatically. An unknown lookup refuses the resume with a retry message rather than risking a second process.
- RPC status (D4): when `latestCtx.mode === "rpc"`, `updateWidget` emits `setWidget("subagent-status", string[])` (no per-second elapsed text) and `setStatus("subagents", JSON.stringify({ v: 1, running: [{ name, agent, state, sessionFile? }] }))`, each only when its serialized content changes; both are cleared when no child runs. TUI keeps the existing component factory. `deliverSubagentMessage` calls `ctx.ui.notify` in RPC mode for each `subagent_result` (`info` on success, `error` on failure or interruption), after the shutdown guard.
- Concurrency cap (D3): `parseStatusConfig` (or a sibling parser in `status.ts`) accepts optional top-level `maxConcurrent` as a positive integer and rejects other values. Spawn and resume count running children plus in-flight launches of this parent; over the cap they return an error result before any pane is created. Steering is not capped.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D1 | Surface | Private detached tmux server, reusing the `tmux.ts` seam and all transport | Smallest change; about 5.7 MB RSS; covers every harness | discovery D1 | Live token-level child streaming becomes required |
| D2 | Parent exit | Never kill children; tag panes; steer a live orphan instead of resuming | Closes the in-memory-only guard hole (`index.ts:3797-3804`) without new persisted state | discovery D2 | Post-crash completion delivery becomes required |
| D3 | Cap | Optional `maxConcurrent`, unset means unlimited, reject over cap, no queue | Inert on laptop; bounds invisible fan-out | discovery D3 | Queueing or per-profile caps requested |
| D4 | RPC status | RPC-only string widget, `subagents` JSON status v1, completion notify | RPC drops the TUI widget; host needs a running signal | discovery D4 | Host needs fields beyond v1 |
| D5 | Activation | Detached automatically when `$TMUX` is unset | No A.Y.A. config needed | discovery D5 | - |
| D7 | B3 | Profile field `background: true` routes new spawns to the detached server inside tmux | Same surface; small marginal cost | discovery D7, To Spec G2 | - |
| G1 | Resume | Resumes inside tmux always split; `background` is spawn-only | User choice; no state needed | To Spec round 2026-11-22 | Users report unwanted resume splits |
| P1 | Socket | Fixed socket `pi-subagents`, one detached session per child | One attach point for all children; server self-exits when empty | To Spec planning | Cross-environment env staleness observed |
| I2 | Parent exit (source-truth correction for R6/D2) | An aborted watch (parent `session_shutdown` or extension reload) no longer closes the child pane; unexpected watcher errors still close it. Applies to split and detached surfaces. The Context claim that `session_shutdown` never killed panes was stale: the aborted watcher closed them. The user accepted the visible effect for tmux users: after quitting pi, child panes stay open (an auto-exit child's pane is left at a shell prompt). | R6/D2 require that children are never killed on parent exit; found by the approved E2E restart phase (run 1 failed, run 2 passed after the fix). No other contract change. | Gamemaster user decision 2026-11-22; E2E run 2; unit tests "parent exit keeps children running" | Users want automatic cleanup of finished orphan panes |
| I1 | Pane tag liveness (implementation detail of D2) | Besides `@pi_subagent_session`, tag each child pane with `@pi_subagent_done` (its per-launch completion file); `findLiveTaggedPane` counts a tagged pane as live only while that file is absent and the pane is not dead. A missing private server (`no server running` / `error connecting ... (No such file or directory or Connection refused)`) proves absence there; any other transport failure or tmux older than 3.0 is unknown. | After a parent restart nobody closes an orphan pane, so its shell outlives the child; without the completion check a finished orphan would look live and the message would be typed into a shell. No requirement, acceptance, or public behavior changes. | Implementation 2026-11-22; integration `tmux-surface [detached]` tag case | Completion files stop being written by every launch |

## Work breakdown

- [x] T01: Socket-qualified detached surface in `tmux.ts`
  - Depends on: none
  - Scope: handle encoding/parsing, detached creation, `-L` routing in every primitive, pane tagging, `findLiveTaggedPane`, availability and hint.
  - Expected areas: `pi-extension/subagents/tmux.ts`, `test/test.ts`, `test/integration/tmux-surface.test.ts`
  - Acceptance: split handles produce byte-identical argv; detached handles route every primitive to `-L pi-subagents`; tagged panes are found on both servers.
  - Verification: unit argv tests; integration under `env -u TMUX` creating, pasting into, capturing, tagging, finding, and closing a detached pane.
- [x] T02: Surface selection and `background` profile field
  - Depends on: T01
  - Scope: selection helper; use at every launch and resume site (Pi, Claude, AGY, chain); `background` optional boolean in profile parsing, validation, and diagnostics.
  - Expected areas: `pi-extension/subagents/index.ts`, `pi-extension/subagents/agents.ts`, `test/test.ts`
  - Acceptance: no `$TMUX` -> detached; `background: true` in tmux -> detached spawn, split resume; default in tmux -> split; invalid `background` values produce a profile diagnostic.
  - Verification: focused unit tests for selection and validation.
- [x] T03: Orphan steering guard
  - Depends on: T01, T02
  - Scope: tag lookup before resume in `subagent_message`; steer live orphan; refuse on unknown lookup.
  - Expected areas: `pi-extension/subagents/index.ts`, `test/test.ts`
  - Acceptance: live tagged pane -> `submitted` steer, no new launch; no tagged pane -> existing resume; lookup failure -> refusal, no launch.
  - Verification: unit tests with injected lookup; integration lookup from T01.
  - Review: focused review of T01-T03 (surface boundary) before T04.
- [x] T04: RPC status, widget, and notify
  - Depends on: none (independent of T01-T03)
  - Scope: RPC-mode `updateWidget` branch, change-only emission, clear on empty, notify in `deliverSubagentMessage`.
  - Expected areas: `pi-extension/subagents/index.ts`, possibly `pi-extension/subagents/status.ts`, `test/test.ts`
  - Acceptance: RPC ctx receives string lines and `{"v":1,...}` once per change and clears when idle; TUI ctx receives only the existing factory; notify fires once per result in RPC only.
  - Verification: unit tests with a fake ctx for `tui` and `rpc` modes.
- [x] T05: Optional `maxConcurrent`
  - Depends on: none
  - Scope: strict config parsing, cap check for spawn and resume before pane creation.
  - Expected areas: `pi-extension/subagents/status.ts`, `pi-extension/subagents/index.ts`, `test/test.ts`
  - Acceptance: unset -> unchanged behavior; positive integer -> over-cap spawn/resume error with no pane; invalid values -> config error naming the key; steering unaffected.
  - Verification: unit tests for parsing and the cap check.
- [x] T06: Documentation
  - Depends on: T01-T05
  - Scope: README (replace "tmux-only" with tmux plus detached headless mode, `tmux -L pi-subagents attach`, parent-exit behavior, RPC status contract including `subagent_result` details, `maxConcurrent`); `docs/agent-definitions.md` (`background`, resume splits); `skills/subagent-profiles/SKILL.md` (`background`).
  - Expected areas: `README.md`, `docs/agent-definitions.md`, `skills/subagent-profiles/SKILL.md`
  - Acceptance: docs match implemented behavior; no claim of Termux-specific support beyond requiring the tmux binary.
  - Verification: manual review; `git diff --check`.

## Acceptance criteria

- With `$TMUX` unset and tmux installed, `subagent` returns immediately, the child runs in `tmux -L pi-subagents`, its result arrives as a `subagent_result` steer message, `subagent_message` steers it while running and resumes it after it finishes, and a pending `ask_question` answer round-trips.
- With `$TMUX` unset and tmux missing, spawn and message return the unavailable error with the updated hint.
- Inside tmux, a default profile splits exactly as before; a `background: true` profile creates no split in the parent window; its later resume splits.
- After the parent restarts with a still-live child, `subagent_message` to that name submits to the existing pane and starts no second process on the session file.
- In RPC mode the stream contains `setWidget` string lines, `setStatus` key `subagents` with `{"v":1,"running":[...]}`, and one `notify` per completion; values are sent only on change and cleared when idle. In TUI mode none of these new records are emitted.
- With `maxConcurrent` unset behavior is unchanged; with it set, an over-cap spawn or resume fails before any pane is created.
- Existing unit tests and the tmux surface integration test pass unchanged apart from added cases.

## Verification plan

- `npm test`
- `node --test test/integration/tmux-surface.test.ts` in a controlled tmux session, including the new detached cases run under `env -u TMUX`.
- Execution-gated end-to-end (model-consuming, run with user approval): a `pi --mode rpc` parent under `env -u TMUX` spawns a cheap child, receives the `subagent_result`, observes `setWidget`/`setStatus`/`notify` records, steers, resumes, and after a parent restart steers a live child without a second launch. Record results in `verification.md`.
- `git diff --check`
- Review: focused review after T03; final contract-quality review over the whole change (medium tier).

## Risks and blockers

- Shared fixed socket keeps the environment of the parent that first started the server; package-owned env is always passed explicitly, so only ambient env (PATH, provider env keys) can be stale. Mitigation: documented; revisit P1 if observed.
- Pane tag lookup depends on tmux 3.0+; older tmux fails the lookup as unknown, which refuses resume instead of double-launching.
- Invisible detached children can be forgotten; mitigated by RPC status, the existing status steer messages, and `tmux -L pi-subagents attach`.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete (T01-T06), including the I2 correction.
- [x] Verification run: see [verification.md](./verification.md).

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read this plan and its item.yaml completely.
Implement the work step by step while preserving Requirements, Out of scope, Decision Log, and Verification plan.
Update Progress and the Decision Log when confirmed implementation discoveries change the approach.
Run the specified verification before reporting completion.
Stop and ask before dependencies, migrations, destructive operations, external writes, commits, pushes, or scope expansion.
```

## Proposed durable knowledge updates

After verification: update `wiki/architecture.md` (detached surface, socket-qualified handles, pane tags, RPC status), `wiki/conventions/runtime-safety.md` (orphan steering guard, never kill on parent exit), `wiki/map.md` (`tmux.ts` responsibilities, `background` field), and `wiki/overview.md` if it states tmux-only.
