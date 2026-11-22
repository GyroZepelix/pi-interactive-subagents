---
schema_version: 1
episode_id: "2026-11-22-2143-gamemaster-checkpoint-261122-1959-headless-rpc-mode-subagents-direct"
timestamp: "2026-11-22T21:43:48+01:00"
summary: "Implemented and archived headless subagents on a private detached tmux server, the background profile field, live-orphan steering, RPC status records, and optional maxConcurrent at medium assurance; the E2E check exposed that parent exit killed child panes, which was fixed."
kind: "gamemaster-checkpoint"
status: "shipped"
work_item: "261122-1959-headless-rpc-mode-subagents"
current: "direct"
topics: ["headless subagents","tmux"]
---

# Gamemaster checkpoint: 261122-1959-headless-rpc-mode-subagents/direct

Date: 2026-11-22
Work item: 261122-1959-headless-rpc-mode-subagents
Status: shipped
In one line: Implemented and archived headless subagents on a private detached tmux server, the background profile field, live-orphan steering, RPC status records, and optional maxConcurrent at medium assurance; the E2E check exposed that parent exit killed child panes, which was fixed.

## Goal

Let a parent Pi without a tmux client, such as A.Y.A. running `pi --mode rpc` behind its bridge, spawn, steer, resume, and receive subagent results with the same tool contract. Let `background: true` profiles avoid splitting inside tmux, and leave laptop tmux behavior unchanged by default.

## How we approached it

The Twin ran Implement in direct mode, starting from HEAD 79cf148. It took a clean-env baseline (311/311 inside tmux; 305/311 without `$TMUX` because of the old gate). In `tmux.ts` it routed every tmux call through an injectable transport and added socket-qualified `pi-subagents:%n` handles, detached session creation, pane tags, and a live-pane lookup. In `index.ts` it added surface selection at every spawn, chain, and resume site, the orphan guard in `subagent_message`, the RPC widget/status/notify branch, and the `maxConcurrent` slot reservation. It added the `background` field in `agents.ts` and the config key in `status.ts`. Tests were added in `test/test.ts` and `tmux-surface.test.ts`, the split integration cases were gated on an attached client, and the README, agent definitions, and profile skill were updated. A focused T01-T03 review passed. The final contract-quality review passed after one provider-auth dispatch failure. The approved Haiku 5.5 E2E then failed its parent-restart phase. The Twin traced the failure to the watcher's abort path closing panes, fixed it, got an approved restart-only re-run (6/6), passed a targeted re-review, and archived with terminal approval.

## Key decisions

- **Fixed socket `pi-subagents` with one detached session per child** - gives one attach point, and the server exits when empty; rejected pipe or `pi -p` children because they cannot be steered (plan D1, P1).
- **Liveness needs both the session tag and an absent completion file (I1)** - an orphan pane's shell outlives its child, so steering by tag alone would type into a shell.
- **Aborted watches leave panes running (I2)** - R6/D2 require children to survive parent exit. The user accepted that panes inside tmux stay open after pi quits.
- **Unknown lookup refuses resume** - a transport failure or tmux older than 3.0 never counts as absence; only a missing private server does.

## What did not work

- **E2E run 1 restart phase** - session_shutdown aborted the watchers, and the catch path closed every child pane, so the restarted parent resumed normally. The plan's Context had claimed that panes were never killed. A future session should verify lifecycle claims against the catch paths, not only the shutdown handler.
- **Process-count probe in the E2E script** - `ps -axo command=` truncated the command lines and found 0 processes. Use `ps -ww`, or rely on pane, launch-script, and session-header evidence.
- **alt-reviewer dispatch** - failed immediately with a Cursor OAuth refresh error; it was re-dispatched with flash-reviewer.

## Current state and where we left off

- Shipped/verified: the item is archived at `spec/archive/261122-1959-headless-rpc-mode-subagents/` with plan, verification, and outcome. Source, tests, docs, and wiki edits are uncommitted.
- Pending: the Gamemaster backlog selection for candidates C1-C6 (orphan result delivery, background across resume, counting earlier orphans, orphan pane cleanup, live E2E for other harnesses, and A.Y.A. bridge consumption in pi-voice-assistant).

## Source of truth

- `spec/archive/261122-1959-headless-rpc-mode-subagents/plan.md`: canonical contract, including Decision Log rows I1 and I2.
- `spec/archive/261122-1959-headless-rpc-mode-subagents/verification.md`: checks, E2E results, reviews, and unverified areas.
- `spec/archive/261122-1959-headless-rpc-mode-subagents/outcome.md`: delivered scope, residual risks, and backlog candidates.
- `pi-extension/subagents/tmux.ts`, `pi-extension/subagents/index.ts`: detached surface, orphan guard, RPC status, cap, and abort handling.

## Verification

- Done: `npm test` passed 333/333 with `TMUX` set and unset. The tmux surface integration passed 17/17 in a controlled session and 5/5 detached cases without `TMUX`. `git diff --check` was clean and the package dry run was unchanged. E2E run 1 passed spawn, records, steer, result, and resume; run 2 passed the restart phase. The focused, final, and targeted reviews all passed.
- Not verified yet: a live `ask_question` round-trip and live Claude, AGY, and model-chain children on the detached surface; behavior on real tmux older than 3.0.
- Remaining gate violations: none.

## Open questions, blockers, next safe action

- Open/blocked: the user's backlog selection for C1-C6 is pending with Gamemaster.
- Next safe action: apply the user's C1-C6 selection, then create a user-controlled Git checkpoint.

## Dynamic knowledge trail

- `wiki/architecture.md`: two stale-fact corrections plus two topic-specific additions.
- `wiki/conventions/runtime-safety.md`: one stale-fact correction and one topic-specific addition.
- `wiki/development.md`: one stale-fact correction and one topic-specific merge.
- `wiki/map.md`: one topic-specific merge.
- `wiki/conventions/typescript-modules.md`: one topic-specific merge.
