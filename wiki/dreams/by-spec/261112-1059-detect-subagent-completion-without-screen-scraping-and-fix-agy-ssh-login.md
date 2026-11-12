# Dream learnings: 261112-1059-detect-subagent-completion-without-screen-scraping-and-fix-agy-ssh-login

Work item: `261112-1059-detect-subagent-completion-without-screen-scraping-and-fix-agy-ssh-login`

> Historical snapshot: this ledger records what Dream retained at each Gamemaster checkpoint. Current source, plans, verification, outcomes, and current dynamic destinations remain authoritative.

<!-- dream-checkpoints:start -->

## Gamemaster checkpoint: 261112-1059-detect-subagent-completion-without-screen-scraping-and-fix-agy-ssh-login/direct

Date: 2026-11-12
Dream log: [2026-11-12-1136-gamemaster-checkpoint-261112-1059-detect-subagent-completion-without-screen-scra.md](../2026-11-12-1136-gamemaster-checkpoint-261112-1059-detect-subagent-completion-without-screen-scra.md)
Outcome: retained learning

### Integration flake triage

- **Exact written text:**

````markdown
- **Full integration runs can fail one unrelated test intermittently** - May matter when judging regressions because live-model and pane-focus tests flaked; rerun the failing test alone with `--test-name-pattern` first. Provenance: [verification](../spec/archive/261112-1059-detect-subagent-completion-without-screen-scraping-and-fix-agy-ssh-login/verification.md).
````

- **Destination and classification:** `wiki/observations.md` - `Observation` - `ADD`
- **Closest existing guidance:** `wiki/development.md:19` "Prefer a controlled detached tmux session when an active Pi TUI may compete for pane focus." - covers pane-focus competition for the tmux-only suite, not live-model flakes or the isolated-rerun triage step for the full integration run.
- **Admission basis:** `observed failure prevention`
- **Session evidence or selection reason:** Three full integration runs for this item each failed a different test in unchanged code: the system-prompt marker from a live model, operator pane focus, and the parent run's `ask_question` timeout. Each failing test passed isolated reruns. The scope is one item, so recurrence across items is unproven.
- **Expected future benefit:** Future agents rerun a failing integration test alone before attributing the failure to their change or blocking on it.
- **Why this tier:** The evidence is plausible but comes from a single item and depends on the environment (a shared tmux server and live model output), so it is not stable enough for `wiki/development.md` guidance yet.
