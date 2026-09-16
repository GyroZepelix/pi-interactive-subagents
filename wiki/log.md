# Wiki Log

Curated append-only timeline of durable wiki maintenance events. This is not a codebase changelog, commit log, or session transcript.

Use this shape for new entries:

- Heading: `## [YYYY-MM-DD] <kind> | <short title>`.
- Trigger: why the wiki was updated.
- Inputs: source paths, commit ranges, specs, verification, outcomes, URLs, or raw files used as evidence.
- Wiki pages changed: wiki files changed.
- Verification: checks or source verification.
- Notes: gaps, conflicts, stale areas, or exceptions.

## [2026-09-09] install | repo wiki template

- Trigger: user requested installation from `https://git.dgjalic.com/dgjalic/repo-wiki-template`.
- Inputs: protocol version 1 payload from `https://git.dgjalic.com/dgjalic/repo-wiki-template/install/template/`.
- Wiki pages changed: `wiki/AGENTS.md`, `wiki/index.md`, `wiki/log.md`, `wiki/state.md`, `wiki/raw/README.md`.
- Verification: required files and managed regions exist; existing files were preserved or merged; protocol validation result was recorded.
- Notes: installed payload may also create or merge root and spec files; initial codebase ingest is still needed.

## [2026-09-09] ingest | initial codebase ingest

- Trigger: user requested a source-grounded initial wiki seed.
- Inputs: clean working tree at analysis commit `e17580a389d2157629a594c706ccadb972c213ef`; tracked source, agent profiles, manifests, documentation, tests, and repository guidance.
- Completion status: Complete.
- Output pages: `wiki/overview.md`, `wiki/map.md`, `wiki/architecture.md`, `wiki/development.md`, `wiki/conventions/index.md`, `wiki/conventions/agent-profiles.md`, `wiki/conventions/runtime-safety.md`, `wiki/conventions/typescript-modules.md`, `wiki/index.md`, `wiki/log.md`, `wiki/state.md`.
- Verification: all maintained pages indexed; convention pages routed; links and cited paths resolved; ASCII, fences, whitespace, diff, secret-pattern, checkpoint, and write-scope checks passed.
- Notes: no eligible safe project check was available. Package metadata and stale integration interfaces need review; CI, release, lint, format, type-check, and earlier design rationale remain unverified.

## [2026-09-09] update | validated user-managed agent profiles

- Trigger: implementation of `260909-1230-harden-agent-profiles-and-adapt-the-fork` changed durable discovery, sandbox, package, and verification behavior.
- Inputs: `pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`, `package.json`, `package-lock.json`, `docs/agent-definitions.md`, integration fixtures, and the active work-item plan.
- Wiki pages changed: `wiki/index.md`, `wiki/overview.md`, `wiki/map.md`, `wiki/architecture.md`, `wiki/development.md`, `wiki/conventions/index.md`, `wiki/conventions/agent-profiles.md`, `wiki/conventions/runtime-safety.md`, `wiki/log.md`, and `wiki/state.md`.
- Verification: claims were checked against the implementation working tree; `npm test` passed 163 tests and controlled detached tmux sessions passed all 7 surface tests at 90 and 180 columns.
- Notes: package-provided profiles and legacy Pi package namespaces were removed. Model-consuming lifecycle checks remain approval-gated, and no Git checkpoint was advanced from the uncommitted implementation tree.

## [2026-09-09] update | focused profile safety corrections

- Trigger: independent implementation review identified durable edge cases in malformed override identity, generated loadouts, runtime-name persistence, and CLI-specific resume behavior.
- Inputs: `pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`, `docs/agent-definitions.md`, focused regression tests, and the active work-item verification record.
- Wiki pages changed: `wiki/architecture.md`, `wiki/conventions/agent-profiles.md`, `wiki/conventions/runtime-safety.md`, and `wiki/log.md`.
- Verification: source-grounded corrections, 171 passing unit tests, and a green controlled tmux surface suite before repeated independent review.
- Notes: invalid project identities fail closed, generated prompt artifacts use per-launch UUIDs, Pi resume guarantees do not apply to finished Claude children, and model-consuming lifecycle checks remain approval-gated.

## [2026-09-09] dream | completed profile-hardening session

- Trigger: `/dream` run after completing and independently reviewing the user-managed profile and runtime-hardening work item.
- Inputs: current session, `spec/active/260909-1230-harden-agent-profiles-and-adapt-the-fork/plan.md`, its `verification.md`, changed production source and tests, and current dynamic wiki pages.
- Wiki pages changed: `wiki/dreams/2026-09-09-1616-completed-session.md`, `wiki/observations.md`, `wiki/map.md`, `wiki/development.md`, `wiki/index.md`, and `wiki/log.md`.
- Verification: re-read changed files, checked relative links and tier separation, ran memory safety scans, confirmed all changes remain under `wiki/`, and ran `git diff --check`.
- Notes: the model-consuming lifecycle suite remains intentionally unverified; no `MEMORY.md` pointer was needed because existing index routes already cover the dynamic topics.

## [2026-09-10] dream | child capability launch

- Trigger: `/dream` run after completing and independently reviewing profile-extension-loading slice 02.01.
- Inputs: current session, `spec/archive/260909-1952-profile-extension-loading/plan.md`, its 02.01 packet and implementation index, changed runtime source, focused tests, and current profile/runtime wiki pages.
- Wiki pages changed: `wiki/dreams/2026-09-10-1752-completed-session.md`, `wiki/conventions/agent-profiles.md`, `wiki/conventions/runtime-safety.md`, `wiki/observations.md`, `wiki/index.md`, and `wiki/log.md`.
- Verification: claims checked against staged source and spec evidence; focused and full tests had passed; changed files were re-read, links and tier separation checked, memory safety scans run, and `git diff --check` passed.
- Notes: versioned resume and the T02 segment gate remain Current 02.02; model-consuming lifecycle tests remain approval-gated; no `MEMORY.md` pointer was needed because existing index routes cover both convention pages.

## [2026-09-10] dream | versioned resume

- Trigger: `/dream` run after completing profile-extension-loading slice 02.02 and the T02 high-assurance segment gate.
- Inputs: current session, `spec/archive/260909-1952-profile-extension-loading/plan.md`, its 02.02 packet and implementation index, changed snapshot/resume source and tests, review verdicts, and current runtime-safety and observation pages.
- Wiki pages changed: `wiki/dreams/2026-09-10-1843-completed-session.md`, `wiki/conventions/runtime-safety.md`, `wiki/observations.md`, `wiki/index.md`, and `wiki/log.md`.
- Verification: claims checked against source and spec evidence; focused, integrated, full unit, controlled tmux, Standards, and Spec gates had passed; changed wiki files were re-read, links and tier separation checked, memory safety scans run, and `git diff --check` passed.
- Notes: Current is 03.01 for documentation and final whole-plan verification; configured-model lifecycle testing remains approval-gated; no `MEMORY.md` pointer was needed because the existing runtime-safety route covers the durable update.

## [2026-09-10] update | finalized profile extension contract

- Trigger: final documentation slice for `260909-1952-profile-extension-loading` synchronized durable profile guidance with the verified capability-resolution and resume implementation.
- Inputs: implementation range `486f582398eb6a79666e3ec05e868d33546c49eb..8037ba8ad8822f65b7e92db4859c933d07a3b473`, Current 03.01, `pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`, and the completed T01/T02 evidence.
- Wiki pages changed: `wiki/architecture.md`, `wiki/map.md`, `wiki/conventions/agent-profiles.md`, `wiki/conventions/typescript-modules.md`, and `wiki/log.md`.
- Verification: claims were compared with source at HEAD; 198 unit tests, 7 isolated tmux tests, package inspection, removed-interface and stale-wiki searches, Markdown checks, spec validation, diff validation, and final expanded Standards and Spec reviews passed.
- Notes: `wiki/conventions/runtime-safety.md` already describes verified launch, activation, and resume invariants. `wiki/state.md` was unchanged because no ingest, lint, or dedupe checkpoint advanced. Configured-model lifecycle testing remains approval-gated.

## [2026-09-10] dream | final profile-extension verification

- Trigger: `/dream` run after completing Current 03.01 and the whole-plan profile-extension-loading verification gate.
- Inputs: current conversation, `spec/archive/260909-1952-profile-extension-loading/verification.md`, its 03.01 packet, final documentation and wiki diffs, review verdicts, and the failed archive capability check.
- Wiki pages changed: `wiki/dreams/2026-09-10-1958-completed-session.md`, `wiki/development.md`, `wiki/index.md`, and `wiki/log.md`.
- Verification: re-read changed wiki files, checked relative links and tier separation, ran memory safety scans, confirmed wiki-only Dream write scope, and ran `git diff --check`.
- Notes: implementation and whole-plan verification are complete, but the item remains active because the repository helper lacks `archive`; configured-model lifecycle testing remains approval-gated; no `MEMORY.md` pointer was needed because `wiki/development.md` is already routed from the index.

## [2026-09-10] dream | global profiles and provider safety

- Trigger: `/dream` run after completing and archiving the global five-profile configuration and safe Cursor provider migration.
- Inputs: current conversation, `spec/archive/260909-1928-create-global-scout-researcher-and-worker-profiles/{plan,verification,outcome}.md`, installed provider source, `docs/agent-definitions.md`, and current profile/runtime convention pages.
- Wiki pages changed: `wiki/dreams/2026-09-10-2217-completed-session.md`, `wiki/conventions/agent-profiles.md`, `wiki/conventions/runtime-safety.md`, `wiki/index.md`, and `wiki/log.md`.
- Verification: re-read all five changed wiki files; memory safety, relative-link, ASCII, fence, tier-separation, wiki-only write-scope, and diff checks passed.
- Notes: user-specific profile contents and external staged state remain episodic; no observation, `MEMORY.md` pointer, or state checkpoint update qualified.

## [2026-09-11] update | removed obsolete safe-bash guidance

- Trigger: implementation of `260910-2235-repair-agent-profile-drift-and-remove-obsolete-safe-bash` removed an unreachable packaged extension and synchronized current-state guidance.
- Inputs: `pi-extension/subagents/index.ts`, deleted `pi-extension/subagents/tools/safe-bash.ts`, legacy snapshot regressions in `test/test.ts`, package dry-run output, and the active work-item plan.
- Wiki pages changed: `wiki/map.md`, `wiki/architecture.md`, `wiki/conventions/index.md`, `wiki/conventions/runtime-safety.md`, `wiki/conventions/typescript-modules.md`, and `wiki/log.md`.
- Verification: current source and documentation searches found no remaining activation route or stale claim; all 199 model-free unit tests passed; package dry-run excluded the deleted module and repository-only files.
- Notes: archived historical references remain unchanged, `wiki/state.md` was unchanged because no ingest, lint, or dedupe checkpoint advanced, and model-consuming lifecycle tests remain approval-gated.

## [2026-09-14] dream | frozen subagent reply delivery

- Trigger: `/dream` run after Gamemaster reconciliation of the completed and archived direct implementation for `260914-1641-fix-frozen-subagent-reply-delivery`.
- Inputs: current conversation, `spec/archive/260914-1641-fix-frozen-subagent-reply-delivery/{plan,verification,outcome}.md`, changed transport/lifecycle source and tests, review verdicts, and current runtime wiki pages.
- Wiki pages changed: `wiki/dreams/2026-09-14-1744-gamemaster-checkpoint-260914-1641-fix-frozen-subagent-reply-delivery-direct.md`, `wiki/development.md`, `wiki/conventions/index.md`, `wiki/index.md`, and `wiki/log.md`.
- Verification: re-read changed files, checked the checkpoint marker and relative links, ran memory safety scans, confirmed wiki-only Dream write scope, and ran `git diff --check`.
- Notes: existing architecture and runtime-safety pages already held the core transport and recovery guidance; no observation, `MEMORY.md` pointer, or state checkpoint update qualified. The configured-model lifecycle suite remains approval-gated.

## [2026-09-16] update | correlated parent-question rendezvous

- Trigger: fixing `ask_question` children that generated fabricated waiting commentary after successfully asking the parent.
- Inputs: `pi-extension/subagents/question-protocol.ts`, `pi-extension/subagents/subagent-runtime-control.ts`, `pi-extension/subagents/index.ts`, focused tests, Pi 0.85.1 input-handler semantics, and work item `260916-2339-stop-child-generation-after-ask-question`.
- Wiki pages changed: `wiki/architecture.md` and `wiki/log.md`.
- Verification: model-free protocol, runtime, routing, tmux, packaging, spec, Markdown, and patch-integrity checks passed; the separately approved GPT-5.5 lifecycle test and both independent reviews also passed.
- Notes: `wiki/state.md` was unchanged because no ingest, lint, dedupe, or Git checkpoint advanced.
