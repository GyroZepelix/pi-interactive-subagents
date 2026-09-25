# Verification: Add Antigravity harness support

Work item: `260925-1525-add-antigravity-harness-support`
Date: 2026-09-25

## Environment

- Mode: direct.
- Assurance: medium because profile validation, native capability isolation, external launch/result parsing, persisted resume state, status, compatibility, tests, and documentation changed together.
- Starting Git boundary: `6ee3d0445973aa85121ecadbbcd896523a7bd9f3`.
- Locally discovered Antigravity CLI: `/opt/homebrew/bin/agy`, version `1.2.11`.
- No dependency, migration, external profile/settings, staging, commit, push, deployment, or production action was performed.

## Changed paths

- Runtime: `pi-extension/subagents/agy.ts`, `agents.ts`, `index.ts`, `session.ts`, `status.ts`, and `tmux.ts`.
- Tests: `test/test.ts`.
- User documentation: `README.md`, `docs/agent-definitions.md`.
- Durable knowledge: `wiki/architecture.md`, `wiki/map.md`, `wiki/development.md`, `wiki/conventions/agent-profiles.md`, `wiki/conventions/runtime-safety.md`, and `wiki/log.md`.
- Workflow evidence: this verification and the completed checkboxes in `plan.md`.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| `env -u PI_SUBAGENT_ALLOWED npm test` | Pass | 237 tests, 42 suites, 0 failures after the final replayability refinement. |
| Generated four-tool AGY workspace plus `agy --add-dir <tmp> -p /agents --output-format text` | Pass | Generated `pi-probe-verified` was discovered; temporary root removed. No model was invoked. |
| Generated empty-tool AGY workspace plus the same `/agents` probe | Pass | `tools: []` agent `pi-empty-probe` was discovered; temporary root removed. No model was invoked. |
| Controlled detached tmux: `node --test test/integration/tmux-surface.test.ts` | Pass | 9 tests, 0 failures; pane creation, long commands, exact paste, interruption, and cleanup passed. |
| `npm pack --dry-run --json` plus package allowlist assertion | Pass | 19 files; AGY runtime and docs included; `spec/`, `wiki/`, tests, and repository instructions excluded. |
| Changed Markdown relative-link and fenced-code checks | Pass | 8 README/docs/wiki files checked. |
| Targeted stale-claim search | Pass | Remaining matches were intentional no-bypass statements and updated Pi/Claude distinctions. |
| `git diff --check` | Pass | No patch whitespace errors. |
| `uv run spec/scripts/manage-spec-item.py --root . validate --item "260925-1525-add-antigravity-harness-support"` | Pass | Item valid. |
| `uv run spec/scripts/manage-spec-item.py --root . validate --operational` | Pass | 9 items valid, no warnings. |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R1-R6: canonical `cli: agy`, field-specific rejection, exact ordered read-tool mapping, and empty default deny | `agents.ts`, `agy.ts`, focused parser/translator/empty-list tests | Pass |
| R7-R12: executable preflight, isolated generated primary agent, exact native tools, headless artifact-backed command, cwd/model/effort, no unrestricted bypass | `agy.ts`, tagged preparation and AGY branch in `index.ts`, command/serialization tests, both non-model discovery probes | Pass |
| R13: strict terminal result and usage handling | `parseAgyResult`, watcher integration tests for success, malformed/error/waiting/cancelled states | Pass |
| R14-R16: strict tagged registry/snapshot, running-message rejection, exact completed resume, state update, and fail-closed pre-pane validation | `agy.ts`, `session.ts`, AGY message/resume routing in `index.ts`, registry/state/watcher/public-resume tests | Pass |
| R17: external running status and honest interruption recovery | `status.ts`, AGY widget/result tags, replayability check, steering/interruption/status tests | Pass |
| R18: profile contract, permissions, limitations, resume, and scout/reviewer migration | `README.md`, `docs/agent-definitions.md`, durable wiki pages | Pass |
| R19: focused regression and Pi/Claude preservation | 237-test full suite plus 9-test controlled tmux suite | Pass |

## Review findings

- Focused coherent-boundary review: PASS, no blockers. One targeted re-review after empty-tool and explicit-harness rendering refinements also passed. Retry count: 1.
- Final contract-quality review: PASS, no blockers. Retry count: 0.
- Review-raised wording drift about replayable interruption state was corrected in `docs/agent-definitions.md` and `wiki/architecture.md`.
- Remaining non-blocking observations: cross-process orphaned AGY panes are not guarded by a persistent resume lock; AGY preparation computes an unused Pi capability environment but never exports it or creates a Pi loadout; result headers use the shared provider/agent-error label for AGY failures. These do not broaden capabilities or bypass resume validation.

## Failures and skipped checks

- One initial stale-claim search was quoted incorrectly and let shell backticks invoke `claude`; the corrected single-quoted search ran successfully and made no repository change.
- The model-consuming Gemini lifecycle/read/resume suite was not run because separate explicit approval was not granted. This limitation is recorded and is not permission to run it.

## Unverified areas

- Real Gemini 3.8 Flash prompt-free execution of read, grep, find, and list under the current user permission policy.
- Live response delivery and exact conversation continuation against the installed authenticated model service.
- Behavior after a hard parent-process crash leaves an AGY pane orphaned while another process addresses the same persisted conversation.
