# Implementation: Profile extension loading

Plan: `../plan.md`
Mode: sliced
Current: `02.01`
Expected implementation sessions: 5
Implementation starting checkpoint: `486f582398eb6a79666e3ec05e868d33546c49eb`

## Shared objective

Give restricted Pi subagent profiles a fail-closed way to select Pi built-ins separately from explicitly configured package extensions, with deterministic launch and safe resume behavior.

## Shared constraints and non-goals

- Preserve trust-aware profile precedence, nested-agent restrictions, framework controls, and fail-closed resume.
- Package resolution must not install, update, access the network, or write settings.
- Extensions are trusted arbitrary executable code, not a per-tool sandbox.
- Do not modify Pi core, third-party extensions, global profiles, global settings, or the blocked profile work item.
- Do not add dependencies or expand into aliases, globs, standalone paths, per-tool extension filtering, immutable package snapshots, or Claude capability translation.

## Shared decisions and invariants

- D01/D11/D13: `builtin-tools` replaces profile `tools`; legacy `tools` is rejected with migration guidance, and missing or empty `builtin-tools` grants no built-ins.
- D02/D06/D07: extensions select exact configured package sources with optional exact package-relative resource paths.
- D03/D04/D05: a declared extension grants all of its executable behavior and tools, may override built-ins, and follows first-declared custom-tool precedence.
- D08/D12: resolution is trust-scoped and unresolved profiles are excluded from both list and spawn.
- D09: Pi capability fields are invalid for `cli: claude`.
- D10/D14: new resumes replay exact paths using current contents, while valid legacy strict snapshots remain resumable.
- D15: package extension grants replace hardcoded mappings and `registerToolExtension`.
- Framework controls always load before profile extensions; `subagent_agents` is the only nested-spawn grant.

## Common approval gates

- Stop and ask before dependencies, migrations, destructive operations, external writes, commits, pushes, production actions, or scope expansion.
- Do not install or alter Pi packages or write user/global settings.
- Do not run configured-model lifecycle tests without explicit approval.

## Common checks

- `npm test`
- `uv run spec/scripts/manage-spec-item.py --root . validate --item 260909-1952-profile-extension-loading`
- `git diff --check`

## Segment and slice order

### T01: Implement and verify profile capability resolution

Depends on: none
Segment starting checkpoint: `486f582398eb6a79666e3ec05e868d33546c49eb`
Segment acceptance: Valid profiles resolve deterministic built-in and package-extension loadouts through one asynchronous path; malformed, unavailable, disabled, escaping, and out-of-scope grants fail before pane creation without installation or fallback privilege expansion.
Segment gate: Run focused and full unit checks, prove parser/resolver and public diagnostic acceptance, then obtain independent Standards and Spec reviews.

- [x] 01.01: Add the profile capability schema and migration validation (packet: `./01-01-profile-schema.md`)
- [x] 01.02: Add package resolution and asynchronous canonical discovery (packet: `./01-02-package-resolution.md`)

Boundary 01.01 -> 01.02: Combining strict parser migration with asynchronous package-manager integration would reduce correction and recovery room across two distinct failure domains.

Boundary 01.02 -> 02.01: The complete fail-closed resolution contract must pass before runtime launch code consumes the resolved capability loadout.

### T02: Implement and verify the complete capability lifecycle

Depends on: T01
Segment starting checkpoint: unrecorded
Segment acceptance: New launch and resume use the same framework-first extension grant and selected built-ins; extension collision behavior matches the contract; missing paths fail before pane creation; valid legacy strict snapshots still resume; removed interfaces are absent.
Segment gate: Run focused and full unit checks plus the controlled non-model tmux surface suite where available, prove launch/activation/snapshot/resume acceptance, then obtain independent Standards and Spec reviews.

- [ ] 02.01: Implement isolated child launch and capability activation (packet: `./02-01-child-capability-launch.md`)
- [ ] 02.02: Add versioned snapshots and safe legacy/new resume (packet: `./02-02-versioned-resume.md`)

Boundary 02.01 -> 02.02: Launch and child-startup behavior needs focused runtime review before persistence compatibility is layered onto it; combining both materially increases security-sensitive review and correction scope.

Boundary 02.02 -> 03.01: The capability lifecycle and compatibility gate must pass before documentation declares the behavior and final whole-plan verification begins.

### T03: Document the final contract and prove the complete change

Depends on: T02
Segment starting checkpoint: unrecorded
Segment acceptance: User documentation and durable wiki memory match verified source, package output remains correct, all safe regressions and structural checks pass, and no global profiles or third-party settings change.
Final gate: Expand the T03 segment gate to whole-plan acceptance, all relevant safe regression checks, package inspection, Markdown and removed-interface checks, and one independent Standards and one independent Spec review covering both final-segment and whole-plan scope.

- [ ] 03.01: Update documentation and run final verification (packet: `./03-01-documentation-and-final-verification.md`)

## Discoveries and blockers

- `01.02` attempt 1's package-identity blocker was resolved by using Pi-equivalent identity comparison for project `autoload: false` delta bases. Focused, Standards, and Spec reviews passed; T01 is complete. Current is `02.01`.
