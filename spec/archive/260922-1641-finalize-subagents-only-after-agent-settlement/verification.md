# Verification: Finalize subagents only after agent settlement

Work item: `260922-1641-finalize-subagents-only-after-agent-settlement`
Date: 2026-09-22

## Environment

- Mode: direct.
- Assurance: medium - stateful child lifecycle and cross-process completion signaling can prematurely kill retries, while the change remains localized and has deterministic event-sequence seams.
- Starting Git boundary: `b9dad29a59f500d7b19f2d808930e7d56325d61a`.
- Pre-existing workflow-owned changes: `spec/index.md` and this active item's initial `item.yaml` and `plan.md`.
- Verified dependency graph: `@earendil-works/pi-coding-agent` 0.87.0, `@earendil-works/pi-tui` 0.87.0, and `typebox` 1.3.27. Public peer ranges remain wildcard.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| Focused lifecycle/activity regression | PASS | `env -u PI_SUBAGENT_ALLOWED node --test --test-name-pattern='subagent runtime control\|subagent activity snapshots' test/test.ts`; 37 passed, 0 failed. |
| Full model-free unit suite | PASS | `env -u PI_SUBAGENT_ALLOWED npm test`; 222 passed, 0 failed. |
| Development dependency graph | PASS | `npm ls @earendil-works/pi-coding-agent @earendil-works/pi-tui typebox`; resolved 0.87.0, 0.87.0, and 1.3.27 respectively. |
| tmux surface integration | PASS | `node --test test/integration/tmux-surface.test.ts`; 9 passed, 0 failed. |
| Package allowlist | PASS | `npm pack --dry-run --json`; 18 files, required runtime and documentation present, no `spec/`, `wiki/`, `test/`, or `AGENTS.md` paths. |
| Spec protocol | PASS | `uv run spec/scripts/manage-spec-item.py --root . validate --operational`; 8 items valid, no warnings after the evidence update. |
| Markdown integrity | PASS | Python check over all 10 changed or untracked Markdown files, including this verification record; relative targets exist, text is ASCII/control-clean, and fenced-code markers are balanced. |
| Patch integrity | PASS | `git diff --check`; no whitespace errors. |

The tmux surface result was produced after the source and dependency changes and before documentation-only edits. It remains reusable because its source, fixture, dependency graph, configuration, and acceptance scope did not change afterward. The final unit, dependency, package, spec, Markdown, and patch checks were run after the complete implementation and documentation changes.

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R1-R3 | `subagent-runtime-control.ts` captures every `agent_end` outcome without finalizing; deterministic error-to-success sequence proves retry activity and latest-success replacement before `agent_settled`. | PASS |
| R4 | Final-error sequence verifies the existing JSON error sidecar contents, terminal settled activity, and one shutdown request; sidecar write failure retains the unchanged session-file fallback path. | PASS |
| R5 | Aborted-outcome sequence remains waiting with no sidecar or shutdown. | PASS |
| R6 | Deterministic pending-question, nested-child, Pi-pending-message, and non-auto-exit cases remain open until applicable later work settles. | PASS |
| R7 | Activity schema version remains 1, accepts `agent_settled`, records intermediate `agent_end` as waiting, and records only settled finalization as done. | PASS |
| R8 | `package.json`, `package-lock.json`, and `npm ls` establish the Pi/TUI 0.87.0 and TypeBox 1.3.27 development baseline; wildcard peers are unchanged. | PASS |
| R9 | Retry-success, exhausted-error, abort, normal completion, and outstanding-work regressions pass; README, agent-definition guidance, and durable wiki pages describe settled finalization and Pi 0.87.0. | PASS |

Changed implementation paths are `pi-extension/subagents/subagent-runtime-control.ts`, `pi-extension/subagents/activity.ts`, `test/test.ts`, `package.json`, and `package-lock.json`. Current user and durable guidance changed in `README.md`, `docs/agent-definitions.md`, `wiki/overview.md`, `wiki/architecture.md`, `wiki/conventions/runtime-safety.md`, `wiki/development.md`, and `wiki/log.md`.

## Review findings

- Focused T01-T02 review: PASS, no blocking or non-blocking findings. Coverage included runtime settlement handlers, latest-outcome capture, outstanding-work and abort guards, sidecar/shutdown behavior, activity schema/recorder changes, and deterministic regressions. Retry count: 0.
- Initial whole-change Contract-quality review: BLOCK on missing `verification.md`; implementation behavior, dependencies, documentation, scope, and non-goals otherwise passed. The smallest correction was this evidence artifact. The stale unchecked plan progress was reported as non-blocking and was preserved until the required re-review passed, per Implement's progress-ordering rule.
- Targeted Contract-quality re-review retry 1: PASS, no blocking findings. The reviewer observed the complete evidence artifact plus passing operational spec, current 10-file Markdown, and patch-integrity checks; earlier unit, dependency, tmux, package, and focused-review evidence remained valid.

## Failures and skipped checks

- The first flash reviewer and its resumed session exited without a report. A replacement worker also exited without output. The parent orchestrator supplied fresh independent Focused and Contract-quality review reports; no verdict was fabricated.
- The approval-gated model-consuming lifecycle test was not run. No live provider failure test is represented as deterministic retry evidence.
- Dependency installation emitted local allow-scripts warnings for transitive packages; installation, audit, dependency resolution, and all required model-free checks succeeded without approving or running additional scripts.

## Unverified areas

- Ordinary configured-provider auto-exit under Pi 0.87.0 was not re-observed in the paid lifecycle suite. Deterministic handler sequences directly cover the extension's retry/finalization responsibility, and the installed Pi 0.87.0 lifecycle source defines `agent_settled` after retries and queued continuation; the remaining live happy-path uncertainty is bounded and non-blocking under the plan.
