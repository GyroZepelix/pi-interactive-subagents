# Dream learnings: 260916-2339-stop-child-generation-after-ask-question

Work item: `260916-2339-stop-child-generation-after-ask-question`

> Historical snapshot: this ledger records what Dream retained at each Gamemaster checkpoint. Current source, plans, verification, outcomes, and current dynamic destinations remain authoritative.

<!-- dream-checkpoints:start -->

## Gamemaster checkpoint: 260916-2339-stop-child-generation-after-ask-question/direct

Date: 2026-09-17
Dream log: [2026-09-17-0025-gamemaster-checkpoint-260916-2339-stop-child-generation-after-ask-question-direc.md](../2026-09-17-0025-gamemaster-checkpoint-260916-2339-stop-child-generation-after-ask-question-direc.md)
Outcome: retained learning

### Correlated parent-question rendezvous

- **Exact written text:**
  > - Running agents are addressed by a session-unique name. Generic steering trims and flattens multiline text; correlated question answers preserve exact content inside a one-line JSON envelope. Both load into a collision-resistant named tmux buffer through stdin, use application-negotiated bracketed paste, delete the buffer, and submit Enter separately. Message text does not enter a shell command or tmux argv (`pi-extension/subagents/index.ts`, `pi-extension/subagents/tmux.ts`).
  > - A pending `ask_question` answer uses a versioned private JSON envelope over the stdin-backed tmux path and reports delivery only after an exact question-ID acknowledgment. Timeout is explicitly unconfirmed, retains the one-answer guard, and never triggers automatic replay or termination. Other waiting Pi messages still use newer same-child activity confirmation; active Pi and Claude paths report submission because their activity cannot uniquely acknowledge one input (`pi-extension/subagents/question-protocol.ts`, `pi-extension/subagents/index.ts`, `pi-extension/subagents/activity.ts`).
  > - `ask_question` keeps its tool promise pending after atomically writing a strict versioned `.ask` request with a unique ID. The watcher registers that ID and notifies the parent. A protected first-loaded input handler contains malformed, stale, or mismatched private envelopes; for the exact envelope it writes an ID-only acknowledgment, returns `handled` so no duplicate user message is queued, and resolves the tool with the answer. Pi can request the model again only after that tool result, continuing the same run (`pi-extension/subagents/question-protocol.ts`, `pi-extension/subagents/subagent-runtime-control.ts`, `pi-extension/subagents/index.ts`).
- **Destination and classification:** `wiki/architecture.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** The archived R001 plan, 215 deterministic tests, 9 tmux-surface tests, the approved GPT-5.5 lifecycle test, and both independent reviews establish the child/parent protocol and same-run continuation contract.
- **Expected future benefit:** Future messaging or lifecycle changes can preserve exact answer correlation, handled-input containment, and honest acknowledgment semantics instead of reintroducing duplicate child turns or fabricated waiting inference.
- **Why this tier:** This is stable repository architecture with recurring value for subagent messaging work; it is narrower than a repository-wide convention and fully established rather than tentative.
