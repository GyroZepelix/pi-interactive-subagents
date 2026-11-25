# Verification: Optional and required MCP servers in agent profiles

Work item: `261125-1133-optional-and-required-mcp-servers-in-agent-profiles`
Date: 2026-11-25

## Environment

- Mode: direct (T01-T03). Assurance: medium, inherited from `plan.md`.
- Starting `HEAD`: `96095877aea6abd01a91475df46c30cb300930d6`. All implementation changes are unstaged edits to tracked files. `spec/index.md` and this item directory are workflow-owned.
- Node v26.13.0 with native type stripping. The repository has no `tsc` type-check.
- Tests ran with every `PI_*` variable unset. The parent subagent environment exports `PI_SUBAGENT_ALLOWED` and related variables. When they leak in, unrelated spawn and list tests fail with `agent not in allowlist`, so they were removed from the test environment.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| `npm test` (clean `PI_*` env), after the T01 source change and before the test updates | 331/333; only the two planned fail-closed tests failed | Expected: missing and disabled entries became optional |
| `npm test` (clean `PI_*` env), final | PASS 337/337 | 4 new tests; 2 fail-closed tests rewritten to `required: true` |
| `node --test --test-concurrency=1 test/integration/mcp-capability.test.ts` (clean env), final | PASS 4/4 | Regression check; the resolver default stays fail-closed |
| `git diff --check` | PASS | No whitespace errors |
| `rg -n "mcp-servers\|required" docs/agent-definitions.md README.md skills/subagent-profiles/SKILL.md wiki/conventions/agent-profiles.md` plus a manual read | PASS | All four surfaces describe the optional default, the `{ name, required }` form, the two skip conditions, the errors that stay fatal, and the list note |
| ASCII and fence check on changed Markdown | PASS | No new non-ASCII; fence counts are even |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R1 Syntax | `mcpServerList` in `agents.ts`; test "parses optional and required MCP entries with strict mappings and duplicate rules" (mixed arrays, flow and block mappings, unsupported key, non-boolean `required`, missing, non-string, and invalid names, non-string and non-mapping entries, commas, null, top-level mapping) | Met |
| R2 Defaults | Comma strings and plain entries yield `requiredMcpServers: []`; empty and missing values grant nothing (same test and the existing grant test) | Met |
| R3 Duplicates | Same required-ness collapses in first-occurrence order; a conflict produces `conflicting required values` | Met |
| R4 Optional skip | `resolveMcpServerReferences` `optional` option and `skippedOptional`; tests cover the ambient missing and disabled cases, the project tombstone (`shadowed-optional`), and the registry tombstone and missing cases (`disabled-optional`, `missing-optional`). References are empty, so there is no fall-through | Met |
| R5 Still fatal | Tests: invalid project override and malformed project source exclude `shadowed-optional`; optional `collision` and `auth` and the project profile with a broken registry stay excluded | Met |
| R6 Required | Rewritten fail-closed tests use `required: true` and keep the `disabled` and `not configured` diagnostics | Met |
| R7 Support tools | `optional-mix` grants only `directOnly` (direct exposure), and `mcpSupportTools` is `[]` even with a skipped deferred/disabled entry | Met |
| R8 Reporting | `mcpServersUnavailable` on `AgentDefinition`; `unavailableMcpSuffix` is used in `subagents_list` `content` and in `renderResult` (dim). Test "notes unavailable optional MCP servers in list content and rendered output" checks the affected and unaffected lines in both channels | Met |
| R9 Harness restrictions | Rejection test extended with mapping forms for Claude, AGY, and model-chain | Met |
| R10 Docs | `docs/agent-definitions.md` (field table, list-field note, registry paragraph, new "Optional and required MCP servers" subsection, resolution paragraph), README "Codemode and MCP server grants", `skills/subagent-profiles/SKILL.md`, `wiki/conventions/agent-profiles.md`, `wiki/log.md` | Met |

## Review findings

- Contract-quality review (one gate; medium assurance, direct): PASS with no blockers and 0 retries.
- Non-blocking, applied as a trivial in-scope fix: the model-chain `AgentDefinition` built in `resolveCompleteAgentExtensions` now sets `mcpServersUnavailable: []`. The full unit and MCP integration checks were rerun after the fix and passed (337/337 and 4/4).
- Non-blocking, not applied: optional parser cases for required-before-optional conflict order and a boolean array element. Both paths go through branches that are already covered.

## Failures and skipped checks

- `test/integration/subagent-lifecycle.test.ts` was not run because it invokes configured models and needs explicit approval.
- `test/integration/tmux-surface.test.ts` was not run. It is unaffected by this change, and it competes with live tmux panes.
- The optional manual `subagents_list` check with a temporary global profile was not run. Unit coverage through the registered tool's `execute` and `renderResult` is the primary evidence.

## Unverified areas

- No static type-check exists. The new required `AgentDefinition.mcpServersUnavailable` field is set on every discovery path, and list rendering coalesces with `?? []` for hand-built test literals.
