# Package lifecycle and failure behavior

Status: Complete
Source date: 2026-09-09
Question: What fail-closed discovery, canonicalization, migration, and resume behavior is supported by the current package and subagent architecture?

## Findings

1. `DefaultPackageManager.resolve(onMissing)` can enumerate configured package resources without installing missing sources when the callback returns `error` or `skip`. The subagent feature should use `skip` so one unrelated missing package does not block every profile, then diagnose a selected package when its configured source produces no resolved resources.
2. Resolved resources carry `enabled`, package `source`, scope, origin, and package `baseDir`. Profile selectors can therefore require an exact configured source, select only `enabled` extension resources, and verify exact package-relative paths.
3. Pi's package manager deduplicates resolved resources by canonical path. The subagent should preserve the selected resource order while deduplicating canonical aliases before launch.
4. A missing exact package source, disabled selected resource, nonexistent selected path, path escaping the package root, or package selection yielding no enabled extensions should invalidate the profile with a file-and-field diagnostic before pane creation.
5. Scope-contained lookup can be implemented with two settings views: global profiles resolve against global settings only; trusted project profiles resolve project packages first and may fall back to global. Untrusted project settings remain excluded.
6. Package resolution is asynchronous, while current agent Markdown parsing and directory discovery are synchronous. Keep syntax parsing synchronous, then add an asynchronous resolution phase for list and spawn entrypoints. This is a contained but cross-cutting refactor because every public discovery caller must use the same resolved canonical definition.
7. The current loadout snapshot stores absolute extension paths and validates their existence on resume. It intentionally does not re-read the profile, so profile deletion or edits do not change an existing child.
8. Package updates can replace code at the same path. Hashing only the entrypoint would not cover imported files or dependencies; a complete immutable package-content lock would be a substantially broader package-integrity feature. Reusing the existing path snapshot is the proportionate behavior.
9. A configured package source change affects new profile resolution. Existing child resumes should remain tied to snapshotted paths and fail only when those paths are missing or structurally invalid, matching the current resume invariant.
10. Replacing current profile `tools` with `builtin-tools` is a deliberate compatibility break. Silently treating old `tools` values as built-ins is unsafe because names that formerly selected extension tools would be dropped or reinterpreted. A targeted migration diagnostic is safer than aliasing.
11. `builtin-tools` should default to an empty list, preserving fail-closed built-in access. Required framework controls remain separately injected: `ask_question` always, and spawning tools only through non-empty `subagent_agents`.
12. The new loadout must snapshot the validated built-in list, resolved absolute extension paths, and an activation-mode/schema marker. Resume should reconstruct `--no-extensions --no-builtin-tools`, reload those exact extensions, and activate the snapshotted built-ins before any model turn.

## Recommended failure contract

- Parse errors or unsupported legacy fields: exclude profile and report the profile file plus field.
- Missing/unconfigured package: exclude profile and name the exact package source and permitted scope.
- Omitted `paths` with zero enabled extensions: exclude profile.
- Selected path absent, disabled, non-extension, absolute, or escaping package root: exclude profile and name the selector.
- Package resolver would need installation or network access: skip resolution without performing it, then invalidate only profiles that selected the unavailable package.
- Missing snapshotted extension on resume: refuse resume.
- Same path with updated extension contents: resume with current installed contents and document that extension updates are trusted code changes.

## Recommendation

Use asynchronous fail-closed profile resolution for listing and spawning, retain exact resolved extension paths in the loadout, reject legacy `tools` with migration guidance, and do not add content hashing or package installation to this feature.

## Evidence

- `/Users/dgjalic/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/dist/core/package-manager.js:680-738,981-1035,2055-2085`
- `/Users/dgjalic/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/dist/core/package-manager.d.ts`
- `/Users/dgjalic/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/docs/packages.md`
- `pi-extension/subagents/agents.ts`
- `pi-extension/subagents/index.ts:795-818,895-1006`
- `pi-extension/subagents/session.ts:85-205`
- `test/test.ts`, profile validation, canonical launch, and resume fail-closed coverage
