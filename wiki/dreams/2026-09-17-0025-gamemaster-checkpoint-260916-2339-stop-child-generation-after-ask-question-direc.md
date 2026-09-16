---
schema_version: 1
episode_id: "2026-09-17-0025-gamemaster-checkpoint-260916-2339-stop-child-generation-after-ask-question-direc"
timestamp: "2026-09-17T00:25:58+02:00"
summary: "Replaced the terminating ask-question workaround with a correlated blocking rendezvous, proved same-run continuation with GPT-5.5, and archived the completed item."
kind: "gamemaster-checkpoint"
status: "shipped"
work_item: "260916-2339-stop-child-generation-after-ask-question"
current: "direct"
topics: ["ask-question","subagent-messaging"]
---

# Gamemaster checkpoint: 260916-2339-stop-child-generation-after-ask-question/direct

Date: 2026-09-17
Work item: `260916-2339-stop-child-generation-after-ask-question`
Status: shipped
In one line: Replaced the terminating ask-question workaround with a correlated blocking rendezvous, proved same-run continuation with GPT-5.5, and archived the completed item.

Checkpoint marker: Gamemaster checkpoint: 260916-2339-stop-child-generation-after-ask-question/direct

## Goal

Make a child's `ask_question` call wait for one exact parent answer without generating another model response while waiting, queueing the answer as a second child turn, or weakening existing tmux and resume behavior.

## How we approached it

The session resumed from a direct medium-assurance plan and a working tree containing the superseded `terminate: true` attempt. That behavior was replaced with a small versioned protocol helper, one in-memory pending question in the child, protected input interception, exact ID-only acknowledgment, and parent-side correlation state over the existing stdin-backed tmux path. Deterministic child, parent, protocol, timeout, abort, interruption, and transport tests were added before the separately approved live lifecycle check.

The first approved live invocation aborted before producing a verdict. Recovery preserved the implementation and prior model-free evidence, resolved the requested GPT-5.5 model from the local Pi catalog, and reran only the focused lifecycle test with a temporary runtime override. The live test, focused review, and final contract-quality review passed. Verification and outcome evidence were rewritten for the revised design, and the helper archived the item after explicit approval.

## Key decisions

- **Block on the tool promise** - kept `ask_question` unresolved until a matching answer because Pi cannot issue the next provider request while the current tool batch remains pending; rejected early termination because sibling tools and new-turn continuation weaken the contract.
- **Correlate input over the existing transport** - used an unguessable question ID, private JSON envelope, protected `handled` input, and an ID-only acknowledgment; rejected bare next-input capture and a second answer sidecar because they were less safe or less simple.
- **Preserve ambiguous-delivery safety** - kept timeout unconfirmed and retained the one-answer guard until exact acknowledgment or a proven state transition; rejected automatic replay or termination.
- **Keep paid verification bounded** - ran only the approved ask-question lifecycle case with `openai-codex/gpt-5.5`, leaving permanent user configuration unchanged.

## What did not work

- **The initial terminating-result design was insufficient** - it only suppressed follow-up inference when the finalized tool batch terminated and resumed from a new turn; the confirmed R001 design replaced it with the pending correlated rendezvous.
- **The first live test command aborted without a verdict** - it did not establish lifecycle correctness; the recovered run selected the supported GPT-5.5 provider/model from local configuration and passed the same focused test without broadening paid scope.

## Current state and where we left off

- Shipped/verified: all direct plan tasks are checked; model-free and approved live checks passed; focused and contract-quality reviews reported no blockers; the archived manifest is completed and the active copy is absent.
- Pending: source, tests, documentation, wiki updates, and archived evidence remain unstaged and uncommitted for a user-controlled Git checkpoint.

## Source of truth

- `spec/archive/260916-2339-stop-child-generation-after-ask-question/plan.md`: canonical R001 contract and completed tasks.
- `spec/archive/260916-2339-stop-child-generation-after-ask-question/verification.md`: commands, requirement coverage, review verdicts, recovery note, and scope boundary.
- `spec/archive/260916-2339-stop-child-generation-after-ask-question/outcome.md`: completed disposition, delivered scope, and residual risks.
- `pi-extension/subagents/question-protocol.ts`, `pi-extension/subagents/subagent-runtime-control.ts`, and `pi-extension/subagents/index.ts`: implemented protocol, child rendezvous, and parent routing.

## Verification

- Done: 215 unit tests; 9 model-free tmux surface tests; package dry run; operational spec, Markdown, and patch checks; one approved GPT-5.5 lifecycle test; focused and final contract-quality reviews with no blockers.
- Not verified yet: no accepted requirement remains unverified; multiple simultaneous child questions, sibling-tool rollback, and automatic replay remain explicitly out of scope.

## Open questions, blockers, next safe action

- Open/blocked: none within the archived contract.
- Next safe action: review the complete unstaged diff and create a user-controlled Git checkpoint only when explicitly authorized.

## Dynamic knowledge trail

- `wiki/architecture.md`: topic-specific dynamic knowledge for the correlated parent-question rendezvous and exact acknowledgment path.
