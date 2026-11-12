# Observations

Tentative repository-local findings retained for later comparison. This page is used by Dream and memory maintenance, not normal task context.

## Markdown checks

- **Literal link placeholders inside agent prompt examples can look like broken repository links** - May matter when ad hoc Markdown checks scan profile bodies because placeholder targets such as `url` should be distinguished from actual relative documentation links. Provenance: [profile-hardening verification](../spec/archive/260909-1230-harden-agent-profiles-and-adapt-the-fork/verification.md).

## Runtime display

- **The subagent tool widget can omit tools registered by later profile `session_start` handlers** - May matter when debugging a child's capabilities because activation is correct but runtime control snapshots display names earlier; refresh the widget after activation if exact dynamic display becomes required. Provenance: [02.01 focused review](../spec/archive/260909-1952-profile-extension-loading/implementation/02-01-child-capability-launch.md), corroborated by the [T02 Standards review](../spec/archive/260909-1952-profile-extension-loading/implementation/02-02-versioned-resume.md#completion-and-handoff).

## Path fixtures

- **macOS temporary paths can be absolute without being canonical** - May matter when tests construct versioned loadout fixtures because `/var` can resolve through `/private/var`; use `realpathSync` for fixtures intended to pass canonical replay, and preserve aliases only when testing refusal. Provenance: [02.02 completion evidence](../spec/archive/260909-1952-profile-extension-loading/implementation/02-02-versioned-resume.md#completion-and-handoff).

## Integration checks

- **Full integration runs can fail one unrelated test intermittently** - May matter when judging regressions because live-model and pane-focus tests flaked; rerun the failing test alone with `--test-name-pattern` first. Provenance: [verification](../spec/archive/261112-1059-detect-subagent-completion-without-screen-scraping-and-fix-agy-ssh-login/verification.md).

## Workflow orchestration

- **Target:** `gamemaster-implement/workflow/execution-cycle.md`
  - **Smallest proposed change:** When terminal Implement output omits the required structured evidence report, send one bounded report-only correction to the same Twin before parent reconciliation.
  - **Evidence:** [Antigravity lifecycle retrospective](./dreams/retrospectives/260925-1525-add-antigravity-harness-support.md) and the terminal Twin response `No further action needed`, which required parent reconstruction from archived evidence.
  - **Expected benefit:** Preserve the lean-parent boundary while making phase handoff evidence consistent and reducing avoidable ambiguity before Dream.

- **Target:** `dream/SKILL.md`
  - **Smallest proposed change:** For exact pre-completion Gamemaster checkpoint episodes, render work-item source references with the stable eventual `spec/archive/<item-id>/` location instead of a literal canonical `spec/active/<item-id>/` prefix.
  - **Evidence:** `spec/archive/261002-1653-add-mcp-and-codemode-profile-access/outcome.md` records terminal archive preflight blocked by four active-item prefixes in two immutable checkpoint logs, requiring a parent-authorized exact-prefix correction.
  - **Expected benefit:** Prevent deterministic archive blockers and avoid post-hoc edits to immutable episode records.
