# Outcome: Add Antigravity harness support

Work item: `260925-1525-add-antigravity-harness-support`
Disposition: Completed
Date: 2026-09-25

## Delivered scope

- Added `cli: agy` with fail-closed harness-specific profile validation and exact ordered translation of `read`, `grep`, `find`, and `ls` to AGY's four native read tools.
- Added isolated, collision-resistant generated primary-agent, task, result, stderr, state, launch-script, and resume artifacts under the parent session.
- Added executable preflight, headless JSON command construction, strict terminal result/usage parsing, external running status, automatic result delivery, and no dangerous permission bypass.
- Added a backward-compatible tagged name-registry entry and strict immutable AGY snapshot for exact completed-conversation continuation without rereading profiles.
- Rejected active AGY steering, malformed or unavailable resume state, and non-success results before any fallback or capability broadening.
- Published the supported contract and exact scout/flash-reviewer migration forms in user documentation and durable wiki guidance.
- Added focused regression coverage while preserving existing Pi and Claude behavior.

## Deviations from plan

None. The plan explicitly kept live model-consuming verification behind separate approval, which was not granted.

## Verification summary

- 237 unit/source regression tests passed.
- 9 controlled non-model tmux surface tests passed.
- AGY 1.2.11 discovered generated four-tool and empty-tool primary agents in two temporary non-model probes.
- Package allowlist, Markdown paths/fences, stale-claim search, patch integrity, item validation, operational spec validation, and archive preflight passed.
- The medium-assurance focused review and its targeted re-review passed with no blockers; the final contract-quality review passed with no blockers.

## Retained, reverted, or transferred work

All in-scope implementation, tests, documentation, wiki updates, and evidence were retained. No unrelated work was reverted or transferred.

## Residual risks

- The live Gemini lifecycle, prompt-free workspace reads, response delivery, and exact resume were not run because separate approval was not granted; this is a limitation, not permission.
- Future AGY tool/model/output or user permission-policy changes may require contract updates.
- A hard parent-process crash could leave an orphaned AGY pane while another process addresses the same persisted conversation; in-process claims and all normal resume paths remain fail-closed.

## Follow-up work items

- Optionally run the separately approval-gated live Gemini lifecycle/read/resume suite in a future session.
- Revisit persistent cross-process conversation locking only if hard-crash orphan recovery becomes a concrete requirement.

## Source references

- `pi-extension/subagents/agy.ts`
- `pi-extension/subagents/agents.ts`
- `pi-extension/subagents/index.ts`
- `pi-extension/subagents/session.ts`
- `pi-extension/subagents/status.ts`
- `test/test.ts`
- `README.md`
- `docs/agent-definitions.md`
- `verification.md`

## Wiki updates

Updated architecture, repository map, development verification tiers, agent-profile conventions, runtime-safety conventions, and the wiki maintenance log. `wiki/state.md` remained unchanged because no ingest, lint, dedupe, or Git checkpoint advanced.
