# Verification: Fix false stalled status from invalid activity snapshots

Work item: `261024-1918-fix-false-stalled-status-from-invalid-activity-snapshots`
Date: 2026-10-24

## Environment

- Mode: direct. Assurance: low (localized to activity snapshot write/read plus status display; reversible; no migration, security, or schema change).
- Starting boundary: HEAD `47aa069816a84004500cae19d7d14681aac1cf6b`, nothing staged. Changes are unstaged in `pi-extension/subagents/activity.ts`, `pi-extension/subagents/status.ts`, `pi-extension/subagents/index.ts`, and `test/test.ts`.
- `npm test` runs with every `PI_*` environment variable unset. The `PI_SUBAGENT_*` variables inherited by a running subagent make unrelated agent-discovery tests fail. The baseline of 266/266 was measured the same way.
- No typecheck or lint script exists in `package.json`, and no TypeScript compiler is installed.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| `npm test` (clean `PI_*` env), before changes | 266 tests, 266 pass | baseline from assignment |
| `npm test` (clean `PI_*` env), after changes | 274 tests, 274 pass, 0 fail | 8 new tests; 2 existing tests updated |
| `npm test` with the 3 source files temporarily set to HEAD, new tests kept | 10 fail (exactly the new or changed tests) | the tests detect the old behavior; sources restored and byte-compared with `cmp` |
| Live Cursor child (T05), working-tree reader on the live activity file | `ok: true` on 8 samples | see T05 below |
| Same live file, HEAD reader | `ok: false, reason: invalid, error: "toolCallId must not contain newlines"` | contrast |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R1 recorder sanitization | `sanitizeActivityString` in `activity.ts` is applied to every `toolCallId`, `toolName`, and `messageEventType` assignment. Tests "sanitizes CR/LF and over-length provider strings in recorder output" and "sanitizes messageEventType from throttled message updates" check both the raw file and strict reading. | Verified (unit) |
| R2 tolerant reader | `validateActivity` copies the snapshot and drops invalid optional strings. Test "drops invalid optional diagnostic strings and accepts the snapshot" covers Cursor-style CR/LF IDs, over-length values, non-string values, preservation of valid strings, unchanged wrong-id handling, and strict structural fields. | Verified (unit + live reader) |
| R3 failing field | `invalidActivity(error, field)`; `field` is carried through `activityRead`, `StatusObservation`, and state. The updated rejection test asserts the field for each structural case and its absence on a JSON parse failure. | Verified (unit) |
| R4 stalled labels | `snapshotProblemLabel(state, stalled)` gives `invalid activity` or `no activity` only at stall. Status and transition lines append `: <field>` only for identifier-like names (`/^[A-Za-z][A-Za-z0-9]{0,39}$/`); the widget shows the category only. Tests assert exact lines, no raw error text, and bounds. | Verified (unit) |
| R5 unchanged behavior | Tests confirm: no label before stall, `wrong activity id` still shown before and at stall, the 60 s threshold, and the stalled transition. Existing recovered and wake-up tests pass unchanged. | Verified (unit) |
| Acceptance: CR/LF `toolCallId` child classifies `active` past 60 s | Test "keeps a child with a Cursor-style toolCallId active past the stall threshold"; T05 offline pipeline result on the live file | Verified |
| Acceptance: steer acknowledgment with CR/LF `toolCallId` | Test "confirms a waiting reply when the newer snapshot carries a CR/LF toolCallId" (real file, default reader) | Verified (unit) |

D08: the `{ toolName: "bad\nname" }` case moved from the rejection test into the drop-and-accept test. The existing status test "keeps a missing snapshot as starting until the fixed watchdog threshold" now expects the label `no activity` at stall instead of `null`, as R4 requires.

## T05 live Cursor-backed check: partially verified

- A `worker` child (`cursor/grok-4.7-fast`) ran eight sequential `sleep 12` bash calls, about 2 minutes, and finished with `done`.
- Its activity file held raw CR/LF tool-call IDs, for example `call-203284fb-...-1\nfc_7c7f94f2-..._0`. The working-tree `readSubagentActivityFile` returned `ok: true` on all 8 samples taken over about 2 minutes. The HEAD reader returned `invalid` on the same file.
- The live file was also run through the working-tree `observeRunningSubagent`, `advanceStatusState` 90 s later, and `formatWidgetRightLabel`. The results were `activityRead: {ok: true}`, kind `active`, and widget ` active · streaming 1m `.
- The live session itself reported `t05-live-cursor-check running 1m, stalled 1m.` That session runs the installed package, so this reproduces the original bug under old code.
- Residual risk: the running Pi session and its children load pi-interactive-subagents from the installed package at `~/.pi/agent/git/github.com/GyroZepelix/pi-interactive-subagents` (GyroZepelix fork @`7516686`), not this working tree. As a result, the new-code widget in a real session and recorder sanitization in a real child are proven only by unit tests. The installed package was not modified. The user accepted this partial verification (decision A).

## Review findings

- Completion review (low assurance, worker profile): PASS. No blocking or non-blocking findings.
- Retries: 0. The first attempt with the `flash-reviewer` profile failed before any review because the AGY headless runtime denied `read_file`. It produced no verdict and was replaced by the `worker` profile; it does not count as a review retry.

## Failures and skipped checks

- Running `npm test` with the inherited subagent `PI_*` environment gives 6 unrelated agent-discovery failures (`agent not in allowlist`). These are environment-caused and do not appear with a clean environment.
- No typecheck or lint step is available.

## Unverified areas

- New-code widget rendering in a real interactive session, and recorder sanitization inside a real child process (see T05 residual risk).
