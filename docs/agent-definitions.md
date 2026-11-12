# Agent definitions

This extension ships no agent profiles. Create each available subagent as a Markdown file in a user or trusted project directory. Codemode and MCP profile grants require Pi 1.0 or newer.

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
---

Review the requested change. Report findings with exact file references.
```

This Pi profile omits `auto-exit`, `system-prompt`, and `session-mode`, so it uses the [Pi defaults](#pi-defaults-for-omitted-fields): it auto-exits, appends its body to Pi's system prompt, and links its session to the parent.

Malformed YAML, unknown keys, invalid values, and invalid field types exclude the complete definition. Diagnostics identify the file and field. Other valid project files remain available. When an invalid project definition prevents the effective name from being determined safely, global definitions are suppressed rather than risking fallback to a less restricted profile.

## Supported fields

| Field | Accepted value | Default and behavior |
| --- | --- | --- |
| `name` | String without commas, path separators, or control characters, and not `.` or `..` | Trimmed. When omitted, the trimmed filename without `.md` is used. The declared name may differ from the filename. |
| `description` | Non-empty string | Optional text shown by `subagents_list`. |
| `model` | Non-empty string | Optional child model for a flat profile. Forbidden with `model-chain`. Pi uses its configured default when omitted; AGY uses its own default. |
| `builtin-tools` | Comma-delimited string or YAML string array. Pi accepts `read`, `write`, `edit`, `bash`, `powershell`, `grep`, `find`, `ls`, or `codemode`; AGY accepts only `read`, `grep`, `find`, or `ls`. | Empty list. Flat and native-resumed Pi children still receive `ask_question`; chain attempts omit it to preserve one final delivery. `codemode` is flat-Pi-only. AGY receives no native tools. See [Tool isolation](#tool-isolation). |
| `mcp-servers` | Comma-delimited string or YAML string array of exact configured Pi MCP server names | Empty list. Flat Pi profiles only. Grants complete servers with native exposure/resources; wildcards and per-tool selection are unsupported. See [Codemode and MCP server selection](#codemode-and-mcp-server-selection). |
| `extensions` | YAML array of mappings containing exactly `package` and optional `paths` | Empty list. Selects installed, enabled extension resources from exact configured Pi package sources. See [Package extension selection](#package-extension-selection). |
| `skill` | Comma-delimited string or YAML string array | Empty list of skill prompts. Alias of `skills`. |
| `skills` | Comma-delimited string or YAML string array | Empty list. Do not use together with `skill`. |
| `thinking` | `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max` | Optional. Applied with a profile model. |
| `subagent_agents` | Comma-delimited string or YAML string array | Empty list. A non-empty list grants nested spawning and restricts targets to these effective names. |
| `auto-exit` | YAML boolean | `true` for Pi when omitted. When true, the child shuts down and reports its final response only after Pi settles automatic retries, recovery, and queued continuation. Set `false` for a hands-on child that stays in its pane until the user exits it. |
| `interactive` | YAML boolean | Inverse of the resolved `auto-exit` (so `false` for a Pi profile that omits both). Controls whether stall and recovery transitions wake the parent; the widget still updates. |
| `system-prompt` | `append` or `replace` | `append` for Pi when omitted. The body is passed through the corresponding Pi system-prompt flag. See [Body routing](#body-routing). |
| `session-mode` | `standalone`, `lineage-only`, or `fork` | `lineage-only` for Pi when omitted. See [Session modes](#session-modes). |
| `cwd` | Non-empty string | Active context cwd. Absolute values are used directly. Relative profile values resolve from the global Pi agent directory; a runtime `cwd` override resolves from the active context cwd. |
| `cli` | `pi`, `claude`, or `agy` | `pi`. See [Antigravity CLI](#antigravity-cli) and [Claude CLI limitations](#claude-cli-limitations). |
| `disable-model-invocation` | YAML boolean | `false`. When true, hides the profile from `subagents_list`; an exact permitted name remains directly spawnable. |
| `model-chain` | YAML array of at least two target mappings | Optional ordered AGY/Pi fallback targets. When present, all flat target/lifecycle fields are forbidden. See [Model chains](#model-chains). |

## Pi defaults for omitted fields

For the Pi harness (flat profiles with `cli` omitted or `pi`, and `cli: pi` model-chain targets), an omitted field resolves to:

| Field | Pi default |
| --- | --- |
| `auto-exit` | `true` |
| `system-prompt` | `append` |
| `session-mode` | `lineage-only` |

Explicit values are honored unchanged. `interactive` keeps following the resolved `auto-exit` unless it is set explicitly. AGY and Claude launches are unaffected: they do not use these fields, and their sessions stay `standalone`. Resuming an existing child replays its stored snapshot and always auto-exits, so children launched before this change resume as before.

These defaults changed. Earlier releases treated an omitted `auto-exit` as `false` (the child answered and then waited in its pane until the user exited it), an omitted `system-prompt` as "insert the body into the task wrapper", and an omitted `session-mode` as `standalone`. A Pi profile that relied on those omitted values now behaves differently. To keep the old behavior, set the field explicitly:

- `auto-exit: false` for a hands-on child that waits for the user (it is then interactive by default).
- `session-mode: standalone` for a child session without a parent link.
- `system-prompt: replace` when the body should replace Pi's system prompt. Routing a Pi profile body into the task wrapper is no longer available.

Only actual YAML booleans are accepted. For example, `auto-exit: true` is valid and `auto-exit: "true"` is not.

`skill` and `skills` are aliases. Supplying both excludes the definition rather than choosing a hidden precedence.

List fields accept either form:

```yaml
builtin-tools: read, bash, codemode
mcp-servers: [project-docs, issue-tracker]
skills: [review, test]
subagent_agents:
  - inspector
  - implementer
```

Every array member must be a string and must not contain commas. Each `subagent_agents` entry must also satisfy the effective `name` restrictions. Empty strings are removed and duplicate entries are collapsed.

## Model chains

`model-chain` defines one logical read-oriented role with ordered provider/model targets:

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

The exact `flash-reviewer` frontmatter is:

```yaml
name: flash-reviewer
description: Fast read-only review with evidence-backed findings
builtin-tools: [read, grep, find, ls]
model-chain:
  - cli: agy
    model: gemini-3.8-flash
    thinking: high
  - cli: pi
    model: cursor/gemini-3.8-flash
    thinking: high
    extensions:
      - package: git:github.com/GyroZepelix/pi-cursor-provider
        paths: [index.ts]
    session-mode: standalone
    system-prompt: append
  - cli: pi
    model: openai-codex/gpt-5.6-luna
    thinking: high
    session-mode: standalone
    system-prompt: append
```

Retain its existing Markdown body. The package does not edit global profiles or provider configuration.

The top-level `name`, `description`, `builtin-tools`, `cwd`, Markdown body, and `disable-model-invocation` are shared. Shared built-ins may contain only `read`, `grep`, `find`, and `ls`. Top-level `cli`, `model`, `thinking`, `mcp-servers`, `extensions`, `skill`/`skills`, `subagent_agents`, `session-mode`, `system-prompt`, `auto-exit`, and `interactive` are invalid even when empty. Runtime `model` overrides are also rejected; runtime `cwd` overrides remain available.

Every target must contain exactly a supported `cli` and non-empty `model`, with these optional fields:

- `cli: agy`: `thinking` only.
- `cli: pi`: `thinking`, `extensions`, `session-mode`, and `system-prompt`.

Claude targets, unknown target keys, nulls, empty values, skills, nesting, lifecycle controls, and mutation/shell built-ins exclude the complete profile with target-indexed diagnostics. Pi target extensions use the exact package resolution rules below. They remain complete trusted extension grants and can register tools, hooks, commands, or providers; the chain's shared built-in restriction is not an extension sandbox.

All targets and statically knowable executable/framework prerequisites are prepared before the first pane. One target runs at a time and auto-exits after its native harness settles. A fallback starts a fresh process and receives only the original task plus the shared role body; partial output, reasoning, tool transcripts, and provider conversation state are not transferred. A fresh `subagent` invocation starts at target one.

Fallback occurs only from validated terminal provider evidence matching durable quota, usage-limit, subscription, billing, budget, or exhausted-credit wording, bare HTTP 429, or case/separator variants of `RESOURCE_EXHAUSTED`. Pi classification uses only the final settled assistant provider error after Pi-owned retries and recovery. AGY classification uses only the structured provider error in a valid terminal `ERROR` envelope. Stderr-only text, malformed JSON, denied actions, unknown/waiting status, non-zero success contradictions, authentication, invalid models, permission failures, cancellation, interruption, and pane loss do not trigger fallback. Bare 429 and resource exhaustion can be temporary throttles; the contract intentionally accepts that ambiguity.

The widget keeps one logical row and shows the active target index/count, harness, and model. The parent receives one final result: a winner plus prior bounded exhaustion provenance, the original unrelated failure, or all bounded exhaustion reasons. Provenance contains only index/count, harness, model, elapsed time, outcome, and a fixed bounded reason—never task text, credentials, stderr, or raw provider payloads.

Before a winner exists, the logical name points to strict package-owned chain state and cannot resume a failed attempt. Success atomically replaces it with the existing native Pi session or AGY snapshot. `subagent_message` then uses only that native winner's normal resume behavior; automatic fallback does not apply to later continuation. Failed and all-exhausted chains are non-resumable, and a new self-contained spawn is required.

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

## Codemode and MCP server selection

Flat Pi profiles can grant `codemode` as a built-in and exact ambient MCP server names separately:

```yaml
builtin-tools: [read, grep, codemode]
mcp-servers:
  - project-docs
  - issue-tracker
```

Missing or empty fields grant nothing. Duplicate list entries follow the ordinary list normalization. Names must be exact valid Pi MCP names; wildcard and per-tool grants are not supported. Declaring `mcp-servers` on Claude, AGY, or `model-chain` profiles is invalid even when the value is empty. Existing AGY and model-chain restrictions also reject `codemode`.

An MCP selection grants the complete configured server. Pi's server and per-tool `direct`, `codemode`, `deferred`, and `hidden` exposure remains authoritative, including the standard `list_mcp_resources`, `list_mcp_resource_templates`, and `read_mcp_resource` tools. The runtime loads and activates `codemode` and `tool_search` support automatically when selected exposures require them; profiles do not need to duplicate those implementation details. A standalone `codemode` grant activates only codemode. Codemode executes model-authored JavaScript and can call reachable tools, so it is an explicit authority grant.

Resolution is read-only. It considers the global Pi `mcp.json` and, only when the active project is trusted, that project's `.pi/mcp.json`. The trusted project entry replaces a same-named global entry for every profile, including an invalid or disabled replacement; there is no global fallback. A runtime `cwd` override changes the child workspace but cannot select another MCP source or broaden the grant. A malformed selected source, missing/disabled selected entry, invalid selected config, or selected `-`/`_` namespace collision excludes the profile before pane creation. Resolution does not connect, install, expand environment/command expressions, read credentials, or write settings.

The child still launches with `--no-extensions --no-builtin-tools` and never loads ambient `builtin:mcp`. Its protected filtered controller re-reads only the exact selected entries, verifies their canonical source and semantic SHA-256 digest, reserves those names before profile extensions, and supplies them to Pi's public MCP runtime with ambient loading disabled. Unselected file-configured servers therefore do not connect, register tools/resources, or contribute names, descriptions, instructions, or prompt metadata. Once configuration identity passes, connection, authentication, reconnect, and transient failures use Pi's native MCP diagnostics and lifecycle rather than a package-specific terminal startup failure.

Explicit `extensions` remain complete trusted executable grants. They load after the selected ambient names are reserved, may add differently named MCP servers, and can perform equivalent process or network I/O directly. `mcp-servers` is an ambient file-config filter, not an extension sandbox. Review both the selected server configurations and every declared extension.

New Pi capability snapshots store only each server's ordered name, canonical source path, global/project scope, and semantic digest plus the required support-tool names. They do not copy config bodies, literal or resolved environment values, headers, OAuth tokens, provider credentials, or command output. Resume re-reads the exact stored source and refuses changed, missing, disabled, invalid, or source-mismatched entries before pane creation with guidance to spawn fresh. Rotating a credential behind an unchanged configured expression does not alter the digest. Version 1 extension-grant and legacy strict snapshots retain their existing replay paths.

## Body routing

- With `system-prompt: append` (the Pi default when omitted), the body is written to a private launch artifact and passed with `--append-system-prompt`, keeping Pi's own system prompt.
- With `system-prompt: replace`, it is passed with `--system-prompt` and replaces Pi's system prompt.
- In Pi `standalone` and `lineage-only` modes, the task is wrapped with lifecycle instructions and delivered through a private task artifact. In Pi `fork` mode, inherited conversation context supplies the surrounding context and the task is delivered directly.
- For `cli: claude`, the body is passed to Claude Code as an appended system prompt.
- For `cli: agy`, the body is always the generated primary agent's system prompt. `system-prompt` is unsupported.

## Session modes

- `lineage-only` (the Pi default when omitted) starts a fresh child session with a `parentSession` link but no copied conversation turns. It costs no extra tokens; Pi uses the link only to list and nest the child under its parent in `/resume`.
- `standalone` starts a fresh child session without a parent-session link. AGY and Claude children are always standalone.
- `fork` creates a linked child session seeded with the caller's conversation before the triggering user turn. The child pays for the copied context on every model request, so use it only when the child truly needs the conversation.

## Tool isolation

Every new named Pi profile launches with `--no-extensions --no-builtin-tools` and no strict `--tools` argument. Missing or empty `builtin-tools` therefore means no Pi built-ins, not Pi's default set. The accepted Pi vocabulary is `read`, `write`, `edit`, `bash`, `powershell`, `grep`, `find`, `ls`, and `codemode`; codemode is flat-Pi-only and requires Pi 1.0 or newer.

AGY profiles use a separate native capability contract. Only `read`, `grep`, `find`, and `ls` are accepted, translated in selected order to `view_file`, `grep_search`, `find_by_name`, and `list_dir`. Missing or empty `builtin-tools` writes an empty native `tools` list. Mutation, shell, PowerShell, permission-request, web, MCP, browser, image, scheduler, and nested-agent tools are not exposed.

The package loads its protected runtime control first, its spawning control second only when nesting is granted, required built-in codemode/tool-search support, the protected filtered MCP control when granted, selected profile extensions in resolved order, and a tool-free capability activation control last. Before the first model request, activation enables selected built-ins, required MCP support, Pi-native direct MCP tools, and tools registered by declared extensions; indirect and hidden MCP tools are not promoted. Later extension tools are activated at subsequent pre-model lifecycle checkpoints. Profile extensions may override built-in tool names, while selected ambient MCP names and protected framework controls retain precedence.

Every flat and native-resumed Pi child still receives `ask_question`. Autonomous chain attempts omit it so they cannot pause for or emit an intermediate parent question. A non-empty `subagent_agents` grants `subagent`, `subagent_message`, and `subagents_list` and restricts them to the declared effective profile names. Listing those spawning controls under `builtin-tools` is invalid; `subagent_agents` is the only nested-spawn grant.

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

Each new Pi launch stores a strict version 2 `mcp-capabilities` snapshot beside the child session. It contains selected built-ins, ordered canonical profile extension paths, explicit spawning state and targets, non-secret MCP server references and support state, model, thinking level, system prompt state, cwd, and agent directory. `subagent_message` structurally validates this exact state and preflights profile/framework extension files plus every stored MCP source/digest before creating a resume pane.

Resume does not reread the profile or package settings. It reconstructs the protected framework controls, preserves profile extension order, and uses the current installed contents at valid stored paths. Missing, malformed, relative, non-canonical, duplicate-canonical, reserved-framework, or nesting-inconsistent state fails closed rather than falling back to broader defaults.

Existing valid version 1 extension-grant snapshots and strict legacy snapshots with `toolAllowlist` remain separate compatibility shapes. They continue through their existing command paths, and reading them does not rewrite them into version 2.

A successful AGY result stores a separate strict tagged snapshot referenced from the same name registry. New version 2 snapshots contain the exact conversation ID, cwd, model, effort, identity, logical and native tools, generated primary-agent contract, and ordered additional workspace list. Resume never rereads the mutable source profile or current parent cwd. It validates the stored state, every stored workspace, and the generated agent; reserves the snapshot against concurrent launch; and invokes `agy --conversation <exact-id>` with the exact stored boundary. A successful continuation atomically replaces only the stored conversation ID. Existing valid version 1 snapshots remain readable and resume with their original boundary and no added parent workspace. Missing, malformed, mismatched, unavailable, or unregistered state fails before pane creation.

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

The profile body becomes the system prompt of a collision-resistant generated custom agent with `mainAgent: true`, `subagent: false`, and exactly the translated native tool list. The generated definition, task, JSON result, stderr, resume messages, state, and launch scripts live under the parent Pi session artifact directory. AGY starts in the resolved child cwd. The generated-agent root is passed through `--add-dir`; when the resolved parent Pi cwd differs, it is passed exactly once as another added workspace. Workspace roots come only from these runtime values, never task text, profile prose, referenced paths, or model output. Neither repository nor global AGY configuration is modified.

AGY runs with `--output-format json`, the effective `--model`, and profile `thinking` mapped directly to `--effort`. AGY owns model/effort compatibility errors. The extension never passes `--dangerously-skip-permissions`. With no user permission override, AGY's workspace-read defaults allow the four granted reads without prompting, and headless AGY soft-denies reads outside the workspace roots; explicit user `ask` or `deny` rules can supersede that default and are not bypassed. A non-empty `denied_actions` result is a provider failure even when the envelope says `SUCCESS`; the diagnostic includes bounded denied-action evidence, the run's workspace roots (child cwd, generated-agent root, and any additional root), a remedy, and bounded stderr.

Reading outside the workspaces requires the operator-managed global policy in `~/.gemini/antigravity-cli/settings.json`: `permissions.allow` containing `read_file(*)`, and `permissions.deny` containing `write_file(*)` plus absolute secret paths. See [AGY permission policy](../README.md#agy-permission-policy) for the snippet and caveats: the policy also governs interactive AGY use, denies every AGY file write, and cannot exclude in-repository secrets because path globs are unsupported. The extension only reads this file. Before each AGY launch or resume it checks for the two rules and, when they are missing or the file is missing, unreadable, or invalid, appends one non-blocking warning line to the acknowledgment.

AGY profiles accept only `name`, `description`, `model`, `thinking`, `cwd`, the Markdown body, `disable-model-invocation`, `cli`, and `builtin-tools`. Explicit `mcp-servers`, `extensions`, `skill` or `skills`, `subagent_agents`, `system-prompt`, `session-mode`, `auto-exit`, and `interactive` fields are invalid, including empty values. `write`, `edit`, `bash`, `powershell`, and `codemode` are also invalid AGY built-ins.

AGY is one-shot. `subagent_message` rejects active steering without pane input. After successful completion, the same runtime name starts a one-shot continuation from the exact persisted conversation and workspace boundary. Terminal `ERROR`, `CANCELLED`, `INTERRUPTED`, waiting/unknown status, malformed JSON, denied actions, empty response, missing conversation ID, non-zero exit, and bounded stderr diagnostics are surfaced as failures without Pi or Claude fallback. A missing pane advertises resume only when a valid prior conversation snapshot, stored cwd, additional workspaces, and generated agent remain replayable.

Use this flat form when AGY must be the only target. For ordered AGY-to-Pi fallback, use the exact `scout` or `flash-reviewer` contract in [Model chains](#model-chains) and retain the profile's existing body. The package does not edit or package external dotfiles.

## Claude CLI limitations

`cli: claude` uses the existing Claude Code launch path rather than a Pi child. It applies `model`, `cwd`, the Markdown body as an appended system prompt, and lifecycle tracking. Pi-specific `skills`, `thinking`, `session-mode`, `system-prompt` mode selection, nested-spawn allowlists, and resume snapshots do not configure Claude Code. Declaring `builtin-tools`, `mcp-servers`, or `extensions` on a `cli: claude` profile is invalid, even when the value is explicitly empty, because those capability fields cannot be enforced for Claude Code. Running Claude children can receive live messages, but finished Claude children cannot be resumed through `subagent_message`. Use `cli: pi` when those isolation and resume guarantees are required.

## Troubleshooting

Run `subagents_list` in the active Pi session. It reports valid visible definitions and includes diagnostics for invalid files. If none are available, create a profile in the reported global directory or in the nearest trusted project `.pi/agents` directory.
