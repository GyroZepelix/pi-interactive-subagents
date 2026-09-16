# Verification: Stop child generation after ask_question

Work item: `260916-2339-stop-child-generation-after-ask-question`
Date: 2026-09-16

## Environment

- Mode: direct.
- Assurance: medium - local and reversible, but crosses child tool execution, parent watcher state, terminal reply delivery, abort cleanup, and same-run model continuation.
- Starting Git boundary: `6bf2019d54497a21f0c846227a15213fe4f8791b`.
- The starting tree contained only planned-item artifacts, including the superseded terminating-result attempt. Current artifacts and the complete relevant working-tree diff form the review boundary; no commit checkpoint was created.
- Pi coding-agent dependency: 0.85.1.
- Approved live model: `openai-codex/gpt-5.5`, selected from the local Pi model catalog and applied only through `PI_TEST_MODEL` plus the fixture's runtime model override.

## Changed paths

- Runtime: `pi-extension/subagents/question-protocol.ts`, `pi-extension/subagents/subagent-runtime-control.ts`, `pi-extension/subagents/index.ts`.
- Tests: `test/test.ts`, `test/integration/subagent-lifecycle.test.ts`, `test/integration/agents/test-ping.md`.
- User and durable guidance: `README.md`, `wiki/architecture.md`, `wiki/log.md`.
- Lifecycle evidence: `spec/index.md`, this item's `item.yaml`, `plan.md`, `refinements/R001.md`, and `verification.md`.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| `env -u PI_SUBAGENT_ALLOWED npm test` | PASS | 215 tests passed, including strict protocol parsing, pending tool behavior, input containment, abort cleanup, parent correlation, exact acknowledgment, timeout guard, and generic fallback. Re-run after the focused review correction. |
| `node --test test/integration/tmux-surface.test.ts` | PASS | 9 model-free tmux tests passed, including exact stdin-backed UTF-8 bracketed-paste delivery. |
| `npm pack --dry-run --json` | PASS | 18 package files; `pi-extension/subagents/question-protocol.ts` is included. Re-run after the focused review correction. |
| `uv run spec/scripts/manage-spec-item.py --root . validate --operational` | PASS | Seven items valid with no warnings before completion evidence was recorded. |
| Changed Markdown path/link/control/fence script | PASS | Eight changed Markdown files checked; relative links resolve, no invalid controls, and fences balance. |
| `git diff --check` | PASS | No whitespace errors; re-run after the focused review correction. |
| `PI_TEST_MODEL=openai-codex/gpt-5.5 node --test --test-concurrency=1 --test-name-pattern='subagent ask_question' test/integration/subagent-lifecycle.test.ts` | PASS | One approved cost-bearing lifecycle test passed, proving visible question delivery, answer through `subagent_message`, matching acknowledgment, same-run post-tool execution, and exactly-once completion marker. |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R1-R2 | `ask_question` installs one pending record and awaits its resolver; tests prove the promise remains unsettled until a matching envelope, and Pi cannot begin another provider request while the tool batch is unresolved. | PASS |
| R3 | UUID-v4 question IDs, strict versioned request parsing, atomic temp-file rename, and one-pending-question rejection are implemented and tested. | PASS |
| R4 | Parent routing encodes the recorded ID and exact answer in a non-command private JSON envelope and uses the existing `submitText` transport; multiline/slash-prefixed content round-trips in tests. | PASS |
| R5 | The protected child input handler contains every private envelope, returns `handled`, resolves only the current valid ID, and writes the acknowledgment before resolving. | PASS |
| R6 | Parent delivery requires the exact ID-only marker. Duplicate submissions are rejected, and timeout remains unconfirmed with no replay or termination. | PASS |
| R7 | Success, abort, shutdown, watcher reconciliation, and interruption cleanup are ID-matched; stale or mismatched inputs cannot settle another question. | PASS |
| R8 | Generic running-child steering retains its activity acknowledgment path; finished Pi resume, Claude handling, discovery, capability isolation, names, and tmux transport remain unchanged. | PASS |
| R9 | Unit and focused lifecycle coverage plus README and wiki guidance describe blocking same-run continuation and replace the superseded terminating-result behavior. | PASS |

## Review findings

- Focused review: PASS, zero blockers, retry count 0. One non-blocking unreachable statement in publication-failure cleanup was removed; affected unit, package, and patch checks were rerun.
- Final contract-quality review: PASS, zero blockers, retry count 0. It covered repository standards and the complete R001 contract; no residual uncertainty was reported.

## Failures and skipped checks

- The first approved lifecycle invocation without the requested GPT override ended with `Command aborted` at the provider/session level and produced no verdict. Recovery preserved all changes, selected `openai-codex/gpt-5.5` from `pi --list-models gpt-5.5`, and ran only the approved focused test, which passed.
- No broader paid lifecycle suite was run.

## Unverified areas

- None within the confirmed plan. Automatic sibling-tool rollback, multiple simultaneous questions per child, replay after ambiguous delivery, and broader orchestration changes remain explicitly out of scope.
