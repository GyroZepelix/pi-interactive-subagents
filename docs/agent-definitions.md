# Agent definitions

This extension ships no agent profiles. Create each available subagent as a Markdown file in a user or trusted project directory.

## Locations, trust, and precedence

| Scope | Location | Availability |
| --- | --- | --- |
| Global | `$PI_CODING_AGENT_DIR/agents/*.md`, or `~/.pi/agent/agents/*.md` when the variable is unset | Always considered |
| Project | The nearest `.pi/agents/*.md` found while walking from the active Pi context's working directory toward the filesystem root | Considered only when `ctx.isProjectTrusted()` is true |

Definitions are keyed by their effective `name`, not by filename. A project definition overrides a global definition with the same effective name. If that project definition is invalid, the global definition is not used as a fallback. This prevents a malformed restrictive override from silently exposing a more permissive profile.

`PI_SUBAGENT_ALLOWED` applies after discovery. A nested subagent sees only the valid definitions its parent granted through `subagent_agents`.

## File format

Every file must begin with YAML frontmatter delimited by opening and closing `---` lines. Pi's YAML parser reads the metadata. The Markdown body supplies the profile identity or system prompt and must not be empty.

```markdown
---
name: code-review
description: Reviews a change without editing it
model: openrouter/example-model
builtin-tools: [read, grep, find, ls]
extensions:
  - package: npm:@example/pi-review-tools
    paths: [index.ts]
skills: [review]
thinking: medium
session-mode: lineage-only
system-prompt: append
auto-exit: true
---

Review the requested change. Report findings with exact file references.
```

Malformed YAML, unknown keys, invalid values, and invalid field types exclude the complete definition. Diagnostics identify the file and field. Other valid project files remain available. When an invalid project definition prevents the effective name from being determined safely, global definitions are suppressed rather than risking fallback to a less restricted profile.

## Supported fields

| Field | Accepted value | Default and behavior |
| --- | --- | --- |
| `name` | String without commas, path separators, or control characters, and not `.` or `..` | Trimmed. When omitted, the trimmed filename without `.md` is used. The declared name may differ from the filename. |
| `description` | Non-empty string | Optional text shown by `subagents_list`. |
| `model` | Non-empty string | Optional child model. Pi uses its configured default when omitted; AGY uses its own default. |
| `builtin-tools` | Comma-delimited string or YAML string array. Pi accepts `read`, `write`, `edit`, `bash`, `powershell`, `grep`, `find`, or `ls`; AGY accepts only `read`, `grep`, `find`, or `ls`. | Empty list. Pi children still receive `ask_question`; AGY receives no native tools. See [Tool isolation](#tool-isolation). |
| `extensions` | YAML array of mappings containing exactly `package` and optional `paths` | Empty list. Selects installed, enabled extension resources from exact configured Pi package sources. See [Package extension selection](#package-extension-selection). |
| `skill` | Comma-delimited string or YAML string array | Empty list of skill prompts. Alias of `skills`. |
| `skills` | Comma-delimited string or YAML string array | Empty list. Do not use together with `skill`. |
| `thinking` | `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max` | Optional. Applied with a profile model. |
| `subagent_agents` | Comma-delimited string or YAML string array | Empty list. A non-empty list grants nested spawning and restricts targets to these effective names. |
| `auto-exit` | YAML boolean | `false`. When true, the child shuts down and reports its final response only after Pi settles automatic retries, recovery, and queued continuation. |
| `interactive` | YAML boolean | Inverse of `auto-exit`. Controls whether stall and recovery transitions wake the parent; the widget still updates. |
| `system-prompt` | `append` or `replace` | When omitted, the body is inserted into the task wrapper. Otherwise the body is passed through the corresponding Pi system-prompt flag. |
| `session-mode` | `standalone`, `lineage-only`, or `fork` | `standalone`. See [Session modes](#session-modes). |
| `cwd` | Non-empty string | Active context cwd. Absolute values are used directly. Relative profile values resolve from the global Pi agent directory; a runtime `cwd` override resolves from the active context cwd. |
| `cli` | `pi`, `claude`, or `agy` | `pi`. See [Antigravity CLI](#antigravity-cli) and [Claude CLI limitations](#claude-cli-limitations). |
| `disable-model-invocation` | YAML boolean | `false`. When true, hides the profile from `subagents_list`; an exact permitted name remains directly spawnable. |

Only actual YAML booleans are accepted. For example, `auto-exit: true` is valid and `auto-exit: "true"` is not.

`skill` and `skills` are aliases. Supplying both excludes the definition rather than choosing a hidden precedence.

List fields accept either form:

```yaml
builtin-tools: read, bash
skills: [review, test]
subagent_agents:
  - inspector
  - implementer
```

Every array member must be a string and must not contain commas. Each `subagent_agents` entry must also satisfy the effective `name` restrictions. Empty strings are removed and duplicate entries are collapsed.

## Package extension selection

`extensions` is structured separately because loading an extension grants executable code, not an individual tool name:

```yaml
extensions:
  - package: npm:@example/pi-web-tools
  - package: git:git@github.com:example/pi-search.git
    paths:
      - extensions/web-search.ts
      - extensions/codex-search.ts
```

Each entry must contain exactly one non-empty `package` string and may contain one non-empty `paths` array of non-empty strings. The `package` value is matched exactly against a source in Pi's configured `packages` list, including protocol, version, or ref text. Duplicate package strings and duplicate path selectors are invalid.

When `paths` is omitted, the profile selects all enabled extension resources exposed by that package in Pi's resolved resource order. When present, each selector must be an exact package-relative enabled extension resource. Selectors cannot be absolute or drive-qualified and cannot contain `.` or `..` path segments. Globs, standalone filesystem paths, disabled resources, missing files, and paths that escape the canonical package root are not accepted.

Profile package order and explicit selector order are preserved. If different selections resolve to the same canonical file, only the first occurrence is loaded.

Resolution is read-only. It does not install or update packages, access the network, or write settings. A global profile can select only global package settings. A profile from the nearest trusted project first uses an exact source from that project's settings and may fall back to an exact global source. Untrusted project profiles and package settings are ignored. Invalid settings, an unconfigured or uninstalled package, a resolution error, or a selection with no enabled extension files excludes the profile before pane creation. `subagents_list` reports the profile file and relevant extension field or selector in its diagnostics.

## Body routing

- With `system-prompt: append`, the body is written to a private launch artifact and passed with `--append-system-prompt`.
- With `system-prompt: replace`, it is passed with `--system-prompt`.
- Without `system-prompt`, the body is prepended to the wrapped task for Pi `standalone` and `lineage-only` modes, and to the direct task for Pi `fork` mode.
- In Pi `fork` mode, inherited conversation context supplies the surrounding context and the body plus task are delivered directly.
- For `cli: agy`, the body is always the generated primary agent's system prompt. `system-prompt` is unsupported.

## Session modes

- `standalone` starts a fresh child session without a parent-session link.
- `lineage-only` starts a fresh child session with a `parentSession` link but no copied conversation turns.
- `fork` creates a linked child session seeded with the caller's conversation before the triggering user turn.

## Tool isolation

Every new named Pi profile launches with `--no-extensions --no-builtin-tools` and no strict `--tools` argument. Missing or empty `builtin-tools` therefore means no Pi built-ins, not Pi's default set. The accepted Pi vocabulary is `read`, `write`, `edit`, `bash`, `powershell`, `grep`, `find`, and `ls`.

AGY profiles use a separate native capability contract. Only `read`, `grep`, `find`, and `ls` are accepted, translated in selected order to `view_file`, `grep_search`, `find_by_name`, and `list_dir`. Missing or empty `builtin-tools` writes an empty native `tools` list. Mutation, shell, PowerShell, permission-request, web, MCP, browser, image, scheduler, and nested-agent tools are not exposed.

The package loads its protected runtime control first, its spawning control second only when nesting is granted, selected profile extensions in their resolved order, and a tool-free capability activation control last. Before the first model request, activation enables the selected built-ins plus tools registered by the declared extensions. Later extension tools are activated at subsequent pre-model lifecycle checkpoints. Profile extensions may override built-in tool names, while first-loaded custom-tool registrations win duplicate custom names. The protected framework controls retain precedence over ordinary profile extensions.

Every Pi child still receives `ask_question`. A non-empty `subagent_agents` grants `subagent`, `subagent_message`, and `subagents_list` and restricts them to the declared effective profile names. Listing those spawning controls under `builtin-tools` is invalid; `subagent_agents` is the only nested-spawn grant.

A declared extension runs as trusted arbitrary code with the user's permissions. Selecting it grants its complete behavior, including startup and dynamic tools, hooks, commands, providers, and active-tool changes. This mechanism does not sandbox an extension or filter its individual tools. Review extension packages before granting them.

The legacy profile field `tools` is invalid. Migrate Pi built-in names to `builtin-tools`, move custom capabilities to configured package `extensions`, and use `subagent_agents` only for nested spawning. The retired hardcoded custom-tool mappings and process-global extension registration hook are not supported.

## Nested spawning

Only a non-empty `subagent_agents` field grants the spawning tools. The parent launches the child with `PI_SUBAGENT_ALLOWED` set to the declared names. Discovery and every nested spawn enforce that set, so changing files after launch cannot broaden the child's permitted targets.

```markdown
---
name: coordinator
builtin-tools: [read, edit]
subagent_agents: [inspector, implementer]
auto-exit: true
---

Coordinate the task and delegate only when useful.
```

## Runtime names and resume

`name` in a `subagent` tool call is a runtime display and addressing name, separate from the profile's effective name. If omitted, the extension uses the profile name and adds `-2`, `-3`, and so on when needed. An explicit name is never auto-suffixed: it is rejected when already running, reserved by an in-flight launch, or registered in the current parent session.

Each new Pi launch stores a strict version 1 `extension-grants` snapshot beside the child session. It contains selected built-ins, ordered canonical profile extension paths, explicit spawning state and targets, model, thinking level, system prompt state, cwd, and agent directory. `subagent_message` structurally validates this exact state and preflights profile and framework extension files before creating a resume pane.

Resume does not reread the profile or package settings. It reconstructs the protected framework controls, preserves profile extension order, and uses the current installed contents at valid stored paths. Missing, malformed, relative, non-canonical, duplicate-canonical, reserved-framework, or nesting-inconsistent state fails closed rather than falling back to broader defaults.

Existing valid strict snapshots remain a separate legacy shape with `toolAllowlist`. They continue to resume with `--no-extensions --tools` and their stored extension paths, and reading them does not rewrite them into the new format.

A successful AGY result stores a separate strict tagged snapshot referenced from the same name registry. It contains the exact conversation ID, cwd, model, effort, identity, logical and native tools, and generated primary-agent contract. Resume never rereads the mutable source profile. It validates the stored state and generated agent, reserves the snapshot against concurrent launch, and invokes `agy --conversation <exact-id>`. A successful continuation atomically replaces the stored conversation ID. Missing, malformed, mismatched, unavailable, or unregistered state fails before pane creation.

## Antigravity CLI

`cli: agy` requires `agy` on `PATH` and launches exactly one direct primary process from the resolved profile or runtime cwd:

```markdown
---
name: scout
cli: agy
model: gemini-3.8-flash
thinking: medium
builtin-tools: [read, grep, find, ls]
---

Inspect the codebase and report concise evidence without making changes.
```

The profile body becomes the system prompt of a collision-resistant generated custom agent with `mainAgent: true`, `subagent: false`, and exactly the translated native tool list. The generated definition, task, JSON result, stderr, resume messages, state, and launch scripts live under the parent Pi session artifact directory. Only the generated-agent workspace is passed through `--add-dir`; neither the target repository nor global AGY configuration is modified.

AGY runs with `--output-format json`, the effective `--model`, and profile `thinking` mapped directly to `--effort`. AGY owns model/effort compatibility errors. The extension never passes `--dangerously-skip-permissions`. With no user permission override, AGY's workspace-read defaults allow the four granted reads without prompting; explicit user `ask` or `deny` rules can supersede that default and are not bypassed.

AGY profiles accept only `name`, `description`, `model`, `thinking`, `cwd`, the Markdown body, `disable-model-invocation`, `cli`, and `builtin-tools`. Explicit `extensions`, `skill` or `skills`, `subagent_agents`, `system-prompt`, `session-mode`, `auto-exit`, and `interactive` fields are invalid, including empty values. `write`, `edit`, `bash`, and `powershell` are also invalid AGY built-ins.

AGY is one-shot. `subagent_message` rejects active steering without pane input. After successful completion, the same runtime name starts a one-shot continuation from the exact persisted conversation. Terminal `ERROR`, `CANCELLED`, `INTERRUPTED`, waiting/unknown status, malformed JSON, empty response, missing conversation ID, non-zero exit, and bounded stderr diagnostics are surfaced as failures without Pi or Claude fallback. A missing pane advertises resume only when a valid prior conversation snapshot and its stored cwd and generated agent remain replayable.

For existing profiles, replace the frontmatter as shown and keep the existing body after the closing delimiter unchanged:

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

Remove the Pi provider extension and every unsupported lifecycle field listed above. The package does not edit or package external dotfiles.

## Claude CLI limitations

`cli: claude` uses the existing Claude Code launch path rather than a Pi child. It applies `model`, `cwd`, the Markdown body as an appended system prompt, and lifecycle tracking. Pi-specific `skills`, `thinking`, `session-mode`, `system-prompt` mode selection, nested-spawn allowlists, and resume snapshots do not configure Claude Code. Declaring `builtin-tools` or `extensions` on a `cli: claude` profile is invalid, even when the value is explicitly empty, because those capability fields cannot be enforced for Claude Code. Running Claude children can receive live messages, but finished Claude children cannot be resumed through `subagent_message`. Use `cli: pi` when those isolation and resume guarantees are required.

## Troubleshooting

Run `subagents_list` in the active Pi session. It reports valid visible definitions and includes diagnostics for invalid files. If none are available, create a profile in the reported global directory or in the nearest trusted project `.pi/agents` directory.
