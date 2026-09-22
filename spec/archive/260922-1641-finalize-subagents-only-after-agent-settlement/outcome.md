# Outcome: Finalize subagents only after agent settlement

Work item: `260922-1641-finalize-subagents-only-after-agent-settlement`
Disposition: completed
Date: 2026-09-22

## Delivered scope

Auto-exit Pi children now capture each low-level `agent_end` outcome as a recoverable waiting state and finalize only at `agent_settled`. Finalization uses the latest run messages, rechecks pending questions, running nested children, Pi-owned pending messages, and abort state, then preserves the existing final-error sidecar and graceful shutdown contract. Version-1 activity snapshots accept terminal `agent_settled`, and deterministic regressions cover retry success, exhausted error, abort, normal completion, outstanding-work guards, and non-auto-exit behavior.

Development dependencies and the lockfile now resolve Pi coding-agent/TUI 0.87.0 and TypeBox 1.3.27 while wildcard peer ranges remain unchanged. Current user and durable guidance describe settled finalization and the verified Pi 0.87.0 baseline.

## Deviations from plan

No product-scope or non-goal deviations. The initial Contract-quality review blocked only on the missing verification artifact; that evidence correction passed targeted re-review retry 1. The approval-gated model-consuming lifecycle check was not run, as permitted by the plan.

## Verification summary

All required model-free gates passed: 222 unit tests, 9 tmux surface tests, the Pi 0.87.0 dependency graph, an 18-file package dry run with no forbidden paths, operational spec validation, changed-Markdown integrity checks, and `git diff --check`. The focused T01-T02 review passed without findings. The final Contract-quality gate passed on retry 1 after the evidence artifact correction.

## Retained, reverted, or transferred work

All planned source, test, dependency, documentation, wiki, and evidence changes are retained. No unrelated work was reverted, transferred, staged, committed, or pushed.

## Residual risks

Configured-provider happy-path auto-exit under Pi 0.87.0 was not re-observed in the paid lifecycle suite. Deterministic handler sequences cover the extension-owned retry/finalization boundary, and inspected Pi 0.87.0 semantics place `agent_settled` after retries and queued continuation, so this uncertainty is bounded and non-blocking.

## Follow-up work items

None required. A future explicitly approved live lifecycle run may provide additional happy-path integration evidence, but is not deterministic retry proof.

## Source references

- `pi-extension/subagents/subagent-runtime-control.ts`
- `pi-extension/subagents/activity.ts`
- `test/test.ts`
- `package.json`
- `package-lock.json`
- `README.md`
- `docs/agent-definitions.md`
- `verification.md`

## Wiki updates

Updated `wiki/overview.md`, `wiki/architecture.md`, `wiki/conventions/runtime-safety.md`, `wiki/development.md`, and `wiki/log.md` with the verified Pi 0.87.0 baseline and settled-finalization invariant. `wiki/state.md` was unchanged because no ingest, lint, dedupe, or Git checkpoint advanced.
