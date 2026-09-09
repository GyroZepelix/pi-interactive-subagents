# Agent Profile Conventions

## Location, trust, and precedence

The package ships no profiles. Definitions are Markdown files under the configured global Pi agent directory's `agents/` folder or the nearest project `.pi/agents/` directory (`pi-extension/subagents/agents.ts`, `docs/agent-definitions.md`).

- Global definitions are always considered.
- Project definitions are considered only when the active extension context reports the project trusted.
- Project definitions override global definitions by effective parsed name.
- An invalid project override blocks fallback to a matching global definition. If an invalid project definition leaves its effective name uncertain, all global definitions are suppressed rather than risking a less restricted fallback.
- Nested `PI_SUBAGENT_ALLOWED` filtering applies after valid definitions are assembled.

## Canonical definitions

Parse a profile once and retain its effective name, normalized fields, source scope, and exact path. Listing, permission checks, launch, diagnostics, and loadout capture must use that same object. Do not reconstruct a filename from a declared name (`pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`).

An omitted `name` falls back to the filename without `.md`. Explicit names may differ from filenames. Names are trimmed and reject commas, path separators, control characters, and `.` or `..`.

## Validation

Require opening and closing `---` delimiters, a mapping-valued YAML frontmatter root, and a non-empty Markdown body. Use Pi's exported YAML `parseFrontmatter`, not line-oriented regular expressions. Unknown keys, malformed YAML, invalid field types, invalid enums, non-string list members, pseudo-booleans, and simultaneous `skill` plus `skills` exclude the whole profile with a file-and-field diagnostic.

Comma-delimited strings and YAML string arrays are accepted for `tools`, `skill` or `skills`, and `subagent_agents`; YAML array entries may not contain commas, and nested target entries follow effective-name validation. `docs/agent-definitions.md` is the complete user-facing field and default reference.

## Tool and nesting defaults

- Missing or empty `tools` means no ordinary tools.
- Every named Pi child still receives `ask_question`.
- A non-empty `subagent_agents` grants spawning tools and pins nested targets.
- Spawning tool names listed directly under `tools` invalidate the profile.
- Requested non-built-in tools require a resolvable backing extension before pane creation.

## Session and prompt behavior

`session-mode` defaults to `standalone`; `lineage-only` and `fork` are profile-defined rather than public tool arguments. `system-prompt: append` or `replace` routes the body through the corresponding Pi flag; without the field, the body is part of the task wrapper.

`disable-model-invocation: true` hides a definition from `subagents_list` while preserving exact direct selection when otherwise permitted.

When changing profile semantics, update `pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`, `docs/agent-definitions.md`, README setup guidance, and focused tests together.
