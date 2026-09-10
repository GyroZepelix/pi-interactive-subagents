# Slice 02.02: Add versioned snapshots and safe legacy/new resume

Plan: `../plan.md`
Implementation index: `./index.md`
Segment: `T02 - Implement and verify the complete capability lifecycle`

## Outcome

New capability loadouts round-trip and resume through a strict versioned extension-grant mode, while valid existing strict-tool snapshots remain readable and resume through their unchanged legacy restriction path.

## Why this slice exists now

The persisted schema must encode the verified launch behavior from 02.01. This slice completes T02 by unifying initial launch and resume application without broadening malformed, missing, or legacy capability state.

## Relevant context

- Requirement R09: new sidecars identify version/mode, selected built-ins, and exact ordered absolute extension paths; resume validates paths before pane creation and does not reread profile/package settings.
- Requirement R10: valid current strict `toolAllowlist` snapshots remain resumable through `--tools` and are not automatically rewritten.
- Requirement R08: snapshot state must preserve whether nesting controls and `PI_SUBAGENT_ALLOWED` are restored.
- Requirements R06-R07: replay preserves framework-first extension order and the same selected built-ins plus complete declared extension grants as initial launch.
- Decisions D10/D14: use current contents at valid stored paths and preserve legacy strict snapshot compatibility.
- Security invariant: a missing, malformed, unknown-version, incomplete, or path-invalid snapshot refuses resume before pane creation rather than falling back to defaults.
- Segment acceptance contribution: completes the durable launch/resume capability lifecycle and T02 gate.
- Parent-plan sections to load on conflict or uncertainty: Requirements R06-R10; Design "Child launch and activation" and "Versioned loadouts"; Decision Log D10, D14-D15; T02 acceptance and risks.

## Constraints and non-goals

- Define a strict structural union. Do not ambiguously infer new mode from partially present fields.
- Preserve all existing model, thinking, identity, spawnable, auto-exit, cwd, and agent-directory validations.
- New resume replays snapshot state only. Do not read the current profile or package settings and do not install missing resources.
- Validate every stored extension path and framework requirement before creating a tmux surface.
- Do not hash extension contents or claim immutability. Current code at a valid stored path is intentional.
- Do not rewrite existing legacy sidecars.

## Expected source and test areas

- `pi-extension/subagents/session.ts`
- `pi-extension/subagents/index.ts`
- `test/test.ts`

These paths are navigation hints. Inspect other relevant source or tests when justified by the bounded outcome.

## Acceptance

- New sidecars contain an explicit supported version/capability mode, selected built-ins, ordered absolute extension paths, and the existing launch state needed for faithful replay.
- The reader rejects unknown fields, unsupported versions/modes, malformed built-ins, duplicate or relative paths, inconsistent nesting state, and incomplete mode-specific fields.
- New-mode launch and resume share one command/capability application path and reproduce framework-first ordering, selected built-ins, extension order, and nested-agent restrictions.
- Resume succeeds independently of changed or deleted profiles and changed package settings when stored paths remain valid.
- Resume uses current installed contents at stored paths and refuses missing/non-file/otherwise invalid paths before pane creation.
- Valid legacy strict snapshots still round-trip and resume with `--no-extensions`, strict `--tools`, and exact legacy extension paths; they are not rewritten.
- Missing or corrupt snapshots and malformed union members remain fail-closed.
- Existing session, registry, resume-concurrency, shell, launch, and lifecycle-independent unit tests remain green.

## Focused checks

- `node --test --test-name-pattern='session.ts|subagent discovery|subagent-done.ts' test/test.ts`
- `git diff --check -- pi-extension/subagents/session.ts pi-extension/subagents/index.ts pi-extension/subagents/subagent-done.ts test/test.ts`

## Focused review

Ask one independent read-only reviewer to inspect the Current slice, its complete diff, applicable repository instructions, correctness, regressions, maintainability, and scoped acceptance. Resolve every blocking finding before completion.

## Segment gate

Run the segment's integrated acceptance and appropriate regression checks, then launch independent read-only Standards and Spec reviewers. Resolve blocking findings before checking off the segment and matching plan task.

- Integrated checks: `node --test --test-name-pattern='session.ts|subagent discovery|subagent-done.ts|tool registration' test/test.ts`, `npm test`, and in a controlled tmux session `node --test test/integration/tmux-surface.test.ts`
- Segment acceptance: Prove R06-R10 and R12 across initial launch and both snapshot modes, including activation timing, extension ordering, missing-path refusal, nesting, removed interfaces, and unchanged legacy strict replay. Standards and Spec reviews inspect the complete T02 diff from its recorded segment checkpoint.

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

On success, record the segment starting checkpoint, changed paths, focused and integrated acceptance evidence, check results, and separate Focused, Standards, and Spec reviewer outputs and resolutions. Check off 02.02 and plan task T02 only after the segment gate passes, then advance Current exactly to `03.01`. Stop for a user-controlled Git checkpoint and suggest Dream; do not commit or invoke Dream automatically.
