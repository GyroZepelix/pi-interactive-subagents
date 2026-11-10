# Plan: Fix stale ctx crash in subagent result renderer

Work item: `261110-1508-fix-stale-ctx-crash-in-subagent-result-renderer`
Status: Planned
Created: 2026-11-10
Updated: 2026-11-10

Assurance: low - one source file, easily reversible, and it extends existing null-fallback patterns. The fix only removes or guards stale-context access; it does not change subagent spawn, persistence, or resume behavior.

## Goal

pi must not crash when a session is replaced or reloaded (`/new`, `/resume`, `/fork`, `/reload`) while the chat contains `subagent_result` messages or subagents are still running. No code from an old extension instance may read a session-bound `ctx` or `pi` getter after that instance's `session_shutdown`.

## Context

- Bug report: [stale ctx crash handoff](../../../wiki/raw/2026-11-10-stale-ctx-crash-in-subagent-result-renderer.md) (untrusted raw input; claims below were re-verified against source at `0ba4432` and pi 1.5.1).
- Crash site: `pi-extension/subagents/index.ts:3982`. The `subagent_result` renderer's `render()` evaluates `latestCtx?.modelRegistry` on every TUI frame. After `invalidate()`, every getter on an `ExtensionContext` throws (`runner.js` `createContext`). pi calls component `render()` without a try/catch, so the error becomes an uncaught exception.
- Introduced by `464d98e` ([archived spec](../../archive/261024-1924-use-model-registry-for-subagent-context-window-gauge/plan.md)).
- `session_shutdown` (`index.ts` ~2884) never clears `latestCtx` or `latestPi`.
- pi ordering (verified): `agent-session-runtime.js` `teardownCurrent()` emits `session_shutdown`, then runs `dispose()`, which calls `invalidate()`. `reload()` emits `session_shutdown` and then calls `invalidate()`. Each replacement loads a fresh module instance (`moduleCache: false`).
- `ModelRegistry` (`core/model-registry.js`) has no `assertActive`; only the ctx getter that returns it does.
- `pi.sendMessage` on the extension API calls `assertActive()` (`loader.js:311`).
- Second crash path (observed by the user on 2026-11-10: pi crashed on `/reload` while a subagent was running; matches the source analysis but has not been reproduced in a test): `session_shutdown` aborts running subagents. Their watchers then resolve with a "cancelled" result after invalidation. The `.then` handler calls `updateWidget()`, which reads the stale `latestCtx`, and then `pi.sendMessage`. Both throw. The `.catch` handler repeats both calls, so the rejection goes unhandled.

## Requirements

- R1: The `subagent_result` renderer must not read any `ExtensionContext` or `ExtensionAPI` getter inside `render()`.
- R2: The renderer resolves the context window through a module-level registry reference captured at `session_start` (`latestModelRegistry = ctx.modelRegistry`). Behavior is unchanged: registry `find`, then id match, then the static `contextWindowFor` table. Before any `session_start`, it falls back to the static table.
- R3: The first statements of the `session_shutdown` handler set `latestCtx = null`, set `latestPi = null`, and mark the module instance as shut down. The handler then runs the existing cleanup.
- R4: Every asynchronous `subagent_result` delivery (the 8 `pi.sendMessage` sites in watcher or chain `.then`/`.catch` callbacks, currently near lines 3092, 3122, 3206, 3234, 3637, 3662, 3859, 3880) goes through one helper. After shutdown the helper does nothing, and it catches any error thrown by a stale `pi`. Before shutdown, delivery is unchanged.
- R5: `updateWidget()` and the ask-question notification (`latestPi?.sendMessage`) do nothing after shutdown. Clearing the globals (R3) is enough for this.
- R6: Message content, `details` shape, and renderer output for live sessions are unchanged.

## Out of scope

- Storing `contextWindow` in message `details` (handoff option A3).
- Changes to pi core, such as wrapping `CustomMessageComponent.render`. Reporting that upstream is optional and up to the user.
- Re-delivering cancelled results to the replacement session. Child session files remain resumable as they are today.
- Refactoring other `pi.*` uses, or the `subagent_status` and `subagent_question` renderers (verified: they do not touch ctx or pi).

## Design

- Module state next to `latestCtx` (~line 712): `let latestModelRegistry: ContextWindowRegistry | null = null;` and `let sessionShutDown = false;`.
- `session_start`: set `latestCtx = ctx`. Set `latestModelRegistry` from `ctx.modelRegistry`, wrapped in try/catch with a fallback to `null`. Set `sessionShutDown = false`.
- Renderer line 3982 becomes `resolveContextWindow(stats.model, stats.provider, latestModelRegistry)`.
- `session_shutdown` sets `sessionShutDown = true; latestCtx = null; latestPi = null;` before the existing interval and abort cleanup. Do not clear `latestModelRegistry`: the raw registry stays valid, so old components keep accurate gauges until the chat is rebuilt.
- Add a helper such as `deliverSubagentMessage(pi, message, options)`. It returns early when `sessionShutDown` is set and otherwise calls `pi.sendMessage` inside try/catch. Replace the 8 delivery calls. Leave the `updateWidget()` calls before them as they are, since R3 already makes them safe.
- Expose whatever is needed for unit tests through the existing `__test__` export, for example the delivery helper.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D1 | Renderer | Capture the raw `ModelRegistry` at `session_start` instead of reading `latestCtx.modelRegistry` in `render()` or wrapping that read in try/catch (handoff A2). | Removes the hazard instead of catching it. The registry object never asserts that the session is active, so gauges stay accurate during replacement. | `runner.js` `get modelRegistry`; `model-registry.js` has no `assertActive` | pi starts invalidating the registry object itself |
| D2 | Shutdown | Clear `latestCtx` and `latestPi` first in `session_shutdown` (handoff A1). | pi runs shutdown handlers before `invalidate()` on every replacement path. | `agent-session-runtime.js` `teardownCurrent`; `agent-session.js` `reload` | pi changes the shutdown/invalidate order |
| D3 | Delivery | Gate async result delivery on a per-instance shutdown flag plus a try/catch helper. | Watchers aborted by shutdown resolve after invalidation and would otherwise cause an unhandled rejection. | `loader.js:311`; `index.ts` watcher `.then`/`.catch` | Results should be re-delivered to the replacement session |
| D4 | Scope | Reject handoff A3 (store `contextWindow` in `details`). | Requires changing 8 creation sites and the persisted data shape, and old sessions would still need the fallback. | 8 `customType: "subagent_result"` sites | Gauges must be identical across pi versions or registries |

## Work breakdown

- [x] T01: Remove ctx access from the renderer and guard post-shutdown paths.
  - Depends on: none
  - Scope: R1-R6 in `pi-extension/subagents/index.ts`.
  - Expected areas: module state (~712), `session_start`/`session_shutdown` handlers (~2871-2900), the 8 delivery sites, renderer (~3982), `__test__` export.
  - Acceptance: `rg -n "latestCtx" pi-extension/subagents/index.ts` shows no use inside any `registerMessageRenderer` body. Tests from T02 pass.
  - Verification: `npm test`.
- [x] T02: Add focused regression tests in `test/test.ts`.
  - Depends on: T01
  - Scope: (a) Register the extension with a mock API that records handlers and renderers. Fire `session_start` with a ctx whose registry reports a known window, then make every ctx getter throw (or fire `session_shutdown`). Then `render(80)` on a `subagent_result` message with `contextTokens > 0` must not throw and must show the registry-based percentage. (b) Before any `session_start`, the gauge uses the static table. (c) After `session_shutdown`, the delivery helper does not call `sendMessage`, and a throwing `pi.sendMessage` before shutdown does not propagate.
  - Expected areas: `test/test.ts` (reuse `createMockExtensionApi` patterns or the handler-capturing mocks near lines 5013 and 5579).
  - Acceptance: the new tests fail at `HEAD` for (a) and pass after T01.
  - Verification: `npm test`.
- [x] T03: Update durable knowledge after verification.
  - Depends on: T01, T02
  - Scope: add a rule to `wiki/conventions/runtime-safety.md`: renderers and async callbacks must not read captured `ctx`/`pi` getters, capture plain objects at `session_start`, and clear session globals first in `session_shutdown`. Record the raw handoff as processed in `wiki/state.md` and `wiki/log.md` per `wiki/AGENTS.md`.
  - Expected areas: `wiki/conventions/runtime-safety.md`, `wiki/state.md`, `wiki/log.md`.
  - Acceptance: wiki pages describe the implemented behavior only; links resolve.
  - Verification: `git diff --check`; manual link check.

## Acceptance criteria

- No `ExtensionContext`/`ExtensionAPI` getter is reachable from `subagent_result` `render()`.
- The regression test with a throwing ctx renders without throwing and keeps the registry-based gauge.
- After `session_shutdown`, async result delivery, `updateWidget()`, and question notifications do nothing and never throw.
- `npm test` passes (from a child session, unset every `PI_SUBAGENT_*` variable first; see `wiki/development.md`).

## Verification plan

- `env -u PI_SUBAGENT_ALLOWED -u PI_SUBAGENT_BUILTIN_TOOLS npm test` (unset every other `PI_SUBAGENT_*` variable present as well).
- `npm pack --dry-run --json` to confirm package contents are unchanged in shape.
- `git diff --check`.
- Recommended manual check (it is the only check of the user-observed F8 path under real pi ordering; record it as skipped if not run): start `pi -ne -e ./pi-extension/subagents/index.ts` inside tmux, produce a `subagent_result` with `contextTokens > 0`, then run `/reload`, `/new`, `/resume`, `/fork`, and `/new` again while a subagent is running. Confirm pi does not crash and `~/.pi/agent/crashes.json` gets no new entry.

## Risks and blockers

- The second crash path (F8) was observed by the user (`/reload` with a running subagent) but has not been reproduced in a controlled run. The unit tests in T02(c) cover the delivery guard; the manual check below covers the real ordering.
- Unit tests cannot reproduce pi's real invalidation order. The optional manual check covers that.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete (T01-T03).
- [x] Verification recorded in `verification.md` (manual tmux check skipped).

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read spec/archive/261110-1508-fix-stale-ctx-crash-in-subagent-result-renderer/plan.md and item.yaml completely, plus AGENTS.md, spec/AGENTS.md, and wiki/AGENTS.md.
Implement T01-T03 with the smallest coherent change, preserving Requirements, Out of scope, and the Decision Log. Apply low assurance.
Run the Verification plan and record only verified evidence, failures, and skipped checks in verification.md.
Stop and ask before dependencies, destructive operations, external writes, commits, pushes, or scope expansion.
```

## Proposed durable knowledge updates

- `wiki/conventions/runtime-safety.md`: stale ctx/pi rule (T03), written only after implementation is verified.
