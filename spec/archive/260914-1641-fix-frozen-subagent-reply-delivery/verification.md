# Verification: Fix frozen subagent reply delivery

Work item: `260914-1641-fix-frozen-subagent-reply-delivery`
Date: 2026-09-14

## Environment

- Direct implementation at starting and current `HEAD` `7c5cbceec648a53a44e60363e793ab49ead508d3`.
- Medium assurance: tmux transport, Pi TUI input, lifecycle state, asynchronous acknowledgment, and recovery are affected; the change is local and reversible.
- Node test environment inherited `PI_SUBAGENT_ALLOWED=scout,researcher,worker,flash-reviewer`; top-level unit evidence therefore unsets that child-only restriction.
- tmux 3.6b. Disposable sessions only; the retained frozen process and private session artifacts were not inspected or changed.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| `env -u PI_SUBAGENT_ALLOWED npm test` | PASS | 211 tests passed; final log `/tmp/pi-subagent-final-unit.log`. |
| `node --test test/integration/tmux-surface.test.ts` in a disposable current-server tmux session | PASS | 9 tests passed, including exact 4,283-byte UTF-8 bracketed paste, second-input responsiveness, buffer cleanup, and real pane removal; final log `/tmp/pi-subagent-final-surface-1489.log`. |
| Current-server wrapper identification | PASS | A disposable pane's executable was `/Users/dgjalic/.local/bin/zsh (kiro-cli-term)`. |
| Focused transport test in a separate disposable tmux server with Q/Kiro variables unset and `/bin/bash` | PASS | Exact 4,283-byte UTF-8 input and short follow-up passed; unchanged transport evidence in `/tmp/pi-subagent-bypass-87163.log`. |
| `npm pack --dry-run --json` | PASS | 17 allowlisted package files; no spec, wiki, tests, or repository instructions; `/tmp/pi-subagent-final-pack.json`. |
| `git diff --check` | PASS | No whitespace errors. |
| Changed-path, Markdown fenced-code, and plain-text checks | PASS | All intended source/test/docs paths exist; fences are balanced and no NUL/CR controls were introduced. |
| Dependency diff | PASS | `package.json` and `package-lock.json` unchanged. |
| `uv run spec/scripts/manage-spec-item.py --root . validate --operational` | PASS | Six items valid; no warnings. |
| `uv run spec/scripts/manage-spec-item.py --root . archive --item 260914-1641-fix-frozen-subagent-reply-delivery --check` | PASS | Non-mutating preflight reports an eligible completed destination; archival remains approval-gated. |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R1 | `submitText` loads a UUID-qualified tmux buffer from stdin, uses `paste-buffer -p -d`, sends Enter separately, and keeps payload text out of argv; unit and real tmux tests pass. | PASS |
| R2 | Existing name routing and finished Pi resume remain unchanged; steering tests preserve trimming and multiline flattening; active Pi and Claude paths still target their live panes. | PASS |
| R3 | The real tmux fixture records one exact 4,283-byte UTF-8 submission with bracketed framing, then accepts and records one short follow-up. | PASS |
| R4 | `agent_end` now suppresses auto-exit while `ctx.hasPendingMessages()` is true; deterministic tests prove later normal exit after the continuation. | PASS |
| R5 | Waiting Pi steering captures a valid child/sequence baseline, accepts only newer same-child input or active activity, times out to `unconfirmed`, and neither resends nor removes the child. | PASS |
| R6 | Active Pi and Claude results and renderers say `submitted`; only acknowledged waiting Pi input says `delivered`. | PASS |
| R7 | Exit polling distinguishes transient capture failure from confirmed pane absence; watcher tests remove the running entry, preserve Pi registry state, report interruption, and retain same-name resume. Claude interruption remains explicitly non-resumable. | PASS |
| R8 | No dependency, profile discovery, sandbox snapshot, capability, registry identity, or model-selection changes. | PASS |

## Review findings

- Focused T01-T03 review: PASS, zero retries, no blockers.
- Final whole-plan contract-quality review: PASS, zero retries, no blockers.
- Non-blocking observations: interruption details omit `resumeSupported` although presentation text is correct; Claude interruption has presentation-level rather than full watcher-path coverage; wiki routing summaries outside T04's explicit three-file scope remain stale.

## Failures and skipped checks

- The initial plain `npm test` failed while incomplete: inherited child-only `PI_SUBAGENT_ALLOWED` caused unrelated top-level discovery assertions, and four steering tests still used the former synchronous helper signature. The tests were updated for the approved asynchronous contract; the final sanitized 211-test suite passed.
- The first wrapper-focused fixture attempt exposed a missing test import, and the first wrapper-bypass attempt exposed shell-readiness timing. Both test defects were corrected; focused and full tmux checks then passed.
- `node --test --test-concurrency=1 test/integration/subagent-lifecycle.test.ts` was not run because it consumes model calls and explicit approval was not provided.

## Unverified areas

- The required no-model proof combines the raw TUI recorder fixture with deterministic activity/lifecycle tests; it does not execute a model-backed waiting Pi child. Residual Pi-parser/provider lifecycle risk remains until the optional approved suite is run.
- The 2.5-second acknowledgment timeout can produce a false negative on a loaded host; this is intentionally reported as ambiguous `unconfirmed` delivery without replay or termination.
- The implementation inherited incomplete same-item edits from an interrupted run. Current full artifacts, diffs, checks, and two independent reviews cover the accepted behavior, but no earlier checkpoint exists inside that attempt.
