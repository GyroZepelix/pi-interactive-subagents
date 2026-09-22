# Dream learnings: 260922-1641-finalize-subagents-only-after-agent-settlement

Work item: `260922-1641-finalize-subagents-only-after-agent-settlement`

> Historical snapshot: this ledger records what Dream retained at each Gamemaster checkpoint. Current source, plans, verification, outcomes, and current dynamic destinations remain authoritative.

<!-- dream-checkpoints:start -->

## Gamemaster checkpoint: 260922-1641-finalize-subagents-only-after-agent-settlement/direct

Date: 2026-09-22
Dream log: [2026-09-22-1805-gamemaster-checkpoint-260922-1641-finalize-subagents-only-after-agent-settlement.md](../2026-09-22-1805-gamemaster-checkpoint-260922-1641-finalize-subagents-only-after-agent-settlement.md)
Outcome: retained learning

### Settled auto-exit boundary

- **Exact written text:**
  > 6. For an auto-exit Pi child, each `agent_end` replaces the captured low-level run outcome and records a recoverable waiting snapshot. Finalization waits for `agent_settled`, then rechecks pending questions, running nested children, Pi-owned queued messages, and abort state before writing any final error sidecar, recording terminal activity, and requesting shutdown (`pi-extension/subagents/subagent-runtime-control.ts`, `pi-extension/subagents/activity.ts`).
  >
  > - Activity snapshots are version 1 JSON files written by temp-file rename. `agent_end` is a waiting state that remains writable across retry activity; terminal auto-exit records `latestEvent: "agent_settled"`. Invalid or wrong-child snapshots are rejected (`pi-extension/subagents/activity.ts`).
  >
  > - Treat child `agent_end` as a recoverable low-level run boundary, never as final completion. Cache its latest messages and keep activity writable so automatic retry, compaction recovery, or queued continuation can replace a transient error. Only `agent_settled` may finalize auto-exit, after rechecking pending questions, running nested children, Pi-owned pending messages, and abort state (`pi-extension/subagents/subagent-runtime-control.ts`, `pi-extension/subagents/activity.ts`).
- **Destination and classification:** `wiki/architecture.md` and `wiki/conventions/runtime-safety.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** The archived R1-R7 contract, deterministic error-to-success and guarded-settlement sequences, 222 passing unit tests, inspected Pi 0.87.0 settlement semantics, and both independent review gates establish this child lifecycle boundary.
- **Expected future benefit:** Future lifecycle, retry, activity, or watcher changes can keep `agent_end` recoverable and avoid recreating premature failure sidecars, disabled activity, or pane termination before Pi finishes retry and queued work.
- **Why this tier:** This is stable repository lifecycle architecture with recurring value for subagent runtime work; it is narrower than a repository-wide convention and fully established rather than tentative.

### Pi 0.87 development baseline and deterministic lifecycle coverage

- **Exact written text:**
  > - Runtime APIs use a verified Pi 0.87.0 development baseline through `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, and matching `typebox`; public peer ranges remain wildcard (`package.json`, `package-lock.json`).
  >
  > - The verified development baseline targets Pi 0.87.0 APIs and matching TypeBox, while public peer ranges remain wildcard. Profile extension paths resolve read-only from exact configured global package sources or, for trusted project profiles, project-first package settings with safe global fallback (`package.json`, `package-lock.json`, `pi-extension/subagents/agents.ts`).
  >
  > Pi 0.87.0 dispatches lifecycle handlers in extension load order. Keep protected tool registration controls first so ordinary profile collisions cannot replace framework tools, and keep the tool-free activation control last so it observes same-event profile registrations before the next model request. Do not merge these roles without re-verifying Pi's lifecycle semantics (`package.json`, `spec/archive/260909-1952-profile-extension-loading/plan.md`, Decision D16).
  >
  > - Runtime use is verified against Pi 0.87.0 and requires tmux. Pi must run inside tmux, for example `tmux new -A -s pi 'pi'` (`README.md`, `package.json`, `package-lock.json`, `pi-extension/subagents/tmux.ts`).
  >
  > - `test/test.ts` directly imports production modules and exercises session persistence, validated profile discovery, trust, precedence, canonical identity, fail-closed tools, activity/status transitions, tool registration, runtime names, steering acknowledgment and timeout, settled auto-exit event sequences (including retry recovery, final error, abort, and outstanding-work guards), missing-pane recovery, rendering, and tmux helpers.
- **Destination and classification:** `wiki/overview.md`, `wiki/architecture.md`, `wiki/conventions/runtime-safety.md`, and `wiki/development.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** The approved dependency alignment resolves coding-agent and TUI 0.87.0 with TypeBox 1.3.27, preserves wildcard peers, and passes the complete model-free unit, tmux, package, and dependency gates; deterministic lifecycle tests directly cover the extension-owned settlement sequences.
- **Expected future benefit:** Future development and lifecycle work starts from the verified dependency baseline, preserves the public peer contract, and uses deterministic event sequences rather than mistaking a flaky provider failure for reliable retry proof.
- **Why this tier:** This is stable current-state development and verification guidance scoped to the Pi integration; it belongs in the existing runtime and development pages rather than the always-load pointer or a tentative observation.
