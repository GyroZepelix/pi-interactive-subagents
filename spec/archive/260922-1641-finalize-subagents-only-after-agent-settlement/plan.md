# Plan: Finalize subagents only after agent settlement

Work item: `260922-1641-finalize-subagents-only-after-agent-settlement`
Status: Planned
Created: 2026-09-22
Updated: 2026-09-22

Assurance: medium - the fix changes stateful child lifecycle and cross-process completion signaling, where premature finalization can kill a valid retry and misreport failure. The change is localized, reversible, and covered by deterministic event-sequence tests plus existing component checks.

## Goal

Finalize an auto-exit Pi subagent only after Pi reports `agent_settled`, so temporary provider errors can retry without creating a premature failure sidecar, disabling activity, shutting down the child, or causing the parent to kill its pane.

## Context

The child runtime currently treats `agent_end` as final. On any latest assistant `stopReason: "error"`, it writes `<session>.exit`, marks activity done, and requests shutdown. Pi 0.85.1 and 0.87.0 both emit `agent_end` before coding-agent decides whether to retry, compact and recover, or continue queued work. The parent polls the sidecar independently and closes the tmux pane when it appears, so a retryable error can be reported as exhausted and the retry can be interrupted.

Pi 0.87.0 documents `agent_settled` as the final notification after automatic retry, compaction recovery, and queued continuation. It retains the extension APIs used here: `agent_end`, `agent_settled`, `ctx.hasPendingMessages()`, and `ctx.shutdown()`.

The repository currently locks development dependencies to Pi 0.85.1 while the active global runtime is 0.87.0. This work aligns the development baseline with the confirmed runtime while preserving the public wildcard peer contract.

## Requirements

- R1: `agent_end` must capture the latest low-level run messages and record a recoverable waiting state, but must not write an exit sidecar, mark activity done, or request shutdown.
- R2: `agent_settled` must be the only agent lifecycle event that finalizes an auto-exit child after rechecking the pending question, running nested-child, and Pi-owned pending-message guards.
- R3: If a failed run is followed by a successful retry or recovery run, finalization must use the successful latest outcome and must not leave or report an error sidecar.
- R4: If the final settled outcome is `stopReason: "error"`, write one error sidecar with the latest error information, mark activity done, and request graceful shutdown. Preserve the session-file fallback when sidecar writing fails.
- R5: Preserve current aborted-run behavior: an aborted final outcome remains open and waiting, with no error sidecar or shutdown request.
- R6: Preserve waiting behavior for non-auto-exit profiles and for auto-exit sessions with a pending question, running nested children, or queued Pi messages. A later run may update the captured outcome and settle again.
- R7: Record terminal activity with `latestEvent: "agent_settled"`; accept that additive event in the existing version 1 activity schema and keep waiting snapshots at `agent_end` recoverable for subsequent retries.
- R8: Update development dependencies and the lockfile to `@earendil-works/pi-coding-agent` 0.87.x, `@earendil-works/pi-tui` 0.87.x, and the TypeBox version used by Pi 0.87.0. Keep peer dependency ranges unchanged.
- R9: Add deterministic regressions for retry-success, exhausted-error, abort, normal completion, and outstanding-work guards, then update current user and durable guidance to describe settled finalization.

## Out of scope

- Adopting core `finishTurn`; product code does not construct a core `Agent` or supply `AgentOptions`.
- Changing Pi core, automatic retry policy, retry counts, backoff, provider classification, or compaction behavior.
- Changing the `.exit` payload, parent watcher protocol, tmux polling interval, result rendering, or pane-cleanup contract.
- Broad redesign of question waiting, nested spawning, steering acknowledgment, resume, status, or orchestration.
- Narrowing wildcard peer dependencies, claiming compatibility for older Pi versions, bumping the package release version, publishing, committing, or pushing.
- Adding dependencies beyond the confirmed Pi 0.87.0 development alignment.

## Design

Keep the latest low-level run messages in child-runtime memory. Every `agent_end` replaces this snapshot and records `agentEndWaiting()`, leaving the activity recorder enabled so a retry's `agent_start`, provider, message, and tool events remain visible.

Add an `agent_settled` handler that evaluates the existing auto-exit predicate against the captured latest messages only after checking `pendingQuestion`, `runningChildrenCount()`, and `ctx.hasPendingMessages()`. If any guard blocks finalization, leave the child waiting. If the final assistant outcome is aborted, preserve the current open-for-inspection behavior. Otherwise, write final error details when applicable, record terminal settled activity, and call `ctx.shutdown()`.

Rename the local predicate and recorder method where needed so their names describe settled finalization rather than implying that `agent_end` is terminal. Add `agent_settled` to activity event validation without changing the snapshot shape or version.

Use a focused test harness around the registered extension handlers and a temporary session/activity path. Drive explicit event sequences rather than attempting to provoke provider failures nondeterministically:

1. error `agent_end` -> retry `agent_start` -> successful `agent_end` -> `agent_settled`;
2. final error `agent_end` -> `agent_settled`;
3. aborted `agent_end` -> `agent_settled`;
4. normal completion with each outstanding-work guard set and later cleared.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D01 | Final boundary | Finalize from `agent_settled`, not `agent_end`. | `agent_end` closes one low-level run, while coding-agent can still retry, recover, or continue; `agent_settled` is the documented final notification. | Pi 0.87.0 extension docs and `AgentSession` lifecycle source; current runtime handler. | Pi changes settled semantics or exposes a stronger final-outcome hook. |
| D02 | Outcome state | Cache the latest `agent_end.messages` and inspect it at settlement. | `agent_settled` carries no messages, and each retry emits a later `agent_end` that naturally replaces an earlier transient error. | Pi 0.87.0 event types and source. | `agent_settled` gains an authoritative final outcome payload. |
| D03 | Waiting guards | Recheck questions, children, and queued messages at settlement. | These existing guards prevent dropped replies and nested results; moving the boundary must not weaken them. | `subagent-runtime-control.ts`; archived reply-delivery and ask-question plans. | Pi guarantees these states cannot coexist with settlement. |
| D04 | Activity | Keep schema version 1 and add `agent_settled` as an accepted terminal event. | The shape is unchanged; the additive event makes terminal status truthful while allowing retry events after `agent_end`. | `activity.ts` schema and recorder. | Activity snapshots become a public versioned interchange requiring strict old-reader compatibility. |
| D05 | Dependency baseline | Align dev dependencies and lockfile with Pi 0.87.0, including matching TypeBox, without narrowing peers. | Local tests currently exercise 0.85.1 despite the confirmed 0.87.0 runtime; peer narrowing would be a separate public compatibility decision. | `package.json`, `package-lock.json`, installed Pi 0.87.0 package metadata. | The upgrade exposes material unrelated incompatibility or a minimum peer version is intentionally published. |
| D06 | Verification | Prove retry ordering deterministically in unit tests; keep live model testing separately approval-gated. | Real providers cannot reliably produce a retryable failure on demand, while event-sequence tests directly cover this extension's responsibility. | Existing test seams and repository verification tiers. | A local fake-provider harness can cover the complete retry path without disproportionate complexity. |

## Work breakdown

- [x] T01: Move child completion from run end to final settlement.
  - Depends on: none
  - Scope: Capture latest run messages at `agent_end`; finalize from `agent_settled`; preserve abort and outstanding-work guards; ensure only final errors create `.exit`.
  - Expected areas: `pi-extension/subagents/subagent-runtime-control.ts`.
  - Acceptance: A transient error cannot create completion artifacts or request shutdown, while normal and exhausted-error outcomes finalize once after settlement.
  - Verification: Focused handler-sequence regressions in `test/test.ts`.

- [x] T02: Keep activity/status truthful across retries and final settlement.
  - Depends on: T01
  - Scope: Add the settled terminal activity event and recorder transition while retaining recoverable waiting at `agent_end`.
  - Expected areas: `pi-extension/subagents/activity.ts`, affected activity/status assertions in `test/test.ts`.
  - Acceptance: Retry activity remains recordable after an error `agent_end`; only final settlement produces phase `done` with `latestEvent: "agent_settled"`.
  - Verification: Activity parsing, transition, and lifecycle tests in `npm test`.

- [x] T03: Align and verify the Pi 0.87.0 development baseline.
  - Depends on: T01, T02
  - Scope: Update confirmed dev dependency versions and regenerate the lockfile; make only directly required compatibility adaptations revealed by the upgrade.
  - Expected areas: `package.json`, `package-lock.json`, and narrowly affected test fixtures if Pi 0.87.0's documented event shapes require them.
  - Acceptance: The installed development graph resolves Pi coding-agent/TUI 0.87.x and matching TypeBox, and the full model-free suite passes without peer-range changes.
  - Verification: `npm ls`, unit suite, tmux surface suite, and package dry run.

- [x] T04: Synchronize lifecycle guidance after verification.
  - Depends on: T01, T02, T03
  - Scope: Clarify that `auto-exit` finalizes after settlement and update the documented Pi target and lifecycle invariant.
  - Expected areas: `docs/agent-definitions.md`, `wiki/architecture.md`, `wiki/conventions/runtime-safety.md`, `wiki/development.md`, and `wiki/log.md` as required by wiki instructions.
  - Acceptance: Current guidance no longer treats `agent_end` as final or names 0.85.1 as the development target.
  - Verification: Relative-link, ASCII/control-character, fenced-code, spec, and patch-integrity checks.

## Acceptance criteria

- A retryable error `agent_end` creates no `.exit` file, does not mark activity done, and does not call `ctx.shutdown()`.
- A later successful retry replaces the transient error outcome and completes cleanly at `agent_settled` without an error sidecar.
- A final exhausted error writes the existing error payload once, marks activity done at `agent_settled`, and requests shutdown once.
- An aborted final run remains waiting and does not create failure completion artifacts.
- Pending questions, running nested children, and Pi-owned queued messages each suppress settled auto-exit until later work completes and settles.
- Non-auto-exit profiles retain their current interactive waiting behavior.
- Activity snapshots accept `agent_settled`, remain version 1, and continue recording retry activity after intermediate `agent_end` events.
- Development dependencies and lockfile resolve the confirmed Pi 0.87.0 baseline; wildcard peers and published package contents remain unchanged.
- Required model-free verification passes. Any approved live lifecycle check is reported separately and is not represented as deterministic retry evidence.

## Testing decisions and seams

- Extend or extract the existing captured-extension harness so tests can invoke `agent_end`, `agent_start`, and `agent_settled` with a controllable context, pending-message value, nested-child count, shutdown spy, session file, and activity file.
- Assert absence as well as presence: no early sidecar, no early done snapshot, no early shutdown, and no stale transient error after recovery.
- Keep helper-level outcome tests, but pair them with handler-sequence tests so the selected lifecycle boundary is covered.
- Test final error-sidecar content through the real temporary file path; keep `interpretExitSidecar` tests unchanged unless a dependency update requires a mechanical adaptation.
- Do not create a flaky live test that depends on a provider returning 429/529. The existing paid lifecycle suite may confirm normal spawn/completion only after explicit approval.

## Verification plan

Required model-free gates:

- `env -u PI_SUBAGENT_ALLOWED npm test`
- `npm ls @earendil-works/pi-coding-agent @earendil-works/pi-tui typebox`
- `node --test test/integration/tmux-surface.test.ts`
- `npm pack --dry-run --json`
- `uv run spec/scripts/manage-spec-item.py --root . validate --operational`
- `git diff --check`
- Changed Markdown relative-link, ASCII/control-character, and fenced-code checks

Approval-gated model-consuming check:

- After explicit implementation-time approval, run the smallest relevant pattern from `test/integration/subagent-lifecycle.test.ts` that proves ordinary auto-exit completion under Pi 0.87.0. Record it as happy-path integration evidence, not proof of retry recovery.

If approval is withheld, record the live check as skipped and retain that bounded uncertainty without blocking the deterministic lifecycle fix.

## Risks and blockers

- A stale cached error could be reported after recovery if later `agent_end` messages do not replace earlier state. Tests must drive and inspect the complete error-to-success sequence.
- Marking done at intermediate `agent_end` disables the recorder permanently. Remove that path entirely rather than trying to re-enable a completed recorder.
- The runtime-control extension loads before profile extensions. Auto-exit continues to own child termination; do not broaden this item into guarantees for profile extensions that intentionally schedule new work from `agent_settled`.
- Updating the dependency lock may expose unrelated 0.86/0.87 drift. Make only narrow adaptations needed by used public APIs; stop for scope confirmation if broader source or behavioral changes are required.
- The parent watcher trusts `.exit` as terminal. Preserve that contract by delaying sidecar creation rather than adding retry awareness to the parent.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete.
- [x] Verification complete.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read spec/active/260922-1641-finalize-subagents-only-after-agent-settlement/plan.md, item.yaml, and applicable repository instructions completely. Implement the smallest coherent medium-assurance change that satisfies the confirmed lifecycle, dependency, documentation, and verification contract. The Pi 0.87.0 development dependency alignment is approved; stop before any additional dependency, migration, destructive action, external write, commit, push, production action, or material scope expansion. Preserve the parent watcher protocol, peer ranges, abort behavior, and outstanding-work guards. Run all required model-free checks, then stop for explicit approval before any model-consuming lifecycle test. Record only verified evidence, failures, skipped checks, and residual uncertainty.
```

## Proposed durable knowledge updates

After implementation and verification, update `wiki/architecture.md` and `wiki/conventions/runtime-safety.md` so final auto-exit is tied to `agent_settled`, update `wiki/development.md` to the verified Pi 0.87.0 baseline, and append the required `wiki/log.md` maintenance entry. Do not update the wiki before behavior and dependency checks pass.
