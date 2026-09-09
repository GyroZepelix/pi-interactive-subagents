# Repository Map

## Key paths

| Path | Responsibility |
| --- | --- |
| `pi-extension/subagents/index.ts` | Main Pi extension entry point, tool schemas, canonical profile selection, launch/resume orchestration, watchers, widgets, and message renderers. |
| `pi-extension/subagents/agents.ts` | YAML profile parsing, validation, diagnostics, trusted nearest-project discovery, global/project precedence, and canonical definitions. |
| `pi-extension/subagents/tmux.ts` | tmux availability, pane lifecycle, command delivery, screen capture, layout balancing, and completion polling. |
| `pi-extension/subagents/session.ts` | Session JSONL helpers, session seeding, persistent name registry, sandbox loadout sidecars, result extraction, and usage summaries. |
| `pi-extension/subagents/activity.ts` | Versioned activity snapshot schema, validation, and atomic recorder. |
| `pi-extension/subagents/status.ts` | Strict status config and the starting/active/waiting/stalled/running state machine. |
| `pi-extension/subagents/subagent-done.ts` | Child-side lifecycle hooks, tools widget, auto-exit decisions, activity events, and `ask_question`. |
| `pi-extension/subagents/tools/safe-bash.ts` | Optional Bash wrapper that rejects a fixed set of dangerous command patterns. |
| `pi-extension/subagents/plugin/` | Claude Code Stop hook used by `cli: claude` profiles to signal completion and expose the transcript path. |
| `test/test.ts` | Main source-coupled unit and regression suite. |
| `test/integration/` | Real tmux/Pi integration harness, current-contract fixtures, non-model surface tests, and model-consuming lifecycle tests that remain execution-gated. |
| `docs/agent-definitions.md` | Authoritative user reference for profile locations, fields, defaults, isolation, nesting, and resume behavior. |
| `agent-examples/` | Repository-only reference profiles preserved for future reuse; the extension does not discover them and the package allowlist excludes them. |
| `package.json` | Package metadata, Pi extension registration, distribution allowlist, dependencies, and test scripts. |
| `config.json.example` | Default status widget enablement when untracked `config.json` is absent. |

## Public extension surfaces

The main extension registers these parent-session interfaces (`pi-extension/subagents/index.ts`):

- `subagent`: requires `agent` and `task`; accepts an optional runtime display and addressing `name`, model override, and working directory.
- `subagent_message`: steers a running named agent or autonomously resumes its finished session.
- `subagents_list`: lists visible discovered profiles.
- `/subagent <agent> <task>`: converts a command into a spawn request.
- Renderers for subagent results, status transitions, and questions.

The child extension registers `ask_question` and `Ctrl+Alt+O` for the tools widget (`pi-extension/subagents/subagent-done.ts`).

## Common change locations

- Profile parsing, validation, diagnostics, trust, or precedence: start in `pi-extension/subagents/agents.ts`, then update `docs/agent-definitions.md` and focused tests.
- Tool contract, launch, resume, or TUI behavior: start in `pi-extension/subagents/index.ts`, then update focused helpers and `test/test.ts`.
- Pane behavior or shell delivery: `pi-extension/subagents/tmux.ts` and `test/integration/tmux-surface.test.ts`.
- Persistence or session compatibility: `pi-extension/subagents/session.ts` and its unit-test sections in `test/test.ts`.
- Activity/status behavior: `activity.ts`, `status.ts`, `subagent-done.ts`, and corresponding unit tests.
- Status configuration: `config.json.example` and `pi-extension/subagents/status.ts`.
