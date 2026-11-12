---
schema_version: 1
episode_id: "2026-11-12-1531-gamemaster-checkpoint-261112-1521-add-system-prompt-task-option-for-pi-profiles-"
timestamp: "2026-11-12T15:31:43+01:00"
summary: "Added an explicit `system-prompt: task` opt-in that routes a Pi profile body into the first message with no system-prompt flag; omitted still means append."
kind: "gamemaster-checkpoint"
status: "shipped"
work_item: "261112-1521-add-system-prompt-task-option-for-pi-profiles"
current: "direct"
topics: ["agent profiles","system-prompt routing"]
---

# Gamemaster checkpoint: 261112-1521-add-system-prompt-task-option-for-pi-profiles/direct

Date: 2026-11-12
Work item: 261112-1521-add-system-prompt-task-option-for-pi-profiles
Status: shipped
In one line: Added an explicit `system-prompt: task` opt-in that routes a Pi profile body into the first message with no system-prompt flag; omitted still means append.

## Goal

Restore body-in-task routing for Pi profiles as an explicit opt-in after item 261112-1435 made omitted `system-prompt` mean `append`, without changing any default, the loadout schema, or Claude and AGY behavior.

## How we approached it

A Gamemaster Twin ran Implement in direct mode at low assurance from `HEAD` `a3ab715`. It added `task` to the parsed `system-prompt` values, and launch preparation maps `task` to an unset identity mode. That reuses the existing task-wrapper path in `buildSubagentTask` (body ahead of the task in `standalone` and `lineage-only`, before the direct task in `fork`) and the existing null loadout shape, so `applySandboxToParts` passes no system-prompt flag. Three unit tests covered flat and chain-target parsing, task text, absent flags, null loadout fields, and rejection of unknown values. Docs, README, the shipped profile skill, and the agent-profiles wiki convention replaced the "no longer available" statements. One independent completion review passed, and the item was archived after parent approval.

## Key decisions

- **Narrow the launch mode instead of the stored type** - added `IdentitySystemPromptMode` (append or replace) for `buildSubagentTask` and the prepared launch, leaving `session.ts` loadout types untouched; rejected a new loadout value because the plan kept the persisted schema and resume replay unchanged.
- **Prepared launch exposes no mode for `task`** - `launch.systemPromptMode` is undefined for `task`, matching the old unset shape; nothing else reads the declared value.

## Current state and where we left off

- Shipped/verified: archived `completed` at `spec/archive/261112-1521-add-system-prompt-task-option-for-pi-profiles/`; source, tests, docs, skill, and wiki edits are unstaged and uncommitted.
- Pending: user-controlled Git checkpoint.

## Source of truth

- `spec/archive/261112-1521-add-system-prompt-task-option-for-pi-profiles/plan.md`: requirements R1-R5 and non-goals.
- `spec/archive/261112-1521-add-system-prompt-task-option-for-pi-profiles/verification.md`: checks, requirement coverage, review verdict.
- `spec/archive/261112-1521-add-system-prompt-task-option-for-pi-profiles/outcome.md`: delivered scope and residual risks.
- `pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`, `test/test.ts`: implementation and tests.

## Verification

- Done: `npm test` with every `PI_SUBAGENT_*` variable unset passed 304 of 304; `git diff --check` clean; added lines ASCII; stale-status sweep zero hits; archive preflight and archive succeeded; completion review PASS with zero retries.
- Not verified yet: no live child launch or integration run with `system-prompt: task`; no type-check is configured. The plan's pi-cursor motivation (system prompt replaced on tool-less turns) remains an unverified hypothesis and was out of scope.

## Open questions, blockers, next safe action

- Open/blocked: `wiki/conventions/agent-profiles.md` now sits slightly above Dream's page word threshold after this item's convention edit; a later run may need a non-growing merge or topic split before adding to it.
- Next safe action: review the unstaged diff and create the user-controlled Git checkpoint.
