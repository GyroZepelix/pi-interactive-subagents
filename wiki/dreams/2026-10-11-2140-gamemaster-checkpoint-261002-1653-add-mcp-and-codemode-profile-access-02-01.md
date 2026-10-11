---
schema_version: 1
episode_id: "2026-10-11-2140-gamemaster-checkpoint-261002-1653-add-mcp-and-codemode-profile-access-02-01"
timestamp: "2026-10-11T21:40:53+09:00"
summary: "Completed and independently reviewed strict loadout-v2 replay and filtered child MCP runtime construction; process-level isolation proof and documentation remain in 02.02."
kind: "gamemaster-checkpoint"
status: "partial"
work_item: "261002-1653-add-mcp-and-codemode-profile-access"
current: "02.01"
topics: ["mcp","capability-isolation","resume"]
---

# Gamemaster checkpoint: 261002-1653-add-mcp-and-codemode-profile-access/02.01

Date: 2026-10-11
Work item: 261002-1653-add-mcp-and-codemode-profile-access
Status: partial
In one line: Completed and independently reviewed strict loadout-v2 replay and filtered child MCP runtime construction; process-level isolation proof and documentation remain in 02.02.

## Goal

Implement the unit-tested runtime and replay boundary for flat Pi profiles that grant standalone codemode or exact ambient MCP servers, without broadening legacy snapshots or exposing unselected configuration.

## How we approached it

The slice extended the strict snapshot union with version 2, carried only canonical MCP references and required support state through a private capability channel, and added one shared source-and-digest preflight for initial launch and resume. A protected child control revalidates exact entries, reserves selected names, registers them through Pi's public MCP API, and installs Pi's MCP extension with ambient discovery empty. Command construction retains default-deny flags and orders runtime control, optional spawning, explicit built-in support, filtered MCP control, trusted profile extensions, and trailing activation. Activation tracks protected provenance, preserves Pi-native direct and support activation, and uses a capability-version marker so version-1 replay cannot inherit version-2 state. Focused fixtures covered snapshot strictness, non-secret persistence, drift refusal before pane creation, name reservation, trusted additional registrations, and exposure-safe activation.

## Key decisions

- **Use one loadout-driven preflight for launch and resume** - chose exact source, digest, and support revalidation before pane creation so replay cannot silently adopt changed authority.
- **Replace ambient MCP loading rather than filter tools afterward** - chose Pi's public MCP factory with an empty ambient loader because unselected servers must not connect or contribute context.
- **Preserve native activation instead of reconstructing exposure policy** - chose to exclude inactive MCP-control tools from blanket activation while retaining tools Pi already activated directly or for trusted registrations.
- **Keep this checkpoint episodic only** - deferred dynamic wiki guidance because 02.02 still owns process-level isolation proof, user documentation, and whole-plan verification.

## What did not work

- **The first focused test invocation inherited the nested-agent allowlist** - unrelated discovery assertions failed under child filtering; rerunning with the variable unset exercised the repository's intended top-level test boundary.
- **Early activation logic could have lost inherited isolation or native direct activation** - focused source review found both risks before completion; the capability-version marker and preservation of Pi's current active set corrected them and gained regression coverage.
- **A duplicate fallback review could not read the repository under its headless permissions** - the primary independent focused review had already passed, so the denied duplicate produced no evidence or repository change.

## Current state and where we left off

- Shipped/verified: Current 02.01 is checked complete; strict version-2 snapshots, filtered MCP control, shared launch/resume preflight, explicit support loading, legacy compatibility, selected-name reservation, and activation safeguards passed required checks and focused review.
- Pending: Current 02.02 must add non-model external-process marker evidence, verify runtime exposure and resources end to end, update user and durable wiki documentation, and run final segment and whole-plan gates.

## Source of truth

- spec/archive/261002-1653-add-mcp-and-codemode-profile-access/implementation/02-01-runtime-and-replay.md: completion evidence, check results, review verdict, and residual uncertainty.
- spec/archive/261002-1653-add-mcp-and-codemode-profile-access/implementation/index.md: completed 02.01 identity and Current 02.02 handoff.
- pi-extension/subagents/subagent-mcp-control.ts: protected filtered child MCP registration and empty ambient loader.
- pi-extension/subagents/session.ts: strict loadout version 2 and compatibility union.
- pi-extension/subagents/index.ts: shared preflight, capability environment, and command ordering.
- pi-extension/subagents/subagent-capability-activation.ts: provenance-aware activation checkpoints.

## Verification

- Done: focused runtime, discovery, snapshot, activation, tool-registration, and MCP tests passed 105/105; the full unit suite passed 266/266; diff and spec validation passed; the independent focused review passed with no findings and no retries.
- Not verified yet: file-loaded external-process behavior, selected-versus-ambient connection markers, full runtime exposure and resource behavior, package documentation, and whole-plan review remain assigned to 02.02; no configured-model lifecycle test ran.

## Open questions, blockers, next safe action

- Open/blocked: no blocker remains for 02.01; the item remains partial until 02.02 completes its external-process, documentation, and final assurance gates.
- Next safe action: take the user-controlled Git checkpoint, then start a fresh Implement invocation for Current 02.02 without rerunning Dream for 02.01.
