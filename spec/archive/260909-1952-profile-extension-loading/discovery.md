# Discovery: Profile extension loading

Work item: `260909-1952-profile-extension-loading`
Status: Ready for Spec
Created: 2026-09-09
Updated: 2026-09-09

## Objective

Define a first-class agent-profile contract for loading selected Pi extensions into restricted subagents without per-tool bridge registration.

## Desired outcome

A profile can select built-in tools separately from extension code. Declared extensions load in the child, and their tool capabilities follow explicit, documented semantics that remain fail-closed, resumable, and understandable from the YAML definition.

## Repository and domain context

- The current profile schema accepts `tools` as a strict allowlist of ordinary built-in and extension tools.
- Named Pi children launch with `--no-extensions`, an explicit `--tools` allowlist, and exact `-e <entrypoint>` arguments resolved indirectly from custom tool names.
- A non-built-in tool currently requires a compatibility mapping or `registerToolExtension(tool, path)` registration in the parent.
- The blocked global-profile item `260909-1928-create-global-scout-researcher-and-worker-profiles` exposed the ergonomic problem: installed `web_search`, `web_fetch`, and `codex_search` extensions are available to the parent but cannot be selected declaratively by an agent profile.

## Scope

- Replace profile `tools` with `builtin-tools` and add package-based `extensions` grants.
- Extension package/resource resolution, ordering, trust boundaries, and diagnostics.
- Child launch, active-tool selection, framework-control isolation, loadout snapshots, and resume behavior.
- Migration diagnostics for current profiles and compatibility for existing session snapshots.
- Removal of custom-tool registration hooks and hardcoded mappings.
- Documentation and public test seams required by a later implementation plan.

## Out of scope

- Writing the implementation plan or changing source during discovery.
- Installing, updating, or modifying third-party extension packages.
- Creating the global scout, researcher, or worker profiles before the runtime contract is implemented.
- Package installation, network access, commits, pushes, or external configuration writes.
- Changes to Pi core, the package-manager contract, or third-party extension packages.
- Per-tool filtering inside a declared extension, immutable package-content snapshots, or extension aliases.
- Translating Pi extensions or built-in permissions into Claude Code.

## Confirmed facts and evidence

- `Fact`: Pi extensions execute arbitrary code and may register tools, commands, event handlers, providers, and other behavior. A profile extension grant is therefore a code-execution grant, not only a tool grant. Evidence: installed Pi `docs/extensions.md`.
- `Fact`: Pi CLI `--tools` is a strict allowlist for built-in, extension, and custom tools. Evidence: installed Pi `docs/usage.md`.
- `Fact`: Pi settings `defaultTools` selects built-in tools only while preserving extension and SDK tools. The user's proposed conceptual split therefore has precedent in Pi, although not under the current profile field name. Evidence: installed Pi `docs/settings.md`.
- `Fact`: `--no-extensions -e <source>` loads only explicitly selected extensions, and `-e` can accept local paths, npm sources, or git sources. npm and git sources may cause temporary installation and network activity. Evidence: installed Pi `docs/extensions.md` and `docs/packages.md`.
- `Fact`: `pi.getAllTools()` exposes registered tool provenance through `sourceInfo`, and `pi.setActiveTools()` can select registered built-in and extension tools after startup. Evidence: installed Pi `docs/extensions.md`.
- `Fact`: One extension can register multiple tools, can override a built-in tool name, and can register tools dynamically after startup. Evidence: installed Pi `docs/extensions.md`.
- `Fact`: The current subagent loadout already snapshots absolute extension paths and refuses resume when a snapshotted path disappears. Evidence: `pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`, and `test/test.ts`.
- `Fact`: Current strict parsing rejects unknown profile fields, so `builtin-tools` and `extensions` require explicit schema, documentation, and regression-test changes. Evidence: `pi-extension/subagents/agents.ts`.
- `Fact`: Pi exports `DefaultPackageManager` and `SettingsManager`; read-only resolution can enumerate enabled installed extension resources with absolute paths and package provenance. Missing sources can be rejected instead of installed by using `resolve(onMissing)`, while `resolveExtensionSources()` would install missing sources and is unsuitable here. Evidence: [installed package extension references](./research/package-references.md).
- `Fact`: A Pi package can expose multiple extensions and has no stable per-extension logical name. Package-only selection can therefore load unrelated code; exact package-relative resource selection is needed for least privilege. The installed rpiv mono package demonstrates this by exposing both web-tools and ask-user-question entrypoints. Evidence: [installed package extension references](./research/package-references.md).
- `Fact`: Pi already activates all tools from explicitly loaded extensions when no strict `--tools` allowlist is supplied. `--no-builtin-tools` disables the initial built-in set while preserving extension tools, and selected built-ins can be activated during `session_start` with `pi.setActiveTools()`. Evidence: [tool activation research](./research/tool-activation.md).
- `Fact`: Dynamic extension tools are automatically activated in Pi's non-strict mode. An extension tool that overrides a built-in name also takes precedence, and duplicate custom names follow load order. Evidence: [tool activation research](./research/tool-activation.md).
- `Fact`: Configured package/resource resolution is asynchronous and can fail closed without installation; current profile syntax parsing is synchronous, so canonical profile resolution for list and spawn requires a shared asynchronous post-parse phase. Evidence: [lifecycle and failure research](./research/lifecycle-and-failures.md).
- `Fact`: Existing resumes replay absolute extension paths without re-reading the profile. Package code may change in place, and entrypoint-only hashing would not cover imports or dependencies. Evidence: [lifecycle and failure research](./research/lifecycle-and-failures.md).

## Constraints and invariants

- Named Pi children must remain fail-closed and continue to launch with global extension discovery disabled.
- A profile must not silently gain undeclared built-in tools.
- Project profile behavior must remain trust-aware.
- Resumes must replay the original resolved capability loadout rather than reinterpreting a changed profile.
- Extension loading must not install packages, access the network, or modify settings unless separately designed and approved.
- Invalid or missing extension references must exclude or reject the profile with actionable diagnostics before pane creation.
- `subagent_agents` remains the only grant for nested subagent spawning.
- Framework control extensions must load ahead of profile extensions so profile code cannot replace `ask_question` or the named spawning tools through ordinary duplicate-name precedence.
- Declared extensions remain trusted arbitrary code. `builtin-tools` constrains Pi's initial built-in tool activation, not what trusted extension code can do directly or activate later.

## Domain language

- `builtin-tools`: Proposed profile field selecting only Pi's built-in tools: `read`, `write`, `edit`, `bash`, `powershell`, `grep`, `find`, and `ls`.
- `extensions`: Proposed profile field selecting extension entrypoints or installed package resources to load with global discovery disabled.
- `extension tools`: Tools registered by a declared extension, including tools that may share an extension entrypoint.
- `strict allowlist`: The current `tools` behavior and Pi CLI `--tools`, where every callable tool name must be listed.
- `extension grant`: Authorization to execute the complete extension module, including non-tool hooks and commands.
- `configured package source`: The exact `source` string present in global or trusted project Pi `packages` settings.
- `resource selector`: An exact extension entrypoint path relative to the configured package root.

## Proposed profile contract

```yaml
---
name: researcher
builtin-tools: []
extensions:
  - package: "git:git@github.com:GyroZepelix/rpiv-mono-selfhost-firecrawl@main"
    paths:
      - packages/rpiv-web-tools/index.ts
  - package: "git:git@github.com:tejesh0/pi-codex-search@pi_latest_compat"
auto-exit: true
system-prompt: append
---

Research the assigned topic and return a concise source-backed brief.
```

- `builtin-tools` accepts the existing comma-delimited string or YAML string-array forms, but every normalized name must be a Pi built-in. Missing or empty means no built-ins.
- `tools` is no longer supported. Its diagnostic directs users to `builtin-tools` for Pi built-ins and `extensions` for extension capabilities.
- `extensions` is an optional YAML array of mappings. Each mapping requires exactly one non-empty `package` string and may contain one non-empty `paths` string array. Unknown keys, duplicate package entries, duplicate selectors, malformed values, absolute selectors, and selectors containing `.` or `..` path segments invalidate the profile.
- The `package` value must exactly match a package source configured in the scope allowed for that profile. Resolution never installs, updates, or persists packages.
- Omitted `paths` selects all enabled extension resources belonging to that configured package. Supplied paths select exactly those enabled resources and preserve selector order.
- A missing package, unavailable installation, disabled or absent selected resource, or package selection yielding no enabled extensions invalidates the profile during both list and spawn resolution.
- Global profiles resolve only global package settings. Trusted project profiles search exact project package sources first, then global sources. Untrusted project profiles and packages are ignored.
- Profile extension entries load in declaration order. Explicit `paths` use selector order; omitted paths use Pi's resolved package resource order. Canonical duplicate paths keep their first occurrence.
- Every startup and dynamic tool from declared extensions is active. Declared extensions may override Pi built-in names. For duplicate custom names, the first loaded extension wins.
- Required framework-control extensions load before declared profile extensions. `ask_question` is always available; spawning controls are available only when `subagent_agents` is non-empty.
- `cli: claude` profiles containing `builtin-tools` or `extensions` are invalid.

## Proposed launch and resume contract

- New launches resolve one canonical definition asynchronously and carry its normalized built-ins plus resolved absolute extension paths through permission checks, listing, launch, diagnostics, and snapshot creation.
- New Pi children launch with `--no-extensions --no-builtin-tools`, required framework-control extension arguments first, then resolved profile extension arguments.
- The validated built-in list is delivered in a private launch value and activated by the child-control extension during `session_start`, before any model request, while preserving all active extension tools.
- New snapshots use an explicit version/mode and store the built-in list plus exact absolute extension paths. Resume validates paths, reloads them in the same order, and activates the snapshotted built-ins without re-reading the profile or package settings.
- Existing valid strict `toolAllowlist` snapshots remain readable and resume through the legacy `--tools` path. They are not rewritten automatically.
- If package code changes at a snapshotted path, resume uses the current installed contents. Missing paths refuse resume.

## Decision tree

1. Permission vocabulary
   - Confirmed: `builtin-tools` replaces profile `tools`; missing or empty means no Pi built-ins.
2. Extension reference identity
   - Confirmed: each entry uses the exact configured Pi package source string rather than an installation-root path or ref-insensitive alias.
   - Confirmed: an optional `paths` string array contains exact package-relative extension resource paths.
   - Omitting `paths` selects all enabled extensions from that package; supplying it narrows the grant to exactly those enabled extension resources.
3. Extension capability activation
   - Confirmed: launch with global discovery disabled and built-ins initially disabled, then activate selected `builtin-tools` during `session_start`.
   - Every tool registered at startup or later by a declared extension becomes active automatically.
4. Collision and override policy
   - Confirmed: a declared extension may override a built-in name, even when that name is absent from `builtin-tools`.
   - Confirmed: when declared extensions register the same custom tool name, the first declared extension wins, matching Pi's extension order.
5. Trust, path, and lifecycle behavior
   - Confirmed: global profiles resolve only global packages; trusted project profiles prefer project packages and may fall back globally; untrusted project packages and profiles are excluded.
   - Confirmed: resolve package resources asynchronously without installation, use enabled exact resources, canonicalize and deduplicate paths, and exclude invalid profiles before listing or pane creation.
   - Confirmed: resume from snapshotted absolute paths using current installed contents; refuse missing or invalid paths.
6. Compatibility and migration
   - Confirmed: reject legacy profile `tools` with targeted migration guidance.
   - Confirmed: preserve valid existing strict-tool snapshots through a versioned/union loadout reader.
   - Confirmed: remove the public custom-tool registration hook and hardcoded mappings; package extension grants become the sole new-profile path.
7. Acceptance and verification
   - Confirmed seams cover parser, asynchronous package resolution, launch, provenance, activation, trust, migration, and both snapshot modes.

## Confirmed decisions

| ID | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- |
| D01 | Introduce `builtin-tools`; current `tools` compatibility is not required | The user wants the profile vocabulary to separate Pi built-ins from extension-granted capabilities and explicitly said the existing field is not needed | User answer in frontier round 1; Pi `defaultTools` precedent | Migration evidence reveals an external compatibility obligation the user wants to preserve |
| D02 | `extensions` references already-configured Pi packages with optional resource-path narrowing | Package references survive installation-root changes. An omitted path intentionally loads every enabled extension from the package; supplied path selectors load only those matching extension resources | User answer in frontier round 2; [package reference research](./research/package-references.md) | Pi gains stable per-extension logical identities or the user requests standalone unconfigured paths |
| D03 | A declared extension grants all tools it registers at startup or dynamically later | This is the simplest profile mental model, matches Pi's existing non-strict extension activation, and avoids per-tool maintenance | User answer in frontier round 3; [tool activation research](./research/tool-activation.md) | The user requires per-tool restrictions inside an otherwise trusted extension |
| D04 | Allow declared extensions to override built-in tool names | An extension is a trusted executable grant, and intentional built-in wrappers are standard Pi use cases | User answer in frontier round 4; Pi extension override documentation | A stronger sandbox boundary than trusted extension execution is introduced |
| D05 | First declared extension wins duplicate custom-tool names | This preserves Pi's deterministic current precedence without adding a loader handshake or broader Pi API work | User answer in frontier round 4; Pi extension runner source | Pi exposes a public collision diagnostic or the user prefers strict startup failure |
| D06 | Identify packages by their exact configured source string | Reuses Pi settings data directly and avoids ambiguous identity normalization | User answer in frontier round 5; package manager API research | Changing a configured package source becomes too burdensome |
| D07 | Use optional exact `paths` arrays relative to the package root | Exact arrays avoid accidental expansion from globs; omission intentionally means every enabled extension resource in the package | User answer in frontier round 5 | Packages gain stable extension IDs or glob ergonomics become necessary |
| D08 | Keep package resolution scope-contained | Prevents a project package from silently changing a global profile while allowing trusted project profiles to reuse global packages | User answer in frontier round 5; current profile trust model | The trust model or profile precedence changes |
| D09 | Reject `cli: claude` profiles that declare `builtin-tools` or `extensions` | Claude Code does not load Pi extensions or enforce Pi's built-in tool activation, so accepting the fields would create a false permission contract | User answer in frontier round 6; current Claude launch limitations | Claude Code gains an explicitly designed equivalent capability model |
| D10 | Resume with current contents at snapshotted extension paths | Matches the existing path-based resume invariant and avoids an unrelated package-integrity system | User answer in frontier round 7; [lifecycle research](./research/lifecycle-and-failures.md) | Immutable package snapshots become a product requirement |
| D11 | Reject legacy profile `tools` with migration guidance | Prevents custom tool names from being silently dropped or reinterpreted as built-ins | User answer in frontier round 7; [lifecycle research](./research/lifecycle-and-failures.md) | A safe explicit compatibility mode is requested |
| D12 | Exclude unresolved package profiles from list and spawn | Avoids advertising unusable agents and applies one fail-closed diagnostic contract | User answer in frontier round 7 | Package resolution latency materially harms listing |
| D13 | Missing or empty `builtin-tools` grants no built-ins | Preserves default-deny behavior while extension and framework-control grants remain explicit | User answer in frontier round 7 | The project intentionally adopts inherited defaults |
| D14 | Preserve resume support for valid existing strict-tool snapshots | Existing sessions have a durable resume contract independent of profile migration; a union reader is safer than conversion | User answer in frontier round 8 | Legacy snapshot support becomes a material maintenance burden |
| D15 | Remove `registerToolExtension` and hardcoded custom-tool mappings | The deliberate breaking migration should leave package-based extension grants as the single profile mechanism | User answer in frontier round 8 | An external integration cannot migrate to configured package references |
| D16 | Confirm the complete discovery contract for specification | The user confirmed the synthesized outcome, scope, semantics, migration, and verification direction without remaining changes | Final shared-understanding confirmation | Source evidence contradicts a confirmed premise during specification |

## Rejected alternatives

- `tool_extensions` mapping from each tool name to an entrypoint was rejected as unnecessarily repetitive for multi-tool extensions and less natural than declaring the extension itself.
- A global registration bridge remains a workaround for the blocked profile item, not the desired product design.
- Installation-root extension paths were rejected because configured package references survive package-root changes and can honor Pi resource filters.
- Ref-insensitive package matching and custom aliases were rejected in favor of exact configured source strings.
- Glob selectors and singular path shorthand were rejected in favor of one exact `paths` array shape.
- Per-extension tool-name allowlists and startup-only snapshots were rejected because the declared extension is trusted as a complete evolving capability.
- Strict duplicate-tool collision gates were rejected in favor of Pi's deterministic first-extension precedence.
- Immutable package hashing was deferred as a separate package-integrity concern.
- Claude Code translation was rejected because Pi capability fields cannot enforce Claude's runtime.

## Open questions and prerequisites

No consequential question remains. Implementation may choose internal type and function names, but it must preserve the confirmed external schema, ordering, diagnostics, security semantics, migration behavior, and verification obligations.

## Current frontier

Empty. Shared-understanding confirmation is the only remaining readiness gate.

## Research index

- [Research index](./research/index.md)
- [Installed package extension references](./research/package-references.md): exported resolver APIs, no-install behavior, package/resource identity, and difficulty assessment.
- [Built-in and extension tool activation](./research/tool-activation.md): existing Pi activation behavior, launch shape, dynamic tools, and collision risks.
- [Package lifecycle and failures](./research/lifecycle-and-failures.md): asynchronous resolution, canonical paths, diagnostics, migration, and resume implications.

## Proposed test seams and acceptance evidence

- Parser table tests accept valid `builtin-tools` and structured `extensions`; reject unknown built-ins, legacy `tools`, malformed entries, unknown keys, duplicate packages/selectors, empty supplied `paths`, and path traversal or absolute selectors.
- Package-resolution tests use temporary global/project settings and package fixtures to prove exact source matching, optional all-resource selection, exact path narrowing, enabled-resource enforcement, scope containment, project fallback, canonical deduplication, stable ordering, and no installation callbacks.
- Invalid global and project override tests preserve tombstone behavior after asynchronous package-resolution failures.
- Launch command tests prove new snapshots emit `--no-extensions --no-builtin-tools`, load required controls before ordered profile extensions, omit strict `--tools`, and deliver only validated built-ins to startup activation.
- Child-control tests prove selected built-ins activate before the first model turn, absent built-ins remain inactive, all startup and dynamic extension tools activate, extension built-in overrides work, and first extension registration wins duplicates.
- Public `subagents_list`, `subagent`, and `/subagent` tests prove one canonical asynchronous resolution path and matching diagnostics before tmux pane creation.
- Snapshot tests cover the versioned extension-grant shape, exact ordered paths, missing-path refusal, changed-profile independence, current-content resume, and unchanged legacy strict-snapshot resume.
- Documentation checks cover the complete YAML contract, code-execution warning, package scope, ordering, migration examples, Claude rejection, and removal of registration-hook instructions.
- Required repository checks remain `npm test`, the controlled non-model tmux suite where available, package dry-run inspection, Markdown link/fence checks, removed-interface searches, and `git diff --check`. Model-consuming lifecycle tests remain separately approval-gated.

## Proposed wiki updates after implementation

- Update `wiki/conventions/agent-profiles.md` with the final profile vocabulary and defaults.
- Update `wiki/conventions/runtime-safety.md` with extension-code grants, active-tool semantics, and resume invariants.
- Update architecture and development pages only if source and verification establish broader runtime or test changes.

## Resume state

- Last completed round: Frontier round 8.
- Confirmed: use `builtin-tools`; compatibility with the current `tools` field is not required.
- Confirmed: `extensions` references configured packages, with omitted paths loading all enabled extension resources and explicit paths narrowing the selection.
- Research completed: installed package resolution is medium complexity and can be read-only; package names alone do not identify one extension in a multi-extension package.
- Activation research completed: Pi's existing non-strict mode supports all extension tools plus a separately activated built-in subset without parent-side tool enumeration.
- Confirmed: a declared extension grants all tools registered at startup or dynamically later.
- Confirmed: extension-provided built-in overrides are allowed, and the first declared extension wins duplicate custom-tool names.
- Confirmed: package entries use exact configured source strings and optional exact `paths` arrays.
- Confirmed: global profiles resolve global packages only; trusted project profiles prefer project packages and may fall back globally.
- Confirmed: reject `cli: claude` profiles that declare `builtin-tools` or `extensions`.
- Lifecycle research completed: package/resource resolution can fail closed; resumes currently replay paths, and legacy `tools` cannot be safely aliased.
- Confirmed: resumes use current contents at snapshotted paths; legacy profile `tools` is rejected with guidance; unresolved package profiles are excluded from list and spawn; missing `builtin-tools` grants no built-ins.
- Confirmed: preserve valid old strict snapshot resumes, but remove the registration hook and hardcoded mappings for new profiles.
- Schema, diagnostics, ordering, launch/resume behavior, migration boundaries, and acceptance seams are finalized in this dossier.
- No consequential user question remains.
- Shared understanding confirmed by the user on 2026-09-09.
- Exact next action: run `/skill:to-spec 260909-1952-profile-extension-loading` to create the implementation contract.

## Readiness for To Spec

- [x] Every consequential branch is resolved or explicitly out of scope.
- [x] Facts are distinguished from user decisions and hypotheses.
- [x] Requirements, constraints, and non-goals are clear.
- [x] Acceptance evidence and proposed test seams are defined.
- [x] The user confirmed shared understanding.
