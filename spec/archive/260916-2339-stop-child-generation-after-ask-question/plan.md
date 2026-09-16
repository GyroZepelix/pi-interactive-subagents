# Plan: Stop child generation after ask_question

Work item: `260916-2339-stop-child-generation-after-ask-question`
Status: Planned
Created: 2026-09-16
Updated: 2026-09-16

Assurance: medium - the change is local and reversible, but it crosses child tool execution, parent watcher state, terminal reply delivery, abort cleanup, and same-run model continuation. It adds no dependency, migration, production action, or profile-schema change.

## Goal

Make `ask_question` genuinely wait for one matching orchestrator reply, return that reply as the tool result, and continue the same child agent run without any model inference while waiting or any duplicate queued answer.

## Context

The reported rambling occurs because an immediately completed tool result normally causes another provider request. The initial `terminate: true` fix suppresses that request only when every result in the tool batch terminates, then resumes from a new user turn.

R001 replaces that workaround with a smaller blocking rendezvous over the existing safe tmux path. Pi 0.85.1 awaits tool promises, emits streaming input to extension handlers before queueing it, and skips queueing when an input handler returns `handled`. Because extension commands are dispatched before input handlers, parent answers require a private non-command envelope rather than bare next-input capture.

The working tree already contains the superseded `terminate: true` implementation, test assertion, and documentation. Implementation must replace those changes, not layer the new behavior on top of them. See `refinements/R001.md` for revision evidence.

## Requirements

- R1: `ask_question` must remain pending until its current question receives one valid matching answer or the active operation is aborted.
- R2: No provider request may occur between publishing the question and consuming its answer, including when the assistant emitted sibling tool calls in the same batch.
- R3: Give each question an unguessable ID. Allow only one pending question per child process, and publish the versioned `.ask` request atomically with that ID, identity, and question text.
- R4: When the parent has registered a pending question, route `subagent_message` through the existing stdin-backed tmux submission path using a private JSON envelope containing the exact ID and answer. The envelope must not begin as an extension command and must preserve multiline answer content as data.
- R5: The protected child input handler must consume a valid current envelope before later profile handlers, return `handled` so Pi does not queue it, acknowledge the matching ID, and resolve the tool with the decoded answer. Private malformed, stale, or mismatched envelopes must not reach model context or resolve a question.
- R6: Preserve exact one-answer acknowledgment semantics. Report delivered only after the matching ID is acknowledged; timeout remains unconfirmed and must not trigger resend, replay, termination, or acceptance of a second answer.
- R7: Clear only matching rendezvous state on success, abort, child interruption, or observed transition out of question waiting. Stale cleanup must not remove a newer question’s state.
- R8: Keep generic running-child messages, finished-session resume, profile discovery, capability isolation, runtime names, and ordinary tmux transport behavior unchanged.
- R9: Update focused tests and current documentation to describe same-run continuation rather than terminating tool batches.

## Out of scope

- Changing Pi core or adding a second answer transport.
- Supporting multiple simultaneous questions from one child.
- Cancelling or rolling back sibling tool calls already emitted in the same assistant response.
- Automatic replay, child termination, or recovery after ambiguous delivery.
- Dependencies, migrations, commits, pushes, production actions, or unrelated orchestration cleanup.

## Design

### Child rendezvous

The child runtime keeps one in-memory pending-question record containing the generated question ID, resolver, and abort cleanup. `ask_question` installs that record before atomically publishing a strict versioned `.ask` payload, records the waiting activity state, and awaits the resolver instead of returning `terminate: true`.

The protected `input` handler runs first. While a question is pending, it recognizes the private answer prefix, strictly parses the JSON envelope, and compares its version and question ID. A matching envelope is consumed with `{ action: "handled" }`, writes an atomic ID-only acknowledgment marker, clears the pending record, and resolves the tool. The tool result contains the orchestrator answer and does not terminate, so Pi performs the normal next inference only after the answer exists. Invalid private envelopes are consumed but do not resolve or enter model context. Ordinary non-envelope input retains current behavior.

The tool’s abort signal removes its listener and only its matching request/ack artifacts, clears the matching pending record, and rejects promptly. The process must not retain unresolved promises or stale listeners after settlement.

### Parent routing

The watcher strictly validates each atomic `.ask` payload, records the pending question ID on that `RunningSubagent`, deletes the one-shot request signal, and sends the existing visible parent notification once.

`subagent_message` observes current child state before routing. If that running Pi child has an unanswered pending question, it rejects a duplicate submission, encodes the answer with the recorded ID, and submits the envelope through `submitText`. It waits for a strict matching acknowledgment marker before reporting delivered. On timeout it reports unconfirmed, retains the no-replay guard, and lets later watcher observations reconcile acknowledgment or a transition out of waiting. Generic messages with no pending question continue through the existing steer path.

Question and acknowledgment parsing, envelope encoding/decoding, matching cleanup, and atomic marker writes should live in the smallest shared helper that avoids duplicate protocol logic. Do not generalize it into a transport framework.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D01 | Root cause | Keep the finding that an ordinary completed tool result triggers the unwanted inference. | The trace and Pi agent loop agree; R001 changes the remedy, not the diagnosis. | Pi 0.85.1 agent-loop source; original report. | A reproduction shows no provider request after an ordinary result. |
| D02 | Wait model | Hold the `ask_question` tool promise until an answer arrives. | Pi cannot request the model again while its current tool batch is unresolved. | Pi 0.85.1 tool execution source; user confirmation. | Pi adds a dedicated suspend/resume primitive. |
| D03 | Answer transport | Reuse tmux and intercept correlated child input. | This avoids a second answer sidecar transport while preserving the hardened live-input path. | Pi input preflight and `handled` semantics; R001 comparison. | Input interception ordering changes. |
| D04 | Correlation | Use a unique ID, private JSON envelope, and ID-only acknowledgment marker. | Bare next-input capture is vulnerable to command dispatch, stale input, and false delivery confirmation. | Extension commands run before input; existing acknowledgment contract. | Pi provides typed correlation-safe extension input. |
| D05 | Concurrency | Permit one pending question per child. | It matches the public contract and singleton request signal without inventing multi-question scheduling. | Existing tool guidance; user confirmation. | Concurrent questions become an explicit requirement. |
| D06 | Verification | Require a focused live model lifecycle check after separate approval. | Unit seams cannot alone prove the real provider, watcher, tmux, interception, and continuation sequence. | Repository verification tiers; user confirmation. | A no-model SDK harness covers the exact runtime path. |

## Work breakdown

- [x] T01: Implement the child-side blocking rendezvous.
  - Depends on: none
  - Scope: Strict request/envelope/ack protocol helpers, one pending child question, input interception, answer tool result, and abort-safe matching cleanup.
  - Expected areas: `pi-extension/subagents/subagent-runtime-control.ts` and, only if useful, one focused protocol helper under `pi-extension/subagents/`.
  - Acceptance: A question publishes once, no provider continuation is possible before an answer, matching input is handled and returned as the tool result, invalid private input is contained, and abort settles without stale state.
  - Verification: Focused deterministic tests in `test/test.ts`.

- [x] T02: Route and acknowledge correlated parent answers.
  - Depends on: T01
  - Scope: Strict `.ask` registration, per-running-child pending state, question-aware `subagent_message` routing, exact acknowledgment, timeout/no-replay guard, reconciliation, and interruption cleanup.
  - Expected areas: `pi-extension/subagents/index.ts` and focused shared protocol code.
  - Acceptance: One answer reaches the exact pending question over `submitText`; delivered requires matching acknowledgment; duplicate, stale, mismatch, timeout, and interruption paths cannot resolve or replay the wrong answer; generic steering and resume are unchanged.
  - Verification: Focused parent-routing and watcher tests in `test/test.ts`, plus the no-model tmux surface suite.

- [x] T03: Prove the real lifecycle and synchronize documentation.
  - Depends on: T01, T02
  - Scope: Extend the existing question fixture/test to answer through `subagent_message`, prove same-run continuation, inspect for no fabricated waiting or duplicate answer turn, and replace superseded documentation.
  - Expected areas: `test/integration/subagent-lifecycle.test.ts`, `test/integration/agents/test-ping.md`, `README.md`, `wiki/architecture.md`, `wiki/log.md`, and this item’s verification record.
  - Acceptance: The approved live test observes question, correlated answer, same-run child continuation, and final child result exactly once. Current docs no longer describe terminating tool-batch behavior.
  - Verification: Focused approved lifecycle command, full model-free suite, package/spec/Markdown/patch checks.

## Acceptance criteria

- A child that calls `ask_question` makes no further provider request before receiving the matching answer.
- The visible parent notification occurs once and preserves the question text.
- Parent answers, including slash-prefixed and multiline text, remain data and do not dispatch commands or become duplicate child user messages.
- The matching answer appears once in the `ask_question` tool result, after which the same agent run continues and may call tools or complete normally.
- A wrong ID, malformed private envelope, duplicate reply, stale marker, timeout, abort, or missing pane cannot answer the wrong question or trigger automatic replay.
- Exact acknowledgment retains current delivered versus unconfirmed semantics.
- Generic running messages, finished Pi resume, and all capability boundaries retain their current behavior.
- Required model-free and approved live verification pass with no new dependency.

## Testing decisions and seams

- Make protocol encode/decode and matching cleanup directly testable without a model or tmux.
- In child tests, hold the returned tool promise, assert it remains unsettled, emit matching and mismatched input events, inspect `handled`, resolve once, and verify abort/listener/artifact cleanup.
- In parent tests, inject tmux submission and marker reads to cover exact acknowledgment, timeout, duplicate suppression, stale IDs, later reconciliation, generic fallback, and interruption cleanup.
- Keep the real tmux suite model-free and verify the opaque envelope survives stdin-backed bracketed paste exactly once without entering argv.
- Extend the focused live test rather than adding a broad new integration suite. Inspect observable continuation and stored session evidence where practical, not only screen wording.

## Verification plan

Required model-free gates:

- `env -u PI_SUBAGENT_ALLOWED npm test`
- `node --test test/integration/tmux-surface.test.ts`
- `npm pack --dry-run --json`
- `uv run spec/scripts/manage-spec-item.py --root . validate --operational`
- `git diff --check`
- Changed Markdown path, relative-link, ASCII/control-character, and fenced-code checks

Required cost-bearing gate, run only after explicit implementation-time approval:

- `node --test --test-concurrency=1 --test-name-pattern='subagent ask_question' test/integration/subagent-lifecycle.test.ts`

If approval is withheld, record the live gate as blocked and do not claim the item complete.

## Risks and blockers

- The parent answer arrives through Pi’s interactive prompt path. The private non-command envelope and first-loaded protected input handler are required to prevent command expansion, profile transforms, and duplicate steering.
- Acknowledgment can time out after actual acceptance. Preserve the existing ambiguous `unconfirmed` result, retain the one-answer guard until later reconciliation, and never resend automatically.
- Sibling tools already emitted in the same assistant message may execute while the question waits. This plan guarantees no new model inference before the answer, not rollback of already-issued tool calls.
- The current uncommitted source/docs implement the superseded design. Implementation must preserve unrelated working-tree changes while replacing those exact edits.

## Progress

- [x] R001 revision planned and confirmed.
- [x] Revised implementation completed.
- [x] Revised verification passed.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read spec/active/260916-2339-stop-child-generation-after-ask-question/plan.md, item.yaml, refinements/R001.md, and applicable repository instructions completely. Implement the smallest coherent medium-assurance change that satisfies the revised requirements and acceptance criteria. Replace the superseded terminate-based working-tree edits without disturbing unrelated changes. Run all required model-free verification, then stop for explicit approval before the cost-bearing lifecycle test. Also stop before dependencies, migrations, destructive operations, external writes, commits, pushes, production actions, or material scope expansion. Record only verified evidence, failures, skipped checks, and residual uncertainty.
```

## Proposed durable knowledge updates

After implementation and verification, update `wiki/architecture.md` to describe the blocking correlated-input rendezvous and update `wiki/log.md` according to its maintenance contract. Do not write future behavior into the wiki before it is verified.
