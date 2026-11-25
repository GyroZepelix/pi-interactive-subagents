# Dream learnings: 261125-1133-optional-and-required-mcp-servers-in-agent-profiles

Work item: `261125-1133-optional-and-required-mcp-servers-in-agent-profiles`

> Historical snapshot: this ledger records what Dream retained at each Gamemaster checkpoint. Current source, plans, verification, outcomes, and current dynamic destinations remain authoritative.

<!-- dream-checkpoints:start -->

## Gamemaster checkpoint: 261125-1133-optional-and-required-mcp-servers-in-agent-profiles/direct

Date: 2026-11-25
Dream log: [2026-11-25-1146-gamemaster-checkpoint-261125-1133-optional-and-required-mcp-servers-in-agent-pro.md](../2026-11-25-1146-gamemaster-checkpoint-261125-1133-optional-and-required-mcp-servers-in-agent-pro.md)
Outcome: retained learning

### Pre-pane MCP rejection scope

- **Exact written text:**

````markdown
3. Before pane creation, the extension rejects unknown profiles, unresolved or invalid package extension selections, invalid generated Pi loadouts or runtime overrides, invalid selected MCP entries, missing or disabled MCP entries marked `required: true` (optional ones are skipped and noted by `subagents_list`), source/digest conflicts, self-spawn, missing tmux or parent state, and colliding explicit runtime names (`pi-extension/subagents/agents.ts`, `pi-extension/subagents/mcp-config.ts`, `pi-extension/subagents/index.ts`).
````

- **Destination and classification:** `wiki/architecture.md` - `Topic-specific dynamic knowledge` - `SUPERSEDE`
- **Closest existing guidance:** `wiki/architecture.md:11` "invalid/disabled selected MCP entries" - the replaced clause said that every disabled selection fails; source now skips missing or disabled optional entries.
- **Admission basis:** `stale-fact correction`
- **Session evidence or selection reason:** `resolveMcpServerReferences` `optional` option and discovery wiring in `agents.ts`; unit tests showing optional disabled and missing servers listed with `mcpServersUnavailable` while `required: true` ones are excluded.
- **Expected future benefit:** Agents reasoning about spawn preflight will not assume that a disabled or missing MCP server always blocks a launch, and will look for the `required` flag.
- **Why this tier:** It corrects the existing architecture flow step in place; the full semantics already live in the agent-profiles convention.
