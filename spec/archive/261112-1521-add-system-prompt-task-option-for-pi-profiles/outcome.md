# Outcome: Add system-prompt task option for Pi profiles

Work item: `261112-1521-add-system-prompt-task-option-for-pi-profiles`
Disposition: completed
Date: 2026-11-12

## Delivered scope

- `system-prompt: task` is accepted for flat Pi profiles and `cli: pi` model-chain targets.
- With `task`, the body goes into the first message ahead of the task (task wrapper in `standalone` and `lineage-only`, direct task in `fork`). No system-prompt flag is passed, and the loadout records `systemPromptMode: null` and `identity: null`.
- Defaults are unchanged (omitted still means `append` for Pi). `append`, `replace`, Claude, and AGY behavior are unchanged.
- `docs/agent-definitions.md`, `README.md`, and `skills/subagent-profiles/SKILL.md` document `task`, replacing the statements that body-in-task routing was no longer available.

## Deviations from plan

None.

## Verification summary

- `npm test`: 304 passed, 0 failed (3 new tests).
- `git diff --check`: clean.
- Independent completion review: PASS, 0 retries.
- Details: `verification.md`.

## Retained, reverted, or transferred work

All work retained. Nothing reverted or transferred.

## Residual risks

- No live child or integration run with `system-prompt: task`.
- No type-checker is configured in the repository.

## Follow-up work items

None.

## Source references

- `pi-extension/subagents/agents.ts`
- `pi-extension/subagents/index.ts`
- `test/test.ts`
- `docs/agent-definitions.md`, `README.md`, `skills/subagent-profiles/SKILL.md`

## Wiki updates

- `wiki/conventions/agent-profiles.md`: replaced the statement that a Pi profile body is no longer placed in the task wrapper with the `system-prompt: task` opt-in.
- `wiki/log.md`: appended the `Pi system-prompt task opt-in` update entry.
