# Plan: Use model registry for subagent context window gauge

Work item: `261024-1924-use-model-registry-for-subagent-context-window-gauge`
Status: Planned
Created: 2026-10-24
Updated: 2026-10-24

Assurance: low - display-only gauge in a single renderer, fully reversible, existing pure-function test seams.

## Goal

The `subagent_result` context gauge shows the model's real context window. A `claude-opus-5-5` subagent with ~282k context tokens shows `28.2%/1.0M` (dim), not `141.0%/200k` (red).

## Context

- `contextWindowFor` (`pi-extension/subagents/index.ts`, ~line 386) maps any id containing `claude` to `200_000`. It was inherited from upstream commit `c47a653`.
- The `subagent_result` renderer (~line 3910) calls `contextWindowFor(stats.model)`. All 8 `subagent_result` send sites share this renderer.
- The renderer signature `(message, options, theme)` has no `ctx`, but the module-level `latestCtx` (set on `session_start`, ~line 669/2805) exposes `modelRegistry` with `find(provider, modelId)` and `getAll()`. `Model.contextWindow` is a number.
- pi's bundled registry lists `anthropic/claude-opus-5-5` with `contextWindow: 1000000`.
- Subagent session JSONL records the provider on `model_change` entries (`provider`, `modelId`) and assistant messages (`provider`, `model`). `summarizeSessionStats` (`pi-extension/subagents/session.ts`, ~line 847) keeps only the model id.

## Requirements

- Add optional `provider?: string | null` to `SessionStats`. `summarizeSessionStats` captures it from the same entries that set `model`, using the same precedence (per-message overrides `model_change`).
- Add a pure resolver, e.g. `resolveContextWindow(model, provider, registry)`, where `registry` is optional and has a minimal `find`/`getAll` shape:
  1. If `provider` and `model` are present, use `registry.find(provider, model)?.contextWindow`.
  2. Otherwise, or if that misses, use the first `registry.getAll()` entry whose `id === model`.
  3. Otherwise, use the existing `contextWindowFor(model)`.
  4. Ignore non-positive or non-finite windows and errors thrown by the registry, then continue to the next step.
- The renderer calls the resolver with `stats.model`, `stats.provider`, and `latestCtx?.modelRegistry`. It uses the result for both the label and the warning/error color thresholds.
- Expose the resolver through the existing test API object alongside `contextWindowFor`.

## Out of scope

- Changing the static `contextWindowFor` table or its existing test.
- Persisting the window into result details or `SessionStats`.
- Stats for the Claude Code harness (it produces no `stats`) and provider detection for AGY stats (no provider, so it uses the id-only path).
- Beta-flag-aware windows (e.g. a 1M window gated by a request header). The registry value is treated as truth.

## Design

Resolve at render time using `latestCtx`. This keeps one change point, adds no new persisted fields, and corrects older results in history when they re-render. If no context or registry is available (tests, render before `session_start`), the resolver falls back to today's behavior.

## Work breakdown

- [x] T01: Registry-backed context window in the result gauge
  - Depends on: none
  - Scope: `SessionStats.provider` capture, the resolver, the renderer call site, test API export, unit tests.
  - Expected areas: `pi-extension/subagents/session.ts`, `pi-extension/subagents/index.ts`, `test/test.ts`
  - Acceptance: see Acceptance criteria.
  - Verification: `npm test`

## Acceptance criteria

- `summarizeSessionStats` returns `provider` from `model_change` and from assistant messages, with per-message precedence. It returns `null` when the session records no provider.
- With a fake registry, the resolver returns:
  - the `find(provider, model)` window when the provider is known;
  - the id-matched `getAll()` window when the provider is missing or `find` misses;
  - `contextWindowFor(model)` when the registry is absent or has no match;
  - `undefined` for unknown models with no registry.
- The renderer uses the resolver. A manual or unit check of `claude-opus-5-5` with provider `anthropic` against the real registry shape yields a `/1.0M` label.
- The existing `contextWindowFor` and `formatContextUsage` tests pass unchanged.

## Verification plan

- `npm test`
- Optional manual check: run a short Opus subagent and confirm the completion line shows `x%/1.0M`.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete (T01).
- [x] Verification passed; see `verification.md`.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read spec/active/261024-1924-use-model-registry-for-subagent-context-window-gauge/plan.md and its item.yaml completely.
Implement the work step by step while preserving Requirements, Out of scope, and Verification plan.
Assurance is low: focused unit tests plus npm test are sufficient.
Update Progress when done. Run npm test before reporting completion.
Stop and ask before dependencies, destructive operations, external writes, commits, pushes, or scope expansion.
```
