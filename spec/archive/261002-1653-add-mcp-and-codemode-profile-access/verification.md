# Verification: Add MCP and codemode profile access

Work item: `261002-1653-add-mcp-and-codemode-profile-access`
Date: 2026-10-11

## Environment

- Mode: sliced; assurance: high because MCP grants can start external processes or network connections, reuse credentials, change child capability isolation, and persist across resume.
- Complete implementation boundary: strict-ancestor checkpoint `75166866e769d501a8aaaf02dd851b3bebfae52c` through HEAD `96f10ee36b5510d6a29b76f2cf4524c6d742af2a`, plus the final uncommitted Current 02.02 test, documentation, wiki, and evidence changes.
- T02 boundary: strict-ancestor checkpoint `d4cea5bb4a18fff0cecd6af34194bcc0320a97bb` through the same HEAD and Current changes.
- Prior slice evidence: [01.01](./implementation/01-01-capability-domain.md) and [02.01](./implementation/02-01-runtime-and-replay.md). Final process/documentation evidence: [02.02](./implementation/02-02-integration-docs-verification.md).
- No real user MCP server, settings, authentication file, or credential was used or changed. All lifecycle fixtures used isolated temporary roots and local stdio/HTTP processes.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| `env -u PI_SUBAGENT_ALLOWED node --test --test-name-pattern='subagent discovery\|subagent loadout snapshot\|profile capability activation\|MCP' test/test.ts` | PASS (98/98) | Parser, canonical config/digest, snapshot/replay, launch order, activation, trusted-extension, and drift regressions. |
| `node --test --test-concurrency=1 test/integration/mcp-capability.test.ts` | PASS (2/2) | Selected local process/exposure/resources/prompt behavior; ambient non-start; Pi-native connection/auth diagnostics; shutdown and isolated-root cleanup. |
| `env -u PI_SUBAGENT_ALLOWED npm test` | PASS (266/266) | Complete deterministic unit/source regression suite. |
| Controlled detached tmux: `node --test test/integration/tmux-surface.test.ts` | PASS (9/9) | Pane, focus, input, capture, interruption, and cleanup surface regression. |
| `npm ls @earendil-works/pi-coding-agent @earendil-works/pi-tui typebox` | PASS | Pi coding agent 1.1.0, Pi TUI 1.1.0, TypeBox 1.3.27. |
| `npm pack --dry-run --json` plus allowlist inspection | PASS (22 files) | Required runtime modules, README, and agent-definition docs present; `spec/`, `wiki/`, tests, and repository instructions absent. |
| Changed Markdown relative links, fenced-code balance, and added-ASCII check | PASS | Eight changed user/wiki Markdown files before evidence updates; all local links resolved and fences balanced. |
| `uv run spec/scripts/manage-spec-item.py --root . validate --item 261002-1653-add-mcp-and-codemode-profile-access` | PASS | Active item and protocol structure valid before final evidence consolidation. |
| `git diff --check` | PASS | Patch whitespace/integrity clean before final evidence consolidation. |
| Prior slice checks | PASS | 01.01 and 02.01 packets record focused and full suites plus their required reviews. |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R01 Pi 1.0 baseline | Package/lock changes from 01.01; dependency tree resolves Pi/TUI 1.1.0; full suite and package inspection pass. | PASS |
| R02 profile syntax | Parser tests cover `codemode`, string/array `mcp-servers`, defaults, normalization, and diagnostics; user docs describe both forms. | PASS |
| R03 harness boundary | Unit tests reject MCP grants on Claude, AGY, and model-chain forms, including explicit empty fields; codemode restrictions remain. | PASS |
| R04 trusted MCP resolution | Isolated global/project tests prove trust, project replacement, and runtime-cwd independence; canonical source identity is retained. | PASS |
| R05 fail-closed configuration | Tests cover malformed sources, missing/disabled/invalid entries, namespace conflicts, and project tombstones before pane/connection. | PASS |
| R06 stable server identity | Semantic normalization/digest tests cover key order, formatting equivalence, expression preservation, and ordered exposure precedence; persisted references are non-secret. | PASS |
| R07 filtered child MCP | Protected control verifies exact references and passes an empty ambient loader to Pi; process fixture proves selected startup and ambient non-start/non-registration. | PASS |
| R08 codemode/discovery support | Command/loadout and activation tests prove standalone codemode and exposure-derived support while retaining default-deny launch flags. | PASS |
| R09 exposure integrity | Unit and real SDK lifecycle evidence cover direct, configured codemode/deferred, hidden, mixed per-tool behavior, support activation, and resource tools without blanket promotion. | PASS |
| R10 trusted extension boundary | Registration-order and collision tests reserve selected names while permitting differently named trusted registrations; docs state arbitrary-code caveat. | PASS |
| R11 versioned replay | Strict version 2 `mcp-capabilities` snapshots round-trip and share source/digest preflight across launch/resume; drift/missing/disabled/invalid/source mismatch refuses before pane creation. | PASS |
| R12 compatibility | Version 1 extension-grant and legacy strict snapshots remain readable and retain their existing command paths; byte-preservation tests pass. | PASS |
| R13 runtime failures | Disposable missing-command and local HTTP 401 fixtures produce Pi-native attention/sign-in diagnostics while session startup remains live. | PASS |
| R14 docs and durable knowledge | README, agent-definition reference, architecture/map/development/convention wiki pages, and wiki log match verified source; package contains intended user docs only. | PASS |

## Review findings

- Focused Current review: PASS after retry 1/2. The initial PASS noted a non-blocking temporary-root cleanup gap. The test retained explicitly disposed runtimes for `afterEach` root removal, the integration suite re-passed 2/2, no disposable roots remained, and targeted re-review reported no findings.
- Standards review over T02 and whole-plan: PASS after retry 1/2. The initial PASS noted non-blocking snapshot-mode wording. User/durable docs now identify version 2 as `mcp-capabilities`, Markdown/patch checks passed, and targeted re-review reported no findings.
- Spec review over T02 and whole-plan: PASS on initial review. No blocking findings; its note that final parent verification was pending is resolved by this artifact.
- All reviews used the strict ancestor boundaries above and the credible-harm blocker standard.

## Failures and skipped checks

- Early fixture iterations failed assertions for macOS canonical realpaths, actual Pi diagnostic wording, Pi's internal callable exposure representation, isolated OAuth-store behavior, SDK built-in factory injection, and request-time MCP prompt rendering. These were harness corrections; no production source or canonical contract changed.
- One focused-unit invocation inherited `PI_SUBAGENT_ALLOWED` and failed four allowlist-sensitive tests. The documented isolated invocation with that variable unset passed 98/98; the full suite likewise passed 266/266 with it unset.
- `node --test --test-concurrency=1 test/integration/subagent-lifecycle.test.ts` was not run because it invokes configured models and requires separate approval for model use, time, and cost.
- No commit, push, deployment, publication, Dream run, real-server connection, or user configuration write was performed.
- The initial non-mutating archive preflight was blocked by four literal active-item prefixes in the immutable 01.01 and 02.01 Dream checkpoint pages. Parent-authorized narrow correction changed only those prefixes to the eventual archive location; exact-byte comparison proves all other episode content unchanged, and frontmatter identity, catalog uniqueness/match, ledger routing, fences, write scope, sensitive-pattern scan, ASCII, and Dream diff checks pass. The final non-mutating `archive --check` rerun passed with status `completed` and the intended archive destination. No `outcome.md` or terminal mutation was created.

## Unverified areas

- Live configured-model behavior and real external MCP/OAuth provider interoperability remain unverified by explicit approval gate. Required server filtering, process isolation, prompt metadata, Pi-native failure handling, exposure, resources, replay safety, compatibility, and cleanup are verified with deterministic local non-model evidence.
