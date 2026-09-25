# pi-interactive-subagents

Async subagents for [Pi](https://github.com/earendil-works/pi), running in tmux panes. Spawn a configured agent, continue working in the parent session, and receive its result as a steer message when it finishes.

This fork is tmux-only.

## How it works

`subagent` returns immediately after launching a configured Pi, Claude Code, or Antigravity CLI (`agy`) harness in a tmux pane. A widget tracks running children, and completion wakes the parent with the result. Auto-exit Pi children finalize only after Pi settles automatic retries, recovery, and queued continuation. Independent tool calls can launch multiple children concurrently.

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

- Pi 0.87.0 (the verified target)
- tmux
- Antigravity CLI `agy` on `PATH` for profiles using `cli: agy` (verified with 1.2.11)

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
builtin-tools: [read, grep, find, ls]
extensions:
  - package: npm:@example/pi-web-tools
    paths: [index.ts]
session-mode: lineage-only
system-prompt: append
auto-exit: true
---

Inspect the requested area and report concise findings with file references.
```

See [Agent definitions](docs/agent-definitions.md) for the complete contract, including every field, validation, precedence, trust behavior, tool isolation, nested spawning, resume snapshots, and external-harness limitations.

### Antigravity profiles

`cli: agy` runs one direct primary AGY process in headless JSON mode. Its initial capability surface is deliberately limited to `read`, `grep`, `find`, and `ls`, translated respectively to `view_file`, `grep_search`, `find_by_name`, and `list_dir`. Omitted or empty `builtin-tools` grants no AGY native tools.

```markdown
---
name: agy-scout
description: Read-only Antigravity scout
cli: agy
model: gemini-3.8-flash
thinking: medium
builtin-tools: [read, grep, find, ls]
---

Inspect the requested code and report evidence without changing files.
```

The extension generates a collision-resistant primary-agent definition under the parent Pi session's artifact directory and exposes only that dedicated workspace through `--add-dir`. It does not write the target repository, `~/.gemini`, AGY settings, authentication, plugins, or external profile dotfiles. It never passes `--dangerously-skip-permissions`. Under AGY's default no-override policy, granted reads inside the active workspace are prompt-free; explicit user permission rules can still deny them.

To migrate existing `scout` and `flash-reviewer` profiles, replace only their frontmatter with the corresponding form below and retain each existing Markdown body unchanged:

```yaml
# scout
name: scout
description: Read-only codebase scout
cli: agy
model: gemini-3.8-flash
thinking: medium
builtin-tools: [read, grep, find, ls]
```

```yaml
# flash-reviewer
name: flash-reviewer
description: Read-only focused reviewer
cli: agy
model: gemini-3.8-flash
thinking: high
builtin-tools: [read, grep, find, ls]
```

Remove the Pi provider `extensions`, `skill`/`skills`, `subagent_agents`, `system-prompt`, `session-mode`, `auto-exit`, and `interactive` fields; AGY rejects them rather than ignoring them. These are migration examples only—the package does not edit user dotfiles.

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

- A running Pi or Claude child receives the message through a temporary tmux buffer and application-negotiated bracketed paste; the normalized message is not placed in a shell command or tmux argument.
- A running AGY child rejects active messages without writing to its pane. Wait for the one-shot run to finish.
- When a Pi child has a pending `ask_question`, the answer is wrapped in a private correlated envelope and delivered through the same stdin-backed tmux path. Only the matching child acknowledgment reports delivery; a timeout remains unconfirmed and never resends. Other waiting Pi messages retain activity-based confirmation, while active Pi and Claude paths report submission.
- A finished Pi child resumes asynchronously and later reports another result.
- A successfully completed AGY child resumes asynchronously by its exact persisted conversation ID and immutable launch-time capability snapshot. Missing, malformed, mismatched, unavailable, or concurrently claimed state fails before pane creation.
- Pi resume replays a strictly validated launch-time capability snapshot. It does not reread the profile or package settings.
- New snapshots retain selected built-ins and ordered canonical profile extension paths. Resume uses the current contents at those paths and is refused before pane creation if required state or files are missing, malformed, non-canonical, duplicated, or reserved.
- Existing valid strict `toolAllowlist` snapshots remain resumable through their legacy `--tools` path and are not rewritten automatically.
- A finished `cli: claude` child cannot be resumed through `subagent_message`.

### Ask the parent

Every Pi child receives `ask_question`, even when its profile has no ordinary tools. Calling it atomically publishes a correlated question and keeps the tool pending, so no follow-up model request can occur while the answer is missing. The parent replies through `subagent_message`; the protected child input handler consumes that private answer without queueing a second user turn, returns it as the tool result, and the same agent run continues.

### Recover an unresponsive child

An unconfirmed live message is ambiguous: the child may already have accepted it. The extension never kills the pane or replays the message automatically.

If a child remains unresponsive, inspect its pane and session first. To recover explicitly, find the target child pane with `tmux list-panes -a -F '#{pane_id} #{pane_title} #{pane_current_command}'`, then terminate only that child process or pane (for example, `tmux kill-pane -t %42`). Do not terminate the parent Pi pane. The watcher reports the interruption and removes the stale running entry. Pi preserves its registered session for explicit same-name recovery; review it before replaying work. AGY advertises same-name recovery only when a valid earlier conversation snapshot is still replayable, so an interrupted initial AGY run is not resumable. Finished Claude sessions remain non-resumable.

## Security model

Profiles are parsed as YAML and validated before use. Unknown keys, conflicting aliases, invalid enum values, pseudo-booleans, malformed list values, and malformed YAML exclude the definition with a file-and-field diagnostic. Legacy profile `tools` is rejected with guidance to split Pi built-ins into `builtin-tools` and custom capabilities into package `extensions`.

Every new named Pi child launches with global extension discovery and initial built-ins disabled. Missing or empty `builtin-tools` grants no Pi built-ins. The only accepted names are `read`, `write`, `edit`, `bash`, `powershell`, `grep`, `find`, and `ls`; `ask_question` remains available through the package's protected runtime control.

`extensions` is an optional YAML array of package mappings. Each `package` must exactly match a source configured in Pi settings. Omit `paths` to select every enabled extension resource from that package in Pi's resolved order, or provide a non-empty array of exact package-relative resource paths. Absolute paths, `.` or `..` segments, duplicate packages or selectors, disabled resources, root escapes, missing files, and empty selections invalidate the profile. Package order and explicit selector order are preserved; canonical duplicate files keep their first occurrence.

Package lookup is read-only and never installs or updates packages, accesses the network, or writes settings. Global profiles use global package settings only. Profiles from the nearest trusted project prefer matching project package sources and may fall back to global sources. Untrusted project profiles and package settings are ignored. Resolution failures exclude the profile from listing and spawning before pane creation.

A declared extension is a grant to execute the complete trusted extension with the user's permissions. It is not a per-tool sandbox. The extension may register tools, hooks, commands, or providers and may change active tools dynamically. It may override built-in names; when custom tool names collide, the first declared extension wins.

Child extension order is protected runtime control first, optional spawning control second, selected profile extensions in resolved order, and tool-free capability activation last. This keeps framework tool names protected while activating selected built-ins and extension tools before model requests. Nested spawning is granted only by a non-empty `subagent_agents` field, and `PI_SUBAGENT_ALLOWED` pins the child to those effective names. Listing spawning controls under `builtin-tools` is invalid.

Project-controlled prompts are read only when `ctx.isProjectTrusted()` is true. `builtin-tools` and `extensions` are Pi-only for `cli: claude` and make such a profile invalid, even when explicitly empty. For `cli: agy`, `builtin-tools` is the strict native-tool allowlist; Pi extensions and lifecycle fields are unsupported and explicitly rejected.

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
