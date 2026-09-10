# Slice 02.01: Implement isolated child launch and capability activation

Plan: `../plan.md`
Implementation index: `./index.md`
Segment: `T02 - Implement and verify the complete capability lifecycle`

## Outcome

New Pi children launch with default extension discovery and built-ins disabled, load `subagent-runtime-control.ts` and optional spawning control before resolved profile extensions, load tool-free `subagent-capability-activation.ts` last, and preserve the selected built-ins plus all declared extension behavior before each model request.

## Why this slice exists now

T01 must first prove the canonical resolved loadout. This slice establishes and reviews the new launch and child-startup security boundary before 02.02 persists and replays it.

## Relevant context

- Requirements R06-R08: an extension is a complete executable grant; all startup/dynamic tools are available, built-in overrides are allowed, first-declared custom duplicates win, runtime and spawning controls load first, and tool-free activation runs last.
- Requirement R07: new Pi children use `--no-extensions --no-builtin-tools`, omit strict `--tools`, and activate the validated built-in subset before the first model request without suppressing extension tools.
- Requirement R08: `ask_question` is always present; the spawning extension loads only for non-empty `subagent_agents`, `PI_SUBAGENT_ALLOWED` remains pinned, and the activation-only extension is loaded only in subagent processes.
- Requirement R10: remove hardcoded custom-tool mappings, `registerToolExtension`, its process-global bridge, and their public test seam once the new path is active.
- Decisions D03-D05: preserve complete extension grants, built-in override behavior, and first-loaded duplicate custom-tool precedence.
- Decision D15: package extension grants are the sole new-profile mechanism.
- Decision D16: split protected runtime-tool registration from final activation because Pi dispatches same-event handlers in extension load order.
- Segment acceptance contribution: establishes the launch/activation half of the capability lifecycle that 02.02 will snapshot and replay.
- Parent-plan sections to load on conflict or uncertainty: Requirements R06-R08 and R10; Design "Child launch and activation"; Decision Log D03-D05 and D15-D16; T02 acceptance and risks.

## Constraints and non-goals

- Keep `subagent-runtime-control.ts` first. Load the spawning extension only when nesting is granted, before profile extensions, and load `subagent-capability-activation.ts` last.
- The trailing activation extension must register no tools and must be reachable only through explicit child launch/resume arguments, not parent auto-discovery.
- Pass only already-validated built-in names through a private package-owned launch value. Validate again at the child boundary if needed to fail closed.
- Activation must run after profile handlers during `session_start` and later pre-model lifecycle events without disabling extension tools, breaking later dynamic registration, or reactivating an explicitly deactivated previously observed extension tool.
- Do not infer extension tools in the parent or create a per-tool allowlist.
- Preserve model, identity, cwd, task delivery, session modes, auto-exit, activity tracking, and shell escaping.
- Do not complete the new snapshot/resume shape in this slice beyond minimal compile-safe preparation explicitly required by the launch refactor.

## Expected source and test areas

- `pi-extension/subagents/index.ts`
- `pi-extension/subagents/subagent-runtime-control.ts`
- `pi-extension/subagents/subagent-capability-activation.ts`
- `test/test.ts`

These paths are navigation hints. Inspect other relevant source or tests when justified by the bounded outcome.

## Acceptance

- New-mode command construction emits `--no-extensions --no-builtin-tools`, emits no strict `--tools`, and orders runtime control, optional spawning control, canonical profile extension paths, then the activation-only control.
- Child startup activates selected built-ins after profile `session_start` handlers and before the first model request, while leaving undeclared built-ins inactive.
- Startup and dynamically registered profile-extension tools are active before the next model request. An extension can override a built-in even when that built-in is omitted, first-declared custom duplicates win, and explicit deactivation of an already observed extension tool is preserved.
- `ask_question` is always active. Spawning tools and their extension are absent without `subagent_agents` and present only with that grant.
- Runtime and spawning control tools retain precedence over colliding profile-extension registrations because those controls load first; the trailing activation control registers no tools.
- `registerToolExtension`, `EXTRA_TOOL_EXTENSIONS`, hardcoded custom-tool mappings, the process-global bridge, and `getToolExtensionPath` test export are removed without unresolved references.
- Existing unrelated launch, prompt, name, status, and tool-registration tests remain green.

## Focused checks

- `node --test --test-name-pattern='subagent discovery|subagent runtime control|capability activation|tool registration' test/test.ts`
- `git grep -n -E 'registerToolExtension|EXTRA_TOOL_EXTENSIONS|getToolExtensionPath|subagent-done\.ts' -- pi-extension test README.md docs`
- `git diff --check -- pi-extension/subagents/index.ts pi-extension/subagents/subagent-runtime-control.ts pi-extension/subagents/subagent-capability-activation.ts test/test.ts`

## Focused review

Ask one independent read-only reviewer to inspect the Current slice, its complete diff, applicable repository instructions, correctness, regressions, maintainability, and scoped acceptance. Resolve every blocking finding before completion.

## Attempt log

### Attempt 1 - 2026-09-10T16:38:30+0200

Starting HEAD: `ee89f3c3cd1c2d0f7091f0cfcdb4bb54d760a25a`

Changes:

- Recorded the T02 segment checkpoint at the starting HEAD.
- Reworked `pi-extension/subagents/index.ts` to construct new launches with `--no-extensions --no-builtin-tools`, no strict `--tools`, framework-first explicit extension ordering, a private validated built-in environment value, canonical profile paths, optional spawning control, and pre-pane missing-path refusal.
- Reworked `pi-extension/subagents/subagent-done.ts` to activate selected built-ins plus extension tools at startup and to detect later built-in-to-extension source transitions.
- Removed the legacy runtime registration hook, process-global bridge, hardcoded tool mappings, and public test seam; removed the obsolete documentation reference.
- Added focused command, activation, collision, dynamic registration, deactivation, missing-path, and nesting tests, including a real Pi 0.85.1 SDK runtime fixture.

Checks:

- `node --test --test-name-pattern='subagent discovery|subagent-done.ts|tool registration' test/test.ts`: PASS, 87 tests after the latest test correction.
- `npm test`: PASS, 192 tests after the dynamic-override behavior correction and before the final deactivation assertion was added.
- Removed-interface grep: PASS, no matches.
- Scoped `git diff --check`: PASS.
- Spec validation: PASS.

Failures:

- Initial focused review: BLOCK. Pi does not automatically activate a later dynamic override of an omitted built-in because the registry name already exists. The implementation added source-transition activation and a real Pi SDK regression.
- Second focused review: BLOCK because the regression did not prove that a previously observed extension tool remains inactive after explicit deactivation. The assertion was added and the focused suite passed.
- Final repeated focused review: BLOCK. A profile `before_agent_start` handler runs after the framework-first child-control handler, so an override registered there remains inactive for the immediately following model request. The real Pi 0.85.1 event order makes this impossible to guarantee from a first-loaded handler alone.

Blockers:

- The packet requires all dynamically registered extension tools to be active before the next model call while also requiring the only activation-capable child-control extension to load before every profile extension. Pi runs same-event handlers in extension load order. Guaranteeing the dynamic contract requires a package-owned activation-only extension after profile extensions, which changes the packet's exact launch order and therefore requires an approved plan correction.

Exact next action: Ask whether to amend the canonical plan and unchecked packets narrowly so launch order is child control, optional spawning control, profile extensions, then a package-owned activation control; if approved, update the plan Decision Log and affected unchecked packets before resuming implementation.

### Attempt 2 - 2026-09-10T17:26:37+0200

Starting HEAD: `ee89f3c3cd1c2d0f7091f0cfcdb4bb54d760a25a`

Approved contract correction:

- The user approved Decision D16 and the self-documenting rename on 2026-09-10.
- The canonical plan now requires `subagent-runtime-control.ts` first, optional spawning control second, profile extensions in canonical order, and tool-free `subagent-capability-activation.ts` last.
- The trailing activation extension is child-only and is not a package manifest entry or parent extension. Shared environment data belongs in neutral `subagent-protocol.ts`.
- The corrected plan and affected unchecked packets `02.01` and `02.02` were updated before implementation resumed. Completed T01 packets were not changed.

Current changes:

- `pi-extension/subagents/index.ts`: builds new launch flags and ordered controls/profile paths; removes legacy tool mappings and registration interfaces; preflights resolved files; carries a private built-in selection; reserves this package's spawning `index.ts` behind non-empty `subagent_agents`; filters that reserved path from the profile slot when granted; writes compile-compatible legacy sidecars only until `02.02`.
- `pi-extension/subagents/subagent-runtime-control.ts`: renamed replacement for `subagent-done.ts`, retaining `ask_question`, activity recording, widget, auto-exit, error sidecars, and nested-child waiting. It remains first-loaded so framework tool names win ordinary collisions.
- `pi-extension/subagents/subagent-capability-activation.ts`: new child-only, tool-free trailing extension. It validates the private built-in value, activates selected built-ins plus startup extension tools after profile handlers, detects new extension names and built-in-to-extension source transitions at later lifecycle checkpoints, and does not reactivate an explicitly deactivated previously observed extension tool.
- `pi-extension/subagents/subagent-protocol.ts`: new neutral module containing the private built-in environment key so the parent does not import or evaluate the activation extension.
- `pi-extension/subagents/tmux.ts`: renamed runtime-control reference only.
- `test/test.ts`: command ordering, pre-pane missing path, reserved spawning path, capability environment, malformed private input, startup and same-event dynamic activation, omitted built-in override, unique dynamic activation, first-profile and framework collision precedence, activation-control tool-freedom, and explicit deactivation regressions, including real Pi 0.85.1 SDK/runner fixtures.
- `docs/agent-definitions.md`: removes the retired runtime registration-hook reference; the complete documentation migration remains intentionally deferred to `03.01`.
- `plan.md`, `implementation/index.md`, `02.01`, and affected unchecked `02.02`: record D16, renamed controls, corrected order, evidence, and continuation state.

Checks completed before the latest environment correction:

- Focused suite with the renamed patterns: PASS, 89 tests.
- `npm test`: PASS, 194 tests.
- Removed-interface and old-filename grep: PASS, no matches under `pi-extension`, `test`, `README.md`, or `docs`.
- Spec validation, changed-spec Markdown checks, and `git diff --check`: PASS.

Independent review findings and resolutions:

- Review after the D16 split: BLOCK because a profile could select this package's spawning `index.ts` without `subagent_agents`, the parent imported the child-only activation module for its constant, and tests did not cover the full environment or same-event `session_start`. Resolved by reserving/filtering the spawning path, adding neutral `subagent-protocol.ts`, and adding focused regressions. Focused and full checks then passed.
- Latest focused review: BLOCK because a non-spawning child omitted `PI_SUBAGENT_ALLOWED` and could inherit its parent's non-empty value. The reviewer also noted non-blocking widget freshness; controlled tmux and model-consuming lifecycle tests remain outside this ordinary slice gate or prohibited without approval.

Current unverified correction:

- `pi-extension/subagents/index.ts` now always emits `PI_SUBAGENT_ALLOWED`, using an explicitly empty shell value for a non-spawning child, and `parseSubagentAllowlist` now distinguishes undefined (unrestricted top-level process) from present-empty (empty permitted set).
- This latest source correction has not yet received matching test updates or any test run. Existing environment expectations in `test/test.ts` still need adjustment, and an inherited-parent-value regression must be added.
- After this source correction, spec validation and `git diff --check` pass. No independent focused PASS exists yet.

Working tree at handoff:

- Modified: `docs/agent-definitions.md`, `pi-extension/subagents/index.ts`, `pi-extension/subagents/tmux.ts`, `plan.md`, `implementation/index.md`, `02.01`, `02.02`, and `test/test.ts`.
- Deleted as part of the approved rename: `pi-extension/subagents/subagent-done.ts`.
- Untracked replacements/additions: `pi-extension/subagents/subagent-runtime-control.ts`, `pi-extension/subagents/subagent-capability-activation.ts`, and `pi-extension/subagents/subagent-protocol.ts`.
- No staged changes, commit, push, external write, package/settings modification, or model-consuming lifecycle test occurred.

Blockers:

- Update and add tests for explicit empty `PI_SUBAGENT_ALLOWED` and inherited parent restrictions, rerun all required checks, and obtain a complete independent focused PASS. Until then, `02.01`, T02, and Current must not advance.

Exact next action: Update `test/test.ts` so the non-spawning capability environment expects `PI_SUBAGENT_ALLOWED=''`, add a regression proving present-empty parsing yields an empty restriction set while undefined remains unrestricted, then run the 89-test focused command.

### Completion - 2026-09-10T17:46:45+0200

Starting HEAD: `ee89f3c3cd1c2d0f7091f0cfcdb4bb54d760a25a`

Changed paths:

- `pi-extension/subagents/index.ts`
- `pi-extension/subagents/subagent-runtime-control.ts` (renamed from `subagent-done.ts`)
- `pi-extension/subagents/subagent-capability-activation.ts`
- `pi-extension/subagents/subagent-protocol.ts`
- `pi-extension/subagents/tmux.ts`
- `test/test.ts`
- `docs/agent-definitions.md`
- `spec/active/260909-1952-profile-extension-loading/plan.md`
- `spec/active/260909-1952-profile-extension-loading/implementation/index.md`
- `spec/active/260909-1952-profile-extension-loading/implementation/02-01-child-capability-launch.md`
- `spec/active/260909-1952-profile-extension-loading/implementation/02-02-versioned-resume.md`

Acceptance evidence:

- New-mode construction uses `--no-extensions --no-builtin-tools`, emits no strict `--tools`, and orders runtime control, optional protected spawning control, canonical profile extensions, then tool-free activation control.
- Real Pi 0.85.1 lifecycle fixtures prove selected built-ins, startup tools, `session_start` tools, later unique tools, and omitted-built-in overrides activate at the required lifecycle checkpoint while undeclared built-ins remain inactive and explicit deactivation of an observed extension tool persists.
- Load-order fixtures prove framework `ask_question` and spawning names retain precedence while the first profile extension wins duplicate custom names; the trailing activation extension registers no tools.
- The spawning extension is rejected through a profile slot without `subagent_agents`, filtered and loaded once in the protected slot with a grant, and the child launch always overrides `PI_SUBAGENT_ALLOWED`; a present-empty value parses as a deny-all set while undefined retains top-level unrestricted semantics.
- Resolved extension disappearance fails launch preparation before pane creation. The retired registration hook, global bridge, hardcoded mappings, public test seam, and old runtime-control filename have no remaining runtime, test, or documentation references.
- The activation extension is imported only by explicit child `-e`; its shared environment key moved to neutral `subagent-protocol.ts`, so the parent does not evaluate the child-only module.

Checks:

- `node --test --test-name-pattern='subagent discovery|subagent runtime control|capability activation|tool registration' test/test.ts`: PASS, 90 tests.
- `npm test`: PASS, 195 tests.
- Removed-interface and old-filename grep: PASS, no matches.
- Scoped and full `git diff --check`: PASS.
- `uv run spec/scripts/manage-spec-item.py --root . validate --item 260909-1952-profile-extension-loading`: PASS.
- Changed Markdown fence and ASCII checks: PASS.

Focused review:

- Verdict: PASS.
- Coverage: complete `02.01` checkpoint diff and untracked files, repository/spec instructions, bounded plan and packet acceptance, Pi 0.85.1 lifecycle/tool-registry behavior, environment inheritance, ordering, collisions, activation/deactivation, nesting, paths, rename, tests, and repository compliance.
- Blocking findings: none.
- Non-blocking finding: `subagent-runtime-control.ts` snapshots widget tool names before later profile `session_start` handlers, so display can omit later dynamic names. Runtime capability behavior is unaffected; this display-only improvement is deferred rather than expanding the packet.
- Uncertainty: configured-model lifecycle testing was not run because it requires explicit approval. Controlled tmux validation belongs to the `02.02` T02 segment gate.

Handoff: `02.01` is complete. Advance exactly to `02.02` using the unchanged T02 segment checkpoint `ee89f3c3cd1c2d0f7091f0cfcdb4bb54d760a25a`; do not check off T02 until that segment-final packet passes its integrated checks plus separate Standards and Spec reviews.

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

On success, record the starting HEAD, changed paths, launch/activation acceptance evidence, focused check results, reviewer output and resolutions, and hand off exactly to `02.02`. Update slice checkboxes and Current only in `implementation/index.md`. Do not check off plan task T02 until the 02.02 segment gate passes. Stop for a user-controlled Git checkpoint and suggest Dream; do not commit or invoke Dream automatically.
