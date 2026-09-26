---
schema_version: 1
episode_id: "2026-09-26-1458-gamemaster-checkpoint-260926-1248-configurable-model-fallback-direct"
timestamp: "2026-09-26T14:58:13+02:00"
summary: "Added strict ordered AGY/Pi model fallback with bounded exhaustion evidence, native winner resume, one final delivery, and preserved flat-profile behavior."
kind: "gamemaster-checkpoint"
status: "shipped"
work_item: "260926-1248-configurable-model-fallback"
current: "direct"
topics: ["model-chain","fallback","resume"]
---

# Gamemaster checkpoint: 260926-1248-configurable-model-fallback/direct

Date: 2026-09-26
Work item: `260926-1248-configurable-model-fallback`
Status: shipped
In one line: Added strict ordered AGY/Pi model fallback with bounded exhaustion evidence, native winner resume, one final delivery, and preserved flat-profile behavior.

## Goal

Add an opt-in `model-chain` profile contract for read-oriented subagents so one logical runtime can try ordered AGY and Pi targets only after validated terminal exhaustion, while retaining strict capability, registry, result, and resume boundaries.

## How we approached it

The direct medium-assurance implementation extended canonical profile parsing with an ordered target union and reused exact package extension resolution for target-local Pi providers. A pure bounded classifier and injected sequential controller kept provider evidence separate from presentation, forced one settled attempt at a time, and replayed only the original task and shared role body. Strict chain sidecars owned the logical name until a successful target atomically replaced them with the native Pi session or AGY snapshot.

Focused tests covered parsing, target package resolution, preparation, selected and excluded terminal signals, monotonic sequencing, registry compatibility, failed-chain resume refusal, runtime controls, widget state, and result rendering. Documentation, the repository scout example, and durable wiki guidance were synchronized. The initial focused review found three blockers in mixed-signal classification, registry sidecar validation, and Pi provider-error success detection; each was corrected, along with shared abort ownership, before a passing focused retry and final Contract-quality review. After safe checks and explicit approval, the helper archived the item. A concurrent unrelated item transition was user-confirmed and rebaselined; this checkpoint excludes it.

## Key decisions

- **Keep fallback inline and additive** - used `model-chain` on one canonical role while preserving every flat profile path when absent.
- **Advance only on structured exhaustion evidence** - classified final settled Pi provider errors or valid AGY terminal error envelopes, with authentication, model, permission, malformed, denied, interrupted, and cancelled outcomes stopping immediately.
- **Preserve native resume ownership** - kept failed attempts inaccessible through the logical name and replaced chain state only with the successful target's native entry.
- **Retain trusted extension semantics** - limited shared built-ins to reads without pretending target-local Pi extensions are individually sandboxed.
- **Keep live provider evidence gated** - used deterministic model-free coverage without consuming provider quota or claiming live switching and continuation evidence.

## What did not work

- **The first classifier reason assertion used broader precedence** - subscription and quota wording selected the generic quota reason; matching precedence was made deterministic and the full suite passed.
- **The first focused review exposed three safety defects** - mixed authentication/model messages could trigger fallback, registry parsing dereferenced sidecars, and a clean exit with provider evidence could be crowned successful; targeted corrections and regression tests removed all three failure paths.
- **The initial archive outcome overstated the unrelated-work boundary** - item `260926-1351-add-trusted-agy-any-read-profiles` changed concurrently after verification; the user selected preserve-and-rebaseline, and the archived outcome was corrected without altering verification history or that item.

## Current state and where we left off

- Shipped/verified: the item is archived as completed; source, tests, user documentation, repository example, durable wiki guidance, verification, corrected outcome, and archive index agree.
- Pending: all implementation and Dream artifacts remain unstaged and uncommitted for a parent-controlled Git checkpoint. Live provider exhaustion, switching, and native winner continuation remain intentionally unverified.

## Source of truth

- `spec/archive/260926-1248-configurable-model-fallback/plan.md`: canonical requirements, accepted ambiguity, decisions, completed work, and non-goals.
- `spec/archive/260926-1248-configurable-model-fallback/verification.md`: command evidence, requirement coverage, initial review blockers, corrections, retry verdict, and external-test limits.
- `spec/archive/260926-1248-configurable-model-fallback/outcome.md`: completed disposition, concurrent-work rebaseline, and residual risks.
- `pi-extension/subagents/agents.ts`, `pi-extension/subagents/model-chain.ts`, and `pi-extension/subagents/index.ts`: canonical schema, classifier/controller/state, launch orchestration, winner ownership, widget, and final delivery.
- `test/test.ts`: deterministic chain and flat-compatibility regression evidence.

## Verification

- Done: 252 model-free unit tests; 9 controlled tmux surface tests; 20-file package allowlist inspection; Markdown/profile, patch, selected-item, operational spec, and archive checks; Focused retry 1 and final Contract-quality reviews passed.
- Not verified yet: live quota exhaustion, provider switching, authentication/model availability, and native winner continuation were not run without separate model-consuming approval.

## Open questions, blockers, next safe action

- Open/blocked: none within the archived contract.
- Next safe action: inspect the complete unstaged implementation and Dream artifacts, preserve the separately rebaselined `260926-1351` work, and create a parent-controlled Git checkpoint when authorized; approve live provider verification separately only if its cost is desired.

## Dynamic knowledge trail

- `wiki/map.md`: topic-specific dynamic knowledge for model-chain module and change-location seams.
- `wiki/architecture.md`: topic-specific dynamic knowledge for sequential attempts, logical ownership, native winner resume, and sidecar data ownership.
- `wiki/conventions/agent-profiles.md`: convention guidance for chain schema, field ownership, shared read tools, extensions, and runtime overrides.
- `wiki/conventions/runtime-safety.md`: topic-specific dynamic knowledge for evidence classification, replay boundaries, and non-resumable failures.
- `wiki/development.md`: topic-specific dynamic knowledge for deterministic chain coverage and deferred live-provider evidence.
