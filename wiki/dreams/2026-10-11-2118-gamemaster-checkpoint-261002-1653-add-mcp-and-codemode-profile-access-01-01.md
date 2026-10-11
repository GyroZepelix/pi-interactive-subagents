---
schema_version: 1
episode_id: "2026-10-11-2118-gamemaster-checkpoint-261002-1653-add-mcp-and-codemode-profile-access-01-01"
timestamp: "2026-10-11T21:18:55+09:00"
summary: "Completed and independently reviewed the Pi 1.0 capability-domain slice with trusted non-secret MCP server identity resolution; runtime and replay work remain pending."
kind: "gamemaster-checkpoint"
status: "partial"
work_item: "261002-1653-add-mcp-and-codemode-profile-access"
current: "01.01"
topics: ["mcp","agent-profiles","capability-isolation"]
---

# Gamemaster checkpoint: 261002-1653-add-mcp-and-codemode-profile-access/01.01

Date: 2026-10-11
Work item: 261002-1653-add-mcp-and-codemode-profile-access
Status: partial
In one line: Completed and independently reviewed the Pi 1.0 capability-domain slice with trusted non-secret MCP server identity resolution; runtime and replay work remain pending.

## Goal

Establish the Pi 1.0 dependency baseline and a fail-closed canonical representation for flat-Pi codemode and exact MCP server grants before runtime launch and replay consume those capabilities.

## How we approached it

The implementation first obtained the required dependency and lockfile approval, upgraded the Pi coding-agent and TUI baseline, then extended profile parsing with flat-Pi-only codemode and MCP fields. A package-owned MCP configuration module now reads only the active trusted global/project sources, validates selected entries and relevant namespace collisions, normalizes semantic configuration, and emits ordered source identities with SHA-256 digests rather than config bodies. Focused fixtures covered trust, project precedence, tombstones, runtime-cwd independence, expression non-evaluation, and digest behavior. Full checks and separate focused, Standards, and Spec reviews completed before the slice advanced.

## Key decisions

- **Persist non-secret identity only** - chose ordered server name, canonical source path, source scope, and semantic digest because later resume must detect capability drift without copying config bodies or resolved credentials.
- **Keep project precedence tied to the parent context** - chose discovery-time resolution from the active trusted project because a child runtime cwd override must not recompute or broaden the grant.
- **Derive only required active support tools** - corrected direct-only exposure to require no active codemode or tool-search support because direct tools need neither indirect mechanism.
- **Defer durable current-state wiki guidance** - retained this slice as episodic recall because runtime filtering, replay, documentation, and final verification remain assigned to later Currents.

## What did not work

- **First focused test invocation inherited the nested-agent allowlist** - four unrelated public discovery assertions failed because the current subagent environment filtered visible profiles; rerunning with that variable unset restored the repository's documented top-level test boundary.
- **Initial direct-exposure support derivation was too broad** - it would have marked codemode required for a direct-only MCP profile; the correction and a regression assertion passed all affected checks and targeted re-reviews.

## Current state and where we left off

- Shipped/verified: Current 01.01 is checked complete; Pi 1.0+ metadata, flat-Pi syntax, trusted MCP resolution, semantic digesting, fail-closed diagnostics, and non-secret identity objects passed the T01 segment gate.
- Pending: Current 02.01 must implement loadout version 2, filtered child MCP runtime construction, shared launch/resume preflight, and exposure-safe activation; 02.02 retains process-level isolation proof and durable documentation.

## Source of truth

- spec/active/261002-1653-add-mcp-and-codemode-profile-access/implementation/01-01-capability-domain.md: completion evidence, checks, review verdicts, and retry record.
- spec/active/261002-1653-add-mcp-and-codemode-profile-access/implementation/index.md: completed 01.01 identity and Current 02.01 handoff.
- pi-extension/subagents/mcp-config.ts: canonical validation, normalization, digest, trust, and source-reference behavior.
- pi-extension/subagents/agents.ts: profile parsing and discovery integration.

## Verification

- Done: focused discovery and MCP tests passed 77/77; the full unit suite passed 257/257; dependency-tree inspection, spec validation, Markdown fence checks, and diff checks passed; focused, Standards, and Spec reviews passed initially and after targeted retry 1.
- Not verified yet: child MCP connection isolation, runtime exposure preservation, loadout version 2 replay, and process-level marker behavior belong to Currents 02.01 and 02.02; no model-consuming lifecycle test ran.

## Open questions, blockers, next safe action

- Open/blocked: no blocker remains for the completed slice; runtime and replay acceptance are intentionally unproven until T02.
- Next safe action: start a fresh Implement invocation for Current 02.01 from its packet without beginning 02.02 or changing the approved capability contract.
