# Implementation: Add MCP and codemode profile access

Plan: `../plan.md`
Mode: sliced
Assurance: high - external process/network authority, credentials, capability isolation, and persisted replay are in scope
Review tier: focused review per slice; separate Standards and Spec reviews at segment and final whole-plan gates
Current: `02.01`
Expected implementation sessions: 3
Implementation starting checkpoint: `75166866e769d501a8aaaf02dd851b3bebfae52c`

## Shared objective

Let flat Pi subagent profiles explicitly grant codemode and exact configured MCP server names while preventing unselected ambient servers from connecting or entering model context and preserving fail-closed resume.

## Shared constraints and non-goals

- Keep `--no-extensions --no-builtin-tools`; never load ambient `builtin:mcp` for restricted children.
- Persist only MCP source identity and digest, never config bodies or resolved credential values.
- Preserve Pi exposure and trusted profile-extension semantics.
- Preserve valid version-1 and legacy snapshot replay.
- Do not add per-tool filtering, wildcard grants, Claude/AGY/model-chain support, automatic sign-in/config writes, or Pi core changes.

## Shared decisions and invariants

- D01/D02: `codemode` belongs in `builtin-tools`; exact `mcp-servers` is flat-Pi-only.
- D06/D09: MCP support tools are automatic by exposure; the active trusted project overrides same-named global config, independent of runtime cwd overrides.
- D08: ambient file config is filtered, while explicitly selected extensions remain arbitrary trusted code.
- D10/D11: source plus normalized digest pins resume identity; disabled selected entries are invalid.
- Configuration identity failures stop before pane/model execution; connection and authentication failures remain Pi-native.

## Common approval gates

- Stop and ask before dependency or lockfile changes, migrations, destructive operations, external writes, commits, pushes, publishing, production actions, model-consuming tests, or scope expansion.
- Do not run the configured-model lifecycle suite without explicit approval for model use, time, and cost.

## Common checks

- `npm test`
- `git diff --check`

## Segment and slice order

### T01: Establish the Pi 1.0 capability domain

Depends on: none
Segment starting checkpoint: `75166866e769d501a8aaaf02dd851b3bebfae52c`
Segment acceptance: Pi 1.0 dependencies and canonical profile discovery produce deterministic, trusted, non-secret MCP server references or fail-closed diagnostics without connections or settings writes.
Segment gate: focused Current review plus separate Standards and Spec reviews over T01; all blockers resolved within the bounded retry policy.

- [x] 01.01: Add Pi 1.0 baseline and canonical MCP capability resolution (packet: `./01-01-capability-domain.md`)

Boundary 01.01 -> 02.01: runtime and persisted replay must consume one verified canonical server-reference format. Starting runtime work before dependency compatibility, trust precedence, validation, and digest behavior pass would duplicate security logic and obscure privilege failures.

### T02: Implement and prove filtered runtime and replay

Depends on: T01
Segment starting checkpoint: unrecorded
Segment acceptance: initial and resumed children expose only selected ambient servers with correct discovery/exposure, reject drift before pane creation, preserve old snapshots and trusted extension behavior, and ship verified documentation.
Segment gate: final slice focused review plus separate Standards and Spec reviews expanded across T02 and whole-plan acceptance.

- [ ] 02.01: Implement loadout v2, filtered child MCP, launch/resume, and exposure-safe activation (packet: `./02-01-runtime-and-replay.md`)

Boundary 02.01 -> 02.02: process-level marker fixtures and durable documentation depend on stable unit-tested launch/resume behavior. Keeping them separate preserves diagnostic attribution between runtime construction and external-process isolation while reducing interruption cost.

- [ ] 02.02: Prove non-model lifecycle isolation, document the contract, and complete whole-plan verification (packet: `./02-02-integration-docs-verification.md`)

## Discoveries and blockers

None recorded.
