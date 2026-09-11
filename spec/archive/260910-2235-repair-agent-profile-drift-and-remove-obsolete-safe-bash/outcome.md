# Outcome: Repair agent profile drift and remove obsolete safe-bash

Work item: `260910-2235-repair-agent-profile-drift-and-remove-obsolete-safe-bash`
Disposition: Completed
Date: 2026-09-11

## Delivered scope

- Synchronized the three repository examples with the approved read-only global scout, researcher, and worker profiles.
- Migrated all four lifecycle fixtures to `builtin-tools` and added model-free production-parser coverage for every repository example and integration profile.
- Removed the unreachable `safe-bash.ts` module, generalized legacy snapshot fixtures, and synchronized current-state wiki guidance.

## Deviations from plan

None. Model-consuming lifecycle tests remained unexecuted under the plan's explicit approval gate.

## Verification summary

The focused profile regression passed, all 199 model-free unit tests passed, package dry-run assertions passed, scoped stale-reference and frontmatter searches passed, Markdown and diff checks passed, and spec validation passed. Two focused reviews and the final contract-quality review returned PASS with no blocking findings and no retries.

## Retained, reverted, or transferred work

Archived historical evidence, global profiles and settings, dependencies, and unrelated repository state were retained unchanged. `wiki/state.md` remained unchanged because no checkpoint, lint, or dedupe state advanced.

## Residual risks

Configured-model lifecycle behavior was not re-executed. Example extension packages remain environment-specific. The production parser regression, lifecycle fixture inspection, legacy replay tests, complete unit suite, and independent reviews limit this residual uncertainty.

## Follow-up work items

None required. Model-consuming integration tests may be run later with explicit approval.

## Source references

- `agent-examples/{scout,researcher,worker}.md`
- `test/integration/agents/*.md`
- `test/test.ts`
- `pi-extension/subagents/agents.ts`
- `pi-extension/subagents/index.ts`
- `package.json`
- `verification.md`

## Wiki updates

Updated `wiki/map.md`, `wiki/architecture.md`, `wiki/conventions/index.md`, `wiki/conventions/runtime-safety.md`, and `wiki/conventions/typescript-modules.md`; appended the source-grounded maintenance entry to `wiki/log.md`.
