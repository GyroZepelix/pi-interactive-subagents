# Verification: Use model registry for subagent context window gauge

Work item: `261024-1924-use-model-registry-for-subagent-context-window-gauge`
Date: 2026-10-24

## Environment

- Worktree `pi-interactive-subagents-ctx-window`, branch `fix/context-window-registry`, starting HEAD `47aa069816a84004500cae19d7d14681aac1cf6b`.
- Mode: direct (T01). Assurance: low - display-only gauge in a single renderer, fully reversible, existing pure-function test seams.
- Node test runner with type stripping; `node_modules/` is an ignored local clone. No tsconfig or tsc in the repo.
- Changed paths: `pi-extension/subagents/session.ts`, `pi-extension/subagents/index.ts`, `test/test.ts`.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| `npm test` with inherited `PI_*` env unset | Pass, 275/275 | +9 new tests (3 provider capture, 6 resolver) |
| Baseline `npm test` on `git archive` export of HEAD with `PI_*` unset | Pass, 266/266 | Confirms no regression |
| `npm test` with inherited `PI_*` env (nested subagent session) | 6 discovery/command failures | Identical 6 failures at HEAD baseline; env leakage (`PI_SUBAGENT_ALLOWED` etc.), unrelated |
| Bundled registry data check | `anthropic/claude-opus-5-5` `contextWindow: 1000000` | `node_modules/@earendil-works/pi-ai/dist/providers/data/anthropic.json` (manual inspection) |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| `SessionStats.provider` captured from `model_change` and assistant messages, per-message precedence, `null` when absent | `summarizeSessionStats` tests: captures provider from model_change; prefers per-message provider; returns null provider | Met |
| Resolver: `find(provider, model)` window | `resolveContextWindow` test: uses find when provider known | Met |
| Resolver: first `getAll()` id match when provider missing or `find` misses | Test: falls back to first id match | Met |
| Resolver: `contextWindowFor` when registry absent or no valid match; non-positive windows ignored | Test: falls back to contextWindowFor | Met |
| Resolver: registry errors ignored, continue to next step | Test: ignores registry errors | Met |
| Resolver: `undefined` for unknown model with no registry | Test: returns undefined | Met |
| Renderer uses resolver for label and color thresholds via `latestCtx?.modelRegistry` | `index.ts` renderer call site; reviewer confirmed single `window` feeds both | Met |
| `claude-opus-5-5` + `anthropic` against real registry shape yields `/1.0M` | Test asserts `28.2%/1.0M` with inline fixture mirroring bundled entry | Met |
| Resolver exposed in `__test__` | `__test__.resolveContextWindow` | Met |
| Existing `contextWindowFor` and `formatContextUsage` tests unchanged and passing | Unmodified; pass | Met |

## Review findings

- Completion review (low assurance), worker reviewer: PASS. No blocking or non-blocking findings. Retries: 0.
- First dispatch to `flash-reviewer` (AGY) failed before review: headless mode auto-denied `read_file`. Re-dispatched to `worker`; not counted as a retry.

## Failures and skipped checks

- Inherited-env test failures noted above are pre-existing and environmental.
- Optional manual live Opus subagent check not run.

## Unverified areas

- No tsc in repo: structural assignability of `ModelRegistry` to the minimal `ContextWindowRegistry` interface checked by inspection only.
- Renderer wiring verified by reading, not by executing in a live UI.
- The unit test uses an inline fixture rather than the bundled registry file, since `pi-ai` is not a declared dependency.
