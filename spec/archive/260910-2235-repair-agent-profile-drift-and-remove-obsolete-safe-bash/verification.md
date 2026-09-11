# Verification: Repair agent profile drift and remove obsolete safe-bash

Work item: `260910-2235-repair-agent-profile-drift-and-remove-obsolete-safe-bash`
Date: 2026-09-11

## Environment

- Mode: direct
- Assurance: medium - repository examples, lifecycle fixtures, tests, durable runtime guidance, and published package contents changed.
- Starting and verification `HEAD`: `dad08077acb81da29f21423b3580535829ca0e88`
- Pre-existing boundary: `item.yaml`, the original planned `plan.md`, and `spec/index.md` were staged before implementation. They remained staged; implementation changes were not staged.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| Focused repository-profile parser test | Passed | `node --test --test-name-pattern='repository agent profiles use the current schema' test/test.ts`: 1 test, 0 failures. |
| Complete model-free unit suite | Passed | `npm test`: 199 tests, 37 suites, 0 failures. |
| Example synchronization | Passed | `cmp -s` confirmed each of `scout.md`, `researcher.md`, and `worker.md` exactly matches its read-only `~/.pi/agent/agents/` source; directory enumeration confirmed no added examples. |
| Retired frontmatter search | Passed | `rg -n '^\s*tools:' test/integration/agents agent-examples` returned no matches. |
| Obsolete module and route search | Passed | Scoped searches found no current import, activation mapping, package export, schema route, or stale source/test/current-guidance reference. Only the valid historical maintenance record in `wiki/log.md` remains. |
| Package dry-run assertions | Passed | `npm pack --dry-run --json` reported 17 files; the deleted module and repository-only `agent-examples/`, `test/`, `spec/`, `wiki/`, and `AGENTS.md` paths were absent. |
| Markdown checks | Passed | ASCII, fenced-code balance, and relative-link existence checks passed for 14 changed Markdown files. |
| Spec protocol | Passed | Item validation and `validate --all` both returned `valid: true`. |
| Diff integrity and scope | Passed | `git diff --check`, status inspection, scoped diff inspection, and archived-item inspection passed. |
| T01 focused review | Passed | Independent Focused reviewer returned PASS with no blocking or non-blocking findings. |
| T02 focused review | Passed | Independent Focused reviewer returned PASS with no blocking or non-blocking findings. |
| Final contract-quality review | Passed | Independent Contract-quality reviewer returned PASS with no blocking findings; it noted only the harmless untracked-by-Git empty tools directory. |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R01-R02 | Three example files exactly match the confirmed global source contracts; no flash-reviewer or twin example was added. | Passed |
| R03 | Four lifecycle fixtures use equivalent `builtin-tools` values and retain their model, session, prompt, visibility, auto-exit, and body behavior. | Passed |
| R04 | The ordinary unit suite dynamically parses every Markdown profile in both repository directories through `parseAgentDefinition` with file-specific diagnostics. | Passed |
| R05 | Reference inspection proved no live route or compatibility contract; only `pi-extension/subagents/tools/safe-bash.ts` was deleted. | Passed |
| R06 | Current comments and synthetic fixtures use neutral custom-tool terminology while strict legacy snapshot and `--tools` replay tests still pass. | Passed |
| R07 | Current-state wiki pages no longer claim `safe_bash` exists; `wiki/log.md` records the update and `wiki/state.md` remains unchanged under its policy. | Passed |
| R08 | Archived specs, global profiles/settings, dependencies, and third-party state were not modified; prior staging was preserved. | Passed |

## Review findings

- T01 focused review: PASS, no findings.
- T02 focused review: PASS, no findings.
- Final whole-change contract-quality review: PASS, no blocking findings.
- Non-blocking: `pi-extension/subagents/tools/` is now an empty filesystem directory. Git and package publication omit empty directories, so no correction is required.
- Review retries: 0.

## Failures and skipped checks

- One ancillary diff-summary command used a grep lookahead unsupported by the host grep implementation. It was immediately replaced with a POSIX-compatible expression, which produced the intended scoped diff. This was not an acceptance check.
- `node --test --test-concurrency=1 test/integration/subagent-lifecycle.test.ts` and `npm run test:integration` were not run because model-consuming integration remains explicitly approval-gated.

## Unverified areas

- End-to-end configured-model lifecycle behavior was not re-executed. Residual uncertainty is limited by the passing production-parser regression, lifecycle fixture inspection, legacy replay tests, complete unit suite, and independent reviews.
- Example package availability remains environment-specific and intentionally outside the parser-only regression.
