# Verification: Headless RPC-mode subagents

Work item: `261122-1959-headless-rpc-mode-subagents`
Date: 2026-11-22

## Environment

- macOS, Node v26.13.0, tmux 3.8, installed Pi 1.6.0 (repo lockfile 1.1.0 types).
- Direct mode, medium assurance (inherited from plan.md). Starting boundary HEAD `79cf148`; all changes are uncommitted working-tree edits. The planning artifacts (staged handoff rename, `spec/backlog.md`, `spec/index.md`, untracked item files) predate implementation and are untouched apart from this item's `plan.md` and this file.
- Unit tests ran with the harness's own `PI_SUBAGENT_*` variables unset. Inherited `PI_SUBAGENT_ALLOWED` makes one existing allowlist test fail at HEAD too; this is environment noise, not a defect.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| Baseline `npm test` at HEAD (inside tmux) | 311/311 pass | Run before changes |
| Baseline `env -u TMUX -u TMUX_PANE npm test` at HEAD | 305/311; 6 resume-tool tests fail without `$TMUX` | Shows the old `$TMUX` gate |
| `npm test` (inside tmux) | 333/333 pass | 22 added cases, no existing case changed |
| `env -u TMUX -u TMUX_PANE npm test` | 333/333 pass | Same |
| `node --test test/integration/tmux-surface.test.ts` in a controlled private session (`tmux -L pi-test-ctl`) | 17/17 pass | 12 split cases (one new: tagged split lookup) and 5 new detached cases |
| Same file under `env -u TMUX -u TMUX_PANE` | 5/5 detached pass; split cases skipped | Harness gates split cases on an attached client |
| Same file in the shared live tmux window | 16/17; the existing focus test failed | Live session changed focus; the file passes in the controlled session |
| `git diff --check` | clean | - |
| `npm pack --dry-run --json` | 23 files; same non-runtime set (README, LICENSE, docs, skill, config example, package.json) | - |
| E2E run 1 (approved, `anthropic/claude-haiku-5-5`, `pi --mode rpc -ne -e <worktree ext> -a`, TMUX unset) | 12 PASS, 4 FAIL (restart phase) | Summary below |
| E2E run 2 (approved re-run of the restart phase only, after the I2 fix) | 6/6 PASS | Summary below |

E2E run 1 (spawn, records, steer, result, resume):

- PASS: spawn returns immediately (`status: started`, tool 2.3 s including the shell-ready delay).
- PASS: the child runs on `tmux -L pi-subagents`, its pane tagged with its session file and completion file.
- PASS: `setWidget` sends string lines (`Subagents: 1 running`, `- e2e-a (e2e-headless-child): starting`).
- PASS: `setStatus("subagents")` sends `{"v":1,"running":[{"name":"e2e-a","agent":"e2e-headless-child","state":"starting","sessionFile":"..."}]}`.
- PASS: steering the running detached child returns `submitted`, and the child's reply contained the steered marker.
- PASS: `subagent_result` arrives as a steer message (exit 0) with `sessionFile` in its details.
- PASS: exactly one `notify` (`info`) per completion.
- PASS: widget and status are cleared when idle.
- PASS: 5 widget and 5 status records over about 44 s of runtime, so there is no per-second flood.
- PASS: resume returns `started`, and the resumed result (exit 0) carries the marker.
- FAIL (restart phase): on parent exit the aborted watcher closed the child pane, so the restarted parent found no live pane and resumed normally. Root cause and fix are recorded as plan Decision Log I2.

E2E run 2 (restart phase only, after I2):

- PASS: the child survives parent exit with a live tagged pane (`pi-subagents:%0`, completion file absent).
- PASS: the restarted parent (`--session <same parent file>`) gets `subagent_message` -> `{"status":"submitted","orphan":true,"surface":"pi-subagents:%0"}`.
- PASS: no second process on the session. There is one tagged pane, only the original launch script exists (no resume script), and the child session file has one session header.
- PASS: the orphan finished, its completion file exists, and its transcript contains `ORPHAN_STEERED` and `E2E_B_DONE`.
- PASS: the orphan result was not delivered to the later parent (documented behavior).
- Afterwards `findLiveTaggedPane` returned `absent` for the finished orphan.
- The script's process-count probe saw 0 processes both times because `ps` truncated the command line. The pane, script, and session-header evidence above carries this check.

Cleanup: the e2e panes were killed (the private server exited), and no e2e processes remain. The temporary profile, temporary project, parent sessions, child session directories under `~/.pi/agent/sessions/--tmp-k7q-e2e-run{1,2}-childcwd--`, and `/tmp/k7q-e2e` were removed after this file was written.

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R1 headless launch | Unit tests: selection and availability; integration: detached create/run/capture; E2E spawn on `-L pi-subagents` | Met |
| R2 same contract | E2E: immediate return, steer result, resume. Unit tests: chain propagation and transport-agnostic watcher. Detached completion-file and interruption integration cases | Met; see Unverified areas for ask_question, Claude, AGY, and chain under a live model |
| R3 steer and resume without `$TMUX` | E2E steer `submitted`, resume `started`; integration detached paste | Met |
| R4 RPC widget, status, notify | Unit tests: rpc vs tui, change-only, clear, notify; E2E records | Met |
| R5 session file exposure | Status JSON `sessionFile` (Pi only); `subagent_result` details `sessionFile` (E2E) | Met |
| R6 parent exit, orphan steering | I2 fix plus unit tests; unit orphan guard (found, unknown, absent, AGY, in-process); E2E run 2; README section | Met |
| R7 `maxConcurrent` | Unit tests: parse, slot counting, over-cap spawn and resume with no tmux call; inert when unset | Met |
| R8 env and credentials | Launch-script env building unchanged; detached server inherits the parent env; README documents this | Met (unchanged mechanism) |
| R9 tmux no regression | Split argv byte-identical unit test; 12 split integration cases pass; existing 311 cases pass unchanged. Accepted visible change: panes stay open after parent exit (I2) | Met with the accepted I2 effect |
| R10 `background` | Parser and diagnostics tests; selection matrix (background spawn detached, resume split); docs and skill updated | Met |

## Review findings

- Focused review of T01-T03 (flash-reviewer): PASS. Two non-blocking notes, both applied: a defensive `running.sessionFile` check, and Decision Log I1 recorded.
- Final contract-quality review: the first dispatch (alt-reviewer) failed before review because of a provider OAuth error, so it did not count as a review. The re-dispatch (flash-reviewer) returned PASS with two non-blocking notes: attached-server precedence in the lookup, and slot-release drift on a hypothetical crash. Neither needs a change.
- Targeted re-review of the post-review I2 change (retry 1 of 2): PASS with no blockers. Its prompt misstated the unit count as 335, and the reviewer repeated that figure; the observed count is 333/333.

## Failures and skipped checks

- E2E run 1 restart phase failed and exposed the I2 defect. It was fixed and re-verified in run 2.
- The existing focus integration test fails in the shared live tmux window and passes in a controlled session. This is pre-existing environment sensitivity.
- Model-consuming `test/integration/subagent-lifecycle.test.ts` was not run (no approval requested; outside the plan's verification list).

## Unverified areas

- The `ask_question` round-trip on the detached surface was not exercised with a live model. Coverage is from the surface-agnostic `submitText` path (detached paste integration case) and existing unit tests.
- Claude, AGY, and model-chain children on the detached surface were not run live. Coverage is from unit tests and shared launch code.
- The behavior of tmux older than 3.0 (lookup `unknown`, so resume is refused) is covered only by a unit test with a faked version string.
