# Slice 02.02: Prove MCP isolation and complete documentation and verification

Plan: `../plan.md`
Implementation index: `./index.md`
Segment: `T02 - Implement and prove filtered runtime and replay`
Assurance: high - final evidence must prove external process isolation, credential-safe artifacts, exposure integrity, compatibility, and documentation accuracy
Review required now: focused Current review plus separate Standards and Spec reviews over T02 and whole-plan scope

## Outcome

A non-model Pi 1.0 lifecycle fixture proves selected-versus-ambient MCP behavior and exposure, user and durable documentation match verified source, package contents are correct, and all whole-plan checks and high-assurance reviews pass.

## Why this slice exists now

External-process marker fixtures and durable documentation require the stable unit-tested runtime from 02.01. Isolating this work preserves diagnostic attribution between runtime defects and process-level test harness defects while allowing documentation to describe observed behavior rather than intent.

## Relevant context

- Depends on completed 02.01 runtime and the passed T01 segment.
- Complete plan acceptance and R14 govern this slice.
- Use local disposable MCP fixtures and Pi RPC/SDK startup without sending a model prompt.
- Durable wiki changes occur only after source and tests establish current behavior.
- Parent-plan sections to load on conflict or uncertainty: Acceptance criteria, Testing decisions and seams, Verification plan, Proposed durable knowledge updates.

## Constraints and non-goals

- Do not run configured-model lifecycle tests without explicit approval for model use, time, and cost.
- Do not connect real user MCP servers, mutate real MCP/settings/auth files, or reuse real credentials.
- Keep fixtures isolated, bounded, and idempotently cleaned up; assert no leaked server process or marker state.
- Do not broaden scope into per-tool filtering, wildcard grants, additional harnesses, automatic auth/configuration, or unrelated cleanup.
- Do not describe future intent as current wiki knowledge before verification passes.

## Expected source and test areas

- new non-model MCP fixture(s) under `test/integration/`
- `test/integration/mcp-capability.test.ts`
- focused corrections in `pi-extension/subagents/` or `test/test.ts` only when evidence exposes an in-scope defect
- `README.md`
- `docs/agent-definitions.md`
- `wiki/conventions/agent-profiles.md`
- `wiki/conventions/runtime-safety.md`
- `wiki/architecture.md`, `wiki/map.md`, `wiki/development.md` when final module/check changes require them
- `wiki/log.md`, `wiki/state.md` as required by wiki instructions
- package/spec evidence paths

These paths are navigation hints. Inspect other source or tests only when Current or a credible regression path requires it.

## Acceptance and checks

- Acceptance: a selected local MCP server starts and exposes expected direct/codemode/deferred/hidden/mixed tools and resources through Pi-native behavior without a model call.
- Acceptance: an unselected ambient marker server never starts or contributes namespace, descriptions, instructions, tools, resources, or system-prompt metadata.
- Acceptance: connection/auth failure fixtures use Pi-native diagnostics and do not create a custom terminal startup failure.
- Acceptance: teardown leaves no server process, temporary config, marker, or credential artifact outside isolated test roots.
- Acceptance: README and agent-definition docs explain syntax, Pi 1.0 minimum, complete-server grants, project override, trusted-extension caveat, support-tool behavior, disabled/error behavior, digest-pinned resume, and no-secret-copy semantics.
- Acceptance: durable wiki guidance and map/development entries match verified source and cite the spec or source paths where practical.
- Acceptance: package output includes every new runtime file and intended docs while excluding spec, wiki, tests, and repository instructions.
- Check: `node --test --test-concurrency=1 test/integration/mcp-capability.test.ts`
- Check: `npm test`
- Check: in controlled tmux, `node --test test/integration/tmux-surface.test.ts`
- Check: `npm ls @earendil-works/pi-coding-agent @earendil-works/pi-tui typebox`
- Check: `npm pack --dry-run --json` and inspect the package allowlist.
- Check: changed Markdown relative links, fenced-code balance, and ASCII/plain-text consistency.
- Check: `uv run spec/scripts/manage-spec-item.py --root . validate --item 261002-1653-add-mcp-and-codemode-profile-access`
- Check: `git diff --check`

## Review gate

Run one focused review over Current, then one separate Standards review and one separate Spec review expanded over the complete T02 segment and whole-plan acceptance. Reviewers apply the credible-harm blocker standard and do not expand the plan. Implement may rerun an affected gate at most twice after targeted corrections.

## Attempt log

### Attempt 1 - completed

- Starting checkpoint: `96f10ee36b5510d6a29b76f2cf4524c6d742af2a`; both prior Dream checkpoints were strict ancestors and the working tree/index were clean.
- Changed paths: new `test/integration/mcp-capability.test.ts` and `test/integration/fixtures/mcp-marker-server.mjs`; `README.md`; `docs/agent-definitions.md`; `wiki/architecture.md`, `wiki/map.md`, `wiki/development.md`, `wiki/log.md`, `wiki/conventions/agent-profiles.md`, and `wiki/conventions/runtime-safety.md`; this packet, the implementation index, plan progress, and parent `verification.md`.
- Process isolation: a real Pi SDK runtime starts only the selected local stdio marker server, proves mixed direct/codemode/deferred/hidden exposure, support tools, resources, direct calls, and selected-only prompt metadata, and proves the ambient server never starts or registers anything. Local missing-command and HTTP 401 fixtures stay on Pi-native diagnostics without aborting startup.
- Secret and cleanup boundary: capability state excludes the generated credential and config body; all configs, marker files, optional OAuth state, and endpoints remain under disposable roots. Runtime shutdown kills the selected process, records transport shutdown, and post-suite inspection finds no `pi-mcp-capability-*` roots. No real user server, configuration, or credential was read or changed.
- Checks passed: focused MCP integration 2/2; focused whole-plan unit selection 98/98 with inherited `PI_SUBAGENT_ALLOWED` unset; full `npm test` 266/266 with the same unset boundary; controlled detached-tmux surface 9/9; dependency tree at Pi/TUI 1.1.0 and TypeBox 1.3.27; package dry-run with 22 allowlisted files and no spec/wiki/test/instruction payload; changed Markdown links/fences/added-ASCII; item validation; `git diff --check`.
- Diagnostic retries: early fixture-only assertions exposed macOS realpath canonicalization, Pi-native diagnostic wording, Pi's internal mapping of configured codemode exposure, isolated OAuth-store creation, missing SDK built-in factories, and request-time MCP prompt rendering. Each was corrected in the test harness; no production defect or contract change resulted. One focused-unit invocation inherited `PI_SUBAGENT_ALLOWED` and failed 4 allowlist-sensitive tests; rerunning with the documented unset environment passed 98/98.
- Focused review: PASS after retry 1/2. Initial PASS reported a non-blocking disposable-root cleanup gap; the harness retained disposed runtimes for `afterEach` root removal, focused evidence re-passed, and targeted re-review had no findings.
- Standards review over T02 and whole-plan: PASS after retry 1/2. Initial PASS reported non-blocking snapshot-mode terminology; docs now identify version 2 as `mcp-capabilities`, and targeted re-review passed.
- Spec review over T02 and whole-plan: PASS on the initial review with no blocking findings. Its expected note that parent verification was not yet present is resolved by this completion evidence.
- Skipped by approval gate: configured-model `test/integration/subagent-lifecycle.test.ts` was not run. Residual uncertainty is limited to live model/provider and real external MCP behavior; the required filtering, replay, exposure, failure, and process-isolation behavior is covered without model calls.
- Archive-link correction: after the initial helper preflight identified four literal active-item prefixes in the immutable 01.01 and 02.01 Dream checkpoints, the parent authorized the narrow deterministic correction. Exactly those four `spec/active/261002-1653-add-mcp-and-codemode-profile-access/` prefixes now name `spec/archive/261002-1653-add-mcp-and-codemode-profile-access/`; every other byte, frontmatter identity, catalog row, ledger route, and historical narrative is unchanged. Dream exact-byte, identity/catalog/ledger, fence, write-scope, sensitive-pattern, ASCII, and diff checks passed. The final non-mutating `archive --check` rerun passed with destination `spec/archive/261002-1653-add-mcp-and-codemode-profile-access`; no `outcome.md` or terminal mutation was created.

## Completion and handoff

On success, record changed paths, process-isolation evidence, all check results, review verdicts, skipped approval-gated checks, and residual uncertainty. Check `02.02`, set `Current: complete`, and check T02 only after final whole-plan gates pass. Update plan Progress and create or update `verification.md` according to repository protocol. Stop for explicit completion approval before any terminal lifecycle/archive action. Stop for a user-controlled Git checkpoint and suggest Dream without invoking either.
