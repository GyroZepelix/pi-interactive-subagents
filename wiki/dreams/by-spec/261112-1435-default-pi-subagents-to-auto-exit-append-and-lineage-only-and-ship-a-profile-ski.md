# Dream learnings: 261112-1435-default-pi-subagents-to-auto-exit-append-and-lineage-only-and-ship-a-profile-ski

Work item: `261112-1435-default-pi-subagents-to-auto-exit-append-and-lineage-only-and-ship-a-profile-ski`

> Historical snapshot: this ledger records what Dream retained at each Gamemaster checkpoint. Current source, plans, verification, outcomes, and current dynamic destinations remain authoritative.

<!-- dream-checkpoints:start -->

## Gamemaster checkpoint: 261112-1435-default-pi-subagents-to-auto-exit-append-and-lineage-only-and-ship-a-profile-ski/direct

Date: 2026-11-12
Dream log: [2026-11-12-1458-gamemaster-checkpoint-261112-1435-default-pi-subagents-to-auto-exit-append-and-l.md](../2026-11-12-1458-gamemaster-checkpoint-261112-1435-default-pi-subagents-to-auto-exit-append-and-l.md)
Outcome: retained learning

### Promote isolated rerun triage for integration flakes

- **Exact written text:**

````markdown
- **A full integration run can fail one unrelated live-model, screen-pattern, or pane-focus test intermittently** - Rerun only that test with `--test-name-pattern` before treating it as a regression, and record both results. (verification of items 261112-1059 and 261112-1435 under `spec/archive/`)
````

- **Destination and classification:** `wiki/development.md` - `Topic-specific dynamic knowledge` - `ADD`
- **Closest existing guidance:** `wiki/observations.md:19` "Full integration runs can fail one unrelated test intermittently" - the same finding held as a tentative observation from one item; this promotes it after a second independent item and removes the observation.
- **Admission basis:** `recurrence`
- **Session evidence or selection reason:** This item's full `npm run test:integration` failed only the unchanged `ask_question` test on a screen-pattern timeout although the flow completed; the observation's isolated rerun step was applied and the test passed alone, avoiding a false regression or blocker.
- **Expected future benefit:** Agents triage a single integration failure with an isolated rerun before attributing it to their change or stopping work.
- **Why this tier:** Two independent items needed the same triage and it changed the action taken, so it is reusable test-boundary guidance for `wiki/development.md` rather than a tentative observation.
- **Review status:** review pending

### Integration fixture list includes the defaults fixture

- **Exact written text:**

````markdown
- Integration fixtures define `session-mode`, body and `system-prompt` behavior, and `ask_question`; `test-defaults` deliberately omits `auto-exit`, `system-prompt`, and `session-mode` to cover the Pi defaults. They do not use removed public spawn overrides.
````

- **Destination and classification:** `wiki/development.md` - `Topic-specific dynamic knowledge` - `SUPERSEDE`
- **Closest existing guidance:** `wiki/development.md:34` "Integration fixtures define `session-mode`, body and `system-prompt` behavior" - the prior text implied every fixture states these fields; the new fixture intentionally omits them.
- **Admission basis:** `stale-fact correction`
- **Session evidence or selection reason:** This item added `test/integration/agents/test-defaults.md` without `auto-exit`, `system-prompt`, or `session-mode`, and its live test passed.
- **Expected future benefit:** Agents do not "fix" the fixture by adding the missing fields, which would silently remove coverage of the Pi defaults.
- **Why this tier:** Corrects an existing current-state statement on the page that owns test organization.
- **Review status:** review pending

### Package shape includes skills

- **Exact written text:**

````markdown
`package.json` limits publication to runtime source, `skills/`, `docs/agent-definitions.md`, `README.md`, `LICENSE`, and `config.json.example`. Package dry-run output must exclude `spec/`, `wiki/`, tests, repository instructions, and repository-only `agent-examples/`.
````

- **Destination and classification:** `wiki/development.md` - `Topic-specific dynamic knowledge` - `SUPERSEDE`
- **Closest existing guidance:** `wiki/development.md:39` "`package.json` limits publication to runtime source, `docs/agent-definitions.md`" - the prior allowlist omitted the newly published `skills/` directory.
- **Admission basis:** `stale-fact correction`
- **Session evidence or selection reason:** This item added `skills/` to `package.json` `files`, and `npm pack --dry-run --json` listed `skills/subagent-profiles/SKILL.md`.
- **Expected future benefit:** Agents comparing dry-run contents with the allowlist do not flag the shipped skill as unexpected.
- **Why this tier:** Corrects an existing current-state statement on the page that owns package shape.
- **Review status:** review pending

## Gamemaster review reconciliation: 261112-1435-default-pi-subagents-to-auto-exit-append-and-lineage-only-and-ship-a-profile-ski

Date: 2026-11-12

Review results:

- `direct` "Promote isolated rerun triage for integration flakes" - kept - flash-reviewer keep (none): recurrence across items 261112-1059 and 261112-1435 holds at `wiki/development.md:34`; alt-reviewer keep (none): both archived verification files record passing isolated reruns. Reviewers were flash-reviewer and alt-reviewer (a read-only DeepSeek profile used instead of the writing `worker` profile).
- `direct` "Integration fixture list includes the defaults fixture" - kept - flash-reviewer keep (none): stale-fact correction confirmed by `test-defaults.md` omitting the three fields; alt-reviewer keep (none): other fixtures set them and the defaults test exercises the omission. Reviewers were flash-reviewer and alt-reviewer (read-only DeepSeek profile in place of `worker`).
- `direct` "Package shape includes skills" - kept - flash-reviewer keep (none): `package.json` `files` adds `skills/`; alt-reviewer keep (none): `files` contains `skills/` and `pi.skills` points at `./skills`, so `wiki/development.md:40` was incomplete before. Reviewers were flash-reviewer and alt-reviewer (read-only DeepSeek profile in place of `worker`).
