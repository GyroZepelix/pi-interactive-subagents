# TypeScript Module Conventions

## Module shape

- The package uses ESM through `"type": "module"` (`package.json`).
- Local imports include the `.ts` extension throughout product and test code (`pi-extension/subagents/*.ts`, `test/*.ts`).
- Node standard-library imports use `node:` specifiers (`pi-extension/subagents/*.ts`, `test/*.ts`).
- Focused modules own tmux, sessions, activity, status, and child lifecycle; orchestration remains in `pi-extension/subagents/index.ts`.

## Extension pattern

Pi extension modules export a default registration function that receives `ExtensionAPI`. Runtime schemas use TypeBox, while renderers use Pi TUI components. Keep shared parent/child protocol data in registration-free modules so importing a constant does not activate child behavior (`pi-extension/subagents/index.ts`, `pi-extension/subagents/subagent-runtime-control.ts`, `pi-extension/subagents/subagent-capability-activation.ts`, `pi-extension/subagents/subagent-protocol.ts`, `pi-extension/subagents/tools/safe-bash.ts`).

## Test seams

Implementation modules expose focused named functions, types, and explicit test-hook objects such as `__test__` and `__pollForExitTest__`. The unit suite imports these directly and uses mocked ExtensionAPI objects and temporary directories (`pi-extension/subagents/index.ts`, `pi-extension/subagents/tmux.ts`, `test/test.ts`).

No formatter, linter, TypeScript compiler configuration, or formal style gate is tracked. Preserve nearby formatting rather than inferring an unenforced global style.
