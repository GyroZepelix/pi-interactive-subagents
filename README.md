# pi-interactive-subagents

Async subagents for [Pi](https://github.com/earendil-works/pi), running in tmux panes. Spawn a configured agent, continue working in the parent session, and receive its result as a steer message when it finishes.

This fork is tmux-only.

## How it works

`subagent` returns immediately after launching a child Pi session in a tmux pane. A widget tracks running children, and completion wakes the parent with the result. Independent tool calls can launch multiple children concurrently.

```text
+ Subagents --------------------------- 2 running +
| 00:23  inspector    active, bash 7m              |
| 00:45  inspector-2  waiting 2m                   |
+--------------------------------------------------+
```

If shell startup is slow, increase the launch delay:

```bash
export PI_SUBAGENT_SHELL_READY_DELAY_MS=2500
```

The default is 500 milliseconds.

## Requirements

- Pi 0.85.1 (the verified target)
- tmux

## Installation

Pi packages execute code with your user permissions. Review the source, then install this fork from GitHub over SSH:

```bash
pi install git:git@github.com:GyroZepelix/pi-interactive-subagents.git
```

Start Pi inside tmux:

```bash
tmux new -A -s pi 'pi'
```

## Agent setup

This package ships no default agent definitions. Create profiles under either:

- `~/.pi/agent/agents/*.md`, or `$PI_CODING_AGENT_DIR/agents/*.md`
- the nearest trusted project `.pi/agents/*.md`

Project definitions override global definitions with the same effective name. Project profiles are ignored when the active Pi context is not trusted.

```markdown
---
name: inspector
description: Examines a codebase without changing it
model: openrouter/example-model
tools: [read, grep, find, ls]
session-mode: lineage-only
system-prompt: append
auto-exit: true
---

Inspect the requested area and report concise findings with file references.
```

See [Agent definitions](docs/agent-definitions.md) for the complete contract, including every field, validation, precedence, trust behavior, tool isolation, nested spawning, resume snapshots, and Claude CLI limitations.

## Tools

| Tool | Description |
| --- | --- |
| `subagent` | Launch a configured agent asynchronously in a tmux pane |
| `subagent_message` | Steer a running child or resume a finished child by runtime name |
| `subagents_list` | List valid visible global and trusted project profiles, plus diagnostics |
| `ask_question` | Child-only tool for asking the parent one question and waiting for its reply |

There is also a `/subagent <agent> <task>` command.

### Spawn

```typescript
subagent({ agent: "inspector", task: "Map the authentication flow" });
subagent({ agent: "implementer", name: "dark-mode", task: "Implement the toggle" });
```

| Parameter | Required | Behavior |
| --- | --- | --- |
| `agent` | Yes | Effective name of a valid permitted profile |
| `task` | Yes | Task sent to the child |
| `name` | No | Runtime display and addressing name. Omitted names are suffixed when needed; colliding explicit names are rejected |
| `model` | No | Non-empty model override for this launch; surrounding whitespace is trimmed |
| `cwd` | No | Non-empty working-directory override, trimmed and resolved from the active context when relative |

Spawn errors identify invalid profile files and explain where to create global or project profiles when none are available.

### Message and resume

```typescript
subagent_message({ name: "inspector", message: "Also check authorization middleware" });
```

Names are unique within one parent session and remain registered after a child finishes.

- A running Pi or Claude child receives the message in its live pane.
- A finished Pi child resumes asynchronously and later reports another result.
- Pi resume replays the launch-time sandbox snapshot.
- Pi resume is refused when the session file or sandbox snapshot is missing.
- A finished `cli: claude` child cannot be resumed through `subagent_message`.

### Ask the parent

Every Pi child receives `ask_question`, even when its profile has no ordinary tools. Calling it parks the child and notifies the parent. The parent replies through `subagent_message`, and the child continues with that reply as its next message.

## Security model

Profiles are parsed as YAML and validated before use. Unknown keys, conflicting aliases, invalid enum values, pseudo-booleans, malformed list values, and malformed YAML exclude the definition with a file-and-field diagnostic.

Every named Pi child launches with `--no-extensions` and an explicit `--tools` value. Missing or empty `tools` grants no ordinary tools. A requested custom tool must have a resolvable backing extension before any pane is created.

Nested spawning is granted only by a non-empty `subagent_agents` profile field. `PI_SUBAGENT_ALLOWED` pins the child to those effective agent names. Listing spawning tools directly under `tools` is invalid.

Project-controlled prompts are read only when `ctx.isProjectTrusted()` is true.

## Runtime names

When `name` is omitted, the profile name is used and collisions receive deterministic suffixes such as `inspector-2`. A caller-supplied name is trimmed and rejected if it is empty, already running, reserved by another launch, or present in the parent session registry.

## Role folders

A runtime `cwd` can start a child in a role-specific folder with its own context files and Pi configuration:

```typescript
subagent({ agent: "implementer", cwd: "agents/sre", task: "Review the deployment pipeline" });
```

A profile can also define a default `cwd`. See [Agent definitions](docs/agent-definitions.md#supported-fields) for relative-path semantics.

## Status configuration

Copy `config.json.example` to `config.json` beside the extension to configure status behavior. `config.json` is intentionally not distributed as mutable package state.

```json
{
  "status": { "enabled": true }
}
```

## Development and verification

Install the locked development dependencies after reviewing the dependency change:

```bash
npm ci
```

Safe unit and package checks:

```bash
npm test
npm pack --dry-run --json
git diff --check
```

The package dry run should contain runtime files, this README, `LICENSE`, `config.json.example`, and `docs/agent-definitions.md`. It should not contain `spec/`, `wiki/`, tests, or repository instructions.

The tmux-only surface test does not invoke a model. Run it in a controlled tmux session; an active Pi TUI can compete with its pane-focus assertions.

```bash
node --test test/integration/tmux-surface.test.ts
```

The lifecycle suite invokes configured models and may consume time and money. Run it only with explicit approval:

```bash
node --test --test-concurrency=1 test/integration/subagent-lifecycle.test.ts
```

## Upstream tracking

Keep upstream integration explicit and reviewable:

1. Add or fetch the upstream remote without changing the publishing remote.
2. Compare the desired upstream tag or commit.
3. Cherry-pick or port focused changes onto this fork.
4. Run unit, package, and tmux-only checks.
5. Run model-consuming lifecycle checks only when approved.
6. Record conflicts and intentionally deferred upstream behavior.

## Acknowledgements

Continues the work of [Amos Blomqvist's pi-interactive-subagents](https://github.com/amosblomqvist/pi-interactive-subagents).

## License

MIT
