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

No attempts recorded.

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

## Completion and handoff

On success, record the segment starting checkpoint, changed paths, focused and integrated acceptance evidence, check results, and separate Focused, Standards, and Spec reviewer outputs and resolutions. Check off 01.02 and plan task T01 only after the segment gate passes, then advance Current exactly to `02.01`. Stop for a user-controlled Git checkpoint and suggest Dream; do not commit or invoke Dream automatically.
