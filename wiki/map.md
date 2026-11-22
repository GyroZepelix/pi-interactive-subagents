# Repository Map

## Key paths

| Path | Responsibility |
| --- | --- |
| `pi-extension/subagents/index.ts` | Main Pi extension entry point, tool schemas, canonical profile selection, launch/resume orchestration, watchers, widgets, and message renderers. |
| `pi-extension/subagents/agents.ts` | YAML profile parsing, harness-specific validation, diagnostics, trusted nearest-project discovery, package/MCP capability resolution, global/project precedence, and canonical definitions. |
| `pi-extension/subagents/mcp-config.ts` | Read-only global/trusted-project MCP discovery, selected-entry validation, semantic normalization/digesting, non-secret canonical references, and replay identity verification. |
| `pi-extension/subagents/agy.ts` | Pure AGY read-tool translation, generated primary-agent serialization, command construction, strict JSON result parsing, structured terminal provider evidence, and exact resume-state persistence/validation. |
| `pi-extension/subagents/model-chain.ts` | Pure exhaustion classification, bounded attempt provenance, sequential injected controller, and strict atomic chain-sidecar persistence/validation. |
| `pi-extension/subagents/tmux.ts` | tmux availability, split and detached (`-L pi-subagents`) pane lifecycle, socket-qualified handle routing through an injectable transport, pane tags and live-pane lookup, command delivery, screen capture, layout balancing, and completion polling. |
| `pi-extension/subagents/session.ts` | Session JSONL helpers, session seeding, persistent name registry, sandbox loadout sidecars, result extraction, and usage summaries. |
| `pi-extension/subagents/activity.ts` | Versioned activity snapshot schema, validation, and atomic recorder. |
| `pi-extension/subagents/status.ts` | Strict status config and the starting/active/waiting/stalled/running state machine. |
| `pi-extension/subagents/subagent-runtime-control.ts` | Child-side tools widget, auto-exit decisions, activity events, protected `ask_question`, and parent-question signaling. |
| `pi-extension/subagents/subagent-capability-activation.ts` | Child-only trailing lifecycle control that activates selected Pi built-ins, required MCP support, and declared extension tools without promoting indirect/hidden MCP tools. |
| `pi-extension/subagents/subagent-mcp-control.ts` | Protected child-only filtered MCP loader that verifies selected source/digests, reserves names, and invokes Pi's MCP runtime with ambient discovery empty. |
| `pi-extension/subagents/subagent-protocol.ts` | Shared private launch protocol constants used without importing child extension registration into the parent. |
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

The runtime control registers protected `ask_question` and `Ctrl+Alt+O` for the tools widget. The trailing capability control registers no tools and applies the resolved profile capability set (`pi-extension/subagents/subagent-runtime-control.ts`, `pi-extension/subagents/subagent-capability-activation.ts`).

## Common change locations

- Profile parsing, validation, diagnostics, trust, or precedence: start in `pi-extension/subagents/agents.ts`; for MCP source identity/digests also inspect `mcp-config.ts`, then update `docs/agent-definitions.md` and focused tests.
- Tool contract, launch, resume, or TUI behavior: start in `pi-extension/subagents/index.ts`, then update focused helpers and `test/test.ts`.
- Pane behavior or shell delivery: `pi-extension/subagents/tmux.ts` and `test/integration/tmux-surface.test.ts`.
- Persistence or session compatibility: `pi-extension/subagents/session.ts`, MCP identity checks in `mcp-config.ts`, and their unit-test sections in `test/test.ts`.
- Filtered MCP lifecycle or exposure behavior: `subagent-mcp-control.ts`, `subagent-capability-activation.ts`, and the non-model process fixture in `test/integration/mcp-capability.test.ts`.
- AGY capability, command, result, or snapshot behavior: `pi-extension/subagents/agy.ts`, routing in `index.ts`, and focused AGY tests in `test/test.ts`.
- Model-chain classification, sequencing, or chain state: `pi-extension/subagents/model-chain.ts`, profile contracts in `agents.ts`, orchestration/rendering in `index.ts`, registry ownership in `session.ts`, and focused tests in `test/test.ts`.
- Activity/status behavior: `activity.ts`, `status.ts`, `subagent-runtime-control.ts`, and corresponding unit tests.
- Status configuration: `config.json.example` and `pi-extension/subagents/status.ts`.
