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

- Pi 1.0.0 or newer
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
builtin-tools: [read, grep, find, ls, codemode]
mcp-servers: [project-docs]
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

### Codemode and MCP server grants

Flat Pi profiles may list `codemode` in `builtin-tools` and exact configured server names in `mcp-servers`. Both fields accept comma-delimited strings or YAML string arrays. Missing or empty values grant nothing; wildcards and per-tool grants are not supported.

```yaml
builtin-tools: [read, grep, codemode]
mcp-servers: [project-docs, issue-tracker]
```

An MCP name grants the complete configured server while preserving Pi's `direct`, `codemode`, `deferred`, and `hidden` server/per-tool exposure and resource tools. The extension automatically loads `codemode` and `tool_search` support required by the selected exposures. Codemode can execute model-authored JavaScript and call its reachable tools, so grant it only when that authority is intended.

Server names resolve from the global Pi `mcp.json` and, only in a trusted active project, that project's `.pi/mcp.json`. A project entry replaces a same-named global entry, including when the replacement is invalid or disabled; a runtime child `cwd` override does not change this source decision. Malformed source files, missing or disabled selections, invalid selected entries, and selected namespace collisions exclude the profile before pane creation. Once identity passes, connection and sign-in failures use Pi's normal MCP diagnostics and do not create a package-specific terminal startup failure.

Restricted children keep `--no-extensions --no-builtin-tools` and never load ambient `builtin:mcp`. A protected controller re-reads only selected entries, verifies their source and semantic SHA-256 digest, and gives them to Pi's MCP runtime with ambient loading empty. Snapshots retain only ordered server name, canonical source path, scope, and digest--not config bodies, resolved environment values, headers, OAuth tokens, or provider credentials. Resume refuses changed, missing, disabled, invalid, or source-mismatched entries before pane creation and asks for a fresh spawn.

`mcp-servers` filters ambient file configuration, not explicitly selected `extensions`. A declared profile extension remains trusted arbitrary code and may register additional MCP servers or perform process/network I/O. The field is rejected on Claude, AGY, and `model-chain` profiles, even when empty.

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

The extension keeps the resolved child cwd as AGY's process workspace and generates a collision-resistant primary-agent definition under the parent Pi session's artifact directory. It passes that generated-agent root through `--add-dir` and, when the parent Pi cwd differs from the child cwd, passes the resolved parent cwd once as a second added workspace. No task text or referenced path can add another root. It does not write either repository, `~/.gemini`, AGY settings, authentication, plugins, or external profile dotfiles, and it never passes `--dangerously-skip-permissions`. Under AGY's default no-override policy, granted reads in these workspaces are prompt-free, but headless AGY soft-denies reads outside them (for example `/private/tmp` evidence, sibling repositories, or resolved skill symlinks). Explicit user permission rules can still deny workspace reads. Reported denials fail with bounded action, workspace-root, remedy, and stderr diagnostics.

#### AGY permission policy

To let read-only AGY subagents read files outside their workspaces, the operator configures AGY's documented fine-grained permission rules in `~/.gemini/antigravity-cli/settings.json`. AGY evaluates `Deny > Ask > Allow`, and these rules override workspace defaults. Merge the `permissions` block into the existing file and keep other keys such as `trustedWorkspaces`:

```json
{
  "permissions": {
    "allow": ["read_file(*)"],
    "deny": [
      "write_file(*)",
      "read_file(/Users/<you>/.ssh)",
      "read_file(/Users/<you>/.gemini/antigravity-cli/antigravity-oauth-token)",
      "read_file(/Users/<you>/.pi/agent/auth.json)",
      "read_file(/Users/<you>/.codex/auth.json)",
      "read_file(/Users/<you>/.docker/config.json)",
      "read_file(/Users/<you>/Library/Keychains)"
    ]
  }
}
```

- `read_file(*)` allows reads anywhere. `write_file(*)` denies every file write, including inside workspaces, so a read-only child can never write. Commands, MCP, and web stay at AGY's headless soft-denied Ask default.
- The deny list names secret files and directories by absolute real path. Extend it with any other credential locations on the machine. A read deny also denies writes to that path.
- The policy is global. It also applies to interactive AGY use on the machine, which loses file editing while `write_file(*)` is denied.
- Path globs are unsupported, so secrets inside readable repositories (for example `.env` files) remain readable. Keep them out of reach or deny them by exact path.
- On AGY 1.4.7, matches of these explicit deny rules (writes and secret reads) are returned to the model as tool errors and are not listed in `denied_actions`, so they do not fail the run by themselves. Only headless soft-denials (for example, reads outside the workspaces without the allow rule) appear in `denied_actions` and fail the run.

The extension never writes this file. Before each AGY launch or resume it only reads it and checks that `permissions.allow` contains `read_file(*)` and `permissions.deny` contains `write_file(*)`. When the file is missing, unreadable, invalid, or incomplete, the launch or resume acknowledgment gains one `Warning: AGY permission policy not satisfied ...` line naming the missing rule; the launch still proceeds. Pi and Claude launches are unaffected. Without the policy, stage evidence inside an AGY workspace root instead.

### Model fallback chains

A read-oriented profile may declare an ordered `model-chain` instead of one top-level harness/model. The extension validates every target and package extension before creating the first pane, then runs one fresh autonomous attempt at a time. Only a terminal provider exhaustion signal advances the chain; success or any authentication, configuration, permission, tool, malformed-output, cancellation, interruption, pane-loss, or unknown failure stops it.

Use this exact shape for `scout`, retaining its existing Markdown body:

```yaml
name: scout
description: Fast read-only codebase reconnaissance with exact paths and evidence
builtin-tools: [read, grep, find, ls]
model-chain:
  - cli: agy
    model: gemini-3.8-flash
    thinking: medium
  - cli: pi
    model: cursor/gemini-3.8-flash
    thinking: medium
    extensions:
      - package: git:github.com/GyroZepelix/pi-cursor-provider
        paths: [index.ts]
    session-mode: standalone
    system-prompt: append
  - cli: pi
    model: openai-codex/gpt-5.6-luna
    thinking: medium
    session-mode: standalone
    system-prompt: append
```

`flash-reviewer` uses the same three targets with `thinking: high`, its own description, and its existing Markdown body. These are migration examples only—the package does not edit user profiles, settings, credentials, or provider packages.

Chain targets support only `cli: agy` and `cli: pi`. Shared built-ins are limited to `read`, `grep`, `find`, and `ls`; skills and nested spawning are forbidden. AGY targets own `model` and optional `thinking`. Pi targets may also own `extensions`, `session-mode`, and `system-prompt`. A target extension remains a complete trusted executable grant, not a provider-only sandbox.

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
| `model` | No | Non-empty model override for a flat profile; rejected when the profile declares `model-chain` |
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
- A successfully completed AGY child resumes asynchronously by its exact persisted conversation ID and immutable launch-time capability snapshot, including the exact additional workspace list. Existing version 1 snapshots replay their original boundary without acquiring the current parent cwd. Missing, malformed, mismatched, unavailable, or concurrently claimed state fails before pane creation.
- Pi resume replays a strictly validated launch-time capability snapshot. It does not reread the profile or package settings.
- New version 2 snapshots retain selected built-ins, ordered canonical profile extension paths, MCP support state, and non-secret server references. Resume uses current extension contents and revalidates each exact MCP source/digest before pane creation; missing, disabled, malformed, changed, source-mismatched, non-canonical, duplicated, or reserved state is refused with fresh-spawn guidance.
- Existing valid strict `toolAllowlist` snapshots remain resumable through their legacy `--tools` path and are not rewritten automatically.
- A finished `cli: claude` child cannot be resumed through `subagent_message`.
- During a model chain, the logical name points to strict non-resumable controller state. On success it is atomically replaced by the winning Pi session or AGY snapshot, and later `subagent_message` uses only that native resume path. Failed and all-exhausted chains cannot resume a failed attempt; start a new self-contained `subagent` invocation, which begins again at target one. A later native continuation never triggers automatic fallback.

### Ask the parent

Every flat or native-resumed Pi child receives `ask_question`, even when its profile has no ordinary tools. Chain attempts omit it so a fallback operation cannot emit an intermediate question instead of its single final result. In supported children, calling it atomically publishes a correlated question and keeps the tool pending, so no follow-up model request can occur while the answer is missing. The parent replies through `subagent_message`; the protected child input handler consumes that private answer without queueing a second user turn, returns it as the tool result, and the same agent run continues.

### Recover an unresponsive child

An unconfirmed live message is ambiguous: the child may already have accepted it. The extension never kills the pane or replays the message automatically.

If a child remains unresponsive, inspect its pane and session first. To recover explicitly, find the target child pane with `tmux list-panes -a -F '#{pane_id} #{pane_title} #{pane_current_command}'`, then terminate only that child process or pane (for example, `tmux kill-pane -t %42`). Do not terminate the parent Pi pane. The watcher reports the interruption and removes the stale running entry. Pi preserves its registered session for explicit same-name recovery; review it before replaying work. AGY advertises same-name recovery only when a valid earlier conversation snapshot is still replayable, so an interrupted initial AGY run is not resumable. Finished Claude sessions remain non-resumable.

## Security model

Profiles are parsed as YAML and validated before use. Unknown keys, conflicting aliases, invalid enum values, pseudo-booleans, malformed list values, and malformed YAML exclude the definition with a file-and-field diagnostic. Legacy profile `tools` is rejected with guidance to split Pi built-ins into `builtin-tools` and custom capabilities into package `extensions`.

Every new named Pi child launches with global extension discovery and initial built-ins disabled. Missing or empty `builtin-tools` grants no Pi built-ins. The accepted names are `read`, `write`, `edit`, `bash`, `powershell`, `grep`, `find`, `ls`, and `codemode`; `ask_question` remains available through the package's protected runtime control. `codemode` and `mcp-servers` require Pi 1.0 or newer and are supported only by flat Pi profiles.

`extensions` is an optional YAML array of package mappings. Each `package` must exactly match a source configured in Pi settings. Omit `paths` to select every enabled extension resource from that package in Pi's resolved order, or provide a non-empty array of exact package-relative resource paths. Absolute paths, `.` or `..` segments, duplicate packages or selectors, disabled resources, root escapes, missing files, and empty selections invalidate the profile. Package order and explicit selector order are preserved; canonical duplicate files keep their first occurrence.

Package lookup is read-only and never installs or updates packages, accesses the network, or writes settings. Global profiles use global package settings only. Profiles from the nearest trusted project prefer matching project package sources and may fall back to global sources. Untrusted project profiles and package settings are ignored. Resolution failures exclude the profile from listing and spawning before pane creation.

A declared extension is a grant to execute the complete trusted extension with the user's permissions. It is not a per-tool sandbox. The extension may register tools, hooks, commands, or providers and may change active tools dynamically. It may override built-in names; when custom tool names collide, the first declared extension wins.

Child extension order is protected runtime control first, optional spawning control second, required built-in codemode/tool-search support, protected filtered MCP control when granted, selected profile extensions in resolved order, and tool-free capability activation last. This keeps framework and selected ambient MCP names protected while preserving Pi-native exposure and activating selected built-ins and trusted extension tools before model requests. Nested spawning is granted only by a non-empty `subagent_agents` field, and `PI_SUBAGENT_ALLOWED` pins the child to those effective names. Listing spawning controls under `builtin-tools` is invalid.

Project-controlled prompts are read only when `ctx.isProjectTrusted()` is true. `builtin-tools` and `extensions` are Pi-only for `cli: claude` and make such a profile invalid, even when explicitly empty. For `cli: agy`, `builtin-tools` is the strict native-tool allowlist; Pi extensions and lifecycle fields are unsupported and explicitly rejected.

For `model-chain`, all flat target and lifecycle fields are rejected at the top level. The profile body, identity, cwd, and read built-ins are shared. Each target owns only its documented harness fields, and Pi extension selectors use the same exact read-only package resolution as flat profiles. Exhaustion matching accepts durable quota, usage-limit, subscription, billing, budget, and depleted-credit wording plus bare terminal 429 and `resource_exhausted` separator/case variants. Bare 429 and resource exhaustion may represent temporary throttling; choosing fallback on those signals intentionally accepts that ambiguity. Attempt provenance stores only target index/count, harness, model, elapsed time, outcome, and a fixed bounded reason—never task text or raw provider payloads.

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

Safe unit, non-model MCP lifecycle, and package checks:

```bash
npm test
node --test --test-concurrency=1 test/integration/mcp-capability.test.ts
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
