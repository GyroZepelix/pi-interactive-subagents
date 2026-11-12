# Plan: Detect subagent completion without screen scraping and fix AGY SSH login

Work item: `261112-1059-detect-subagent-completion-without-screen-scraping-and-fix-agy-ssh-login`
Status: Planned
Created: 2026-11-12
Updated: 2026-11-12

Assurance: medium - changes the completion signal for every child harness (Pi, Claude, AGY) across launch and resume paths, so a regression could hang or prematurely finish children; the change is additive (existing signals stay as fallbacks) and easy to revert.

## Goal

Children that finish must always be reported back to the parent, regardless of pane width or later pane resizes. AGY children launched from a tmux session that an SSH client attached to must use the existing keychain login instead of failing authentication. A real AGY login failure must produce a clear, actionable error.

## Context

Diagnosed on 2026-11-12 from session `17fabee1` (library-of-alexandria twin, parent artifacts `01a1cca3-...`) at `b4e1ca2`:

- F1 (hang): AGY children and clean-exiting Pi children are detected only by the terminal sentinel `__SUBAGENT_DONE_<code>__`, read with `tmux capture-pane -p -S -5` (no `-J`) and matched with a single-line regex (`pi-extension/subagents/tmux.ts` `pollForExit`, `readScreenAsync`). The finder panes were 14-17 columns wide, so the 19-character sentinel wrapped and never matched. Reproduced in an isolated tmux server: a 14-column pane printed the marker and the exact watcher capture returned `match: null`. A later window resize made zsh redraw its prompt and erase the marker line (also reproduced), so no evidence remained.
- F2 (AGY failure): tmux `update-environment` copies `SSH_CONNECTION` from an SSH-attached client into new panes. AGY 1.5.6 then logs `Using file-based token storage because SSH session detected`, finds no token file, and waits 60 seconds for interactive OAuth before writing `status: ERROR`, `error: "authentication failed or timed out"`. Verified: `env -u SSH_CONNECTION -u SSH_CLIENT -u SSH_TTY agy ...` from an SSH-tagged pane authenticates silently from the keychain and returns `SUCCESS`.
- Verified: redirecting AGY stdin from `/dev/null` does not shorten the 60-second login wait, and `agy --help` has no non-interactive auth flag.
- Claude children additionally use the Stop-hook sentinel file (`/tmp/pi-claude-<id>-done`); Pi errors use the `${sessionFile}.exit` sidecar. Both are file signals and are unaffected by F1.

## Requirements

- R1: Every launch and resume script (Pi launch, Pi resume, Claude launch, AGY launch, AGY resume) writes the child's exit code to `<parent artifact dir>/subagent-done/<launch id>.code` after the child process exits, via a temporary file plus `mv` so readers never see a partial file. The existing `__SUBAGENT_DONE_<code>__` echo stays after it.
- R2: `RunningSubagent` carries the done-file path, and `pollForExit` accepts it. Priority within one tick: `.exit` sidecar, then Claude sentinel, then the done file, then the screen. The done-file existence is sampled at the start of the tick so a `.exit` or Claude sentinel written before the child exited always wins. A found done file is read, deleted, and reported as `{ reason: "sentinel", exitCode }` (unparsable content reports exit code 1).
- R3: The screen fallback capture joins wrapped lines (`capture-pane -J`) so a wrapped marker still matches for children launched before this change.
- R4: Every AGY launch and resume command runs `env -u SSH_CONNECTION -u SSH_CLIENT -u SSH_TTY agy ...`.
- R5: When an AGY result has status `ERROR` and the structured error or stderr indicates an authentication failure, the user-facing error says AGY is not logged in and to run `agy` in a terminal to sign in, then retry. `providerError` stays the raw structured AGY error so model-chain exhaustion classification is unchanged.
- R6: Unchanged: `.exit` sidecar handling, Claude Stop-hook sentinel handling and summary extraction, pane-missing interruption handling, result extraction, and resume behavior.

## Out of scope

- Stopping AGY early when its login prompt appears (user chose the clear error after AGY's own 60-second timeout).
- Changing the user's tmux `update-environment` or AGY settings.
- Removing the terminal sentinel echo or other screen-reading code.
- Unrelated refactors of launch-command construction.

## Design

- `tmux.ts`: add `completionSuffix(doneFile)` returning `; subagent_exit=$?; printf '%s\n' "$subagent_exit" > <tmp> && mv -f <tmp> <done>; echo '__SUBAGENT_DONE_'$subagent_exit'__'` with shell-escaped paths. Add a `doneFile` option to `pollForExit` implementing R2. Give `readScreenAsync` an optional join flag and use it for the poll default.
- `index.ts`: add a helper that returns and prepares (mkdir) `join(artifactDir, "subagent-done", `${id}.code`)`; use the launch `id` (a fresh UUID per launch and per resume). Replace the 3 inline `; echo '__SUBAGENT_DONE_'$?'__'` suffixes (Claude, Pi launch, Pi resume) with `completionSuffix`, store `doneFile` on each `RunningSubagent`, and pass it from `watchSubagent`.
- `agy.ts`: `buildAgyCommand` takes `doneFile`, prefixes `env -u SSH_CONNECTION -u SSH_CLIENT -u SSH_TTY`, and ends with `completionSuffix`. `parseAgyResult` maps authentication errors per R5.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D1 | Completion | Use a per-launch exit-code file in the parent artifact dir as the primary signal; keep the screen marker as fallback with `-J`. | Removes dependence on pane width, resizes, and redraws; per-launch IDs prevent stale files; deleting on read avoids buildup. | Reproduced F1 in isolated tmux | Pi provides a native child-exit channel |
| D2 | AGY auth | Always unset `SSH_CONNECTION`, `SSH_CLIENT`, `SSH_TTY` for AGY. | AGY picks token storage from those variables only; the tmux server runs in the desktop session and can reach the keychain. | AGY log line; verified silent keychain auth with `env -u` | Running on hosts where the keychain is genuinely unavailable |
| D3 | AGY auth error | Clear error after AGY's own 60-second timeout; no early kill. | User choice; `/dev/null` stdin does not shorten the wait. | Manual test on 2026-11-12 | Login failures become frequent |
| D4 | Model chain | Keep `providerError` raw. | Auth failures must not newly count as provider exhaustion. | `model-chain.ts` `classifyExhaustion` | Chain policy changes |

## Work breakdown

- [x] T01: Exit-code file and wrap-safe fallback (R1-R3, R6).
  - Expected areas: `pi-extension/subagents/tmux.ts`, `pi-extension/subagents/index.ts`, `pi-extension/subagents/agy.ts`.
  - Acceptance: all 5 launch paths write the done file; `pollForExit` honors R2 priority.
- [x] T02: AGY SSH environment and login error (R4-R5).
  - Expected areas: `pi-extension/subagents/agy.ts`.
- [x] T03: Tests.
  - Unit (`test/test.ts`): `pollForExit` with a done file (exit code, deletion, `.exit` priority, unparsable content); `completionSuffix` shape; `buildAgyCommand` env prefix and done suffix; `parseAgyResult` auth mapping with raw `providerError`.
  - Integration (`test/integration/tmux-surface.test.ts`): a pane narrower than the marker running a script with `completionSuffix` is detected as finished with the right exit code; a wrapped screen marker alone is also detected.
- [x] T04: Durable knowledge after verification: update the completion-flow description in `wiki/architecture.md` (and `wiki/conventions/runtime-safety.md` if it describes completion signals), plus `wiki/log.md` per `wiki/AGENTS.md`.

## Acceptance criteria

- A child finishing in a pane narrower than 19 columns is reported to the parent.
- A child whose marker was erased from the screen is still reported (done file).
- AGY launch and resume scripts contain the `env -u` prefix and the done-file suffix.
- An AGY authentication failure reports the clear not-logged-in error.
- Existing unit and integration tests still pass.

## Verification plan

- `npm test`
- `npm run test:integration` (requires tmux)
- `git diff --check`

## Risks and blockers

- A stale done file could finish a new run early; mitigated by fresh per-launch IDs and delete-on-read.
- A `.exit` sidecar written just before exit could be missed in favor of the done file; mitigated by sampling the done file first and then checking `.exit` and the Claude sentinel in the same tick.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete (T01-T04).
- [x] Verification run; see `verification.md`.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read this plan and its item.yaml completely.
Implement the work step by step while preserving Requirements, Out of scope, Decision Log, and Verification plan.
Update Progress and the Decision Log when confirmed implementation discoveries change the approach.
Run the specified verification before reporting completion.
Stop and ask before dependencies, migrations, destructive operations, external writes, commits, pushes, or scope expansion.
```
