# Plan: Add system-prompt task option for Pi profiles

Work item: `261112-1521-add-system-prompt-task-option-for-pi-profiles`
Status: Planned
Created: 2026-11-12
Updated: 2026-11-12

Assurance: low - one new explicit enum value that reuses the existing task-wrapper code path and the existing `null` loadout shape; no default changes; easy to revert.

## Goal

A Pi profile can again route its Markdown body into the child's first user message, ahead of the task, by declaring `system-prompt: task`. This restores the pre-`c2bbdb8` behavior as an explicit opt-in while omitted `system-prompt` keeps meaning `append`.

## Context

- Item `261112-1435` (commit `c2bbdb8`) made omitted `system-prompt` mean `append` for Pi, which removed the only way to select body-in-task routing (documented as "no longer available" in `docs/agent-definitions.md` and `skills/subagent-profiles/SKILL.md`).
- Current source: `pi-extension/subagents/agents.ts` `SystemPromptMode = "append" | "replace"` and `SYSTEM_PROMPT_VALUES` (flat profiles and model-chain targets share it); `pi-extension/subagents/index.ts` `applyPiProfileDefaults` fills `append`; `buildSubagentTask` already prepends the body when no system-prompt mode is set; loadout `systemPromptMode`/`identity` use `null` for body-in-task (`pi-extension/subagents/session.ts` validation requires `systemPromptMode === null` exactly when `identity === null`); `applySandboxToParts` maps loadout mode to `--system-prompt` or `--append-system-prompt`.
- Possible motivation (unverified): minified `pi-cursor` appears to replace the system prompt on trivial conversational turns that omit tools, which would drop appended role text but not first-message text.

## Requirements

- R1: `system-prompt` accepts `task` in addition to `append` and `replace` for flat Pi profiles and Pi model-chain targets. Invalid values are still rejected with the existing diagnostics.
- R2: With `task`, the body is prepended to the task exactly as the pre-`c2bbdb8` omitted behavior did: in the task wrapper for `standalone` and `lineage-only`, and to the direct task in `fork` mode. No `--system-prompt` or `--append-system-prompt` flag is passed.
- R3: The loadout records `systemPromptMode: null` and `identity: null` for `task`, so the persisted loadout schema is unchanged and resume behaves like existing body-in-task children.
- R4: Unchanged: omitted `system-prompt` means `append` for Pi; `append` and `replace` behave as now; Claude and AGY behavior is unchanged.
- R5: `docs/agent-definitions.md` (field table, Pi defaults note, body routing), `README.md` where it describes body routing, and `skills/subagent-profiles/SKILL.md` document `task` with when to use it, replacing the "no longer available" statements.

## Out of scope

- Changing any default.
- Changing the loadout schema or resume replay.
- Investigating or working around pi-cursor system-prompt handling.

## Design

- Extend `SystemPromptMode` and `SYSTEM_PROMPT_VALUES` with `task`.
- In launch preparation, derive an "identity in system prompt" mode that is `append` or `replace` only; treat `task` like the old unset mode for `buildSubagentTask`, loadout `systemPromptMode`/`identity`, and flag construction. Keep `applyPiProfileDefaults` filling `append` only when the field is omitted.
- Narrow `buildSubagentTask`'s parameter type accordingly; keep `session.ts` loadout types unchanged.

## Work breakdown

- [x] T01: Accept and route `task` (R1-R4).
  - Expected areas: `pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`.
- [x] T02: Unit tests: frontmatter parse of `task` (flat and chain target), task text contains the body ahead of the task, no system-prompt flag in the launch parts, loadout `systemPromptMode: null` and `identity: null`, fork-mode direct task contains the body; existing append/replace/default tests still pass.
  - Expected areas: `test/test.ts`.
- [x] T03: Docs and skill (R5), plus `wiki/conventions/agent-profiles.md` if it states the accepted values, and `wiki/log.md`.

## Acceptance criteria

- `system-prompt: task` loads without diagnostics and the child's first message contains the body ahead of the task with no system-prompt flag.
- Omitted, `append`, and `replace` behave exactly as at `a3ab715`.
- Docs and skill no longer say body-in-task routing is unavailable.

## Verification plan

- `npm test` (unset `PI_SUBAGENT_*` when running inside a subagent)
- `git diff --check`

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete.
- [x] Verification passed; see `verification.md`.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read this plan and its item.yaml completely.
Implement the work step by step while preserving Requirements, Out of scope, Decision Log, and Verification plan.
Update Progress and the Decision Log when confirmed implementation discoveries change the approach.
Run the specified verification before reporting completion.
Stop and ask before dependencies, migrations, destructive operations, external writes, commits, pushes, or scope expansion.
```
