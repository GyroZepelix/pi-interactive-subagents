# Plan: Subagent-only capability registry for MCP, extensions, and skills

Work item: `261118-1208-subagent-only-capability-registry-for-mcp-extensions-and-skills`
Status: Planned
Created: 2026-11-18
Updated: 2026-11-18

Assurance: medium - changes capability-grant resolution, launch flags, and resume snapshots across `agents.ts`, `mcp-config.ts`, `index.ts`, and `session.ts`, with meaningful regression cost; all inputs are local user-owned config, resolution stays read-only, and rollback is practical.

## Goal

Let subagent profiles use MCP servers, package extensions, and skills that the parent agent never loads. A Pi-native "subagent registry" sits beside the profile definitions. Users manage it with stock Pi CLI commands. The parent never reads it, and profiles that name its entries get them. Profiles also control whether a child inherits ambient skills.

## Context

Verified current behavior at `HEAD`:

- Pi children launch with `--no-extensions --no-builtin-tools` but without `--no-skills` (`pi-extension/subagents/index.ts` ~L1349-1375). They therefore discover the same ambient skills as Pi would for the child cwd. The profile `skills:` field only sends `/skill:<name>` prompts at startup (`index.ts` ~L1380-1395).
- Profile `extensions` resolve only enabled resources from packages configured in global or trusted-project Pi settings (`agents.ts` `loadPackageCatalog`, `resolveConfiguredPackage`). The parent loads those same packages.
- Profile `mcp-servers` resolve only enabled entries in global or trusted-project `mcp.json` (`mcp-config.ts` `loadMcpConfigCatalog`, `resolveMcpServerReferences`; archived decision D11 in `spec/archive/261002-1653-add-mcp-and-codemode-profile-access/plan.md`). Parent ambient MCP connects every enabled server.
- Capability resolution is already anchored to the profile's location and the active project, not the runtime `cwd` override (`settingsCwd` in `loadPackageCatalog`; runtime cwd does not re-resolve MCP).
- `pi install -l` writes `./.pi/settings.json` and installs project-locally. `pi mcp add -l` writes `./.pi/mcp.json`, and Pi auto-discovers `./.pi/skills/`. Run from an agents directory, these commands populate a registry with no new CLI. `DefaultPackageManager.resolve()` returns `extensions` and `skills` resources (`@earendil-works/pi-coding-agent` `dist/core/package-manager.d.ts`).

## Requirements

- **R01 - Registry locations:** The global registry is `<global agents dir>/.pi/` (for example `~/.pi/agent/agents/.pi/`). A trusted project's registry is `<project>/.pi/agents/.pi/`. Each registry uses Pi's project layout: `settings.json` packages, `mcp.json` servers, and `skills/` plus package-provided skills. The global registry is always trusted. A project registry is read only when the project is trusted, the same rule that governs project profiles.
- **R02 - Lookup order:** For a global profile, the global registry is consulted first, then the existing ambient rules. For a trusted project profile, the project registry is consulted first, then the global registry, then the existing ambient rules. The first source that contains the package source, MCP server name, or skill name wins, and its entry is used as-is (registry wins over ambient). Profiles whose selections are not in any registry keep exactly today's behavior.
- **R03 - Profile-anchored resolution:** Registry and ambient capability resolution depends on the profile's location and the active trusted project, never on the runtime `cwd` passed to `subagent`. Example: a profile in repo A that selects repo A's registry MCP server and extension still gets them when spawned with `cwd` set to repo B.
- **R04 - Extensions:** `extensions` package selectors (flat Pi profiles and `cli: pi` chain targets) resolve registry packages through the same read-only package machinery, including enabled-resource filtering, `paths` selectors, root containment, and ordering rules. Registry settings filters (`pi config --local` in the agents dir) are honored.
- **R05 - MCP servers:** `mcp-servers` names resolve registry `mcp.json` entries with today's validation: enabled-only, namespace collisions across the effective catalog, non-secret source and digest references, and the filtered child controller. A registry entry replaces an ambient entry of the same name. Disabled registry entries still invalidate the profile.
- **R06 - Skills (breaking, replaces current meaning):** `skills:` (and its alias `skill`) no longer sends `/skill:` startup prompts. Each listed name is resolved at discovery to a skill file path (registries first, then the profile's ambient settings context) and passed as `--skill <path>`, so the child can discover the skill but does not invoke it. An unknown name invalidates the profile with a file-and-field diagnostic.
- **R07 - Skill inheritance:** New boolean `inherit-skills`, default `true`, on flat Pi profiles. With `true`, the child keeps today's native ambient skill discovery, which follows the child cwd, plus the listed skills. With `false`, the launch adds `--no-skills`, so only the listed skills load. The listed skills may include ambient skills. `inherit-skills` is invalid on `cli: claude`, `cli: agy`, and `model-chain` profiles, even when the value is explicit. Existing `skills` acceptance per harness is otherwise unchanged.
- **R08 - Read-only:** Discovery, listing, launch, and resume never install, update, connect, access the network, expand config expressions, read credentials, or write settings. Missing or invalid registry files produce diagnostics only for profiles that depend on them. They do not break unrelated profiles.
- **R09 - Resume:** New launches store the resolved registry MCP references (with their source scope), the skill paths, and `inherit-skills` in a new strict loadout version. Resume validates them exactly and fails closed with fresh-spawn guidance on missing files or changed MCP digests. Existing version 1 and version 2 snapshots stay resumable without being rewritten.
- **R10 - Docs:** Update `docs/agent-definitions.md` (registry layout, lookup order, management commands such as `cd ~/.pi/agent/agents && pi install -l ...` and `pi mcp add -l`, new `skills` meaning, `inherit-skills`, and the migration note), the README setup guidance, and `skills/subagent-profiles/SKILL.md` together, consistent with each other.

## Out of scope

- A new CLI or command for managing registries. Use the stock `pi install -l`, `pi mcp add -l`, `pi update`, `pi config --local`, and lore.
- Changes to Claude or AGY capability handling, or registry support for AGY.
- Startup skill invocation (removed, not replaced).
- Background or non-split launch mode (backlog B3).
- Project-only profile inheritance (backlog B1).
- Migrating user profiles under `~/.pi/agent/agents/`. None use `skills:` today.

## Assumptions

- Pi's `DefaultPackageManager` and `SettingsManager` can resolve a registry rooted at an agents directory the way they resolve a project. Revisit if project-local package install paths are cwd-coupled in a way the resolver cannot reproduce read-only.
- OAuth credentials stored by `pi mcp login -l` for a registry server are found by the child's filtered MCP controller. This is unverified. If they are not, document the required login step or record a follow-up rather than adding credential handling.
- Pi's behavior when `--skill` names a skill that is also discovered ambiently is unverified. Pick the variant (always pass, or skip already-ambient names when `inherit-skills: true`) that loads the skill once without warnings, and record the choice in the Decision Log.

## Design

Add a registry source as a third catalog layer:

- `agents.ts`: discover registry roots next to the global and trusted-project agents dirs. Build registry package catalogs, rooted at the registry cwd with project-scope storage, in front of the existing catalog. Extend selector lookup per R02. Add `inherit-skills` parsing and validation, plus skill-name resolution to canonical paths using Pi's resolver and skill loader. Carry results on the canonical definition.
- `mcp-config.ts`: allow catalogs with ordered registry sources ahead of project and global, and a registry scope in canonical references. Make digest verification accept that scope.
- `index.ts`: remove `/skill:` prompt construction and the artifact separator it required. Pass `--skill <path>` per resolved skill and `--no-skills` when `inherit-skills` is false. Thread the new fields into loadout capture and resume command construction.
- `session.ts`: add a strict loadout version for the new fields, and keep the v1 and v2 readers.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D1 | Registry form | Pi project layout under `<agents dir>/.pi/`, managed by stock Pi CLI | No new config surface or tooling, and the parent never reads it | User Q1 (O2) and Q6 answers; `pi install --help`, `pi mcp --help` | Pi changes project-local layout |
| D2 | Precedence | Project registry, then global registry, then ambient; first hit wins | Mirrors Pi's project-over-global precedence | User Q7 and Q8 | Users need collision errors |
| D3 | Anchoring | Resolution follows profile location, not runtime cwd | Profiles carry capabilities defined beside them | User Q7 answer; existing `settingsCwd` behavior | - |
| D4 | Skills | `skills:` becomes discoverability via `--skill`; `inherit-skills` toggles `--no-skills` | User never uses startup invocation and wants isolation | User Q3, Q4, Q9, Q10 | - |
| D5 | Disabled entries | D11 kept: disabled entries are never selectable | Child-only behavior comes from the registry, not from disabling | Archived 261002 D11 | - |
| D6 | Assumption 1 (resolved) | A registry resolves as Pi project-scope packages through `DefaultPackageManager` with `cwd` = the agents dir, read-only storage, and no global delta bases | Pi's project install roots and local-source base are `<cwd>/.pi/{npm,git}` and `<cwd>/.pi`, so `pi install -l` in the agents dir matches exactly | Pi 1.1.0 `package-manager.js` `getNpmInstallRoot`/`getBaseDirForScope`; registry fixtures in `test/test.ts` | Pi couples project install paths to something other than `cwd` |
| D7 | Assumption 2 (resolved) | No credential handling added; document that `pi mcp login` must run in a trusted agents dir | Pi stores MCP OAuth state in `<agentDir>/mcp-auth.json` keyed by server namespace and URL, independent of the defining `mcp.json`; the filtered child controller uses the same default store | Pi `extensions/mcp/oauth.js`, `cli.js` (trust check); integration test with a pre-seeded registry-server token | Pi scopes credentials by config file |
| D8 | Assumption 3 (resolved) | Always pass `--skill <canonical skill file>`; never skip ambient names | Same-file ambient plus `--skill` loads once with no diagnostic (Pi 1.5.2 and 1.1.0 probes); skipping would break R03 when the runtime cwd differs. Limitation: with `inherit-skills: true`, a same-named ambient skill in a different file wins with a Pi collision diagnostic, so docs direct users to `inherit-skills: false` when the registry version must win | SDK probe of `DefaultResourceLoader` (cases A-E); `resource-loader.js` path order | Pi lets CLI skills win name collisions |
| D9 | MCP registry scope | Reference scopes `global-registry` and `project-registry`; registry entries reject `auth: { provider }` like project files; child capability env protocol stays `2`; version-2 snapshots reject registry scopes | Keeps canonical non-secret references and Pi's rule that only the global `mcp.json` chooses credential destinations | `mcp-config.ts`, `session.ts`; registry MCP tests | Pi allows provider auth in project files |
| D10 | Snapshot version | Write version 3 `registry-capabilities` only when skill paths exist, `inherit-skills` is false, or a registry MCP reference is selected; otherwise keep version 2 | Satisfies "identical loadouts" for profiles without registry or skill state; registry extension paths are already exact files in version 2 | `index.ts` `prepareAgentLaunch`; launch tests | - |
| D11 | Skill resolution scope | Resolve `skills` only for flat Pi profiles; Claude keeps accepting `skills` unused. The ambient context is Pi's own discovery for the profile settings cwd (active trusted project and global, packages, settings entries, `.agents`), first-wins. Registry contexts exclude auto-discovered resources outside `<agents dir>/.pi` | R07 keeps per-harness acceptance; mirrors Pi so resolution matches what the child would load; prevents ancestor `.agents/skills` leaking into a registry | Real-agent-dir mirror check matched Pi's loader; mutation test of the exclusion filter | - |

## Work breakdown

- [x] T01: Registry discovery and extension resolution
  - Depends on: none
  - Scope: R01-R04, R08 for packages
  - Expected areas: `pi-extension/subagents/agents.ts`, `test/test.ts`
  - Acceptance: global and project registry packages resolve in lookup order, ambient-only profiles are unchanged, and failures produce diagnostics without broader fallback
  - Verification: `npm test`
- [x] T02: Registry MCP resolution
  - Depends on: T01
  - Scope: R05, R08, plus reference scope for R09
  - Expected areas: `pi-extension/subagents/mcp-config.ts`, `agents.ts`, `subagent-mcp-control.ts` (if scope checks live there), `test/test.ts`
  - Acceptance: a registry-only server is granted to the child, a registry entry overrides an ambient entry of the same name, and disabled, missing, or colliding entries are rejected
  - Verification: `npm test`; `node --test --test-concurrency=1 test/integration/mcp-capability.test.ts`
- [x] T03: Skill resolution and launch flags
  - Depends on: T01
  - Scope: R06, R07
  - Expected areas: `agents.ts`, `index.ts`, `test/test.ts`
  - Acceptance: the launch command contains `--skill <path>` per listed skill and `--no-skills` only when `inherit-skills: false`, no `/skill:` prompts remain, and unknown names and invalid harness use are rejected
  - Verification: `npm test`
- [x] T04: Loadout snapshot and resume
  - Depends on: T02, T03
  - Scope: R09
  - Expected areas: `pi-extension/subagents/session.ts`, `index.ts`, `test/test.ts`
  - Acceptance: new snapshots round-trip, registry MCP digest changes and missing skill paths refuse resume, and v1 and v2 snapshots still resume
  - Verification: `npm test`
- [x] T05: Documentation
  - Depends on: T01-T04
  - Scope: R10
  - Expected areas: `docs/agent-definitions.md`, `README.md`, `skills/subagent-profiles/SKILL.md`
  - Acceptance: the three documents agree on registry layout, lookup order, management commands, `skills` and `inherit-skills` semantics, and the breaking-change note
  - Verification: manual cross-read; `git diff --check`

## Acceptance criteria

- With a server, package, and skill present only in `~/.pi/agent/agents/.pi/`, a global profile naming them launches a child that has them, while a parent Pi session in an ordinary project does not load them.
- A trusted project registry entry overrides the global registry and ambient entries for that project's profiles. Spawning the profile with `cwd` set to another repository keeps the same capability grants.
- Profiles that use no registry entries produce identical launch commands and loadouts, apart from the removed `/skill:` prompts.
- `inherit-skills: false` children load only the listed skills. Children with the default value also keep ambient skills from their cwd.
- All new failure cases surface in `subagents_list` diagnostics before any pane is created.

## Verification plan

- `npm test` (unit and regression suite, with new focused cases for each requirement).
- `node --test --test-concurrency=1 test/integration/mcp-capability.test.ts` (non-model MCP process fixture, extended with a registry-sourced server).
- `node --test --test-concurrency=1 test/integration/tmux-surface.test.ts` if launch command delivery changes.
- Manual: create a throwaway global registry under a temporary `PI_CODING_AGENT_DIR` with one local package, one stdio MCP server, and one skill; confirm `subagents_list` output and the constructed launch command.
- Model-consuming `subagent-lifecycle.test.ts` only with explicit user approval.

## Risks and blockers

- Registry OAuth credential lookup may differ from global servers (see Assumptions). Verify with a local fixture where practical, otherwise document it.
- Pi's package-manager internals are partially unexported (an existing compatibility seam). Keep the registry layer fail-closed when identity or resolution APIs are unavailable.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete (T01-T05).
- [x] Verification passed; see verification.md.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read spec/active/261118-1208-subagent-only-capability-registry-for-mcp-extensions-and-skills/plan.md and item.yaml completely, plus AGENTS.md and wiki/conventions/agent-profiles.md.
Implement T01-T05 at medium assurance while preserving Requirements, Out of scope, Decision Log, and Verification plan.
Resolve the Assumptions empirically and record outcomes in the Decision Log; ask before changing any requirement.
Update Progress as tasks complete. Record only verified evidence, failures, skipped checks, and residual uncertainty.
Stop and ask before dependencies, destructive operations, external writes, model-consuming tests, commits, pushes, or scope expansion.
```

## Proposed durable knowledge updates

- After implementation, update `wiki/conventions/agent-profiles.md` (registry, lookup order, skills semantics) and `wiki/architecture.md` (launch flags, loadout version).
