# Outcome: Configurable model fallback

Work item: `260926-1248-configurable-model-fallback`
Disposition: Completed
Date: 2026-09-26

## Delivered scope

- Added the optional strict `model-chain` profile contract for ordered AGY and Pi targets with shared read-oriented role fields and target-local provider settings.
- Added complete preflight preparation, exact target extension resolution, bounded structured exhaustion classification, sequential fresh-attempt orchestration, one logical widget/result flow, and aggregate provenance.
- Added strict chain registry/sidecar ownership, failed-attempt non-resume, atomic native winner replacement, and native-only later continuation.
- Published exact scout and flash-reviewer forms, migrated the repository scout example, updated durable wiki guidance, and retained flat Pi, Claude, and AGY behavior.

## Deviations from plan

None. Model-consuming provider checks remained behind their explicit approval gate as planned.

## Verification summary

- Model-free unit suite: 252 passed, 0 failed.
- Controlled tmux surface suite: 9 passed, 0 failed.
- Package dry-run, Markdown/profile checks, patch integrity, selected-item validation, and operational spec validation passed.
- The initial focused review identified three blockers; all were corrected. Focused retry 1 and the final Contract-quality review passed with no remaining findings.

## Retained, reverted, or transferred work

All plan-conforming source, test, documentation, example, wiki, verification, and outcome changes were retained. No work was reverted or transferred. The unrelated active item `260926-1351-add-trusted-agy-any-read-profiles` changed concurrently after this item's verification; this work did not edit it, and its current state and index row are preserved and excluded from this checkpoint.

## Residual risks

- Live provider exhaustion, switching, and native winner continuation were not exercised without separate model-consuming approval.
- Bare 429 and resource exhaustion can represent temporary throttling; this accepted ambiguity is documented.
- Pi target extensions remain complete trusted executable grants.
- Hard parent-process chain recovery remains out of scope.

## Follow-up work items

None required. A separately approved live-provider verification can be run if operational evidence is later desired.

## Source references

- `pi-extension/subagents/agents.ts`
- `pi-extension/subagents/model-chain.ts`
- `pi-extension/subagents/index.ts`
- `pi-extension/subagents/agy.ts`
- `pi-extension/subagents/session.ts`
- `test/test.ts`
- `README.md`
- `docs/agent-definitions.md`
- `agent-examples/scout.md`
- `verification.md`

## Wiki updates

Updated `wiki/map.md`, `wiki/architecture.md`, `wiki/development.md`, `wiki/conventions/agent-profiles.md`, `wiki/conventions/runtime-safety.md`, and `wiki/log.md` with the established chain architecture, safety, profile, and test contracts.
