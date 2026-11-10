# Outcome: Fix stale ctx crash in subagent result renderer

Work item: `261110-1508-fix-stale-ctx-crash-in-subagent-result-renderer`
Disposition: completed
Date: 2026-11-10

## Delivered scope

- The `subagent_result` renderer resolves the context window through a module-level `latestModelRegistry` captured at `session_start`, instead of reading `latestCtx.modelRegistry` on every frame. The fallback to the static table still applies before `session_start` (R1, R2).
- `session_shutdown` first sets `sessionShutDown = true`, `latestCtx = null`, and `latestPi = null`, then runs the existing cleanup. As a result, `updateWidget()` and question notifications do nothing after shutdown (R3, R5).
- All 8 async `subagent_result` deliveries in watcher and chain callbacks go through `deliverSubagentMessage`. It skips delivery after shutdown and contains errors thrown by a stale API. Delivery in a live session is unchanged (R4, R6).
- Three regression tests are in `test/test.ts` (describe block "stale session context safety").
- The durable rule was added to `wiki/conventions/runtime-safety.md`.

## Deviations from plan

None.

## Verification summary

See `verification.md`.
- `npm test` passed (290 tests, 0 failed, every `PI_SUBAGENT_*` variable unset).
- The new renderer test fails at `HEAD` and passes after the fix.
- `npm pack --dry-run` shows the same 22 files, and `git diff --check` is clean.
- The independent completion review passed with 0 retries and no blockers.

## Retained, reverted, or transferred work

Everything was retained. No work was reverted or transferred.

## Residual risks

- The recommended manual tmux check (`/reload`, `/new`, `/resume`, `/fork` with a running subagent under real pi) was skipped. It needs an interactive pi session and a subagent that consumes a model. The user-observed F8 path is covered only by source inspection of pi 1.5.1 and by unit tests of the helper; it was not reproduced end-to-end.
- The fix depends on pi continuing to run `session_shutdown` handlers before `invalidate()` (Decision D2). If pi changes that order, revisit.

## Follow-up work items

- Optional, not added to the backlog: route question notifications (`latestPi?.sendMessage` in `deliverPendingQuestion`) through the guarded delivery helper as well. This came from a non-blocking review suggestion.

## Source references

- `pi-extension/subagents/index.ts`
- `test/test.ts`
- `wiki/raw/2026-11-10-stale-ctx-crash-in-subagent-result-renderer.md` (untrusted bug report)
- pi 1.5.1: `core/agent-session-runtime.js`, `core/agent-session.js`, `core/extensions/runner.js`, `core/extensions/loader.js`

## Wiki updates

- `wiki/conventions/runtime-safety.md`: new section "Session replacement and stale context".
- `wiki/index.md`: the runtime-safety description now mentions stale session context.
- `wiki/state.md`: processed-input row for the raw bug handoff.
- `wiki/log.md`: update entry for this change.
