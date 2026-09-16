# Outcome: Stop child generation after ask_question

Work item: `260916-2339-stop-child-generation-after-ask-question`
Disposition: Completed
Date: 2026-09-16

## Delivered scope

Implemented a blocking, correlated `ask_question` rendezvous. The child atomically publishes one versioned question, contains private answer input, acknowledges only the matching ID, returns the exact answer as the pending tool result, and continues the same agent run. Parent routing uses the existing stdin-backed tmux transport with exact acknowledgment, duplicate suppression, bounded unconfirmed delivery, and matching interruption cleanup.

## Deviations from plan

None. The superseded terminating-result attempt was replaced as required by R001. The approved live test used the user-requested `openai-codex/gpt-5.5` runtime override without changing permanent configuration.

## Verification summary

All 215 model-free unit tests, 9 tmux-surface tests, package dry-run, operational spec validation, Markdown checks, and patch-integrity checks passed. The separately approved focused GPT-5.5 lifecycle test passed and proved question notification, parent answer delivery, matching acknowledgment, same-run continuation, and exactly-once completion. Focused and final contract-quality reviews passed with no blockers and no review retries.

## Retained, reverted, or transferred work

Retained the existing watcher, safe tmux submission, generic steering, finished-session resume, capability isolation, and runtime-name behavior. Replaced only the planned-item's superseded `terminate: true` source, test, and documentation behavior. No work was transferred.

## Residual risks

No unverified risk remains within the confirmed scope. Multiple simultaneous questions per child, sibling-tool rollback, and automatic replay after ambiguous delivery remain intentionally out of scope.

## Follow-up work items

None.

## Source references

- `pi-extension/subagents/question-protocol.ts`
- `pi-extension/subagents/subagent-runtime-control.ts`
- `pi-extension/subagents/index.ts`
- `test/test.ts`
- `test/integration/subagent-lifecycle.test.ts`
- `verification.md`
- `refinements/R001.md`

## Wiki updates

Updated `wiki/architecture.md` with the correlated blocking rendezvous and exact-acknowledgment flow. Updated `wiki/log.md` with the durable maintenance record; `wiki/state.md` did not require a checkpoint change.
