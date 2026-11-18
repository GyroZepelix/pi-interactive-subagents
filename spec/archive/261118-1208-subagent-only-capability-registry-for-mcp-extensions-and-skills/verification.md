# Verification: Subagent-only capability registry for MCP, extensions, and skills

Work item: `261118-1208-subagent-only-capability-registry-for-mcp-extensions-and-skills`
Date: 2026-11-18

## Environment

- Mode: direct (`CURRENT_ID=direct`). Assurance: medium, inherited from `plan.md`.
- Starting boundary: `HEAD` 580496d, nothing staged. `spec/backlog.md` held unrelated user work and stayed byte-identical (sha256 `94ef241f...f361` before and after).
- Node v26.13.0. Dev dependency `@earendil-works/pi-coding-agent` 1.1.0; runtime Pi 1.5.2 was used for the skill-collision probe.
- The implementer ran inside a Pi subagent, so tests ran through a wrapper that unsets inherited `PI_*` variables. Under the inherited env, the unchanged baseline fails one allowlist test because `PI_SUBAGENT_ALLOWED` leaks into it. That failure is environmental and not caused by this change.
- No TypeScript compiler is installed (Node type stripping only), so no type check was run.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| Baseline `npm test` at `HEAD` (clean env) | 304/304 pass | Before any change |
| `npm test` (clean env) | 311/311 pass | 3 obsolete `buildPiPromptArgs` tests replaced by 1 no-`/skill:` guard; 9 new tests (registry packages, MCP, skills, `inherit-skills`, v3 snapshot, resume) |
| `node --test --test-concurrency=1 test/integration/mcp-capability.test.ts` | 4/4 pass | 2 new tests: a registry-only server starts in the child while the shadowed ambient server never starts; a registry HTTP server uses a pre-seeded token from `<agentDir>/mcp-auth.json` |
| `node --test --test-concurrency=1 test/integration/subagent-lifecycle.test.ts` (model-consuming; approved once by user via orchestrator) | 8/8 pass | Real tmux Pi children: spawn, parallel, fork, `ask_question`, project agents, defaults, system prompt |
| `git diff --check` | clean | - |
| Mutation checks | caught | Removing the registry-root filter for auto skills, or removing registry sources from MCP lookup, fails the matching new tests |
| Manual registry check (temp `PI_CODING_AGENT_DIR` with a global registry holding a local package, a stdio MCP server, and a skill) | as expected | `subagents_list` lists the profile and reports `skills` diagnostic for unknown name; command contains `--no-skills`, `--skill <registry SKILL.md>`, registry extension, filtered MCP control; v3 loadout with `global-registry` scope |
| Real agent-dir mirror (read-only symlinks) | matches Pi | Resolved `subagent-profiles`, `imagegen`, `places` to the same files Pi's `DefaultResourceLoader` loads; disabled `cua-driver` unavailable in both; settings mtime unchanged; about 16 ms |
| Skill duplicate probe (`DefaultResourceLoader`, Pi 1.5.2 and 1.1.0) | recorded in D8 | Same file ambient plus `--skill`: loaded once, no diagnostic. Different file, same name, inherit on: ambient wins with collision diagnostic. `--no-skills` plus `--skill`: only listed skills |
| `tmux-surface.test.ts` | not run | Launch delivery (`sendLongCommand`) unchanged; only positional prompt args changed |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R01 Registry locations and trust | `capabilityRegistryDir`; project registry only with trusted `projectAgentsDir`; untrusted test | Pass |
| R02 Lookup order, first hit wins | Package, MCP, and skill precedence tests (project registry > global registry > ambient) | Pass |
| R03 Profile anchoring | Runtime `cwd` override keeps registry extension paths; MCP and skills resolved at discovery only | Pass |
| R04 Extensions | Registry filters (`!disabled.ts`), `paths`, chain targets, invalid and unreadable registry settings tests | Pass |
| R05 MCP | Registry-only grant, override, disabled, missing, collision, provider-auth rejection, broken project registry isolation; child re-verification | Pass |
| R06 Skills as `--skill` | Discovery resolution plus launch flags; no `/skill:` construction in `index.ts`; unknown name diagnostic | Pass |
| R07 `inherit-skills` | Parsing, harness rejection (claude, agy, model-chain), `--no-skills` only when false | Pass |
| R08 Read-only, isolated failures | Settings and `mcp.json` bytes unchanged in tests; unrelated profiles survive broken registries | Pass |
| R09 Resume | v3 round trip and strictness; v2 rejects registry scopes; preflight refuses missing skill and changed registry MCP digest; public resume tool refuses with fresh-spawn guidance; v1 and v2 tests unchanged and passing | Pass |
| R10 Docs | `docs/agent-definitions.md`, `README.md`, `skills/subagent-profiles/SKILL.md` updated together; reviewer confirmed consistency | Pass |
| Acceptance: unchanged profiles | Profiles without registry MCP, skills, or `inherit-skills: false` keep version-2 loadouts and identical flags (D10) | Pass |

## Review findings

- Gate: medium-assurance direct completion, one contract-quality review (`flash-reviewer`, read-only).
- Verdict: PASS on first review; 0 retries. No blocking or non-blocking findings.

## Failures and skipped checks

- Inherited-env baseline failure noted above (environmental).
- `tmux-surface.test.ts` skipped as not applicable.

## Unverified areas

- With `inherit-skills: true`, a registry skill that shares a name with a different ambient skill file loses in the child (Pi collision diagnostic). This is documented, and users are directed to `inherit-skills: false` (D8).
- `pi mcp login` and `pi install -l` against a real registry directory were verified from Pi source (trust requirement) rather than by running them, to avoid writes to user config.
- npm and git registry packages were verified from source and package-manager behavior; tests use local-path packages.
