---
schema_version: 1
episode_id: "2026-09-22-1805-gamemaster-checkpoint-260922-1641-finalize-subagents-only-after-agent-settlement"
timestamp: "2026-09-22T18:05:41+02:00"
summary: "Moved auto-exit finalization from low-level run end to final agent settlement, aligned the Pi 0.87.0 development baseline, and archived the verified direct item."
kind: "gamemaster-checkpoint"
status: "shipped"
work_item: "260922-1641-finalize-subagents-only-after-agent-settlement"
current: "direct"
topics: ["agent-lifecycle","auto-exit","pi-0.87"]
---

# Gamemaster checkpoint: 260922-1641-finalize-subagents-only-after-agent-settlement/direct

Date: 2026-09-22
Work item: `260922-1641-finalize-subagents-only-after-agent-settlement`
Status: shipped
In one line: Moved auto-exit finalization from low-level run end to final agent settlement, aligned the Pi 0.87.0 development baseline, and archived the verified direct item.

## Goal

Prevent retryable provider errors from prematurely producing failure completion signals or killing an auto-exit child, while preserving abort behavior, outstanding-work guards, and the parent watcher protocol.

## How we approached it

The direct medium-assurance implementation changed the child runtime to cache every `agent_end` message snapshot as a recoverable waiting state and defer finalization to `agent_settled`. A captured-extension harness then drove explicit error-to-success retry, exhausted-error, abort, pending-question, nested-child, queued-message, and non-auto-exit sequences. Activity schema version 1 gained the settled terminal event without changing its shape.

After the lifecycle behavior passed focused checks, the approved development dependencies and lockfile were aligned to Pi coding-agent and TUI 0.87.0 with matching TypeBox 1.3.27 while wildcard peers stayed unchanged. The model-free unit, tmux, dependency, package, spec, Markdown, and patch gates passed before user and durable guidance were synchronized. Focused review passed; the final Contract-quality review first required the missing verification artifact, then passed targeted re-review retry 1. Explicit terminal approval was obtained before the helper archived the item.

## Key decisions

- **Finalize only at settlement** - used Pi's `agent_settled` boundary because `agent_end` can precede automatic retry, compaction recovery, or queued continuation; rejected parent-side retry awareness because the existing sidecar protocol should remain terminal.
- **Replace the latest run outcome** - cached each successive `agent_end.messages` snapshot because `agent_settled` has no message payload and a successful retry must supersede a transient error.
- **Keep waiting state recoverable** - left the activity recorder enabled after `agent_end` and recorded done only at settlement so retry and continuation events remain visible.
- **Use deterministic retry evidence** - tested explicit handler sequences instead of depending on a provider to return a retryable failure on demand; kept the paid lifecycle check separately approval-gated.
- **Align development without changing the public peer contract** - updated Pi/TUI to 0.87.0 and TypeBox to 1.3.27 while preserving wildcard peer ranges and package version.

## What did not work

- **Local reviewer sessions returned no report** - the flash reviewer, its resumed session, and a replacement worker exited without output; the orchestrator obtained fresh independent Focused and Contract-quality reports instead of treating missing output as evidence.
- **The first final review lacked durable verification evidence** - behavior and scope passed, but the absent `verification.md` blocked completion; creating the evidence artifact, rerunning affected checks, and targeted re-review resolved the finding without changing product behavior.

## Current state and where we left off

- Shipped/verified: all direct tasks are complete; the archived manifest is `completed`; verification and outcome agree; the archive index row is present; no active copy or unrelated changed path remains.
- Pending: implementation, dependency, documentation, wiki, and archived item changes remain unstaged and uncommitted for a user-controlled Git checkpoint.

## Source of truth

- `spec/archive/260922-1641-finalize-subagents-only-after-agent-settlement/plan.md`: canonical settled-finalization contract, decisions, non-goals, and completed tasks.
- `spec/archive/260922-1641-finalize-subagents-only-after-agent-settlement/verification.md`: commands, requirement coverage, reviewer history, skipped live gate, and bounded uncertainty.
- `spec/archive/260922-1641-finalize-subagents-only-after-agent-settlement/outcome.md`: completed disposition and residual risk.
- `pi-extension/subagents/subagent-runtime-control.ts` and `pi-extension/subagents/activity.ts`: implemented settlement and activity boundaries.
- `test/test.ts`: deterministic lifecycle and activity regressions.

## Verification

- Done: 222 unit tests; 9 tmux surface tests; Pi/TUI 0.87.0 and TypeBox 1.3.27 dependency proof; 18-file package dry run; operational spec, Markdown, and patch checks; Focused review PASS; Contract-quality re-review retry 1 PASS.
- Not verified yet: the approval-gated configured-provider happy-path lifecycle test was not run; deterministic sequences and inspected Pi 0.87.0 settlement semantics bound that uncertainty but do not represent live provider evidence.

## Open questions, blockers, next safe action

- Open/blocked: none within the archived contract.
- Next safe action: inspect the complete unstaged diff and create a user-controlled Git checkpoint only when explicitly authorized.

## Dynamic knowledge trail

- `wiki/architecture.md` and `wiki/conventions/runtime-safety.md`: topic-specific dynamic knowledge for the settled auto-exit and recoverable activity boundary.
- `wiki/overview.md` and `wiki/development.md`: topic-specific dynamic knowledge for the verified Pi 0.87.0 development baseline and deterministic lifecycle test coverage.
