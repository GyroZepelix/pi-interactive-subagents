---
schema_version: 1
episode_id: "2026-11-12-1458-gamemaster-checkpoint-261112-1435-default-pi-subagents-to-auto-exit-append-and-l"
timestamp: "2026-11-12T14:58:47+01:00"
summary: "Pi subagent profiles now default omitted auto-exit, system-prompt, and session-mode to true, append, and lineage-only, and the package ships a subagent-profiles skill."
kind: "gamemaster-checkpoint"
status: "shipped"
work_item: "261112-1435-default-pi-subagents-to-auto-exit-append-and-lineage-only-and-ship-a-profile-ski"
current: "direct"
topics: ["agent profiles","pi defaults","skills"]
---

# Gamemaster checkpoint: 261112-1435-default-pi-subagents-to-auto-exit-append-and-lineage-only-and-ship-a-profile-ski/direct

Date: 2026-11-12
Work item: 261112-1435-default-pi-subagents-to-auto-exit-append-and-lineage-only-and-ship-a-profile-ski
Status: shipped
In one line: Pi subagent profiles now default omitted auto-exit, system-prompt, and session-mode to true, append, and lineage-only, and the package ships a subagent-profiles skill.

## Goal

Stop Pi children whose profile omits `auto-exit` from waiting in their pane forever (the `alt-reviewer` incident), make omitted body routing and session linkage match the profiles the user actually writes, and ship a narrowly routed skill that teaches agents to write profiles correctly.

## How we approached it

The Implement Twin ran the direct plan at medium assurance. It added one helper, `applyPiProfileDefaults`, in `pi-extension/subagents/index.ts`, applied it to the flat Pi definition in `prepareAgentLaunch` and to each model-chain target definition, and made the launch read `PI_SUBAGENT_AUTO_EXIT` from the prepared loadout. Unit tests covered defaults, opt-outs, chain targets, and Claude/AGY isolation; a live integration fixture (`test-defaults`) proved a profile without the fields auto-exits and seeds a `parentSession` header. The skill landed in `skills/subagent-profiles/SKILL.md` and was wired through `package.json` `pi.skills` and `files`. Docs, README, and wiki pages were updated, a contract-quality review passed, and Gamemaster approved archiving.

## Key decisions

- **Derive the auto-exit launch variable from the loadout** - chose `loadout.autoExit` because the definition passed to `launchSubagent` is the raw profile; rejected re-applying defaults inside the launcher because it would duplicate the default logic.
- **Default `system-prompt` only when a body exists** - kept the loadout invariant that prompt mode is set only together with identity text; the parser already requires a body.
- **Keep the resolvers pure** - harness awareness lives only in the helper, so Claude and AGY launches and resume replay stay unchanged.
- **Omit the internal backlog ID from shipped skill text** - stated that project-only isolation is not supported yet instead of citing an ID package users cannot see.
- **Add a live integration test** - beyond the plan's listed test file, to prove the first acceptance criterion end to end.

## What did not work

- **First full integration run** - the unrelated `ask_question` test timed out on a screen pattern although its flow completed; an isolated rerun passed, so it was not treated as a regression.
- **First defaults-test draft** - asserting the parent's completion word would have matched the prompt text already on screen; the prompt was changed to ask for the word assembled from parts.

## Current state and where we left off

- Shipped/verified: item archived as completed with plan, verification, and outcome; all source, test, docs, skill, and wiki changes remain unstaged and uncommitted.
- Pending: user-controlled Git checkpoint; asynchronous Gamemaster review of the challenged Dream blocks.

## Source of truth

- `spec/archive/261112-1435-default-pi-subagents-to-auto-exit-append-and-lineage-only-and-ship-a-profile-ski/verification.md`: checks, requirement coverage, and review verdict.
- `spec/archive/261112-1435-default-pi-subagents-to-auto-exit-append-and-lineage-only-and-ship-a-profile-ski/outcome.md`: delivered scope, deviations, and follow-ups.
- `pi-extension/subagents/index.ts`: `applyPiProfileDefaults` and the loadout-derived launch variable.
- `docs/agent-definitions.md`: user-facing defaults, change note, and opt-outs.

## Verification

- Done: unit suite 301 pass; full integration 20 of 21 with the flake passing alone; skill discovery through Pi's package manager; package dry run includes the skill; contract-quality review PASS with no retries.
- Not verified yet: no live Claude or AGY child was launched; no type-check exists in the repository.

## Open questions, blockers, next safe action

- Open/blocked: the plan context claimed Claude profiles cannot declare the three fields, but the parser accepts them; behavior is unchanged either way.
- Next safe action: create the user's Git checkpoint for this item, then remove redundant default lines from user profiles in a separate task.

## Dynamic knowledge trail

- `wiki/development.md`: topic-specific dynamic knowledge (one promoted observation, two stale-fact corrections).
- `wiki/observations.md`: promoted observation removed.
