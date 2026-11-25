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

Comma-delimited strings and YAML string arrays are accepted for `builtin-tools`, `mcp-servers`, `skill` or `skills`, and `subagent_agents`; `mcp-servers` arrays may also mix in `{ name, required }` mappings. YAML array entries may not contain commas, and nested target entries follow effective-name validation. `extensions` is a YAML array of exact configured package sources with optional exact package-relative `paths`; selectors must stay within enabled package resources. Reject duplicate package strings and selectors, absolute or drive-qualified selectors, `.` or `..` path segments, and explicitly empty `paths`. Legacy `tools` is rejected rather than reinterpreted. Declaring `builtin-tools`, `mcp-servers`, or `extensions` on `cli: claude`, even with an empty value, invalidates the profile. `cli: agy` accepts only generic identity/selection fields plus `builtin-tools`; explicit `mcp-servers`, Pi extensions, skills, `inherit-skills`, nesting, prompt/session modes, and lifecycle fields invalidate it even when empty. AGY allows only `read`, `grep`, `find`, and `ls`. `docs/agent-definitions.md` is the complete user-facing field and default reference.

## Ordered model chains

`model-chain` is an additive profile form for one read-oriented role with at least two ordered `agy` or `pi` targets. The body, identity, cwd, description, visibility, and read built-ins are shared. Flat target/lifecycle fields are forbidden at the top level; shared built-ins are limited to `read`, `grep`, `find`, and `ls`; skills and nested spawning are invalid. AGY targets own `model` and optional `thinking`; Pi targets may additionally own `extensions`, `session-mode`, and `system-prompt`. Every target field and extension path is validated with an indexed diagnostic before launch (`pi-extension/subagents/agents.ts`, `docs/agent-definitions.md`).

A chain rejects runtime model overrides but preserves runtime cwd overrides. One fresh target runs at a time, and only selected terminal exhaustion evidence advances. Pi target extensions keep their complete trusted-grant semantics; read-oriented shared built-ins do not sandbox extension code. Exact scout and flash-reviewer forms live in `docs/agent-definitions.md`.

## Built-ins, extensions, and nesting

- Missing or empty `builtin-tools` grants no Pi built-ins. Flat Pi profiles may include `codemode`; AGY and model chains retain their read-only built-in vocabulary.
- Missing or empty `mcp-servers` grants no ambient MCP servers. The field accepts exact Pi MCP names only on flat Pi profiles and grants complete servers rather than individual tools. Entries are optional unless written as `{ name, required: true }` (see below).
- Declaring `extensions` grants each selected extension's complete executable behavior and all tools it registers at startup or later. Extensions are trusted code, not per-tool grants.
- Extension packages resolve read-only without installation, network access, or settings writes. An exact source in a subagent registry wins first (see below). Otherwise global profiles use global package settings only, and trusted project profiles prefer the nearest project's exact source and may fall back to global settings. Missing, disabled, escaping, nonexistent, or empty selections exclude the profile before pane creation.
- Omitting `paths` selects all enabled extension resources in Pi's resolved order. Explicit selectors preserve their order, package declarations preserve package order, and canonical duplicate files keep their first occurrence.
- Every flat or native-resumed Pi child receives `ask_question`; autonomous model-chain attempts omit it to preserve one final parent delivery.
- AGY maps `read`, `grep`, `find`, and `ls` in declared order to `view_file`, `grep_search`, `find_by_name`, and `list_dir`; omitted or empty tools grant none. AGY receives no Pi extensions, mutation/shell tools, permission-request tool, or nested-agent capability.
- A non-empty `subagent_agents` grants spawning tools and pins nested targets. Spawning tool names under `builtin-tools` invalidate the profile.

## Codemode and ambient MCP selection

Pi 1.0+ flat profiles may select `codemode` under `builtin-tools` and exact names under `mcp-servers`. Canonical discovery consults the profile's subagent registries first, then reads the global `mcp.json` plus the active trusted project's `.pi/mcp.json`; a project entry replaces the global entry of the same name, and runtime child-cwd overrides do not recompute that authority. Invalid selections, invalid server configs (including invalid project overrides), malformed sources, selected or configured `-`/`_` namespace collisions, and registry provider `auth` fail before pane creation for every entry (`pi-extension/subagents/agents.ts`, `pi-extension/subagents/mcp-config.ts`, `docs/agent-definitions.md`).

Entries are optional by default. `mcp-servers` mixes plain names (optional), comma strings (all optional), and strict `{ name, required }` mappings; other mapping keys, a non-boolean `required`, a missing or invalid name, a non-string non-mapping entry, or one name listed with conflicting required values invalidate the profile, while same-required duplicates collapse to the first. An optional name that no permitted source defines, or whose first defining source has `enabled: false`, is skipped silently and recorded in declared order on `AgentDefinition.mcpServersUnavailable`; a disabled registry entry or project tombstone still never falls through. Skipped names add no reference and no support tool, so launch, loadout, and resume never see them. A `required: true` name that is missing or disabled keeps the fail-closed diagnostic. `resolveMcpServerReferences` stays fail-closed unless the caller passes `{ optional: [...] }`, and returns `skippedOptional`. `subagents_list` appends ` (optional MCP unavailable: a, b)` to affected lines in both its model-visible content and its TUI rendering (`pi-extension/subagents/agents.ts`, `pi-extension/subagents/mcp-config.ts`, `pi-extension/subagents/index.ts`, `test/test.ts`).

Resolved grants retain only ordered server name, canonical source path, scope, and semantic digest. Resolution does not connect, resolve configured expressions, read credentials, or write settings. The complete server remains governed by Pi's configured direct/codemode/deferred/hidden exposure and resources; support tools are derived automatically. Claude, AGY, and model-chain forms reject `mcp-servers`, including explicit empty values (`pi-extension/subagents/agents.ts`, `test/test.ts`).

Ambient selection is not an extension sandbox. Declared profile extensions remain trusted arbitrary code, may register differently named MCP servers, and may perform process/network I/O directly. Selected ambient names are reserved before those extensions load (`pi-extension/subagents/index.ts`, `pi-extension/subagents/subagent-mcp-control.ts`).

## Subagent capability registries and skills

A registry is Pi's project layout under `<agents dir>/.pi/` (`settings.json` packages, `mcp.json`, `skills/` plus package skills), managed with stock `pi install -l`, `pi config --local`, `pi mcp add -l`, and `pi mcp login` run from a trusted agents dir. The parent session never reads it. Trusted project profiles consult `<project>/.pi/agents/.pi/` then the global `<global agents dir>/.pi/`; global profiles consult only the global registry. The first registry containing the exact package source, MCP name, or skill name wins over ambient sources; otherwise ambient rules are unchanged. Registry packages resolve as Pi project-scope packages rooted at the agents dir, registry MCP references carry `global-registry` or `project-registry` scope and reject provider `auth`, and resolution stays anchored to profile location, not runtime cwd (`pi-extension/subagents/agents.ts`, `pi-extension/subagents/mcp-config.ts`, `docs/agent-definitions.md`).

`skills` no longer sends `/skill:` startup prompts. For flat Pi profiles each name resolves at discovery (registries, then Pi's own ambient discovery for the profile settings context) to a canonical skill file passed as `--skill`; unknown names invalidate the profile. `inherit-skills: false` adds `--no-skills`; it is invalid on Claude, AGY, and model-chain profiles. With `inherit-skills: true`, Pi keeps a same-named ambient skill over a different registry file and reports a collision, so strict registry skills need `inherit-skills: false`. Claude profiles keep accepting `skills` without effect (`pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`, `docs/agent-definitions.md`).

## Model provider selection

- Model identifiers and effort encoding are provider-specific. After replacing a provider extension, rediscover the live registry with `pi --list-models`; do not carry old suffixes forward by analogy. When a provider collapses effort variants, use its canonical model ID plus the profile or target-local `thinking` field (`spec/archive/260909-1928-create-global-scout-researcher-and-worker-profiles/verification.md`).

## Session and prompt behavior

For the Pi harness only (flat profiles with `cli` omitted or `pi`, and `cli: pi` chain targets), omitted fields resolve to `auto-exit: true`, `system-prompt: append`, and `session-mode: lineage-only`; explicit values are kept. One helper, `applyPiProfileDefaults` in `pi-extension/subagents/index.ts`, fills them during launch preparation before interactive resolution, launch behavior, task wrapping, and loadout capture, and the `PI_SUBAGENT_AUTO_EXIT` launch variable is read from the prepared loadout. `resolveEffectiveSessionMode` and `resolveEffectiveInteractive` stay pure resolvers, so Claude and AGY launches keep their previous behavior (standalone sessions, no seeding, unchanged `interactive` handling). Resume replays the stored loadout and always auto-exits. These defaults replaced `false`, body-in-task-wrapper, and `standalone` after an omitted `auto-exit` left a child waiting in its pane forever (`docs/agent-definitions.md`, `test/test.ts`).

`lineage-only` and `fork` are profile-defined rather than public tool arguments. `system-prompt: append` or `replace` routes the body through the corresponding Pi flag. `system-prompt: task` is an explicit opt-in that restores body-in-task routing: no flag is passed, the body is prepended to the first message (task wrapper, or the direct task in `fork`), and the loadout records `systemPromptMode: null` and `identity: null` like other body-in-task children (`pi-extension/subagents/index.ts` `prepareAgentLaunch`).

`disable-model-invocation: true` hides a definition from `subagents_list` while preserving exact direct selection when otherwise permitted.

For `cli: agy`, `thinking` is passed unchanged as `--effort`; AGY reports unsupported effort or model-effort combinations. The profile body becomes the generated primary-agent system prompt.

When changing profile semantics, update `pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`, `docs/agent-definitions.md`, README setup guidance, the shipped `skills/subagent-profiles/SKILL.md` (published through `package.json` `pi.skills`), and focused tests together. The skill must not contradict `docs/agent-definitions.md`.
