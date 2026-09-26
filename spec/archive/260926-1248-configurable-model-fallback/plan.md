# Plan: Configurable model fallback

Work item: `260926-1248-configurable-model-fallback`
Status: Planned
Created: 2026-09-26
Updated: 2026-09-26

## Goal

Add an additive, KISS `model-chain` profile contract that lets one read-oriented subagent role try ordered AGY and Pi provider/model targets until one completes, while preserving one logical runtime name, one final parent delivery, native winner resume, and all existing flat-profile behavior.

The motivating observable outcome is that `scout` and `flash-reviewer` can try AGY Gemini 3.8 Flash first, Cursor Gemini 3.8 Flash second, and OpenAI Codex GPT-5.6 Luna third. A valid terminal quota/resource-exhaustion failure advances automatically; success or an unrelated failure stops the chain.

## Assurance

Medium - the change crosses strict profile validation, package extension resolution, AGY and Pi launch paths, terminal error classification, sequential process orchestration, persistent name ownership, native resume, widget state, and final result rendering. Incorrect classification can spend a fallback quota during temporary throttling, and incorrect registry transitions can expose a failed attempt as resumable. The feature remains local, opt-in, read-oriented, reversible, and requires no dependency or data migration.

Review expectations:

- Perform one coherent-boundary review after parser, classifier, orchestration, and registry behavior pass focused tests.
- Perform one final contract-quality review after documentation and all approved safe verification complete.

## Context

- Current profiles select one profile-level `cli`, `model`, `thinking`, capability set, extension set, and lifecycle. `prepareAgentLaunch()`, `launchSubagent()`, and `watchSubagent()` handle one prepared target and emit one final result.
- AGY is an external one-shot JSON process with strict generated-agent and resume state. Cursor models run in a Pi child and require the configured Cursor provider extension. OpenAI Codex is available through Pi's built-in provider registry.
- Pi settles its own transient retry, recovery, compaction, and queued work before an auto-exit child reports a final provider error. AGY supplies a terminal status/error envelope but no typed quota category.
- The installed Cursor provider preserves upstream text and demonstrates that `resource_exhausted` can also mean a transient rate limit. The user nevertheless chose terminal bare 429 and resource-exhausted signals as fallback triggers, accepting false-positive fallback risk.
- Ordinary `extensions` are complete trusted grants. The user chose to retain that meaning for chain targets rather than introduce provider-only extension semantics. The currently inspected Cursor provider registers no Pi tools.
- Confirmed reasoning and external evidence remain in [discovery.md](./discovery.md) and [research/quota-signals.md](./research/quota-signals.md).

## Requirements

1. Add `model-chain` as an optional top-level agent-definition field. When absent, preserve the current flat schema, diagnostics, discovery precedence, package resolution, listing, launch, runtime model override, messaging, and resume behavior.
2. Require `model-chain` to be a YAML array containing at least two target mappings. Every target must contain a supported `cli` and a non-empty `model`; unknown keys, malformed values, nulls, and empty values exclude the complete profile with target-indexed diagnostics.
3. Version 1 chain targets support only `cli: agy` and `cli: pi`; reject Claude targets explicitly.
4. Keep these profile fields shared across all targets: `name`, `description`, `builtin-tools`, `cwd`, Markdown body, and `disable-model-invocation`.
5. For chained profiles, reject top-level `cli`, `model`, `thinking`, `extensions`, `skill` or `skills`, `subagent_agents`, `session-mode`, `system-prompt`, `auto-exit`, and `interactive` rather than choosing hidden precedence or silently ignoring them.
6. Limit chained profile built-ins to `read`, `grep`, `find`, and `ls`; reject write, edit, shell, PowerShell, skills, and nested spawning. This restriction does not weaken the established complete trusted behavior of explicitly selected target extensions.
7. Validate target fields by harness:
   - AGY accepts target-local `cli`, `model`, and `thinking` only.
   - Pi accepts target-local `cli`, `model`, `thinking`, `extensions`, `session-mode`, and `system-prompt`.
   - Reject every incompatible field even when explicitly empty.
8. Resolve each Pi target's extension selectors using the existing exact package-source, trust, project/global precedence, read-only resolution, enabled-resource, canonical path, order, deduplication, and fail-closed diagnostics. Preserve full extension behavior and tool activation for each selected target.
9. Preserve one canonical parsed definition containing the ordered resolved targets. Listing, permission checks, launch preparation, diagnostics, widget state, and result provenance must use that same object without reparsing filenames or mutable profile content.
10. Validate the complete static chain before creating the first pane, including shared capabilities, target field contracts, extension paths, framework controls, and required external executables that can be preflighted. A later runtime authentication, unavailable model, or unrelated launch failure stops with its actionable error and does not count as exhaustion.
11. Reject the existing `subagent` runtime `model` argument when the selected profile declares `model-chain`. Keep runtime `cwd` behavior and flat-profile model overrides unchanged.
12. Treat a fresh chain launch as one logical asynchronous operation and one runtime name. Run exactly one target at a time, force every attempt to settle and auto-exit, close and clean its pane, then either stop or launch the next target.
13. Replay the original task and shared role body into each fresh fallback target. Apply each target's own model, thinking, extension, session, and prompt settings. Do not transfer partial model output, private reasoning, tool transcripts, or provider conversation state between attempts.
14. Advance monotonically within one chain invocation. A new `subagent` invocation starts again at target one; do not persist provider cooldowns or skip earlier targets across fresh runtime names.
15. Add a pure, bounded exhaustion classifier and structured attempt outcome so formatting text is not the classifier input:
   - Match durable quota, usage-limit, subscription, billing, budget, and exhausted-credit wording.
   - Also match terminal bare HTTP 429 and case-insensitive `RESOURCE_EXHAUSTED`, `resource_exhausted`, hyphenated, or spaced equivalents, as explicitly selected by the user.
   - For Pi, classify only the final settled assistant provider error after Pi-owned retries and recovery.
   - For AGY, classify only a valid terminal failure envelope's provider error evidence. Malformed JSON, unknown or waiting status, denied actions, invalid models, permission failures, non-provider stderr, non-zero success contradictions, cancellation, interruption, and pane loss do not qualify merely because diagnostics contain a matching token.
16. Stop immediately on the first successful target. Stop and report the original failure on authentication, configuration, permission, tool, malformed-output, interruption, cancellation, or otherwise unknown terminal errors. If every target qualifies as exhausted, return one aggregate failure.
17. Preserve bounded attempt provenance containing target index/count, harness, model, elapsed time, outcome, and bounded exhaustion reason. Do not leak credentials, unrestricted stderr, task text, or internal provider payloads into provenance.
18. Preserve runtime-name collision and restart safety with a strict tagged chain registry/state entry while no target has won. It must identify the profile/runtime, current target index, terminal running or exhausted state, and bounded attempt provenance without promising automatic crash recovery.
19. Register each attempt's native Pi session or AGY snapshot without exposing an exhausted attempt as the completed runtime's resumable owner. On success, atomically replace the chain registry entry with the existing native winner entry. If persistence fails, deliver a valid result with an explicit non-resumable diagnostic rather than rereading the profile or broadening capabilities.
20. An all-exhausted or otherwise failed chain must remain clearly non-resumable and must not resume the last failed Pi session or AGY snapshot through `subagent_message`.
21. After success, `subagent_message` uses the existing native resume behavior of the winning Pi or AGY target. Automatic chain fallback does not apply to this later continuation. If that continuation exhausts, report the failure to the main agent so it can create a new self-contained subagent task.
22. Keep one running entry and widget row for the logical chain. Show active target index/count, harness, and model while preserving status timing and current activity precision for the active target.
23. Do not send intermediate parent steer messages for target transitions. The single final parent result must identify the winner and prior bounded exhaustion provenance, or list every bounded exhaustion reason when all targets fail.
24. Extend structured result details with chain attempt/winner metadata without changing existing flat Pi, Claude, or AGY result shapes when no chain is configured.
25. Document the schema, field ownership, validation, lifecycle, fallback triggers, accepted 429/resource ambiguity, full extension-grant boundary, result provenance, native winner resume, no resume fallback, and exact scout and flash-reviewer forms.
26. Add focused regression coverage for parsing, extension resolution, preparation, classification, orchestration, registry transitions, resume ownership, widget/rendering, and preservation of flat Pi, Claude, and AGY behavior.

## Out of scope

- Editing global `scout.md`, `flash-reviewer.md`, settings, credentials, authentication, provider packages, or other external dotfiles.
- Mutating chain built-ins, skills, nested spawning, or automatic replay for worker-like roles.
- Claude chain targets.
- Automatic fallback after `subagent_message`, transcript summarization, cross-provider conversation transfer, or replay of partial failed output.
- Proactive quota polling, `/usage` parsing, provider cooldown caches, reset-time scheduling, load balancing, cheapest-model routing, or parallel racing.
- Fallback for authentication, configuration, permission, tool, malformed-output, cancellation, interruption, pane loss, unknown errors, or generic failures without a selected exhaustion signal.
- Automatic recovery of a chain controller after a hard parent-process crash.
- Dependencies, migrations, package metadata changes, CI, lint, formatting, type-check infrastructure, commits, pushes, publishing, or production actions.
- Model-consuming provider exhaustion or lifecycle tests without separate explicit approval.

## Assumptions

- AGY 1.2.11 or a compatible version continues to provide strict headless terminal envelopes and model/effort behavior. Revisit if its output contract changes.
- The configured Cursor provider source and selected resource remain installed when a Cursor target is discovered and launched. Package resolution remains authoritative and fail-closed.
- `cursor/gemini-3.8-flash` and `openai-codex/gpt-5.6-luna` remain discoverable and authenticated in the implementation environment. A missing or unauthenticated target is an actionable non-exhaustion failure, not permission to substitute another model.
- Target extensions remain trusted arbitrary code. The current Cursor provider registers no Pi tools, but the generic chain contract does not enforce provider-only behavior.
- Bare 429 and resource-exhausted matches can represent temporary throttling. This false-positive risk is an accepted user decision, not a guarantee of durable account depletion.
- A hard parent crash may leave an attempt pane or strict non-winning chain state requiring operator recovery. Automatic crash reconciliation is out of scope.

## Design

### Canonical chain profile

Extend the parsed definition with an ordered discriminated target union and resolved per-target extension paths. Keep flat fields and behavior intact for definitions without `model-chain`.

The intended scout form is:

```yaml
---
name: scout
description: Fast read-only codebase reconnaissance with exact paths and evidence
builtin-tools: [read, grep, find, ls]
model-chain:
  - cli: agy
    model: gemini-3.8-flash
    thinking: medium
  - cli: pi
    model: cursor/gemini-3.8-flash
    thinking: medium
    extensions:
      - package: git:github.com/GyroZepelix/pi-cursor-provider
        paths: [index.ts]
    session-mode: standalone
    system-prompt: append
  - cli: pi
    model: openai-codex/gpt-5.6-luna
    thinking: medium
    session-mode: standalone
    system-prompt: append
---

Shared scout Markdown body remains here.
```

`flash-reviewer` uses its own description/body and `thinking: high` on each target.

Refactor extension selector parsing and resolution only enough to reuse the current exact validation for target-indexed fields and per-target paths. Preserve source scope, tombstone behavior, and uncertain project-identity suppression.

### Preparation and orchestration

Prepare a shared immutable role contract plus one prepared launch per target. The chain controller owns logical name, task, parent artifact directory, current target, accumulated bounded provenance, widget metadata, and one final delivery. Individual attempt launch/watch code should remain the harness-specific source of native artifacts and outcomes, but it must no longer unconditionally send a parent result or finalize logical registry ownership.

The controller launches the first attempt, awaits its watcher asynchronously, classifies the structured outcome, and either launches the next attempt or emits one final result. Preserve fire-and-forget tool return behavior. Reuse existing tmux surface creation and cleanup; a fallback attempt is a fresh process and may use a fresh pane under the same logical runtime name.

Chain Pi attempts force the existing auto-exit environment and non-interactive status behavior regardless of flat profile defaults. AGY remains one-shot. No target receives chain-controller metadata in its prompt beyond the existing role/task contract.

### Classification and provenance

Keep classification separate from user-facing formatting. Add structured terminal failure evidence to AGY and Pi attempt results where needed so valid provider errors can be distinguished from malformed output, denied actions, interruption, and launch failures.

Normalize case and separators for resource-exhausted variants and use numeric boundaries for 429. Match durable quota vocabulary explicitly. Bound stored and displayed reasons. Unit-test selected broad triggers and near misses, including unrelated numbers, task text, stderr-only malformed AGY output, authentication errors, invalid models, and permission denials.

### Registry and native resume ownership

Evolve the strict name-registry union with a tagged chain entry that references an atomic package-owned chain sidecar. Preserve existing Pi and AGY entry bytes and parsing. The sidecar records only controller identity, target position, status, and bounded provenance needed for collision-safe, actionable non-resume behavior; it is not a replayable conversation or crash-recovery log.

During attempts, keep native state in its existing Pi session/loadout or AGY snapshot. On success, replace the logical registry entry with that native entry. On exhaustion transition, do not leave the prior native entry addressable by the logical name. On all-exhausted or other failure, retain a strict terminal chain entry so `subagent_message` returns a clear non-resumable diagnostic.

### Status and final delivery

Extend running state with logical chain and active-target metadata. Render one widget row with attempt index/count, harness, and model while delegating activity classification to the current attempt. Final presentation includes bounded provenance and winning target metadata. Flat results and renderers remain byte-compatible where practical and semantically unchanged.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D01 | Configuration | Add ordered inline `model-chain`; preserve flat profiles. | Shares one role contract without duplicate hidden profiles or a global preset surface. | Discovery D01, D05, D07. | Real profiles become materially difficult to maintain. |
| D02 | Target boundary | Version 1 supports AGY and Pi targets with target-local harness fields and shared read built-ins. | Covers scout/reviewer while keeping unsupported fields fail-closed. | Discovery D05-D06, D12. | Mutating or Claude chains are requested. |
| D03 | Exhaustion trigger | Match durable quota vocabulary plus terminal bare 429 and resource-exhausted variants. | User prefers provider switching over strict durable-quota classification. | Discovery D02, D13; quota research. | False-positive fallback becomes costly or disruptive. |
| D04 | Extension semantics | Keep ordinary full trusted `extensions` grants on Pi targets. | Avoids a second extension field and context-dependent semantics. | Discovery D14; current profile contract. | Structural read-only enforcement becomes required. |
| D05 | Replay | Fresh fallback targets receive the original task and shared role body only. | AGY and Pi cannot share native conversation state; read-oriented roles make whole-task replay acceptable. | Discovery D06, D10-D11. | Automatic cross-provider handoff is requested. |
| D06 | Resume | Only the winning native target becomes resumable; later continuation exhaustion returns to the main agent. | Preserves exact native state without lossy transcript transfer. | Discovery D10-D11. | A concrete handoff contract is approved. |
| D07 | Visibility | Show attempt state in the widget and send one final parent result with provenance. | Preserves fire-and-forget orchestration without hiding fallback use. | Discovery D09. | Intermediate operational notifications become necessary. |
| D08 | Execution | Use direct implementation mode. | Parser, orchestration, registry, rendering, tests, and docs are tightly coupled, existing seams are centralized, and no independently executable slice is safer. | Current source and repository test structure; approved To Spec preview. | Implementation evidence shows one coherent session is unsafe. |

## Work breakdown

- [x] T01: Establish the canonical chain profile and prepared-target contract
  - Depends on: none
  - Scope: Add the discriminated `model-chain` schema; enforce shared and target-local field rules; preserve flat parsing; resolve ordered per-target extension paths; prepare complete AGY/Pi targets; reject chained runtime model overrides and invalid lifecycle/capability combinations before pane creation.
  - Expected areas: `pi-extension/subagents/agents.ts`, preparation seams in `pi-extension/subagents/index.ts`, `test/test.ts`
  - Acceptance: Valid scout/reviewer chains resolve canonically with exact ordered target data; malformed, one-target, mixed-field, mutation, nesting, Claude, missing-package, and override cases fail with indexed actionable diagnostics; existing flat fixtures are unchanged.
  - Verification: Focused parser, package resolution, preparation, listing, and compatibility tests, then `env -u PI_SUBAGENT_ALLOWED npm test`.

- [x] T02: Add sequential exhaustion fallback with strict logical ownership
  - Depends on: T01
  - Scope: Add pure exhaustion classification; expose structured AGY/Pi terminal provider evidence; introduce one logical chain controller; force autonomous attempts; run monotonic fresh fallbacks; persist strict chain state; atomically assign native winner resume; keep failed attempts non-resumable; add widget and final-result provenance.
  - Expected areas: `pi-extension/subagents/index.ts`, `pi-extension/subagents/agy.ts`, `pi-extension/subagents/session.ts`, `pi-extension/subagents/status.ts` only if target metadata affects status typing, a focused new helper module under `pi-extension/subagents/` if separation improves testability, `test/test.ts`
  - Acceptance: One attempt runs at a time; selected terminal signals advance; unrelated failures stop; success stops; all-exhausted results aggregate bounded evidence; only the winner resumes; later native-resume exhaustion does not auto-fallback; flat Pi, Claude, and AGY paths retain behavior.
  - Verification: Focused classifier, fake watcher/controller, registry compatibility, resume, interruption, rendering, and public-tool tests, then `env -u PI_SUBAGENT_ALLOWED npm test`.

- [x] T03: Publish the chain contract and examples
  - Depends on: T01, T02
  - Scope: Document the schema, exact fields, examples, lifecycle, triggers, accepted risks, status/result behavior, native winner resume, and non-goals. Update repository examples only where they remain valid package references. Update durable wiki pages only after source and tests establish behavior.
  - Expected areas: `README.md`, `docs/agent-definitions.md`, `agent-examples/scout.md` if migrated as the repository example, relevant `wiki/` pages under `wiki/AGENTS.md`
  - Acceptance: Documentation and examples match implemented parser/runtime behavior, clearly identify broad trigger and extension risks, and do not imply external global profiles were edited.
  - Verification: Markdown relative-link and fenced-code checks, targeted stale-claim searches, profile parsing tests, and `npm pack --dry-run --json`.

- [x] T04: Complete medium-assurance verification and review
  - Depends on: T01, T02, T03
  - Scope: Run all safe gates, inspect package output, run controlled non-model tmux coverage when available, perform one coherent-boundary review and one final contract-quality review, resolve blocking findings, and record skipped model-consuming evidence honestly.
  - Expected areas: No source changes unless verification or review exposes an in-scope defect; later `verification.md` records evidence.
  - Acceptance: Safe checks pass, reviews find no unresolved contract violation, package contents stay constrained, and any live-provider evidence remains explicitly approval-gated.
  - Verification: Commands in the Verification plan plus selected-item and operational spec validation.

## Acceptance criteria

- A valid inline AGY -> Cursor Gemini -> OpenAI Codex Luna profile is discovered as one canonical definition with three ordered, fully resolved targets and shared read built-ins/body.
- A corresponding flash-reviewer chain can use high thinking on every target without duplicating its body or capability list.
- `model-chain` with fewer than two targets, unsupported target fields, Claude, mutation built-ins, skills, nesting, interactive lifecycle fields, invalid extension selectors, or mixed flat target fields excludes the profile with indexed diagnostics.
- Existing flat profiles and their runtime model overrides, package resolution, listing, launch, messaging, status, resume, and result details remain compatible.
- All statically knowable target prerequisites are checked before the first pane. No fallback broadens capabilities, rereads the profile, guesses a provider, or substitutes a model.
- One logical chain launch runs one target at a time, replays only the original task/shared role contract, advances only forward, and sends no intermediate parent result.
- Durable quota wording, terminal 429, and resource-exhausted variants advance the chain. Authentication, invalid model, permission denial, denied actions, malformed AGY JSON, cancellation, interruption, pane loss, and unknown failures stop without fallback.
- A target success stops the chain, becomes the logical name's exact native resume owner, and produces a final result naming the winning target and prior bounded exhaustion evidence.
- If every target exhausts, the final result lists bounded target-specific reasons and the logical name cannot resume a failed native attempt.
- A later `subagent_message` continues only the winner. If that continuation exhausts, the parent receives the failure and no automatic target switch occurs.
- The widget retains one row for the logical name and shows current attempt index/count, harness, model, and active target status without claiming Pi activity precision for AGY.
- README, agent-definition reference, repository example, distributable contents, and verified wiki pages agree with the implementation. No global profile, setting, credential, package source, or dependency is changed.

## Testing decisions and seams

- Keep target parsing and harness-field validation pure enough for direct fixtures with exact indexed diagnostics.
- Reuse the existing package-resolution seam for target-local selectors; test global/project trust, exact source matching, canonical paths, order, deduplication, and complete-profile exclusion.
- Keep exhaustion classification pure and accept structured failure evidence rather than formatted presentation strings. Test case/separator variants, numeric boundaries, broad selected triggers, and unrelated near misses.
- Inject launch, watch, close, registry, and send-message functions around the controller so sequential behavior, no overlap, no intermediate steer, stop conditions, and aggregate results are testable without tmux or models.
- Preserve existing native Pi loadout and AGY snapshot validators. Add exact chain-sidecar and registry-union fixtures without weakening legacy Pi or AGY entries.
- Test public `subagent_message` behavior for chain-running, terminal failed, native winner, and later continuation failure states.
- Exercise widget and final renderers with narrow widths, multiple target indices, bounded reasons, and flat results.
- Do not claim real quota exhaustion, provider switching, or live native resume from unit tests. Live model calls remain a separate explicit approval gate.

## Verification plan

1. Run focused chain parser, classifier, controller, registry, resume, and rendering tests during implementation, then the complete safe suite without inherited nested filtering:
   - `env -u PI_SUBAGENT_ALLOWED npm test`
2. Inspect the distributable and assert that runtime source and user documentation remain included while `spec/`, `wiki/`, tests, repository instructions, and repository-only examples remain excluded:
   - `npm pack --dry-run --json`
3. Run the non-model tmux surface suite in a controlled detached tmux session when available:
   - `node --test test/integration/tmux-surface.test.ts`
   - Record an environmental skip rather than a product failure when controlled tmux is unavailable.
4. Check changed Markdown relative links, fenced-code balance, ASCII/plain-text consistency, and targeted stale claims about one model per profile, AGY never falling back, extension field ownership, runtime model overrides, and resume behavior.
5. Inspect scoped Git status and diffs. Confirm no global profiles, settings, credentials, dependencies, package lock, unrelated source, or external files changed.
6. Run patch and spec integrity checks:
   - `git diff --check`
   - `uv run spec/scripts/manage-spec-item.py --root . validate --item "260926-1248-configurable-model-fallback"`
   - `uv run spec/scripts/manage-spec-item.py --root . validate --operational`
7. After T01 and T02, perform an independent coherent-boundary review focused on schema compatibility, classifier false positives/negatives, one-attempt sequencing, capability replay, registry ownership, and native resume isolation. Resolve blocking findings and rerun affected checks.
8. After all safe checks, perform an independent final contract-quality review against Requirements, Out of scope, Decision Log, acceptance criteria, repository instructions, and the complete diff.
9. Only with separate explicit approval, run model-consuming lifecycle coverage that intentionally exercises available providers. Do not attempt to consume quota merely to force exhaustion. Record provider/model versions, observed error wording, target transitions, result delivery, and resume behavior for any naturally reproducible case.

## Risks and blockers

- **Ambiguous exhaustion codes:** Bare 429 and resource exhaustion can be temporary throttles. The user accepted this risk. Mitigate with terminal-only structured classification, native retries first, bounded provenance, and fixtures that prevent expansion to unrelated errors.
- **Cross-harness replay:** A failed read-oriented attempt may have partial analysis, but it is not transferred. Mitigate by replaying the original task only and excluding mutating built-ins, skills, and nesting.
- **Extension capability breadth:** Pi target extensions are full trusted grants and may register tools or hooks. Preserve existing semantics, document the boundary, and verify the motivating Cursor provider behavior without claiming generic read-only enforcement.
- **Registry ownership:** Per-attempt native state can accidentally become resumable under the logical name. Mitigate with a strict tagged chain entry, atomic winner replacement, exact-union tests, and fail-closed terminal chain state.
- **Lifecycle races:** An attempt may settle while cancellation, pane loss, or parent shutdown converges. Keep one controller-owned watcher/abort path, close each surface idempotently, and never classify interruption as exhaustion.
- **Provider wording drift:** New quota messages may fail to match or broad tokens may appear in new contexts. Keep classifier fixtures source-backed, preserve bounded diagnostics, and revisit only on observed evidence.
- **Model availability drift:** AGY, Cursor, or OpenAI model IDs and effort support can change. Preserve exact configuration and surface provider errors rather than silently substituting.
- **Live evidence cost:** Deterministic checks cannot prove real provider quota behavior. Keep model-consuming verification separately approval-gated and report the limitation.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete.
- [x] Verification complete.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read this plan and its item.yaml completely.
Implement the work step by step while preserving Requirements, Out of scope, Decision Log, and Verification plan.
Update Progress and the Decision Log when confirmed implementation discoveries change the approach.
Run the specified verification before reporting completion.
Stop and ask before dependencies, migrations, destructive operations, external writes, commits, pushes, model-consuming tests, or scope expansion.
```

## Proposed durable knowledge updates

After implementation and verification establish current behavior:

- Update `wiki/map.md` for chain parsing, classification, controller, registry, and rendering seams.
- Update `wiki/architecture.md` for sequential cross-harness attempts, logical runtime ownership, winner resume, and final delivery.
- Update `wiki/conventions/agent-profiles.md` for `model-chain`, shared and target-local fields, full extension grants, and compatibility.
- Update `wiki/conventions/runtime-safety.md` for read-built-in replay, accepted extension boundary, exhaustion classification, and non-resumable failures.
- Update `wiki/development.md` for deterministic chain tests and the separately approval-gated live-provider boundary.
- Follow `wiki/AGENTS.md` for index, log, and state maintenance only as required by actual durable wiki changes.

## Notes

- Execution mode is direct. Do not create `implementation/` projections for this item.
- Expected remaining implementation sessions: one coherent implementation session, plus an optional separately approved live-provider verification session.
- No implementation is authorized by this plan artifact itself.
