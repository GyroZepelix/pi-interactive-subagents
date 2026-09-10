# 260909-1952-profile-extension-loading - T01 capability resolution

Date: 2026-09-10
Work item: 260909-1952-profile-extension-loading
Status: partial
In one line: Completed and independently verified the profile schema and asynchronous package-resolution segment, then advanced the sliced plan to child launch work.

## Goal

Implement Current slice 01.02 without crossing into launch or resume behavior, close the T01 segment gate, and preserve exact continuation evidence for the next session.

## How we approached it

Continued from the recorded 01.02 attempt at HEAD `bd158f6692a39a407b218914dc8842d18916d156`. The implementation separated parsed profiles from resolved profiles, built a trust-scoped package catalog from Pi settings, resolved package resources through a read-only settings adapter and a skip-on-missing callback, and made listing, permission, spawn preparation, and command callers await one canonical discovery path. Tests used isolated global and project settings and instrumented package-manager seams to prove failure behavior and absence of installation, network, and settings-write side effects.

Repeated focused reviews drove corrections for malformed project settings, package mapping validation, nearest-project anchoring, project `autoload: false` resource inheritance, file URL handling, and package identity. The final identity implementation compares the exactly selected project source against global candidates using Pi's own package identity semantics through a fail-closed compatibility seam. The focused review and separate T01 Standards and Spec gates then passed.

## Key decisions

- **Use Pi's package manager in read-only mode** - chose scoped `SettingsManager` instances and `DefaultPackageManager.resolve(() => "skip")` to preserve Pi resource semantics without installing or persisting packages.
- **Keep one canonical resolved profile** - chose asynchronous discovery shared by every public caller instead of re-resolving selectors at launch sites.
- **Delegate delta identity to locked Pi behavior** - chose a bound, exception-safe, return-validated call to Pi 0.85.1 package identity logic because source-prefix approximations misclassified protocol and cross-platform path forms.
- **Preserve slice boundaries** - left child launch flags, capability activation, snapshots, resume, and legacy extension registration for T02.

## What did not work

- **Source-prefix package classification** - incorrectly treated invalid protocol-like and Windows path strings as scope-independent. Replacing it with Pi-equivalent identity comparison removed privilege-expanding false positives.
- **Exact global source equality for project deltas** - blocked valid inheritance when global and project settings used different npm versions or git protocols for the same package identity. The final implementation compares identities while retaining exact profile-to-project-source selection.
- **One focused review timed out** - returned `UNVERIFIED` after incomplete diff coverage. A later reviewer inspected the complete final diff and passed it.

## Current state and where we left off

- Shipped/verified: slices 01.01 and 01.02, plan task T01, strict profile capability parsing, trust-scoped non-installing package resolution, canonical asynchronous discovery, public fail-closed diagnostics, and the complete T01 review gate.
- Pending: Current is `02.01`, which must implement isolated child launch and capability activation. T02 snapshot/resume work remains in 02.02, and documentation plus final whole-plan verification remains in 03.01.
- Working tree: T01 source, tests, and spec evidence are intentionally uncommitted. No push or deployment occurred.

## Source of truth

- `spec/archive/260909-1952-profile-extension-loading/plan.md`: authoritative requirements and T01 completion state.
- `spec/archive/260909-1952-profile-extension-loading/implementation/index.md`: sliced progress, checkpoints, and Current `02.01`.
- `spec/archive/260909-1952-profile-extension-loading/implementation/01-02-package-resolution.md`: attempt history, final acceptance evidence, review reconciliation, and handoff.
- `pi-extension/subagents/agents.ts`: parsed and resolved definition model and package/resource resolver.
- `pi-extension/subagents/index.ts`: awaited public discovery callers.
- `test/test.ts`: isolated parser, resolver, scope, identity, side-effect, tombstone, and caller regressions.

## Verification

- Done: focused discovery suite passed 54 tests; full `npm test` passed 185 tests; spec validation, Markdown checks, and `git diff --check` passed; final Focused, Standards, and Spec reviews all passed with complete scoped coverage.
- Not verified yet: child extension activation, versioned snapshots, resume behavior, final package contents, and controlled tmux behavior belong to later slices. Future Pi private identity API drift is not simulated, but the current seam fails closed and Pi 0.85.1 behavior is covered.

## Open questions, blockers, next safe action

- Open/blocked: no T01 blocker remains. The broader feature is incomplete until T02 and T03 pass.
- Next safe action: create a user-controlled Git checkpoint for completed T01, then run Implement on Current packet `02.01` without starting 02.02.
