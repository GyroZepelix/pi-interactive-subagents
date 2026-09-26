# Development

## Prerequisites and setup

- Runtime use is verified against Pi 0.87.0 and requires tmux. Pi must run inside tmux, for example `tmux new -A -s pi 'pi'` (`README.md`, `package.json`, `package-lock.json`, `pi-extension/subagents/tmux.ts`).
- `cli: agy` additionally requires an authenticated compatible Antigravity CLI on `PATH`; the verified local baseline is 1.2.11 (`README.md`, `pi-extension/subagents/agy.ts`).
- The project is an ESM package and Pi loads `pi-extension/subagents/index.ts` through the `pi.extensions` manifest field (`package.json`).
- Install locked development dependencies with `npm ci`. Dependency changes require lockfile regeneration and review (`README.md`, `package.json`, `package-lock.json`).

## Verification tiers

| Command | Scope | Side effects and gate |
| --- | --- | --- |
| `npm test` | Unit and source-level regression suite in `test/test.ts`. | Safe local check using temporary directories. |
| `npm pack --dry-run --json` | Published package contents. | Safe package inspection; no tarball is created. |
| `git diff --check` | Whitespace and patch integrity. | Safe local check. |
| Temporary `agy --add-dir <agent-root> --add-dir <second-workspace> --agent <generated-name> -p /agents --output-format text` probe | Repeatable added-workspace parsing and generated custom-agent selection/discovery only. | Safe non-model check; use ephemeral roots outside the repository and remove them afterward. It does not prove model tool execution or cross-workspace reads. |
| `node --test test/integration/tmux-surface.test.ts` | Real tmux pane creation, delivery, focus, capture, and cleanup. | Requires tmux but does not invoke a model. Prefer a controlled detached tmux session when an active Pi TUI may compete for pane focus. |
| `node --test --test-concurrency=1 test/integration/subagent-lifecycle.test.ts` | Real Pi/AGY child lifecycle, profile tools, result delivery, and resume behavior when applicable. | Model-consuming, time- and cost-bearing; requires explicit approval. Do not infer prompt-free AGY tool execution or exact resume from unit/discovery checks alone. |

No lint, formatter-check, non-emitting type-check, or CI command is defined.

When running the top-level unit suite from inside a spawned subagent, unset `PI_SUBAGENT_ALLOWED` unless the test specifically targets nested allowlisting. A present value intentionally filters discovery and makes top-level profile and command expectations fail (`pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`, `spec/archive/260914-1641-fix-frozen-subagent-reply-delivery/verification.md`).

## Test organization

- `test/test.ts` directly imports production modules and exercises session persistence, validated profile discovery, trust, precedence, canonical identity, fail-closed tools, activity/status transitions, tool registration, runtime names, steering acknowledgment and timeout, settled auto-exit event sequences (including retry recovery, final error, abort, and outstanding-work guards), missing-pane recovery, rendering, and tmux helpers.
- `test/integration/tmux-surface.test.ts` performs real pane operations without model calls. Its bracketed-paste fixture records framing, byte length, hash, and submission count for a 4,283-byte UTF-8 payload, accepts a short follow-up, and verifies buffer cleanup; the suite also removes a disposable pane to exercise interruption detection (`test/integration/fixtures/bracketed-paste-recorder.mjs`).
- `test/integration/subagent-lifecycle.test.ts` performs real Pi and model interactions and writes markers under `/tmp`.
- Integration fixtures define `session-mode`, body and `system-prompt` behavior, and `ask_question`; they do not use removed public spawn overrides.
- Integration sessions force-load the working-tree extension with `pi -ne -e <path>` to avoid testing an installed package snapshot (`test/integration/harness.ts`).

## Package shape

`package.json` limits publication to runtime source, `docs/agent-definitions.md`, `README.md`, `LICENSE`, and `config.json.example`. Package dry-run output must exclude `spec/`, `wiki/`, tests, repository instructions, and repository-only `agent-examples/`.

## Change workflow

1. Read `README.md`, `docs/agent-definitions.md`, `package.json`, and the focused source module identified in [Repository Map](./map.md).
2. Preserve canonical discovery and runtime safety invariants unless the change intentionally updates their documented contract.
3. Add focused regression coverage to `test/test.ts`; update integration fixtures when an external lifecycle contract changes.
4. Run unit and package checks. Run tmux-only checks when tmux is available.
5. Run model-consuming lifecycle tests only with explicit approval for external calls, time, and cost.
6. Compare package dry-run contents with the allowlist before publishing.

## Current limitations

- There is no tracked CI, release automation, formatter, linter, or non-emitting type-check configuration.
- General stop/interrupt controls, correlation-safe acknowledgment for active Pi or Claude input, automatic replay, shell-readiness redesign, broader configuration, orchestration modularization, and unrelated dead-code cleanup remain deferred. Waiting Pi input has bounded activity-based confirmation, while ambiguous timeout recovery remains explicit and operator-controlled.
