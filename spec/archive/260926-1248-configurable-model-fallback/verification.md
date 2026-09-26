# Verification: Configurable model fallback

Work item: `260926-1248-configurable-model-fallback`
Date: 2026-09-26

## Environment

- Mode: direct.
- Assurance: medium - strict profile parsing, AGY/Pi launch paths, terminal exhaustion evidence, sequential orchestration, registry ownership, native resume, rendering, documentation, and flat compatibility changed together.
- Starting Git boundary: `e17cdfea679016e1b1ffbe6c6d6ba7f03d9af451`.
- Runtime: Node `v26.8.2`, npm `11.19.1`, uv `0.11.24`, tmux `3.6b`.
- No dependency, lockfile, global profile, provider setting, credential, external dotfile, model-consuming provider call, staging, commit, push, deployment, or Dream action was performed.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| `env -u PI_SUBAGENT_ALLOWED npm test` | Pass | 252 tests passed, 0 failed. Covers flat behavior plus chain parsing, target extension resolution, preparation, structured provider evidence, classifier boundaries, sequential controller outcomes, strict state/registry behavior, failed-chain resume refusal, runtime controls, widget, and result presentation. |
| `npm pack --dry-run --json` plus package assertions | Pass | 20 files; runtime source and user docs included, including `pi-extension/subagents/model-chain.ts`; `spec/`, `wiki/`, tests, repository instructions, and `agent-examples/` excluded. |
| Controlled detached `node --test test/integration/tmux-surface.test.ts` | Pass | 9 tests passed, 0 failed; pane creation, delivery, focus, long commands, bracketed paste, interruption, concurrent surfaces, and cleanup passed without model calls. |
| Changed Markdown link/fence/plain-text checks | Pass | Relative paths resolved, fences balanced, no NUL/CR bytes, and `agent-examples/scout.md` parsed as a three-target chain. |
| Targeted stale-claim searches | Pass | Flat-only model override and AGY-only migration claims were qualified; chain field ownership, resume, risk, and extension boundaries are documented. |
| `git diff --check` | Pass | No whitespace errors. |
| `uv run spec/scripts/manage-spec-item.py --root . validate --item "260926-1248-configurable-model-fallback"` | Pass | Selected item valid. |
| `uv run spec/scripts/manage-spec-item.py --root . validate --operational` | Pass | 12 items valid, zero warnings. |
| Unrelated-boundary hash/mode/index check | Pass | Item `260926-1351-add-trusted-agy-any-read-profiles` retained the supplied two SHA-256 hashes and mode `0600`; its active index row remained present and unchanged. |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R1-R11: additive canonical schema, strict shared/target fields, target extension resolution, complete preparation, executable preflight, and runtime override rules | `pi-extension/subagents/agents.ts`, preparation and preflight in `pi-extension/subagents/index.ts`, parser/package/preparation/listing regressions in `test/test.ts` | Pass |
| R12-R17: sequential fresh attempts, exact task/body replay, monotonic fallback, structured terminal evidence, stop rules, and bounded provenance | `pi-extension/subagents/model-chain.ts`, `pi-extension/subagents/agy.ts`, provider-error extraction in `pi-extension/subagents/session.ts`, controller/watch integration in `pi-extension/subagents/index.ts`, focused classifier/controller tests | Pass |
| R18-R21: strict logical registry state, native winner replacement, failed-attempt non-resume, and native-only continuation | Atomic chain sidecar and strict validators in `model-chain.ts`, tagged registry union in `session.ts`, winner/failed-chain routing in `index.ts`, registry and public-message regressions | Pass |
| R22-R24: one logical widget row, no intermediate parent delivery, and chain-only structured result metadata | Chain target widget metadata, suppressed chain status/question steers, result presentation/details in `index.ts`, rendering/runtime-control regressions | Pass |
| R25: schema, lifecycle, risk, extension, provenance, resume, and exact scout/reviewer documentation | `README.md`, `docs/agent-definitions.md`, `agent-examples/scout.md`, and updated durable wiki pages | Pass |
| R26: focused regression and compatibility coverage | 252-test safe suite, 9-test tmux surface suite, package assertions, and unchanged flat Pi/Claude/AGY regressions | Pass |

## Review findings

- Coherent-boundary Focused review: initial `BLOCK` with three blockers: mixed authentication/model exhaustion signals could advance, chain registry parsing dereferenced sidecars and could discard other entries, and a Pi provider error could be crowned successful when the sidecar error was absent. One non-blocking shutdown-abort ownership issue was also reported.
- Corrections: non-exhaustion categories are checked before selected exhaustion signals; AGY denied actions never become provider evidence; registry entries validate pointer shape while `subagent_message` validates the sidecar on use; success requires no `providerError`; every attempt owns the shared abort controller; regressions cover the corrected paths.
- Focused re-review retry 1: `PASS`, no blocking or non-blocking findings.
- Final Contract-quality review: `PASS`, complete Requirements 1-26 and repository standards coverage, no material findings.

## Failures and skipped checks

- One intermediate classifier test failed because a subscription/quota message returned the broader quota reason; matching precedence was corrected and the full suite passed afterward.
- Live model/provider exhaustion, switching, and winner-continuation tests were not run because they consume models and require separate explicit approval.
- No lint, formatter-check, non-emitting type-check, or CI command exists in this repository.

## Unverified areas

- Real provider wording, quota state, authentication availability, model availability, and live native continuation remain environment-dependent and unverified without the separately gated provider test.
- Bare 429 and resource-exhausted signals can represent temporary throttling; this is the plan's accepted fallback ambiguity.
- Trusted Pi target extensions retain their complete executable behavior and are not structurally read-only.
- Hard parent-process chain recovery remains out of scope; strict state preserves collision and non-resume safety rather than promising replay.
