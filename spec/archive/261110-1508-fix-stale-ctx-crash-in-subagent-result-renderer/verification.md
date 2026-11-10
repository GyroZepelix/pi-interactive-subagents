# Verification: Fix stale ctx crash in subagent result renderer

Work item: `261110-1508-fix-stale-ctx-crash-in-subagent-result-renderer`
Date: 2026-11-10

## Environment

- Mode: direct. Assurance: low (from `plan.md`): one source file, easily reversible, and it extends existing null-fallback patterns.
- Starting boundary: `HEAD` `0ba44325a227daa4b847c727fcc0250ab672ad20`, nothing staged. The `spec/index.md` row and the untracked `item.yaml` and `plan.md` already belonged to this item. The untracked `wiki/raw/*` files were left untouched.
- Node test runner with TypeScript type stripping. Pi internals were checked against the installed pi 1.5.1.
- Every `PI_SUBAGENT_*` variable was unset for test runs (see `wiki/development.md`).

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| `env -u <every PI_SUBAGENT_*> node --test --test-name-pattern="stale session context safety" test/test.ts` | Pass, 3/3 | New describe block in `test/test.ts` |
| Same new tests run against `HEAD` source in a temporary detached worktree | (a) fails with "This extension ctx is stale..."; (c) fails because the helper is absent; (b) passes (static fallback already existed) | Worktree removed afterward |
| `env -u <every PI_SUBAGENT_*> npm test` | Pass: 290 tests, 0 failed | Exit code 0 |
| `npm pack --dry-run --json` | 22 files, no new entries | Package file list unchanged in shape |
| `git diff --check` | Clean | - |
| `rg -n latestCtx pi-extension/subagents/index.ts` | No use inside any `registerMessageRenderer` body. Remaining uses are the declaration, `updateWidget`, `session_start`, and `session_shutdown` | - |
| ASCII check on added lines (`LC_ALL=C grep '[^ -~<tab>]'`) | No non-ASCII characters | - |
| Pi ordering (`core/agent-session-runtime.js` `teardownCurrent`; `core/agent-session.js` `reload`, `dispose`; `core/extensions/loader.js` `moduleCache: false`) | `session_shutdown` is emitted before `invalidate()` on every replacement path, and each replacement loads a fresh module | Source inspection, pi 1.5.1 |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R1 No ctx/pi getter in `subagent_result` `render()` | The renderer uses module-level `latestModelRegistry`; `rg` check; test (a) renders with a ctx whose getters all throw | Met |
| R2 Registry captured at `session_start`, static fallback | `session_start` captures `ctx.modelRegistry` inside try/catch; test (a) checks the registry gauge (`25.0%/1k`) after the ctx is stale and after shutdown; test (b) checks the static table before `session_start` (`0.1%/200k`) | Met |
| R3 Shutdown clears globals first | The first statements of `session_shutdown` are `sessionShutDown = true; latestCtx = null; latestPi = null;` | Met |
| R4 One delivery helper for the 8 async sites | `deliverSubagentMessage` is used at all 8 `subagent_result` sites; test (c) covers live delivery, a throwing API, and suppression after shutdown | Met |
| R5 Widget and question notification inert after shutdown | `updateWidget()` returns when `latestCtx` is null; `latestPi?.sendMessage` short-circuits when `latestPi` is null (R3) | Met (by source inspection) |
| R6 Live behavior unchanged | Message content, `details`, and options are passed through unchanged; full suite passes | Met |
| T03 Wiki | Changed `wiki/conventions/runtime-safety.md` (new section "Session replacement and stale context"), the `wiki/index.md` description, a `wiki/state.md` processed-input row, and a `wiki/log.md` entry | Met |

## Review findings

- Completion review (`stale-ctx-completion-review`, independent and read-only): PASS, 0 retries. No blocking findings.
  - Non-blocking: the reviewer suggested routing question delivery (`latestPi?.sendMessage`) through the guarded helper for parity. Not applied. The plan's R5 states that clearing the globals is enough, and changing it would expand scope.
- A second reviewer was launched by mistake with the task "noop" and was not given the review brief. It also returned PASS, but it is not counted as the gate.

## Failures and skipped checks

- No check failed.
- Skipped: the recommended manual tmux check (`/reload`, `/new`, `/resume`, `/fork` with a running subagent under real pi). Driving an interactive pi session safely and non-interactively was not possible, and producing a real `subagent_result` consumes a model. Under real pi ordering, the user-observed F8 path is covered only by source inspection of pi 1.5.1 and by the unit tests.
- No type-check is configured in the repository, so none was run.

## Unverified areas

- The F8 crash path (cancelled watchers resolving after invalidation) has not been reproduced end-to-end. The guard is unit-tested at the helper level only.
- The fix depends on pi continuing to run shutdown handlers before `invalidate()` (Decision D2).
