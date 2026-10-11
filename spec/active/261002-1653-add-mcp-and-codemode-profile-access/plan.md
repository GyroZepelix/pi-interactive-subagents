# Plan: Add MCP and codemode profile access

Work item: `261002-1653-add-mcp-and-codemode-profile-access`
Status: Planned
Created: 2026-11-16
Updated: 2026-11-16

## Goal

Let a restricted flat Pi subagent profile explicitly enable `codemode` and grant an exact allowlist of configured MCP server names while ensuring unselected ambient servers never connect, register capabilities, or enter model context. Preserve trusted-extension behavior, credentials, configured MCP exposure, and fail-closed session resume.

## Assurance

Assurance: high - MCP grants can start local processes or network connections with stored credentials, the feature changes the child capability boundary, and persisted resume must not silently adopt changed authority.

Review tier: every implementation slice receives scoped checks and a focused review. Coherent segment boundaries and final whole-plan completion require separate Standards and Spec reviews.

## Context

- Current Pi children use `--no-extensions --no-builtin-tools`, then reconstruct a validated loadout from package-owned controls, selected built-ins, and trusted package extensions.
- Pi 1.0 supplies `codemode`, `tool_search`, and MCP through built-in extensions. Loading ambient `builtin:mcp` unchanged would connect every enabled global and trusted-project server before a tool-level filter could protect the child.
- Pi 1.0 publicly exports `createMcpExtension({ loadConfig })`, which can replace ambient file discovery while retaining ordinary provider credentials, MCP OAuth storage, logging, transports, exposure, and lifecycle behavior.
- Current version-1 loadouts have an exact strict shape. MCP identity and codemode support therefore require a new snapshot version rather than mutating persisted version-1 semantics.
- The confirmed discovery and upstream evidence remain at [discovery.md](./discovery.md) and [research/upstream-pi-mcp.md](./research/upstream-pi-mcp.md).

## Requirements

- **R01 - Pi 1.0 baseline:** Require and test `@earendil-works/pi-coding-agent` and matching Pi TUI APIs at version 1.0 or newer. Update package metadata and the lockfile coherently without adding unrelated dependencies.
- **R02 - Profile syntax:** Flat Pi profiles accept `codemode` in `builtin-tools` and optional `mcp-servers` as the existing comma-delimited string or YAML string-array form. Names are exact valid Pi MCP server names. Missing or empty fields grant nothing, and duplicate list entries follow current list normalization.
- **R03 - Harness boundary:** `mcp-servers` is valid only for flat Pi profiles. Claude, AGY, and `model-chain` forms reject the field even when explicitly empty. Existing AGY/model-chain built-in restrictions continue to reject `codemode`.
- **R04 - Trusted MCP resolution:** Canonical discovery reads the global MCP file and, only for the active trusted project context, the project MCP file. A project entry replaces the same global name for every profile. A runtime child `cwd` override cannot select another config source or recompute the grant.
- **R05 - Fail-closed configuration:** Resolve and validate only selected entries and namespace conflicts that affect them. A malformed whole source file, missing selected name, invalid selected config, selected `-`/`_` namespace collision, or selected `enabled: false` entry excludes the profile before pane creation. An invalid or disabled project override blocks global fallback. Resolution performs no connection, installation, command substitution, environment expansion, config write, or credential read.
- **R06 - Stable server identity:** Normalize each selected Pi 1.0 MCP config deterministically and hash its semantic configuration with SHA-256. Normalization preserves meaningful ordering, including `toolExposure` pattern precedence, while ignoring irrelevant JSON formatting and key order. It hashes configured expressions, not resolved secret values. Persist only ordered server name, canonical source path, source scope, and digest, never the config or credential values.
- **R07 - Filtered child MCP:** A protected package-owned child control uses Pi's public MCP factory with ambient file loading disabled and registers only the validated snapshotted entries. The child keeps its real `PI_CODING_AGENT_DIR`, normal provider credentials, MCP OAuth credentials, settings, models, and logs. Unselected ambient file-configured servers never connect, register tools/resources, or contribute prompt metadata.
- **R08 - Codemode and discovery support:** A standalone `codemode` grant explicitly loads and activates `builtin:codemode`. A non-empty MCP grant explicitly loads both `builtin:codemode` and `builtin:tool-search`; private validated capability state keeps whichever support tools the selected server exposures require active after the trailing activation checkpoint.
- **R09 - Exposure integrity:** Preserve allowed servers' configured server and per-tool `direct`, `codemode`, `deferred`, and `hidden` exposure, including resource tools. The package activation control must not promote MCP-control-owned indirect or hidden tools into direct model declarations. Direct MCP tools may use Pi's normal registration activation.
- **R10 - Trusted extension boundary:** Load the protected filtered MCP control before declared profile extensions so selected server names are reserved. Explicitly declared profile extensions remain trusted arbitrary code and may register additional MCP servers or perform equivalent direct I/O; `mcp-servers` filters ambient file configuration, not trusted extension behavior.
- **R11 - Versioned replay:** Add a strict loadout version 2 carrying the codemode/MCP capability state and server references. Initial launch and resume use the same validation and command-construction path. Resume rereads only each exact stored source entry and refuses missing, invalid, disabled, source-mismatched, or digest-changed config before creating a pane, with guidance to spawn fresh.
- **R12 - Compatibility:** Existing valid version-1 extension-grant snapshots and legacy strict `toolAllowlist` snapshots remain readable and resume through their unchanged command paths. Existing profiles without the new capabilities retain their current authority and behavior.
- **R13 - Runtime failures:** Once configuration identity has passed, MCP connection, authentication, reconnect, and transient failure behavior remains Pi-native. A valid but unavailable allowed server does not itself terminate child startup.
- **R14 - Documentation and durable knowledge:** Document syntax, defaults, trust and project override behavior, complete-server grant semantics, codemode model operations, trusted-extension caveat, filtered loading, config-drift refusal, diagnostics, and Pi 1.0 minimum. Update durable wiki guidance only after implementation and verification establish current behavior.

## Out of scope

- Per-tool filtering within an allowed MCP server.
- Wildcard or implicit all-server grants.
- Claude, AGY, or model-chain support for the new capabilities.
- Automatic MCP installation, configuration edits, sign-in, or credential migration.
- Sandboxing declared profile extensions or preventing their direct process/network access.
- Changing Pi core, third-party MCP servers, or upstream MCP configuration formats.
- Strict startup readiness for network/authenticated servers beyond Pi's normal lifecycle.
- Model-consuming lifecycle tests without separate explicit approval.
- Unrelated cleanup, dependencies, migrations, commits, pushes, publishing, or production actions.

## Assumptions

- Pi 1.x retains the exported `createMcpExtension`, extension registration, active-tool, source metadata, and built-in extension identifiers verified at 1.0.0. Stop rather than weaken filtering if implementation discovers incompatible current APIs.
- The active parent context's trust decision is authoritative for initial global/project MCP merging. Resume uses stored source identity and does not reevaluate project precedence.
- Environment variables, command substitutions, OAuth tokens, and provider credentials may rotate without changing the configured capability identity. Digest validation intentionally covers their literal configuration expressions, not runtime-resolved secret values.
- Selected package extensions remain an explicit arbitrary-code grant. The ambient MCP allowlist is not represented as a sandbox against them.

## Design

### Canonical MCP configuration and digesting

Add a package-owned MCP configuration module used by discovery, launch preflight, resume preflight, and the child control. Parse the documented Pi 1.0 global/project shape without evaluating config values. Preserve exact override tombstones: a selected project name that is present but invalid or disabled must not restore a global entry.

Validate the documented stdio and HTTP shapes, MCP names, normalized namespaces, exposures, tool exposure patterns, OAuth settings, and project restriction on provider-backed `auth`. Build a deterministic semantic digest representation with fixed known-field ordering, sorted unordered maps, preserved arrays, and preserved `toolExposure` pattern order. Normalize aliases and explicit defaults where they are semantically equal before SHA-256 hashing.

Resolved profiles carry ordered server references and the required support-tool set. Listing, direct spawn, `/subagent`, launch preparation, and snapshot creation consume the same canonical object.

### Protected filtered MCP runtime

Add a child-only protected MCP control. It receives only validated non-secret server references from the loadout capability channel, rereads each exact canonical source entry, verifies identity and digest, and submits the config through Pi's public `registerMcpServer()` validation. It installs `createMcpExtension` with an empty ambient `loadConfig`, preserving Pi's normal connection, credential, transport, OAuth, resource, and `/mcp` behavior for session-registered servers.

Keep extension discovery disabled. The explicit load order is:

1. runtime control;
2. optional spawning control;
3. required built-in codemode/tool-search support;
4. protected filtered MCP control when MCP is granted;
5. declared profile extensions in canonical order;
6. tool-free capability activation control.

The filtered controller owns selected ambient names before profile extensions load. Registrations from later trusted profile extensions remain permitted.

### Activation and exposure

Extend the private capability contract to distinguish explicitly selected `codemode`, exposure-required support tools, profile extension tools, and MCP-control-owned tools. Initial activation keeps selected built-ins and trusted profile tools while retaining required codemode/tool-search support. Later activation must exclude MCP-control provenance from blanket profile-extension activation so indirect and hidden tools preserve their exposure. Additive checkpoints still activate later tools from declared profile extensions and preserve intentional built-in overrides.

### Snapshot and resume

Keep legacy strict and version-1 snapshot bytes valid. Add a strict version-2 union member with the existing common state plus selected built-ins, spawning state, ordered extension paths, ordered MCP references, and required support-tool state. Reject mixed, incomplete, duplicate, noncanonical, unknown-version, or inconsistent values.

New launch and resume share one sandbox application helper. Both preflight framework paths and MCP source identity. Resume never rereads the profile or current precedence and fails before pane creation when the exact stored entry no longer matches.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D01 | Syntax | Add `codemode` to `builtin-tools` and exact names under `mcp-servers`. | Reuses the model-callable tool vocabulary while keeping dynamic servers separate. | Confirmed discovery D01 | Pi changes these public names. |
| D02 | Harnesses | Support flat Pi profiles only. | Avoids false capability contracts for AGY/Claude and cross-target model-chain ownership. | Confirmed discovery D02 | A separate harness/chain design is requested. |
| D03 | Baseline | Require Pi 1.0+. | Uses stable public MCP/codemode APIs without a multi-version feature gate. | Confirmed discovery D03 | A concrete older-Pi obligation appears. |
| D04 | Assurance | Apply high-assurance isolation, compatibility, and replay evidence. | Credentials and external process/network authority are in scope. | Confirmed discovery D04 | Scope is explicitly reduced. |
| D05 | Granularity | Grant complete configured servers, not individual tools. | Requested 80/20 boundary and native exposure remains authoritative. | Confirmed discovery D05 | Per-tool least privilege is requested. |
| D06 | Support tools | MCP grants load codemode and tool search automatically by exposure. | Prevents fragile profile coupling to discovery implementation details. | Confirmed discovery D06 | Pi exposure semantics change. |
| D07 | Runtime failure | Use Pi-native connection/auth diagnostics after valid config preflight. | Avoids brittle readiness policy. | Confirmed discovery D07 | Strict readiness becomes a product requirement. |
| D08 | Trusted extensions | Filter ambient files only; trusted extensions may add MCP servers. | Those extensions already possess arbitrary process authority. | Confirmed discovery D08 | Extensions become sandboxed. |
| D09 | Precedence | Trusted project MCP entries override global entries for every profile in the active context. | Gives repository-specific capability after explicit project trust. | Confirmed discovery D09 | Trust semantics change. |
| D10 | Resume identity | Pin source plus normalized digest and refuse drift. | Prevents silent authority changes without copying secrets. | Confirmed discovery D10 | Stable digesting proves infeasible. |
| D11 | Disabled entries | Reject selected `enabled: false` entries. | A valid profile must provide the access it declares. | Confirmed discovery D11 | Disabled declaration semantics change upstream. |
| D12 | Execution mode | Use two segments and three serial slices. | Canonical resolution must pass before runtime consumes it; process-level proof and durable docs depend on stable runtime behavior. | Approved To Spec preview | These dependencies collapse during implementation without losing diagnostic or recovery value. |

## Work breakdown

- [x] **T01 - Establish the Pi 1.0 capability domain**
  - Depends on: none
  - Scope: Update the declared/tested Pi baseline; implement profile syntax, harness exclusions, trust-aware global/project MCP selection, selected-entry validation, semantic normalization/digesting, canonical resolved references, and focused isolated tests.
  - Expected areas: `package.json`, lockfile, `pi-extension/subagents/agents.ts`, a package-owned MCP config module, `test/test.ts`
  - Acceptance: Canonical discovery produces one ordered non-secret MCP grant or an actionable fail-closed diagnostic without connecting servers or reading credentials; existing non-MCP profiles still resolve.
  - Verification: focused discovery/config tests, `npm test`, dependency-tree inspection, and segment reviews.

- [ ] **T02 - Implement and prove filtered runtime and replay**
  - Depends on: T01
  - Scope: Add snapshot v2, shared launch/resume preflight, explicit built-in support loading, protected filtered MCP control, activation/provenance corrections, Pi-native runtime behavior, non-model lifecycle evidence, user documentation, durable wiki updates, and whole-plan verification.
  - Expected areas: `pi-extension/subagents/index.ts`, `session.ts`, `subagent-protocol.ts`, `subagent-capability-activation.ts`, new MCP child control/config modules, tests and fixtures, `README.md`, `docs/agent-definitions.md`, relevant wiki pages, package metadata if final corrections require it
  - Acceptance: New and resumed Pi children expose only selected ambient servers with correct exposure and resources, refuse config drift, preserve trusted extension registrations and old snapshots, and ship documentation matching verified behavior.
  - Verification: focused runtime/snapshot tests, non-model Pi 1.0 MCP process fixtures, full unit and tmux surface regression, package dry run, documentation checks, spec validation, diff checks, and high-assurance reviews.

## Acceptance criteria

- A flat Pi profile can list `codemode` and exact `mcp-servers`; malformed syntax and every unsupported harness form produce field-specific diagnostics.
- Missing or empty new fields preserve the current deny-all behavior.
- Trusted project MCP entries override matching global entries; untrusted project config and runtime cwd overrides cannot broaden the grant.
- Missing, invalid, conflicting, malformed-source, or disabled selected entries prevent listing/spawn and never create a pane or connection.
- Selected config normalization is deterministic and sensitive to every semantic change, including ordered tool-exposure precedence, while JSON formatting changes do not alter the digest.
- Sidecars and diagnostics contain server identity/digests but no selected config bodies, resolved environment values, headers, OAuth tokens, provider credentials, or command output.
- Child commands retain `--no-extensions --no-builtin-tools`, explicitly load only required built-in support and package-owned controls, and never load ambient `builtin:mcp`.
- A standalone codemode profile has codemode active. MCP profiles have the configured discovery mechanism active and preserve direct, codemode, deferred, hidden, mixed per-tool, and resource exposure.
- An unselected ambient marker server is never started or contacted and contributes no name, description, instructions, tools, resources, or prompt section.
- A selected marker server starts, while connection/auth failures use ordinary Pi diagnostics rather than custom terminal failure.
- Trusted declared extensions may still register additional MCP servers, and selected ambient names cannot be silently replaced by later registrations.
- Version-2 snapshots round-trip exactly. Changed, missing, disabled, invalid, or source-mismatched selected config refuses resume before pane creation with fresh-spawn guidance.
- Existing valid version-1 and legacy strict snapshots remain readable and replay through unchanged capability paths.
- Pi 1.0 dependencies, published package contents, README, agent-definition reference, and durable wiki guidance agree with verified source.

## Testing decisions and seams

- Extend the current parser/discovery fixtures with isolated global and project `mcp.json` files. Assert trust, precedence, invalid-project tombstones, namespace collisions, disabled entries, no writes, and no command/environment resolution.
- Test normalization with semantically equivalent formatting/key-order variants and semantic changes, including reordered overlapping `toolExposure` patterns.
- Extend strict loadout tests with version 2 plus mixed/unknown/incomplete cases and unchanged version-1/legacy bytes.
- Exercise command construction through existing sandbox helpers and public spawn/resume preflight seams rather than exposing new production internals solely for tests.
- Extend the real Pi lifecycle fixture around capability activation to cover built-in source provenance, required support tools, MCP-control provenance exclusion, direct activation, and indirect/hidden preservation.
- Add a non-model local MCP fixture whose startup and requests write isolated markers. Start a Pi 1.0 RPC/SDK session without prompting a model and prove selected versus ambient connection, exposure, resources, and shutdown behavior.
- Keep configured-model `test/integration/subagent-lifecycle.test.ts` approval-gated. Do not infer model behavior from non-model checks, but do not spend model calls solely to prove server filtering or command construction.
- High-assurance reviews use the credible-harm blocker standard and may not expand the plan. After targeted corrections, rerun an affected gate at most twice before stopping for a user decision.

## Verification plan

- `node --test --test-name-pattern='subagent discovery|subagent loadout snapshot|profile capability activation|MCP' test/test.ts`
- `npm test`
- `node --test --test-concurrency=1 test/integration/mcp-capability.test.ts`
- In a controlled tmux session: `node --test test/integration/tmux-surface.test.ts`
- `npm ls @earendil-works/pi-coding-agent @earendil-works/pi-tui typebox`
- `npm pack --dry-run --json`, then inspect the allowlisted runtime/docs payload and exclusion of `spec/`, `wiki/`, tests, and repository instructions.
- Check changed Markdown relative links, fenced-code balance, and ASCII/plain-text consistency.
- `uv run spec/scripts/manage-spec-item.py --root . validate --item 261002-1653-add-mcp-and-codemode-profile-access`
- `git diff --check`
- Do not run `node --test --test-concurrency=1 test/integration/subagent-lifecycle.test.ts` without explicit approval for model use, time, and cost.

## Risks and blockers

- **Local schema drift:** Pi does not export its file-config validator from the package root. Mitigate with a documented Pi 1.0 shape validator, defense-in-depth `registerMcpServer()` validation in the child, focused compatibility tests, and a stop rather than permissive fallback on disagreement.
- **Ambient connection leakage:** Tool filters and hidden exposure occur too late. Mitigate by replacing ambient MCP loading and proving excluded marker servers never start or enter prompt metadata.
- **Exposure escalation:** Existing extension activation could declare indirect MCP tools directly. Mitigate with protected provenance-aware filtering and direct/codemode/deferred/hidden tests.
- **Secret duplication:** MCP configs may contain literal headers, env values, or OAuth client secrets. Mitigate by persisting only source identity and digest and by scanning snapshots/diagnostics for forbidden config content.
- **Resume privilege drift:** Same-name config may change command, URL, or exposure. Mitigate with exact source/digest preflight before pane creation and no fallback.
- **Project override ambiguity:** Invalid trusted-project entries could accidentally restore global authority. Mitigate with selected-name tombstones and explicit precedence tests.
- **Dependency/API migration:** Moving the development baseline from Pi 0.87 to 1.0 can reveal API changes outside MCP. Mitigate by updating the dependency set coherently, running the complete suite after the first slice, and stopping for scope decisions on unrelated breakage.
- **Trusted extension misconception:** An explicitly selected extension can bypass MCP registration controls. Mitigate through retained arbitrary-code semantics and clear documentation rather than a false sandbox claim.
- **External-process test cleanup:** Local MCP fixtures can leak child processes or markers. Mitigate with isolated temporary directories, bounded deadlines, idempotent teardown, and post-test process/marker assertions.

## Progress

- [x] Planning complete and confirmed.
- [x] T01 complete.
- [ ] T02 not started.
- [ ] Verification not run.

## Execution handoff

Execution mode is sliced. Start from [implementation/index.md](./implementation/index.md), execute only its `Current` packet, and preserve serial order.

Use PI Agent in a fresh session with this prompt:

```text
Read spec/active/261002-1653-add-mcp-and-codemode-profile-access/plan.md, item.yaml, implementation/index.md, and only the Current packet completely.
Implement only the Current slice while preserving Requirements, Out of scope, Decision Log, and Verification plan.
Record attempts and evidence in the Current packet and update only the matching index checkbox/Current pointer after its required checks and reviews pass.
Stop and ask before dependency or lockfile changes, migrations, destructive operations, external writes, commits, pushes, publishing, production actions, model-consuming tests, or scope expansion.
```

## Proposed durable knowledge updates

After implementation and verification establish current behavior:

- Update `wiki/conventions/agent-profiles.md` with Pi 1.0 syntax, MCP selection, trust/override rules, complete-server grants, and unsupported harnesses.
- Update `wiki/conventions/runtime-safety.md` with filtered pre-connection loading, credential boundaries, exposure preservation, trusted-extension caveats, and digest-pinned replay.
- Update `wiki/architecture.md` and `wiki/map.md` if the final package adds durable MCP config/control modules.
- Update `wiki/development.md` for the Pi 1.0 baseline and non-model MCP verification command.
- Update `wiki/log.md` and `wiki/state.md` only as required by wiki maintenance instructions for the verified knowledge change.

## Notes

- The discovery dossier and research remain supporting evidence. This plan is the sole implementation contract.
- The approved sliced decomposition contains two coherent segments and three serial implementation sessions.
- No implementation was performed during planning.
