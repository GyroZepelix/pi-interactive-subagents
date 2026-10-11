# Slice 02.01: Implement filtered child MCP runtime and replay

Plan: `../plan.md`
Implementation index: `./index.md`
Segment: `T02 - Implement and prove filtered runtime and replay`
Assurance: high - child process isolation, MCP exposure, capability activation, and persisted resume are security-sensitive
Review required now: focused Current review

## Outcome

New and resumed flat Pi children use strict loadout version 2 to load codemode and only selected ambient MCP servers through a protected filtered controller, preserve Pi exposure, and refuse source/config drift before pane creation while older snapshots retain their existing paths.

## Why this slice exists now

This slice consumes the verified canonical references from T01 and establishes the complete unit-tested runtime before process-level marker fixtures and durable documentation. Combining all three concerns would make failures difficult to attribute and raise interruption cost.

## Relevant context

- Depends on the passed T01 segment and its exact canonical server-reference contract.
- R07-R13 and D06-D11 govern this slice.
- Explicit load order is runtime control, optional spawning control, required built-in support, filtered MCP control, profile extensions, then capability activation.
- Trusted profile extensions may register additional MCP servers; the filtered controller must reserve selected ambient names first.
- Indirect and hidden MCP tools must never be promoted by blanket profile-extension activation.
- Parent-plan sections to load on conflict or uncertainty: Protected filtered MCP runtime, Activation and exposure, Snapshot and resume, Acceptance criteria, Risks and blockers.

## Constraints and non-goals

- Never load ambient `builtin:mcp` or repoint `PI_CODING_AGENT_DIR`.
- Do not persist MCP config bodies, literal secret values, resolved environment/command values, tokens, or credentials.
- Keep connection/authentication failures Pi-native after identity preflight.
- Preserve valid version-1 and legacy strict loadouts unchanged.
- Do not add external-process integration fixtures, user docs, wiki updates, model-chain support, or model-consuming tests in this slice.

## Expected source and test areas

- `pi-extension/subagents/session.ts`
- `pi-extension/subagents/index.ts`
- `pi-extension/subagents/subagent-protocol.ts`
- `pi-extension/subagents/subagent-capability-activation.ts`
- new protected filtered MCP control under `pi-extension/subagents/`
- canonical MCP helper from T01
- `test/test.ts`

These paths are navigation hints. Inspect other source or tests only when Current or a credible regression path requires it.

## Acceptance and checks

- Acceptance: strict version-2 loadouts round-trip MCP references/support state and reject mixed, unknown, duplicate, noncanonical, incomplete, or inconsistent forms; version 1 and legacy fixtures remain byte-compatible and valid.
- Acceptance: new launch and resume share preflight and command construction, keep `--no-extensions --no-builtin-tools`, explicitly load only required support/control entries, and never load ambient MCP.
- Acceptance: standalone codemode activates; MCP support follows selected exposure; direct tools activate while codemode/deferred/hidden/resource behavior remains native.
- Acceptance: MCP-control-owned tools are excluded from blanket profile extension activation, while later tools from trusted profile extensions and intentional overrides retain existing behavior.
- Acceptance: exact source/digest drift, missing/disabled/invalid entries, and protected path failures refuse resume before pane creation with fresh-spawn guidance.
- Acceptance: selected ambient names cannot be silently replaced by later profile-extension registrations, while differently named trusted registrations remain allowed.
- Acceptance: unit fixtures and serialized state contain no selected config bodies or credential material.
- Check: `node --test --test-name-pattern='subagent loadout snapshot|subagent discovery|profile capability activation|tool registration|MCP' test/test.ts`
- Check: `npm test`
- Check: `git diff --check`

## Review gate

Run one focused review over Current. Reviewers apply the credible-harm blocker standard and do not expand the plan. Implement may rerun the affected gate at most twice after targeted corrections.

## Attempt log

No attempts recorded.

## Completion and handoff

On success, record changed paths, acceptance, check results, focused-review verdict, residual uncertainty, and hand off to `02.02`. Leave T02 unchecked until final segment and whole-plan gates pass. Update `implementation/index.md` to check `02.01` and set `Current: 02.02`. Stop for a user-controlled Git checkpoint and suggest Dream without invoking either.
