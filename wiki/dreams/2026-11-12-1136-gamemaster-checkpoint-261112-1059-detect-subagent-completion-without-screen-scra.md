---
schema_version: 1
episode_id: "2026-11-12-1136-gamemaster-checkpoint-261112-1059-detect-subagent-completion-without-screen-scra"
timestamp: "2026-11-12T11:36:10+01:00"
summary: "File-based subagent completion signal plus AGY SSH-env login fix verified, reviewed, and archived completed."
kind: "gamemaster-checkpoint"
status: "shipped"
work_item: "261112-1059-detect-subagent-completion-without-screen-scraping-and-fix-agy-ssh-login"
current: "direct"
topics: ["completion detection","agy auth"]
---

# Gamemaster checkpoint: 261112-1059-detect-subagent-completion-without-screen-scraping-and-fix-agy-ssh-login/direct

Date: 2026-11-12
Work item: 261112-1059-detect-subagent-completion-without-screen-scraping-and-fix-agy-ssh-login
Status: shipped
In one line: File-based subagent completion signal plus AGY SSH-env login fix verified, reviewed, and archived completed.

## Goal

Children that finish must reach the parent regardless of pane width or resizes. AGY children launched from an SSH-attached tmux session must use the keychain login, and a real AGY login failure must give a clear error.

## How we approached it

- The parent session diagnosed two causes. First, the screen sentinel wrapped in panes 14-17 columns wide and was later erased by prompt redraws. Second, tmux copied `SSH_CONNECTION` into panes, which forced AGY into file-based token storage.
- The parent session then implemented T01-T04 before Implement ran, including a done-file `completionSuffix`, `pollForExit` priority, `capture-pane -J`, an `env -u SSH_*` AGY prefix, the not-logged-in mapping, tests, and wiki updates.
- A Gamemaster-spawned Twin re-ran every planned check over the working tree, ran one medium-assurance contract-quality review, rewrote `verification.md` into the template shape, and archived after Gamemaster approval.

## Key decisions

- **Primary completion signal** - chose a per-launch exit-code file (temp plus `mv`), deleted on read, and kept the screen sentinel as a joined-line fallback. A pure screen fix was rejected because a redraw can erase the marker.
- **AGY auth** - chose to always unset `SSH_CONNECTION`, `SSH_CLIENT`, and `SSH_TTY`. An early kill on the login prompt was rejected by user choice, so AGY's own 60-second timeout stands.
- **Model chain** - keep the raw `providerError` so auth failures do not count as provider exhaustion.

## What did not work

- **Running `npm test` inside the Twin subagent** - unrelated discovery tests failed with `agent not in allowlist` because the subagent's `PI_SUBAGENT_*` variables were inherited. Unsetting them gave 296 of 296 passes; this matches existing development guidance.
- **Full integration runs** - each of the two Twin runs had one different intermittent failure in an unchanged path (live-model system-prompt marker; operator `nvim` pane focus). The parent's earlier run failed `ask_question`. Every failing test passed its isolated reruns.

## Current state and where we left off

- Shipped/verified: archived completed at `spec/archive/261112-1059-detect-subagent-completion-without-screen-scraping-and-fix-agy-ssh-login/`. The code, test, and wiki changes are uncommitted in the working tree.
- Pending: a user-controlled Git checkpoint.

## Source of truth

- `spec/archive/261112-1059-detect-subagent-completion-without-screen-scraping-and-fix-agy-ssh-login/plan.md`: requirements R1-R6 and decisions D1-D4.
- `spec/archive/261112-1059-detect-subagent-completion-without-screen-scraping-and-fix-agy-ssh-login/verification.md`: checks, flake reruns, and the review verdict.
- `spec/archive/261112-1059-detect-subagent-completion-without-screen-scraping-and-fix-agy-ssh-login/outcome.md`: delivered scope and residual risks.
- `pi-extension/subagents/tmux.ts`, `pi-extension/subagents/agy.ts`, `pi-extension/subagents/index.ts`: the implementation.

## Verification

- Done:
  - `npm test`: 296 of 296 pass.
  - `npm run test:integration`: 19 of 20 in each of two runs, with the failures passing isolated reruns.
  - `git diff --check`: clean.
  - Contract-quality review: PASS with 0 findings.
  - Archive preflight and the stale-status sweep were clean.
- Not verified yet: a live end-to-end AGY or Claude child through the extension; no type-check is configured.

## Open questions, blockers, next safe action

- Open/blocked: none.
- Next safe action: review and commit the working-tree changes for this item.

## Dynamic knowledge trail

- `wiki/observations.md`: Observation (integration flake triage) added; one aged review-evidence observation discarded.
- `wiki/architecture.md` and `wiki/conventions/runtime-safety.md`: written during implementation, not by this Dream run.
