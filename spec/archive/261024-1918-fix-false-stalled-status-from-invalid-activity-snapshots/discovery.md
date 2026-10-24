# Discovery: Fix false stalled status from invalid activity snapshots

Work item: `261024-1918-fix-false-stalled-status-from-invalid-activity-snapshots`
Status: Ready for To Spec
Created: 2026-10-24
Updated: 2026-10-24

Assurance: low - localized to activity snapshot write/read plus status display; fully reversible with no migration, security, or persisted-schema change; existing unit seams cover reader, recorder, and status classification.

## Objective

Stop the parent from reporting a healthy Pi subagent as `stalled` when the child's activity snapshot contains a provider-supplied optional string that the reader rejects.

## Desired outcome

- A Cursor-backed (or any) Pi child that is working shows `active`/`waiting` in the widget and status lines, not `stalled`.
- Waiting-reply acknowledgment and pending-question reconciliation work for such children again.
- When a snapshot is genuinely unreadable or missing, the stalled status names the reason instead of a bare `stalled`.

## Repository and domain context

- Child recorder: `pi-extension/subagents/activity.ts` (`createSubagentActivityRecorder`, lines ~457-492) stores `toolCallId`/`toolName` from Pi tool events forwarded by `pi-extension/subagents/subagent-runtime-control.ts:349-365`.
- Parent reader: `readSubagentActivityFile` -> `validateActivity` (`activity.ts:150-185`); `validateOptionalActivityString` (`activity.ts:134-140`) rejects strings with CR/LF or longer than 200 chars, and any rejection invalidates the whole snapshot.
- Status: `observeStatus`/`classifyProblemState` (`status.ts`) turn a non-present snapshot into `stalled` after `SNAPSHOT_STALLED_AFTER_MS` (60 s). Only `wrong-id` yields a status label; `snapshotError` is never displayed.
- Display: widget right label `formatWidgetRightLabel` (`index.ts:479-495`), status lines `formatStatusLine`/`formatTransitionLine` (`status.ts`), parent wake-up on transition (`index.ts:1795-1825`).

## Scope

- Child-side sanitization of optional activity strings before writing.
- Parent-side tolerance: invalid optional diagnostic strings are dropped instead of invalidating the snapshot.
- Show a short reason when a snapshot is invalid or missing long enough to be stalled.
- Unit regression tests and one live Cursor-backed worker check.

## Out of scope

- New status kinds or changes to the 60 s stall threshold or parent wake-up policy (confirmed D05).
- Changes to `@offbynan/pi-cursor-provider` or its tool-call ID format.
- Schema version bump of the activity snapshot (stays version 1).
- Fixing already-running children's on-disk files beyond what parent tolerance provides.
- General refactors of `status.ts` or `index.ts`.

## Confirmed facts and evidence

- Fact: live Cursor (`grok-4.7-fast`) child snapshot contained `"toolCallId":"call-...-32\nfc_..._4"`; `readSubagentActivityFile` returned `{"ok":false,"reason":"invalid","error":"toolCallId must not contain newlines"}` while the same file showed `phase: active`, `messageEventType: thinking_delta`, and a fresh `updatedAt`.
- Fact: the recorder retains the last `toolCallId` after tool end (`toolCallId ?? current.toolCallId`), so the snapshot stays invalid for the rest of the run.
- Fact: `toolCallId` and `messageEventType` have no parent consumer; only `toolName` feeds the active label (`index.ts:1291`).
- Fact: the same read result gates waiting-reply acknowledgment (`index.ts:1478-1512`, baseline at `1703-1707`) and pending-question reconciliation (`index.ts:1524-1547`), so those degrade for affected children.
- Fact: children load the parent's `subagent-runtime-control.ts` path (`index.ts:1101`, `1242`), so writer fixes reach new children; already-running children keep old code.
- Fact: checks are `npm test` (`node --test test/test.ts`) and `npm run test:integration` (tmux + real Pi).

## Constraints and invariants

- Structural fields (`version`, `runningChildId`, `phase`, `latestEvent`, `activeScope`, numeric and boolean fields) keep strict validation; `wrong-id` handling is unchanged.
- Atomic temp-file rename write path is unchanged (`wiki/conventions/runtime-safety.md`).
- Status and widget lines stay bounded (`MAX_STATUS_LINE_LENGTH`), single-line, and must not echo provider-supplied field values (D07).
- Only provider-supplied optional strings (`toolCallId`, `toolName`, `messageEventType`) can carry externally controlled content; other snapshot fields are recorder-controlled or Pi integers (`subagent-runtime-control.ts:329-365`).

## Confirmed decisions

| ID | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- |
| D01 | Title: "Fix false stalled status from invalid activity snapshots". | Names the user-visible symptom. | User decision (Round 1, Q1). | Scope materially changes. |
| D02 | Fix both sides: child replaces CR/LF with spaces and truncates optional strings to the 200-char limit before writing; parent drops an invalid optional string field (`toolCallId`, `toolName`, `messageEventType`) instead of rejecting the snapshot, keeping structural fields strict. | Removes the root cause and prevents the same whole-snapshot failure from future diagnostic fields or old children. | User decision (Round 1, Q2); facts above. | A parent consumer starts relying on one of these fields. |
| D03 | Keep `stalled` semantics but add a short reason label to the widget and to the parent status/transition line. | Makes genuine snapshot failures diagnosable without a new state. | User decision (Round 1, Q3). | Wake-up noise from genuine invalid snapshots becomes a problem. |
| D04 | Acceptance: unit regressions plus one live Cursor-backed worker check. | Unit tests are deterministic; the live check confirms the real provider path. | User decision (Round 1, Q4). | Cursor provider becomes unavailable. |
| D05 | Keep waking the parent on stalled/recovered transitions for non-interactive children. | After the root-cause fix, a stall is a meaningful signal. | User decision (Round 2, Q5). | Genuine snapshot failures cause recurring wake-up noise. |
| D06 | Label both problem cases: `invalid activity` for an unreadable snapshot and `no activity` for a missing one (exact wording settled in the plan). | Every stall states its cause. | User decision (Round 2, Q6). | A new snapshot problem state is added. |
| D07 | Parent-facing lines carry only a short category, optionally naming the failing field (for example `invalid activity: toolCallId`), never the raw error text or field value. The full error stays in `snapshotError`. | Avoids echoing provider content into the orchestrator conversation. | User decision (Round 2, Q7). | Debugging needs more detail in the UI. |

## Rejected alternatives

- Writer-only or reader-only fixes: each leaves one side able to reproduce whole-snapshot rejection.
- New "activity unreadable" status kind: extra state and docs not justified once the root cause is fixed.
- Suppressing parent wake-ups for snapshot problems: would hide genuine failures (D05).
- Raw error text in parent-facing lines: may echo provider content (D07).

## Open questions and prerequisites

None blocking. Plan-level details: exact label wording, whether CR/LF become a space or are removed, and sanitization helper placement.

## Current frontier

Empty.

## Proposed test seams and acceptance evidence

- `test/test.ts` reader: a Cursor-style `call-...\nfc_..._N` `toolCallId` and an over-length value yield `ok: true` with the field dropped; structural violations still yield `invalid`; `wrong-id` unchanged.
- `test/test.ts` recorder: tool events with CR/LF or over-length IDs produce a file that passes strict reading with sanitized values.
- Status: an affected snapshot classifies `active`, not `stalled`, after more than 60 s; genuinely invalid and missing snapshots show their distinct reason label in the widget and status/transition line, bounded in length and without raw error text or field values.
- Waiting-reply acknowledgment succeeds for a snapshot carrying a newline `toolCallId`.
- Live: spawn one Cursor-backed worker that uses tools for over 60 s; widget shows `active (...)`/`waiting`, never `stalled`, and its activity file reads `ok: true`.
- `npm test` passes.

## Proposed wiki updates after implementation

- `wiki/conventions/runtime-safety.md`: activity snapshots sanitize provider strings on write and tolerate invalid optional diagnostic fields on read.

## Resume state

Rounds 1-2 answered (D01-D07). Shared understanding confirmed by the user invoking To Spec. Next action: `/skill:to-spec 261024-1918-fix-false-stalled-status-from-invalid-activity-snapshots`.

## Readiness for To Spec

- [x] Every consequential branch is resolved or explicitly out of scope.
- [x] Facts are distinguished from user decisions and hypotheses.
- [x] Requirements, constraints, and non-goals are clear.
- [x] Acceptance evidence and proposed test seams are defined.
- [x] The user confirmed shared understanding.
