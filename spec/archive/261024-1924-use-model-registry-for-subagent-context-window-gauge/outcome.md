# Outcome: Use model registry for subagent context window gauge

Work item: `261024-1924-use-model-registry-for-subagent-context-window-gauge`
Disposition: completed
Date: 2026-10-24

## Delivered scope

- `SessionStats.provider` (optional) captured by `summarizeSessionStats` from `model_change` and assistant messages, with per-message precedence and `null` when absent.
- Pure `resolveContextWindow(model, provider, registry)`: registry `find(provider, model)`, then the first `getAll()` id match, then `contextWindowFor(model)`. Invalid windows and registry errors fall through.
- The `subagent_result` renderer resolves the window via `latestCtx?.modelRegistry` and uses it for both the gauge label and the warning/error color thresholds.
- `resolveContextWindow` exposed through `__test__`, plus 9 unit tests.

## Deviations from plan

- None. The `/1.0M` acceptance check uses an inline fixture shaped like the real registry rather than reading `node_modules` (`pi-ai` is not a declared dependency). The bundled `anthropic/claude-opus-5-5` `contextWindow: 1000000` was confirmed manually.

## Verification summary

- `npm test` with the inherited `PI_*` env unset: 275/275 pass (HEAD baseline 266/266). With the inherited nested-subagent `PI_*` env, the same 6 discovery/command tests fail on both HEAD and the change (env leakage, pre-existing).
- Independent completion review: PASS, 0 retries. Details in `verification.md`.

## Retained, reverted, or transferred work

- All changes retained in `pi-extension/subagents/session.ts`, `pi-extension/subagents/index.ts`, `test/test.ts`. Uncommitted pending a user-controlled Git checkpoint.

## Residual risks

- No tsc in the repo, so `ModelRegistry` assignability to the minimal registry interface was checked by inspection.
- No live Opus subagent run; renderer wiring verified by reading and by unit tests of the pure helpers.

## Follow-up work items

- None.

## Source references

- `plan.md`, `verification.md` in this item.
- `node_modules/@earendil-works/pi-coding-agent/dist/core/model-registry.d.ts` (`find`, `getAll`).
- `node_modules/@earendil-works/pi-ai/dist/providers/data/anthropic.json` (`claude-opus-5-5` window).

## Wiki updates

- None.
