# Plan: Create global scout, researcher, worker, flash-reviewer, and twin profiles

Work item: `260909-1928-create-global-scout-researcher-and-worker-profiles`
Status: Planned
Created: 2026-09-09
Updated: 2026-09-10
Assurance: medium - the changes are reversible user configuration, but global capability grants affect every Pi session and the worker and twin retain shell and write access.

## Goal

Create five polished, least-privilege global Pi subagent profiles for repository reconnaissance, source-backed web research, autonomous implementation, fast read-only review, and a main-like twin. Use the native `builtin-tools`, package `extensions`, and `subagent_agents` system without a bridge.

## Context

`~/.pi/agent/agents` resolves into `/Users/dgjalic/.dotfiles/02-agentic-llms/.pi/agent/agents`. At implementation start it contained an invalid empty-body `general.md` and a legacy-schema `scout.md`; the other four profiles were absent. Fresh discovery proved that preserving `general.md` conflicts with the no-diagnostics acceptance criterion, so the user explicitly approved deleting it. The dotfiles repository has unrelated existing changes and currently treats the agent directory as untracked, so implementation must preserve those changes and preview every external write or deletion.

The completed profile-extension work now supports strict built-in grants and read-only resolution of exact configured package extension resources. The retired `tools` field and process-global registration bridge are invalid (`docs/agent-definitions.md`, `spec/archive/260909-1952-profile-extension-loading/outcome.md`). The configured research packages expose `packages/rpiv-web-tools/index.ts` and `index.ts`; together they currently provide `web_search`, `web_fetch`, and `codex_search`.

Current model discovery through installed `@offbynan/pi-cursor-provider` exposes canonical `cursor/gemini-3.8-flash` and `cursor/cursor-grok-4.6-fast`, with Pi `thinking` selecting the effort tier. It also confirms `openai-codex/gpt-5.6-sol`. Gemini 3.8 Flash High is capable enough for fast review, but not reliable enough to treat prompt-only shell restrictions as enforcement. CursorBench 3.2 reports 69.2%; Google's model card reports 73.7% DeepSWE, 89.4% Terminal-Bench 2.1, only 19.1% Terminal-Bench 4.0, and continuing hallucination risk. Therefore flash-reviewer receives no `bash`.

Research sources:

- <https://prod.cursor.com/evals>
- <https://prod.cursor.com/docs/models/gemini-3-8-flash>
- <https://cursor.com/blog/cursorbench>
- <https://deepmind.google/models/model-cards/gemini-3-8-flash/>

## Requirements

- R01: Delete the invalid global `general.md`, refine `scout.md`, and create `researcher.md`, `worker.md`, `flash-reviewer.md`, and `twin.md` under the resolved global agent directory. Preserve every other unrelated file.
- R02: Use only the strict profile fields documented in `docs/agent-definitions.md`, including explicit `builtin-tools`, `system-prompt: append`, and `auto-exit: true`. Do not use legacy `tools` or a registration bridge.
- R03: Configure scout with `model: cursor/gemini-3.8-flash`, `thinking: medium`, `builtin-tools: [read, grep, find, ls]`, and the exact safe Cursor provider package selector in D08. Its concise prompt must prioritize targeted reconnaissance, exact paths and line ranges, observed facts over inference, relevant dependencies, unresolved questions, and a recommended starting point.
- R04: Configure researcher with `model: openai-codex/gpt-5.6-sol`, no built-ins, and the exact configured web-tools and codex-search package selectors in D03. It must directly research, prioritize primary and current sources, reconcile disagreement, cite material claims, and disclose gaps. Do not attach or modify `advanced-web-research`.
- R05: Configure worker with `model: cursor/cursor-grok-4.6-fast`, `thinking: high`, `builtin-tools: [read, write, edit, bash, grep, find, ls]`, the safe Cursor provider selector in D08 followed by both research extensions in D03, and `subagent_agents: [scout, researcher, flash-reviewer]`. It must inspect before editing, use direct web tools when appropriate, make the smallest coherent change, preserve unrelated work, validate proportionally, and retain approval gates for destructive commands, dependencies, external writes, commits, pushes, and scope expansion.
- R06: Configure flash-reviewer with `model: cursor/gemini-3.8-flash`, `thinking: high`, only `builtin-tools: [read, grep, find, ls]`, and the exact safe Cursor provider selector in D08. It must never edit, invoke shell commands, run tests, access the web, or spawn agents. It must verify each material finding against code, prioritize correctness, regression, security, data-loss, and test-gap risks, cite exact evidence, label severity and confidence, avoid unsupported findings and style noise, and report when no material issue is verified.
- R07: Worker may use `web_search`, `web_fetch`, and `codex_search` directly, or delegate deeper research to researcher. It may delegate bounded reconnaissance and review to scout and flash-reviewer. It must provide flash-reviewer with requirements, changed paths, relevant diff excerpts, and verification output because the reviewer cannot run Git or tests itself. It must not poll or fabricate pending results.
- R08: Configure twin with `model: openai-codex/gpt-5.6-sol`, `session-mode: standalone`, worker's coding built-ins, the research extensions in D03, and `subagent_agents: [scout, researcher, worker, flash-reviewer]`. Its prompt must behave like an autonomous main coding agent from a self-contained task, apply repository instructions and approval gates, use direct tools before delegating, and synthesize child results itself.
- R09: No profile may include `twin` in `subagent_agents`. Only the top-level main agent may invoke twin, and twin cannot recursively spawn another twin.
- R10: Treat each selected extension as a complete trusted executable grant, not as a per-tool sandbox. Under current configuration, researcher, worker, and twin must expose `web_search`, `web_fetch`, and `codex_search`; if `codex_standalone_web` or another unexpected research tool is enabled, stop and report instead of broadening scope. `@offbynan/pi-cursor-provider` must register the Cursor provider without registering Pi tools, reject Cursor-native file, shell, and fetch operations, and route only Pi's active tools through MCP.
- R11: Keep all five profile bodies concise, standalone, and role-specific. Do not duplicate the host operating manual or impose rigid output sections where a shorter task-specific response is clearer.
- R12: Make no credential, dependency, package source, or package installation changes. In global settings, replace only stale `cursor/cursor-grok-4.6-high` with canonical `cursor/cursor-grok-4.6-fast`; preserve every other value and unrelated change. Do not run model-consuming smoke tests without separate approval.

## Out of scope

- Changing `advanced-web-research`, other skills, repository runtime source, authentication, credentials, or research package source. No enabled-model setting may change except the exact R12 replacement.
- Creating or modifying any global extension bridge.
- Granting flash-reviewer shell, write, edit, web, or nested-agent capabilities.
- Granting worker permission to spawn twin, or granting twin permission to spawn itself.
- Adding browser automation, image tools, migrations, dependencies, commits, pushes, or unrelated dotfiles cleanup.

## Assumptions

- Exact package sources remain configured as `npm:@offbynan/pi-cursor-provider`, `git:git@github.com:GyroZepelix/rpiv-mono-selfhost-firecrawl@main`, and `git:git@github.com:tejesh0/pi-codex-search@pi_latest_compat`. The unsafe `npm:@akepka/pi-cursor-cli-provider` remains absent. Stop for a plan decision if this changes before implementation.
- The codex-search package's effective trusted configuration leaves `codex_standalone_web` disabled. Verify without modifying configuration.
- Twin is main-like within its explicit profile grants, not an automatic clone of every host extension or future main-agent capability.
- Twin intentionally uses `session-mode: standalone`; callers must provide all necessary context in its task.

## Design

| Profile | Model | Thinking | Built-ins | Extensions | May spawn | Session |
| --- | --- | --- | --- | --- | --- | --- |
| scout | `cursor/gemini-3.8-flash` | medium | `read`, `grep`, `find`, `ls` | safe Cursor provider | none | standalone |
| researcher | `openai-codex/gpt-5.6-sol` | default | none | web-tools, codex-search | none | standalone |
| worker | `cursor/cursor-grok-4.6-fast` | high | `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls` | safe Cursor provider, web-tools, codex-search | scout, researcher, flash-reviewer | standalone |
| flash-reviewer | `cursor/gemini-3.8-flash` | high | `read`, `grep`, `find`, `ls` | safe Cursor provider | none | standalone |
| twin | `openai-codex/gpt-5.6-sol` | default | `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls` | web-tools, codex-search | scout, researcher, worker, flash-reviewer | standalone |

Every child also receives the protected `ask_question` control. Non-empty `subagent_agents` grants the protected spawning controls; those names must not appear under `builtin-tools`.

Researcher and twin use these exact research declarations; worker places the Cursor provider declaration first, then these two entries:

```yaml
extensions:
  - package: git:git@github.com:GyroZepelix/rpiv-mono-selfhost-firecrawl@main
    paths:
      - packages/rpiv-web-tools/index.ts
  - package: git:git@github.com:tejesh0/pi-codex-search@pi_latest_compat
    paths:
      - index.ts
```

Scout and flash-reviewer use this exact declaration; worker uses it before the research declarations:

```yaml
extensions:
  - package: npm:@offbynan/pi-cursor-provider
    paths:
      - index.ts
```

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D01 | Capability system | Use native `builtin-tools`, `extensions`, and `subagent_agents`; no bridge | The repository now implements first-class package extension grants and rejects legacy `tools` | `docs/agent-definitions.md`; archived profile-extension outcome | The profile schema changes |
| D02 | Models | Use canonical provider model IDs and Pi thinking levels for the three Cursor-backed roles | The safe provider deduplicates effort suffixes, and live local model discovery is authoritative | User confirmation; local `pi --list-models`; installed provider model mapping | A selected ID or effort tier becomes unavailable |
| D03 | Research tools | Select the configured web-tools and codex-search entrypoints for researcher, worker, and twin | Exact package selectors provide direct tools without runtime or package edits | Global settings, package manifests, and user confirmation | A package source or resource path changes |
| D04 | Reviewer safety | Give flash-reviewer only read-only repository built-ins and no research extensions or `bash` | Flash is capable, but benchmark success does not make unrestricted shell safe; prompt-only restrictions are not enforcement | User confirmation; CursorBench; Google model card | A genuinely read-only command tool becomes available and is requested |
| D05 | Twin boundary | Use a standalone, main-like twin with coding, web, and bounded delegation, but exclude twin from every nested allowlist | The user explicitly rejected forked context; explicit grants and allowlists still prevent recursive twin spawning | User confirmation; `docs/agent-definitions.md` | Dynamic capability inheritance is implemented and requested |
| D06 | External files | Preserve unrelated dotfiles state; preview exact writes and deletions before approval | Global paths resolve into a dirty dotfiles repository | Current path and Git inspection | The target repository ownership changes |
| D07 | Invalid general profile | Delete the untracked empty-body `general.md` | Current discovery rejects it, while preserving it conflicts with no-diagnostics acceptance; the user approved the exact destructive path | Model-free `discoverAgentDefinitions()` result; user approval | A valid generalist profile is requested later |
| D08 | Cursor provider | Grant exact `npm:@offbynan/pi-cursor-provider` resource `index.ts` to every `cursor/...` profile | Child isolation disables ambient extensions; this direct provider rejects Cursor-native operations and exposes only Pi-controlled active tools through MCP | Global settings, installed package source and manifest, live model list, and user confirmation | Pi gains provider inheritance or the provider behavior changes |
| D09 | Enabled model correction | Replace only `cursor/cursor-grok-4.6-high` with `cursor/cursor-grok-4.6-fast` | The old effort-suffixed ID is absent from the canonical provider registry; Pi thinking carries the high effort | Local settings, live model list, and user confirmation | Provider model mapping changes |

## Work breakdown

- [x] T01: Preflight and approve the safe provider and model corrections
  - Depends on: none
  - Scope: Re-read current targets and staged state; verify the safe provider manifest, source behavior, canonical model IDs, effort mapping, and exact settings mismatch; show exact proposed changes to scout, worker, flash-reviewer, and the one settings string; request external-write approval.
  - Expected areas: `~/.pi/agent/agents/{scout,worker,flash-reviewer}.md`, `~/.pi/agent/settings.json`
  - Acceptance: Existing staged and unrelated dotfiles state is recorded, exact profile and settings edits are reviewable, and the user explicitly approves them.
  - Verification: `readlink ~/.pi/agent/agents`; scoped staged/current hashes; `git -C ~/.dotfiles status --short`; local model and package-resource checks.

- [x] T02: Apply the safe provider and canonical model corrections
  - Depends on: T01
  - Scope: Keep general absent; replace the unsafe provider selector in scout, worker, and flash-reviewer; migrate their model IDs and explicit thinking levels; correct only the stale enabled-model string. Preserve worker web grants, standalone twin, researcher, and every unrelated setting or file.
  - Expected areas: the six approved global profile paths only.
  - Acceptance: `general.md` is absent; frontmatter, prompts, capability sets, package order, session modes, and nested allowlists match the Design table; no unrelated file changes.
  - Verification: Re-read each complete target profile, confirm `general.md` is absent, and inspect scoped dotfiles status and diffs.

- [x] T03: Reverify discovery, provider, web, and negative capability boundaries
  - Depends on: T02
  - Scope: Validate model availability, package resolution, profile discovery, exact grants, provider availability, research-tool activation, reviewer immutability, and twin non-recursion. Run live model tasks only after separate approval.
  - Expected areas: no writes unless an in-scope profile defect is found.
  - Acceptance: A fresh trusted Pi session reports all five definitions without diagnostics and no stale-model warnings; scout and flash-reviewer resolve only the safe Cursor provider; worker resolves safe Cursor provider then both research resources; canonical IDs and thinking levels match the Design table; researcher and twin remain unchanged; only worker and twin have write and shell built-ins; every nested allowlist excludes twin; skipped live checks are recorded honestly.
  - Verification: Commands and observations in the Verification plan.

## Acceptance criteria

- Fresh `subagents_list` output includes valid scout, researcher, worker, flash-reviewer, and twin definitions with exact models, source paths, session modes, built-ins, extension paths, and nested allowlists.
- Scout and flash-reviewer are structurally read-only. Flash-reviewer has no shell, web, or spawning controls beyond protected `ask_question`.
- Researcher has no Pi built-ins and resolves both configured research extension entrypoints.
- Worker may spawn only scout, researcher, and flash-reviewer.
- Twin uses standalone context, coding built-ins, both research extensions, and only the other four profiles. No nested profile can spawn twin.
- Scout, worker, and flash-reviewer resolve exact safe Cursor provider resource `index.ts`. It registers no Pi tools, rejects Cursor-native operations, and exposes only their active Pi tool sets through MCP.
- Current researcher, worker, and twin activation exposes the three requested research tools and no enabled `codex_standalone_web`; any contrary configuration blocks completion pending user direction.
- `general.md` is absent. The one stale enabled-model string is corrected. Every other setting, package source, credential, global extension, and unrelated dotfiles file remains unchanged.
- No model-consuming check runs without explicit approval.

## Testing decisions and seams

Use strict profile discovery, package resolution, and model-free Pi SDK activation as the primary seams. Use exact frontmatter inspection and negative allowlist checks to prove reviewer and twin boundaries. Because `bash` cannot be constrained to read-only commands, safety is enforced by withholding it from flash-reviewer rather than testing prompt compliance. Actual model behavior remains an optional cost-bearing smoke check and must be reported as skipped when not approved.

## Verification plan

1. Confirm all model IDs immediately before writing:
   - `pi --list-models cursor | grep -E 'gemini-3\.8-flash|cursor-grok-4\.6-fast'`
   - `pi --list-models openai-codex | grep -E '(^|[[:space:]])gpt-5\.6-sol([[:space:]]|$)'`
2. Confirm all three exact package sources remain in `~/.pi/agent/settings.json`, the unsafe provider is absent, and the safe Cursor provider plus both research resources exist. Do not install, update, access the network, or write settings except the approved D09 string replacement.
3. Confirm effective codex-search configuration does not enable `codex_standalone_web`; stop if it does.
4. Start a fresh trusted Pi session and run `subagents_list`. Verify all five profiles and diagnostics against the Design table.
5. Check negative boundaries from resolved definitions: reviewer has no `write`, `edit`, `bash`, research extensions, or `subagent_agents`; worker and twin omit twin from their targets; all other profiles also omit twin.
6. Confirm `general.md` is absent and retain its pre-delete checksum in verification evidence.
7. Inspect only the six approved target paths with `git -C ~/.dotfiles status --short`, scoped tracked diffs where available, complete reads for untracked files, and `git diff --check` where applicable. Confirm unrelated pre-existing dotfiles changes are untouched.
8. Validate this item and repository patch integrity:
   - `uv run spec/scripts/manage-spec-item.py --root . validate --item "260909-1928-create-global-scout-researcher-and-worker-profiles"`
   - `git diff --check -- spec`
9. Only with separate approval, run minimal configured-model tasks for each role. Include a bounded review task and a twin delegation task, verify actual model and tool surfaces, and confirm twin cannot spawn twin. Otherwise record these checks as skipped.

## Risks and blockers

- Research extensions execute complete trusted package behavior. Package or effective configuration changes can add tools or hooks. Fail closed on unexpected resolution or active tools.
- Twin has the broadest child capability set but starts standalone. Restrict it to top-level invocation, exclude itself from all nested allowlists, and provide a self-contained task.
- Worker and twin have unrestricted shell and write tools. Prompt guidance preserves approval gates but is not a sandbox.
- The safe Cursor provider is an unofficial complete trusted extension grant that depends on Cursor's private reverse-engineered protocol. Pin exact configured source identity, verify installed behavior, and fail closed if it registers Pi tools or stops rejecting Cursor-native operations.
- Global paths write through a symlink into a dotfiles repository with unrelated changes and untracked directories. Preview exact contents, obtain approval, and never commit or clean unrelated state.
- Cursor and OpenAI model availability can change. Recheck locally before writing and stop rather than substituting a model silently.
- Research tool availability depends on existing credentials and provider health, which this item does not change.

## Progress

- [x] Planning revised and confirmed for five profiles.
- [x] Approved external implementation completed.
- [x] Deterministic verification passed; configured-model smoke was explicitly skipped.
- [x] Initial contract-quality review passed on retry 1 after evidence correction.
- [x] Unsafe Cursor CLI provider behavior identified and rejected by the revised contract-quality review.
- [x] Safe provider selector, canonical model IDs, thinking levels, and enabled-model correction are present and deterministically verified.
- [x] Revised contract-quality review passed on retry 1 after safe-provider correction.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read this plan, item.yaml, and applicable repository instructions completely. Implement the smallest coherent five-profile change at medium assurance while preserving all requirements, exclusions, decisions, and negative capability boundaries. Before any global profile write or deletion, preview the exact action and obtain explicit approval. Delete only the approved invalid general.md and preserve all unrelated dotfiles changes. Run the plan's non-model verification. Stop for unexpected package tools, dependencies, settings changes, other destructive actions, other external writes, commits, pushes, model-consuming tests, or scope expansion. Record only verified evidence, failures, skipped checks, and residual uncertainty.
```

A bounded independent reviewer may inspect the proposed five file contents before external-write approval. It must receive the exact content and return findings only; it must not perform the writes.

## Proposed durable knowledge updates

None. These are user-specific global profiles. Update repository wiki guidance only if implementation exposes a source-verified general limitation in the native profile system.
