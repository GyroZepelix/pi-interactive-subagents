---
schema_version: 1
episode_id: "2026-09-25-1641-gamemaster-checkpoint-260925-1525-add-antigravity-harness-support-direct"
timestamp: "2026-09-25T16:41:12+02:00"
summary: "Added and archived a fail-closed read-only AGY harness with isolated generated agents, exact completed-conversation resume, 237 unit tests, and model-consuming lifecycle evidence left approval-gated."
kind: "gamemaster-checkpoint"
status: "shipped"
work_item: "260925-1525-add-antigravity-harness-support"
current: "direct"
topics: ["antigravity","harness","resume"]
---

# Gamemaster checkpoint: 260925-1525-add-antigravity-harness-support/direct

Date: 2026-09-25
Work item: `260925-1525-add-antigravity-harness-support`
Status: shipped
In one line: Added and archived a fail-closed read-only AGY harness with isolated generated agents, exact completed-conversation resume, 237 unit tests, and model-consuming lifecycle evidence left approval-gated.

## Goal

Add Antigravity CLI as a third profile-selectable subagent harness for Gemini 3.8 Flash while preserving Pi and Claude behavior, exposing only four read capabilities, delivering real headless results, and continuing completed work by exact conversation ID.

## How we approached it

The direct medium-assurance implementation first extended canonical profile validation with `cli: agy`, field-specific rejection of unsupported Pi lifecycle and capability fields, and exact ordered translation from read, grep, find, and list to AGY native tools. A dedicated helper module then made generated primary-agent serialization, artifact-backed command construction, strict JSON result parsing, and tagged resume-state validation independently testable.

Launch preparation kept AGY separate from Pi loadouts and the Claude plugin path. Each run writes a collision-resistant primary-agent workspace, task, stdout, stderr, state, and launch script under the parent session artifacts, preflights the executable and replay inputs before pane creation, and never applies unrestricted permission bypass. The watcher delivers exact successful responses and usage, persists the validated conversation ID, rejects active steering, and resumes only from the immutable stored cwd, model, effort, identity, tool mapping, and generated-agent contract.

Focused parser, registry, watcher, status, command, and compatibility tests were integrated into the full suite. Two temporary non-model AGY discovery probes covered both the four-tool profile and `tools: []`; controlled tmux, package, Markdown, patch, and spec checks also passed. A Focused review, targeted re-review, and final Contract-quality review passed without blockers. After explicit terminal approval, the helper archived the completed item.

## Key decisions

- **Keep `cli` canonical** - added `agy` rather than introducing another harness field, preserving existing profile identity and discovery behavior.
- **Make native omission the capability boundary** - generated exactly `view_file`, `grep_search`, `find_by_name`, and `list_dir` from the four logical read tools; rejected mutation, shell, extension, permission-request, and nested-agent surfaces.
- **Use a generated direct primary agent** - isolated the profile body and exact native allowlist under parent-session artifacts instead of changing the repository or user AGY configuration.
- **Choose one-shot JSON plus exact completed resume** - rejected active AGY steering, used artifact output as authority, and updated strict conversation state only after a valid terminal success.
- **Preserve evidence gates** - ran only model-free local probes and left live Gemini reads, delivery, and resume unverified because separate external-call approval was not granted.

## What did not work

- **The first stale-claim search used unsafe shell quoting** - Markdown backticks were interpreted by the shell; the command was rerun with safe single quoting and made no repository change.
- **Review follow-up timing created redundant reviewer activity** - the required reviews still produced clear PASS verdicts, and the extra reviewer was told to stop after archive completion rather than being treated as additional evidence.

## Current state and where we left off

- Shipped/verified: the archived manifest is `completed`; all four tasks, verification, outcome, archive index, and absence of the active copy agree; source, tests, docs, and durable wiki guidance implement the AGY contract.
- Pending: the implementation and archive remain unstaged and uncommitted for a user-controlled Git checkpoint. Live Gemini prompt-free reads, response delivery, and exact continuation remain intentionally unverified.

## Source of truth

- `spec/archive/260925-1525-add-antigravity-harness-support/plan.md`: canonical requirements, decisions, non-goals, and completed tasks.
- `spec/archive/260925-1525-add-antigravity-harness-support/verification.md`: commands, requirement coverage, review verdicts, corrected failures, and unverified live behavior.
- `spec/archive/260925-1525-add-antigravity-harness-support/outcome.md`: completed disposition, residual risks, and follow-ups.
- `pi-extension/subagents/agy.ts` and `pi-extension/subagents/index.ts`: native capability, generated-agent, launch, result, status, and resume behavior.
- `test/test.ts`: model-free profile, parser, registry, watcher, steering, status, and compatibility regressions.

## Verification

- Done: 237 unit/source tests; 9 controlled tmux tests; two AGY 1.2.11 non-model generated-agent discovery probes; 19-file package allowlist; Markdown, stale-claim, patch, item, operational spec, and archive checks; Focused review plus targeted retry PASS; Contract-quality review PASS.
- Not verified yet: live Gemini 3.8 Flash workspace reads, automatic response delivery, and exact conversation continuation were not run without separate approval. A hard parent-process crash can still leave an orphaned AGY pane outside the in-process resume reservation.

## Open questions, blockers, next safe action

- Open/blocked: none within the archived contract.
- Next safe action: inspect the complete unstaged diff and create a user-controlled Git checkpoint when authorized; separately approve the live Gemini lifecycle suite only if its external time and quota cost are desired.

## Dynamic knowledge trail

- `wiki/architecture.md` and `wiki/map.md`: topic-specific dynamic knowledge for AGY module ownership, launch, result, registry, and exact resume architecture.
- `wiki/conventions/agent-profiles.md`: topic-specific dynamic knowledge for the strict AGY profile and four-tool translation contract.
- `wiki/conventions/runtime-safety.md`: topic-specific dynamic knowledge for native capability isolation, shell boundaries, and fail-closed state replay.
- `wiki/development.md`: topic-specific dynamic knowledge for AGY prerequisites and model-free versus approval-gated verification tiers.
