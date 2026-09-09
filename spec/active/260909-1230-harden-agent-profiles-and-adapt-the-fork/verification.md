# Verification: Harden agent profiles and adapt the fork

Work item: `260909-1230-harden-agent-profiles-and-adapt-the-fork`
Date: 2026-09-09

## Environment

- Mode: direct
- Starting `HEAD`: `22c823bc2a5022a29d6aa16bd5f6723e6d11e2bc`
- Git repository: available
- Pi runtime: 0.85.1
- Dependencies: installed with the approved lockfile regeneration and `npm ci`
- tmux: available
- Pre-existing changes: `spec/index.md` plus the untracked selected work-item directory, all attributable to this planned item

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| Resolve planned item | PASS | `uv run spec/scripts/manage-spec-item.py --root . resolve --status planned` resolved exactly this item |
| Inspect active Pi runtime and types | PASS | Pi and installed `@earendil-works/pi-coding-agent` are 0.85.1; `ExtensionContext.isProjectTrusted()` and `parseFrontmatter` are available |
| Regenerate and install approved dependencies | PASS | `npm install --package-lock-only --ignore-scripts && npm ci`; 0 vulnerabilities; lifecycle scripts remained subject to npm's local allow-scripts policy |
| Unit suite before focused-review corrections | PASS | `npm test`; 156 tests passed |
| Unit suite after second focused-review corrections | PASS | `npm test`; 163 tests passed after parser, snapshot consistency, fork-prompt, public unresolved-tool, and realpath resume-reservation regressions were added |
| Unit suite after third focused-review corrections | PASS | `npm test`; 167 tests passed after malformed mismatched-override, prototype-safe registry, canonical launch preparation, invalid nested target, and runtime override regressions were added |
| Unit suite after fourth focused-review corrections | PASS | `npm test`; 169 tests passed after ambiguous duplicate-name recovery, empty effective-name, empty runtime cwd, and successful override-normalization coverage was added |
| Unit suite after fifth focused-review corrections | PASS | `npm test`; 171 tests passed after invalid explicit-name identity and collision-safe artifact regressions were added |
| tmux-only suite, initial implementer pane | PASS | `node --test test/integration/tmux-surface.test.ts`; 7 tests passed before focused review |
| tmux-only suite, reviewer narrow pane | FAIL, resolved | Independent reviewer reproduced 5/7 because two additional direct marker assertions remained width-sensitive |
| tmux-only suite, detached 90-column session | PASS | 7/7 after every screen-marker assertion became width-tolerant |
| tmux-only suite, detached 180-column session | PASS | 7/7 in a controlled ordinary-width environment |
| tmux-only suite after third focused-review corrections | PASS | 7/7 in a controlled detached 120-column session |
| tmux-only suite after fourth focused-review corrections | PASS | 7/7 in a controlled detached 120-column session |
| tmux-only suite after fifth focused-review corrections | PASS | 7/7 in a controlled detached 120-column session |
| tmux-only suite, active Pi TUI pane | ENVIRONMENTAL FAIL | 6/7; marker checks passed, but the host TUI competed with the test's active-pane focus assertion. Controlled detached sessions pass at tested widths |
| Package allowlist | PASS | `npm pack --dry-run --json`; 16 entries, required runtime/docs present, no `spec/`, `wiki/`, `test/`, or `AGENTS.md` paths |
| Package and lock metadata | PASS | Root version is 3.7.2; direct development packages target Pi 0.85.1 namespaces; `typebox` is pinned to the installed-compatible 1.3.7 |
| Source syntax | PASS | `node --check` passed for changed production and integration TypeScript entry files |
| Markdown links and fences | PASS | Changed README, docs, and wiki relative links resolve and fences are balanced |
| Patch integrity | PASS | `git diff --check` |
| Work-item schema | PASS | `uv run spec/scripts/manage-spec-item.py --root . validate --item "260909-1230-harden-agent-profiles-and-adapt-the-fork"` |
| Model-consuming lifecycle suite | SKIPPED | No explicit approval for external model calls, time, and cost |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| Pi 0.85.1 namespace and trust API | Updated package imports, manifest, lockfile, and active-context discovery | PASS |
| No bundled profiles | Deleted `agents/*.md`; discovery has no package scope; package allowlist excludes tests and repository-only files | PASS |
| Canonical validated discovery | `pi-extension/subagents/agents.ts` and focused parser, precedence, trust, nearest-directory, identity, malformed-file, duplicate, and delimiter tests | PASS |
| Fail-closed Pi tools | Explicit allowlist always includes only child control plus requested/granted tools; custom extensions preflight before tmux prerequisites | PASS |
| Canonical launch identity | Spawn selects one context-derived `AgentDefinition` and passes it plus a prepared sandbox to launch without filename reconstruction | PASS |
| Nested spawning authority | `subagent_agents` is the sole grant; comma-bearing names and list entries are rejected; `PI_SUBAGENT_ALLOWED` is preserved | PASS |
| Runtime names and resume concurrency | Explicit collisions fail; omitted names suffix; canonical session paths are reserved across concurrent resume launch | PASS |
| Exact resume sandbox | Loadout snapshots exact extension paths, receives structural validation, rejects unrestricted legacy/malformed snapshots, and preflights missing paths before pane creation | PASS |
| Documentation and integration source | Dedicated reference, README, Pi 0.85.1 fixtures, package workflow, and durable wiki pages updated | PASS, model lifecycle execution skipped |

## Review findings

### First focused review

Verdict: BLOCK.

Blocking findings and resolutions:

1. Comma-bearing effective names or YAML-array entries could broaden `PI_SUBAGENT_ALLOWED`. Resolved by rejecting commas in effective names and array entries and adding adversarial tests.
2. Unterminated frontmatter could be accepted as body text. Resolved by requiring opening and closing frontmatter delimiters and adding regression coverage.
3. A fork profile without `system-prompt` lost its body. Resolved by centralizing task construction and retaining body identity in direct fork tasks, with a regression test.
4. Loadouts omitted exact extension paths and lacked structural validation or replay preflight. Resolved by snapshotting paths, validating every loadout field, rejecting unrestricted legacy snapshots, and preflighting path existence before pane creation.
5. Parallel resume calls could launch the same JSONL twice. Resolved with canonical session-path reservations held through running-map registration and released on every failure path, plus normalized-path reservation tests.
6. tmux assertions remained width-dependent. Every screen-marker assertion now uses whitespace-tolerant matching; controlled detached sessions pass 7/7 at both 90 and 180 columns.
7. Plan progress and verification evidence were stale. Progress now reports implementation and verification in progress; this artifact records successes, failures, skips, and review state.
8. Wiki navigation still cited bundled roles and deleted files. `wiki/index.md` and `wiki/conventions/index.md` now route to user-managed profiles, the parser module, and the dedicated reference.

Additional reconnaissance findings resolved during the same correction pass:

- Scalar YAML roots are now rejected as non-mapping frontmatter.
- Invalid same-source duplicates now remove any earlier valid effective-name match regardless of lexical order.
- Pi 0.85.1 `powershell` is recognized as a built-in.
- Tool-schema wording no longer claims hidden profiles appear in `subagents_list`.
- Test samples no longer use deleted bundled-role identities.
- README states Pi 0.85.1 as the verified target rather than claiming an untested later-version range.

### Second focused review

Verdict: BLOCK.

Blocking findings and resolutions:

1. Malformed snapshots could combine spawning tools with null, empty, whitespace, partial, or mismatched spawn targets. Resolved with canonical stored-name validation, spawning-tool cross-checks, required spawning extension preflight, normalized generated snapshots, and adversarial cases.
2. Lexical path normalization allowed real and symlink aliases to reserve the same session separately. Resolved with shared `realpathSync` canonicalization for reservations and running-session comparisons, plus a real-file symlink regression.
3. YAML parser failures lacked a field label. Resolved by labeling them `frontmatter` and strengthening the malformed-YAML assertion.
4. Capitalized bundled-role samples and an obsolete `/iterate fork` comment remained in tests. All test identities are now generic current-contract names, the obsolete comment is removed, and the search passes.
5. `wiki/map.md` still said integration fixtures needed API-drift review. It now states that fixtures follow the current contract and model-consuming execution remains gated.

Non-blocking snapshot findings were also resolved by persisting concrete absolute launch cwd and agent directory values, rejecting empty models and invalid thinking levels, and cross-validating system-prompt identity fields.

### Third focused review

Verdict: BLOCK.

Blocking findings and resolutions:

1. A malformed project file whose filename differed from a safely recoverable declared name could expose the matching global profile. Resolved by recovering explicit names only through Pi YAML parsing of valid frontmatter prefixes, tombstoning that name, suppressing all global definitions when project identity remains uncertain, documenting the conservative behavior, and adding the mismatched malformed-override regression.
2. Runtime name `__proto__` mutated an ordinary registry object's prototype instead of persisting. Resolved by validating registry names and entries, reconstructing validated own data properties, defining writes with `Object.defineProperty`, resolving only own properties, and testing persistence plus explicit and omitted-name collision behavior.
3. Accepted nested target names and whitespace runtime overrides could produce snapshots rejected by the resume validator. Resolved by applying effective-name validation to every `subagent_agents` entry, trimming and rejecting empty runtime model/cwd overrides, building and semantically validating the complete Pi launch loadout before pane prerequisites, and adding targeted regressions.
4. User documentation omitted the `.` and `..` name rejection and overstated snapshot/resume support for Claude. The reference, README, and durable wiki now scope snapshots and finished-session resume to Pi, state Claude non-resumability, and document exact name and runtime override constraints.
5. Filename/name identity coverage stopped at discovery. The production launch preparation path is now a focused seam used by actual spawn execution; its regression starts from a mismatched discovered definition and asserts model, prompt routing, skills, thinking, tools, nesting, cwd, agent directory, loadout identity, and generated sandbox arguments.

The reviewer also identified two non-blocking inaccuracies in repository-only examples. The stale model-cost label and cosmetic-only runtime-name wording were corrected, and the public tool schema wording/test were aligned.

### Fourth focused review

Verdict: BLOCK.

Blocking findings and resolutions:

1. Duplicate or otherwise ambiguous malformed YAML names could be misclassified as one recovered identity. Recovery now treats multiple possible `name` declarations as uncertain, supplements prefix parsing with individually parsed YAML fragments, suppresses all global fallbacks for uncertain project identity, and has a regression proving only valid project neighbors remain.
2. The tmux surface test's own run comment pointed at `npm run test:integration`, which also runs model-consuming lifecycle tests. It now documents the direct non-model `node --test test/integration/tmux-surface.test.ts` command used by README and wiki guidance.
3. Focused tests omitted an empty effective name, empty runtime cwd, and successful model/cwd normalization. Production-path regressions now cover all three plus active-context resolution of a trimmed relative cwd.

The non-blocking suggestion about partially preserving a corrupt mixed registry was not adopted. Registry corruption continues to fail closed as an empty registry rather than trusting a partially valid external JSON object; this does not broaden a resumed child's sandbox.

### Fifth focused review

Verdict: BLOCK.

Blocking findings and resolutions:

1. A valid-YAML explicit `name` with an invalid type fell back to the filename and was marked certain. Invalid explicit name values now mark project identity uncertain, suppressing every global fallback; a mismatched-filename array-name regression proves valid project neighbors remain while globals are hidden.
2. Sanitized runtime-name slugs plus second-resolution timestamps allowed concurrent task, system-prompt, or resume-message artifacts to collide. All three paths now use one helper with artifact kind, millisecond timestamp, and a per-launch UUID. Initial and resumed running IDs also use `randomUUID`; regressions verify slug-colliding names preserve separate identity content and separate task/message paths.
3. `wiki/map.md` now describes runtime `name` as the persistent display and addressing handle rather than cosmetic.

### Final repeated focused review

Verdict: PASS.

Coverage: the independent `generalist` reviewer re-inspected repository instructions, review gates, the complete authoritative plan, updated verification evidence, full diff from `22c823bc2a5022a29d6aa16bd5f6723e6d11e2bc`, all four deletions, all 10 untracked files, production discovery/launch/resume/registry/tooling code, package metadata, README, agent reference, integration fixtures, tests, spec artifacts, and wiki acceptance.

Blocking findings: none.

Non-blocking finding: this plan's stale Progress and Continuation handoff text needed post-PASS refresh. Finalization updates those sections without changing product behavior.

Observed checks: 171/171 unit tests, changed TypeScript syntax, dependency tree, 16-file package allowlist, Markdown links/fences, removed-interface and namespace searches, patch integrity, work-item validation, focused invalid-name and artifact-collision reproductions, and recorded controlled tmux 7/7 evidence all passed. The Git boundary remained unchanged with no staged changes.

Uncertainty: model-consuming lifecycle execution remains intentionally skipped under the approval gate.

## Failures and skipped checks

- An early unit run passed 154/155 because an unknown-agent test leaked a real global profile diagnostic into its expectation. The test was isolated and subsequent suites passed.
- The first tmux-only run and the independent review run each exposed width-sensitive marker assertions in narrow panes. After correcting every marker assertion, controlled detached sessions passed 7/7 at both 90 and 180 columns. Direct invocation from the active Pi TUI later passed all marker behavior but failed one focus assertion because the host TUI competed for pane focus; this environmental result is preserved rather than hidden.
- The model-consuming lifecycle suite remains skipped because the user has not approved external model calls, time, and cost.
- An initial Markdown-link script treated literal prompt text `[Source](url)` in a repository-only agent example as a filesystem link. The corrected checker excludes that placeholder and passes all 22 changed or untracked Markdown files.
- The first empty effective-name regression used `/tmp/.md`, but Node's basename suffix behavior yields `.md` rather than an empty fallback. That test run passed 168/169 after all other corrections; the fixture was changed to an explicit whitespace-only name and subsequent runs pass 169/169.
- The third reviewer staged the working tree despite an explicit read-only instruction. The invocation began with no staged changes; only the Git index was restored to `HEAD`, and all working-tree files and deletions were preserved.
- The fifth reviewer's outer detached-tmux wait wrapper timed out after the captured suite itself had completed 7/7. Implementer-controlled detached wrappers before and after that review completed normally.
- No commit, push, publish, deployment, production action, or installed Pi configuration change was performed.

## Unverified areas

- End-to-end model lifecycle behavior remains unverified because the model-consuming suite was correctly skipped.

## Resolved plan correction

The original Pi 0.65 target conflicted with trust-aware discovery. The user confirmed that the project targets the installed Pi 0.85.1 runtime and approved expanding this item to include the renamed package and API migration. The canonical plan and Decision Log were updated before source edits.

## Interruption handoff: 2026-09-09T14:31:32+02:00

- Starting and current `HEAD`: `22c823bc2a5022a29d6aa16bd5f6723e6d11e2bc`.
- Changes: the complete implementation and documentation working tree described in `plan.md` remains uncommitted and must be preserved.
- Latest checks: 163/163 unit tests pass; detached 90- and 180-column tmux suites pass 7/7; syntax, package allowlist, dependency tree, Markdown links/fences, removed-claim search, diff check, and spec validation pass.
- Preserved failure: direct tmux execution from the active Pi TUI passed marker behavior but failed one focus assertion because the host TUI competed for pane focus.
- Preserved skip: model-consuming lifecycle tests were not run without explicit user approval.
- Review state: first and second focused reviews returned BLOCK. All listed findings have local corrections, but those latest corrections have not received the required complete independent review.
- Blocker: required focused reviewer support has not yet returned PASS, so T01-T07 and final Progress remain unchecked.
- Exact next action: launch a fresh independent read-only `generalist` focused reviewer over the complete diff and all untracked files, including both prior review reports and corrections. Resolve any blocker and repeat checks/review as needed.

## Correction checkpoint: 2026-09-09

- Third focused review: BLOCK with five findings, all corrected and recorded above.
- Latest checks: 167/167 unit tests pass; controlled detached 120-column tmux suite passes 7/7; syntax, dependency tree, 16-file package allowlist, removed-claim and namespace searches, Markdown links/fences, diff check, and spec validation pass.
- Git state: `HEAD` remains `22c823bc2a5022a29d6aa16bd5f6723e6d11e2bc`; all item work remains unstaged and uncommitted after reversing only the reviewer's accidental index staging.
- Preserved skip: model-consuming lifecycle tests remain unrun without explicit approval.
- Blocker: the materially corrected complete diff still requires a repeated independent focused PASS.
- Exact next action: repeat the complete read-only `generalist` focused review from the starting `HEAD`, explicitly including all untracked files without staging them.

## Correction checkpoint after fourth review: 2026-09-09

- Fourth focused review: BLOCK with three findings, all corrected and recorded above.
- Latest checks: 169/169 unit tests pass; controlled detached 120-column tmux suite passes 7/7; syntax, dependency tree, 16-file package allowlist, removed-claim and namespace searches, Markdown links/fences, diff check, and spec validation pass.
- Git state: `HEAD` remains `22c823bc2a5022a29d6aa16bd5f6723e6d11e2bc`; all item work is unstaged and uncommitted.
- Preserved skip: model-consuming lifecycle tests remain unrun without explicit approval.
- Blocker: the corrected complete diff requires another independent focused PASS.
- Exact next action: repeat the complete read-only `generalist` focused review from the starting `HEAD`, including all untracked files without modifying the Git index.

## Correction checkpoint after fifth review: 2026-09-09

- Fifth focused review: BLOCK with three findings, all corrected and recorded above.
- Latest checks: 171/171 unit tests pass; controlled detached 120-column tmux suite passes 7/7; syntax, dependency tree, 16-file package allowlist, removed-claim and namespace searches, Markdown links/fences, diff check, and spec validation pass.
- Git state: `HEAD` remains `22c823bc2a5022a29d6aa16bd5f6723e6d11e2bc`; all item work is unstaged and uncommitted.
- Preserved skip: model-consuming lifecycle tests remain unrun without explicit approval.
- Final review result: PASS with complete diff and untracked-file coverage, no blocking findings, and one finalization-only documentation note.
- Exact next action: refresh plan progress and handoff text, validate the item, and stop for a user-controlled Git checkpoint.

## Finalization: 2026-09-09

- Final independent focused review: PASS with complete implementation, deletion, and untracked-file coverage; no blocking findings remain.
- Plan progress: T01-T07 and both implementation/verification progress entries are checked only after the PASS and green required checks.
- Finalization-only documentation: stale review counts, test counts, handoff state, changed paths, and durable-knowledge status were refreshed.
- Approved-scope validation: 171/171 unit tests, controlled tmux 7/7, syntax, dependency, package allowlist, searches, Markdown, patch integrity, and work-item validation pass.
- Remaining unverified area: model-consuming lifecycle execution, intentionally skipped without explicit approval.
- Handoff: all work remains unstaged and uncommitted for the user's Git checkpoint.
