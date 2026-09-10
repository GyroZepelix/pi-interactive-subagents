# Outcome: Profile extension loading

Work item: `260909-1952-profile-extension-loading`
Disposition: completed
Date: 2026-09-10

## Delivered scope

Added strict `builtin-tools` and configured package `extensions` to Pi subagent profiles, with trust-scoped read-only package resolution, deterministic canonical extension ordering, isolated child activation, protected framework controls, exact nested-agent permissions, and versioned resume that preserves valid legacy strict snapshots. Removed hardcoded custom-tool mappings and the process-global registration bridge, then synchronized user documentation and durable wiki guidance.

## Deviations from plan

Pi lifecycle ordering required splitting child behavior into first-loaded runtime control and trailing tool-free capability activation. This approved Decision D16 preserved framework precedence while activating profile registrations before model requests. No other material scope deviation remained.

## Verification summary

The complete implementation passed 198 unit tests, 7 controlled isolated tmux surface tests, an 18-file package dry run, removed-interface and stale-wiki searches, Markdown path, fence, and ASCII checks, spec validation, and patch-integrity checks. Focused, Standards, and Spec gates passed after targeted corrections and one retry each at the final segment.

## Retained, reverted, or transferred work

Existing valid legacy strict sidecars remain readable and resumable without rewriting. Global profile creation was not performed and remains in work item `260909-1928-create-global-scout-researcher-and-worker-profiles`.

## Residual risks

The configured-model lifecycle suite was not run because it remains separately approval-gated. Safe fixtures exercise real Pi 0.85.1 lifecycle behavior. The child tool widget may omit tools registered by later profile `session_start` handlers, but verified active capabilities are unaffected.

## Follow-up work items

- Revise `260909-1928-create-global-scout-researcher-and-worker-profiles` to replace its obsolete bridge and legacy `tools` design with the completed `builtin-tools` and package `extensions` contract.

## Source references

- `plan.md`
- `verification.md`
- `implementation/index.md`
- `implementation/03-01-documentation-and-final-verification.md`

## Wiki updates

Updated agent-profile and runtime-safety conventions, architecture, repository map, TypeScript module boundaries, development guidance, observations, recall logs, and routing to match verified current behavior. Canonical references were retargeted to this archived item before lifecycle completion.
