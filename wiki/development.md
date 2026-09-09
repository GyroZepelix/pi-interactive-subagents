# Development

## Prerequisites and setup

- Runtime use requires Pi and tmux. Pi must run inside tmux, for example `tmux new -A -s pi 'pi'` (`README.md`, `pi-extension/subagents/tmux.ts`).
- The project is an ESM package and Pi loads `pi-extension/subagents/index.ts` through the `pi.extensions` manifest field (`package.json`).
- Unverified: the repository does not document a dependency-install or local package-linking command, and no Node engine is declared in `package.json`.

## Available verification commands

| Command | Evidence | Ingest status |
| --- | --- | --- |
| `npm test` | Runs `node --test test/test.ts` (`package.json`). | Not run. Tests are outside the allowed ingest checks. |
| `npm run test:integration` | Runs integration files serially (`package.json`). The harness creates tmux panes and temp files; lifecycle cases invoke real Pi sessions and LLM calls (`test/integration/harness.ts`, `test/integration/subagent-lifecycle.test.ts`). | Not run. It has filesystem, process, tmux, external-model, time, and cost side effects. |
| `node --test test/system-prompt-mode.test.ts` | Standalone smoke script exists but is not wired into `package.json` (`test/system-prompt-mode.test.ts`). | Not run. Tests are outside the allowed ingest checks. |

No lint, formatter-check, non-emitting type-check, or CI command is defined. `node_modules/` was absent during the ingest, so no eligible safe project check was available (`package.json`, tracked-file inventory, ingest environment).

## Test organization

- `test/test.ts` directly imports implementation modules and exercises session persistence, agent discovery, sandbox reconstruction, activity/status transitions, tool registration, steering, rendering, and tmux helpers using mocks and temporary directories.
- `test/integration/tmux-surface.test.ts` performs real pane creation, command delivery, focus, capture, and cleanup.
- `test/integration/subagent-lifecycle.test.ts` performs real Pi and model interactions and writes markers under `/tmp`.
- Test integration sessions force-load the working-tree extension with `pi -ne -e <path>` to avoid testing an installed package snapshot (`test/integration/harness.ts`).

## Change workflow

1. Read `README.md`, `package.json`, and the focused source module identified in [Repository Map](./map.md).
2. Preserve the public tool schemas and security invariants in `pi-extension/subagents/index.ts` unless the change intentionally updates them.
3. Add focused regression coverage to `test/test.ts`; update integration fixtures when an external lifecycle contract changes.
4. Run unit tests only when task scope permits. Run integration tests only inside tmux with explicit acceptance of model calls, time, cost, and temporary-file side effects.
5. Check runtime behavior against the source tree, because integration harness comments explicitly guard against an installed extension snapshot (`test/integration/harness.ts`).

## Needs review

- Synchronize `package-lock.json` package metadata with `package.json` before relying on release version data.
- Reconcile integration cases for removed `fork`, `systemPrompt`, and `caller_ping` interfaces with the current tool schema and `ask_question` flow (`test/integration/subagent-lifecycle.test.ts`, `test/integration/agents/test-ping.md`, `test/test.ts`).
- Unverified: there is no tracked CI, release, formatting, linting, or type-check policy.
