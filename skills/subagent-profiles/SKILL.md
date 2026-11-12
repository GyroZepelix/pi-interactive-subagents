---
name: subagent-profiles
description: Creates or edits pi-interactive-subagents profile Markdown files in ~/.pi/agent/agents/ (or $PI_CODING_AGENT_DIR/agents/) or a trusted project .pi/agents/, choosing correct frontmatter fields, defaults, and harness restrictions. Use only when the user asks to create, edit, review, or fix a subagent profile file; not for spawning, messaging, or debugging running subagents.
---

# Subagent profiles

Write and edit profile files for the `subagent` tool correctly. The complete, authoritative contract is `docs/agent-definitions.md` in the pi-interactive-subagents package; read it when a field below needs more detail, and never contradict it.

## Workflow

1. Locate the target file. Global profiles live in `$PI_CODING_AGENT_DIR/agents/*.md`, or `~/.pi/agent/agents/*.md` when the variable is unset. Project profiles live in the nearest `.pi/agents/*.md` and load only when the project is trusted.
2. Read the existing profile (and any same-named profile in the other scope) before editing.
3. Choose the harness (`cli`), then add only the fields the role needs. Omit fields whose default is what you want.
4. Write a non-empty Markdown body: the role's identity and rules.
5. After saving, run `subagents_list` in the active Pi session and fix any diagnostic for the file.

## Precedence and scope

- Profiles are keyed by effective `name` (the filename without `.md` when `name` is omitted), not by filename.
- A trusted project profile overrides a global profile with the same effective name. An invalid project override hides the global one instead of falling back to it.
- There is no way yet to make a project use only its own profiles: global profiles stay visible unless overridden by name.
- Malformed YAML, unknown keys, wrong types, or invalid values exclude the whole profile. Booleans must be real YAML booleans (`true`, not `"true"`).

## Fields

| Field | Default | Use it when |
| --- | --- | --- |
| `name` | filename without `.md` | The profile name should differ from the filename. No commas, path separators, or control characters. |
| `description` | none | Always; `subagents_list` shows it to the parent model for routing. |
| `model` | Pi or AGY configured default | The role needs a specific model. Forbidden with `model-chain`. |
| `thinking` | none | The role needs a reasoning level: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`. |
| `builtin-tools` | empty (no tools) | Always list the needed tools. Pi: `read`, `write`, `edit`, `bash`, `powershell`, `grep`, `find`, `ls`, `codemode`. Omitted means no built-ins, not Pi's default set. |
| `mcp-servers` | empty | A flat Pi profile needs exact configured MCP servers; each grants the complete server. |
| `extensions` | empty | The role needs tools from a configured Pi package: `- package: <exact source>` with optional `paths: [...]`. Extensions run as trusted code. |
| `skills` (alias `skill`) | empty | The child should get specific skills. Use one alias, not both. |
| `subagent_agents` | empty (no nesting) | The child may spawn other profiles; lists the exact names it may spawn. Never put spawning tools in `builtin-tools`. |
| `auto-exit` | `true` for Pi | Set `false` only for a hands-on child the user works in directly; it then waits in its pane until the user exits. |
| `interactive` | inverse of resolved `auto-exit` | Rarely. It only controls whether stall and recovery transitions wake the parent. |
| `system-prompt` | `append` for Pi | `append` adds the body to Pi's system prompt and keeps Pi's own rules. Use `replace` only when the body must fully replace Pi's system prompt. Use `task` to put the body in the child's first message ahead of the task (no system-prompt flag), for example when a provider or extension may replace the system prompt. |
| `session-mode` | `lineage-only` for Pi | `lineage-only` costs nothing and nests the child under the parent in `/resume`. Use `standalone` for an unlinked session. Use `fork` only when the child truly needs the parent conversation; it pays for that copied context on every request. |
| `cwd` | active context cwd | The child should start elsewhere. Relative profile values resolve from the global Pi agent directory. |
| `cli` | `pi` | Use `agy` or `claude` for those harnesses (see restrictions). |
| `disable-model-invocation` | `false` | Set `true` to hide the profile from `subagents_list`; an exact permitted name can still be spawned directly. |
| `model-chain` | none | A read-only role should fall back across ordered AGY/Pi targets on provider exhaustion. |

### Pi defaults changed

For Pi profiles and `cli: pi` chain targets, omitted `auto-exit`, `system-prompt`, and `session-mode` now mean `true`, `append`, and `lineage-only`. Earlier releases meant `false` (child waits forever after answering), "body in the task", and `standalone`. Do not add these three lines just to restate the defaults; add them only to opt out. Set `system-prompt: task` to keep the old body-in-task routing.

## Harness restrictions

- `cli: agy`: only `name`, `description`, `model`, `thinking`, `cwd`, `disable-model-invocation`, `cli`, `builtin-tools`, and the body. `builtin-tools` only `read`, `grep`, `find`, `ls`. Any other field, even empty, is invalid. Sessions are standalone and one-shot.
- `cli: claude`: `builtin-tools`, `mcp-servers`, and `extensions` are invalid, even when empty. Pi-specific fields (`skills`, `thinking`, `session-mode`, `system-prompt`, `subagent_agents`) do not configure Claude Code, and the Pi defaults above do not apply. Finished Claude children cannot be resumed.
- `model-chain`: shared top-level fields are only `name`, `description`, `builtin-tools` (`read`, `grep`, `find`, `ls`), `cwd`, `disable-model-invocation`, and the body. Each target has `cli` (`agy` or `pi`) and `model`; AGY targets may add `thinking`; Pi targets may add `thinking`, `extensions`, `session-mode`, and `system-prompt`. Targets always auto-exit.

## Example

```markdown
---
name: code-review
description: Reviews a change without editing it and reports evidence-backed findings
model: openrouter/example-model
thinking: medium
builtin-tools: [read, grep, find, ls]
---

Review the requested change. Report findings with exact file references.
```

This profile auto-exits, appends its body to Pi's system prompt, and links its session to the parent without stating those fields.
