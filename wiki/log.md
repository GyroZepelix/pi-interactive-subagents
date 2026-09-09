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
