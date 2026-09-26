# Outcome: Allow AGY subagents to read the parent workspace

Work item: `260926-1205-allow-agy-subagents-to-read-the-parent-workspace`
Disposition: Completed
Date: 2026-09-26

## Delivered scope

- Added one resolved parent Pi cwd as an AGY workspace when it differs from the child cwd, while retaining the generated-agent root and child process cwd.
- Added strict AGY resume state version 2 with exact additional-workspace replay and unchanged version 1 compatibility.
- Added fail-closed path validation and actionable bounded `denied_actions` diagnostics without broadening tools or bypassing permissions.
- Updated focused regressions, user documentation, package guidance, and durable wiki guidance.

## Deviations from plan

- None. The separately approval-gated live model lifecycle check was intentionally not run.

## Verification summary

- Focused AGY tests passed (18); full model-free unit suite passed (239).
- Non-model repeatable-`--add-dir` agent discovery, package dry run, Markdown consistency, patch integrity, and item/operational spec validation passed.
- Focused and final contract-quality medium-assurance reviews passed with no blocking findings and no retries.

## Retained, reverted, or transferred work

- All planned source, test, documentation, wiki, and evidence changes were retained. No unrelated paths were changed, reverted, staged, or committed.

## Residual risks

- Live Gemini parent-workspace reading and exact external conversation continuation remain unverified because model-consuming tests require separate approval.
- Future AGY workspace or permission-policy changes may require contract updates; explicit user ask/deny rules remain authoritative.

## Follow-up work items

- None required. A separately approved live lifecycle check may close the recorded external-verification gap.

## Source references

- `pi-extension/subagents/agy.ts`
- `pi-extension/subagents/index.ts`
- `test/test.ts`
- `README.md`
- `docs/agent-definitions.md`
- `verification.md`

## Wiki updates

- Updated `wiki/architecture.md`, `wiki/conventions/runtime-safety.md`, and `wiki/development.md`; recorded the maintenance event in `wiki/log.md`.
