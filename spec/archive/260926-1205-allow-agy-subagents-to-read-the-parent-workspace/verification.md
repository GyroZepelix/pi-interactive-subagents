# Verification: Allow AGY subagents to read the parent workspace

Work item: `260926-1205-allow-agy-subagents-to-read-the-parent-workspace`
Date: 2026-09-26

## Environment

- Mode: direct
- Assurance: medium - the change expands an external CLI workspace boundary and preserves strict persisted resume behavior.
- Starting HEAD: `c805ec546ba75ca4c191b4b7ba5493771e88b30a`
- Changed implementation paths: `pi-extension/subagents/agy.ts`, `pi-extension/subagents/index.ts`, `test/test.ts`
- Changed user and durable guidance: `README.md`, `docs/agent-definitions.md`, `wiki/architecture.md`, `wiki/conventions/runtime-safety.md`, `wiki/development.md`, `wiki/log.md`

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| Focused AGY suite | Pass | `node --test --test-name-pattern='AGY\|agy' test/test.ts` - 18 passed |
| Full model-free regression suite | Pass | `env -u PI_SUBAGENT_ALLOWED npm test` - 239 passed |
| Non-model repeatable-workspace discovery | Pass | Temporary `agy --add-dir <agent-root> --add-dir <second-workspace> --agent <generated-name> -p /agents --output-format text` selected the generated agent; temporary roots were removed |
| Package contents | Pass | `npm pack --dry-run --json` - 19 files; runtime/docs present and `spec/`, `wiki/`, and tests absent |
| Documentation consistency | Pass | Relative links, fence balance, control characters, patch-added ASCII, and stale current-workspace claims checked across changed Markdown |
| Patch integrity | Pass | `git diff --check` |
| Item validation | Pass | `uv run spec/scripts/manage-spec-item.py --root . validate --item "260926-1205-allow-agy-subagents-to-read-the-parent-workspace"` |
| Operational spec validation | Pass | `uv run spec/scripts/manage-spec-item.py --root . validate --operational` |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R1-R4: child cwd retained; generated root plus one distinct resolved parent root; no prompt-derived roots; pre-pane validation | Workspace derivation and command assembly in `agy.ts`/`index.ts`; exact/deduplication, malformed path, and public preflight tests | Pass |
| R5-R6: strict version 2 exact replay and version 1 compatibility | Strict state union, additional-root replay helper, round-trip/rejection fixtures, watcher preservation test, and version 1 fixture | Pass |
| R7: unchanged read-only native tools and no permission bypass | Existing profile/serialization regressions, command assertions, and full suite | Pass |
| R8: denied actions are actionable failures | Captured-shape parser fixture verifies action and stderr evidence precede empty-success handling and remain bounded | Pass |
| R9: Pi and Claude behavior preserved | Full 239-test regression suite | Pass |
| R10: user and durable guidance updated | README, agent-definition reference, architecture, runtime-safety, development, and wiki log changes; Markdown and package checks | Pass |

## Review findings

- Focused medium-assurance workspace/state review: PASS; 0 retries; no blocking findings. Two optional ordering/cleanup observations were non-blocking and did not affect the fail-closed contract.
- Final contract-quality review: PASS; 0 retries; no blocking findings. Progress metadata was expected to be updated after the gate; lexical `resolve` behavior for symlink aliases matches the canonical plan and was non-blocking.

## Failures and skipped checks

- One initial documentation script treated pre-existing README Unicode typography as a failure. The corrected patch-level ASCII plus link/fence/control check passed.
- Live model-consuming AGY lifecycle, cross-workspace read, and same-name continuation checks were not run because separate approval for external calls, time, and quota was not granted.

## Unverified areas

- Real Gemini execution of a parent-workspace read under the user's current AGY permission policy.
- Live exact continuation against the external AGY conversation service. Deterministic command, state, and non-model discovery evidence passed, but it is not a substitute for those approval-gated calls.
