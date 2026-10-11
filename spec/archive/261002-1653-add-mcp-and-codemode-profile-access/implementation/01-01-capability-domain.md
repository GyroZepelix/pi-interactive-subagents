# Slice 01.01: Add Pi 1.0 baseline and canonical MCP capability resolution

Plan: `../plan.md`
Implementation index: `./index.md`
Segment: `T01 - Establish the Pi 1.0 capability domain`
Assurance: high - capability selection, project trust, config identity, and credential-safe persistence inputs are security-sensitive
Review required now: focused Current review plus separate Standards and Spec segment reviews

## Outcome

The repository targets Pi 1.0+, and canonical discovery can parse flat-Pi codemode/MCP grants into ordered validated non-secret server references with deterministic digests or actionable fail-closed diagnostics, without connecting servers or mutating configuration.

## Why this slice exists now

Every runtime, snapshot, and resume path depends on one trusted representation of selected MCP server identity. The Pi baseline, schema, precedence, validation, and digest contract must pass together before later slices consume them.

## Relevant context

- R01-R06 and D01-D05, D09-D11 govern this slice.
- Trusted project config overrides matching global names for every profile in the active parent context; runtime cwd overrides do not recompute grants.
- Invalid or disabled project selections block global fallback.
- Digest normalization must preserve semantic order for `toolExposure` patterns while ignoring irrelevant formatting/key order.
- Parent-plan sections to load on conflict or uncertainty: Requirements, Canonical MCP configuration and digesting, Acceptance criteria, Risks and blockers.

## Constraints and non-goals

- Ask before changing dependencies or the lockfile, even though the approved plan requires the Pi 1.0 baseline.
- Do not connect MCP servers, evaluate `${VAR}` or `!command`, read credentials, install packages, or write user/project settings during discovery.
- Do not add MCP runtime control, launch/resume behavior, model-chain support, or documentation projection in this slice.
- Preserve existing profile precedence, malformed-project tombstones, package extension resolution, and non-MCP behavior.

## Expected source and test areas

- `package.json`
- `package-lock.json`
- `pi-extension/subagents/agents.ts`
- new package-owned MCP config/identity helper under `pi-extension/subagents/`
- `test/test.ts`

These paths are navigation hints. Inspect other source or tests only when Current or a credible regression path requires it.

## Acceptance and checks

- Acceptance: `codemode` and `mcp-servers` parse only for flat Pi profiles with deny-all defaults and field-specific diagnostics elsewhere.
- Acceptance: isolated global/project fixtures prove trust, project override, blocked invalid/disabled fallback, exact names, namespace collisions, and runtime-cwd independence.
- Acceptance: selected configs validate against the documented Pi 1.0 shape and produce canonical source path, scope, name, and semantic SHA-256 digest without retaining config/secret values in resolved identity objects.
- Acceptance: semantically equivalent formatting/key-order variants hash equally, while command/URL/exposure/tool-pattern semantic changes hash differently; ordered overlapping `toolExposure` patterns remain order-sensitive.
- Acceptance: existing profile discovery and package extension tests remain green under the Pi 1.0 dependency baseline.
- Check: `node --test --test-name-pattern='subagent discovery|MCP' test/test.ts`
- Check: `npm test`
- Check: `npm ls @earendil-works/pi-coding-agent @earendil-works/pi-tui typebox`
- Check: `git diff --check`

## Review gate

Run one focused review over the slice, then separate Standards and Spec reviews over the complete T01 segment. Reviewers apply the credible-harm blocker standard and do not expand the plan. Implement may rerun an affected gate at most twice after targeted corrections.

## Attempt log

### Attempt 1 - completed

- Starting checkpoint: `75166866e769d501a8aaaf02dd851b3bebfae52c` (the only pre-existing changes were this item's planning artifacts and generated `spec/index.md`).
- Dependency gate: approved for this slice; raised the Pi coding-agent/TUI peer minimum to `>=1.0.0`, set the development baseline to `^1.0.0`, and regenerated the lockfile without unrelated direct dependencies.
- Changed paths: `package.json`, `package-lock.json`, `pi-extension/subagents/agents.ts`, new `pi-extension/subagents/mcp-config.ts`, and `test/test.ts`.
- Acceptance: flat Pi profiles now parse `codemode` and exact ordered `mcp-servers`; unsupported harnesses fail with field diagnostics; trusted global/project resolution produces ordered `{name, source, scope, digest}` identities, preserves project tombstones and runtime-cwd independence, and performs no expression evaluation, connection, or write.
- Digest evidence covers stable formatting/key-order normalization, literal credential expressions, semantic transport/exposure changes, and order-sensitive overlapping `toolExposure` patterns. Direct-only exposure requires no indirect support tool.
- Checks passed: focused discovery/MCP tests (77/77), full `npm test` (257/257, with `PI_SUBAGENT_ALLOWED` unset), dependency tree inspection (Pi/TUI 1.1.0 and deduped typebox 1.3.27), and `git diff --check`.
- Initial focused, Standards, and Spec reviews passed. Implement then corrected direct-only support derivation to avoid activating codemode; affected checks passed again and targeted retry 1/2 for all three gates passed.
- Non-blocking review notes: duplicated MCP-name regex and one unused private helper parameter; optional OAuth fixture depth remains for later test expansion. No blocking findings or residual Current uncertainty beyond runtime behavior assigned to T02.

## Completion and handoff

On success, record changed paths, acceptance, check results, review verdicts, residual uncertainty, and hand off to `02.01`. Update the T01 checkbox in `plan.md` only after the segment gate passes. Update `implementation/index.md` to check `01.01` and set `Current: 02.01`. Stop for a user-controlled Git checkpoint and suggest Dream without invoking either.
