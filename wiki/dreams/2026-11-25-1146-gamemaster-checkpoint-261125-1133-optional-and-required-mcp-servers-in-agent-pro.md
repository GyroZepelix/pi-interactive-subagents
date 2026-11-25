---
schema_version: 1
episode_id: "2026-11-25-1146-gamemaster-checkpoint-261125-1133-optional-and-required-mcp-servers-in-agent-pro"
timestamp: "2026-11-25T11:46:39+01:00"
summary: "Implemented and archived optional-by-default MCP servers in flat Pi profiles with a strict required mapping, silent skip of missing or disabled optional servers, and a subagents_list note, at medium assurance with a passing contract-quality review."
kind: "gamemaster-checkpoint"
status: "shipped"
work_item: "261125-1133-optional-and-required-mcp-servers-in-agent-profiles"
current: "direct"
topics: ["mcp servers","agent profiles"]
---

# Gamemaster checkpoint: 261125-1133-optional-and-required-mcp-servers-in-agent-profiles/direct

Date: 2026-11-25
Work item: 261125-1133-optional-and-required-mcp-servers-in-agent-profiles
Status: shipped
In one line: Implemented and archived optional-by-default MCP servers in flat Pi profiles with a strict required mapping, silent skip of missing or disabled optional servers, and a subagents_list note, at medium assurance with a passing contract-quality review.

## Goal

Let a flat Pi profile list MCP servers that are optional by default, so a server that is missing or disabled on the host no longer blocks the launch. A `required: true` entry keeps the old fail-closed behavior, and `subagents_list` shows the parent and the user which optional servers are unavailable.

## How we approached it

The Twin ran Implement in direct mode from HEAD 9609587 over T01-T03. T01 replaced the generic list parser for `mcp-servers` with a dedicated `mcpServerList`. It accepts comma strings and YAML arrays of strings or `{ name, required }` mappings, enforces strict keys and boolean `required`, collapses same-required duplicates, and rejects conflicting duplicates. `ParsedAgentDefinition` keeps `mcpServers` and gains `requiredMcpServers`. `resolveMcpServerReferences` gained an opt-in `{ optional }` option that routes only the not-configured and disabled branches into `skippedOptional`; discovery stores the result as `AgentDefinition.mcpServersUnavailable`. The two existing fail-closed tests were rewritten to `required: true`, and optional variants were added for ambient, project-tombstone, and registry cases. T02 added an `unavailableMcpSuffix` helper used by both the `subagents_list` content and `renderResult`, with a test through the registered tool. T03 updated the agent definitions doc, the README, the shipped profile skill, and the agent-profiles wiki convention. One contract-quality review passed. A trivial non-blocking alignment on the model-chain definition path was applied and rechecked. The item was archived with terminal approval.

## Key decisions

- **Kept `mcpServers: string[]` plus a required set** - smallest change, because launch, loadout, and resume consume only resolved references. A normalized entry array was rejected because it would touch more consumers.
- **Resolver stays fail-closed by default** - names are skippable only when the caller passes them as optional, so the integration test and other direct callers keep strict behavior.
- **Only not-configured and disabled are skippable** - every other error (invalid config, malformed source, namespace collision, provider auth, invalid name) stays fatal for optional entries too (plan D2).

## What did not work

- **First `npm test` inside the Twin** - unrelated spawn and list tests failed with `agent not in allowlist` because the parent subagent environment leaked `PI_*` variables. Running with every `PI_*` variable unset gave the expected result, in which only the two planned fail-closed tests failed. Existing development guidance already covers this.

## Current state and where we left off

- Shipped/verified: the item is archived at `spec/archive/261125-1133-optional-and-required-mcp-servers-in-agent-profiles/` with plan, verification, and outcome. Source, test, docs, skill, and wiki edits are uncommitted.
- Pending: a user-controlled Git checkpoint. There are no backlog candidates.

## Source of truth

- `spec/archive/261125-1133-optional-and-required-mcp-servers-in-agent-profiles/plan.md`: canonical contract R1-R10 and D1-D4.
- `spec/archive/261125-1133-optional-and-required-mcp-servers-in-agent-profiles/verification.md`: checks, requirement coverage, and the review.
- `spec/archive/261125-1133-optional-and-required-mcp-servers-in-agent-profiles/outcome.md`: delivered scope and residual risks.
- `pi-extension/subagents/agents.ts`, `pi-extension/subagents/mcp-config.ts`, `pi-extension/subagents/index.ts`: parser, resolver option, discovery field, and list suffix.

## Verification

- Done: `npm test` passed 337/337 and the MCP capability integration suite passed 4/4, both with `PI_*` unset. `git diff --check` was clean, the contract-quality review passed with 0 retries, `archive --check` was valid, and the stale-status sweep had 0 hits.
- Not verified yet: the model-consuming lifecycle suite, the tmux-surface suite, and a manual `subagents_list` check with a real global profile. The repository has no `tsc` type-check.
- Remaining gate violations: none.

## Open questions, blockers, next safe action

- Open/blocked: none.
- Next safe action: review the uncommitted diff and create a user-controlled Git checkpoint.

## Dynamic knowledge trail

- `wiki/architecture.md`: one stale-fact correction.
