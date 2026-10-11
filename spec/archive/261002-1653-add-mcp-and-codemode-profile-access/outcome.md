# Outcome: Add MCP and codemode profile access

Work item: `261002-1653-add-mcp-and-codemode-profile-access`
Disposition: completed
Date: 2026-10-11

## Delivered scope

- Flat Pi profiles can grant standalone `codemode` and exact configured MCP server names while Claude, AGY, and model-chain forms reject the new MCP field.
- Canonical trusted global/project discovery validates selected entries, preserves project override tombstones, derives semantic SHA-256 identity, and persists only non-secret source references.
- New strict version 2 `mcp-capabilities` loadouts share fail-closed launch/resume preflight, preserve version 1 and legacy replay, and refuse source/config drift before pane creation.
- Restricted children retain default-deny flags, load Pi support explicitly, replace ambient MCP discovery with a protected selected-only controller, preserve native exposure/resources, reserve selected names, and retain trusted extension behavior.
- Disposable non-model stdio/HTTP lifecycle fixtures prove selected-versus-ambient process isolation, mixed exposure, resources, prompt metadata, Pi-native failure diagnostics, credential-safe artifacts, and complete teardown.
- README, agent-definition reference, package output, and durable wiki guidance document the verified Pi 1.0+ contract.

## Deviations from plan

- No contract or scope deviations.
- The configured-model lifecycle suite was not run because the plan requires separate approval for model use, time, and cost; deterministic local non-model evidence covers the required isolation and runtime contract.
- Archive preflight initially found four canonical active-item prefixes in two immutable Dream checkpoints. Parent-authorized deterministic correction changed only those prefixes to the archive location; episode identity, catalog, ledger, and narrative remained byte-for-byte unchanged otherwise.

## Verification summary

- Focused whole-plan unit selection passed 98/98; full deterministic unit suite passed 266/266.
- Non-model MCP lifecycle passed 2/2; controlled detached-tmux surface passed 9/9.
- Pi/TUI 1.1.0 and TypeBox 1.3.27 dependency inspection, package allowlist inspection, Markdown checks, spec validation, fixture cleanup checks, and diff checks passed.
- High-assurance Focused and Standards reviews passed after one targeted retry each; the whole-plan Spec review passed initially with no blockers.
- Final non-mutating archive preflight passed for `spec/archive/261002-1653-add-mcp-and-codemode-profile-access`.

## Retained, reverted, or transferred work

- Retained all planned source, tests, documentation, wiki, sliced implementation, and verification evidence.
- No implementation was reverted or transferred to another item.
- No user MCP configuration, authentication state, credentials, dependencies beyond the approved Pi baseline, or external services were changed.

## Residual risks

- Live configured-model behavior and real external MCP/OAuth interoperability remain unverified by the explicit approval gate.
- Declared profile extensions remain trusted arbitrary code and can perform process/network I/O outside ambient MCP filtering, as documented.

## Follow-up work items

- None required for the accepted contract.
- A separately approved configured-model lifecycle run may be performed later if live provider evidence is desired.

## Source references

- [Plan](./plan.md)
- [Verification](./verification.md)
- [Implementation index](./implementation/index.md)
- [Final Current evidence](./implementation/02-02-integration-docs-verification.md)
- `pi-extension/subagents/agents.ts`, `mcp-config.ts`, `index.ts`, `session.ts`, `subagent-mcp-control.ts`, and `subagent-capability-activation.ts`
- `test/test.ts` and `test/integration/mcp-capability.test.ts`

## Wiki updates

- Updated `wiki/architecture.md`, `wiki/map.md`, `wiki/development.md`, `wiki/conventions/agent-profiles.md`, `wiki/conventions/runtime-safety.md`, and `wiki/log.md` with verified current behavior.
- Updated only the four archive-blocking path prefixes in the two named immutable Dream checkpoints; catalog and per-spec ledger content were unchanged.
