# Plan: Profile extension loading

Work item: `260909-1952-profile-extension-loading`
Status: Planned
Created: 2026-09-09
Updated: 2026-09-09

## Goal

Give restricted Pi subagent profiles a first-class, fail-closed way to select Pi built-in tools separately from explicitly configured package extensions, while preserving trust-aware discovery, deterministic extension loading, and safe resume behavior.

## Context

- Profile parsing is currently synchronous and exposes one strict `tools` list (`pi-extension/subagents/agents.ts`).
- Named Pi children currently use `--no-extensions`, `--tools`, hardcoded custom-tool mappings, and the public `registerToolExtension` bridge (`pi-extension/subagents/index.ts`).
- Existing loadout sidecars store a strict tool allowlist and extension paths, and resume refuses missing paths (`pi-extension/subagents/session.ts`, `pi-extension/subagents/index.ts`).
- Pi's installed package manager can resolve enabled installed extension resources asynchronously without installing missing packages. Package sources may expose multiple extension entrypoints, so exact package-relative selectors are required for least privilege ([package reference research](./research/package-references.md)).
- Pi can start with built-ins disabled, load explicit extensions, and activate selected built-ins during `session_start`; extension tools remain governed by extension loading rather than a strict per-tool list ([tool activation research](./research/tool-activation.md)).
- Package resolution, project/global precedence, and resume compatibility require one shared asynchronous resolution phase and a versioned loadout union ([lifecycle research](./research/lifecycle-and-failures.md)).
- This work unblocks `260909-1928-create-global-scout-researcher-and-worker-profiles`.

## Requirements

- **R01 - Profile vocabulary:** Replace `tools` with `builtin-tools`. The field accepts a comma-delimited string or YAML string array. Missing or empty means no Pi built-ins. Every normalized entry must be one of `read`, `write`, `edit`, `bash`, `powershell`, `grep`, `find`, or `ls`.
- **R02 - Extension syntax:** Add optional `extensions` as a YAML array of mappings. Every entry requires exactly one non-empty `package` string and may contain one non-empty `paths` array of non-empty strings. Reject unknown entry keys, duplicate package entries, duplicate selectors, absolute selectors, selectors containing `.` or `..` path segments, malformed types, and explicitly empty `paths`.
- **R03 - Selection semantics:** Match `package` against the exact configured Pi package source. Omitted `paths` selects all enabled extension resources from that package in Pi's resolved resource order. Supplied `paths` selects exactly those enabled package-relative resources in selector order. Canonical duplicate absolute paths keep their first occurrence.
- **R04 - Scope and trust:** Global profiles resolve only global package settings. Trusted project profiles prefer exact project package sources and may fall back to global sources. Untrusted project profiles and package settings remain excluded. Asynchronous resolution failures in project overrides retain current fail-closed tombstone behavior.
- **R05 - Read-only resolution:** Listing and spawning share one asynchronous canonical parse-and-resolve path. Resolution must not install or update packages, access the network, or write settings. Missing configurations or installations, disabled or absent resources, root escapes, nonexistent files, or a package selection yielding no enabled extensions invalidate the profile with file-and-field diagnostics before pane creation.
- **R06 - Extension capability grant:** Declaring an extension authorizes its complete executable behavior and every tool it registers at startup or dynamically. Declared extensions may override built-in tool names. For duplicate custom tool names, first declared extension precedence is preserved.
- **R07 - Child isolation and activation:** New Pi children launch with global extension discovery and initial built-ins disabled. The framework runtime control loads first, optional spawning control follows, canonical profile extension paths retain resolved order, and a package-owned activation-only control loads last. Only validated `builtin-tools` are activated before the first model request, while startup and later tools from declared extensions remain active.
- **R08 - Framework controls and nesting:** `ask_question` remains available to every named Pi child. `subagent_agents` remains the only nested-spawn grant; the spawning extension loads only when that list is non-empty and `PI_SUBAGENT_ALLOWED` remains pinned to the declared effective names. The first-loaded runtime and spawning controls protect their tool names from ordinary profile-extension collisions; the trailing activation control registers no tools and is loaded only in subagent processes.
- **R09 - Snapshot and resume:** New sidecars use an explicit version and capability mode and store selected built-ins plus the exact ordered absolute extension paths needed to replay the resolved loadout. Resume does not reread profiles or package settings, validates every stored path before pane creation, preserves runtime-control-first and activation-control-last ordering, and uses current installed contents at valid snapshotted paths.
- **R10 - Legacy compatibility and migration:** Valid existing strict `toolAllowlist` snapshots remain structurally readable and resumable through their current `--tools` path and are not rewritten automatically. Legacy profile `tools` is rejected with actionable guidance to use `builtin-tools` and `extensions`. Remove `registerToolExtension`, its process-global hook, hardcoded custom-tool mappings, and their public test seam.
- **R11 - Claude boundary:** A `cli: claude` profile declaring `builtin-tools` or `extensions` is invalid because those fields cannot enforce Claude Code capabilities.
- **R12 - Canonical behavior:** The same resolved profile object, including normalized built-ins, ordered paths, source scope, and exact profile path, controls listing, permission checks, launch, diagnostics, and snapshot creation.
- **R13 - Documentation and knowledge:** Update the README and agent-definition reference with syntax, defaults, trust scope, ordering, migration, arbitrary-code warning, diagnostics, launch, and resume behavior. After implementation is verified, update relevant durable wiki conventions to describe current behavior.

## Out of scope

- Installing, updating, or modifying third-party packages or Pi settings.
- Network access or spawn-time package acquisition.
- Changes to Pi core, its package-manager contract, or third-party extensions.
- Per-tool filtering inside a declared extension.
- Extension aliases, ref-insensitive package matching, glob selectors, or standalone unconfigured paths.
- Immutable package snapshots, hashing package contents, or pinning imported dependencies.
- Translating Pi capability fields into Claude Code permissions.
- Creating or editing the blocked global scout, researcher, and worker profiles.
- Model-consuming lifecycle tests without separate explicit approval.
- Dependencies, migrations, destructive actions, external writes, commits, pushes, or scope expansion without user approval.

## Assumptions

- Pi 0.85.1 retains the researched `DefaultPackageManager`, settings, extension provenance, `getAllTools()`, `setActiveTools()`, and `session_start` behavior. Revisit the internal integration if the installed API differs, without changing the external profile contract silently.
- Existing configured package sources and enabled-resource filters are the authority for package selection. Direct filesystem discovery outside those settings is intentionally excluded.
- Snapshotted extension files can change in place. Valid resumes intentionally execute their current installed contents rather than claiming content immutability.
- Focused unit fixtures can exercise package resolution without touching the user's real global settings or installing packages.

## Design

### Parsed and resolved definitions

Keep frontmatter parsing strict and source-aware. Replace `AgentDefinition.tools` with normalized `builtinTools` and structured extension selectors. Preserve the current effective-name, duplicate, malformed-override, and uncertain-identity safeguards.

Introduce an asynchronous post-parse resolution phase that accepts the active cwd and project-trust state. It resolves each syntactically valid profile against only the permitted settings scopes, appends package diagnostics to that profile, and returns canonical resolved definitions containing ordered absolute extension paths. Public listing, spawning, and `/subagent` use this same result instead of independently reconstructing capabilities.

### Package and resource resolution

Use Pi's exported package/settings facilities in non-installing mode. Match exact configured source strings, inspect only enabled extension resources, and preserve declaration/resource order. For explicit selectors, validate package-relative form before resolution, resolve against the package root, canonicalize, prove the result remains inside that root, require the selected enabled resource to exist, and deduplicate final canonical paths by first occurrence.

A project profile first attempts an exact source in trusted project settings, then global settings. A global profile never consults project settings. Resolution failures exclude the profile. An invalid project profile continues to tombstone the same global effective name; uncertain project identity continues to suppress all globals.

### Child launch and activation

Construct new Pi launches with `--no-extensions --no-builtin-tools`. Add the always-required `subagent-runtime-control.ts` first, the nesting/spawning extension next only when granted, declared profile extensions in resolved order, and `subagent-capability-activation.ts` last. Do not emit a strict `--tools` argument for the new capability mode. Neither package-owned control file is auto-discovered or loaded into the parent session.

Pass the validated built-in list through a private launch/resume value owned by this package. The trailing activation-only extension registers no tools and applies selected built-ins plus registered extension tools after profile handlers during `session_start` and later pre-model lifecycle checkpoints. Preserve Pi's non-strict dynamic extension-tool activation behavior and deterministic first-loaded custom-tool precedence. Loading the runtime and optional spawning controls first protects their tool names from ordinary profile-extension collisions.

Delete the legacy custom-tool lookup map, runtime registration API, and process-global bridge after all new launch paths consume resolved package extensions.

### Versioned loadouts

Represent sidecars as a strict union:

- Legacy strict snapshots retain their current `toolAllowlist` and extension-path behavior.
- New versioned extension-grant snapshots identify their mode, selected built-ins, ordered absolute extension paths, and existing model, identity, nesting, cwd, and agent-directory state.

The command builder branches by validated snapshot mode. New-mode launch and resume use the same capability application helper. Resume checks stored paths and framework requirements before creating a pane, never re-resolves package settings, and refuses malformed or missing capability state. Existing valid strict snapshots continue through the legacy path unchanged.

### Diagnostics and documentation

Diagnostics identify the profile file and relevant field or selector and explain corrective action. The legacy `tools` diagnostic explicitly distinguishes Pi built-ins from package extension capabilities. Documentation states that extensions execute arbitrary trusted code and are not a tool-only sandbox.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D01 | Profile schema | Replace `tools` with `builtin-tools`; no profile compatibility alias | Separates Pi built-ins from executable extension grants without silently reinterpreting custom names | Confirmed discovery decision; Pi `defaultTools` precedent | An external compatibility obligation is explicitly accepted |
| D02 | Extension references | Select configured packages with optional resource narrowing | Package sources survive installation-root changes while exact paths preserve least privilege | [Package reference research](./research/package-references.md) | Pi exposes stable extension IDs or standalone paths are requested |
| D03 | Capability | A declared extension grants all startup and dynamic tools | Matches Pi non-strict extension behavior and the trusted-code model | [Tool activation research](./research/tool-activation.md) | Per-tool isolation inside trusted extensions is required |
| D04 | Overrides | Declared extensions may override built-in names | Intentional wrappers are valid extension behavior | Confirmed discovery decision; Pi extension semantics | A stronger sandbox boundary is introduced |
| D05 | Collisions | First declared extension wins duplicate custom names | Preserves Pi's deterministic load-order behavior | [Tool activation research](./research/tool-activation.md) | Pi adds a public collision policy or strict failure is requested |
| D06 | Package identity | Match the exact configured source string | Avoids ambiguous normalization | [Package reference research](./research/package-references.md) | Source changes become operationally unacceptable |
| D07 | Resource selectors | Use optional exact package-relative `paths` arrays | Avoids accidental grant expansion from aliases or globs | Confirmed discovery decision | Stable extension IDs or glob semantics are designed |
| D08 | Trust scope | Global profiles use global packages; trusted project profiles prefer project then global | Prevents project settings from altering global profiles while allowing trusted reuse | [Lifecycle research](./research/lifecycle-and-failures.md) | Profile or project trust semantics change |
| D09 | Claude | Reject Pi capability fields for `cli: claude` | Accepting unenforced permissions would create a false contract | Current Claude launch behavior | Claude gains a designed equivalent mechanism |
| D10 | Resume contents | Use current contents at stored paths | Matches existing path-based resume without introducing integrity infrastructure | [Lifecycle research](./research/lifecycle-and-failures.md) | Immutable package snapshots become required |
| D11 | Migration | Reject legacy profile `tools` with guidance | Avoids silently dropping or changing custom-tool grants | Confirmed discovery decision | A safe explicit compatibility mode is requested |
| D12 | Availability | Exclude unresolved package profiles from list and spawn | Prevents advertising or launching unusable profiles | [Lifecycle research](./research/lifecycle-and-failures.md) | Resolution latency requires a separately designed cache |
| D13 | Default | Missing or empty `builtin-tools` grants no built-ins | Preserves default deny | Confirmed discovery decision | Inherited defaults are intentionally adopted |
| D14 | Snapshot compatibility | Preserve valid legacy strict snapshot resume | Sessions have a durable security contract independent of profile migration | Existing snapshot tests and confirmed discovery decision | Legacy maintenance cost is explicitly reconsidered |
| D15 | Legacy mechanism | Remove custom-tool mappings and registration hook | Package extension grants become the single new-profile mechanism | Confirmed discovery decision | An approved integration cannot migrate |
| D16 | Activation ordering | Keep `subagent-runtime-control.ts` first and load tool-free `subagent-capability-activation.ts` after profile extensions | Pi 0.85.1 dispatches same-event handlers in extension order, so a first-loaded handler cannot activate an omitted built-in override registered later in that event; splitting registration precedence from final activation preserves both contracts | 02.01 focused review and installed Pi 0.85.1 runner behavior; approved 2026-09-10 | Pi adds a public post-handler activation hook or changes dynamic override activation |

## Work breakdown

- [x] T01: Implement and verify profile capability resolution
  - Depends on: none
  - Scope: Add the new strict profile schema, migration diagnostics, non-installing package/resource resolution, trust-aware scope and precedence, asynchronous canonical discovery, and matching public list/spawn diagnostics.
  - Expected areas: `pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`, `test/test.ts`
  - Acceptance: Valid profiles resolve deterministic built-in and extension loadouts; every malformed, unavailable, disabled, escaping, or out-of-scope grant is excluded before pane creation without package installation or fallback privilege expansion.
  - Verification: `node --test --test-name-pattern='subagent discovery' test/test.ts`, then `npm test`

- [ ] T02: Implement and verify the complete capability lifecycle
  - Depends on: T01
  - Scope: Apply resolved capabilities to isolated child startup, activate selected built-ins before model invocation, preserve extension ordering and nesting controls, remove legacy mappings/hooks, add versioned snapshots, and support safe new and legacy resume.
  - Expected areas: `pi-extension/subagents/index.ts`, `pi-extension/subagents/subagent-runtime-control.ts`, `pi-extension/subagents/subagent-capability-activation.ts`, `pi-extension/subagents/session.ts`, `test/test.ts`
  - Acceptance: New launches and resumes replay the same runtime-control-first, activation-control-last extension grant and built-in subset; extension behavior follows the confirmed collision semantics; missing paths fail before pane creation; valid legacy strict snapshots still resume; removed interfaces have no remaining runtime or test references.
  - Verification: `node --test --test-name-pattern='session.ts|subagent discovery|subagent runtime control|capability activation|tool registration' test/test.ts`, `npm test`, and the controlled non-model tmux surface suite where available

- [ ] T03: Document the final contract and prove the complete change
  - Depends on: T02
  - Scope: Update user documentation and durable wiki conventions, verify migration guidance and trusted-code warnings, inspect package contents, run all safe checks, and complete whole-plan review.
  - Expected areas: `README.md`, `docs/agent-definitions.md`, `wiki/conventions/agent-profiles.md`, `wiki/conventions/runtime-safety.md`, `wiki/log.md`, `wiki/state.md`, tests or source only for final corrections
  - Acceptance: Documentation and durable memory match verified source; package output remains correct; all required safe regressions and structural checks pass; no blocked global profiles or third-party settings are changed.
  - Verification: `npm test`, `node --test test/integration/tmux-surface.test.ts` in controlled tmux where available, `npm pack --dry-run --json`, removed-interface searches, Markdown path/link/fence checks, `uv run spec/scripts/manage-spec-item.py --root . validate --item 260909-1952-profile-extension-loading`, and `git diff --check`

## Acceptance criteria

- A profile with valid `builtin-tools` and configured package `extensions` appears in `subagents_list` with one canonical resolved loadout and can reach launch preparation.
- Missing or empty `builtin-tools` yields no Pi built-ins while `ask_question` remains available.
- Legacy `tools`, unknown built-ins, malformed extension entries, duplicate packages/selectors, absolute or traversing selectors, empty supplied paths, and Pi capability fields on Claude profiles produce actionable file-and-field diagnostics.
- Exact configured package sources resolve without installation, network access, or settings writes. Global/project scope, trusted fallback, enabled-resource filters, selector order, package order, canonical containment, and first-path deduplication are covered by tests.
- Package-resolution failures preserve invalid project-override tombstones and prevent both listing and pane creation.
- New commands contain `--no-extensions --no-builtin-tools`, omit strict `--tools`, load runtime and optional spawning controls before profile extensions, load the tool-free activation control last, and carry only validated built-ins to startup activation.
- Before the first model turn, selected built-ins and every startup extension tool are active, undeclared built-ins are inactive, dynamic extension tools become active before the next model request, built-in overrides work, and first-loaded duplicate custom tools win.
- Nested spawning remains available only from non-empty `subagent_agents`, with target names pinned and framework tools protected by load order.
- New versioned snapshots round-trip selected built-ins and ordered absolute extension paths. Resume is independent of changed profiles/settings, uses current contents at present paths, and refuses missing or malformed paths before pane creation.
- Existing valid strict snapshots still validate and resume through `--tools` without automatic rewriting.
- `registerToolExtension`, its global bridge, hardcoded compatibility mappings, and related public test exports are absent.
- README, agent-definition docs, and relevant wiki pages describe the verified contract, migration, scope, ordering, arbitrary-code boundary, Claude rejection, and resume behavior.
- Safe unit, package, spec, Markdown, and diff checks pass. The non-model tmux suite is run in a controlled tmux environment where available. Model-consuming lifecycle tests are not run without explicit approval.

## Testing decisions and seams

- Extend the existing `subagent discovery` table and public tool-execution tests in `test/test.ts` for syntax, migration, async resolution, trust, precedence, diagnostics, and pre-pane failure.
- Use temporary isolated agent directories, settings, and package fixtures. Assert that missing-package callbacks do not install and that no real global settings are read or written.
- Exercise command construction through existing launch-preparation and sandbox-application seams, adapted to the versioned capability modes. Avoid exposing production internals solely for tests when an existing public behavior seam can prove the result.
- Extend runtime-control and activation-control tests with mock and real Pi 0.85.1 lifecycle fixtures proving pre-model activation, extension-tool preservation, same-event dynamic registration, overrides, explicit deactivation preservation, and deterministic load order. Any small exported pure helper must remain package-internal and justified by this behavior seam.
- Extend `session.ts` sidecar tests for the strict union, malformed-mode rejection, new-mode round trips, path preflight, changed-profile independence, and unchanged legacy replay.
- Verify `subagents_list`, `subagent`, and `/subagent` all await the same canonical resolution path and expose matching diagnostics.
- Use the existing controlled tmux surface suite only where the environment is suitable. Keep the configured-model lifecycle suite behind a separate explicit approval because it consumes model time and money.
- Each implementation slice receives a focused read-only review. Each segment gate receives independent Standards and Spec reviews; the final pair expands to whole-plan scope.

## Verification plan

- `node --test --test-name-pattern='subagent discovery' test/test.ts`
- `node --test --test-name-pattern='session.ts|subagent discovery|subagent runtime control|capability activation|tool registration' test/test.ts`
- `npm test`
- In a controlled tmux session: `node --test test/integration/tmux-surface.test.ts`
- `npm pack --dry-run --json`, then inspect that runtime files, README, license, example config, and agent-definition docs are included while `spec/`, `wiki/`, tests, and repository instructions are excluded.
- `git grep -n -E 'registerToolExtension|EXTRA_TOOL_EXTENSIONS|getToolExtensionPath' -- pi-extension test README.md docs` must return no matches.
- Check changed Markdown relative links and fenced-code balance, and confirm ASCII/plain-text consistency where repository rules require it.
- `uv run spec/scripts/manage-spec-item.py --root . validate --item 260909-1952-profile-extension-loading`
- `git diff --check`
- Do not run `node --test --test-concurrency=1 test/integration/subagent-lifecycle.test.ts` without explicit approval.

## Risks and blockers

- **Package-manager API drift:** Pi internals may differ from the researched installed version. Mitigate by targeting the declared Pi 0.85.1 API, using exported surfaces, and stopping rather than weakening the contract if source contradicts research.
- **Accidental installation or writes:** Convenience resolver APIs may install missing packages. Mitigate with the non-installing resolution callback, isolated fixtures, and assertions that missing references fail closed.
- **Async precedence regressions:** A package-resolution failure could accidentally restore a global profile. Mitigate by carrying effective identity and source tombstones through the asynchronous phase and testing invalid project overrides.
- **Path escape or aliasing:** Relative selectors and symlinks could escape package roots or create duplicate loads. Mitigate with lexical validation, canonical root containment, existence checks, and first-occurrence deduplication.
- **Extension code is not sandboxed:** Loaded extensions can register hooks and mutate active tools. Mitigate through explicit package grants, documentation, trust scoping, framework-first load order, and clear arbitrary-code warnings.
- **Activation timing:** A first-loaded control handler runs before profile handlers and can miss same-event dynamic overrides. Mitigate with a tool-free activation control loaded last, additive source-transition activation, and real Pi lifecycle tests.
- **Resume privilege drift:** A malformed union or reconstructed profile could broaden capabilities. Mitigate with strict mode/version validation, shared launch/resume application, exact stored paths, and refusal before pane creation.
- **Legacy compatibility:** New snapshot fields could invalidate existing sessions. Mitigate with a structural union and unchanged legacy command path.
- **Verification environment:** The tmux surface suite requires a controlled tmux session, and lifecycle tests consume models. Record environmental limits; never substitute model-consuming checks without approval.

## Progress

- [x] Planning complete and confirmed.
- [ ] Implementation not started.
- [ ] Verification not run.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read this plan and its item.yaml completely.
Implement the work step by step while preserving Requirements, Out of scope, Decision Log, and Verification plan.
Use implementation/index.md as the serial sliced-mode handoff and execute only its Current packet.
Update Progress and the Decision Log when confirmed implementation discoveries change the approach.
Run the specified verification before reporting completion.
Stop and ask before dependencies, migrations, destructive operations, external writes, commits, pushes, or scope expansion.
```

## Proposed durable knowledge updates

After source implementation and verification establish current behavior:

- Update `wiki/conventions/agent-profiles.md` with `builtin-tools`, package `extensions`, asynchronous canonical resolution, trust scope, defaults, and migration behavior.
- Update `wiki/conventions/runtime-safety.md` with explicit extension-code grants, framework-first loading, built-in activation, and versioned resume invariants.
- Update `wiki/log.md` and `wiki/state.md` as required by `wiki/AGENTS.md` for the durable wiki change.
- Update broader architecture or development pages only if verified implementation creates durable behavior not already captured by those convention pages.

## Notes

- Discovery and research remain supporting evidence. This plan is the sole implementation contract.
- The approved mode is sliced: three testable plan segments projected into five serial implementation sessions under `implementation/`.
- The complete five-packet decomposition and every retained boundary were explicitly approved on 2026-09-09.
