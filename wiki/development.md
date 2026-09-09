# Development

## Prerequisites and setup

- Runtime use targets Pi 0.85.1 and requires tmux. Pi must run inside tmux, for example `tmux new -A -s pi 'pi'` (`README.md`, `package.json`, `pi-extension/subagents/tmux.ts`).
- The project is an ESM package and Pi loads `pi-extension/subagents/index.ts` through the `pi.extensions` manifest field (`package.json`).
- Install locked development dependencies with `npm ci`. Dependency changes require lockfile regeneration and review (`README.md`, `package.json`, `package-lock.json`).

## Verification tiers

| Command | Scope | Side effects and gate |
| --- | --- | --- |
| `npm test` | Unit and source-level regression suite in `test/test.ts`. | Safe local check using temporary directories. |
| `npm pack --dry-run --json` | Published package contents. | Safe package inspection; no tarball is created. |
| `git diff --check` | Whitespace and patch integrity. | Safe local check. |
| `node --test test/integration/tmux-surface.test.ts` | Real tmux pane creation, delivery, focus, capture, and cleanup. | Requires tmux but does not invoke a model. Prefer a controlled detached tmux session when an active Pi TUI may compete for pane focus. |
| `node --test --test-concurrency=1 test/integration/subagent-lifecycle.test.ts` | Real Pi child lifecycle, profiles, and model behavior. | Model-consuming, time- and cost-bearing; requires explicit approval. |

No lint, formatter-check, non-emitting type-check, or CI command is defined.

## Test organization

- `test/test.ts` directly imports production modules and exercises session persistence, validated profile discovery, trust, precedence, canonical identity, fail-closed tools, activity/status transitions, tool registration, runtime names, steering, rendering, and tmux helpers.
- `test/integration/tmux-surface.test.ts` performs real pane operations without model calls.
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
- Stop/interrupt controls, acknowledged transport, shell-readiness redesign, broader configuration, orchestration modularization, and unrelated dead-code cleanup remain deferred.
