# Plan: Optional and required MCP servers in agent profiles

Work item: `261125-1133-optional-and-required-mcp-servers-in-agent-profiles`
Status: Planned
Created: 2026-11-25
Updated: 2026-11-25

Assurance: medium - flips the default for every existing profile that declares `mcp-servers` (missing servers stop failing the launch), and touches the parser, resolver, `subagents_list` output, docs, the shipped skill, and tests. Rollback is practical, and the failure mode only removes access.

## Goal

A flat Pi profile can list MCP servers that are optional by default. When an optional server is not configured on the host, or is disabled, the subagent still launches without that server. A server marked `required: true` keeps the current behavior: the profile is excluded with a diagnostic and the spawn fails before a pane is created. `subagents_list` tells both the parent agent and the user which optional servers are unavailable.

## Context

- `mcp-servers` is parsed in `pi-extension/subagents/agents.ts` `parseAgentDefinition` through `stringList` (comma string or YAML string array, deduplicated). It is stored as `ParsedAgentDefinition.mcpServers: string[]`.
- `discoverAgentDefinitions` (end of `agents.ts`) calls `resolveMcpServerReferences` in `pi-extension/subagents/mcp-config.ts`. That call returns all-or-nothing: any error excludes the profile with `mcp-servers` diagnostics.
- Resolution order: profile registries, then global `mcp.json`, then trusted project `.pi/mcp.json`. The first source that defines a name wins, and a disabled entry never falls through to a later source.
- Only the resolved `mcpServerReferences` and `mcpSupportTools` reach launch, loadout capture, and resume (`index.ts`, `verifyMcpServerReferences`). A skipped server never enters the grant, so resume needs no change.
- `subagents_list` (`index.ts`, around `registerTool({ name: "subagents_list"`) builds model-visible `content` lines and a separate `renderResult` for the TUI. Today the renderer omits diagnostics when agents exist.
- Existing fail-closed tests that encode "missing/disabled fails" live in `test/test.ts` ("fails MCP discovery closed for project tombstones..." and "rejects disabled, missing, colliding, provider-auth, and unreadable registry MCP entries").

## Requirements

- R1 Syntax: `mcp-servers` accepts plain string entries and mapping entries `{ name: <string>, required: <boolean> }`, mixed in one YAML array. A mapping requires a `name` that passes the existing name rule (`^[A-Za-z0-9_-]+$`). `required` is optional and must be a strict boolean (`true`/`false`). Any other mapping key, a missing or invalid `name`, a non-boolean `required`, or an entry that is neither a string nor a mapping invalidates the profile with an `mcp-servers` diagnostic.
- R2 Defaults: plain string entries and mappings without `required` are optional. Comma-delimited strings keep working, and every entry they produce is optional. A missing or empty field still grants nothing.
- R3 Duplicates: entries for the same name with the same required-ness collapse into the first occurrence, preserving order. If the same name appears with conflicting required-ness, the profile is invalid.
- R4 Optional skip: an optional server is left out of the grant, without a diagnostic, when (a) no permitted source defines the name, or (b) the first source that defines it has `enabled: false`. A disabled registry entry or project tombstone still never falls through to a later source.
- R5 Still fatal for every server, optional or required: invalid server config, a malformed or unreadable source file, a `-`/`_` namespace collision (selected or configured), registry provider `auth`, and invalid names. This matches current behavior.
- R6 Required: with `required: true`, a missing or disabled server excludes the profile with the current diagnostic text, so the spawn fails before pane creation.
- R7 Support tools: skipped servers do not contribute to `codemode`/`tool-search` support-tool derivation.
- R8 Reporting: each discovered agent records its skipped optional server names in declared order. `subagents_list` appends ` (optional MCP unavailable: a, b)` to affected agent lines in both the model-visible `content` and `renderResult`. Agents with no skipped servers render exactly as today. The spawn acknowledgment, child task, loadout, and resume are unchanged.
- R9 Harness restrictions are unchanged: Claude, AGY, and model-chain profiles reject `mcp-servers`, including empty values and the new mapping form.
- R10 Docs: `docs/agent-definitions.md` (field table, the "Codemode and MCP server selection" section, and the registry paragraph that says a disabled registry MCP server excludes the profile), the README "Codemode and MCP server grants" section, `skills/subagent-profiles/SKILL.md`, and `wiki/conventions/agent-profiles.md` describe the optional default, the `required` form, the skip conditions, and the list note. The skill must not contradict `docs/agent-definitions.md`.

## Out of scope

- Reporting skipped servers in the spawn acknowledgment, the child task wrapper, or the child's system prompt.
- Treating connection or authentication failures at child runtime as skippable. Resolution stays read-only and never connects.
- Changing resume or loadout semantics, or re-resolving optional servers on resume.
- Per-tool MCP selection, wildcards, or MCP support for Claude, AGY, or model-chain profiles.
- New dependencies, migrations, commits, pushes, or unrelated cleanup.

## Design

- Parsing (`agents.ts`): replace the `stringList` call for `mcp-servers` with a dedicated parser. It accepts the existing comma string or a YAML array of strings or mappings. YAML array strings keep the existing no-comma rule. Store a normalized ordered list, for example `mcpServers: { name: string; required: boolean }[]`, or keep `mcpServers: string[]` plus a `requiredMcpServers` set. The implementer chooses whichever is the smaller coherent change. Any `hasOwn(frontmatter, "mcp-servers")` harness rejection stays as is.
- Resolution (`mcp-config.ts`): extend `resolveMcpServerReferences` so the caller can mark names optional, for example by accepting the normalized entries or a required-name set. For an optional name, the "not configured" and "disabled" branches push the name onto a `skipped` list instead of `errors`. All other branches are unchanged. The success result adds `skippedOptional: string[]`. Keep the source-error early return fatal (R5).
- Discovery (`agents.ts`): store `skippedOptional` on `AgentDefinition`, for example `mcpServersUnavailable: string[]`, defaulting to `[]` for agents without MCP resolution and for the non-extension discovery branch.
- Listing (`index.ts` `subagents_list`): append the suffix to both the `content` line builder and the `renderResult` line builder. Use dim theme styling in the renderer.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D1 | Syntax | Per-entry mapping `{ name, required }` inside `mcp-servers` | Matches the user's "required: true property" request. Keeps one field. | User answer, grouped round | Users need other per-server options |
| D2 | Skip set | Only "not configured" and "disabled" are skippable | These mean the server is absent. Other errors indicate misconfiguration and stay loud. | User answer; `resolveMcpServerReferences` branches | Users report noisy failures from optional servers |
| D3 | Visibility | `subagents_list` only, both agent and user channels | The parent can avoid delegating work the child cannot do, and the user sees it in the TUI. The cost is negligible. | User answer, follow-up round | Parents still spawn agents that lack the needed servers |
| D4 | Duplicates | Same required-ness collapses; conflicting required-ness invalidates | Keeps the existing dedupe behavior and avoids an ambiguous grant | Contract C2 | None expected |

## Work breakdown

- [x] T01: Parse and resolve optional and required MCP entries
  - Depends on: none
  - Scope: R1-R7, R9 in `agents.ts` and `mcp-config.ts`, plus focused unit tests.
  - Expected areas: `pi-extension/subagents/agents.ts`, `pi-extension/subagents/mcp-config.ts`, `test/test.ts`
  - Acceptance: parser tests cover mixed arrays, comma strings, explicit `required: false`, invalid mapping keys, a non-boolean `required`, invalid and missing names, and conflicting duplicates. Discovery tests show that optional missing or disabled servers (ambient, project tombstone, and registry) launch-qualify the profile with the server omitted and recorded as unavailable, and that a disabled first source does not fall through. Existing fail-closed tests are rewritten to `required: true` and still fail. Invalid config, malformed source, namespace collision, and provider `auth` still fail for optional entries. Support tools are derived only from granted servers.
  - Verification: `npm test`
- [x] T02: Report unavailable optional servers in `subagents_list`
  - Depends on: T01
  - Scope: R8 in `index.ts`, plus a focused test of `content` text, and of the render output if an existing seam permits.
  - Expected areas: `pi-extension/subagents/index.ts`, `test/test.ts`
  - Acceptance: an affected agent line ends with `(optional MCP unavailable: <names>)` in `content` and in the rendered text. Unaffected lines are unchanged.
  - Verification: `npm test`
- [x] T03: Update docs, shipped skill, and wiki convention
  - Depends on: T01, T02
  - Scope: R10.
  - Expected areas: `docs/agent-definitions.md`, `README.md`, `skills/subagent-profiles/SKILL.md`, `wiki/conventions/agent-profiles.md`, `wiki/log.md` (an entry for the durable convention change)
  - Acceptance: all four surfaces describe the same semantics with an example of the mapping form, and none still claims that a missing or disabled selection always fails.
  - Verification: `rg -n "mcp-servers|required" docs/agent-definitions.md README.md skills/subagent-profiles/SKILL.md wiki/conventions/agent-profiles.md` and manual consistency read

## Acceptance criteria

- A profile with `mcp-servers: [absent]`, where `absent` is configured nowhere, is listed and launchable, with no MCP grant and the list note `(optional MCP unavailable: absent)`.
- The same profile with `- name: absent\n  required: true` is excluded with the `not configured` diagnostic, as today.
- An optional server disabled in its first defining source is skipped, not granted from a later source.
- Invalid config, a malformed source, a namespace collision, and provider `auth` still exclude profiles that use optional entries.
- Claude, AGY, and model-chain profiles still reject any `mcp-servers` value.
- Docs, README, the shipped skill, and the wiki convention agree.

## Testing decisions and seams

- Use the existing `parseAgentDefinition`, `discoverAgentDefinitions` with `withIsolatedAgentEnv`/`writeAgentFile`, and `hasDiagnostic` helpers in `test/test.ts`.
- If `subagents_list` has no existing direct test seam, test the line formatting through a small exported helper rather than standing up the full extension.
- The integration suite (`test/integration/mcp-capability.test.ts`) does not assert missing-server failure. Run it as a regression check only. Add no new integration test unless a unit seam proves insufficient.

## Verification plan

- `npm test`
- `npm run test:integration` (needs the local Pi runtime. Record it as skipped with the reason if unavailable.)
- `git diff --check`
- Manual: with a temporary global profile listing an unconfigured optional server, `subagents_list` shows the note. Optional; unit coverage is the primary evidence.

## Risks and blockers

- Existing user profiles silently lose fail-closed behavior. Mitigation: document the change and the `required: true` form prominently in the docs and the README.
- Discovery currently runs MCP resolution only when some agent declares servers. Keep that guard so profiles without MCP servers are unaffected.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete (T01-T03).
- [x] Verification recorded in `verification.md`; contract-quality review PASS.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read spec/active/261125-1133-optional-and-required-mcp-servers-in-agent-profiles/plan.md and its item.yaml completely, plus AGENTS.md and wiki/conventions/agent-profiles.md.
Implement T01-T03 in order with medium assurance, preserving Requirements, Out of scope, and the Decision Log.
Make the smallest coherent change. Update Progress and the Decision Log only for confirmed implementation discoveries.
Run the Verification plan and record only verified evidence, failures, and skipped checks.
Stop and ask before dependencies, migrations, destructive operations, external writes, commits, pushes, or scope expansion.
```
