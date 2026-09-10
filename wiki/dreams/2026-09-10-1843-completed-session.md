# 260909-1952-profile-extension-loading - versioned resume

Date: 2026-09-10
Work item: 260909-1952-profile-extension-loading
Status: partial
In one line: Completed slice 02.02 and the T02 segment gate with strict versioned snapshots, exact new-mode resume, and preserved legacy strict replay.

## Goal

Implement exactly Current slice 02.02 so new capability loadouts persist and resume safely without weakening existing strict snapshots, then run the high-assurance T02 segment gate without beginning final documentation work.

## How we approached it

The session started from clean checkpoint `9e31c2a2bba19838598dce80e6a9691c0dd01c0e`. The existing loadout shape was split into an exact legacy branch and an explicit version 1 extension-grant branch. New launches now persist their verified capability data, and both initial launch and resume feed that snapshot through the same command builder and environment encoding.

Replay validation was tightened at the pre-pane boundary. New snapshots preserve canonical profile extension paths separately from reconstructed framework controls, and resume uses only persisted state rather than rediscovering profiles or packages. The completed diff then passed focused checks, a targeted re-review after the final path refinement, integrated unit and controlled tmux checks, and separate Standards and Spec reviews over the complete T02 checkpoint boundary.

## Key decisions

- **Keep a structural union** - new mode has explicit version and capability-mode fields; partially mixed old/new fields are rejected rather than inferred.
- **Replay paths, not definitions** - resume remains independent of changed or deleted profiles and settings, while valid stored paths intentionally execute their current contents.
- **Preserve legacy behavior** - valid existing strict sidecars retain their `--tools` command path and are not rewritten when read.
- **Canonicalize the new contract** - new snapshots accept only canonical ordered profile paths and reconstruct protected runtime, optional spawning, and trailing activation controls.

## What did not work

- **Removing the obsolete allowlist builder left one stale test** - the focused suite caught the old test seam; the test now checks the protected spawning sandbox directly.
- **Using a raw macOS temporary path in a valid replay fixture** - `/var` resolved through `/private/var`, so the fixture violated the new canonical-path contract; the valid fixture now uses `realpathSync`, while a separate alias case verifies refusal.
- **Relying on the initial focused review after a later source refinement** - the first review no longer covered the final canonicalization logic, so a targeted retry independently reviewed that delta and passed.

## Current state and where we left off

- Shipped/verified: 02.02 and T02 are checked complete. New snapshots, new-mode launch/resume parity, fail-closed path replay, nested environment restoration, current-content semantics, and unchanged legacy strict replay passed all required segment checks and reviews.
- Pending: Current is 03.01 for user documentation, package inspection, final whole-plan checks, and expanded final Standards and Spec review. The broader work item remains active.
- Working tree: source, tests, spec evidence, and this Dream update are uncommitted after checkpoint `9e31c2a2bba19838598dce80e6a9691c0dd01c0e`; no staging, commit, push, package/settings write, or profile modification occurred in the implementation session.

## Source of truth

- `spec/archive/260909-1952-profile-extension-loading/implementation/02-02-versioned-resume.md`: complete 02.02 implementation, checks, review verdicts, failures, and handoff.
- `spec/archive/260909-1952-profile-extension-loading/implementation/index.md`: T02 completion and Current `03.01`.
- `spec/archive/260909-1952-profile-extension-loading/plan.md`: requirements R06-R10 and R12, Decisions D10 and D14-D16, and checked T02 task.
- `pi-extension/subagents/session.ts`: strict legacy/versioned snapshot union and reader.
- `pi-extension/subagents/index.ts`: snapshot construction, replay validation, shared command application, and resume environment.
- `test/test.ts`: structural, compatibility, ordering, environment, path, and public pre-pane refusal regressions.

## Verification

- Done: focused suite passed 126 tests; integrated T02 pattern passed 133; full `npm test` passed 198; controlled tmux surface suite passed 7; spec, link, fence, removed-interface, and diff checks passed. Focused review and targeted retry, Standards review, and Spec review all returned PASS with no blockers.
- Not verified yet: configured-model lifecycle testing remains approval-gated and was not run. T03 final package and whole-plan verification remain pending.

## Open questions, blockers, next safe action

- Open/blocked: no T02 blocker remains. The display-only tool-widget freshness issue remains tentative and does not affect runtime capability behavior.
- Next safe action: create a user-controlled Git checkpoint, then run Implement on exactly Current packet `03.01`.

## Dynamic knowledge trail

- `wiki/conventions/runtime-safety.md`: updated convention.
- `wiki/observations.md`: added one tentative path-fixture observation and appended independent provenance to the existing runtime-display observation.
