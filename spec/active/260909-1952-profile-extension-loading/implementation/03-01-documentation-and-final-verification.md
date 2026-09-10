# Slice 03.01: Update documentation and run final verification

Plan: `../plan.md`
Implementation index: `./index.md`
Segment: `T03 - Document the final contract and prove the complete change`

## Outcome

User documentation and durable wiki memory describe the verified profile-extension contract, and the complete implementation passes all safe repository, package, Markdown, and review gates without changing global profiles or third-party settings.

## Why this slice exists now

Documentation must follow the verified T01/T02 behavior rather than predict it. This final slice also retains enough room for package inspection, full regression checks, whole-plan reviews, and corrections across all three segments.

## Relevant context

- Requirement R13: document schema, defaults, package scope, ordering, diagnostics, migration, launch/resume, Claude rejection, and the arbitrary-code trust boundary; update durable wiki knowledge only after verification establishes current behavior.
- Requirements R01-R12: documentation must match the implemented vocabulary and lifecycle exactly, without restoring rejected aliases, per-tool extension claims, or immutable-resume claims.
- Decisions D01-D15: preserve every confirmed migration, selection, capability, trust, collision, and compatibility decision in user-facing wording where relevant.
- Out-of-scope boundary: do not create or edit the blocked global scout/researcher/worker profiles, Pi settings, or third-party packages.
- Verification boundary: the tmux surface suite is non-model but environment-sensitive; the configured-model lifecycle suite remains separately approval-gated.
- Segment acceptance contribution: completes T03 and the whole plan through documentation, durable memory, packaging, regression, and independent review.
- Parent-plan sections to load on conflict or uncertainty: all Requirements, Out of scope, Design, Decision Log, Acceptance criteria, Testing decisions and seams, Verification plan, Risks and blockers, and Proposed durable knowledge updates.

## Constraints and non-goals

- Read `wiki/index.md` and `wiki/AGENTS.md` before wiki edits. Update `wiki/log.md` and `wiki/state.md` only as required by the wiki protocol.
- Prefer verified source at HEAD over prior wiki wording. Mark uncertainty rather than presenting unverified behavior as current truth.
- Remove obsolete `tools`, hardcoded mapping, and registration-hook instructions while providing explicit migration guidance.
- Clearly state that selected extensions execute arbitrary trusted code and may register hooks, tools, commands, providers, or change active tools.
- Do not run model-consuming lifecycle tests, install dependencies, perform external writes, commit, push, or alter global profile/settings files without approval.

## Expected source and test areas

- `README.md`
- `docs/agent-definitions.md`
- `wiki/index.md`
- `wiki/AGENTS.md`
- `wiki/conventions/agent-profiles.md`
- `wiki/conventions/runtime-safety.md`
- `wiki/log.md`
- `wiki/state.md`
- `package.json`
- `test/test.ts`
- Implementation source only for corrections required by final checks or reviews

These paths are navigation hints. Inspect other relevant source or tests when justified by the bounded outcome.

## Acceptance

- README and `docs/agent-definitions.md` completely describe `builtin-tools`, structured package `extensions`, defaults, validation, exact source/path matching, enabled-resource behavior, trust scope, ordering/deduplication, arbitrary-code grants, framework controls, Claude rejection, versioned/legacy resume, and migration from `tools`.
- Obsolete hardcoded custom-tool mappings and `registerToolExtension` usage are absent from source, tests, and user documentation.
- Relevant wiki convention pages describe verified current behavior with source provenance, and wiki log/state maintenance follows scoped instructions.
- `npm test` passes.
- The controlled non-model tmux surface suite passes where the environment is available, or an explicit environmental limitation is recorded without substituting model-consuming tests.
- Package dry-run contents include the intended runtime files and user docs and exclude `spec/`, `wiki/`, tests, and repository instructions.
- Changed Markdown has valid relative paths, balanced fences, and required ASCII/plain-text consistency.
- Spec validation and `git diff --check` pass.
- No global profiles, user/global settings, third-party packages, dependencies, or blocked-item artifacts are changed.

## Focused checks

- `git grep -n -E 'registerToolExtension|EXTRA_TOOL_EXTENSIONS|getToolExtensionPath' -- pi-extension test README.md docs`
- Check relative links and fenced-code balance in changed Markdown.
- `git diff --check -- README.md docs wiki`

## Focused review

Ask one independent read-only reviewer to inspect the Current slice, its complete diff, applicable repository instructions, correctness, regressions, maintainability, and scoped acceptance. Resolve every blocking finding before completion.

## Segment gate

Run the segment's integrated acceptance and appropriate regression checks. On this final slice, use the same independent Standards and Spec reviewer pair with the expanded Whole-plan scope below. Do not launch a second pair. Resolve blocking findings before checking off the segment and matching plan task.

- Integrated checks: documentation comparison against source, removed-interface search, Markdown checks, package dry-run inspection, spec validation, and `git diff --check`
- Segment acceptance: Prove R13 and confirm documentation and durable knowledge accurately describe the verified implementation without changing out-of-scope files.

## Whole-plan gate

Expand verification to whole-plan acceptance and full relevant regression checks, and expand the same Standards and Spec pair over both final-segment and whole-plan scope. Do not launch a second pair.

- Whole-plan checks: `npm test`; in controlled tmux `node --test test/integration/tmux-surface.test.ts`; `npm pack --dry-run --json`; `git grep -n -E 'registerToolExtension|EXTRA_TOOL_EXTENSIONS|getToolExtensionPath' -- pi-extension test README.md docs`; changed-Markdown path/link/fence checks; `uv run spec/scripts/manage-spec-item.py --root . validate --item 260909-1952-profile-extension-loading`; `git diff --check`
- Whole-plan acceptance: Prove every plan acceptance criterion across T01-T03, inspect the complete diff from the implementation starting checkpoint, confirm all safe checks and package contents, resolve expanded Standards and Spec findings, and record any environment-limited check accurately. Do not run `test/integration/subagent-lifecycle.test.ts` without explicit approval.

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

On success, record the implementation and segment starting checkpoints, changed paths, focused/segment/whole-plan acceptance evidence, every check result, package inspection, and separate Focused plus expanded Standards and Spec reviewer outputs and resolutions. Check off 03.01 and plan task T03, then set `Current: complete` only after every final gate passes. Stop for a user-controlled Git checkpoint and suggest Dream; do not commit or invoke Dream automatically.
