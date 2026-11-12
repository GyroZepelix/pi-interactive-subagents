# Plan: Default Pi subagents to auto-exit, append, and lineage-only, and ship a profile skill

Work item: `261112-1435-default-pi-subagents-to-auto-exit-append-and-lineage-only-and-ship-a-profile-ski`
Status: Planned
Created: 2026-11-12
Updated: 2026-11-12

Assurance: medium - three omitted-field defaults change for every new Pi child launch, including other users of the package; each change is small, explicit values keep working, and the change is easy to revert.

## Goal

A Pi subagent profile that omits `auto-exit`, `system-prompt`, or `session-mode` behaves like the profiles the user actually writes: it finishes and reports back on its own, its body is appended to Pi's system prompt, and its session is linked to the parent so `/resume` nests it. The package also ships a narrowly routed skill that teaches agents how to create or edit subagent profiles correctly.

## Context

- Trigger (2026-11-12): the user's `alt-reviewer` profile omitted `auto-exit`, so its child answered and then waited in its pane forever. Verified from launch scripts (no `PI_SUBAGENT_AUTO_EXIT=1`), the child session (final `stopReason: stop`), and the runtime-control guard `if (finalized || !autoExit) return;`. A standalone repro showed Pi plus pi-cursor reaches `agent_settled` normally.
- Every other user Pi profile sets `auto-exit: true`; seven set `system-prompt: append` and `session-mode: standalone` explicitly.
- Current defaults (source at `a3adef5`): `agent.autoExit ?? false` in `pi-extension/subagents/index.ts` (task wrapper, loadout, launch env `PI_SUBAGENT_AUTO_EXIT`, `resolveEffectiveInteractive`); `system-prompt` omitted puts the body in the task wrapper (`buildSubagentTask`); `resolveEffectiveSessionMode` returns `standalone`.
- `interactive` only controls whether stall and recovery transitions wake the parent (`index.ts` status loop); it defaults to the inverse of auto-exit.
- `lineage-only` only pre-creates the child session with a `parentSession` header and no copied turns (`session.ts` `seedSubagentSessionFile`); Pi reads that field only for session listing and the `/resume` tree (`session-manager.js`, `session-selector.js`).
- AGY and model-chain AGY targets record a `standalone` session mode in launch behavior (test near `test/test.ts:3053`); Claude profiles cannot declare `auto-exit`, `system-prompt`, or `session-mode` but share the `interactive` default and the session-seeding step.
- Resume already forces auto-exit and replays the stored `systemPromptMode` from the loadout.
- Pi packages can ship skills through `package.json` `pi.skills` (Pi `docs/packages.md`, `docs/skills.md`).

## Requirements

- R1: For Pi-harness launches only (flat profiles with `cli` omitted or `pi`, and Pi targets in a model chain), an omitted field resolves to `auto-exit: true`, `system-prompt: append`, and `session-mode: lineage-only`. Explicit values (`auto-exit: false`, `system-prompt: replace`, `session-mode: standalone` or `fork`) are honored unchanged.
- R2: The resolved values are used consistently everywhere the raw fields are used today: task-wrapper wording, loadout snapshot (`autoExit`, `systemPromptMode`, `identity`), the `PI_SUBAGENT_AUTO_EXIT` launch environment, `--append-system-prompt`, session seeding, and `resolveEffectiveInteractive`.
- R3: `interactive` keeps its derived default (inverse of the resolved auto-exit); an explicit `interactive` still wins.
- R4: Claude and AGY launches are unchanged: no new session seeding, no system-prompt change, no change to their `interactive` default, and AGY launch behavior keeps `standalone`.
- R5: Resume of existing children is unchanged (stored loadout replay; resume remains auto-exit).
- R6: The package ships a skill (name `subagent-profiles`) through `package.json` `pi.skills` and `files`. Its frontmatter description routes it only to creating or editing subagent profile Markdown files (global `~/.pi/agent/agents/` or trusted project `.pi/agents/`). It concisely documents every profile field with its default and when to use it (including the `auto-exit`/`interactive` relationship, append versus replace versus omitted body routing, the three session modes and their real cost, `disable-model-invocation`, `skills`, `cwd`, `model-chain`, harness restrictions), the project-override-by-name rule, that project-only isolation is not supported yet (backlog B1), and points to `docs/agent-definitions.md` for the full contract. It must not contradict that document.
- R7: `docs/agent-definitions.md` (field table, examples, body routing, session modes) and `README.md` describe the new Pi defaults and note that they changed, including that profiles relying on omitted fields now behave differently and how to opt out.

## Out of scope

- Project-only profile isolation (backlog B1).
- Edits to the user's profile files; removing redundant `session-mode: standalone` and `system-prompt: append` lines happens after this ships (keep `standalone` only where intended).
- A per-call runtime override for auto-exit (profile field only).
- Changing Claude or AGY behavior, the resume model, or the status watchdog.

## Design

- Add one helper in `index.ts` (for example `applyPiProfileDefaults(definition)`) that, for the Pi harness only, fills `autoExit ??= true`, `systemPromptMode ??= "append"`, and `sessionMode ??= "lineage-only"`. Apply it to the flat Pi definition in launch preparation before `resolveEffectiveInteractive`, `resolveLaunchBehavior`, `buildSubagentTask`, and loadout construction, and to each Pi model-chain target definition (chain targets already force `autoExit: true` and `interactive: false`).
- Ensure the definition passed to `launchSubagent` (which reads `agentDefs?.autoExit` for `PI_SUBAGENT_AUTO_EXIT`) is the defaulted one, or derive the env from the prepared loadout, so R2 holds without duplicating defaults.
- Keep `resolveEffectiveSessionMode` and `resolveEffectiveInteractive` as pure resolvers; the harness-aware default lives only in the helper, so Claude and AGY paths are untouched.
- Skill: `skills/subagent-profiles/SKILL.md`, single file unless a reference split is clearly needed; add `"skills": ["./skills"]` to `pi` and `"skills/"` to `files` in `package.json`.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D1 | Defaults | Omitted `auto-exit` means true for Pi. | Delegated children are the dominant use; an omitted field silently stranded a child. | `alt-reviewer` incident 2026-11-12 | Hands-on children become common |
| D2 | Defaults | Omitted `system-prompt` means append for Pi. | Role rules belong in the system prompt and keep Pi's own prompt; all user Pi profiles chose it. | User profiles; docs body routing | Pi changes append semantics |
| D3 | Defaults | Omitted `session-mode` means lineage-only for Pi. | Only adds a `parentSession` header; no tokens; nests children in `/resume`. | `session.ts`, Pi session selector | Pi uses `parentSession` for other behavior |
| D4 | Scope | Pi only; Claude and AGY unchanged. | Those harnesses do not use these fields, and Claude shares the seeding and interactive paths. | Docs harness restrictions; launch order in `index.ts` | Claude gains these fields |
| D5 | interactive | Keep the derived default. | `interactive` only gates stall wake-ups; coupling to resolved auto-exit is correct. | Status loop in `index.ts` | - |
| D6 | Opt-out | Profile field only, no runtime parameter. | The runtime knob was removed deliberately (test asserting `autoExit` knob removed). | `test/test.ts` | - |
| D7 | Skill | Ship the skill in this package. | Versioned with the field contract it documents. | Pi packages support `pi.skills` | - |

## Work breakdown

- [x] T01: Pi profile defaults (R1-R5).
  - Expected areas: `pi-extension/subagents/index.ts`.
  - Acceptance: a Pi profile with none of the three fields launches with `PI_SUBAGENT_AUTO_EXIT=1`, `--append-system-prompt`, a seeded `parentSession` header, autonomous task wording, a loadout with `autoExit: true` and `systemPromptMode: "append"`, and `interactive: false`; explicit opposite values still produce today's behavior; Claude and AGY launch plans are byte-identical to before.
- [x] T02: Tests.
  - Update tests that assert the old defaults (for example non-auto-exit waiting now needs explicit `auto-exit: false`; standalone default expectations for Pi). Add tests for R1-R4: defaulted Pi flat profile, explicit opt-outs, Pi chain target defaults, unchanged Claude and AGY behavior.
  - Expected areas: `test/test.ts`.
- [x] T03: Skill and packaging (R6).
  - Expected areas: `skills/subagent-profiles/SKILL.md`, `package.json`.
  - Acceptance: Pi discovers the skill from the package; frontmatter has `name` and a narrow `description`; content matches `docs/agent-definitions.md`.
- [x] T04: Docs (R7) and durable knowledge.
  - Expected areas: `docs/agent-definitions.md`, `README.md`, `wiki/conventions/agent-profiles.md`, `wiki/architecture.md` if it states the defaults, `wiki/log.md`.

## Acceptance criteria

- A new Pi profile without `auto-exit` finishes and reports to the parent without manual exit.
- Explicit `auto-exit: false`, `system-prompt: replace`, and `session-mode: standalone`/`fork` behave as before.
- Claude and AGY launches and all resumes are unchanged.
- The `subagent-profiles` skill is discoverable from the package and consistent with the docs.

## Verification plan

- `npm test` (unset `PI_SUBAGENT_*` when running inside a subagent)
- `npm run test:integration` (real tmux panes, small live model calls)
- Skill discovery check: start Pi with the package and confirm `subagent-profiles` is listed (or load it with `/skill:subagent-profiles`).
- `git diff --check`
- One independent contract-quality review (medium assurance).

## Risks and blockers

- Other users' profiles that relied on the old omitted defaults change behavior; mitigated by an explicit docs note and opt-out values.
- Integration tests that spawn agentless or minimal Pi profiles may now auto-exit or seed sessions; update their expectations rather than weakening assertions.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete (T01-T04).
- [x] Verification passed; see `verification.md`.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read this plan and its item.yaml completely.
Implement the work step by step while preserving Requirements, Out of scope, Decision Log, and Verification plan.
Update Progress and the Decision Log when confirmed implementation discoveries change the approach.
Run the specified verification before reporting completion.
Stop and ask before dependencies, migrations, destructive operations, external writes, commits, pushes, or scope expansion.
```
