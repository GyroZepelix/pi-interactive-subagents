# Plan: Fix false stalled status from invalid activity snapshots

Work item: `261024-1918-fix-false-stalled-status-from-invalid-activity-snapshots`
Status: Planned
Created: 2026-10-24
Updated: 2026-10-24

Assurance: low - localized to activity snapshot write/read plus status display; fully reversible with no migration, security, or persisted-schema change; existing unit seams in `test/test.ts` cover reader, recorder, status, widget, and steer acknowledgment.

## Goal

A working Pi child is never reported as `stalled` because a provider-supplied optional activity string contains CR/LF or exceeds the length limit. Waiting-reply acknowledgment and pending-question reconciliation work again for such children. A genuine snapshot problem that reaches `stalled` states its reason.

## Context

- Discovery: [discovery.md](./discovery.md).
- Root cause (verified on a live Cursor `grok-4.7-fast` child): the recorder stores the provider `toolCallId` (`call-...\nfc_..._N`) verbatim (`subagent-runtime-control.ts:349-365`, `activity.ts:457-492`); `validateOptionalActivityString` (`activity.ts:134-140`) rejects it and `validateActivity` invalidates the whole snapshot; `status.ts` classifies a non-present snapshot as `stalled` after 60 s. The recorder retains the last `toolCallId`, so the condition persists.
- The same read result gates waiting-reply acknowledgment (`index.ts:1478-1512`, `1703-1707`) and pending-question reconciliation (`index.ts:1524-1547`).
- `toolCallId` and `messageEventType` have no parent consumer; `toolName` only feeds the active label (`index.ts:1291`).

## Requirements

- R1: The child recorder stores `toolCallId`, `toolName`, and `messageEventType` with every CR/LF run replaced by a single space and the result truncated to `MAX_ACTIVITY_STRING_LENGTH` (200), so its own output always passes strict reading.
- R2: The parent reader drops an optional string field (`toolCallId`, `toolName`, `messageEventType`) that is non-string, contains CR/LF, or exceeds the limit, and returns `ok: true` for the otherwise-valid snapshot. All other fields keep current strict validation; `wrong-id` handling is unchanged.
- R3: An `invalid` read result carries the failing field name when the validator identifies one (absent for JSON parse failures).
- R4: When a Pi child is classified `stalled` because its snapshot is invalid or missing, the widget and status/transition lines show a reason label: `invalid activity` or `no activity`. Status/transition lines may append the failing field (for example `invalid activity: phase`). No raw error text or field value appears in any line, and lines stay within existing bounds.
- R5: Pre-stall (under 60 s) display, `wrong activity id` labeling, the 60 s threshold, and parent wake-up on stalled/recovered transitions are unchanged.

## Out of scope

- New status kinds, threshold changes, or wake-up policy changes.
- Changes to `@offbynan/pi-cursor-provider` or its tool-call ID format.
- Activity snapshot schema version bump (stays version 1).
- Repairing already-running children beyond what R2 provides.
- Unrelated refactors of `status.ts`, `index.ts`, or `activity.ts`.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D02 | Fix shape | Sanitize on write and tolerate invalid optional diagnostic strings on read; structural fields stay strict. | Removes root cause and prevents whole-snapshot rejection from diagnostic fields or older children. | User decision; discovery facts. | A parent consumer starts depending on one of these fields. |
| D03/D06 | Display | Keep `stalled`; label `invalid activity` or `no activity` on stalled lines only. | Diagnosable stalls without a new state or pre-stall noise. | User decisions. | A new snapshot problem state is added. |
| D05 | Wake-up | Parent wake-up on stalled/recovered transitions unchanged. | After the fix, a stall is meaningful. | User decision. | Genuine snapshot failures cause recurring noise. |
| D07 | Exposure | Parent-facing lines carry only a category and optional field name, never raw error text or values. | Avoids echoing provider content into the orchestrator conversation. | User decision. | Debugging needs more UI detail. |
| D08 | Existing test | Move the `{ toolName: "bad\nname" }` case in `test/test.ts` ("rejects malformed activity fields...") from rejection to drop-and-accept. | Required by D02; the widget falls back to `tool` when `toolName` is absent. | `test/test.ts:5959-5982`, `index.ts:1291`. | None. |

## Work breakdown

- [x] T01: Sanitize optional strings in the recorder
  - Depends on: none
  - Scope: one helper in `activity.ts` applied wherever `toolCallId`, `toolName`, or `messageEventType` are assigned.
  - Expected areas: `pi-extension/subagents/activity.ts`
  - Acceptance: recorder fed CR/LF and over-length values writes a file that `readSubagentActivityFile` accepts with sanitized values (R1).
  - Verification: `npm test`
- [x] T02: Tolerant reader with failing-field reporting
  - Depends on: none
  - Scope: `validateActivity` drops invalid optional strings from a copied result; invalid results add optional `field`; extend `ActivityReadResult` and the parent's `activityRead`/`observeStatus` plumbing to carry it.
  - Expected areas: `pi-extension/subagents/activity.ts`, `pi-extension/subagents/index.ts` (`applyRunningActivityRead`), `pi-extension/subagents/status.ts` (observation/state field)
  - Acceptance: R2 and R3; existing structural rejection cases still return `invalid`.
  - Verification: `npm test`
- [x] T03: Reason labels on stalled lines
  - Depends on: T02
  - Scope: produce `invalid activity` / `no activity` (plus optional field in status/transition lines) only when kind is `stalled`; keep `wrong activity id` behavior; widget uses the category only.
  - Expected areas: `pi-extension/subagents/status.ts`, `pi-extension/subagents/index.ts` (`formatWidgetRightLabel` if needed)
  - Acceptance: R4 and R5.
  - Verification: `npm test`
- [x] T04: Regression tests
  - Depends on: T01-T03
  - Scope: tests listed under Testing decisions; update the existing rejection test per D08.
  - Expected areas: `test/test.ts`
  - Acceptance: new tests fail on pre-change behavior where practical and pass after; full suite passes.
  - Verification: `npm test`
- [x] T05: Live Cursor-backed check
  - Depends on: T04
  - Scope: spawn one Cursor-backed worker with a task that uses tools for more than 60 s.
  - Expected areas: none (manual)
  - Acceptance: widget shows `active (...)`/`waiting`, never `stalled`; `readSubagentActivityFile` on its activity file returns `ok: true`.
  - Verification: manual observation plus one reader invocation; record result in `verification.md`.

## Acceptance criteria

- A snapshot with a Cursor-style `toolCallId` (`call-...\nfc_..._N`), or over-length or CR/LF `toolName`/`messageEventType`, reads `ok: true` with those fields dropped.
- Structural malformations (non-finite timestamps, unknown scope/event/phase, wrong types, wrong id) keep their current results.
- Recorder output from CR/LF and over-length tool IDs passes strict reading with sanitized values.
- A running child whose snapshot carries such a `toolCallId` classifies `active`, not `stalled`, after more than 60 s.
- Invalid and missing snapshots that reach `stalled` show `invalid activity` and `no activity` respectively, bounded, with no raw error text or field value.
- `handleSubagentSteer`/`waitForWaitingReplyAcknowledgment` confirm a reply when the newer snapshot carries a CR/LF `toolCallId`.
- `npm test` passes (baseline: 266 pass, 0 fail).
- Live Cursor-backed worker never shows `stalled` while working.

## Testing decisions and seams

- `describe("subagent activity snapshots")`: reader drop cases, D08 update, recorder sanitization via `createSubagentActivityRecorder` with a temp dir.
- `describe("status.ts")`: `observeStatus` + `classifyStatus`/`formatStatusLine`/`formatTransitionLine` for invalid and missing labels and pre-stall unchanged behavior.
- `__test__.formatWidgetRightLabel` and `__test__.observeRunningSubagent` with an injected `readActivity` for widget label and `active` classification.
- `__test__.waitForWaitingReplyAcknowledgment` or `handleSubagentSteer` with injected `readActivity` for acknowledgment.

## Verification plan

- `npm test`
- Live check per T05 (uses the user's Cursor credentials; approved in discovery D04).
- One completion review against this plan, the diff, and tests.

## Risks and blockers

- Cursor provider unavailable at verification time: record T05 as unverified with reason; unit evidence still stands.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete (T01-T05).
- [x] Verification run: `npm test` 274/274; completion review PASS; T05 partially verified live (user-accepted residual risk). See [verification.md](./verification.md).

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read this plan and its item.yaml completely.
Implement the work step by step while preserving Requirements, Out of scope, Decision Log, and Verification plan.
Update Progress and the Decision Log when confirmed implementation discoveries change the approach.
Run the specified verification before reporting completion.
Stop and ask before dependencies, migrations, destructive operations, external writes, commits, pushes, or scope expansion.
```

## Proposed durable knowledge updates

- `wiki/conventions/runtime-safety.md`: activity snapshots sanitize provider-supplied strings on write and drop invalid optional diagnostic strings on read; stalled lines label invalid/missing snapshots without echoing raw content.
