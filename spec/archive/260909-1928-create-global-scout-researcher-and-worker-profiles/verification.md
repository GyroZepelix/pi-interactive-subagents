# Verification: Create global scout, researcher, worker, flash-reviewer, and twin profiles

Work item: `260909-1928-create-global-scout-researcher-and-worker-profiles`
Date: 2026-09-10
Status: safe-provider implementation, verification, and contract-quality review complete

## Environment

- Repository: `/Users/dgjalic/Documents/1-Projects/10-software-development/pi-interactive-subagents`
- Starting `HEAD`: `b08575896b84dcf5a03fb62ad3f60910c25af400`
- Global profile link: `~/.pi/agent/agents` -> `/Users/dgjalic/.dotfiles/02-agentic-llms/.pi/agent/agents`
- Assurance: medium
- Pre-delete `general.md` SHA-256: `df93ed60d4b7909fa97901a657540e19c307bca80b0b284ac18b411944ed4815`
- The user installed `@offbynan/pi-cursor-provider` and removed the unsafe provider before this implementation resumed.

## Changed paths

Approved external effects across the implementation:

- Deleted invalid `~/.pi/agent/agents/general.md` with exact destructive approval.
- Replaced `~/.pi/agent/agents/scout.md`.
- Created `~/.pi/agent/agents/researcher.md`.
- Created `~/.pi/agent/agents/worker.md`.
- Created `~/.pi/agent/agents/flash-reviewer.md`.
- Created `~/.pi/agent/agents/twin.md`.
- Added worker research tools and made twin standalone with separate approval.
- Migrated scout, worker, and flash-reviewer to exact `npm:@offbynan/pi-cursor-provider` resource `index.ts`, canonical model IDs, and explicit Pi thinking levels with separate approval.

The user approved replacing stale enabled model `cursor/cursor-grok-4.6-high` with `cursor/cursor-grok-4.6-fast`. By the time the exact replacement ran, settings already contained the desired value, so the edit failed closed and this run made no settings write. Current settings satisfy the approved result.

The five profile files became staged through an external action during verification. This run did not stage, reset, commit, or discard them. Unrelated dotfiles changes were preserved.

Repository evidence updates:

- `spec/active/260909-1928-create-global-scout-researcher-and-worker-profiles/item.yaml`
- `spec/active/260909-1928-create-global-scout-researcher-and-worker-profiles/plan.md`
- `spec/active/260909-1928-create-global-scout-researcher-and-worker-profiles/verification.md`
- `spec/index.md`

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| Canonical model discovery | Passed | Fresh `pi --list-models cursor` exposes `cursor/gemini-3.8-flash` and `cursor/cursor-grok-4.6-fast`; no warnings remain. OpenAI Codex GPT-5.6 Sol remains available. |
| Package configuration | Passed | Safe Cursor provider, web-tools, and codex-search exact sources and resources exist. Unsafe `@akepka` provider is absent from settings and installation. |
| Safe provider source inspection | Passed | Installed 0.7.0 provider contains no `registerTool`; rejects native read, list, grep, write, delete, shell, streaming/background shell, shell stdin, and fetch operations; converts only active Pi tools to MCP definitions. |
| Fresh real `subagents_list` with final assertions | Passed | Five profiles, zero diagnostics, exact canonical models, thinking levels, ordered extension paths, standalone modes, built-ins, nested allowlists, and no twin recursion. |
| Model-free read-only activation | Passed | Scout/reviewer surface is exactly `ask_question`, `read`, `grep`, `find`, and `ls`; mutating, web, Cursor replay, and spawning tools are absent. |
| Model-free worker provider and activation | Passed | Exact load order is runtime control, safe Cursor provider, web-tools, codex-search, activation. Provider and requested models register; active tools are coding built-ins plus `ask_question`, `web_search`, `web_fetch`, and `codex_search`; standalone web is absent. |
| Settings assertions | Passed | Enabled models contain canonical Gemini and fast Grok IDs, omit stale high-suffixed Grok ID, include safe package, and omit unsafe package. |
| `npm test` after final migration | Passed | 198 tests passed, 0 failed. |
| Spec helper validation | Passed | Selected item and all four repository items validate. |
| Markdown/profile checks | Passed | All five profiles and changed spec Markdown pass ASCII, balanced fences, non-empty bodies, strict frontmatter, and no legacy `tools`. |
| Patch integrity and scope | Passed | Repository staged and unstaged diff checks plus scoped dotfiles diff check pass; `general.md` remains absent and unrelated dotfiles changes remain present. |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| R01-R03 | General is absent. Scout resolves canonical Gemini, medium thinking, read-only built-ins, standalone mode, and only safe Cursor provider. | Passed |
| R04 | Researcher resolves OpenAI GPT-5.6 Sol, no built-ins, and exact ordered web-tools plus codex-search resources. | Passed |
| R05 and R07 | Worker resolves fast Grok with high thinking, coding built-ins, safe provider then both research resources, direct research guidance, and only scout, researcher, and flash-reviewer as nested targets. | Passed |
| R06 | Flash-reviewer resolves canonical Gemini with high thinking, read-only built-ins, and only safe Cursor provider. Provider registers no tools and rejects Cursor-native operations. | Passed |
| R08-R09 | Twin is standalone with coding and research grants, may spawn only the other four profiles, and no profile may spawn twin. | Passed |
| R10 | Researcher, worker, and twin receive only expected research tools; standalone web is absent. Safe provider exposes only active Pi tools through MCP and adds no Pi tools. | Passed |
| R11-R12 | Bodies remain concise and role-specific. Canonical enabled-model state is present; no assistant-driven install, credential, package source, dependency, commit, push, or staging change occurred. | Passed |

## Review findings

- The first contract-quality gate for the earlier contract passed on retry 1 after stale evidence correction.
- The revised initial gate correctly blocked `@akepka/pi-cursor-cli-provider`: its TTY replay registrations and hardcoded Cursor CLI `--yolo` execution defeated read-only profiles.
- The user replaced that package with `@offbynan/pi-cursor-provider`. The exact installed source, canonical model registry, profile resolution, and model-free tool surfaces now address both blocking findings.
- Revised contract-quality review retry 1: `PASS`, with no blocking or non-blocking findings. It confirmed both prior blockers resolved and the final R01-R12 contract fulfilled.

## Failures and skipped checks

- Initial general profile discovery failed because `general.md` had an empty body. The user explicitly approved deleting it; all later listings have zero diagnostics.
- The approved settings replacement encountered no old string because the desired canonical value was already present. No retry or settings rewrite was needed.
- Broad configured-model behavioral smoke tests for all five roles were explicitly offered and declined. The separately approved contract-quality retry invoked flash-reviewer successfully; no other role behavior smoke ran.

## Unverified areas

- The approved flash-reviewer gate exercised OAuth-backed Gemini inference and returned the required review format. Scout, worker, researcher, twin, and active tool-call behavior were not live smoke-tested. Their model IDs, provider registration, source-enforced native-operation rejection, Pi tool activation, package resolution, and nested boundaries were verified deterministically.
- The safe provider is unofficial and depends on Cursor's reverse-engineered private protocol. Future provider updates require renewed source and tool-surface review.
- External staging occurred outside this run. Current final profile contents are staged, while unrelated settings and dotfiles changes remain user-controlled.
