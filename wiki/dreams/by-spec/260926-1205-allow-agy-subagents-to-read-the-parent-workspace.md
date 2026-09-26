# Dream learnings: 260926-1205-allow-agy-subagents-to-read-the-parent-workspace

Work item: `260926-1205-allow-agy-subagents-to-read-the-parent-workspace`

> Historical snapshot: this ledger records what Dream retained at each Gamemaster checkpoint. Current source, plans, verification, outcomes, and current dynamic destinations remain authoritative.

<!-- dream-checkpoints:start -->

## Gamemaster checkpoint: 260926-1205-allow-agy-subagents-to-read-the-parent-workspace/direct

Date: 2026-09-26
Dream log: [2026-09-26-1238-gamemaster-checkpoint-260926-1205-allow-agy-subagents-to-read-the-parent-workspa.md](../2026-09-26-1238-gamemaster-checkpoint-260926-1205-allow-agy-subagents-to-read-the-parent-workspa.md)
Outcome: retained learning

### AGY parent-workspace architecture and replay state

- **Exact written text:**
  > 7. An AGY profile instead generates one isolated primary-agent workspace under parent-session artifacts, writes task/result/state files there, and launches one headless JSON process with only its translated read tools. The process stays in the resolved child cwd; the generated-agent root and, only when different, the resolved parent Pi cwd are added as workspaces. It creates no Pi loadout (`pi-extension/subagents/agy.ts`, `pi-extension/subagents/index.ts`).
  >
  > - Finished Pi and AGY names resolve through `artifacts/<parent-session-id>/subagent-registry.json`, whose strict tagged union preserves legacy Pi entry bytes. Pi resume is refused when its loadout is unsafe. AGY resume requires an exact conversation ID and immutable generated-agent snapshot; version 2 replays the exact stored additional workspace list without rereading the profile or current parent context, while valid version 1 snapshots keep their original no-parent-addition boundary. Success atomically updates only the conversation ID. Canonical state/session reservations prevent concurrent launches. Finished Claude children are not resumable (`pi-extension/subagents/agy.ts`, `pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`).
  >
  > - Structurally validated Pi loadout sidecars preserve Pi replay state. Separate strict AGY state sidecars preserve the exact conversation ID, runtime/profile identity, cwd, model, effort, logical/native tool mapping, generated primary-agent Markdown, and for version 2 the ordered additional workspace roots (`pi-extension/subagents/agy.ts`, `pi-extension/subagents/session.ts`, `pi-extension/subagents/index.ts`).
  >
  > - A profile with `cli: agy` uses headless JSON and a package-generated primary-agent allowlist. It never passes unrestricted permission bypass and relies on AGY's default prompt-free workspace-read policy unless user rules override it. Non-empty denied-action results are failures with bounded action and stderr evidence, including contradictory `SUCCESS` envelopes (`pi-extension/subagents/agy.ts`, `pi-extension/subagents/index.ts`).
- **Destination and classification:** `wiki/architecture.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** The archived plan, implementation, strict version 1/version 2 fixtures, watcher persistence test, denied-action parser fixture, 239-test model-free suite, non-model repeatable-workspace probe, and both review gates establish this launch, persistence, and result boundary.
- **Expected future benefit:** Future AGY launch or resume work can preserve the exact child, generated-agent, and parent workspace roles; avoid recomputing access from mutable context; and treat permission denials as failures instead of successful empty reviews.
- **Why this tier:** This is stable current architecture with recurring value for the AGY harness, narrower than a repository-wide convention and fully established rather than tentative.

### AGY workspace and resume safety boundary

- **Exact written text:**
  > AGY profiles use a separate native boundary: a dedicated parent-session artifact workspace contains one generated primary agent with exactly the translated read tools, `mainAgent: true`, and `subagent: false`. Launch keeps the child cwd as the process workspace and adds the generated-agent root plus the distinct resolved parent Pi cwd. It never derives roots from task text, profile prose, referenced paths, or model output, and never passes `--dangerously-skip-permissions`. Default prompt-free workspace reads remain subject to explicit user AGY permission overrides; reported denied actions fail with bounded action and stderr evidence (`pi-extension/subagents/agy.ts`, `pi-extension/subagents/index.ts`).
  >
  > Pi resume never re-reads profiles or package settings and preflights exact stored paths. AGY likewise replays only a strict snapshot containing its exact conversation ID, cwd, model, effort, identity, logical/native tools, generated-agent content, and in version 2 its ordered additional workspace roots; drift or missing state fails before pane creation, and successful continuation atomically updates only the conversation ID. Existing valid version 1 AGY snapshots remain an exact legacy shape and resume without gaining the current parent cwd. Canonical state or session paths are reserved while launching. Finished Claude children are not resumable (`pi-extension/subagents/agy.ts`, `pi-extension/subagents/index.ts`).
- **Destination and classification:** `wiki/conventions/runtime-safety.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** Command and state tests prove deterministic root derivation, deduplication, exact strict replay, version 1 compatibility, and fail-closed missing-root handling; the plan explicitly prohibits prompt-derived roots and permission bypass.
- **Expected future benefit:** Future capability-boundary changes can avoid accidental directory exposure, silent legacy privilege expansion, mutable-context resume drift, and masked headless permission failures.
- **Why this tier:** This is stable, high-impact safety guidance specific to the AGY runtime path, so it belongs in the existing runtime-safety page rather than episodic recall or an observation.

### Repeatable AGY workspace discovery probe

- **Exact written text:**
  > | Temporary `agy --add-dir <agent-root> --add-dir <second-workspace> --agent <generated-name> -p /agents --output-format text` probe | Repeatable added-workspace parsing and generated custom-agent selection/discovery only. | Safe non-model check; use ephemeral roots outside the repository and remove them afterward. It does not prove model tool execution or cross-workspace reads. |
- **Destination and classification:** `wiki/development.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** A temporary two-workspace probe selected the generated agent without a model, while the archived verification explicitly leaves live cross-workspace reads and exact external continuation approval-gated and unverified.
- **Expected future benefit:** Future AGY changes can cheaply verify repeated `--add-dir` parsing and generated-agent discovery without spending model quota or overstating that result as live read evidence.
- **Why this tier:** This is stable repository-specific verification guidance for AGY development, not a universal rule or a tentative observation.
