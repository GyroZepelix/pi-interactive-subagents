# 260914-1641 - frozen subagent reply delivery checkpoint

Date: 2026-09-14
Work item: `260914-1641-fix-frozen-subagent-reply-delivery`
Status: shipped
In one line: Recovered an interrupted implementation, completed and independently reviewed safe live reply delivery and recovery, then archived the item locally without staging or committing.

Checkpoint marker: Gamemaster checkpoint: 260914-1641-fix-frozen-subagent-reply-delivery/direct

## Goal

Prevent multi-kilobyte replies from freezing waiting Pi child panes, stop late accepted replies from being lost during lifecycle settlement, make acknowledgment wording truthful, and provide operator-controlled recovery without replaying ambiguous input.

## How we approached it

The session began from the canonical direct plan and an unchanged starting HEAD, with incomplete same-item edits left by an earlier implementation attempt. Those edits were preserved, inspected, corrected, and extended rather than reset. The transport path moved live text away from large literal key bursts; the message path gained bounded waiting-child activity acknowledgment; the runtime exit decision gained a pending-message guard; and exit polling learned to distinguish transient capture errors from confirmed pane disappearance.

Focused unit coverage exercised transport ordering and cleanup, waiting activity baselines, timeout behavior, lifecycle event ordering, and registry-preserving interruption. A no-model raw TUI fixture exercised exact 4,283-byte UTF-8 bracketed input, single submission, a responsive follow-up, buffer cleanup, and real pane removal in disposable tmux sessions. README recovery and the routed architecture, development, and runtime-safety pages were synchronized with the verified contract. Medium-assurance focused and final contract-quality reviews passed, the item was archived after explicit approval, and no Git checkpoint was created.

## Key decisions

- **Keep message content out of argv** - used a named tmux buffer loaded from stdin, bracketed paste, deletion, and a separate Enter; retained existing shell-command primitives only for launches.
- **Treat transport success as submission, not universal delivery** - confirmed only waiting Pi input from a newer same-child activity sequence and returned an unconfirmed timeout without automatic resend or kill.
- **Preserve ambiguous work** - made missing-pane cleanup release runtime state while retaining Pi name registration, so recovery remains explicit and session-aware.
- **Separate required no-model proof from optional model use** - relied on deterministic lifecycle seams and real tmux transport tests; kept the configured-model suite approval-gated.

## What did not work

- **The first implementation attempt ended without durable verification** - its source edits were recoverable but not trusted until current checks and reviews covered the complete working tree.
- **Plain unit execution inside a spawned child produced misleading discovery failures** - the inherited nested allowlist changed top-level behavior; the final suite passed with that child-only variable unset, and the reusable test-environment rule was added to `wiki/development.md`.
- **Early transport fixture runs failed for test-harness reasons** - one lacked an import and one bypass shell was not ready before injection; both seams were corrected before focused and full tmux passes.

## Current state and where we left off

- Shipped/verified: all direct plan tasks passed; the archived manifest is completed; required no-model checks, package inspection, operational validation, and both medium-assurance reviews passed.
- Pending: the implementation and archive remain unstaged and uncommitted. A model-backed waiting Pi lifecycle remains optional and approval-gated.

## Source of truth

- `spec/archive/260914-1641-fix-frozen-subagent-reply-delivery/plan.md`: canonical requirements, design, and completed tasks.
- `spec/archive/260914-1641-fix-frozen-subagent-reply-delivery/verification.md`: commands, requirement coverage, review verdicts, failures, and uncertainty.
- `spec/archive/260914-1641-fix-frozen-subagent-reply-delivery/outcome.md`: completed disposition, delivered scope, residual risks, and follow-ups.
- `pi-extension/subagents/tmux.ts`, `pi-extension/subagents/index.ts`, and `pi-extension/subagents/subagent-runtime-control.ts`: implemented transport, acknowledgment, recovery, and lifecycle behavior.

## Verification

- Done: 211 unit tests; 9 no-model tmux surface tests; wrapper and wrapper-bypass payload checks; package dry run; dependency, Markdown, patch, and operational spec checks; focused and contract-quality reviews with no blockers.
- Not verified yet: the configured-model lifecycle suite and a live model-backed reproduction of the original waiting-child incident.

## Open questions, blockers, next safe action

- Open/blocked: no implementation blocker. The bounded acknowledgment timeout can still report an intentional false-negative `unconfirmed` result on a loaded host.
- Next safe action: inspect the archived evidence and working-tree diff, then create a user-controlled Git checkpoint only when explicitly authorized; run the optional model-consuming lifecycle suite only under separate approval.

## Dynamic knowledge trail

- `wiki/development.md`: topic-specific verification guidance.
- `wiki/index.md` and `wiki/conventions/index.md`: corrected routing and current deferred-scope summaries.
- `wiki/architecture.md` and `wiki/conventions/runtime-safety.md`: previously synchronized topic-specific runtime guidance retained as the durable destination.
