# Outcome: Harden agent profiles and adapt the fork

Work item: `260909-1230-harden-agent-profiles-and-adapt-the-fork`
Disposition: completed
Date: 2026-09-10

## Delivered scope

Removed package-discovered default profiles, introduced canonical trust-aware YAML profile discovery, made named Pi launches and resume fail closed, hardened runtime naming and persisted loadouts, migrated the package to the Pi 0.85.1 namespaces, refreshed tests and lifecycle fixtures, constrained package output, and documented the user-managed profile contract.

## Deviations from plan

The runtime target expanded from the earlier Pi namespace to installed Pi 0.85.1 after explicit approval. Review findings added narrow validation, resume, artifact-collision, and malformed-override corrections without expanding into deferred transport, interruption, configuration, or broad modularization work.

## Verification summary

The final safe gate passed 171 unit tests, repeated controlled tmux surface runs with 7 tests, TypeScript syntax checks, dependency inspection, a 16-file package dry run, Markdown and removed-interface searches, patch integrity, work-item validation, and a final independent focused review. The active-Pi tmux focus discrepancy was recorded as environmental.

## Retained, reverted, or transferred work

The user-managed global profile inventory remained external to this repository. Stop and interrupt controls, acknowledged transport, shell readiness, broader configuration, orchestration modularization, unrelated dead code, and quality-gate infrastructure remained deferred.

## Residual risks

The configured-model lifecycle suite was not run because it required separate approval for external calls, time, and cost. `safe_bash` remained a finite denylist rather than a general sandbox.

## Follow-up work items

- `260909-1952-profile-extension-loading` later replaced strict custom-tool mappings with first-class configured package extension grants.
- `260909-1928-create-global-scout-researcher-and-worker-profiles` retains the user-specific global profile work.

## Source references

- `plan.md`
- `verification.md`
- `wiki/dreams/2026-09-09-1616-completed-session.md`

## Wiki updates

Updated repository overview, map, architecture, development, profile and runtime-safety conventions, index, log, and maintenance state with source-verified current behavior.
