# Plan: Create global scout, researcher, and worker profiles

Work item: `260909-1928-create-global-scout-researcher-and-worker-profiles`
Status: Planned
Created: 2026-09-09
Updated: 2026-09-09

## Goal

Create three concise, least-privilege global Pi subagent profiles for repository reconnaissance, source-backed web research, and autonomous implementation, with current Cursor models and working access to the requested research tools.

## Context

The global Pi agent directory is `~/.pi/agent/agents`, currently a symlink to `/Users/dgjalic/.dotfiles/02-agentic-llms/.pi/agent/agents`. It contains `general.md` and an existing `scout.md`; `researcher.md` and `worker.md` are absent. The user confirmed that `general.md` must remain unchanged, `scout.md` should be refined in place, and the two missing profiles should be added.

Local model discovery with `pi --list-models cursor` confirms these selectable IDs: `cursor/gemini-3.8-flash-medium`, `cursor/gpt-5.6-sol-high-fast`, and `cursor/cursor-grok-4.6-high-fast`. The effort level is encoded in each Cursor model ID, while Pi reports these variants as not exposing a separate thinking control, so the profiles should omit `thinking`.

The installed `pi-interactive-subagents` extension launches named profiles with `--no-extensions` and requires every non-built-in tool to resolve to a backing extension before pane creation (`docs/agent-definitions.md`, `pi-extension/subagents/index.ts`). The requested `web_search`, `web_fetch`, and `codex_search` implementations are installed, but their current entrypoints do not call the extension's `registerToolExtension` hook. The legacy built-in paths for `web_search` and `web_fetch` are also absent, and `codex_search` has no built-in mapping. Therefore a small global bridge extension is required to register all three installed entrypoints during `session_start`; otherwise the researcher profile would fail preflight before invoking its model.

The existing `advanced-web-research` skill is intentionally not attached. Its workflow delegates through an unavailable `Agent` tool to a `general-purpose` profile, whereas the new researcher will perform a concise evidence-first workflow directly with its own three web tools. The advanced skill may invoke the new researcher in a separately updated workflow later.

External evidence supports GPT-5.6 Sol for evidence-heavy research. OpenAI reports 90.4% BrowseComp for the single-model Sol setup and strong document, scientific, and long-context results. In the matched-high Artificial Analysis comparison, Sol leads Grok on Humanity's Last Exam, GDP.pdf, CritPt, and long-context reasoning, while Grok leads overall agentic knowledge work and knowledge reliability. CursorBench is coding-focused and favors Grok 4.6 High over GPT-5.6 Sol High, reinforcing Grok for the worker rather than overturning the research choice. Cursor pricing makes Sol materially more expensive, which is accepted for the specialized researcher role.

Sources:

- <https://cursor.com/docs/models-and-pricing>
- <https://cursor.com/cursorbench>
- <https://openai.com/index/gpt-5-6/>
- <https://x.ai/news/grok-4-6>
- <https://artificialanalysis.ai/models/comparisons/grok-4-6-vs-gpt-5-6-sol-high>

## Requirements

- Refine `~/.pi/agent/agents/scout.md` in place and create `researcher.md` and `worker.md` in the same global directory.
- Preserve `~/.pi/agent/agents/general.md` unchanged.
- Keep all three definitions valid under the strict profile schema in `docs/agent-definitions.md`: delimited YAML frontmatter, known fields only, non-empty body, explicit tool lists, `system-prompt: append`, and `auto-exit: true`.
- Configure scout with `model: cursor/gemini-3.8-flash-medium` and only `read`, `grep`, `find`, and `ls` as ordinary tools.
- Make scout read-only in both metadata and prompt. It should quickly locate relevant files, follow only necessary code paths, distinguish observed facts from inference, cite exact paths and line ranges, and return a short map plus recommended starting point.
- Configure researcher with `model: cursor/gpt-5.6-sol-high-fast` and only `web_search`, `web_fetch`, and `codex_search` as ordinary tools.
- Give researcher a concise direct workflow that frames the question, batches related queries with `codex_search`, uses `web_search` for complementary discovery, fetches the strongest primary sources, checks recency and disagreement, and produces a direct answer with claim-level links, a sources list, and explicit gaps.
- Do not attach or modify `advanced-web-research` in this item.
- Configure worker with `model: cursor/cursor-grok-4.6-high-fast`, ordinary tools `read`, `write`, `edit`, `bash`, `grep`, `find`, and `ls`, and `subagent_agents: [scout, researcher]`.
- Make worker follow applicable repository instructions, inspect relevant source and tests before editing, make the smallest coherent change, preserve unrelated work, validate proportionally, report exact changed paths and checks, and ask the parent rather than guess when a material requirement is blocked.
- Allow worker to delegate only bounded reconnaissance to scout and external research to researcher. It must not poll spawned agents or fabricate pending results.
- Keep profile bodies polished and concise. Avoid duplicating the host's full operating manual or prescribing rigid output sections when a shorter task-specific report is clearer.
- Create one global bridge extension at `~/.pi/agent/extensions/subagent-research-tools.ts` that uses the documented process-global `__pi_interactive_subagents.registerToolExtension` hook during `session_start` to register:
  - `web_search` and `web_fetch` to `/Users/dgjalic/.pi/agent/git/github.com/GyroZepelix/rpiv-mono-selfhost-firecrawl/packages/rpiv-web-tools/index.ts`.
  - `codex_search` to `/Users/dgjalic/.pi/agent/git/github.com/tejesh0/pi-codex-search/index.ts`.
- Make bridge registration idempotent through the existing registration API, fail with an actionable message if the hook or an entrypoint is unavailable, and avoid registering `codex_standalone_web`.
- Do not add model overrides, credentials, dependencies, or package configuration changes.

## Out of scope

- Modifying `advanced-web-research` or any other skill.
- Changing `general.md`, Pi's enabled-model list, provider authentication, web-tool credentials, or web-tool settings.
- Adding `codex_standalone_web`, browser automation, image tools, shell access to researcher, or web access directly to worker.
- Modifying this repository's subagent runtime, the installed web-tools package, or the installed codex-search package.
- Broad prompt-framework refactoring, new dependencies, migrations, commits, pushes, or production actions.
- Running model-consuming smoke tests without explicit approval during implementation.

## Assumptions

- The installed Git checkout entrypoints remain at the confirmed absolute paths. Revisit the bridge design if Pi moves or reinstalls either package elsewhere.
- The current Pi extension load sequence imports all extension modules before `session_start`, so registering from a global extension's `session_start` handler sees the process-global subagent hook. Verify this before relying on the bridge; stop rather than weakening tool isolation if it is false.
- Cursor model IDs reported by the local `pi --list-models cursor` command are authoritative for this installation. Revisit only if model discovery changes before implementation.
- Cursor's 200K effective context shown locally applies to all three selected slugs even where first-party APIs advertise larger windows.
- `ask_question` is added automatically by the subagent extension and must not be listed under `tools`.
- The user accepts GPT-5.6 Sol's higher usage cost for a specialized evidence-heavy researcher.
- Global configuration writes are outside the current repository. A later implementation session must preview the exact four target files and obtain the required external-write approval immediately before modifying them.

## Design

Use one focused profile per role with capability enforced in frontmatter and behavior reinforced in a short appended system prompt.

`scout.md` remains a disposable read-only reconnaissance agent. Its prompt should prioritize targeted search, selective reading, exact evidence, dependency relationships, unresolved questions, and a clear starting point. It must not run builds or tests because it has no `bash` tool.

`researcher.md` performs research directly instead of delegating. It should choose tools by purpose: `codex_search` for source-backed batched searching, `web_search` for complementary discovery or current provider-specific coverage, and `web_fetch` for reading selected authoritative pages. The final brief should answer first, cite each material claim, separate primary from secondary evidence, disclose conflicts and gaps, and avoid padding.

`worker.md` is the only editing profile. It gets the built-in local coding tools and a nested allowlist restricted to scout and researcher. Its prompt should preserve autonomous implementation behavior while retaining safety gates for destructive actions, dependencies, external writes, commits, pushes, and material scope expansion. Delegation remains optional and bounded rather than mandatory.

The bridge extension contains no research logic. On `session_start`, it resolves the existing global hook, verifies the three entrypoint files, and registers tool-name-to-entrypoint mappings. The subagent launcher then snapshots and passes only those exact extension paths into the researcher's restricted child process. This preserves fail-closed tool isolation and avoids changing installed package sources.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D01 | Roles | Use least-privilege scout, researcher, and worker profiles | The user selected capability separation over broad access | Confirmed clarification; `docs/agent-definitions.md` | A role requires a capability currently delegated elsewhere |
| D02 | Scout model | Use `cursor/gemini-3.8-flash-medium` | The user selected medium as the speed-quality balance, and the local provider exposes explicit effort slugs | Confirmed clarification; `pi --list-models cursor` | Cursor removes or renames the slug |
| D03 | Research model | Use `cursor/gpt-5.6-sol-high-fast` | Sol has stronger evidence for retrieval-heavy, document, scientific, and long-context research; Fast preserves responsiveness | OpenAI release, Artificial Analysis comparison, local model list | A controlled research-and-citation evaluation or provider change materially reverses the evidence |
| D04 | Worker model | Use `cursor/cursor-grok-4.6-high-fast` | User requested Grok for worker, and current coding/agentic evidence supports it | Confirmed request; CursorBench; xAI release | The user changes the worker objective or model |
| D05 | Research workflow | Give researcher direct web tools and no skill | The installed advanced skill expects incompatible delegation and is intentionally separate | Confirmed follow-up; `/Users/dgjalic/.pi/agent/skills/advanced-web-research/SKILL.md` | The skill is redesigned for these Pi subagents |
| D06 | Tool registration | Add one global registration bridge instead of editing installed package sources | Current fail-closed preflight cannot resolve the requested tools, while the runtime exposes a registration hook for this purpose | `pi-extension/subagents/index.ts`; installed tool entrypoints | Tool packages self-register or the subagent runtime gains generic origin discovery |
| D07 | Existing config | Preserve `general.md`, refine scout, add researcher and worker | Avoids unrelated changes and follows the user's conflict preference | Global agent inventory; confirmed clarification | The user requests inventory consolidation |

## Work breakdown

- [ ] T01: Preview and safeguard the external configuration change
  - Depends on: none
  - Scope: Re-read the four target paths, confirm current symlink resolution and Git state, show the exact proposed profile and bridge contents, and obtain external-write approval before editing.
  - Expected areas: `~/.pi/agent/agents/{scout,researcher,worker}.md`, `~/.pi/agent/extensions/subagent-research-tools.ts`
  - Acceptance: Existing content and ownership are known, `general.md` is excluded, unrelated changes are identified, and the user approves the concrete external write.
  - Verification: `readlink ~/.pi/agent/agents`; `git -C ~/.dotfiles status --short`; read each existing target that is present.

- [ ] T02: Install the research-tool registration bridge
  - Depends on: T01
  - Scope: Create the one global extension that validates and registers the installed `web_search`, `web_fetch`, and `codex_search` entrypoints during `session_start`.
  - Expected areas: `~/.pi/agent/extensions/subagent-research-tools.ts`
  - Acceptance: The bridge is syntactically valid, references the confirmed entrypoints, emits actionable failures, and does not grant or register unrelated tools.
  - Verification: `node --check ~/.pi/agent/extensions/subagent-research-tools.ts`; verify all referenced entrypoint files exist; inspect a fresh Pi session for bridge load errors.

- [ ] T03: Create the three concise role profiles
  - Depends on: T01, T02
  - Scope: Refine scout in place and add researcher and worker with the confirmed models, least-privilege tools, nesting boundary, lifecycle fields, and concise role prompts.
  - Expected areas: `~/.pi/agent/agents/scout.md`, `~/.pi/agent/agents/researcher.md`, `~/.pi/agent/agents/worker.md`
  - Acceptance: All three parse without diagnostics, expose the exact models and tool sets, worker may spawn only scout and researcher, and `general.md` is byte-for-byte unchanged.
  - Verification: Run `subagents_list` in a fresh trusted Pi session and inspect model/tool/nesting output; compare a pre/post checksum of `general.md`; inspect the resolved dotfiles diff.

- [ ] T04: Verify fail-closed behavior and record gated checks
  - Depends on: T02, T03
  - Scope: Confirm local model availability, tool registration preflight, profile discovery, and diff hygiene. Run one minimal role smoke test only if the user separately approves model calls and cost.
  - Expected areas: No changes unless verification exposes an in-scope defect in one of the four global files.
  - Acceptance: Static and fresh-session checks pass with no profile or bridge diagnostics; skipped model-consuming checks are reported honestly.
  - Verification: Commands and manual checks in the Verification plan.

## Acceptance criteria

- Fresh `subagents_list` output includes valid `scout`, `researcher`, and `worker` definitions with no diagnostics.
- Scout resolves to `cursor/gemini-3.8-flash-medium` and has only read-only repository tools plus the automatically added `ask_question` control tool.
- Researcher resolves to `cursor/gpt-5.6-sol-high-fast` and preflight resolves exactly `web_search`, `web_fetch`, and `codex_search` plus `ask_question`.
- Worker resolves to `cursor/cursor-grok-4.6-high-fast`, has local coding tools, and receives spawning tools restricted to `scout` and `researcher`.
- Profile prompts are concise, standalone, role-specific, and aligned with least privilege.
- Researcher directly produces source-backed briefs and does not load `advanced-web-research`.
- The bridge registers only the three approved research tools and preserves the subagent runtime's fail-closed `--no-extensions` launch behavior.
- `general.md`, provider settings, credentials, installed package sources, and unrelated global files remain unchanged.
- No model-consuming check is run without explicit approval.

## Testing decisions and seams

- Treat `subagents_list` in a fresh Pi session as the public profile-schema and discovery seam; it reports exact definitions and diagnostics without invoking a child model.
- Treat researcher spawn preparation as the tool-resolution seam. A launch rejection naming an unresolved tool is a failure; a pane reaching provider invocation proves preflight succeeded but incurs model usage and therefore remains approval-gated.
- Use `node --check` and file-existence checks for the small bridge before loading it in Pi.
- Compare the resolved dotfiles Git diff to prove only the three intended profile definitions changed there.
- Capture a checksum of `general.md` before and after implementation to make preservation observable.
- Do not add repository tests for user-specific absolute paths or global configuration.

## Verification plan

1. Confirm selected models remain available:
   - `pi --list-models cursor | grep -E 'gemini-3\.8-flash-medium|gpt-5\.6-sol-high-fast|cursor-grok-4\.6-high-fast'`
2. Confirm all bridge entrypoints exist:
   - `test -f ~/.pi/agent/git/github.com/GyroZepelix/rpiv-mono-selfhost-firecrawl/packages/rpiv-web-tools/index.ts`
   - `test -f ~/.pi/agent/git/github.com/tejesh0/pi-codex-search/index.ts`
3. Check bridge syntax:
   - `node --check ~/.pi/agent/extensions/subagent-research-tools.ts`
4. Start a fresh Pi session, run `subagents_list`, and verify all three profiles appear with the exact models, tool lists, source paths, and worker nesting allowlist, with no diagnostics.
5. Confirm `general.md` retains its pre-change checksum.
6. Inspect external configuration changes:
   - `git -C ~/.dotfiles diff --check -- 02-agentic-llms/.pi/agent/agents`
   - `git -C ~/.dotfiles diff -- 02-agentic-llms/.pi/agent/agents`
   - Manually inspect `~/.pi/agent/extensions/subagent-research-tools.ts`, which is outside the dotfiles repository.
7. If and only if separately approved, spawn one minimal task for each profile, confirm the selected model and permitted tools, and verify researcher can call all three research tools. Otherwise record these model-consuming checks as skipped.
8. Validate this work item after any implementation progress updates:
   - `uv run spec/scripts/manage-spec-item.py --root . validate --item "260909-1928-create-global-scout-researcher-and-worker-profiles"`

## Risks and blockers

- The requested web tools currently cannot pass subagent preflight without registration. Mitigate with the bridge and verify in a fresh session before any model smoke test.
- The bridge references Pi-managed Git checkout paths. A reinstall or checkout relocation can invalidate them. Fail with exact missing paths and revisit registration rather than silently broadening tools.
- Global extension lifecycle ordering could differ from the inspected implementation assumption. Verify that the hook exists at `session_start`; stop if not, rather than editing package sources or weakening sandboxing without approval.
- Cursor model slugs and availability can change. Re-run local model discovery immediately before writing profiles.
- GPT-5.6 Sol is more expensive than Grok and Gemini. Keep researcher specialized and require approval for smoke calls.
- `~/.pi/agent/agents` writes through a symlink into the dotfiles repository. Preserve unrelated dotfiles changes and do not commit or push.
- Worker has shell and write capabilities. Its prompt, nested allowlist, and parent approval gates mitigate but do not eliminate operational risk.
- Web research quality depends on configured credentials and provider availability, which this item does not change.

## Progress

- [x] Planning complete and confirmed.
- [ ] Implementation not started.
- [ ] Verification not run.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read spec/active/260909-1928-create-global-scout-researcher-and-worker-profiles/plan.md and the adjacent item.yaml completely.
Implement one confirmed task at a time while preserving Requirements, Out of scope, Decision Log, Risks, and Verification plan.
Update Progress and add a confirmed Decision Log entry when implementation changes the approach.
Run focused checks during work and the plan's required verification before reporting completion.
Before any global configuration write, preview the exact four target files and obtain explicit external-write approval.
Stop and ask before dependencies, migrations, destructive operations, other external writes, commits, pushes, production actions, model-consuming smoke tests, or scope expansion.
Preserve failures, skipped checks, deviations, and unverified areas instead of claiming completion.
```

A bounded subagent is appropriate only for independent review of the final three profile prompts or the bridge registration logic. Give it the exact proposed files and require a concise findings-only response; do not delegate the external writes themselves.

## Proposed durable knowledge updates

None. These are user-specific global profiles and a local bridge, not durable current-state knowledge for this repository. If implementation proves a general limitation or changes repository source, create a separately scoped source-backed wiki update rather than recording personal configuration.

## Notes

- The confirmed scope contains three agent definition files plus one required global bridge extension.
- Research was completed during planning; implementation should re-check only time-sensitive model availability and paths.
- No implementation is authorized by this plan artifact itself.
