# 260909-1952-profile-extension-loading - child capability launch

Date: 2026-09-10
Work item: 260909-1952-profile-extension-loading
Status: partial
In one line: Completed and independently verified slice 02.01, including isolated child extension ordering, dynamic capability activation, and fail-closed nesting inheritance.

## Goal

Resume the recorded 02.01 implementation after the approved activation-order correction, resolve remaining focused-review blockers, and advance the sliced plan without starting snapshot and resume work.

## How we approached it

The session continued from checkpoint `ee89f3c3cd1c2d0f7091f0cfcdb4bb54d760a25a` and the append-only Attempt 2 handoff. Runtime responsibilities were split between a first-loaded control that owns framework tools and a last-loaded, tool-free activation control that observes profile lifecycle registrations. A neutral protocol module prevents the parent from evaluating the child-only activator.

Independent review then exposed three launch-boundary gaps: profiles could select the package's spawning extension without a nesting grant, parent code imported the activation module for a shared constant, and lifecycle/environment coverage was incomplete. Those were corrected with a reserved spawning slot, neutral protocol data, and real Pi 0.85.1 event tests. A later review found that omitting the nested-agent environment variable allowed a child to inherit its parent's targets. The launcher now always overrides the value, and present-empty parsing means deny all rather than unrestricted. The final focused reviewer covered the complete staged and untracked slice and passed it.

## Key decisions

- **Separate registration precedence from activation timing** - retained runtime and spawning controls before profile extensions, then placed a tool-free activator last because Pi dispatches same-event handlers in extension order.
- **Reserve the spawning extension** - removed it from ordinary profile ordering and accepted it only through non-empty `subagent_agents`, preserving exact nested targets and framework collision precedence.
- **Make empty nesting explicit** - always set the nested-agent environment value for children so a non-spawning child cannot inherit parent permissions.
- **Preserve the slice boundary** - left versioned snapshots and new/legacy resume behavior for Current 02.02.

## What did not work

- **A first-loaded activator alone** - missed built-in overrides registered by later profile handlers in the same lifecycle event; splitting runtime control from trailing activation fixed the ordering conflict.
- **Omitting an empty nested-agent value** - inherited a parent subagent's non-empty restriction and violated the child's declared empty grant; explicit empty deny-all semantics fixed it.
- **Treating the package spawning path like an ordinary profile extension** - bypassed the protected grant slot; canonical reservation and filtering closed that path.

## Current state and where we left off

- Shipped/verified: slice 02.01, isolated new-child launch flags, protected extension ordering, selected built-in activation, startup and dynamic extension tools, override and collision behavior, explicit-deactivation preservation, nesting-path protection, exact environment inheritance handling, and removal of the legacy registration bridge and mappings.
- Pending: Current is 02.02 for versioned capability snapshots, exact new-mode resume, legacy strict resume compatibility, integrated T02 checks, and separate Standards and Spec reviews. T03 documentation and final whole-plan verification remain later.
- Working tree: the completed 02.01 source, tests, and spec evidence are staged at unchanged HEAD `ee89f3c3cd1c2d0f7091f0cfcdb4bb54d760a25a`; no commit or push occurred in this session.

## Source of truth

- `spec/active/260909-1952-profile-extension-loading/plan.md`: authoritative capability lifecycle contract and Decision D16.
- `spec/active/260909-1952-profile-extension-loading/implementation/02-01-child-capability-launch.md`: complete attempts, acceptance evidence, focused review, and handoff.
- `spec/active/260909-1952-profile-extension-loading/implementation/index.md`: Current `02.02`, T02 checkpoint, and slice progress.
- `pi-extension/subagents/index.ts`: launch isolation, protected extension ordering, path preflight, and nested environment construction.
- `pi-extension/subagents/subagent-runtime-control.ts`: first-loaded framework runtime behavior.
- `pi-extension/subagents/subagent-capability-activation.ts`: trailing child-only activation behavior.
- `test/test.ts`: command, nesting, collision, activation, deactivation, and real Pi lifecycle regressions.

## Verification

- Done: focused suite passed 90 tests; full `npm test` passed 195 tests; removed-interface and old-filename searches, spec validation, Markdown checks, and diff checks passed; the independent focused reviewer returned PASS with complete 02.01 coverage and no blocking findings.
- Not verified yet: controlled tmux validation belongs to the 02.02 segment gate. Configured-model lifecycle testing remains approval-gated and was not run.

## Open questions, blockers, next safe action

- Open/blocked: no 02.01 blocker remains. The broader feature remains incomplete until 02.02 and 03.01 pass their gates. A display-only tool-widget freshness issue remains tentative and does not affect capability activation.
- Next safe action: preserve the user-controlled Git checkpoint, then run Implement on exactly Current packet `02.02` without beginning 03.01.

## Dynamic knowledge trail

- `wiki/conventions/agent-profiles.md`: updated convention.
- `wiki/conventions/runtime-safety.md`: updated convention.
- `wiki/observations.md`: added tentative runtime-display observation.
