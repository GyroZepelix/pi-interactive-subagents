# Outcome: Default Pi subagents to auto-exit, append, and lineage-only, and ship a profile skill

Work item: `261112-1435-default-pi-subagents-to-auto-exit-append-and-lineage-only-and-ship-a-profile-ski`
Disposition: completed
Date: 2026-11-12

## Delivered scope

- Pi-only omitted-field defaults: `auto-exit: true`, `system-prompt: append`, and `session-mode: lineage-only`, filled by `applyPiProfileDefaults` in `pi-extension/subagents/index.ts` for flat Pi profiles and `cli: pi` model-chain targets. Explicit values are honored unchanged.
- `PI_SUBAGENT_AUTO_EXIT` is now derived from the prepared loadout, so task wording, loadout, launch environment, system-prompt flag, session seeding, and `interactive` all use the resolved values.
- Claude, AGY, and resume behavior are unchanged.
- `subagent-profiles` skill shipped in `skills/subagent-profiles/SKILL.md` through `package.json` `pi.skills` and `files`.
- `docs/agent-definitions.md` and `README.md` describe the new defaults, note the change, and list opt-outs.

## Deviations from plan

- Added one live integration test and fixture (`test/integration/subagent-lifecycle.test.ts`, `test/integration/agents/test-defaults.md`) to prove the first acceptance criterion end to end.
- Routing a Pi profile body into the task wrapper is no longer available; this follows from R1 and is documented.

## Verification summary

- `npm test`: 301 pass, 0 fail.
- `npm run test:integration`: 20 of 21; the one failure (ask_question screen-pattern timeout on an unchanged path) passed on isolated rerun; the new defaults test passed.
- Skill discovery through Pi's package manager: loaded with no diagnostics; `npm pack --dry-run` includes the skill.
- `git diff --check` clean.
- Contract-quality review: PASS, 0 retries, 2 non-blocking notes.
- Details: `verification.md`.

## Retained, reverted, or transferred work

- All changes retained in the working tree, uncommitted.

## Residual risks

- Other users' profiles that relied on omitted fields now behave differently; mitigated by the documented change note and explicit opt-out values.

## Follow-up work items

- Clean up redundant `session-mode: standalone` and `system-prompt: append` lines in the user's profiles (out of scope here; keep `standalone` only where intended).
- B1: project-only profile isolation.

## Source references

- `pi-extension/subagents/index.ts`
- `test/test.ts`, `test/integration/subagent-lifecycle.test.ts`, `test/integration/agents/test-defaults.md`
- `skills/subagent-profiles/SKILL.md`, `package.json`
- `docs/agent-definitions.md`, `README.md`

## Wiki updates

- `wiki/conventions/agent-profiles.md`: Pi defaults, helper location, Claude/AGY/resume behavior, and the shipped skill in the change checklist.
- `wiki/development.md`: skill loaded through `pi.skills`.
- `wiki/overview.md`: package includes the `subagent-profiles` skill.
- `wiki/log.md`: entry for this update.
- Stale-status sweep: 0 hits.
