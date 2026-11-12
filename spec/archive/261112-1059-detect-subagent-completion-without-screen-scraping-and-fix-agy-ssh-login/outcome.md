# Outcome: Detect subagent completion without screen scraping and fix AGY SSH login

Work item: `261112-1059-detect-subagent-completion-without-screen-scraping-and-fix-agy-ssh-login`
Disposition: completed
Date: 2026-11-12

## Delivered scope

- R1-R6 delivered:
  - Each launch writes a per-launch exit-code file at `artifacts/<session>/subagent-done/<launch-id>.code` through `completionSuffix`. All 5 launch and resume sites (Pi launch, Pi resume, Claude launch, AGY launch, AGY resume) do this.
  - `pollForExit` checks signals in this order: `.exit` sidecar, then the Claude sentinel, then the done file, then the screen. The done file is sampled at the start of each tick, then read and deleted.
  - The screen fallback uses `capture-pane -J` so a wrapped sentinel still matches.
  - AGY runs with an `env -u SSH_CONNECTION -u SSH_CLIENT -u SSH_TTY` prefix.
  - An AGY authentication failure reports "not logged in" and keeps the raw `providerError`.

## Deviations from plan

- None. T01-T04 were implemented before the Implement run, then re-verified and independently reviewed.

## Verification summary

- `npm test`: 296 of 296 pass, run with `PI_SUBAGENT_*` unset.
- `npm run test:integration`: 19 of 20 in each of two runs. Each run had one different intermittent failure in unchanged code: a live-model marker in one run and operator pane focus in the other. Each of those tests passed 2 of 2 isolated reruns. Both new tests passed in both full runs.
- `git diff --check`: clean.
- Contract-quality review: PASS with 0 findings and 0 retries. Details are in `verification.md`.

## Retained, reverted, or transferred work

- All work retained; nothing reverted or transferred.

## Residual risks

- No live end-to-end AGY or Claude child was run through the extension.
- No type-check is configured.
- The integration suite has intermittent live-model and tmux-focus flakes.

## Follow-up work items

- None.

## Source references

- `plan.md`, `verification.md`; `pi-extension/subagents/{tmux,agy,index}.ts`; `test/test.ts`; `test/integration/tmux-surface.test.ts`.

## Wiki updates

- `wiki/architecture.md`, `wiki/conventions/runtime-safety.md`, and `wiki/log.md` were written during implementation. The stale-status sweep found nothing to fix.
