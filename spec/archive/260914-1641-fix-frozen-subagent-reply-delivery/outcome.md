# Outcome: Fix frozen subagent reply delivery

Work item: `260914-1641-fix-frozen-subagent-reply-delivery`
Disposition: completed
Date: 2026-09-14

## Delivered scope

- Replaced large live-message `send-keys` bursts with UUID-qualified tmux buffers loaded from stdin, application-negotiated bracketed paste, buffer deletion, and separate Enter submission.
- Added bounded activity-based acknowledgment for waiting Pi children, with accurate `delivered`, `submitted`, and `unconfirmed` results.
- Prevented child auto-exit while Pi owns pending messages.
- Added confirmed missing-pane interruption handling that releases running state while preserving Pi same-name resume.
- Documented explicit, non-automatic recovery for ambiguous delivery.
- Added unit and no-model tmux regression coverage for large UTF-8 input, exact single submission, responsiveness, cleanup, timeout, lifecycle ordering, and pane removal.

## Deviations from plan

No contract deviations. The optional model-consuming lifecycle suite was not run because explicit approval was not provided.

## Verification summary

- Unit suite: PASS, 211/211.
- tmux surface suite: PASS, 9/9 in a disposable session.
- 4,283-byte UTF-8 transport checks: PASS with the installed Kiro wrapper and in a separate wrapper-bypass tmux server.
- Package dry run: PASS, 17 allowed files.
- Dependency, patch-integrity, Markdown, operational spec validation, and archive-preflight checks: PASS.
- Focused T01–T03 review: PASS, zero retries.
- Final contract-quality review: PASS, zero retries.
- Detailed evidence: `verification.md`.

## Retained, reverted, or transferred work

Incomplete same-item edits left by the interrupted implementation attempt were inspected, corrected, and incorporated into the verified result. No implementation work was reverted or transferred. Unrelated pre-existing changes were preserved byte-for-byte, and nothing was staged or committed.

## Residual risks

- No model-backed waiting Pi lifecycle was exercised; required no-model transport and deterministic lifecycle seams passed.
- The 2.5-second waiting-child acknowledgment timeout may produce false negatives on a loaded host. Such cases intentionally report `unconfirmed` and never trigger automatic replay or termination.
- Interrupted-result details omit `resumeSupported`, although user-facing Pi and Claude recovery wording is correct.

## Follow-up work items

No required follow-up. Optional work:

- Run `node --test --test-concurrency=1 test/integration/subagent-lifecycle.test.ts` only with explicit model-use approval.
- Reconcile stale summary wording in `wiki/index.md` and `wiki/conventions/index.md` in a separately approved documentation change.

## Source references

- `pi-extension/subagents/tmux.ts`
- `pi-extension/subagents/index.ts`
- `pi-extension/subagents/subagent-runtime-control.ts`
- `test/test.ts`
- `test/integration/tmux-surface.test.ts`
- `test/integration/fixtures/bracketed-paste-recorder.mjs`
- `README.md`
- `plan.md`
- `verification.md`

## Wiki updates

Updated only the plan-authorized durable guidance:

- `wiki/architecture.md`
- `wiki/development.md`
- `wiki/conventions/runtime-safety.md`

These pages now describe bracketed live transport, acknowledgment limits, pending-message auto-exit protection, and operator-controlled recovery.
