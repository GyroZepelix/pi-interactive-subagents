# Observations

Tentative repository-local findings retained for later comparison. This page is used by Dream and memory maintenance, not normal task context.

## Markdown checks

- **Literal link placeholders inside agent prompt examples can look like broken repository links** - May matter when ad hoc Markdown checks scan profile bodies because placeholder targets such as `url` should be distinguished from actual relative documentation links. Provenance: [profile-hardening verification](../spec/archive/260909-1230-harden-agent-profiles-and-adapt-the-fork/verification.md).

## Workflow orchestration

- **Target:** `gamemaster-implement/workflow/execution-cycle.md`
  - **Smallest proposed change:** When terminal Implement output omits the required structured evidence report, send one bounded report-only correction to the same Twin before parent reconciliation.
  - **Evidence:** [Antigravity lifecycle retrospective](./dreams/retrospectives/260925-1525-add-antigravity-harness-support.md) and the terminal Twin response `No further action needed`, which required parent reconstruction from archived evidence.
  - **Expected benefit:** Preserve the lean-parent boundary while making phase handoff evidence consistent and reducing avoidable ambiguity before Dream.

- **Target:** `dream/SKILL.md`
  - **Smallest proposed change:** For exact pre-completion Gamemaster checkpoint episodes, render work-item source references with the stable eventual `spec/archive/<item-id>/` location instead of a literal canonical `spec/active/<item-id>/` prefix.
  - **Evidence:** `spec/archive/261002-1653-add-mcp-and-codemode-profile-access/outcome.md` records terminal archive preflight blocked by four active-item prefixes in two immutable checkpoint logs, requiring a parent-authorized exact-prefix correction.
  - **Expected benefit:** Prevent deterministic archive blockers and avoid post-hoc edits to immutable episode records.
