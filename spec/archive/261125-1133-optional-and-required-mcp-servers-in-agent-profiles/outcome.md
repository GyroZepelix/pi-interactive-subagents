# Outcome: Optional and required MCP servers in agent profiles

Work item: `261125-1133-optional-and-required-mcp-servers-in-agent-profiles`
Disposition: completed
Date: 2026-11-25

## Delivered scope

- In flat Pi profiles, `mcp-servers` accepts plain names, comma strings, and strict `{ name, required }` mappings in one YAML array. Entries are optional by default. Unsupported keys, a non-boolean `required`, invalid or missing names, entries that are neither strings nor mappings, and conflicting required values invalidate the profile. Duplicates with the same required value collapse.
- An optional server that no permitted source defines, or whose first defining source is disabled, is skipped without a diagnostic. A disabled registry entry or project tombstone still never falls through to a later source. Skipped servers grant nothing and add no support tools.
- A server marked `required: true` that is missing or disabled keeps the existing fail-closed diagnostic. Invalid config, malformed sources, namespace collisions, provider `auth`, and invalid names stay fatal for every entry.
- `subagents_list` appends `(optional MCP unavailable: <names>)` to affected lines in its model-visible content and in the TUI render. Unaffected lines are unchanged. The spawn result, child task, loadout, and resume are unchanged.
- Claude, AGY, and model-chain profiles still reject `mcp-servers`, including the mapping form.
- `docs/agent-definitions.md`, `README.md`, `skills/subagent-profiles/SKILL.md`, and `wiki/conventions/agent-profiles.md` describe the same semantics.

## Deviations from plan

None. The plan left the field shape to the implementer. I kept `mcpServers: string[]` and added `requiredMcpServers` and `AgentDefinition.mcpServersUnavailable`. I also gave `resolveMcpServerReferences` an opt-in `{ optional }` option. That option is fail-closed by default and returns `skippedOptional`.

## Verification summary

See `verification.md`. With `PI_*` variables unset, `npm test` passed 337/337, the MCP capability integration suite passed 4/4, and `git diff --check` was clean. The contract-quality review passed with 0 retries. One trivial non-blocking finding was applied and rechecked.

## Retained, reverted, or transferred work

All implementation changes are retained as unstaged edits to the working tree. Nothing was reverted or transferred.

## Residual risks

- Existing profiles lose fail-closed MCP behavior unless they add `required: true`. The README and docs document this as a breaking change.
- The repository has no `tsc` type-check.
- The model-consuming lifecycle integration suite and the tmux-surface suite were not run.

## Follow-up work items

Backlog candidates (not added): none.

## Source references

- `pi-extension/subagents/agents.ts`
- `pi-extension/subagents/mcp-config.ts`
- `pi-extension/subagents/index.ts`
- `test/test.ts`
- `docs/agent-definitions.md`
- `README.md`
- `skills/subagent-profiles/SKILL.md`

## Wiki updates

- `wiki/conventions/agent-profiles.md`: documents optional-by-default MCP entries, the `{ name, required }` form, the skip conditions, the errors that stay fatal, the resolver option, and the list note. It replaces the claim that every missing or disabled selection fails.
- `wiki/log.md`: adds an update entry for this durable convention change.
- Stale-status sweep: 0 hits.
