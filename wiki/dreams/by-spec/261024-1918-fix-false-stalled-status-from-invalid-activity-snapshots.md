# Dream learnings: 261024-1918-fix-false-stalled-status-from-invalid-activity-snapshots

Work item: `261024-1918-fix-false-stalled-status-from-invalid-activity-snapshots`

> Historical snapshot: this ledger records what Dream retained at each Gamemaster checkpoint. Current source, plans, verification, outcomes, and current dynamic destinations remain authoritative.

<!-- dream-checkpoints:start -->

## Gamemaster checkpoint: 261024-1918-fix-false-stalled-status-from-invalid-activity-snapshots/direct

Date: 2026-10-24
Dream log: [2026-10-24-1955-gamemaster-checkpoint-261024-1918-fix-false-stalled-status-from-invalid-activity.md](../2026-10-24-1955-gamemaster-checkpoint-261024-1918-fix-false-stalled-status-from-invalid-activity.md)
Outcome: retained learning

### Activity snapshot diagnostic-string boundary

- **Exact written text:**
  > Activity snapshots carry provider-supplied diagnostic text, so a diagnostic field must never invalidate the whole snapshot. The same read gates the stall watchdog, waiting-reply acknowledgment, and pending-question reconciliation. The child recorder collapses CR/LF runs to one space and truncates `toolCallId`, `toolName`, and `messageEventType` to 200 characters before writing. Cursor-provider tool-call IDs embed a newline (`call-...` newline `fc_..._N`). The parent reader drops an invalid optional diagnostic string; structural fields stay strict, and an `invalid` result names only the failing field. Stalled lines show only `invalid activity` or `no activity`, and status lines may add the validator field name. Raw error text and field values are never displayed (`pi-extension/subagents/activity.ts`, `pi-extension/subagents/status.ts`, `spec/archive/261024-1918-fix-false-stalled-status-from-invalid-activity-snapshots/plan.md`).
- **Destination and classification:** `wiki/conventions/runtime-safety.md` - `Convention`
- **Session evidence or selection reason:** The root cause was verified on a live Cursor child: a newline-bearing `toolCallId` invalidated the whole snapshot, which produced a false stall and broke reply acknowledgment. Accepted plan decisions D02, D03/D06, and D07 established the contract, and 274/274 tests plus a passing completion review support it.
- **Expected future benefit:** Future activity, status, or provider work keeps optional diagnostic fields from blocking liveness, acknowledgment, and question reconciliation, and keeps provider content out of parent-facing lines.
- **Why this tier:** It is a stable runtime contract that touches safety (no echo of provider content) and several parent consumers, so it belongs with the existing runtime-file conventions rather than an observation.

### Activity snapshot data ownership and watchdog labels

- **Exact written text:**
  > - Activity snapshots are version 1 JSON files written by temp-file rename. `agent_end` is a waiting state that remains writable across retry activity; terminal auto-exit records `latestEvent: "agent_settled"`. Structurally invalid or wrong-child snapshots are rejected. An invalid optional diagnostic string (`toolCallId`, `toolName`, `messageEventType`) is dropped rather than rejecting the snapshot (`pi-extension/subagents/activity.ts`).
  >
  > - Healthy active and waiting snapshots do not become stalled merely because they are old; missing or invalid snapshots cross a fixed 60-second watchdog threshold, and only then are labelled `no activity` or `invalid activity` (`pi-extension/subagents/status.ts`).
- **Destination and classification:** `wiki/architecture.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** The existing architecture statements ("Invalid or wrong-child snapshots are rejected" and the unlabelled watchdog invariant) became inaccurate after the archived change. The source and tests now drop invalid optional strings and label only at stall.
- **Expected future benefit:** Readers of the architecture page get current snapshot validation and stall-label behavior without contradicting source.
- **Why this tier:** These are corrections merged into existing architecture bullets for the activity/status component, not new broad guidance.

### Live-check verification boundary for working-tree changes

- **Exact written text:**
  > A live subagent spawned from the current Pi session exercises the package copy that session loaded, for both the parent widget and the child runtime control. Child `-e` paths derive from the parent extension directory. When Pi loads the installed package rather than this working tree, such a check verifies only installed code. To exercise uncommitted changes, run the working-tree reader and status modules on the live artifacts, or use a `pi -ne -e <path>` session as the integration harness does (`pi-extension/subagents/index.ts`, `spec/archive/261024-1918-fix-false-stalled-status-from-invalid-activity-snapshots/verification.md`).
- **Destination and classification:** `wiki/development.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** The T05 live Cursor check ran under the installed package. The parent widget showed `stalled 1m` while the working-tree reader accepted the same live files. `index.ts` derives child runtime-control `-e` paths from the parent extension directory.
- **Expected future benefit:** Future live verification avoids claiming working-tree behavior from installed code and picks a method that actually exercises uncommitted changes.
- **Why this tier:** It is a source-backed verification boundary that changes what agents may claim. It is specific to this repository's development workflow and extends the existing note on the installed snapshot used in integration sessions.
