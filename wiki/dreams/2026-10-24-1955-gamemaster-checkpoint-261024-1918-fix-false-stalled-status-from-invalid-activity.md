---
schema_version: 1
episode_id: "2026-10-24-1955-gamemaster-checkpoint-261024-1918-fix-false-stalled-status-from-invalid-activity"
timestamp: "2026-10-24T19:55:10+02:00"
summary: "Cursor-backed children were falsely shown as stalled because their newline-bearing toolCallId invalidated activity snapshots; the recorder now sanitizes, the reader drops bad optional strings, stalled lines name the reason, and the item is archived."
kind: "gamemaster-checkpoint"
status: "shipped"
work_item: "261024-1918-fix-false-stalled-status-from-invalid-activity-snapshots"
current: "direct"
topics: ["activity snapshots","status watchdog"]
---

# Gamemaster checkpoint: 261024-1918-fix-false-stalled-status-from-invalid-activity-snapshots/direct

Date: 2026-10-24
Work item: 261024-1918-fix-false-stalled-status-from-invalid-activity-snapshots
Status: shipped
In one line: Cursor-backed children were falsely shown as stalled because their newline-bearing toolCallId invalidated activity snapshots; the recorder now sanitizes, the reader drops bad optional strings, stalled lines name the reason, and the item is archived.

## Goal

Stop working Pi children from being reported as `stalled` (and from breaking waiting-reply acknowledgment and pending-question reconciliation) when a provider-supplied optional activity string contains CR/LF or exceeds 200 characters, and give genuine stalls a bounded reason label.

## How we approached it

The Implement Twin ran the low-assurance direct plan. Four parts landed: a recorder-side sanitizer for `toolCallId`, `toolName`, and `messageEventType`; a tolerant reader that copies the snapshot, drops invalid optional strings, and reports the failing structural field; plumbing of that field through `activityRead`, the status observation, and the status state; and stall-only `invalid activity` / `no activity` labels. Status lines may add the field name, and only identifier-like names pass. Eight new regression tests were added and two existing tests changed (the D08 move and the missing-snapshot stall label). All ten fail against HEAD sources. The completion review passed. The live Cursor check confirmed the root cause and the new reader on real files. The Gamemaster approved archiving.

## Key decisions

- **Partial T05 accepted** - the user chose to record the live check as partially verified and archive. The alternative of leaving T05 open until the installed package updates was rejected.
- **Field names filtered before display** - only `/^[A-Za-z][A-Za-z0-9]{0,39}$/` names reach parent-facing lines, so validator output cannot echo provider content (plan D07).
- **Existing stall-label test changed** - the missing-snapshot test now expects `no activity` at stall, as R4 requires.

## What did not work

- **Live check against new code** - the running Pi session and its children load the installed package, not the working tree, so the live widget kept showing `stalled 1m` (old behavior). A future session should run working-tree modules on live artifacts or use a `pi -ne -e <path>` session.
- **First completion reviewer** - the AGY-backed `flash-reviewer` profile failed before reviewing because headless AGY denied `read_file`; the `worker` profile was used instead.
- **Unit suite inside a subagent** - inherited `PI_*` variables caused six unrelated agent-discovery failures; all `PI_*` variables were unset for the recorded runs.

## Current state and where we left off

- Shipped/verified: source and test changes are present but unstaged and uncommitted in `pi-extension/subagents/{activity,status,index}.ts` and `test/test.ts`. `npm test` passes 274/274. The item is archived as completed.
- Pending: user-controlled Git checkpoint; live new-code widget behavior is unverified until the installed package picks up the change.

## Source of truth

- `spec/archive/261024-1918-fix-false-stalled-status-from-invalid-activity-snapshots/plan.md`: requirements R1-R5 and decisions.
- `spec/archive/261024-1918-fix-false-stalled-status-from-invalid-activity-snapshots/verification.md`: checks, requirement coverage, T05 evidence, and residual risk.
- `spec/archive/261024-1918-fix-false-stalled-status-from-invalid-activity-snapshots/outcome.md`: delivered scope and residual risks.

## Verification

- Done: clean-environment `npm test` 274/274; revert check (10 targeted failures at HEAD); completion review PASS with 0 retries; live new reader `ok: true` on eight samples of real Cursor activity files with CR/LF tool-call IDs, while the HEAD reader returned `invalid`.
- Not verified yet: new-code widget in a real session and recorder sanitization inside a real child process.

## Open questions, blockers, next safe action

- Open/blocked: none.
- Next safe action: the user reviews and commits the unstaged changes, then updates the installed package and optionally re-runs a Cursor worker longer than 60 s to confirm the widget never shows `stalled`.

## Dynamic knowledge trail

- `wiki/conventions/runtime-safety.md`: Convention.
- `wiki/architecture.md`: Topic-specific dynamic knowledge.
- `wiki/development.md`: Topic-specific dynamic knowledge.
