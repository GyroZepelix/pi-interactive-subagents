# Outcome: Fix false stalled status from invalid activity snapshots

Work item: `261024-1918-fix-false-stalled-status-from-invalid-activity-snapshots`
Disposition: completed
Date: 2026-10-24

## Delivered scope

- The child recorder now sanitizes `toolCallId`, `toolName`, and `messageEventType` before storing them. Each CR/LF run becomes one space, and values are truncated to 200 characters (R1).
- The parent reader drops an invalid optional diagnostic string instead of rejecting the whole snapshot. Structural fields and `wrong-id` handling are unchanged (R2).
- An `invalid` read result now names the failing field. The field is carried through `activityRead`, the status observation, and the status state (R3).
- Stalled Pi children show `invalid activity` or `no activity`. Status and transition lines append only an identifier-like field name, and the widget shows only the category. No raw error text or field value is displayed (R4).
- Behavior before a stall, `wrong activity id` labeling, the 60 s threshold, and stalled/recovered wake-ups are unchanged (R5).
- Changed paths: `pi-extension/subagents/activity.ts`, `pi-extension/subagents/status.ts`, `pi-extension/subagents/index.ts`, `test/test.ts`.

## Deviations from plan

- None in scope. The existing status test that expected a `null` label at stall for a missing snapshot now expects `no activity`, as R4 requires. The D08 test move was applied as planned.

## Verification summary

- `npm test` with a clean `PI_*` environment: 274/274 pass (baseline 266/266). The 10 new or changed tests fail against the HEAD sources.
- Completion review: PASS, no findings, 0 retries.
- T05: partially verified live. On a real Cursor `grok-4.7-fast` child, the new reader returned `ok: true` on activity files with CR/LF tool-call IDs, where the HEAD reader returned `invalid`. The new parent pipeline classified that file `active` past the threshold. See [verification.md](./verification.md).

## Retained, reverted, or transferred work

- All source and test changes are retained, unstaged and uncommitted, for a user-controlled Git checkpoint.

## Residual risks

- The new-code widget in a real session and recorder sanitization in a real child are proven only by unit tests. The running Pi loads the installed package (GyroZepelix fork @`7516686`), not this working tree. The user accepted this risk. Live sessions keep showing false `stalled` until the installed package is updated.

## Follow-up work items

- None created. Optionally re-run the T05 observation after the installed package picks up this change.

## Source references

- [plan.md](./plan.md), [discovery.md](./discovery.md), [verification.md](./verification.md).

## Wiki updates

- Not applied in this run. Proposed for Dream: `wiki/conventions/runtime-safety.md` should record that activity snapshots sanitize provider strings on write, drop invalid optional diagnostic strings on read, and label invalid or missing snapshots on stalled lines without echoing raw content.
