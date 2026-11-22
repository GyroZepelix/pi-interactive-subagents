# Outcome: Headless RPC-mode subagents

Work item: `261122-1959-headless-rpc-mode-subagents`
Disposition: completed
Date: 2026-11-22

## Delivered scope

- T01: `tmux.ts` gains a socket-qualified detached surface on the private server `tmux -L pi-subagents`.
  - Each detached child gets its own session; handles look like `pi-subagents:%n`.
  - Every primitive routes through one injectable transport. Split handles keep byte-identical argv.
  - Detached closes skip rebalancing.
  - Pane tags `@pi_subagent_session` and `@pi_subagent_done` are set on every child pane. `findLiveTaggedPane` returns `found`, `absent`, or `unknown`.
  - Availability now needs only the tmux binary, and the setup hint names installing tmux.
- T02: `selectSurfaceKind`.
  - A spawn is detached when `$TMUX` is unset or the profile sets `background: true`. A resume is detached only when `$TMUX` is unset.
  - It is wired into Pi, Claude, and AGY spawn, model-chain attempts, and AGY and Pi resume.
  - The new optional boolean profile field `background` has validation diagnostics.
- T03: an orphan steering guard in `subagent_message`.
  - A live tagged Pi or Claude pane from an earlier parent is steered (`submitted`, `orphan: true`).
  - A live AGY orphan is refused.
  - An unknown lookup refuses the resume.
  - A child that this process already runs is left to the existing in-memory paths.
- T04: in RPC mode only, `setWidget` sends string lines and `setStatus("subagents")` sends `{"v":1,"running":[...]}`. Each is sent only when its content changes and is cleared when idle. One `notify` is sent per `subagent_result`.
- T05: an optional top-level `maxConcurrent` in `config.json`. When set, spawn and resume are rejected over the cap before any pane exists. It is inert when unset, and steering is not capped.
- T06: README (new Headless and background mode section, RPC status contract, parent exit and restart, `maxConcurrent`), `docs/agent-definitions.md`, and the `subagent-profiles` skill.

## Deviations from plan

- I1 (implementation detail): an extra `@pi_subagent_done` pane tag means a finished orphan, whose pane is left at a shell prompt, is never treated as live.
- I2 (source-truth correction, user-accepted): the plan's Context claimed `session_shutdown` never killed panes, but the aborted watcher closed them. Aborted watches now leave panes running, as R6/D2 require. Visible effect: inside tmux, child panes stay open after pi quits.
- Integration harness: split-pane cases are now gated on an attached tmux client (`isTmuxAvailable`), because `isMuxAvailable` now needs only the binary.

## Verification summary

See [verification.md](./verification.md).

- Unit tests: 333/333 with `TMUX` set and unset (baseline 311).
- tmux surface integration: 17/17 in a controlled session; 5/5 detached cases without `TMUX`.
- `git diff --check` is clean, and `npm pack --dry-run` is unchanged.
- Approved E2E with `anthropic/claude-haiku-5-5`:
  - Run 1 passed the spawn, records, steer, result, and resume phases. Its restart phase failed, which exposed I2.
  - Run 2, after the fix, passed the restart phase 6/6: the orphan was steered and no second process started.
- Reviews:
  - Focused T01-T03: PASS.
  - Final contract-quality review: PASS. The first dispatch failed with a provider OAuth error before any review.
  - Targeted re-review of I2 (retry 1): PASS.

## Retained, reverted, or transferred work

All changes are retained as uncommitted working-tree edits. The E2E temporary profile, sessions, artifacts, and panes were removed.

## Residual risks

- Shared fixed socket: the detached server keeps the ambient environment of the parent that started it (accepted risk P1).
- tmux older than 3.0: the live-pane lookup is `unknown`, so resume is refused.
- Inside tmux, child panes now remain after quitting pi (I2, accepted) and need manual `tmux kill-pane`.
- Orphan results are not delivered to a later parent (accepted D2).
- Not exercised live on the detached surface: `ask_question` round-trip, Claude, AGY, and model-chain children (covered by unit tests and shared code).
- If an earlier parent's watcher consumed a completion file but its close failed, a stale pane can still look live after a restart.
- Model-chain fallback attempts are not counted separately against `maxConcurrent`.

## Follow-up work items

Backlog candidates (not added):

- C1: Deliver orphan results after a parent restart. Children that outlive their parent finish quietly; their results sit in session files and never reach a later parent. Adds a result inbox or watcher re-adoption. Origin: deferred by you in planning.
  - Decision: dropped
- C2: Remember `background` across resume. Today a `background: true` child resumed inside tmux opens a split pane (G1). Origin: deferred by you in planning.
  - Decision: dropped
- C3: Count earlier-parent orphans toward `maxConcurrent`. The cap counts only this parent's children, so orphans still running from a previous parent are invisible to it. Origin: deferred by you in planning.
  - Decision: dropped
- C4: Clean up finished orphan panes. After a parent exits, child panes stay open at a shell prompt once the child finishes (I2). An optional cleanup, for example closing a pane whose completion file exists, would tidy tmux. Origin: found by the agent.
  - Decision: added B4
- C5: Live E2E coverage of `ask_question`, Claude, AGY, and model-chain children on the detached surface. Only Pi children were exercised live. Origin: found by the agent.
  - Decision: dropped
- C6: A.Y.A. bridge consumption of the `subagents` status, wake lock, idle-stop, and Android notifications. Target repository: pi-voice-assistant. Origin: deferred by you in planning.
  - Decision: handoff pi-voice-assistant spec/handoffs/2026-11-22-from-pi-interactive-subagents-consume-headless-subagent-status.md - sent

## Source references

- [plan.md](./plan.md), [discovery.md](./discovery.md), [handoff.md](./handoff.md), [verification.md](./verification.md)
- Source and tests: `pi-extension/subagents/{tmux,index,agents,status}.ts`, `test/test.ts`, `test/integration/{harness,tmux-surface.test}.ts`
- Docs: `README.md`, `docs/agent-definitions.md`, `skills/subagent-profiles/SKILL.md`

## Wiki updates

- `wiki/overview.md`: replaced the stale "tmux-only" purpose line and the "`$TMUX` required" runtime bullet with the split-or-detached behavior.
- Stale-status sweep (`measure-wiki-quality.py --stale-status`): 0 hits.
- Durable architecture updates proposed in plan.md (architecture, runtime-safety, map) are left for Dream.
