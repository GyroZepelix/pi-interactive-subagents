# TypeScript Module Conventions

## Module shape

- The package uses ESM through `"type": "module"` (`package.json`).
- Local imports include the `.ts` extension throughout product and test code (`pi-extension/subagents/*.ts`, `test/*.ts`).
- Node standard-library imports use `node:` specifiers (`pi-extension/subagents/*.ts`, `test/*.ts`).
- Focused modules own tmux, sessions, activity, status, and child lifecycle; orchestration remains in `pi-extension/subagents/index.ts`.

## Extension pattern

Pi extension modules export a default registration function that receives `ExtensionAPI`. Runtime schemas use TypeBox, while renderers use Pi TUI components. Keep shared parent/child protocol data in registration-free modules so importing a constant does not activate child behavior (`pi-extension/subagents/index.ts`, `pi-extension/subagents/subagent-runtime-control.ts`, `pi-extension/subagents/subagent-capability-activation.ts`, `pi-extension/subagents/subagent-protocol.ts`).

## Test seams

Implementation modules expose focused named functions, types, and explicit test-hook objects such as `__test__` and `__pollForExitTest__`. `__tmuxTransportTest__.set(runner)` replaces the tmux process runner, so argv can be asserted without a server; restore it with `set(null)`. `__test__` setters (`setLatestCtxForTest`, `setOrphanPaneOpsForTest`, `setLaunchCapForTest`) inject RPC context, orphan lookup, and the concurrency cap; reset each one after the test. The unit suite imports these directly and uses mocked ExtensionAPI objects and temporary directories (`pi-extension/subagents/index.ts`, `pi-extension/subagents/tmux.ts`, `test/test.ts`).

- **Isolate lifecycle tests in a fresh extension instance** - `test/test.ts` imports `index.ts` once, so module-level session state (`latestCtx`, `latestPi`, shutdown flag, `runningSubagents`) is shared by every `default(api)` call. A test that fires `session_start` or `session_shutdown` should import a fresh instance with a unique query string (`new URL("../pi-extension/subagents/index.ts", import.meta.url)` plus `?<unique>`), which mirrors Pi's per-session `moduleCache: false`. Afterward, restore the process-global symbols that the import and shutdown touch: `pi-subagents/running-children-count`, and a non-aborted `pi-subagents/poll-abort-controller` (`test/test.ts` "stale session context safety").
- **Render `subagent_result` expanded in unit tests** - the collapsed view calls Pi's `keyHint`, which throws `Theme not initialized` outside the interactive TUI. Pass `{ expanded: true }` unless the test initializes Pi's theme (`pi-extension/subagents/index.ts`, `test/test.ts`).

No formatter, linter, TypeScript compiler configuration, or formal style gate is tracked. Preserve nearby formatting rather than inferring an unenforced global style.
