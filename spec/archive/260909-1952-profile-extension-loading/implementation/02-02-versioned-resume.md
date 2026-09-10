# Slice 02.02: Add versioned snapshots and safe legacy/new resume

Plan: `../plan.md`
Implementation index: `./index.md`
Segment: `T02 - Implement and verify the complete capability lifecycle`

## Outcome

New capability loadouts round-trip and resume through a strict versioned extension-grant mode, while valid existing strict-tool snapshots remain readable and resume through their unchanged legacy restriction path.

## Why this slice exists now

The persisted schema must encode the verified launch behavior from 02.01. This slice completes T02 by unifying initial launch and resume application without broadening malformed, missing, or legacy capability state.

## Relevant context

- Requirement R09: new sidecars identify version/mode, selected built-ins, and exact ordered absolute extension paths; resume validates paths before pane creation and does not reread profile/package settings.
- Requirement R10: valid current strict `toolAllowlist` snapshots remain resumable through `--tools` and are not automatically rewritten.
- Requirement R08: snapshot state must preserve whether nesting controls and `PI_SUBAGENT_ALLOWED` are restored.
- Requirements R06-R07: replay preserves runtime-control-first, activation-control-last extension order and the same selected built-ins plus complete declared extension grants as initial launch.
- Decisions D10/D14: use current contents at valid stored paths and preserve legacy strict snapshot compatibility.
- Decision D16: new-mode resume loads the tool-free activation control after all snapshotted profile extension paths while retaining runtime and spawning control precedence.
- Security invariant: a missing, malformed, unknown-version, incomplete, or path-invalid snapshot refuses resume before pane creation rather than falling back to defaults.
- Segment acceptance contribution: completes the durable launch/resume capability lifecycle and T02 gate.
- Parent-plan sections to load on conflict or uncertainty: Requirements R06-R10; Design "Child launch and activation" and "Versioned loadouts"; Decision Log D10, D14-D15; T02 acceptance and risks.

## Constraints and non-goals

- Define a strict structural union. Do not ambiguously infer new mode from partially present fields.
- Preserve all existing model, thinking, identity, spawnable, auto-exit, cwd, and agent-directory validations.
- New resume replays snapshot state only. Do not read the current profile or package settings and do not install missing resources.
- Validate every stored extension path and framework requirement before creating a tmux surface.
- Do not hash extension contents or claim immutability. Current code at a valid stored path is intentional.
- Do not rewrite existing legacy sidecars.

## Expected source and test areas

- `pi-extension/subagents/session.ts`
- `pi-extension/subagents/index.ts`
- `pi-extension/subagents/subagent-runtime-control.ts`
- `pi-extension/subagents/subagent-capability-activation.ts`
- `test/test.ts`

These paths are navigation hints. Inspect other relevant source or tests when justified by the bounded outcome.

## Acceptance

- New sidecars contain an explicit supported version/capability mode, selected built-ins, ordered absolute extension paths, and the existing launch state needed for faithful replay.
- The reader rejects unknown fields, unsupported versions/modes, malformed built-ins, duplicate or relative paths, inconsistent nesting state, and incomplete mode-specific fields.
- New-mode launch and resume share one command/capability application path and reproduce runtime-control-first, activation-control-last ordering, selected built-ins, profile extension order, and nested-agent restrictions.
- Resume succeeds independently of changed or deleted profiles and changed package settings when stored paths remain valid.
- Resume uses current installed contents at stored paths and refuses missing/non-file/otherwise invalid paths before pane creation.
- Valid legacy strict snapshots still round-trip and resume with `--no-extensions`, strict `--tools`, and exact legacy extension paths; they are not rewritten.
- Missing or corrupt snapshots and malformed union members remain fail-closed.
- Existing session, registry, resume-concurrency, shell, launch, and lifecycle-independent unit tests remain green.

## Focused checks

- `node --test --test-name-pattern='session.ts|subagent discovery|subagent runtime control|capability activation' test/test.ts`
- `git diff --check -- pi-extension/subagents/session.ts pi-extension/subagents/index.ts pi-extension/subagents/subagent-runtime-control.ts pi-extension/subagents/subagent-capability-activation.ts test/test.ts`

## Focused review

Ask one independent read-only reviewer to inspect the Current slice, its complete diff, applicable repository instructions, correctness, regressions, maintainability, and scoped acceptance. Resolve every blocking finding before completion.

## Segment gate

Run the segment's integrated acceptance and appropriate regression checks, then launch independent read-only Standards and Spec reviewers. Resolve blocking findings before checking off the segment and matching plan task.

- Integrated checks: `node --test --test-name-pattern='session.ts|subagent discovery|subagent runtime control|capability activation|tool registration' test/test.ts`, `npm test`, and in a controlled tmux session `node --test test/integration/tmux-surface.test.ts`
- Segment acceptance: Prove R06-R10, R12, and D16 across initial launch and both snapshot modes, including after-profile activation timing, extension ordering, missing-path refusal, nesting, removed interfaces, and unchanged legacy strict replay. Standards and Spec reviews inspect the complete T02 diff from its recorded segment checkpoint.

## Attempt log

### Attempt 1 - 2026-09-10T18:36:17+0200

Starting HEAD: `9e31c2a2bba19838598dce80e6a9691c0dd01c0e`

Changes:

- Added a strict sidecar union in `pi-extension/subagents/session.ts`: unchanged legacy strict snapshots and version 1 `extension-grants` snapshots with selected built-ins, ordered canonical profile extension paths, explicit spawning state, and existing launch state.
- Updated `pi-extension/subagents/index.ts` so new launch writes the versioned snapshot, launch and resume share one mode-aware command builder, new resume reconstructs the exact built-in/nesting environment without profile or settings reads, and both modes preflight required files before pane creation.
- Added snapshot structure, compatibility, exact replay, current-contents, path, public refusal, nesting, command order, and environment regressions in `test/test.ts`; removed the now-dead strict allowlist construction seam.

Checks:

- Focused slice suite: PASS, 126 tests.
- Integrated T02 pattern: PASS, 133 tests.
- Full `npm test`: PASS, 198 tests.
- Controlled tmux surface suite: PASS, 7 tests.
- Spec validation, removed-interface/old-filename searches, and scoped/full diff checks: PASS.

Failures and resolutions:

- The first focused run after removing the dead strict allowlist builder exposed one stale test reference. The test now asserts the protected spawning sandbox directly.
- A later focused run exposed that macOS temporary paths use the `/var` alias while new replay correctly requires canonical stored paths. The fixture now snapshots `realpathSync(...)`, and a separate symlink regression proves non-canonical aliases fail closed.
- The initial focused reviewer passed the slice before the final canonicalization refinement. Targeted focused re-review retry 1 covered that refinement and passed.

Blockers: none.

Exact next action: Record completion, check off T02, advance Current to `03.01`, and stop for a user-controlled Git checkpoint.

For each interrupted or failed attempt, append without rewriting earlier entries:

```text
### Attempt <number> - <timestamp>
Starting HEAD: <git commit at invocation start>
Changes: <paths and behavior changed>
Checks: <commands and results>
Failures: <failures or none>
Blockers: <blockers or none>
Exact next action: <single resumable action>
```

## Completion and handoff

### Completion - 2026-09-10T18:36:17+0200

Assurance: high - the slice changes security-sensitive persisted capability state and backward-compatible resume, and the packet requires focused plus separate Standards and Spec gates.

Segment starting checkpoint: `ee89f3c3cd1c2d0f7091f0cfcdb4bb54d760a25a`

Current-slice changed paths:

- `pi-extension/subagents/session.ts`
- `pi-extension/subagents/index.ts`
- `test/test.ts`
- `spec/active/260909-1952-profile-extension-loading/implementation/02-02-versioned-resume.md`
- `spec/active/260909-1952-profile-extension-loading/implementation/index.md`
- `spec/active/260909-1952-profile-extension-loading/plan.md`

Acceptance evidence:

- New sidecars use strict `version: 1` and `capabilityMode: extension-grants` fields and preserve selected built-ins, canonical ordered profile paths, explicit spawning state, model, thinking, identity, cwd, and agent directory.
- The reader rejects unknown, mixed, incomplete, malformed, duplicate, relative, non-canonical, and nesting-inconsistent new snapshots. Existing valid strict snapshots still round-trip and read without rewrite.
- Initial launch and new resume call the same snapshot-driven command builder, preserving runtime-control-first, optional spawning control, profile path order, and activation-control-last while omitting strict `--tools` in new mode.
- New resume reconstructs selected built-ins and always overrides nested-agent inheritance from the snapshot. Legacy resume retains strict `--tools`, exact legacy extension paths, and explicit nested deny-all when no targets were stored.
- Resume does not discover profiles or packages, uses current contents at valid stored paths, and refuses missing, non-file, non-canonical, duplicate-canonical, reserved-framework, or unavailable framework paths before pane creation.
- The complete T02 boundary is proven from strict ancestor checkpoint `ee89f3c3cd1c2d0f7091f0cfcdb4bb54d760a25a` through HEAD plus the complete unstaged Current diff.

Checks:

- `node --test --test-name-pattern='session.ts|subagent discovery|subagent runtime control|capability activation' test/test.ts`: PASS, 126 tests.
- `node --test --test-name-pattern='session.ts|subagent discovery|subagent runtime control|capability activation|tool registration' test/test.ts`: PASS, 133 tests.
- `npm test`: PASS, 198 tests.
- `node --test test/integration/tmux-surface.test.ts` in controlled tmux: PASS, 7 tests. The tmux implementation remained unchanged after this run.
- `uv run spec/scripts/manage-spec-item.py --root . validate --item 260909-1952-profile-extension-loading`: PASS.
- Removed-interface and old-filename grep: PASS, no matches.
- Scoped and full `git diff --check`: PASS.

Reviews:

- Focused: PASS with no findings over the complete Current slice. After the final path-canonicalization refinement, targeted re-review retry 1 also passed with no findings.
- Standards: PASS with no blockers. The only non-blocking note was the already-recorded display-only widget freshness issue; capability behavior is unaffected.
- Spec: PASS with no blocking or non-blocking findings across R06-R10, R12, D10, D14-D16, and complete T02 acceptance.

Residual uncertainty:

- Configured-model lifecycle testing was not run because it remains explicitly approval-gated and out of scope. Real Pi 0.85.1 SDK fixtures cover lifecycle activation without model consumption.
- T03 documentation and final whole-plan verification remain pending.

Handoff: `02.02` and T02 are complete. Current advances exactly to `03.01`; do not begin it in this invocation. Preserve a user-controlled Git checkpoint, then run Implement on Current `03.01`.
