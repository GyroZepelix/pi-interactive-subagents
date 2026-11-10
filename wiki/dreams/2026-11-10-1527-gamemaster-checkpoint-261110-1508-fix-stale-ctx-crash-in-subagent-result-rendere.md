---
schema_version: 1
episode_id: "2026-11-10-1527-gamemaster-checkpoint-261110-1508-fix-stale-ctx-crash-in-subagent-result-rendere"
timestamp: "2026-11-10T15:27:46+01:00"
summary: "Fixed the pi crash caused by a stale extension ctx in the subagent_result renderer and by late watcher deliveries after session replacement; the item was verified and archived as completed."
kind: "gamemaster-checkpoint"
status: "shipped"
work_item: "261110-1508-fix-stale-ctx-crash-in-subagent-result-renderer"
current: "direct"
topics: ["stale extension ctx","session lifecycle"]
---

# Gamemaster checkpoint: 261110-1508-fix-stale-ctx-crash-in-subagent-result-renderer/direct

Date: 2026-11-10
Work item: 261110-1508-fix-stale-ctx-crash-in-subagent-result-renderer
Status: shipped
In one line: Fixed the pi crash caused by a stale extension ctx in the subagent_result renderer and by late watcher deliveries after session replacement; the item was verified and archived as completed.

## Goal

Stop pi from crashing when a session is replaced or reloaded (`/new`, `/resume`, `/fork`, `/reload`) while the chat holds `subagent_result` messages or subagents are still running. The user had observed the crash, including on `/reload` with a running subagent.

## How we approached it

The Implement Twin ran the confirmed low-assurance quick plan in direct mode from `HEAD` `0ba4432`.
- T01 captured the raw model registry at `session_start` for the renderer.
- T01 made `session_shutdown` first set a per-instance shut-down flag and clear `latestCtx` and `latestPi`.
- T01 routed the 8 async `subagent_result` sends through a new `deliverSubagentMessage` helper, which skips after shutdown and swallows stale-API throws.
- T02 added three regression tests that use a fresh module instance per test.
- The new tests were also run against `HEAD` source in a temporary detached worktree. The renderer test and the delivery test failed there, which showed they catch the bug.
- T03 added a runtime-safety wiki section and recorded the raw handoff as processed.
- One independent completion review passed, then terminal archive was approved.

## Key decisions

- **Capture the registry instead of try/catch in render** - chose a module-level `latestModelRegistry` because pi's registry object does not assert that the session is active. Rejected wrapping the getter in render, which would hide the hazard. Rejected storing `contextWindow` in message details, which would change persisted data.
- **Leave question notifications on the cleared-global guard** - the reviewer's non-blocking suggestion to route them through the helper was not applied, because plan R5 says clearing `latestPi` is enough.
- **Skip the manual tmux check** - it needs an interactive pi and a model-consuming subagent. The skip is recorded as residual risk.

## What did not work

- **Collapsed renderer in unit tests** - the first test run failed with `Theme not initialized` from `keyHint`. Switching the test to the expanded view fixed it.
- **A placeholder reviewer launch** - a reviewer was launched by mistake with the task "noop". Its unsolicited PASS was not counted as the review gate. Future runs should not spawn agents as a waiting mechanism.

## Current state and where we left off

- Shipped and verified: the archived item at `spec/archive/261110-1508-fix-stale-ctx-crash-in-subagent-result-renderer/` (plan, verification, outcome; status completed). The source, test, and wiki changes are unstaged and uncommitted.
- Pending: a user-controlled Git checkpoint. Optional follow-up: route question notifications through the guarded helper.

## Source of truth

- `spec/archive/261110-1508-fix-stale-ctx-crash-in-subagent-result-renderer/verification.md`: commands, requirement coverage, review verdict, skipped checks.
- `spec/archive/261110-1508-fix-stale-ctx-crash-in-subagent-result-renderer/outcome.md`: delivered scope and residual risks.
- `pi-extension/subagents/index.ts`: `latestModelRegistry`, `sessionShutDown`, `deliverSubagentMessage`, shutdown ordering.
- pi 1.5.1 `core/agent-session-runtime.js` `teardownCurrent` and `core/agent-session.js` `reload`: `session_shutdown` runs before `invalidate()`.

## Verification

- Done:
  - `npm test` passed: 290 tests, 0 failed, every `PI_SUBAGENT_*` variable unset.
  - The new tests fail against the `HEAD` source and pass after the fix.
  - `npm pack --dry-run` shows the same 22 files. `git diff --check` is clean.
  - Spec validation and the archive preflight passed. The completion review returned PASS.
- Not verified yet: the real-pi `/reload` path with a running subagent (F8) has not been reproduced end-to-end. The fix depends on pi keeping its shutdown-before-invalidate ordering.

## Open questions, blockers, next safe action

- Open/blocked: none.
- Next safe action: review the unstaged diff and create a user-controlled Git checkpoint.

## Dynamic knowledge trail

- `wiki/conventions/typescript-modules.md`: Topic-specific dynamic knowledge (two test-seam bullets).
