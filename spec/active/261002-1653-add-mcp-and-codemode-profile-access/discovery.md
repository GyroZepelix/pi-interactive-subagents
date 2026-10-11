# Discovery: Add MCP and codemode profile access

Work item: `261002-1653-add-mcp-and-codemode-profile-access`
Status: Ready for Spec
Created: 2026-10-02
Updated: 2026-11-16

## Objective

Design a fail-closed extension update that lets a restricted Pi subagent profile explicitly enable `codemode` and grant access to an exact allowlist of configured MCP server names without granting every ambient MCP server.

## Desired outcome

A user can add `codemode` to a profile's existing `builtin-tools` and can declare an exact `mcp-servers` list. A child receives only the selected MCP servers and the codemode or tool-search support required by their configured Pi exposure. Existing profiles retain their current authority.

## Assurance

Assurance: high - the change expands a child capability boundary to external processes or network services, may use stored credentials, and must preserve fail-closed resume behavior without exposing unselected servers.

## Repository and domain context

- Restricted Pi children currently launch with `--no-extensions --no-builtin-tools`, then load package-owned controls and explicitly selected package extensions.
- Profile discovery, package extension resolution, launch preparation, and resume snapshots already use a strict trust-aware, default-deny contract.
- Pi 1.0 supplies codemode, tool search, and MCP as built-in extensions. Codemode and tool search register inactive tools; MCP dynamically registers server tools and activates the discovery mechanism required by each server's exposure.
- Pi's built-in MCP extension normally reads global `<agent-dir>/mcp.json` and trusted-project `.pi/mcp.json`; loading it unchanged would expose ambient servers beyond a profile allowlist.

## Scope

- Flat `cli: pi` profiles.
- Profile syntax for explicit codemode access and exact MCP server-name allowlists.
- Trusted global/project MCP configuration resolution and server isolation.
- Child launch, activation ordering, strict snapshot persistence, and safe resume.
- Unit and non-model integration coverage against Pi 1.0 or newer.
- User documentation and durable wiki updates after verified implementation.

## Out of scope

- Per-tool filtering within an allowed MCP server.
- Claude, AGY, or `model-chain` capability support.
- Installing MCP servers, changing user/project MCP configuration, or managing sign-in automatically.
- Wildcard server grants or an implicit grant of every configured server.
- Changes to Pi core or to third-party MCP servers.
- Implementation, dependencies, migrations, commits, pushes, or model-consuming tests during discovery.

## Confirmed facts and evidence

- Fact: Pi 1.0 distinguishes ordinary built-in tools from the built-in `codemode`, `tool-search`, and `mcp` extensions. `--no-extensions` disables all three; explicit `-e builtin:<name>` can reload one.
- Fact: Pi's MCP extension connects every enabled server returned by its configuration loader and includes indirect servers in an `mcp_servers` prompt section. Hiding tools after connection would not prevent server startup or metadata exposure.
- Fact: `ExtensionAPI.unregisterMcpServer()` removes only a server registered by that extension. It cannot remove file-configured servers.
- Fact: `PI_CODING_AGENT_DIR` controls settings, model/provider auth, MCP config, MCP OAuth storage defaults, and other user resources together. Pointing it at a minimal MCP-only directory would also change unrelated child configuration.
- Fact: Pi exports `createMcpExtension(options)` with a custom `loadConfig` seam. A package-owned replacement MCP controller can use it to omit unselected file-configured servers before connection while preserving the normal credential stores and provider-token integration.
- Fact: `createMcpExtension` also connects servers registered programmatically by other loaded extensions. Profile-declared extensions are already trusted arbitrary code and can bypass tool-level boundaries directly.
- Fact: the current versioned loadout stores an exact capability mode, selected built-ins, canonical extension paths, cwd, agent directory, and nesting state. Resume does not reread the profile.
- Fact: current source accepts only `read`, `write`, `edit`, `bash`, `powershell`, `grep`, `find`, and `ls` in `builtin-tools`; the trailing activation control excludes tools whose source is `builtin` unless selected by the validated built-in list.

## Constraints and invariants

- Missing or empty capability fields must remain deny-all for the new capabilities.
- An unselected MCP server must not connect, register tools or resources, contribute prompt metadata, or become reachable through codemode or tool search.
- The profile's MCP grant must be based on trusted configuration and must not be broadened by a runtime cwd override or ambient child discovery.
- Allowed servers retain their configured server-level and per-tool Pi exposure. This feature grants servers, not individual tools.
- Framework controls remain protected by load order, and existing package extensions keep their complete trusted-extension semantics.
- Resume must replay a validated stored grant and fail closed when required source configuration is unavailable or malformed.
- MCP config values or credentials must not be copied into session sidecars when stable source references can avoid secret duplication.
- Existing valid snapshots and profiles must remain structurally readable or receive an explicit compatible migration path under the Pi 1.0 baseline.

## Domain language

- **Codemode grant:** permission for the child model to invoke Pi's `codemode` tool, including its documented classifier and image-model operations.
- **MCP server grant:** permission to connect one exact configured MCP server and expose all tools/resources allowed by that server's Pi exposure configuration.
- **Ambient MCP server:** a server present in global or project MCP configuration but not named by the profile.
- **Support tool:** `codemode` or `tool_search`, loaded and activated as needed to reach an allowed server's configured exposure.

## Decision tree

1. Profile contract and supported harnesses.
2. Pi compatibility baseline and security assurance.
3. Supported filtering seam that prevents ambient server connection.
4. Trusted source resolution and project/global precedence.
5. Snapshot identity, config drift, and resume behavior.
6. Runtime connection/authentication failures and acceptance evidence.

## Confirmed decisions

| ID | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- |
| D01 | Accept `codemode` in the existing `builtin-tools` list and add `mcp-servers` as an exact server-name list. | Keeps the profile ergonomic while separating dynamic server grants from ordinary tool names. | User decision, round 1 | Pi changes the public names or a broader built-in-extension vocabulary is requested. |
| D02 | Limit the initial feature to flat `cli: pi` profiles. | Avoids weakening AGY/Claude boundaries or complicating ordered model-chain capability ownership. | User decision, round 1 | A separate chain or external-harness design is requested. |
| D03 | Require Pi 1.0 or newer for the extension update. | Uses the stable exported codemode/MCP APIs and avoids a feature-gated multi-version implementation. | User decision, round 1; installed Pi 1.0 API | A concrete older-Pi compatibility obligation appears. |
| D04 | Use high assurance. | MCP grants can start processes or network connections with stored credentials and must remain isolated across resume. | User decision, round 1 | The scope is reduced to a non-security-sensitive prototype. |
| D05 | Keep MCP authorization at server granularity, not per tool. | This is the requested 80/20 boundary and preserves each allowed server's configured Pi exposure. | User request | Per-tool least privilege becomes a concrete requirement. |
| D06 | A non-empty `mcp-servers` automatically loads codemode and tool-search support; Pi activates the mechanism required by each allowed server's configured exposure. | Makes an MCP server grant usable without exposing support-tool implementation details in every profile. | User decision, round 2 | Pi changes MCP exposure or activation semantics. |
| D07 | A valid configured server that fails connection or authentication does not prevent child startup; Pi's normal diagnostics and retry/reconnect behavior apply. | Preserves Pi's asynchronous MCP lifecycle and avoids brittle custom readiness semantics. | User decision, round 2 | A concrete task class requires strict startup readiness. |
| D08 | `mcp-servers` filters ambient global/project configuration only. Explicitly declared profile extensions retain their existing arbitrary-code grant and may register additional MCP servers. | Filtering one registration API would not sandbox trusted extension code, which can already perform direct process or network I/O. | User decision, clarified round 2 | Profile extensions become sandboxed capabilities rather than trusted code. |
| D09 | Resolve allowed names from the active trusted spawn context's merged MCP config: project entries override global entries for every profile. A runtime child `cwd` override does not change the resolved grant. | Gives agents the repository-specific MCP endpoint when the parent has trusted that project while preventing task-time cwd overrides from selecting new capability sources. | User decision, clarified round 2 | Project trust or runtime-cwd capability semantics change. |
| D10 | Pin each selected server's exact source entry and normalized configuration digest. Resume refuses missing or changed entries and directs the user to spawn fresh. | Preserves capability identity without copying literal config values or credentials into session artifacts. | User decision, clarified round 2 | Credential/config storage semantics make stable digesting impractical. |
| D11 | A profile naming an effective MCP entry with `enabled: false` is invalid with an actionable diagnostic. | The profile promises access that the explicit configuration disables; rejecting before pane creation is clearer than silently launching without it. | User decision, round 3 | Pi introduces a separate non-connecting declaration mode required by profiles. |

## Rejected alternatives

- Separate `builtin-extensions` or one-off `codemode: true` syntax: rejected in favor of adding the model-callable `codemode` capability to the existing tool list.
- Loading Pi's ambient built-in MCP extension and blocking unallowed tool calls afterward: it would still connect unallowed servers and expose server metadata.
- Pointing the whole child at a minimal alternate `PI_CODING_AGENT_DIR`: it would also replace model, auth, settings, and resource configuration.
- Initial support for Claude, AGY, or model chains: rejected as unnecessary cross-harness expansion.
- Strict filtering of MCP servers registered by declared profile extensions: rejected because those extensions are already arbitrary trusted code.
- Profile-source-scoped MCP resolution: rejected in favor of the active trusted project's normal override of global MCP names.
- Accepting changed source configuration during resume: rejected in favor of digest-pinned capability identity.

## Proposed architecture

- Extend flat Pi profile parsing so `builtin-tools` accepts `codemode` and a new `mcp-servers` string list accepts exact Pi server names. Omitted or empty remains deny-all; duplicate list entries follow existing normalization.
- During canonical discovery, read global MCP configuration and, only for the active trusted project, its project MCP configuration. Project entries override global entries for all profiles. An invalid or disabled selected project entry blocks fallback rather than silently restoring the global entry. Runtime `cwd` overrides do not rerun capability resolution.
- Validate only selected entries plus conflicts affecting their normalized namespaces. Do not resolve environment or command substitutions during discovery. Missing, malformed, conflicting, or disabled selections exclude the profile before pane creation with file-and-field diagnostics.
- Normalize each selected config and calculate a SHA-256 digest. A new strict loadout version stores ordered `{ name, canonical source path, source scope, digest }` references plus the codemode grant and existing capability state. It does not store server config values or credentials. Existing version-1 and legacy strict loadouts remain readable on their unchanged paths.
- Add a protected package-owned filtered MCP control. New and resumed launches verify each exact source entry and digest before model execution, register only those configs through Pi's public API, and run `createMcpExtension` with ambient file loading disabled. Pi's normal agent directory remains in use for settings, provider credentials, MCP OAuth credentials, and logs.
- Explicitly load `builtin:codemode` for a standalone codemode grant. For MCP grants, explicitly load both `builtin:codemode` and `builtin:tool-search`; the private capability state keeps the support tool required by configured exposure active after the trailing activation checkpoint.
- Load the filtered MCP control before declared profile extensions so selected names are reserved. Later MCP registrations by those trusted extensions remain permitted under D08.
- Exclude MCP-control-owned indirect tools from the existing blanket profile-extension activation path. Preserve Pi exposure: direct tools self-activate, codemode/deferred tools remain indirect, hidden tools remain unreachable, and resource tools see only allowed servers.
- Keep connection and authentication handling inside Pi. Configuration identity errors fail before the pane or model turn; network/auth readiness errors use Pi's normal diagnostics after launch.

## Open questions and prerequisites

No consequential design question remains. Non-blocking implementation detail: choose one deterministic normalized-JSON digest routine while preserving the confirmed no-secret-copy contract.

## Current frontier

Discovery is complete and confirmed. The next action is `/skill:to-spec 261002-1653-add-mcp-and-codemode-profile-access`.

## Research index

- [Research index](./research/index.md)
- [Upstream Pi MCP and codemode seams](./research/upstream-pi-mcp.md): complete filtered-loading, credential, activation, and isolation findings.

## Proposed test seams and acceptance evidence

- Strict profile parser tests for `codemode`, `mcp-servers`, unsupported harnesses, malformed names, duplicates, and deny-all defaults.
- Isolated global/project MCP config fixtures proving trust, precedence, exact-name resolution, and no settings writes.
- Pi 1.0 lifecycle probes proving only allowlisted servers register/connect and ambient servers contribute no tools, resources, or prompt section.
- Command-construction and load-order tests for explicit built-in support extensions and package-owned filtered MCP control.
- Strict loadout union tests for new capability state, malformed snapshots, missing sources, unchanged legacy reads, and launch/resume parity.
- Non-model MCP fixture servers for direct, codemode, deferred, resources, failure, and dynamic registration behavior where practical.
- Existing unit, package dry-run, Markdown, spec validation, and diff checks.
- Model-consuming lifecycle validation remains separately approval-gated.

## Proposed wiki updates after implementation

- Update `wiki/conventions/agent-profiles.md` with codemode and MCP server-grant syntax and trust behavior.
- Update `wiki/conventions/runtime-safety.md` with filtered MCP loading, support-tool activation, credential boundaries, and resume invariants.
- Update architecture/map pages only if implementation adds a durable package-owned MCP control module.

## Resume state

Round 1 confirmed syntax, flat-Pi scope, Pi 1.0 minimum, and high assurance. Upstream research confirmed a package-owned filtered MCP replacement as the supported CLI-child architecture. Round 2 confirmed exposure-driven support tools, Pi-native runtime failures, ambient-only filtering alongside trusted extensions, trusted-project override semantics, and digest-pinned resume identity. Round 3 confirmed disabled selected entries invalidate the profile. The user confirmed the complete shared-understanding synthesis. No implementation source was changed.

Exact next action: run `/skill:to-spec 261002-1653-add-mcp-and-codemode-profile-access` to produce the canonical implementation plan.

## Readiness for To Spec

- [x] Every consequential branch is resolved or explicitly out of scope.
- [x] Facts are distinguished from user decisions and hypotheses.
- [x] Requirements, constraints, and non-goals are clear.
- [x] Acceptance evidence and proposed test seams are defined.
- [x] The user confirmed shared understanding.
