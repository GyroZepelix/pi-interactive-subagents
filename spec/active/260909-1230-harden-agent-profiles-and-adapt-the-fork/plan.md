# Plan: Harden agent profiles and adapt the fork

Work item: `260909-1230-harden-agent-profiles-and-adapt-the-fork`
Status: Planned
Created: 2026-09-09
Updated: 2026-09-09

## Goal

Adapt the fork for a user-managed subagent inventory, document the complete agent Markdown contract, and harden profile discovery and launch so malformed or mismatched definitions cannot silently broaden a child's capabilities.

## Context

The package currently discovers three bundled definitions from `agents/` before global and project definitions. The user wants no package-provided agents and will manage profiles under global or project configuration.

Profile discovery and launch currently use separate resolution paths. Discovery keys definitions by parsed frontmatter `name`, while launch searches for `<agentName>.md`. A file whose basename and declared name differ can therefore pass the known-agent check but lose its profile at launch. Missing or empty `tools` also produces a null allowlist, preserving Pi's default tools and global extensions despite README claims that access is whitelist-only.

Frontmatter is parsed with line-oriented regular expressions even though it is presented as YAML. The installed Pi 0.85.1 package exports `parseFrontmatter`, so this work can use a real YAML parser without adding a dependency. The repository still imports the retired `@mariozechner` packages and `@sinclair/typebox`; this item now includes the required migration to the installed `@earendil-works` packages and `typebox`.

The unit command currently cannot start in this checkout because dependencies are absent. The integration suite also contains fixtures for removed public fields and tools. Package metadata has a `3.7.2` versus `1.6.0` lockfile mismatch, and the package dry run includes repository-only spec, wiki, and test files.

Evidence:

- `pi-extension/subagents/index.ts:247-330`, `pi-extension/subagents/index.ts:404-416`, and `pi-extension/subagents/index.ts:798-812`
- `README.md:75-145`
- `test/integration/subagent-lifecycle.test.ts:193-315`
- `test/integration/agents/test-ping.md`
- `package.json` and `package-lock.json`
- Installed Pi 0.85.1 package types under `@earendil-works/pi-coding-agent`
- Upstream continuation source: <https://github.com/amosblomqvist/pi-interactive-subagents>

## Requirements

- Replace the current direct-upstream acknowledgment with concise credit and a link to `https://github.com/amosblomqvist/pi-interactive-subagents`.
- Remove `agents/scout.md`, `agents/researcher.md`, and `agents/worker.md` from package discovery and distribution. The extension must provide no default agent definitions.
- Discover user definitions from the configured global agent directory and trusted project definitions from the nearest applicable `.pi/agents` directory based on the active extension context, not a package `agents/` directory.
- Preserve precedence `project > global` for definitions with the same effective agent name.
- Do not load project-controlled agent prompts when the active project is not trusted. Global definitions remain available.
- Parse frontmatter with Pi's exported YAML parser. Support scalar strings and YAML string arrays for list fields where applicable.
- Use one canonical parsed definition, including source and source path, for listing, permission checks, launch, and diagnostics. Do not rediscover a validated definition by constructing a filename from its declared name.
- Preserve filename fallback for an omitted `name`, but trim and validate the resulting effective name. A filename and explicit `name` may differ without losing the profile.
- Validate supported fields and emit actionable diagnostics that identify the source file and field. Invalid definitions must be excluded rather than silently falling back to less restricted behavior.
- Reject unknown frontmatter keys. Reject simultaneous `skill` and `skills` aliases rather than applying hidden precedence.
- Normalize comma-delimited strings or YAML string arrays for `tools`, `skill` or `skills`, and `subagent_agents`. Reject non-string entries and invalid container types.
- Accept only documented enum values for `system-prompt`, `session-mode`, `thinking`, and `cli`, and actual YAML booleans for boolean fields. Keep the currently documented Pi behavior unless a current source test proves a broader value is already supported.
- Treat omitted or empty `tools` as an explicit empty ordinary-tool set. Restricted Pi children still receive `ask_question`; agents with a non-empty `subagent_agents` also receive the spawning tools. Every named Pi profile must launch with `--no-extensions` and an explicit `--tools` value.
- Before creating a pane, reject a profile that requests a non-built-in tool whose backing extension cannot be resolved. The error must name the agent, tool, and corrective action.
- Keep `subagent_agents` as the only field that grants nested spawning, and preserve `PI_SUBAGENT_ALLOWED` enforcement and loadout replay on resume.
- Reject a caller-supplied runtime `name` that is already running, reserved, or registered in the current parent session. Continue auto-suffixing only omitted names.
- When no definitions are available, `subagents_list` and spawn errors must direct users to the global and project profile locations instead of suggesting bundled names.
- Add a dedicated agent-definition reference under `docs/` and link it from the README. Document locations, nearest-project lookup, trust behavior, precedence, supported fields, aliases, valid values, defaults, body routing, tool and extension semantics, nested spawning, resume snapshots, CLI-specific limitations, and valid examples.
- Remove bundled-role examples and assumptions from tool descriptions, README examples, and tests.
- Refresh integration fixtures to use profile-defined `session-mode`, profile body and `system-prompt`, and `ask_question`. Do not restore removed public spawn parameters or `caller_ping`.
- Target the installed Pi 0.85.1 runtime: migrate imports and dependencies from `@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui`, and `@sinclair/typebox` to `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, and `typebox` at the installed compatible versions.
- Synchronize lockfile root package metadata with `package.json`; do not change unrelated dependency versions.
- Add a `package.json` `files` allowlist so the distributable contains only runtime source, the agent reference, README, license, and status configuration example. Exclude `spec/`, `wiki/`, tests, and repository instructions.
- Document dependency installation, safe unit checks, tmux-only checks, model-consuming checks, and a concise upstream tracking workflow.
- Update durable wiki pages during implementation only for source-verified current behavior and current limitations established by the completed change.

## Out of scope

- Adding, removing, or upgrading third-party dependencies beyond the approved Pi 0.85.1 namespace/API migration.
- Inventing replacement package author or public repository metadata. Those fields remain unchanged until the user provides canonical values.
- Adding parent-facing stop or turn-interrupt tools.
- Replacing `tmux send-keys` with an acknowledged socket or RPC transport.
- Redesigning shell-readiness detection, pane layout, status configuration, custom tool registration, or the Claude CLI integration.
- Splitting the full `index.ts` orchestration module, removing unrelated legacy helpers, or broad code cleanup.
- Adding formatter, linter, TypeScript compiler, or CI infrastructure.
- Running model-consuming integration tests without explicit approval for external calls, time, and cost.
- Committing, pushing, publishing, changing remotes, or modifying installed Pi configuration.

## Assumptions

- User and project agent definitions are the only desired inventory after bundled files are removed.
- Existing profiles that omit `tools`, use regex-only pseudo-YAML, contain unknown keys, or use invalid enum values may stop loading. This is an intentional fail-closed compatibility break and must be called out in documentation and errors.
- The installed `@earendil-works/pi-coding-agent` 0.85.1 API is the implementation target; compatibility with Pi 0.65 and the retired package namespaces is not required.
- `.pi/agents` remains the project profile convention for this extension. The implementation should use active context and nearest-ancestor lookup but must not rename that directory.
- No new dependency is needed because the existing Pi package exports `parseFrontmatter`. Stop for approval if implementation evidence contradicts this.
- If dependencies are absent, obtain approval before the local networked install needed to run tests. Prefer `npm ci` after the lockfile is corrected.
- Package author and repository fields remain as-is because no canonical replacement values were supplied.

## Design

Extract profile concerns from `index.ts` into a focused module such as `pi-extension/subagents/agents.ts`. The module owns source discovery, nearest trusted project lookup, YAML normalization, validation, diagnostics, precedence, and canonical lookup. It returns a result shaped around `agents` plus `diagnostics`, with each valid definition retaining its effective name, parsed defaults, source scope, and exact file path.

Call discovery with the active `ctx.cwd` and trust state from `subagent`, `subagents_list`, and `/subagent`. The subagent execution path selects a canonical definition once, validates permission against that same object, and passes it into launch. `launchSubagent` must no longer reload by inferred filename. Nested `PI_SUBAGENT_ALLOWED` filtering applies after valid definitions are assembled.

Use `parseFrontmatter<Record<string, unknown>>()` from the existing Pi package. Add small normalization helpers for strings, strict booleans, enums, and comma-or-array lists. Keep malformed files isolated: discovery returns diagnostics and valid neighboring definitions remain usable. Listing should include concise diagnostics in model-visible text or details without crashing extension startup.

Change tool allowlist construction so every named Pi profile gets a non-null allowlist and therefore `--no-extensions`. An empty profile tool list produces `ask_question`; spawning profiles additionally receive the three spawning tools. Validate each requested extension-backed tool before pane creation. Keep the current runtime registration mechanism and hardcoded compatibility map unchanged in this item.

Centralize runtime-name claiming. Omitted names use the current suffix strategy across running, reserved, and persisted names. Explicit names are normalized for emptiness and rejected on collision before launch so registry entries cannot be overwritten and message routing stays unambiguous.

Remove package-agent discovery and the three files. Replace README's bundled-agent section with a short setup path and link to `docs/agent-definitions.md`. Keep README task examples generic. The dedicated document is the authoritative user reference, while source and tests remain authoritative for behavior.

Update package filtering and the lockfile without dependency migration. Split documented verification into unit, tmux surface, and model-consuming lifecycle tiers, even if existing script names remain unchanged. Update stale lifecycle fixtures but do not execute the model-consuming tier without approval.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D01 | Inventory | Ship no bundled agents | The user wants full control over the available role inventory and models | Confirmed clarification; `agents/*.md` | The user requests opt-in examples or defaults |
| D02 | Documentation | Create `docs/agent-definitions.md` and link it from README | The profile contract is too large and security-sensitive for a compact README table | Confirmed clarification; `README.md:85-145` | The format becomes machine-generated from a schema |
| D03 | Parsing | Use Pi's existing `parseFrontmatter` export | It provides real YAML without adding a dependency | Published Pi 0.65 type declaration | The Pi namespace migration changes the import surface |
| D04 | Profile identity | Carry one canonical parsed definition from discovery through launch | Prevents filename/name mismatches from discarding restrictions | `index.ts:307-330`, `index.ts:404-416` | Agent identity or discovery architecture is redesigned |
| D05 | Tool default | Missing or empty `tools` means no ordinary tools | Security documentation promises whitelist-only access; silent full access is unsafe | `README.md:143`, `index.ts:798-812` | A separately approved inheritance mode is designed |
| D06 | Project scope | Load project agents only for trusted projects, using active cwd and nearest lookup | Repository-controlled prompts should follow Pi's trust model and work from subdirectories | Current Pi official subagent example and extension docs | Pi provides a first-class agent inventory API |
| D07 | Runtime names | Reject colliding explicit names and suffix omitted names | Explicit collisions overwrite registry handles and make duplex messaging ambiguous | `index.ts:949-973`, `index.ts:1791-1815`; live scrutiny observation | Addressing changes from names to immutable IDs |
| D08 | Compatibility | Target Pi 0.85.1 and migrate the renamed packages in this item | The active environment runs Pi 0.85.1 and the user explicitly does not require Pi 0.65 compatibility | `pi --version`; installed package metadata; confirmed correction during implementation | The project intentionally targets another Pi release |
| D09 | Runtime control | Document stop and interrupt as deferred | Controls are useful but transport and lifecycle semantics need separate design | Confirmed clarification; current tool registration | A dedicated reliability item is approved |
| D10 | Durable knowledge | Wiki records verified current state, while future design stays in this plan | Preserves repository spec/wiki protocol | `AGENTS.md`, `wiki/AGENTS.md`, `spec/AGENTS.md` | Repository knowledge policy changes |

## Work breakdown

- [x] T01: Introduce canonical, validated agent-definition discovery
  - Depends on: none
  - Scope: Add the focused profile module; use real YAML parsing; normalize lists; validate known fields, aliases, enums, booleans, names, and bodies; retain source paths and diagnostics; implement global plus nearest trusted project discovery with project-over-global precedence.
  - Expected areas: `pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`, focused test helpers in `test/test.ts`
  - Acceptance: Valid global and trusted project profiles are returned as canonical definitions; invalid files are excluded with path-specific diagnostics; untrusted project profiles are absent; filename/name differences remain fully configured.
  - Verification: Focused Node tests for parsing, diagnostics, trust, precedence, nearest lookup, and canonical identity, then `npm test`.

- [x] T02: Make launch and runtime naming fail closed
  - Depends on: T01
  - Scope: Pass the selected canonical definition into launch; remove package and filename-based reload paths; enforce explicit tool allowlists for every Pi profile; validate backing extensions before pane creation; preserve nested allowlists and loadouts; reject explicit name collisions while suffixing omitted names.
  - Expected areas: `pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts` only if registry APIs need a non-breaking helper, `test/test.ts`
  - Acceptance: No validated profile can launch without its parsed restrictions; omitted tools launch with only child-control tools; unresolved tools fail before pane creation; duplicate explicit names cannot overwrite or ambiguously address a session.
  - Verification: Focused mocked launch and tool-registration tests, followed by `npm test`.

- [x] T03: Remove bundled agents and publish the agent-definition reference
  - Depends on: T01, T02
  - Scope: Delete the three packaged definitions and all package-source discovery; add `docs/agent-definitions.md`; revise README inventory, examples, tool descriptions, setup, security wording, and acknowledgment.
  - Expected areas: `agents/`, `docs/agent-definitions.md`, `README.md`, `pi-extension/subagents/index.ts`
  - Acceptance: A fresh package exposes no agents until the user supplies one; all supported fields and defaults are documented accurately; README links the reference and credits Amos at the confirmed URL.
  - Verification: Search for bundled-role and obsolete-precedence claims, inspect Markdown links and fenced blocks, and run `npm test`.

- [x] T04: Align unit and integration coverage with the current contract
  - Depends on: T01, T02, T03
  - Scope: Remove bundled-agent assertions; add regression coverage for YAML forms, malformed profiles, canonical name resolution, trust, fail-closed tools, missing extensions, and duplicate names; replace duplicated parser smoke logic with production-code tests; update lifecycle fixtures from public `fork`, `systemPrompt`, `spawning`, and `caller_ping` to profile-defined behavior and `ask_question`.
  - Expected areas: `test/test.ts`, `test/system-prompt-mode.test.ts`, `test/integration/agents/*.md`, `test/integration/subagent-lifecycle.test.ts`, possibly `test/integration/harness.ts`
  - Acceptance: Tests describe only supported interfaces, and each confirmed profile-security defect has a regression test that fails against the old behavior.
  - Verification: `npm test`; `node --test test/system-prompt-mode.test.ts` only if the file remains; tmux and lifecycle tiers per the verification plan.

- [x] T05: Apply focused package and maintenance hygiene
  - Depends on: T03, T04
  - Scope: Migrate imports and package dependencies to the installed Pi 0.85.1 namespaces and APIs; synchronize lockfile root metadata; add the runtime `files` allowlist; document install and verification tiers plus upstream tracking; retain current author/repository metadata pending canonical replacements.
  - Expected areas: `package.json`, `package-lock.json`, `README.md` or a narrowly scoped contributing/upstream document
  - Acceptance: Package and lockfile root versions agree; dry-run contents exclude repository-only planning, wiki, instruction, and test files; maintainers can reproduce safe checks and understand the Amos upstream relationship.
  - Verification: `npm pack --dry-run --json`, lockfile metadata inspection, README link checks, and `git diff --check`.

- [x] T06: Refresh durable current-state knowledge
  - Depends on: T01, T02, T03, T04, T05
  - Scope: Update only source-verified current behavior and current limitations. Remove bundled-role claims, document validated discovery/trust/fail-closed semantics, update available checks and package shape, and retain deferred migration, stop/interrupt, transport, configuration, modularization, and quality-gate limitations as clearly labeled current gaps linked to this item where useful.
  - Expected areas: `wiki/overview.md`, `wiki/map.md`, `wiki/architecture.md`, `wiki/development.md`, `wiki/conventions/agent-profiles.md`, `wiki/conventions/runtime-safety.md`, `wiki/index.md`, `wiki/log.md`, and `wiki/state.md` only as required by wiki protocol
  - Acceptance: Wiki statements match implemented source and tests; no proposed design is presented as current behavior.
  - Verification: Resolve all wiki links touched, search for removed bundled-agent claims, check fenced-code balance, and run `git diff --check -- wiki`.

- [x] T07: Complete proportional verification and record limitations
  - Depends on: T04, T05, T06
  - Scope: Run the approved safe checks, inspect package output, and preserve skipped model-consuming checks and dependency or runtime limitations for later verification evidence.
  - Expected areas: No source changes unless a check exposes an in-scope defect; later `verification.md` is owned by the verification workflow.
  - Acceptance: Required non-model checks pass; any approved tmux checks pass; model-consuming tests are either explicitly approved and run or explicitly recorded as skipped; no deferred migration or runtime-control work is smuggled into scope.
  - Verification: Commands in the Verification plan.

## Acceptance criteria

- The distributable and source tree contain no package-discovered default agent definitions.
- `subagents_list` reports only valid global agents and valid trusted project agents, with project definitions overriding matching global names.
- Project agent discovery follows active cwd to the nearest `.pi/agents` directory and is disabled when project trust is false.
- A profile whose filename differs from its declared `name` launches with the exact model, prompt, tools, nesting policy, cwd, and other parsed settings shown by discovery.
- Invalid frontmatter produces an actionable file-and-field diagnostic and never launches an unrestricted fallback.
- A missing or empty `tools` field results in an explicit restricted allowlist containing only required control tools, not Pi defaults or global extensions.
- Missing backing extensions for requested custom tools fail before a pane is opened.
- Duplicate explicit runtime names are rejected without changing the persistent name registry; omitted names remain deterministically suffixed.
- The dedicated agent reference documents every implemented field and its exact behavior, and README links it.
- README acknowledges Amos using the confirmed repository URL.
- Unit and integration source no longer assumes bundled agents or removed public interfaces.
- Source and package metadata target the installed Pi 0.85.1 namespaces and APIs; `package.json` and lockfile root metadata agree, and the dry-run package excludes `spec/`, `wiki/`, tests, and `AGENTS.md`.
- Deferred Pi migration, stop/interrupt controls, acknowledged transport, shell readiness, configuration, modularization, dead-code cleanup, and quality gates are documented as deferred rather than implemented.

## Testing decisions and seams

- Put parser, normalization, discovery, trust, precedence, and diagnostics behind exported focused functions in the new profile module. Test real production logic rather than copying parser behavior into a smoke script.
- Keep tool allowlist and sandbox command assembly testable without tmux through existing `__test__` seams or narrower exported helpers.
- Add a test where `filename.md` declares a different `name`, then assert launch preparation uses that definition's restrictions.
- Add table-driven malformed-profile tests for unknown keys, conflicting aliases, non-boolean booleans, invalid enums, invalid list members, empty effective names, and malformed YAML.
- Add trust and nearest-project tests using temporary nested directories.
- Add runtime-name tests for running, reserved, and registry collisions without creating panes.
- Add unresolved custom-tool tests that verify failure occurs before `createSurface`.
- Keep tmux surface tests separate from model-consuming lifecycle tests in documentation. If script changes are useful for exact separation and require no new tooling, they are in scope.
- Exercise production imports against Pi 0.85.1 after the approved dependency installation and record any remaining runtime mismatch as a blocker.

## Verification plan

1. Before installing existing dependencies, inspect repository state and obtain approval if a networked install is required. Then use:
   - `npm ci`
2. Run safe unit and source-level checks:
   - `npm test`
   - `node --test test/system-prompt-mode.test.ts` only if that standalone file remains after deduplication
3. Run package checks:
   - `npm pack --dry-run --json`
   - Confirm the JSON file list contains runtime files, `docs/agent-definitions.md`, `README.md`, `LICENSE`, and `config.json.example`, and contains no `spec/`, `wiki/`, `test/`, or `AGENTS.md` paths.
4. Run tmux-only, non-model checks when inside tmux:
   - `node --test test/integration/tmux-surface.test.ts`
   - If tmux is unavailable, record this check as skipped rather than failed.
5. Do not run model-consuming lifecycle integration without explicit approval. If approved:
   - `node --test --test-concurrency=1 test/integration/subagent-lifecycle.test.ts`
6. Validate documentation and repository artifacts:
   - `rg -n "Bundled agents|package-bundled|caller_ping|spawning: false|systemPrompt:|fork: true" README.md docs pi-extension test wiki`
   - Manually verify every changed relative Markdown link resolves and fenced code blocks are balanced.
   - `git diff --check`
7. Validate the work item after progress updates:
   - `uv run spec/scripts/manage-spec-item.py --root . validate --item "260909-1230-harden-agent-profiles-and-adapt-the-fork"`

## Risks and blockers

- Fail-closed parsing and tool defaults intentionally break permissive profiles. Mitigate with precise diagnostics, migration examples, and regression tests.
- Dependencies must be available before runtime tests can prove the approved Pi 0.85.1 namespace and API migration.
- Pi 0.65's published `parseFrontmatter` export is source-backed through its type declaration, but runtime availability must be confirmed after install. Stop before adding a YAML dependency or expanding migration scope.
- Trust behavior is context-sensitive. Ensure all public entry points pass active cwd and trust state instead of retaining module-load `process.cwd()` assumptions.
- Tightening custom-tool resolution may expose currently silent local configuration gaps. Errors must explain registration and expected backing paths without weakening the sandbox.
- Integration lifecycle tests invoke a model and may incur time and cost. Keep them gated and record skips honestly.
- Deleting bundled agents is destructive but explicitly approved. Do not delete examples elsewhere or user-installed agent files.
- The package metadata still identifies the upstream author/repository until canonical fork values are supplied. Avoid guessing.
- The scrutiny delegation exposed duplicate explicit names and could not be steered because name-only addressing was ambiguous. This reinforces D07 but does not substitute for a deterministic regression test.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete; all blocking focused-review findings were resolved within scope.
- [x] Verification complete for the approved non-model scope; the final independent focused review passed, and model-consuming lifecycle checks remain explicitly skipped.

## Completion handoff

### Repository state

- Direct mode, starting and current `HEAD`: `22c823bc2a5022a29d6aa16bd5f6723e6d11e2bc`.
- All implementation remains uncommitted. Preserve the complete current working tree; do not reset, clean, stage, or overwrite it.
- The original pre-existing changes were only `spec/index.md` and the selected untracked work-item directory. All later changes listed below belong to this item.
- The user requires implementation delegation and review to use only the `generalist` subagent profile.
- The user approved expanding D08 to target Pi 0.85.1 and approved dependency installation. Do not expand beyond that migration without another approval.

### Implemented and reviewed work

- T01 profile discovery is implemented in `pi-extension/subagents/agents.ts`: Pi YAML parsing, required delimiters and non-empty bodies, mapping-root checks, known-key validation, strict booleans and enums, scalar/array list normalization, delimiter-safe names and entries, alias conflict rejection, file-and-field diagnostics, canonical source/path identity, nearest trusted project discovery, project precedence, invalid-override tombstones, order-independent duplicate exclusion, and nested allowlist filtering.
- T02 launch and naming hardening is implemented in `pi-extension/subagents/index.ts` and `session.ts`: one canonical profile reaches launch, empty ordinary-tool sets fail closed, exact extension paths are prepared before pane creation and snapshotted, custom tools and resume paths preflight, loadouts are structurally and semantically validated, spawning snapshots are cross-checked, concrete cwd/agent directory values are stored, fork tasks preserve profile bodies, explicit name collisions fail, omitted names suffix, and realpath-canonical reservations prevent concurrent resume of one JSONL through path aliases.
- T03 package profiles were removed: `agents/scout.md`, `agents/researcher.md`, and `agents/worker.md` are deleted and no package discovery path remains. `docs/agent-definitions.md` and the rewritten README document the current profile contract and credit Amos at the confirmed URL.
- T04 tests and fixtures are updated: `test/system-prompt-mode.test.ts` is deleted; production parser tests, adversarial profile/loadout/name/resume tests, public unresolved-tool coverage, and fork-body coverage are in `test/test.ts`; lifecycle fixtures use profile-defined session modes/system prompts and `ask_question`; tmux marker assertions are width-tolerant.
- T05 targets `@earendil-works/pi-coding-agent` 0.85.1, `@earendil-works/pi-tui` 0.85.1, and exact `typebox` 1.3.7. Package and lock root versions are 3.7.2. The `files` allowlist produces a 16-entry runtime/documentation package.
- T06 durable wiki pages are updated, including `wiki/conventions/index.md`; stale bundled-role and integration-drift claims have been removed.
- T07 non-model verification has been run and recorded in `verification.md`. Model-consuming lifecycle execution remains intentionally skipped because the user did not approve its time/cost/external calls.

### Changed paths

- Product and package: `pi-extension/subagents/agents.ts` (new), `index.ts`, `session.ts`, `subagent-done.ts`, `tools/safe-bash.ts`, `package.json`, `package-lock.json`.
- Removed package profiles: `agents/researcher.md`, `agents/scout.md`, `agents/worker.md`.
- Documentation and repository-only references: `README.md`, `docs/agent-definitions.md` (new), and `agent-examples/{researcher,scout,worker}.md` (moved references excluded from distribution).
- Tests: `test/test.ts`, `test/integration/tmux-surface.test.ts`, `test/integration/subagent-lifecycle.test.ts`, updated `test-echo.md` and `test-ping.md`, new `test-fork.md` and `test-system-prompt.md`, deleted `test/system-prompt-mode.test.ts`.
- Durable wiki: `wiki/index.md`, `overview.md`, `map.md`, `architecture.md`, `development.md`, `log.md`, `state.md`, `conventions/index.md`, `conventions/agent-profiles.md`, and `conventions/runtime-safety.md`.
- Spec evidence: `spec/index.md` and this item's `item.yaml`, `plan.md`, and `verification.md`.

### Verification already observed

- `npm install --package-lock-only --ignore-scripts && npm ci`: passed with 0 vulnerabilities after explicit approval.
- Latest `npm test`: passed 171/171.
- Controlled detached tmux test at 90 columns: passed 7/7.
- Controlled detached tmux test at 180 columns: passed 7/7.
- Direct tmux test from the active Pi TUI: marker behavior passed, but one focus assertion failed because the host TUI competed for active-pane focus. This environmental discrepancy is preserved in `verification.md`; controlled reviewer/implementer sessions pass.
- `node --check` for changed production and integration TypeScript entry files: passed.
- `npm pack --dry-run --json` plus explicit allowlist assertions: passed with 16 files and no `spec/`, `wiki/`, `test/`, or `AGENTS.md` paths.
- `npm ls --depth=0`: passed with Pi packages 0.85.1 and `typebox` 1.3.7.
- Markdown relative-link and fence checks: passed.
- Removed-interface, namespace, stale-role, and deleted-path search: passed after correcting an initially over-broad search that also matched valid user profile location examples.
- `git diff --check`: passed.
- Work-item schema validation: passed.

### Review history and final gate

- Five focused-review rounds returned blocking findings. Every finding and resolution is recorded in `verification.md`.
- The final repeated independent `generalist` review covered the complete diff, all deletions, and all untracked files and returned PASS with no blocking findings.
- Its only non-blocking finding was to refresh this Progress and handoff text during finalization.

### Exact next action

1. Run final work-item validation after these evidence-only progress updates.
2. Stop for a user-controlled Git checkpoint. Do not commit or push automatically.
3. Keep the model-consuming lifecycle suite recorded as skipped unless the user explicitly approves its external calls, time, and cost.

## Execution handoff

The completion handoff above supersedes the original planning-time execution prompt.

## Durable knowledge updates completed

- Updated `wiki/overview.md` and `wiki/map.md` to remove bundled-agent deliverable and path claims.
- Updated `wiki/architecture.md` with canonical profile resolution, trusted nearest-project discovery, diagnostics, and fail-closed launch behavior.
- Replaced `wiki/conventions/agent-profiles.md` with the verified current field, precedence, trust, and validation summary while keeping the detailed user contract in `docs/agent-definitions.md`.
- Updated `wiki/conventions/runtime-safety.md` with explicit empty-tool semantics and pre-launch custom-tool validation.
- Updated `wiki/development.md` with corrected test tiers, package checks, and approved installation prerequisites.
- Updated `wiki/index.md` stale notes after source and verification established which issues were resolved. Stop/interrupt, transport acknowledgment, configuration, modularization, dead code, and quality gates remain labeled as current limitations or deferred work.
- Followed `wiki/AGENTS.md` for `wiki/log.md` and `wiki/state.md` maintenance when durable wiki content changed.

## Notes

- No implementation is authorized by this plan artifact itself.
- No external research beyond the upstream repository reference, the continued prior-session context supplied by the user, local Pi 0.85.1 documentation, and the published Pi 0.65 type declaration was needed.
- Current planning-time observations: `npm test` failed before test execution because `@mariozechner/pi-tui` is unavailable; `npm pack --dry-run --json` succeeded and listed 48 package entries, including repository-only files; no tarball was created.
