# Plan: Repair agent profile drift and remove obsolete safe-bash

Work item: `260910-2235-repair-agent-profile-drift-and-remove-obsolete-safe-bash`
Status: Planned
Created: 2026-09-10
Updated: 2026-09-11
Assurance: medium - the change is reversible and uses the established profile parser, but it affects repository reference profiles, model-consuming lifecycle fixtures, and published package contents.

## Goal

Bring repository-owned agent examples and lifecycle fixtures onto the current `builtin-tools` and package `extensions` contract, prevent future schema drift with a model-free regression, and remove the obsolete `safe_bash` extension and its stale current-state documentation.

## Context

The current parser rejects legacy `tools` frontmatter and excludes the complete profile (`pi-extension/subagents/agents.ts`). All four files under `test/integration/agents/` and all three files under `agent-examples/` still use that removed field. The lifecycle suite is cost-bearing and separately gated, so this incompatibility was not caught by `npm test`.

`pi-extension/subagents/tools/safe-bash.ts` documents an activation route through removed custom-tool mappings. Repository inspection found no production import or current schema route for it. It remains included in package dry-run output only because `package.json` publishes the complete `pi-extension/` tree. Current wiki pages still describe it as available behavior.

The earlier global-profile work item is completed under `spec/archive/260909-1928-create-global-scout-researcher-and-worker-profiles/`. During planning, an external user-controlled checkpoint advanced `HEAD` from the reviewed `b085758` state to `dad0807` and committed that archival work. Creating this item through the spec helper added the new Active entry while preserving the completed item under Archive.

## Requirements

- R01: Replace only `agent-examples/scout.md`, `agent-examples/researcher.md`, and `agent-examples/worker.md` with the complete same-named profile contents from the read-only resolved global directory `~/.pi/agent/agents/`. Do not add flash-reviewer or twin examples.
- R02: Before copying, confirm the global files still match the observed native contract: scout uses `cursor/gemini-3.8-flash`, read-only built-ins, and the safe Cursor provider; researcher uses `openai-codex/gpt-5.6-sol`, no built-ins, and the configured web and Codex extensions; worker uses `cursor/cursor-grok-4.6-fast`, coding built-ins, the three configured extensions, and bounded nested agents. Stop for direction if those capability or model contracts changed materially.
- R03: Replace `tools` with equivalent `builtin-tools` in all four `test/integration/agents/*.md` fixtures. Preserve each fixture's model, session mode, system-prompt behavior, auto-exit behavior, visibility, body, and intended built-in grants, including the explicit empty grant for `test-ping`.
- R04: Add a model-free regression in `test/test.ts` that enumerates every Markdown profile in `agent-examples/` and `test/integration/agents/`, parses each through the production `parseAgentDefinition`, and fails with file-specific diagnostics if any profile violates the current frontmatter schema. The test must not resolve packages, launch tmux, or invoke a model.
- R05: Confirm with repository-wide reference inspection that `pi-extension/subagents/tools/safe-bash.ts` has no live import, activation, or package-specific compatibility obligation, then delete that exact file. The deletion is approved only after this check; any other deletion requires approval.
- R06: Remove or generalize stale current-code comments and synthetic test data that name `safe_bash` while preserving legacy arbitrary-custom-tool snapshot coverage. Do not weaken valid legacy loadout compatibility.
- R07: Update current-state wiki guidance to remove `safe_bash` as an available module or shell boundary and accurately describe the remaining runtime. Follow wiki maintenance rules for `wiki/log.md`; update `wiki/state.md` only if its checkpoint or processed-input contract requires it.
- R08: Preserve the existing archived global-profile work, all unrelated staged and unstaged changes, global profiles, Pi settings, and third-party package state.

## Out of scope

- Redesigning package-extension trust, adding per-tool extension sandboxing, changing capability activation, or restoring `safe_bash` through a new schema.
- Adding CI, changing when model-consuming integration tests run, or removing their explicit approval gate.
- Adding agent examples beyond the existing scout, researcher, and worker files.
- Dependencies, package installation, migrations, global profile or settings writes, commits, pushes, publishing, and unrelated cleanup.

## Assumptions

- The user's path refers to the configured `~/.pi/agent/agents/` symlink; the supplied `~/.pi/agents/agent/` spelling does not exist.
- Repository examples are synchronized snapshots of the selected user-managed profiles. Their configured package sources remain environment-specific and may require matching Pi settings when copied elsewhere.
- Historical references in archived specs remain valid evidence and must not be rewritten merely to produce a repository-wide zero-match search.
- Model-consuming lifecycle execution is not approved by this plan. It may run only after separate explicit approval for cost, time, and external calls.

## Design

Use the production parser itself as the drift boundary. A single unit test reads both repository-owned profile directories and reports each invalid filename with the parser diagnostics. This gives `npm test` coverage for syntax and accepted fields without duplicating parser rules or incurring model cost. Package resolution remains outside this test because example extension sources intentionally depend on user configuration.

The fixture capability mapping is direct:

| Fixture | Current legacy value | Required value |
| --- | --- | --- |
| `test-echo.md` | `tools: [read, bash, write, edit]` | `builtin-tools: [read, bash, write, edit]` |
| `test-fork.md` | `tools: [bash]` | `builtin-tools: [bash]` |
| `test-ping.md` | `tools: []` | `builtin-tools: []` |
| `test-system-prompt.md` | `tools: [bash]` | `builtin-tools: [bash]` |

Delete the obsolete implementation only after a scoped search confirms the former activation mechanism is absent. Replace incidental `safe_bash` names in current comments and generic legacy-snapshot test fixtures with neutral custom-tool terminology, then remove current-state wiki references. Archived specs are historical and stay unchanged.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D01 | Example source | Synchronize the three existing examples from the same-named global profiles | The user selected those verified profiles rather than generic placeholders or reduced capabilities | User confirmation; read-only inspection of `~/.pi/agent/agents/{scout,researcher,worker}.md` | A source profile changes materially before copying |
| D02 | Drift prevention | Parse all examples and lifecycle fixtures in the ordinary unit suite | It catches schema drift without model calls or duplicated validation logic | `parseAgentDefinition`; gated lifecycle test design | Profile validation moves behind a different public seam |
| D03 | Obsolete shell tool | Delete `safe-bash.ts` after proving no live route remains | Its documented custom-tool mapping was removed and the current schema cannot request it | Current source and reference search; archived profile-extension outcome | A live indirect reference or compatibility obligation is found |
| D04 | Assurance | Use medium assurance without requiring paid lifecycle execution | Public/reference profiles and package contents change, but the patch is reversible and model-free parser evidence directly covers the defect | User confirmation; repository verification tiers | Implementation exposes a runtime capability change or broader compatibility impact |

## Work breakdown

- [x] T01: Migrate and guard repository-owned profiles
  - Depends on: none
  - Scope: Recheck the three global source profiles read-only; replace the three existing examples; migrate all four lifecycle fixtures; add the production-parser regression over both profile directories.
  - Expected areas: `agent-examples/{scout,researcher,worker}.md`, `test/integration/agents/*.md`, `test/test.ts`
  - Acceptance: Every repository example and lifecycle fixture parses without diagnostics; fixture capabilities and lifecycle semantics are unchanged; only the three approved examples are synchronized.
  - Verification: focused parser test, scoped frontmatter search, and complete profile reads.

- [x] T02: Remove obsolete safe-bash behavior and synchronize durable guidance
  - Depends on: T01
  - Scope: Prove the absence of a live activation route; delete only `pi-extension/subagents/tools/safe-bash.ts`; generalize stale current-code comments and synthetic test names; update affected wiki pages and maintenance log.
  - Expected areas: `pi-extension/subagents/tools/safe-bash.ts`, `pi-extension/subagents/index.ts`, `test/test.ts`, `wiki/map.md`, `wiki/architecture.md`, `wiki/conventions/{index,runtime-safety,typescript-modules}.md`, `wiki/log.md`, and `wiki/state.md` only if required
  - Acceptance: The package has no current `safe_bash` implementation or current-state claim, legacy custom-extension snapshot behavior remains covered, and archived historical evidence is untouched.
  - Verification: scoped reference search, `npm test`, package dry-run file inspection, wiki path/link/fence checks.

- [x] T03: Complete medium-assurance repository verification
  - Depends on: T01, T02
  - Scope: Run focused and broad model-free checks, validate spec state, inspect changed scope, and record the model-consuming suite as skipped unless separately approved.
  - Expected areas: no implementation changes unless a check exposes an in-scope defect
  - Acceptance: All required model-free checks pass, package contents exclude the deleted module and repository-only examples, the completed global-profile item remains archived, and unrelated work remains intact.
  - Verification: commands in the Verification plan.

## Acceptance criteria

- No profile under `agent-examples/` or `test/integration/agents/` contains a legacy top-level `tools` field, and every file passes the production parser in `npm test`.
- The four lifecycle fixtures retain their exact intended built-in grants and profile-defined lifecycle behavior.
- The three existing examples match the confirmed same-named global profiles; no additional examples or external files are written.
- `pi-extension/subagents/tools/safe-bash.ts` is absent only after reference inspection confirms no live activation path.
- Current source, tests, and wiki contain no stale claim that `safe_bash` is available, while legacy snapshot compatibility remains tested with neutral custom-tool data.
- Package dry-run output excludes the deleted module and continues to exclude `agent-examples/`, tests, specs, wiki, and repository instructions.
- The global-profile item remains completed under `spec/archive/`, this item remains the only active planned item, and all spec artifacts validate.

## Testing decisions and seams

The production parser is the focused seam because the defect occurs before discovery or model invocation. The new test should derive filenames from both directories instead of maintaining another hardcoded list, so newly added profiles receive the same check. It should assert parser success and include diagnostics in assertion output, but should not consult real global settings or resolve environment-specific package declarations.

`npm test` provides the broader affected-component regression, including strict legacy snapshot handling. Package dry-run confirms deletion from the published tree. The model-consuming lifecycle suite would provide additional behavioral confidence but is not required to prove schema acceptance and remains separately gated.

## Verification plan

1. Run the focused profile regression by its final test name, for example:
   - `node --test --test-name-pattern='repository agent profiles use the current schema' test/test.ts`
2. Confirm legacy frontmatter is gone:
   - `rg -n '^\s*tools:' test/integration/agents agent-examples` must return no matches.
3. Confirm the deleted behavior has no current references after allowing archived historical evidence to remain:
   - `rg -n 'safe[_-]bash|safe bash' pi-extension test agent-examples README.md docs wiki` must return no stale matches.
4. Run the complete model-free unit suite:
   - `npm test`
5. Inspect package contents:
   - `npm pack --dry-run --json`
   - Confirm no `pi-extension/subagents/tools/safe-bash.ts` entry and no `agent-examples/`, `test/`, `spec/`, `wiki/`, or `AGENTS.md` entries.
6. Validate changed Markdown paths, relative links, fenced-code balance, and ASCII/plain-text consistency where applicable.
7. Validate planning state and patch integrity:
   - `uv run spec/scripts/manage-spec-item.py --root . validate --item "260910-2235-repair-agent-profile-drift-and-remove-obsolete-safe-bash"`
   - `uv run spec/scripts/manage-spec-item.py --root . validate --all`
   - `git diff --check`
8. Inspect `git status --short` and scoped diffs to confirm no global files, settings, archived evidence, or unrelated user changes were modified.
9. Do not run `node --test --test-concurrency=1 test/integration/subagent-lifecycle.test.ts` or `npm run test:integration` without separate explicit approval. If not approved, record the skip and residual uncertainty honestly.

## Risks and blockers

- The global profiles are external mutable sources. Compare them with the R02 contract immediately before copying and stop rather than silently importing a materially different capability set.
- The copied examples contain environment-specific models and package selectors. Keep this explicit; schema validity does not guarantee package availability in another user's settings.
- `safe_bash` strings in legacy snapshot tests can look like live dependencies. Preserve the behavior under neutral custom-tool names and use import/activation searches, not name matching alone, before deletion.
- The repository `HEAD` advanced externally during planning to commit the global-profile archival work. Treat `dad0807` as the implementation baseline and do not alter that completed archive except through a separately approved correction.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete.
- [x] Verification complete; model-consuming integration tests were not run because their separate approval gate remains closed.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read this plan, item.yaml, and applicable repository instructions completely. Implement the smallest coherent change at the recorded medium assurance while preserving every requirement, exclusion, decision, and existing user change. Treat ~/.pi/agent/agents as read-only. The deletion of pi-extension/subagents/tools/safe-bash.ts is approved only after the plan's live-reference check; stop before any other deletion. Run the model-free verification plan and record verified evidence, failures, skipped checks, and residual uncertainty. Stop for dependencies, migrations, external writes, model-consuming tests, commits, pushes, publishing, destructive actions outside the approved file, or material scope expansion.
```

## Proposed durable knowledge updates

After source deletion is verified, remove obsolete `safe_bash` module and runtime claims from `wiki/map.md`, `wiki/architecture.md`, `wiki/conventions/index.md`, `wiki/conventions/runtime-safety.md`, and `wiki/conventions/typescript-modules.md`. Append the required source-grounded maintenance entry to `wiki/log.md`. Leave `wiki/state.md` unchanged unless the implemented update qualifies under its checkpoint or processed-input policy.
