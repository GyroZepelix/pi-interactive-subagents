# Verification: Add system-prompt task option for Pi profiles

Work item: `261112-1521-add-system-prompt-task-option-for-pi-profiles`
Date: 2026-11-12

## Environment

- Mode: direct. Assurance: low (inherited from `plan.md`).
- Starting boundary: `HEAD` `a3ab715`; nothing staged. Item-owned pre-existing changes: `spec/index.md` row and this item directory. Unrelated untracked `spec/backlog.md` left untouched.
- Changed paths: `pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`, `test/test.ts`, `docs/agent-definitions.md`, `README.md`, `skills/subagent-profiles/SKILL.md`, `wiki/conventions/agent-profiles.md`, `wiki/log.md`.
- Tests run inside a subagent with every `PI_SUBAGENT_*` variable unset.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| `npm test` | Pass | 304 tests, 0 failures; includes 3 new tests in `test/test.ts` (`routes a system-prompt: task body ...`, `accepts system-prompt: task on Pi model-chain targets`, `still rejects unknown system-prompt values`). |
| `git diff --check` | Pass | No output. |
| ASCII check on added lines (non-spec) | Pass | No non-ASCII added characters. |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R1 `task` accepted for flat profiles and Pi chain targets; invalid values rejected | `SYSTEM_PROMPT_VALUES` and `SystemPromptMode` in `agents.ts`; parse assertions for flat and chain targets; unknown-value test | Pass |
| R2 body prepended to task; wrapper for standalone/lineage-only, direct in fork; no flag | `prepareAgentLaunch` maps `task` to an unset identity mode; tests assert task text and absent `--append-system-prompt`/`--system-prompt` | Pass |
| R3 loadout `systemPromptMode: null`, `identity: null`; schema unchanged | Tests assert both nulls for lineage-only, standalone, fork, and chain target; `session.ts` untouched | Pass |
| R4 omitted = append; append/replace, Claude, AGY unchanged | Existing default, opt-out, chain-default, and Claude tests pass unchanged; `applyPiProfileDefaults` unchanged | Pass |
| R5 docs and skill document `task`; "no longer available" removed | `docs/agent-definitions.md` field table, defaults note, Body routing; `README.md`; `skills/subagent-profiles/SKILL.md`; wiki convention and log | Pass |

## Review findings

- Completion review (low assurance, independent read-only): PASS, 0 retries. No blockers. One non-blocking note: plan task and progress boxes were unchecked; resolved by checking them after this evidence was recorded.

## Failures and skipped checks

- No repository type-check is configured; none run.
- Integration suite (`npm run test:integration`) not run: it consumes model quota and the change is covered by unit tests of launch preparation and argument construction.

## Unverified areas

- No live Pi child was launched with `system-prompt: task`.
- The pi-cursor motivation in the plan remains unverified and out of scope.
