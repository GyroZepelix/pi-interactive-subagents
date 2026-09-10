# Slice 01.02: Add package resolution and asynchronous canonical discovery

Plan: `../plan.md`
Implementation index: `./index.md`
Segment: `T01 - Implement and verify profile capability resolution`

## Outcome

Every syntactically valid profile resolves through one asynchronous, trust-scoped, non-installing path to a deterministic built-in list and ordered absolute extension paths, and public listing/spawning reject unresolved profiles before pane creation.

## Why this slice exists now

This work depends on the strict parsed representation from 01.01. It completes T01 and must pass its integrated gate before launch and resume code can safely consume resolved capabilities.

## Relevant context

- Requirements R03-R05: exact configured source matching, enabled-resource selection, explicit selector narrowing, project/global scope, read-only resolution, canonical containment, ordering, deduplication, and fail-closed diagnostics are mandatory.
- Requirement R12: listing, permission checks, launch preparation, diagnostics, and later snapshot creation must receive the same resolved definition rather than re-deriving it.
- Requirement R04: global profiles never consult project settings; trusted project profiles prefer project packages and may fall back globally; untrusted project settings are excluded.
- Requirement R05: missing packages/resources, disabled resources, empty all-resource selections, path escapes, and nonexistent files exclude a profile before pane creation without installation or writes.
- Decisions D02/D06/D07: resolve exact configured package sources and exact optional relative selectors.
- Decisions D08/D12: preserve scope containment and exclude unresolved profiles from both list and spawn.
- Research constraint: configured package resolution is asynchronous, so list, `subagent`, and `/subagent` must share and await one canonical resolver ([lifecycle research](../research/lifecycle-and-failures.md)).
- Segment acceptance contribution: completes the resolved profile contract consumed by T02.
- Parent-plan sections to load on conflict or uncertainty: Requirements R03-R05 and R12; Design "Parsed and resolved definitions" and "Package and resource resolution"; Decision Log D02, D06-D08, D12; T01 acceptance and risks.

## Constraints and non-goals

- Use Pi's exported settings/package facilities in a non-installing mode. Do not call convenience APIs that install missing sources.
- Use temporary isolated settings and package fixtures in tests. Do not read or write the user's real global settings or package installation.
- Preserve invalid project-override tombstones after asynchronous resolution failures. Never restore the less restrictive global definition.
- Keep filesystem selectors package-relative and prove canonical selected files remain inside the package root.
- Do not change child launch flags, tool activation, snapshot formats, or the legacy registration mechanism in this slice.

## Expected source and test areas

- `pi-extension/subagents/agents.ts`
- `pi-extension/subagents/index.ts`
- `test/test.ts`
- Installed Pi package-manager and settings type declarations, read-only as needed

These paths are navigation hints. Inspect other relevant source or tests when justified by the bounded outcome.

## Acceptance

- An exact global configured source resolves for a global profile; a project-only source does not.
- A trusted project profile prefers a matching project source and may fall back to a matching global source; untrusted project settings are ignored.
- Omitted `paths` selects every enabled extension resource in Pi's resolved order. Explicit `paths` selects exactly enabled matching resources in selector order.
- Duplicate final canonical paths retain the first occurrence across the complete declaration order.
- Missing configuration or installation, disabled or absent selectors, empty all-resource selection, nonexistent resources, symlink/root escape, and resolver errors exclude the profile with file-and-field diagnostics.
- Tests prove the missing-source path performs no installation callback, network action, or settings write.
- Asynchronous package failures in project overrides tombstone same-name globals; uncertain project identity still suppresses globals.
- `subagents_list`, `subagent`, and `/subagent` await the same resolver and expose consistent diagnostics. The public spawn path fails before tmux prerequisites or pane creation.
- No runtime capability is reconstructed from filenames or unresolved selectors after canonical resolution.

## Focused checks

- `node --test --test-name-pattern='subagent discovery' test/test.ts`
- `git diff --check -- pi-extension/subagents/agents.ts pi-extension/subagents/index.ts test/test.ts`

## Focused review

Ask one independent read-only reviewer to inspect the Current slice, its complete diff, applicable repository instructions, correctness, regressions, maintainability, and scoped acceptance. Resolve every blocking finding before completion.

## Segment gate

Run the segment's integrated acceptance and appropriate regression checks, then launch independent read-only Standards and Spec reviewers. Resolve blocking findings before checking off the segment and matching plan task.

- Integrated checks: `node --test --test-name-pattern='subagent discovery' test/test.ts` and `npm test`
- Segment acceptance: Prove R01-R05, R10-R12, deterministic no-install resolution, public diagnostic consistency, and preserved project tombstones. Standards review covers repository conventions and maintainability; Spec review traces the complete T01 diff to the plan without extending its contract.

## Attempt log

### Attempt 1 - 2026-09-10T13:57:44+0200

Starting HEAD: `bd158f6692a39a407b218914dc8842d18916d156`

Changes:

- `pi-extension/subagents/agents.ts`: split parsed and resolved definitions; added asynchronous exact-source package resolution through `SettingsManager` and `DefaultPackageManager.resolve(() => "skip")`; added read-only scoped settings, runtime package-setting validation, nearest-project settings anchoring, enabled-resource selection, selector/declaration ordering, canonical path deduplication, file/root containment, project/global precedence, resolution caching, and per-profile diagnostics.
- `pi-extension/subagents/index.ts`: made canonical discovery, test lookup, `subagent`, `subagents_list`, and `/subagent` callers asynchronous and awaited without changing launch flags, snapshots, activation, or the legacy registration mechanism.
- `test/test.ts`: added isolated package/settings fixtures covering exact sources, global/project scope, nearest-project lookup from nested cwd, trusted fallback, enabled filters, explicit/all selection order, package order, canonical deduplication, disabled/absent/empty/missing/escaping resources, malformed settings, resolver errors, project tombstones, consistent public diagnostics, and instrumented no-install/network/settings-write behavior.

Checks:

- `node --test --test-name-pattern='subagent discovery' test/test.ts`: latest PASS, 53 tests.
- `npm test`: latest PASS, 184 tests.
- `git diff --check -- pi-extension/subagents/agents.ts pi-extension/subagents/index.ts test/test.ts`: PASS.
- `uv run spec/scripts/manage-spec-item.py --root . validate --item 260909-1952-profile-extension-loading`: PASS.

Failures:

- Independent focused review remains BLOCKED. The current `exactGlobalDeltaBases` implementation infers cross-scope identity from source prefixes instead of Pi-equivalent parsed package identity. Invalid git/protocol-looking strings and Windows path forms can be misclassified, potentially admitting inherited global resources or dropping valid inheritance. The latest reviewer specifically requires false-positive and Windows tilde coverage; npm, valid git/protocol, and tilde identity coverage were also noted as absent.
- Earlier focused findings were resolved: unreadable project settings now block global fallback; malformed package settings are contained as per-profile diagnostics; unknown package-setting keys fail closed; no-side-effect seams are instrumented; nearest ancestor project settings are used; absolute-path and `file://` autoload-delta inheritance/exclusions are covered.

Blockers:

- Replace source-prefix heuristics with Pi-equivalent package identity and scope/path normalization for project `autoload: false` delta-base matching. Retain exact profile-source matching and include inherited user resources only when the selected project entry and global base have the same effective Pi package identity.
- Focused review must pass after correction. The T01 integrated checks and separate Standards and Spec reviews have not started.

Exact next action: implement a deterministic Pi-equivalent package identity helper for npm, valid git/protocol, and local path sources (including `file://`, tilde, Windows forms, and invalid protocol false positives), use it in `exactGlobalDeltaBases`, and add targeted delta regressions before rerunning focused and full checks.

For each interrupted or failed attempt, append without rewriting earlier entries:

```text
### Attempt <number> - <timestamp>
Starting HEAD: <git commit at invocation start>
Changes: <paths and behavior changed>
Checks: <commands and results>
Failures: <failures or none>
Blockers: <blockers or none>
Exact next action: <single resumable action>
```

## Completion record

### Completed - 2026-09-10T14:50:07+0200

Starting HEAD: `bd158f6692a39a407b218914dc8842d18916d156`

Segment starting checkpoint: `486f582398eb6a79666e3ec05e868d33546c49eb`

Changes:

- `pi-extension/subagents/agents.ts`: introduced parsed and resolved profile definitions; added asynchronous trust-scoped package catalog loading; strict runtime validation for package settings; read-only `SettingsManager` storage; `DefaultPackageManager.resolve(() => "skip")`; exact profile-to-configured-source matching; Pi-identity-aware project `autoload: false` inheritance; enabled resource filtering; selector and declaration ordering; canonical root containment and first-path deduplication; per-profile fail-closed diagnostics; project tombstone preservation; and canonical discovery caching.
- `pi-extension/subagents/index.ts`: awaited the same canonical discovery object in list, permission, spawn preparation, test lookup, `subagent`, `subagents_list`, and `/subagent` paths without starting T02 launch, activation, snapshot, or legacy-registration changes.
- `test/test.ts`: added isolated package/settings coverage for global and trusted project scope, untrusted exclusion, nearest-project anchoring, project precedence and safe global fallback, exact selectors, enabled filters, package and selector order, canonical deduplication, symlink/root escapes, missing and malformed resources/settings, resolver failures, no installation/network/settings writes, tombstones, public diagnostic consistency, Pi identity delta behavior across npm versions and git protocols, file URLs, tilde paths, and cross-platform false-positive forms.

Acceptance evidence:

- R01-R02 and R10-R11 remain green from 01.01: strict built-in and extension schemas, exact retained strings, actionable legacy migration, and the Claude capability boundary.
- R03-R05 are proven by exact profile source selection, Pi enabled-resource behavior, deterministic ordering, canonical containment/deduplication, trust-scoped project/global resolution, read-only package resolution, and fail-closed exclusion before tmux prerequisites.
- R12 is proven for T01 by one awaited resolved definition and shared diagnostics across listing, permission, spawn preparation, and command callers. Runtime activation and snapshots remain intentionally deferred to T02.
- Project `autoload: false` deltas preserve inherited global resources and project exclusions when Pi identities match, including differently versioned npm sources and different git protocols, while scope-relative and malformed lookalikes fail closed.
- No package install/update, network request, settings write, pane creation, global profile/settings edit, dependency change, or T02 implementation occurred.

Checks:

- `node --test --test-name-pattern='subagent discovery' test/test.ts`: PASS, 54 tests.
- `npm test`: PASS, 185 tests.
- `git diff --check -- pi-extension/subagents/agents.ts pi-extension/subagents/index.ts test/test.ts`: PASS.
- `uv run spec/scripts/manage-spec-item.py --root . validate --item 260909-1952-profile-extension-loading`: PASS.
- `git merge-base --is-ancestor 486f582398eb6a79666e3ec05e868d33546c49eb HEAD`: PASS; the complete T01 boundary includes committed 01.01 plus unstaged 01.02.

Reviews:

- Initial resumed focused review: UNVERIFIED because its turn limit expired before complete `index.ts` and `test.ts` diff coverage. It established no blocking finding; its return-type hardening suggestion was applied, all checks were rerun, and a complete replacement review followed.
- Focused review before the final correction: PASS, no blockers. The later segment Spec finding materially changed delta matching, so the focused review was repeated.
- Initial T01 Standards review: PASS, no findings or uncertainty.
- Initial T01 Spec review: BLOCK because project delta inheritance required identical global/project source strings instead of Pi-equivalent identities. Resolved by comparing the exactly selected project source identity against every configured global source identity, with differing-version npm and differing-protocol git regressions.
- Final focused review: PASS with complete Current coverage, no findings, and only the documented reliance on locked Pi 0.85.1 package identity semantics.
- Final T01 Standards review: PASS with complete checkpoint-to-working-tree coverage, no findings, and no material uncertainty.
- Final T01 Spec review: PASS with complete T01 requirement and omission coverage. It noted only stale progress evidence, resolved by this completion record and index update. Future Pi private identity API drift is fail-closed; current behavior is verified against locked Pi 0.85.1.

Exact next slice: `02.01 - Implement isolated child launch and capability activation`. Do not begin it in this invocation.

## Completion and handoff

On success, record the segment starting checkpoint, changed paths, focused and integrated acceptance evidence, check results, and separate Focused, Standards, and Spec reviewer outputs and resolutions. Check off 01.02 and plan task T01 only after the segment gate passes, then advance Current exactly to `02.01`. Stop for a user-controlled Git checkpoint and suggest Dream; do not commit or invoke Dream automatically.
