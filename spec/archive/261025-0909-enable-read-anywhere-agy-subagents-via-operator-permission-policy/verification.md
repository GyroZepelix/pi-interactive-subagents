# Verification: Enable read-anywhere AGY subagents via operator permission policy

Work item: `261025-0909-enable-read-anywhere-agy-subagents-via-operator-permission-policy`
Date: 2026-10-25

## Environment

- Mode: direct. Assurance: medium (inherited from `plan.md`).
- Starting boundary: `HEAD 464d98e3c137fbf0d0987c4ccba5c9d949623eb7` on `master`. Pre-existing dirty paths were only this item's planning artifacts (`spec/index.md`, `item.yaml`, `plan.md`).
- Runner was a Pi subagent session that leaks `PI_SUBAGENT_*` variables into child processes; see Failures.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| `node --test --test-name-pattern='AGY\|agy' test/test.ts` | PASS 24/24 | New cases: policy evaluation, ack warning, workspace roots, denial diagnostic, watcher denial integration. |
| `env -u PI_SUBAGENT_ALLOWED npm test` | 286/287; 1 env-only failure | `applies the profile activation during session_start` fails identically at clean `HEAD` (detached worktree) in this session. |
| `npm test` with every `PI_SUBAGENT_*` unset | PASS 287/287 | Clean environment. |
| `npm pack --dry-run --json` file list vs `HEAD` | Identical (22 entries) | Compared sorted path lists. |
| `git diff --check` | PASS | |
| Docs: fence balance, relative links, ASCII on added lines | PASS | `README.md`, `docs/agent-definitions.md`, wiki pages. |
| Stale-claim search (AGY workspace-only read claims) | PASS | README and agent-definitions now describe headless soft-deny plus the operator policy. |
| `manage-spec-item.py validate --item ...` and `--operational` | PASS | |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R1 command/agent/tools/snapshot unchanged | `git diff` touches only `parseAgyResult` signature and denial message in existing `agy.ts` code; existing command and snapshot tests pass. | Verified |
| R2 read-only, single settings path | `checkAgyPermissionPolicy` reads only `agyPermissionSettingsPath()`; test asserts file content unchanged. | Verified |
| R3 pure tested preflight helper | `evaluateAgyPermissionPolicy` cases: satisfied, missing, unreadable, invalid JSON, non-object, no permissions, missing allow, missing deny, wrong types; bounded single line. | Verified |
| R4 non-blocking launch/resume warning, AGY only | `withAgyPolicyWarning` applied to single, chain, and AGY resume acks; unit test covers pi/claude unchanged, satisfied, unsatisfied, throwing check. | Verified (unit + inspection; no tmux launch test) |
| R5 denial diagnostic with roots and remedy | `parseAgyResult` third arg; watcher passes `agyWorkspaceRoots(state)`; watcher integration test asserts actions, roots, remedy, stderr. | Verified |
| R6 operator settings merge | User approved gate 1 (2026-10-25). Backup `/Users/dgjalic/.gemini/antigravity-cli/settings.json.bak-20261025-093213` (90 bytes, 0600, `cp -p`). Atomic rewrite added only `permissions` with the exact approved allow/deny lists; key diff: added `permissions`, removed none, `trustedWorkspaces` unchanged; mode 0600; no temp leftovers; `checkAgyPermissionPolicy()` returns `null`. Credential contents not read (existence only). | Verified |
| Live acceptance (T03) | Single canary call: outside read returned, canary deny honored, workspace write denied with sentinel unchanged. | Verified |
| R7 documentation | `README.md` "AGY permission policy", `docs/agent-definitions.md`, `wiki/architecture.md`, `wiki/conventions/runtime-safety.md`, `wiki/log.md`. | Verified |

## Live canary (T03, gate 2 approved 2026-10-25)

- Setup: disposable canary dir `/private/tmp/agy-canary-6ca496df/` (`outside/hello.txt` random read token, `denied/note.txt` different random token) and separate child cwd `/private/tmp/agy-canary-cwd-6ca496df/` (`sentinel.txt`, sha256 `d0622f75...a5878`). Temporary rule `read_file(/private/tmp/agy-canary-6ca496df/denied)` appended via atomic 0600 rewrite.
- Call 1 of hard cap 3 (only call made): `agy --output-format json --model gemini-3.8-flash --effort low --print <prompt>` from the child cwd; exit 0, `status: SUCCESS`, `num_turns: 1`, ~10.8 s, 29218 total tokens; stderr empty.
- Outside read: response contained the exact read token. PASS.
- Canary-only read deny: response reported `Permission denied for read_file(.../denied/note.txt). Matches user-configured deny rule.`; deny token absent from response. PASS.
- Workspace write: response reported `Permission denied for write_file(.../sentinel.txt). Matches user-configured deny rule.`; sentinel sha256 unchanged and content unchanged. PASS.
- No new files appeared in either canary tree (before/after listing diff empty); no AGY scratch writes observed.
- Observation: explicit deny-rule matches were not listed in `denied_actions` (field absent) and the envelope stayed `SUCCESS`. Only headless soft-denials populate `denied_actions`. D02 and D04 unchanged; the plan's "writes trigger failures" risk did not materialize. The README caveat that claimed write attempts fail the run was corrected to this observed behavior (doc-only, post-review; ASCII, fence, and `git diff --check` rechecked).
- Cleanup: temporary rule removed via atomic 0600 rewrite; settings equal backup plus the exact approved `permissions` block (`True`); no temp leftovers; `checkAgyPermissionPolicy()` returns `null`. Canary trees and local canary artifacts deleted.

## Review findings

- Contract-quality review (`flash-reviewer`, `contract-review-0909`, AGY target 1/3) over T01 and T02: PASS, no blocking or non-blocking findings.
- Targeted re-review (retry 1 of 2; `flash-reviewer`, `readme-rereview-0909`, AGY target 1/3) of only the post-review README deny-rule caveat against the recorded canary evidence, `parseAgyResult`, D02/D04, and `docs/agent-definitions.md`: PASS, no blocking or non-blocking findings.

## Failures and skipped checks

- `env -u PI_SUBAGENT_ALLOWED npm test` has one environment-only failure that is pre-existing at `HEAD` under this session's leaked `PI_SUBAGENT_*` variables; it passes with those variables unset.

## Unverified areas

- Secret-path denies were not exercised live by design (no secret paths in prompts); they rely on the same deny-rule mechanism the canary proved for a non-secret path.
- Launch and resume acknowledgment wiring is proven by unit tests of the helper plus source inspection, not a tmux-backed launch.
