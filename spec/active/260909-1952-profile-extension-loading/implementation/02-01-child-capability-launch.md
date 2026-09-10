# Slice 02.01: Implement isolated child launch and capability activation

Plan: `../plan.md`
Implementation index: `./index.md`
Segment: `T02 - Implement and verify the complete capability lifecycle`

## Outcome

New Pi children launch with default extension discovery and built-ins disabled, load framework controls before resolved profile extensions, and activate only the selected built-ins while preserving all declared extension behavior before the first model request.

## Why this slice exists now

T01 must first prove the canonical resolved loadout. This slice establishes and reviews the new launch and child-startup security boundary before 02.02 persists and replays it.

## Relevant context

- Requirements R06-R08: an extension is a complete executable grant; all startup/dynamic tools are available, built-in overrides are allowed, first-declared custom duplicates win, and framework controls load first.
- Requirement R07: new Pi children use `--no-extensions --no-builtin-tools`, omit strict `--tools`, and activate the validated built-in subset before the first model request without suppressing extension tools.
- Requirement R08: `ask_question` is always present; the spawning extension loads only for non-empty `subagent_agents`, and `PI_SUBAGENT_ALLOWED` remains pinned.
- Requirement R10: remove hardcoded custom-tool mappings, `registerToolExtension`, its process-global bridge, and their public test seam once the new path is active.
- Decisions D03-D05: preserve complete extension grants, built-in override behavior, and first-loaded duplicate custom-tool precedence.
- Decision D15: package extension grants are the sole new-profile mechanism.
- Segment acceptance contribution: establishes the launch/activation half of the capability lifecycle that 02.02 will snapshot and replay.
- Parent-plan sections to load on conflict or uncertainty: Requirements R06-R08 and R10; Design "Child launch and activation"; Decision Log D03-D05 and D15; T02 acceptance and risks.

## Constraints and non-goals

- Keep the framework child-control extension first. Load the spawning extension only when nesting is granted, before profile extensions.
- Pass only already-validated built-in names through a private package-owned launch value. Validate again at the child boundary if needed to fail closed.
- Activation must occur during `session_start` before model invocation and must not disable extension tools or break later dynamic registration.
- Do not infer extension tools in the parent or create a per-tool allowlist.
- Preserve model, identity, cwd, task delivery, session modes, auto-exit, activity tracking, and shell escaping.
- Do not complete the new snapshot/resume shape in this slice beyond minimal compile-safe preparation explicitly required by the launch refactor.

## Expected source and test areas

- `pi-extension/subagents/index.ts`
- `pi-extension/subagents/subagent-done.ts`
- `test/test.ts`

These paths are navigation hints. Inspect other relevant source or tests when justified by the bounded outcome.

## Acceptance

- New-mode command construction emits `--no-extensions --no-builtin-tools`, emits no strict `--tools`, and orders child control, optional spawning control, then canonical profile extension paths.
- Child startup activates selected built-ins before the first model request and leaves undeclared built-ins inactive.
- Startup and dynamically registered profile-extension tools are active. An extension can override a built-in even when that built-in is omitted, and first-declared custom duplicates win.
- `ask_question` is always active. Spawning tools and their extension are absent without `subagent_agents` and present only with that grant.
- Framework-control tools retain precedence over colliding profile-extension registrations because controls load first.
- `registerToolExtension`, `EXTRA_TOOL_EXTENSIONS`, hardcoded custom-tool mappings, the process-global bridge, and `getToolExtensionPath` test export are removed without unresolved references.
- Existing unrelated launch, prompt, name, status, and tool-registration tests remain green.

## Focused checks

- `node --test --test-name-pattern='subagent discovery|subagent-done.ts|tool registration' test/test.ts`
- `git grep -n -E 'registerToolExtension|EXTRA_TOOL_EXTENSIONS|getToolExtensionPath' -- pi-extension test README.md docs`
- `git diff --check -- pi-extension/subagents/index.ts pi-extension/subagents/subagent-done.ts test/test.ts`

## Focused review

Ask one independent read-only reviewer to inspect the Current slice, its complete diff, applicable repository instructions, correctness, regressions, maintainability, and scoped acceptance. Resolve every blocking finding before completion.

## Attempt log

No attempts recorded.

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
