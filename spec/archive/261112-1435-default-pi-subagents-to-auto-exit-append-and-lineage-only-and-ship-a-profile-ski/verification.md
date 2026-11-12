# Verification: Default Pi subagents to auto-exit, append, and lineage-only, and ship a profile skill

Work item: `261112-1435-default-pi-subagents-to-auto-exit-append-and-lineage-only-and-ship-a-profile-ski`
Date: 2026-11-12

## Environment

- macOS, tmux (shared default server), Node test runner, Pi SDK from the repository `node_modules`.
- Base commit `a3adef5`; all changes unstaged in the working tree. Pre-existing item-owned changes: `spec/index.md` (creation row) and this item directory. Unrelated untracked `spec/backlog.md` left byte-identical (sha1 `c4f564fe...` before and after) and unstaged.
- Mode direct; assurance medium (inherited from `plan.md`).
- The run executed inside a Pi subagent, so every check ran with all `PI_SUBAGENT_*` variables unset.

## Changed paths

- `pi-extension/subagents/index.ts`: `applyPiProfileDefaults` helper (Pi harness only; fills `autoExit ??= true`, `systemPromptMode ??= "append"` when a body exists, `sessionMode ??= "lineage-only"`), applied to the flat definition in `prepareAgentLaunch` and to each model-chain target definition; `PI_SUBAGENT_AUTO_EXIT` now read from the prepared `loadout.autoExit`; helper exported in `__test__`.
- `test/test.ts`: updated one omitted-`auto-exit` loadout expectation to `true`; added AGY session-mode assertions and a `Pi profile defaults for omitted fields` suite (5 tests).
- `test/integration/subagent-lifecycle.test.ts`, `test/integration/agents/test-defaults.md` (new): live test with a profile omitting all three fields.
- `skills/subagent-profiles/SKILL.md` (new), `package.json` (`pi.skills`, `files`).
- `docs/agent-definitions.md`, `README.md`.
- `wiki/conventions/agent-profiles.md`, `wiki/development.md`, `wiki/overview.md`, `wiki/log.md`.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| `npm test` | Pass | 301 pass, 0 fail (only failure before test updates was the intended omitted-`auto-exit` expectation). |
| `npm run test:integration` | 20 of 21 | Failure: `subagent ask_question consumes one answer and continues the same run` timed out on a screen pattern although the flow completed; it uses `test-ping` with explicit `session-mode`, `system-prompt`, and `auto-exit` (unaffected path). New defaults test passed (about 15 s). |
| Isolated rerun of the ask_question test | Pass | `node --test --test-concurrency=1 --test-name-pattern="ask_question consumes" test/integration/subagent-lifecycle.test.ts` (about 15 s). |
| Skill discovery | Pass | Pi `DefaultPackageManager` with the repository as a local package resolved and `loadSkills` loaded `subagent-profiles` with no diagnostics. |
| `npm pack --dry-run --json` | Pass | Includes `skills/subagent-profiles/SKILL.md`. |
| `git diff --check` and ASCII check of new/changed Markdown | Pass | Clean. |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R1 | Unit: defaulted flat profile (`autoExit` true, `append`, `lineage-only`); explicit `auto-exit: false`, `replace`, `standalone`, `fork` honored; helper unit test. | Met |
| R2 | Unit: task wording, loadout `autoExit`/`systemPromptMode`/`identity`, `--append-system-prompt`, seeded mode, `interactive`; env derived from loadout. Integration: child saw `PI_SUBAGENT_AUTO_EXIT=1` and a `parentSession` header; parent received the result. | Met |
| R3 | Unit: defaulted profile non-interactive; explicit `interactive: true` wins. | Met |
| R4 | Unit: Claude profile keeps standalone, no seeding, no prompt mode, interactive default; AGY flat and chain targets stay standalone with no loadout; helper returns Claude/AGY definitions unchanged. | Met |
| R5 | Resume code untouched (`resolveResumeLaunchBehavior`, stored loadout replay); existing resume tests pass. | Met |
| R6 | Skill with narrow frontmatter, all fields with defaults, precedence, isolation note, harness restrictions, pointer to docs; packaged and discovered. | Met |
| R7 | Docs field table, new "Pi defaults for omitted fields" section with change note and opt-outs, body routing, session modes; README note and dry-run list. | Met |

## Review findings

- Contract-quality review (medium assurance, final, direct): PASS, no blocking findings. Retries: 0.
- Non-blocking: plan checkboxes unchecked at review time (resolved here); the chain loop's `applyPiProfileDefaults` call is redundant with the call inside `prepareAgentLaunch` (kept deliberately so the chain `definition` handed to `launchSubagent` carries resolved values; idempotent).

## Failures and skipped checks

- One intermittent screen-scraping integration failure in an unchanged path, passing on isolated rerun.

## Unverified areas

- No live Claude or AGY child launched; their unchanged behavior is covered by launch-preparation unit tests and the helper's harness guard.
- Plan Context states Claude profiles cannot declare `auto-exit`/`system-prompt`/`session-mode`; the parser accepts them for `cli: claude`. The helper skips Claude entirely, so R4 holds either way.
- No type-check is configured in the repository.
