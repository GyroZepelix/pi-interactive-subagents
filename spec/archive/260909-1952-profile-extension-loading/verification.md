# Verification: Profile extension loading

Work item: `260909-1952-profile-extension-loading`
Date: 2026-09-10

## Environment

- Repository: `/Users/dgjalic/Documents/1-Projects/10-software-development/pi-interactive-subagents`
- Implementation boundary: strict ancestor `486f582398eb6a79666e3ec05e868d33546c49eb` through HEAD `8037ba8ad8822f65b7e92db4859c933d07a3b473`, plus the complete unstaged final-slice diff
- Node.js: `v26.5.0`
- npm: `11.17.0`
- tmux: `3.6b`
- uv: `0.11.24`
- Target Pi API: `0.85.1`

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| Unit regression | PASS | `npm test`, 198 tests |
| Non-model tmux surface | PASS | `node --test test/integration/tmux-surface.test.ts` in an isolated tmux server, 7 tests |
| Package dry run | PASS | `npm pack --dry-run --json`, 18 intended files; runtime files and user docs included; `spec/`, `wiki/`, tests, and `AGENTS.md` excluded |
| Removed interfaces | PASS | No `registerToolExtension`, `EXTRA_TOOL_EXTENSIONS`, or `getToolExtensionPath` matches in source, tests, README, or docs |
| Stale indexed wiki paths | PASS | No deleted child-control or retired registration references in current non-episodic wiki guidance |
| Markdown | PASS | Relative targets, fenced-code balance, and ASCII consistency checked for all 11 changed Markdown files, including final spec evidence |
| Spec validation | PASS | `uv run spec/scripts/manage-spec-item.py --root . validate --item 260909-1952-profile-extension-loading` |
| Diff validation | PASS | `git diff --check` |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R01-R05: schema and read-only package resolution | Strict parser and resolver in `pi-extension/subagents/agents.ts`; isolated package and public-diagnostic regressions in `test/test.ts`; T01 packet evidence | PASS |
| R06-R08: trusted extension grants, activation, framework controls, and nesting | `pi-extension/subagents/index.ts`, `subagent-runtime-control.ts`, `subagent-capability-activation.ts`, and real Pi 0.85.1 non-model fixtures; T02 evidence | PASS |
| R09-R10: versioned resume and legacy compatibility | Strict snapshot union in `pi-extension/subagents/session.ts`, shared command application and preflight in `index.ts`, resume regressions, and 02.02 evidence | PASS |
| R11-R12: Claude rejection and canonical behavior | Parser rejection and shared asynchronous discovery/list/spawn tests in `test/test.ts` | PASS |
| R13: user and durable documentation | `README.md`, `docs/agent-definitions.md`, current indexed wiki guidance, package inspection, and final focused/expanded reviews | PASS |

## Review findings

- Focused Current review: initial BLOCK because `wiki/log.md` described final evidence before it existed. Corrected to record only observed evidence. Targeted retry 1: PASS, no findings.
- Expanded Standards review: initial BLOCK because three indexed wiki pages retained deleted paths and the retired strict capability model. Updated `wiki/architecture.md`, `wiki/map.md`, and `wiki/conventions/typescript-modules.md`. Targeted retry 1: PASS, no findings.
- Expanded Spec review: initial BLOCK on the same R13 durable-memory gap. The same narrow corrections resolved it. Targeted retry 1: PASS, no findings.
- Prior T01 and T02 Focused, Standards, and Spec gates passed as recorded in their implementation packets.

## Failures and skipped checks

- One stale test seam and one non-canonical macOS temporary-path fixture failed during T02 and were corrected before its segment gate.
- The final reviews found documentation provenance and stale indexed-wiki issues; all blocking findings were corrected within retry 1.
- The first final Markdown helper misread Git status prefixes as paths and failed before checking content. The corrected tracked-plus-untracked path scan passed all 11 Markdown files.
- `test/integration/subagent-lifecycle.test.ts` was not run because it consumes configured models and requires separate explicit approval.
- Archive preflight was not available: `manage-spec-item.py archive --help` failed because this helper version has no `archive` command. No outcome or lifecycle transition was attempted.

## Unverified areas

- Configured-model lifecycle behavior remains approval-gated. Safe unit fixtures use real Pi 0.85.1 lifecycle dispatch, and the non-model tmux surface suite passed.
- The runtime widget may omit tools registered by later profile `session_start` handlers. This is a documented display-only limitation; active capability behavior passed verification.
