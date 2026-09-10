# Slice 01.01: Add the profile capability schema and migration validation

Plan: `../plan.md`
Implementation index: `./index.md`
Segment: `T01 - Implement and verify profile capability resolution`

## Outcome

Profiles parse and normalize the confirmed `builtin-tools` and package-based `extensions` syntax, while malformed grants, legacy `tools`, and unsupported Claude combinations fail with precise diagnostics.

## Why this slice exists now

The asynchronous resolver and runtime must consume a strict, stable parsed representation. Establishing and reviewing syntax and migration behavior first prevents package-resolution code from compensating for ambiguous input.

## Relevant context

- Requirement R01: `builtin-tools` accepts the existing string/list forms, permits only Pi's eight named built-ins, and defaults to no built-ins.
- Requirement R02: `extensions` is an array of mappings with required non-empty `package` and optional non-empty exact `paths`; malformed types, unknown keys, duplicate packages/selectors, absolute paths, and `.` or `..` segments are invalid.
- Requirements R10/R11: legacy profile `tools` receives actionable migration guidance, and `cli: claude` cannot declare either Pi capability field.
- Requirement R12: parsing retains normalized capability values, source scope, effective name, and exact profile path on one canonical object.
- Decisions D01/D11/D13: do not provide a compatibility alias or inherited built-in default.
- Decisions D06/D07/D09: preserve exact package source strings, exact relative selector arrays, and the Claude rejection boundary.
- Segment acceptance contribution: establishes the validated input model consumed by package resolution in 01.02.
- Parent-plan sections to load on conflict or uncertainty: Requirements R01-R02, R10-R12; Design "Parsed and resolved definitions"; Decision Log D01, D06-D07, D09, D11, D13; T01 acceptance.

## Constraints and non-goals

- Preserve effective-name validation, duplicate handling, malformed project-override tombstones, uncertain-identity global suppression, strict unknown-field rejection, body validation, and existing list normalization rules.
- Do not resolve packages, make profile discovery asynchronous, change launch behavior, or alter snapshots in this slice.
- Do not add extension aliases, globs, singular path shorthand, direct filesystem paths, or legacy `tools` compatibility.
- Do not modify user profiles or settings.

## Expected source and test areas

- `pi-extension/subagents/agents.ts`
- `test/test.ts`

These paths are navigation hints. Inspect other relevant source or tests when justified by the bounded outcome.

## Acceptance

- Valid omitted, empty, comma-string, and string-array `builtin-tools` forms normalize deterministically.
- Unknown built-in names and malformed list entries invalidate the complete profile with field-specific diagnostics.
- Valid extension entries retain exact package strings and optional selector order.
- Unknown extension-entry keys, missing/empty package strings, non-array or explicitly empty paths, empty/non-string selectors, duplicate package entries, duplicate selectors, absolute selectors, and selectors containing `.` or `..` path segments invalidate the profile.
- A legacy `tools` field is diagnosed with guidance to use `builtin-tools` for Pi built-ins and `extensions` for extension capabilities, rather than only appearing as a generic unknown key.
- `cli: claude` plus `builtin-tools` or `extensions` is invalid.
- Existing profile name, trust metadata, strict field handling, and project tombstone parser tests remain green.

## Focused checks

- `node --test --test-name-pattern='subagent discovery' test/test.ts`
- `git diff --check -- pi-extension/subagents/agents.ts test/test.ts`

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

## Completion record

### Completed - 2026-09-10T11:19:21+0200

Starting HEAD: `486f582398eb6a79666e3ec05e868d33546c49eb`

Changes:

- `pi-extension/subagents/agents.ts`: replaced the parsed `tools` property with normalized `builtinTools`, added ordered structured extension selectors, strict schema/path validation, actionable legacy migration diagnostics, and the Claude capability boundary.
- `pi-extension/subagents/index.ts`: applied only the compile-safe property rename needed for the existing temporary launch path to consume `builtinTools`; no package resolution or launch redesign was started.
- `test/test.ts`: migrated valid profile fixtures and added coverage for built-in forms, exact extension strings and ordering, malformed mappings, duplicates, POSIX/Windows path rejection, legacy migration, Claude rejection, and preserved tombstone behavior.
- `implementation/index.md`: recorded the implementation/T01 checkpoints and advanced Current after success.

Acceptance evidence:

- Missing, empty-string, empty-array, comma-string, and YAML-array built-in forms normalize deterministically; only the eight approved Pi names are accepted.
- Valid package sources and path selectors retain exact values and order. Invalid entry keys/types, duplicate exact packages/selectors, empty paths, absolute/drive-qualified paths, and dot/parent segments invalidate the profile with indexed field diagnostics.
- Legacy `tools` reports both `builtin-tools` and `extensions` migration guidance. `cli: claude` rejects either Pi capability declaration, including empty declarations.
- Existing name, body, trust/source metadata, duplicate handling, malformed-override tombstones, and uncertain-identity suppression remain covered and green.

Checks:

- `node --test --test-name-pattern='subagent discovery' test/test.ts`: PASS, 46 tests.
- `npm test`: PASS, 177 tests.
- `git diff --check -- pi-extension/subagents/agents.ts pi-extension/subagents/index.ts test/test.ts spec/active/260909-1952-profile-extension-loading/implementation/index.md`: PASS.
- `uv run spec/scripts/manage-spec-item.py --root . validate --item 260909-1952-profile-extension-loading`: PASS.

Focused review:

- Initial review: BLOCK because package and selector strings were trimmed rather than preserved exactly. Resolved by retaining/comparing original strings and trimming only for non-empty validation; added normalization-sensitive coverage.
- Corrective review: BLOCK because Windows drive-relative selectors could bypass package-relative checks. Resolved by rejecting all drive-qualified selectors and adding ordinary, forward-parent, and backslash-parent cases.
- Final independent read-only review: PASS with complete slice coverage, no blocking or non-blocking findings, and no remaining uncertainty.

Exact next slice: `01.02 - Add package resolution and asynchronous canonical discovery`. Do not begin it in this invocation.

## Completion and handoff

On success, record the starting HEAD, changed paths, parser acceptance evidence, focused check results, reviewer output and resolutions, and hand off exactly to `01.02`. Update slice checkboxes and Current only in `implementation/index.md`. Do not check off plan task T01 until the 01.02 segment gate passes. Stop for a user-controlled Git checkpoint and suggest Dream; do not commit or invoke Dream automatically.
