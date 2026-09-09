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
tools: [read, grep, find, ls]
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
| `model` | Non-empty string | Optional child model. When omitted, the child Pi process uses its configured default. |
| `tools` | Comma-delimited string or YAML string array | Empty list. Pi children still receive `ask_question`. See [Tool isolation](#tool-isolation). |
| `skill` | Comma-delimited string or YAML string array | Empty list of skill prompts. Alias of `skills`. |
| `skills` | Comma-delimited string or YAML string array | Empty list. Do not use together with `skill`. |
| `thinking` | `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max` | Optional. Applied with a profile model. |
| `subagent_agents` | Comma-delimited string or YAML string array | Empty list. A non-empty list grants nested spawning and restricts targets to these effective names. |
| `auto-exit` | YAML boolean | `false`. When true, a completed autonomous turn shuts down and reports its final response to the parent. |
| `interactive` | YAML boolean | Inverse of `auto-exit`. Controls whether stall and recovery transitions wake the parent; the widget still updates. |
| `system-prompt` | `append` or `replace` | When omitted, the body is inserted into the task wrapper. Otherwise the body is passed through the corresponding Pi system-prompt flag. |
| `session-mode` | `standalone`, `lineage-only`, or `fork` | `standalone`. See [Session modes](#session-modes). |
| `cwd` | Non-empty string | Active context cwd. Absolute values are used directly. Relative profile values resolve from the global Pi agent directory; a runtime `cwd` override resolves from the active context cwd. |
| `cli` | `pi` or `claude` | `pi`. See [Claude CLI limitations](#claude-cli-limitations). |
| `disable-model-invocation` | YAML boolean | `false`. When true, hides the profile from `subagents_list`; an exact permitted name remains directly spawnable. |

Only actual YAML booleans are accepted. For example, `auto-exit: true` is valid and `auto-exit: "true"` is not.

`skill` and `skills` are aliases. Supplying both excludes the definition rather than choosing a hidden precedence.

List fields accept either form:

```yaml
tools: read, bash, web_search
skills: [review, test]
subagent_agents:
  - inspector
  - implementer
```

Every array member must be a string and must not contain commas. Each `subagent_agents` entry must also satisfy the effective `name` restrictions. Empty strings are removed and duplicate entries are collapsed.

## Body routing

- With `system-prompt: append`, the body is written to a private launch artifact and passed with `--append-system-prompt`.
- With `system-prompt: replace`, it is passed with `--system-prompt`.
- Without `system-prompt`, the body is prepended to the wrapped task for `standalone` and `lineage-only` modes, and to the direct task for `fork` mode.
- In `fork` mode, inherited conversation context supplies the surrounding context and the body plus task are delivered directly.

## Session modes

- `standalone` starts a fresh child session without a parent-session link.
- `lineage-only` starts a fresh child session with a `parentSession` link but no copied conversation turns.
- `fork` creates a linked child session seeded with the caller's conversation before the triggering user turn.

## Tool isolation

Every named Pi profile launches with `--no-extensions` and an explicit `--tools` allowlist. Missing or empty `tools` therefore means no ordinary tools, not Pi's default tool set.

The extension always adds `ask_question`, which is registered by the child-control extension. A non-empty `subagent_agents` also adds `subagent`, `subagent_message`, and `subagents_list` and loads their backing extension. Listing those spawning tools directly in `tools` is invalid; `subagent_agents` is the only nested-spawn grant.

Pi built-ins include `read`, `write`, `edit`, `bash`, `powershell`, `grep`, `find`, and `ls`. A non-built-in requested tool must have a resolvable backing extension before a tmux pane is created. Known compatibility mappings cover `web_search`, `web_fetch`, `video_extract`, `youtube_search`, `google_image_search`, and `safe_bash`. Other extensions can register a tool path through:

```typescript
globalThis.__pi_interactive_subagents.registerToolExtension("my_tool", "/absolute/path/to/extension.ts");
```

If resolution fails, spawning stops with the profile name, tool name, source file, and corrective action. The tool is never silently omitted.

## Nested spawning

Only a non-empty `subagent_agents` field grants the spawning tools. The parent launches the child with `PI_SUBAGENT_ALLOWED` set to the declared names. Discovery and every nested spawn enforce that set, so changing files after launch cannot broaden the child's permitted targets.

```markdown
---
name: coordinator
tools: [read, edit]
subagent_agents: [inspector, implementer]
auto-exit: true
---

Coordinate the task and delegate only when useful.
```

## Runtime names and resume

`name` in a `subagent` tool call is a runtime display and addressing name, separate from the profile's effective name. If omitted, the extension uses the profile name and adds `-2`, `-3`, and so on when needed. An explicit name is never auto-suffixed: it is rejected when already running, reserved by an in-flight launch, or registered in the current parent session.

Each Pi launch snapshots its resolved model, thinking level, system prompt, tool allowlist, exact extension paths, spawn targets, cwd, and agent directory beside the child session. `subagent_message` structurally validates and preflights that snapshot before creating a pane, then replays it when resuming a finished Pi child. A Pi session with an invalid snapshot or a missing snapshotted extension is refused rather than resumed with broader defaults.

## Claude CLI limitations

`cli: claude` uses the existing Claude Code launch path rather than a Pi child. It applies `model`, `cwd`, the Markdown body as an appended system prompt, and lifecycle tracking. Pi-specific `tools`, `skills`, `thinking`, `session-mode`, `system-prompt` mode selection, nested-spawn allowlists, and resume snapshots do not configure Claude Code. Running Claude children can receive live messages, but finished Claude children cannot be resumed through `subagent_message`. Use `cli: pi` when those isolation and resume guarantees are required.

## Troubleshooting

Run `subagents_list` in the active Pi session. It reports valid visible definitions and includes diagnostics for invalid files. If none are available, create a profile in the reported global directory or in the nearest trusted project `.pi/agents` directory.
