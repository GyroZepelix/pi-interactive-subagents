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

## [2026-09-22] update | settled subagent finalization

- Trigger: implementation of `260922-1641-finalize-subagents-only-after-agent-settlement` moved auto-exit from low-level run end to Pi's final settled notification and aligned the development baseline.
- Inputs: `pi-extension/subagents/subagent-runtime-control.ts`, `pi-extension/subagents/activity.ts`, deterministic lifecycle regressions in `test/test.ts`, `package.json`, `package-lock.json`, and the active work-item plan.
- Wiki pages changed: `wiki/overview.md`, `wiki/architecture.md`, `wiki/conventions/runtime-safety.md`, `wiki/development.md`, and `wiki/log.md`.
- Verification: the Pi 0.87.0 dependency graph, all 222 model-free unit tests, 9 tmux surface tests, and package contents passed before the durable guidance update.
- Notes: `agent_end` remains a recoverable waiting boundary; only `agent_settled` records terminal auto-exit activity. `wiki/state.md` was unchanged because no ingest, lint, dedupe, or Git checkpoint advanced. The model-consuming lifecycle check remains separately approval-gated.

## [2026-09-25] update | Antigravity harness contract

- Trigger: implementation of `260925-1525-add-antigravity-harness-support` added a third, read-only external harness with exact completed-conversation continuation.
- Inputs: `pi-extension/subagents/agy.ts`, `pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`, focused tests, and the active plan.
- Wiki pages changed: `wiki/architecture.md`, `wiki/map.md`, `wiki/conventions/agent-profiles.md`, `wiki/conventions/runtime-safety.md`, `wiki/development.md`, and `wiki/log.md`.
- Verification: source claims were compared with the implementation and focused model-free tests; full safe verification and independent reviews are recorded in the work-item verification artifact.
- Notes: no external dotfiles or AGY settings were changed. `wiki/state.md` was unchanged because no ingest, lint, dedupe, or Git checkpoint advanced. Real prompt-free reads and exact live-model resume remain explicitly unverified without separate approval.

## [2026-09-25] retrospective | Antigravity lifecycle workflow

- Trigger: whole-lifecycle Dream retrospective after the successful Gamemaster implementation, archive, Dream checkpoint, and local commit for `260925-1525-add-antigravity-harness-support`.
- Inputs: the archived plan, verification, outcome, per-spec Dream ledger, checkpoint commit `92a772fe49ba84403fb32a7dc37c991549406635`, and current-session Gamemaster handoffs.
- Wiki pages changed: `wiki/dreams/retrospectives/260925-1525-add-antigravity-harness-support.md`, `wiki/observations.md`, and `wiki/log.md`.
- Verification: retrospective identity and lifecycle state matched; memory safety, relative links, append-only structure, catalog separation, wiki-only scope, and `git diff --check` passed.
- Notes: one target-local workflow observation proposes a report-only correction when terminal Implement output omits its required structured handoff. No skill edit is authorized.

## [2026-09-26] update | AGY parent workspace boundary

- Trigger: implementation of `260926-1205-allow-agy-subagents-to-read-the-parent-workspace` added bounded parent-repository reads and actionable permission-denial reporting.
- Inputs: `pi-extension/subagents/agy.ts`, `pi-extension/subagents/index.ts`, focused regressions in `test/test.ts`, user documentation, and the active work-item plan.
- Wiki pages changed: `wiki/architecture.md`, `wiki/conventions/runtime-safety.md`, `wiki/development.md`, and `wiki/log.md`.
- Verification: focused AGY tests, the full model-free unit suite, a temporary non-model repeatable-`--add-dir` discovery probe, documentation checks, package inspection, and patch/spec validation passed.
- Notes: strict version 2 snapshots replay the exact additional workspace list, while valid version 1 snapshots retain their original boundary. Live model cross-workspace reads and exact continuation remain approval-gated and unverified.

## [2026-09-26] update | configurable model fallback

- Trigger: implementation of `260926-1248-configurable-model-fallback` added ordered AGY/Pi fallback for read-oriented profiles.
- Inputs: `pi-extension/subagents/model-chain.ts`, parser/orchestration/registry changes, focused regressions in `test/test.ts`, user documentation, repository scout example, and the active work-item plan.
- Wiki pages changed: `wiki/map.md`, `wiki/architecture.md`, `wiki/conventions/agent-profiles.md`, `wiki/conventions/runtime-safety.md`, `wiki/development.md`, and `wiki/log.md`.
- Verification: source claims were compared with the implementation; deterministic model-free tests cover strict parsing, target extension resolution, preparation, terminal evidence, classifier boundaries, sequential outcomes, registry state, and widget metadata. Full safe verification and independent reviews are recorded in the work-item verification artifact.
- Notes: bare 429 and resource exhaustion intentionally accept temporary-throttling ambiguity. Target extensions remain full trusted grants. Live model exhaustion, switching, and winner continuation remain separately approval-gated and unverified.

## [2026-10-11] update | filtered MCP and codemode profile grants

- Trigger: implementation of `261002-1653-add-mcp-and-codemode-profile-access` established Pi 1.0+ codemode and exact ambient MCP server grants for flat Pi profiles.
- Inputs: `pi-extension/subagents/agents.ts`, `mcp-config.ts`, `index.ts`, `session.ts`, `subagent-mcp-control.ts`, `subagent-capability-activation.ts`, focused unit tests, the non-model MCP lifecycle fixture, and the active work-item plan.
- Wiki pages changed: `wiki/architecture.md`, `wiki/map.md`, `wiki/conventions/agent-profiles.md`, `wiki/conventions/runtime-safety.md`, `wiki/development.md`, and `wiki/log.md`.
- Verification: source claims were compared with the implementation; disposable local process/HTTP fixtures prove selected-versus-ambient loading, exposure/resources/prompt integrity, native failure diagnostics, credential-safe state, and teardown without a model call. Whole-plan checks and independent reviews are recorded in the work-item verification artifact.
- Notes: ambient file filtering does not sandbox declared trusted extensions. Version 2 Pi replay pins exact source/digest while version 1 and legacy snapshots retain their existing paths. Configured-model lifecycle testing remains approval-gated and unverified.

## [2026-10-11] dream | final MCP isolation checkpoint

- Trigger: `/dream` run after archived completion of Gamemaster checkpoint `261002-1653-add-mcp-and-codemode-profile-access/02.02`.
- Inputs: current session, `spec/archive/261002-1653-add-mcp-and-codemode-profile-access/{plan,verification,outcome}.md`, final Current evidence, local MCP fixture, review verdicts, and archive validation.
- Wiki pages changed: `wiki/dreams/2026-10-11-2220-gamemaster-checkpoint-261002-1653-add-mcp-and-codemode-profile-access-02-02.md`, `wiki/dreams/episodes.jsonl`, `wiki/dreams/by-spec/261002-1653-add-mcp-and-codemode-profile-access.md`, `wiki/observations.md`, and `wiki/log.md`.
- Verification: re-read changed files; memory safety, catalog identity/coverage, exact checkpoint marker, ledger-link and prior-section preservation, archive-aware sources, wiki-only scope, relative links, fences, and `git diff --check` passed.
- Notes: retained one tentative Dream-workflow observation about archive-aware checkpoint source references. No additional dynamic MCP guidance qualified because the implementation session had already updated the relevant durable pages. Live configured-model and real external MCP/OAuth behavior remain intentionally unverified.

## [2026-10-24] dream | activity snapshot diagnostic-string boundary

- Trigger: `/dream` run after Gamemaster checkpoint `261024-1918-fix-false-stalled-status-from-invalid-activity-snapshots/direct` (archived completed).
- Inputs: current session, `spec/archive/261024-1918-fix-false-stalled-status-from-invalid-activity-snapshots/{plan,verification,outcome}.md`, `pi-extension/subagents/{activity,status,index}.ts`, regression tests in `test/test.ts`, live Cursor activity-file observations, and the completion review verdict.
- Wiki pages changed: `wiki/conventions/runtime-safety.md`, `wiki/architecture.md`, `wiki/development.md`, `wiki/dreams/2026-10-24-1955-gamemaster-checkpoint-261024-1918-fix-false-stalled-status-from-invalid-activity.md`, `wiki/dreams/episodes.jsonl`, `wiki/dreams/by-spec/261024-1918-fix-false-stalled-status-from-invalid-activity-snapshots.md`, and `wiki/log.md`.
- Verification: re-read changed files; memory safety scan, catalog coverage, exact checkpoint marker uniqueness, ledger link, wiki-only scope, and `git diff --check` passed.
- Notes: live new-code widget behavior and in-child recorder sanitization remain unit-tested only because the live session loads the installed package. The AGY reviewer `read_file` denial was kept episodic only.

## [2026-10-25] update | AGY operator read policy preflight and denial diagnostics

- Trigger: implementation of `261025-0909-enable-read-anywhere-agy-subagents-via-operator-permission-policy` (T01, T02) changed durable AGY launch, resume, and denial behavior.
- Inputs: `pi-extension/subagents/agy.ts`, `pi-extension/subagents/index.ts`, `test/test.ts`, `README.md`, `docs/agent-definitions.md`, and the active work-item plan.
- Wiki pages changed: `wiki/architecture.md`, `wiki/conventions/runtime-safety.md`, and `wiki/log.md`.
- Verification: claims checked against the implementation working tree; focused AGY tests and the full unit suite passed in a clean `PI_SUBAGENT_*` environment.
- Notes: live AGY 1.4.7 behavior under the `read_file(*)` and `write_file(*)` policy is unverified until the approval-gated canary runs.

## [2026-10-25] dream | AGY deny-rule reporting and child test environment

- Trigger: `/dream` run after Gamemaster checkpoint `261025-0909-enable-read-anywhere-agy-subagents-via-operator-permission-policy/direct` (archived completed).
- Inputs: current session, `spec/archive/261025-0909-enable-read-anywhere-agy-subagents-via-operator-permission-policy/{plan,verification,outcome}.md`, `pi-extension/subagents/agy.ts`, live canary evidence, and review verdicts.
- Wiki pages changed: `wiki/conventions/runtime-safety.md`, `wiki/development.md`, `wiki/dreams/2026-10-25-0946-gamemaster-checkpoint-261025-0909-enable-read-anywhere-agy-subagents-via-operato.md`, `wiki/dreams/episodes.jsonl`, `wiki/dreams/by-spec/261025-0909-enable-read-anywhere-agy-subagents-via-operator-permission-policy.md`, and `wiki/log.md`.
- Verification: re-read changed files; memory safety scan, catalog coverage, exact checkpoint marker uniqueness, ledger link, relative links, wiki-only scope, and `git diff --check` passed.
- Notes: the canary procedure and AGY 1.4.7 baseline stayed episodic; secret-path denies remain proven only by mechanism on a harmless path.

## [2026-11-10] update | stale session context after replacement or reload

- Trigger: implementation of `261110-1508-fix-stale-ctx-crash-in-subagent-result-renderer` (T01, T02) fixed a pi crash from stale extension context and changed durable shutdown and delivery behavior.
- Inputs: `wiki/raw/2026-11-10-stale-ctx-crash-in-subagent-result-renderer.md` (untrusted handoff), `pi-extension/subagents/index.ts`, `test/test.ts`, pi 1.5.1 `core/agent-session-runtime.js` and `core/agent-session.js`, and the active work-item plan.
- Wiki pages changed: `wiki/conventions/runtime-safety.md`, `wiki/index.md`, `wiki/state.md`, and `wiki/log.md`.
- Verification: claims checked against the implementation working tree and pi 1.5.1 shutdown-then-invalidate ordering; the full unit suite passed in a clean `PI_SUBAGENT_*` environment.
- Notes: the real-pi manual check of `/reload` with a running subagent was not run; the delivery guard is unit-tested only.

## [2026-11-10] dream | fresh-instance lifecycle tests and renderer test theme

- Trigger: `/dream` run after Gamemaster checkpoint `261110-1508-fix-stale-ctx-crash-in-subagent-result-renderer/direct` (archived completed).
- Inputs: current session, `spec/archive/261110-1508-fix-stale-ctx-crash-in-subagent-result-renderer/{plan,verification,outcome}.md`, `pi-extension/subagents/index.ts`, regression tests in `test/test.ts`, and the completion review verdict.
- Wiki pages changed: `wiki/conventions/typescript-modules.md`, `wiki/dreams/2026-11-10-1527-gamemaster-checkpoint-261110-1508-fix-stale-ctx-crash-in-subagent-result-rendere.md`, `wiki/dreams/episodes.jsonl`, `wiki/dreams/by-spec/261110-1508-fix-stale-ctx-crash-in-subagent-result-renderer.md`, and `wiki/log.md`.
- Verification: re-read changed files; memory safety scan, catalog coverage, exact checkpoint marker uniqueness, ledger link, wiki-only scope, and `git diff --check` passed.
- Notes: the runtime-safety stale-context rule was already written during implementation and was not duplicated. The mistaken placeholder reviewer launch and the skipped manual tmux check stayed episodic only.

## [2026-11-12] update | file-based subagent completion and AGY SSH login

- Trigger: implementation of `261112-1059-detect-subagent-completion-without-screen-scraping-and-fix-agy-ssh-login` after children in narrow tmux panes never reported back and AGY children failed login when tmux had been attached over SSH.
- Inputs: session `17fabee1` artifacts and AGY CLI logs, isolated tmux reproductions, `pi-extension/subagents/{tmux,agy,index}.ts`, `test/test.ts`, `test/integration/tmux-surface.test.ts`, and the active work-item plan.
- Wiki pages changed: `wiki/architecture.md`, `wiki/conventions/runtime-safety.md`, and `wiki/log.md`.
- Verification: unit suite passed; full integration runs passed except one intermittent unrelated failure per run (live model output, operator pane focus), each passing on isolated reruns; a negative control confirmed the narrow-pane test hangs without `capture-pane -J`.
- Notes: AGY `/dev/null` stdin does not shorten its 60-second login wait; no early-kill path was added by user choice.

## [2026-11-12] dream | integration flake triage observation

- Trigger: `/dream` run after Gamemaster checkpoint `261112-1059-detect-subagent-completion-without-screen-scraping-and-fix-agy-ssh-login/direct` (archived completed).
- Inputs: current session, `spec/archive/261112-1059-detect-subagent-completion-without-screen-scraping-and-fix-agy-ssh-login/{plan,verification,outcome}.md`, `pi-extension/subagents/{tmux,agy,index}.ts`, the tests, integration run logs, and the contract-quality review verdict.
- Wiki pages changed: `wiki/observations.md` and `wiki/log.md`. The run's episode is discoverable through `wiki/dreams/episodes.jsonl`.
- Disposition: DISCARD `wiki/observations.md` "Read-only reviewers may still alter the Git index while trying to include untracked files" - aged 13 work items without recurrence; this session's read-only review over untracked files left the index unchanged.
- Verification: re-read changed files, ran the metrics gate against the pre-write snapshot, and ran the memory safety scan.
- Notes: completion-signal and AGY SSH guidance was already written during implementation and was not duplicated.

## [2026-11-12] update | Pi profile defaults and shipped profile skill

- Trigger: implementation of `261112-1435-default-pi-subagents-to-auto-exit-append-and-lineage-only-and-ship-a-profile-ski` after a profile that omitted `auto-exit` left its child waiting in its pane.
- Inputs: `pi-extension/subagents/index.ts`, `test/test.ts`, `test/integration/subagent-lifecycle.test.ts`, `docs/agent-definitions.md`, `README.md`, `package.json`, `skills/subagent-profiles/SKILL.md`, and the active work-item plan.
- Wiki pages changed: `wiki/conventions/agent-profiles.md`, `wiki/development.md`, `wiki/overview.md`, and `wiki/log.md`.
- Verification: unit suite and full integration suite passed (one unrelated screen-scraping flake passed on isolated rerun); package skill discovery confirmed through Pi's package manager.
- Notes: Pi-only omitted-field defaults are now `auto-exit: true`, `system-prompt: append`, and `session-mode: lineage-only`; Claude, AGY, and resume behavior are unchanged.

## [2026-11-12] dream | Pi profile defaults checkpoint

- Trigger: `/dream` run after Gamemaster checkpoint `261112-1435-default-pi-subagents-to-auto-exit-append-and-lineage-only-and-ship-a-profile-ski/direct` (archived completed).
- Inputs: current session, `spec/archive/261112-1435-default-pi-subagents-to-auto-exit-append-and-lineage-only-and-ship-a-profile-ski/{plan,verification,outcome}.md`, `package.json`, `test/integration/agents/test-defaults.md`, integration run logs, and `wiki/observations.md`.
- Wiki pages changed: `wiki/development.md`, `wiki/observations.md`, and `wiki/log.md`. The run's episode is discoverable through `wiki/dreams/episodes.jsonl`.
- Disposition: MOVE `wiki/observations.md` "Full integration runs can fail one unrelated test intermittently" - promoted to `wiki/development.md` after a second independent item needed the isolated rerun.
- Disposition: SUPERSEDE `wiki/development.md` "Integration fixtures define `session-mode`, body and `system-prompt` behavior" - the new `test-defaults` fixture omits those fields.
- Disposition: SUPERSEDE `wiki/development.md` "limits publication to runtime source" - `package.json` `files` now includes `skills/`.
- Verification: re-read changed files, ran the metrics gate against the pre-write snapshot, and ran the memory safety scan.
- Notes: Pi default semantics were written to `wiki/conventions/agent-profiles.md` during implementation and were not duplicated.

## [2026-11-12] update | Pi system-prompt task opt-in

- Trigger: implementation of `261112-1521-add-system-prompt-task-option-for-pi-profiles` added `system-prompt: task`.
- Inputs: `pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`, `test/test.ts`, `docs/agent-definitions.md`, and the active work-item plan.
- Wiki pages changed: `wiki/conventions/agent-profiles.md` and `wiki/log.md`.
- Verification: `npm test` passed 304 tests; claims checked against the implementation working tree.
- Notes: replaces the earlier statement that body-in-task routing was no longer available; omitted `system-prompt` still means `append`.
