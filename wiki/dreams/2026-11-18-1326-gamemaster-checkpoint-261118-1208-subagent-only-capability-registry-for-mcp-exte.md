---
schema_version: 1
episode_id: "2026-11-18-1326-gamemaster-checkpoint-261118-1208-subagent-only-capability-registry-for-mcp-exte"
timestamp: "2026-11-18T13:26:55+01:00"
summary: "Implemented and archived subagent-only capability registries (packages, MCP, skills), `--skill` skill semantics with `inherit-skills`, and version-3 loadouts at medium assurance."
kind: "gamemaster-checkpoint"
status: "shipped"
work_item: "261118-1208-subagent-only-capability-registry-for-mcp-extensions-and-skills"
current: "direct"
topics: ["capability registry","skills"]
---

# Gamemaster checkpoint: 261118-1208-subagent-only-capability-registry-for-mcp-extensions-and-skills/direct

Date: 2026-11-18
Work item: 261118-1208-subagent-only-capability-registry-for-mcp-extensions-and-skills
Status: shipped
In one line: Implemented and archived subagent-only capability registries (packages, MCP, skills), `--skill` skill semantics with `inherit-skills`, and version-3 loadouts at medium assurance.

## Goal

Let subagent profiles use MCP servers, Pi packages, and skills that the parent never loads, through a Pi-native registry beside the profile directories. Replace startup `/skill:` invocation with `--skill` discoverability and let profiles control ambient skill inheritance.

## How we approached it

The Twin read the Implement skill and the plan, then took a clean-env baseline (304/304). Before coding it resolved the three plan Assumptions from Pi source and SDK probes. It added ordered registry sources to `mcp-config.ts` with `global-registry`/`project-registry` scopes, registry package catalogs and skill contexts in `agents.ts`, v3 loadout validation in `session.ts`, and launch/resume flag and preflight changes in `index.ts`. It replaced the obsolete `buildPiPromptArgs` tests and added focused unit and MCP integration tests, mutation-checked two filters, ran a manual temp-registry check and a read-only mirror of the real agent dir, and updated the docs, README, and shipped skill together. A flash-reviewer contract-quality review passed. The orchestrator approved one lifecycle run (8/8) and terminal archive.

## Key decisions

- **Always pass `--skill`** - SDK probe showed a same-file ambient duplicate loads once silently; rejected skipping ambient names because it breaks runtime-cwd anchoring. Accepted limitation: a different same-named ambient file wins under `inherit-skills: true` (plan D8).
- **Version 3 only when needed** - keeps byte-identical version-2 loadouts for profiles without skills or registry MCP, satisfying the acceptance criterion (D10).
- **Registry MCP scopes reject provider auth** - mirrors Pi's project-file rule (D9).
- **Skills resolved only for flat Pi profiles** - Claude keeps accepting `skills` unused (D11).

## What did not work

- **First OAuth-store integration test** - seeded `mcp-auth.json` with a plain namespace key; Pi keys entries as `mcp__<namespace>|<url>`, so the request went out without a token. Fixed by using Pi's `storeKeys` shape.
- **Unit tests under inherited child env** - one allowlist test failed until `PI_*` variables were unset (known, already in development guidance).

## Current state and where we left off

- Shipped/verified: item archived as completed under `spec/archive/261118-1208-subagent-only-capability-registry-for-mcp-extensions-and-skills/`; working tree changes unstaged and uncommitted.
- Pending: user-controlled Git checkpoint.

## Source of truth

- `spec/archive/261118-1208-subagent-only-capability-registry-for-mcp-extensions-and-skills/plan.md`: requirements and Decision Log D1-D11.
- `spec/archive/261118-1208-subagent-only-capability-registry-for-mcp-extensions-and-skills/verification.md`: checks, coverage, review verdict.
- `spec/archive/261118-1208-subagent-only-capability-registry-for-mcp-extensions-and-skills/outcome.md`: delivered scope and residual risks.
- `pi-extension/subagents/agents.ts`, `mcp-config.ts`, `session.ts`, `index.ts`: implementation.

## Verification

- Done: `npm test` 311/311 (clean env), `mcp-capability.test.ts` 4/4, approved `subagent-lifecycle.test.ts` 8/8, `git diff --check` clean, contract-quality review PASS with 0 retries, archive preflight and archive succeeded.
- Not verified yet: real npm/git registry packages and real `pi mcp login`/`pi install -l` runs (source-verified only); no type-checker exists.
- Remaining gate violations: none.

## Open questions, blockers, next safe action

- Open/blocked: none.
- Next safe action: review the working-tree diff and make a user-controlled Git checkpoint.

## Dynamic knowledge trail

- `wiki/development.md`: Topic-specific dynamic knowledge (MERGE).
