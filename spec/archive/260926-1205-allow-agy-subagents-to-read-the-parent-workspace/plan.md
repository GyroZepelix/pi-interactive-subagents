# Plan: Allow AGY subagents to read the parent workspace

Work item: `260926-1205-allow-agy-subagents-to-read-the-parent-workspace`
Status: Planned
Created: 2026-09-26
Updated: 2026-09-26

Assurance: medium - the change is local and reversible, but it intentionally expands an external CLI workspace boundary and must preserve strict persisted resume behavior. A mistake could expose an unintended directory or make existing AGY conversations non-resumable.

## Goal

Allow a read-only `cli: agy` child launched from a different target repository to inspect the parent Pi session's repository without global permission configuration. The observable outcome is that AGY receives the resolved parent cwd as one additional workspace when it differs from the child cwd, replays that exact boundary on same-name resume, and reports permission denials directly instead of masking them as an empty successful response.

## Context

- The extension currently changes directory to the resolved child cwd and passes only the generated custom-agent root through `--add-dir`.
- A parent orchestrator can therefore ask a child in one repository to inspect a plan in the parent repository, but AGY classifies that plan as outside its active workspaces. In headless mode the required `read_file` approval cannot be prompted, so AGY soft-denies it and may return exit code 0 with `status: "SUCCESS"`, an empty `response`, and `denied_actions`.
- `ctx.cwd` and the resolved child cwd are both already available at initial launch. Command construction, strict AGY state parsing, replay validation, and result parsing are isolated in `pi-extension/subagents/agy.ts`.
- Official AGY documentation states that workspace file reads are allowed by default, non-workspace reads require permission, and headless approval requests are soft-denied. `--add-dir` is repeatable in the verified local CLI. See [headless mode](https://antigravity.google/docs/cli/headless/) and [permissions](https://www.agy.dev/docs/permissions/).

## Requirements

1. On a new AGY launch, retain the child cwd as the process cwd and the generated agent root as an added workspace.
2. Resolve the parent Pi context cwd and add it as exactly one additional AGY workspace only when it differs from the resolved child cwd. Deduplicate added workspace paths deterministically.
3. Do not infer workspace roots from task text, profile bodies, referenced absolute paths, or model output.
4. Validate every added workspace as an absolute resolved existing directory before pane creation. Fail closed with an actionable error when validation fails.
5. Persist the exact additional workspace list in a new strict AGY resume-state version and replay it unchanged for completed same-name continuation without rereading profiles or current parent context.
6. Continue accepting existing valid version 1 AGY snapshots. They resume with their original boundary and are not silently upgraded or granted the current parent cwd.
7. Keep the AGY native tool allowlist unchanged and never pass `--dangerously-skip-permissions`. Explicit user AGY ask or deny rules remain authoritative.
8. Treat a non-empty AGY `denied_actions` result as a failed run, even if AGY labels the envelope `SUCCESS`, and include bounded action and stderr evidence in the user-visible diagnostic. Preserve existing handling for genuine success, malformed output, terminal errors, cancellation, interruption, and unknown states.
9. Preserve Pi and Claude launch, messaging, status, and resume behavior.
10. Update user documentation and verified durable wiki guidance to describe the child, parent, and generated-agent workspace boundary, exact resume replay, remaining permission overrides, and denied-action diagnostics.

## Out of scope

- Adding profile fields or tool parameters for arbitrary extra workspace roots.
- Parsing prompts for paths or automatically exposing every referenced repository.
- Editing `~/.gemini`, AGY settings, authentication, plugins, user profiles, or external dotfiles.
- Passing unrestricted permission bypass or adding write, shell, web, MCP, browser, or nested-agent tools.
- Redesigning AGY active steering, conversation locking, registry storage, Pi sandboxing, or Claude behavior.
- Dependencies, migrations of persisted version 1 snapshots, commits, pushes, publishing, or unrelated cleanup.
- Model-consuming lifecycle tests without separate explicit approval for external calls, time, and quota.

## Assumptions

- The parent Pi context cwd is the intended control repository and is an appropriate bounded read root for its child. Revisit if orchestration must expose a directory that is neither the parent nor child cwd.
- Repeated `--add-dir` values make those directories AGY workspace roots under the documented default permission policy. Explicit user permission rules may still deny access and must be reported rather than bypassed.
- Existing version 1 snapshots did not promise parent-workspace access. Preserving their original command contract is safer than broadening them during resume.

## Design

### Deterministic workspace construction

Keep `agentRoot` as a required command-builder input because it owns the selected generated primary agent. Add a separate ordered `additionalWorkspaceRoots` input. The command builder emits the agent root first, then each validated deduplicated additional root as another `--add-dir` argument, all through existing shell escaping.

At initial launch, compare `resolve(ctx.cwd)` with the already resolved child cwd. Store `[]` when they match and `[resolvedParentCwd]` when they differ. Do not add the child cwd redundantly because AGY starts there.

### Strict compatible resume state

Introduce a strict version 2 AGY snapshot that adds `additionalWorkspaceRoots: string[]`. Keep version 1 as a separate exact shape that normalizes to no additional roots for command replay. Validate version 2 roots as unique absolute resolved paths and preflight that they remain directories before initial pane creation and resume.

A successful result updates only `conversationId`, preserving the snapshot version and exact workspace list. Resume builds the AGY command solely from stored state, not the current profile or `ctx.cwd`.

### Actionable permission failures

Extend result parsing to recognize a non-empty `denied_actions` array before accepting `SUCCESS`. Return a bounded diagnostic naming the denied actions and including bounded stderr when available. This makes the actual permission boundary visible and prevents an incomplete review from being reported as a successful answer.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D01 | Read boundary | Automatically expose only the resolved parent cwd when distinct from the child cwd. | Solves parent-plan plus child-repository orchestration without a new public schema or prompt-controlled access expansion. | User confirmation; `ctx.cwd` and child cwd are present in `launchSubagent`. | A concrete workflow requires another deterministic root. |
| D02 | Permissions | Use AGY workspace membership, not global settings or unrestricted bypass. | Keeps the extension portable and preserves the read-only native tool boundary. | AGY headless and permissions documentation; observed `read_file` soft denial. | AGY stops treating repeated added directories as workspaces. |
| D03 | Resume compatibility | Write strict version 2 snapshots and retain exact version 1 parsing and replay without added roots. | New launches need deterministic replay while existing completed conversations must not break or gain access. | Current strict version 1 state and immutable replay contract. | A separately approved snapshot migration is required. |
| D04 | Result semantics | Any reported denied action is a failure with bounded evidence. | A response produced without required evidence is unsafe for review orchestration, and the current generic empty-response message hides the cause. | Captured AGY envelope and stderr; current `parseAgyResult` ordering. | AGY documents a denied-action class that is intentionally non-fatal. |

## Work breakdown

- [x] T01: Add bounded parent-workspace launch and exact resume replay
  - Depends on: none
  - Scope: Extend AGY command inputs, strict snapshot union, launch-time workspace derivation and validation, and resume command replay while preserving version 1 state and all Pi/Claude paths.
  - Expected areas: `pi-extension/subagents/agy.ts`, `pi-extension/subagents/index.ts`, `test/test.ts`
  - Acceptance: New AGY launches add the resolved parent cwd exactly once only when distinct; version 2 snapshots round-trip and replay it; version 1 snapshots remain valid and replay no new root; invalid or missing stored roots fail before pane creation.
  - Verification: Focused AGY command, state, launch, and resume tests, followed by the full unit suite.

- [x] T02: Surface denied actions and publish the corrected workspace contract
  - Depends on: T01
  - Scope: Parse permission denials into actionable bounded failures; update README, agent-definition reference, and source-verified architecture, runtime-safety, and development guidance.
  - Expected areas: `pi-extension/subagents/agy.ts`, `test/test.ts`, `README.md`, `docs/agent-definitions.md`, `wiki/architecture.md`, `wiki/conventions/runtime-safety.md`, `wiki/development.md`, `wiki/log.md`
  - Acceptance: A `SUCCESS` envelope with `denied_actions` fails with action and stderr evidence; documentation no longer claims only the generated workspace is exposed and accurately states permission and resume behavior.
  - Verification: Focused parser tests, documentation link/fence and stale-claim checks, package dry run, full unit suite, and patch integrity checks.

## Acceptance criteria

- With parent cwd `/control` and child cwd `/target`, the generated command starts in `/target` and contains one escaped `--add-dir` for the generated agent root plus one for `/control`.
- When parent and child cwd resolve to the same path, no redundant parent `--add-dir` is emitted.
- No path mentioned only in task text can change the workspace list.
- New strict snapshots persist the exact additional workspace roots; resumed commands use those stored roots even when the current parent context differs.
- Existing valid version 1 snapshots remain readable and resumable without acquiring an additional workspace.
- Missing, malformed, duplicate, relative, non-resolved, or unavailable version 2 workspace roots fail closed before pane creation.
- `denied_actions` produces a clear provider failure containing bounded action and stderr evidence rather than `AGY reported success without a non-empty response`.
- The command never contains `--dangerously-skip-permissions`, and generated agents still expose only the selected read tools.
- Existing AGY success, usage, conversation persistence, interruption, and resume tests pass, together with Pi and Claude regressions.
- README, agent-definition reference, package contents, and durable wiki pages agree with implemented behavior.

## Testing decisions and seams

- Keep path normalization, strict snapshot validation, command assembly, and result parsing testable through existing pure helpers in `agy.ts`.
- Add exact command tests for distinct and identical parent/child cwd, escaping, stable ordering, and deduplication.
- Add strict state fixtures for version 2 round-trip and rejection cases, plus a version 1 compatibility fixture.
- Exercise public launch or resume seams where needed to prove `ctx.cwd` is captured initially and current context is ignored on resume.
- Use captured-shape fixtures for denied `read_file`, including AGY's contradictory `SUCCESS` plus empty response case and bounded stderr.
- Do not claim live cross-workspace model execution from unit or non-model discovery evidence. Record it as unverified unless separately approved and run.

## Verification plan

1. Run focused AGY tests while iterating:
   - `node --test --test-name-pattern='AGY|agy' test/test.ts`
2. Run the complete safe regression suite without an inherited nested-agent filter:
   - `env -u PI_SUBAGENT_ALLOWED npm test`
3. Perform a temporary non-model AGY discovery probe with both the generated agent root and a second added workspace, confirming the generated agent remains selected/discoverable. Remove the temporary directory afterward.
4. Inspect package contents:
   - `npm pack --dry-run --json`
5. Check updated Markdown relative links, fenced-code balance, and stale claims such as `only the generated-agent workspace` or missing parent-workspace replay.
6. Run patch and planning integrity checks:
   - `git diff --check`
   - `uv run spec/scripts/manage-spec-item.py --root . validate --item "260926-1205-allow-agy-subagents-to-read-the-parent-workspace"`
   - `uv run spec/scripts/manage-spec-item.py --root . validate --operational`
7. Conduct one focused medium-assurance review of the workspace capability boundary, strict version compatibility, exact resume replay, permission diagnostics, and Pi/Claude preservation. Resolve blocking findings and rerun affected checks.
8. Only with separate explicit approval, run a live model-consuming cross-workspace read and same-name resume check. Otherwise report those behaviors as externally unverified rather than inferring them from unit tests.

## Risks and blockers

- **Unintended directory exposure:** An incorrect comparison or prompt-derived path could broaden AGY reads. Mitigate by deriving only from resolved `ctx.cwd`, adding it only when distinct, and asserting exact command roots.
- **Resume drift:** Recomputing from current context could silently alter access. Mitigate with a strict version 2 snapshot and snapshot-only replay.
- **Compatibility regression:** Requiring the new field on old snapshots could break registered conversations. Mitigate with an exact versioned union and version 1 regression fixtures.
- **AGY policy drift:** `--add-dir` or permission semantics may change. Keep diagnostics actionable, run the non-model multi-workspace probe, and reserve live model proof for explicit approval.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete.
- [x] Verification complete.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read this plan, its item.yaml, and applicable repository instructions completely.
Implement the smallest coherent change while preserving Requirements, Out of scope, Decision Log, and medium assurance.
Run the risk-proportional Verification plan and record only verified evidence, failures, skipped checks, and residual uncertainty.
Do not infer live AGY behavior from unit tests. Stop for explicit approval before model-consuming tests, dependencies, migrations, destructive actions, external writes, commits, pushes, publishing, or material scope expansion.
```

## Proposed durable knowledge updates

After implementation and verification establish current behavior:

- Update `wiki/architecture.md` with initial parent-workspace capture and snapshot-driven replay.
- Update `wiki/conventions/runtime-safety.md` with the exact child, parent, and generated-agent read boundary and prohibition on prompt-derived roots.
- Update `wiki/development.md` if the non-model multi-workspace probe becomes part of the verified workflow.
- Append `wiki/log.md` only when those durable wiki pages are actually changed.

## Notes

- This item corrects the residual live-read limitation recorded by `spec/archive/260925-1525-add-antigravity-harness-support/outcome.md` without reopening or modifying that archived item.
