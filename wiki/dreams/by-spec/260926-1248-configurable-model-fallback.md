# Dream learnings: 260926-1248-configurable-model-fallback

Work item: `260926-1248-configurable-model-fallback`

> Historical snapshot: this ledger records what Dream retained at each Gamemaster checkpoint. Current source, plans, verification, outcomes, and current dynamic destinations remain authoritative.

<!-- dream-checkpoints:start -->

## Gamemaster checkpoint: 260926-1248-configurable-model-fallback/direct

Date: 2026-09-26
Dream log: [2026-09-26-1458-gamemaster-checkpoint-260926-1248-configurable-model-fallback-direct.md](../2026-09-26-1458-gamemaster-checkpoint-260926-1248-configurable-model-fallback-direct.md)
Outcome: retained learning

### Model-chain module and change-location map

- **Exact written text:**
  > | `pi-extension/subagents/model-chain.ts` | Pure exhaustion classification, bounded attempt provenance, sequential injected controller, and strict atomic chain-sidecar persistence/validation. |
  >
  > - Model-chain classification, sequencing, or chain state: `pi-extension/subagents/model-chain.ts`, profile contracts in `agents.ts`, orchestration/rendering in `index.ts`, registry ownership in `session.ts`, and focused tests in `test/test.ts`.
- **Destination and classification:** `wiki/map.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** The archived implementation introduced a dedicated pure classifier/controller/state module, integrated it across parsing, orchestration, registry ownership, rendering, and 252 model-free regressions, and passed both required review gates.
- **Expected future benefit:** Future chain changes can start at the correct module seam and update the directly coupled parser, orchestrator, registry, and test surfaces without rediscovery.
- **Why this tier:** This is stable repository navigation specific to the model-chain component, narrower than a universal convention and established enough not to remain tentative.

### Sequential chain architecture and logical ownership

- **Exact written text:**
  > 8. A `model-chain` profile prepares every ordered AGY/Pi target before the first pane, persists strict logical ownership, and runs one autonomous target at a time. Each exhausted attempt closes before a fresh target receives the original task and shared role body. Only validated terminal provider evidence can advance; success or another failure stops. No intermediate target transition steers the parent (`pi-extension/subagents/model-chain.ts`, `pi-extension/subagents/index.ts`).
  >
  > - While a chain has no winner, its logical name resolves to a strict package-owned sidecar and cannot resume an exhausted attempt. Success atomically replaces that entry with the native Pi session or AGY snapshot; persistence failure preserves the valid result but reports it as non-resumable. Failed and all-exhausted chains remain explicitly non-resumable. Later winner continuation is native and never starts fallback (`pi-extension/subagents/model-chain.ts`, `pi-extension/subagents/session.ts`, `pi-extension/subagents/index.ts`).
  >
  > - Strict model-chain sidecars contain only controller/profile/runtime identity, current target position, running/exhausted/failed state, and bounded attempt provenance. They are collision and resume-ownership records, not conversation replay or crash-recovery logs (`pi-extension/subagents/model-chain.ts`).
- **Destination and classification:** `wiki/architecture.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** Deterministic controller, registry, resume-refusal, winner-replacement, widget, and presentation tests plus focused and Contract-quality reviews established the sequential lifecycle and ownership contract.
- **Expected future benefit:** Future orchestration and resume work can preserve one-at-a-time execution, avoid exposing failed native state, keep winner continuation native, and avoid promising unsupported crash replay.
- **Why this tier:** This is stable current architecture for one feature family, so it belongs in the architecture page rather than an observation or broad repository convention.

### Ordered model-chain profile contract

- **Exact written text:**
  > ## Ordered model chains
  >
  > `model-chain` is an additive profile form for one read-oriented role with at least two ordered `agy` or `pi` targets. The body, identity, cwd, description, visibility, and read built-ins are shared. Flat target/lifecycle fields are forbidden at the top level; shared built-ins are limited to `read`, `grep`, `find`, and `ls`; skills and nested spawning are invalid. AGY targets own `model` and optional `thinking`; Pi targets may additionally own `extensions`, `session-mode`, and `system-prompt`. Every target field and extension path is validated with an indexed diagnostic before launch (`pi-extension/subagents/agents.ts`, `docs/agent-definitions.md`).
  >
  > A chain rejects runtime model overrides but preserves runtime cwd overrides. One fresh target runs at a time, and only selected terminal exhaustion evidence advances. Pi target extensions keep their complete trusted-grant semantics; read-oriented shared built-ins do not sandbox extension code. Exact scout and flash-reviewer forms live in `docs/agent-definitions.md`.
  >
  > - Every flat or native-resumed Pi child receives `ask_question`; autonomous model-chain attempts omit it to preserve one final parent delivery.
  >
  > - Model identifiers and effort encoding are provider-specific. After replacing a provider extension, rediscover the live registry with `pi --list-models`; do not carry old suffixes forward by analogy. When a provider collapses effort variants, use its canonical model ID plus the profile or target-local `thinking` field (`spec/archive/260909-1928-create-global-scout-researcher-and-worker-profiles/verification.md`).
- **Destination and classification:** `wiki/conventions/agent-profiles.md` - `Convention`
- **Session evidence or selection reason:** Strict parser, package-resolution, preparation, runtime-override, listing, and compatibility tests prove the additive field ownership and trusted-extension contract; exact user documentation and examples match it.
- **Expected future benefit:** Future profile edits can reject hidden precedence, preserve read-oriented replay and one final delivery, and avoid mistaking shared built-in restrictions for an extension sandbox.
- **Why this tier:** These are recurring authoring and validation rules for user-managed profiles across the repository, broad enough for the profile convention page and fully established rather than tentative.

### Model-chain classification and resume safety

- **Exact written text:**
  > ## Model-chain safety
  >
  > A chain prepares all shared capabilities, target-local extension paths, lifecycle controls, and required external executables before pane creation. Attempts run sequentially and receive only the original task plus shared role body; output, reasoning, tool transcripts, and provider conversation state never cross attempts. Shared built-ins are read-only, while declared Pi target extensions remain full trusted executable grants (`pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`).
  >
  > Exhaustion classification accepts durable quota/usage/subscription/billing/budget/credit wording plus bare terminal 429 and resource-exhausted variants. It receives only structured terminal provider evidence: the final settled Pi assistant error or a valid AGY terminal `ERROR` envelope's structured error. Never classify formatted diagnostics, stderr-only malformed AGY output, denied actions, cancellation, interruption, or pane loss. Fixed bounded reasons prevent raw payload, task, stderr, or credentials from entering provenance. Bare 429 and resource exhaustion intentionally accept temporary-throttling false positives (`pi-extension/subagents/model-chain.ts`, `pi-extension/subagents/agy.ts`, `pi-extension/subagents/session.ts`).
  >
  > A running, exhausted, or failed chain uses a separate strict registry tag and package-owned sidecar. No losing native session or snapshot is addressable through the logical name. A successful target atomically replaces chain ownership with that exact native entry; if replacement fails, the result remains deliverable with an explicit non-resumable warning. Winner continuation is native and never falls back (`pi-extension/subagents/model-chain.ts`, `pi-extension/subagents/session.ts`, `pi-extension/subagents/index.ts`).
  >
  > Name registries, model-chain sidecars, AGY resume snapshots, and activity snapshots use temp-file rename with strict schema validation. Errors in best-effort metadata writes must not turn into an unrestricted resume; an AGY result may remain delivered but explicitly non-resumable (`pi-extension/subagents/agy.ts`, `pi-extension/subagents/session.ts`, `pi-extension/subagents/activity.ts`).
- **Destination and classification:** `wiki/conventions/runtime-safety.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** Structured Pi and AGY evidence fixtures, classifier near-miss tests, registry corruption correction, failed-chain resume tests, atomic state checks, and both review gates establish this safety boundary.
- **Expected future benefit:** Future provider wording, registry, and continuation changes can avoid false fallback on actionable errors, provenance leakage, resumable losing attempts, and unrestricted recovery after persistence failure.
- **Why this tier:** This is high-impact but feature-specific runtime safety guidance, so it belongs in the focused safety page rather than a broad convention or tentative observation.

### Deterministic chain verification boundary

- **Exact written text:**
  > - `test/test.ts` directly imports production modules and exercises session persistence, validated profile discovery, trust, precedence, canonical identity, fail-closed tools, model-chain parsing/extension resolution/preparation/classification/sequencing/registry ownership, activity/status transitions, tool registration, runtime names, steering acknowledgment and timeout, settled auto-exit event sequences (including retry recovery, final error, abort, and outstanding-work guards), missing-pane recovery, rendering, and tmux helpers.
  >
  > - General stop/interrupt controls, correlation-safe acknowledgment for active Pi or Claude input, cross-provider conversation transfer, chain crash recovery, shell-readiness redesign, broader configuration, further orchestration modularization, and unrelated dead-code cleanup remain deferred. Waiting Pi input has bounded activity-based confirmation, while ambiguous timeout recovery remains explicit and operator-controlled.
- **Destination and classification:** `wiki/development.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** The archived verification records 252 model-free unit tests, 9 controlled tmux tests, package and documentation checks, and intentionally skipped live provider lifecycle evidence.
- **Expected future benefit:** Future contributors can choose deterministic chain checks without overstating live provider behavior and can distinguish covered orchestration from deferred crash recovery and cross-provider transfer.
- **Why this tier:** This is stable repository-specific test-scope guidance for development work, narrower than a general convention and no longer uncertain.
