# Outcome: Subagent-only capability registry for MCP, extensions, and skills

Work item: `261118-1208-subagent-only-capability-registry-for-mcp-extensions-and-skills`
Disposition: completed
Date: 2026-11-18

## Delivered scope

- R01-R05, R08: global (`<global agents dir>/.pi/`) and trusted-project (`<project>/.pi/agents/.pi/`) subagent registries supply packages, MCP servers, and skills. Lookup is first-hit-wins ahead of ambient sources, anchored to the profile's location, and read-only. Failures are isolated to the profiles that depend on them.
- R06-R07: `skills` resolves to exact skill files passed with `--skill`, replacing the startup `/skill:` prompts (breaking change). `inherit-skills: false` adds `--no-skills`. It is invalid on Claude, AGY, and model-chain profiles.
- R09: a strict version-3 `registry-capabilities` loadout is written only when skill or registry MCP state needs replay. Resume fails closed on missing skill files or changed MCP digests. Version-1, version-2, and legacy snapshots still resume unchanged.
- R10: `docs/agent-definitions.md`, `README.md`, and `skills/subagent-profiles/SKILL.md` were updated together.

## Deviations from plan

None to requirements. Implementation choices are recorded in plan Decision Log D6-D11: registry MCP scopes are `global-registry` and `project-registry`; provider `auth` is rejected in registries; Claude profiles keep accepting `skills` unused; version 3 is written only when needed.

## Verification summary

`npm test` 311/311, MCP capability integration 4/4, approved model-consuming lifecycle integration 8/8, `git diff --check` clean, manual registry check, and a real-agent-dir mirror check. Contract-quality review: PASS with 0 retries. See `verification.md`.

## Retained, reverted, or transferred work

All implementation is retained in the working tree, uncommitted, for a user-controlled checkpoint.

## Residual risks

- D8: with `inherit-skills: true`, a same-named ambient skill in a different file wins over a registry skill in the child, with a Pi collision diagnostic. This is documented; use `inherit-skills: false` when the registry version must win.
- npm and git registry packages, `pi install -l`, and `pi mcp login` against real registry directories were verified from Pi source and local-path fixtures, not by running them against real registries.
- The repository has no TypeScript type-checker.

## Follow-up work items

None required. Optional idea, not added to the backlog: ask upstream Pi for an option that lets CLI `--skill` entries win name collisions.

## Source references

- `pi-extension/subagents/agents.ts`, `index.ts`, `mcp-config.ts`, `session.ts`
- `test/test.ts`, `test/integration/mcp-capability.test.ts`
- `plan.md` (D6-D11), `verification.md`

## Wiki updates

- `wiki/conventions/agent-profiles.md`: added the registries and skills section; updated package and MCP lookup-order statements; added `inherit-skills` to the AGY rejection list.
- `wiki/architecture.md`: launch skill flags, version-3 loadout, resume invariant, package resolution order.
- `wiki/log.md`: appended one update entry.
- Stale-status sweep: 0 hits.
