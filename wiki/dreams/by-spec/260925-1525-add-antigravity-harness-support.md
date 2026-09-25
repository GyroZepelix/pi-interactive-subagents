# Dream learnings: 260925-1525-add-antigravity-harness-support

Work item: `260925-1525-add-antigravity-harness-support`

> Historical snapshot: this ledger records what Dream retained at each Gamemaster checkpoint. Current source, plans, verification, outcomes, and current dynamic destinations remain authoritative.

<!-- dream-checkpoints:start -->

## Gamemaster checkpoint: 260925-1525-add-antigravity-harness-support/direct

Date: 2026-09-25
Dream log: [2026-09-25-1641-gamemaster-checkpoint-260925-1525-add-antigravity-harness-support-direct.md](../2026-09-25-1641-gamemaster-checkpoint-260925-1525-add-antigravity-harness-support-direct.md)
Outcome: retained learning

### AGY harness architecture and module ownership

- **Exact written text:**
  > The package is an in-process Pi extension that supervises child Pi, optional Claude Code CLI, or read-only Antigravity CLI (`agy`) processes through tmux. It does not provide a network service. Pi supplies extension lifecycle events, tool registration, session locations, and TUI rendering; tmux supplies pane/process isolation and terminal transport (`package.json`, `pi-extension/subagents/index.ts`, `pi-extension/subagents/tmux.ts`).
  >
  > 7. An AGY profile instead generates one isolated primary-agent workspace under parent-session artifacts, writes task/result/state files there, and launches one headless JSON process with only its translated read tools. It creates no Pi loadout (`pi-extension/subagents/agy.ts`, `pi-extension/subagents/index.ts`).
  > 8. The tool returns immediately. A background watcher polls completion signals, updates the widget, extracts the Pi session result, Claude result, or strict AGY JSON response and usage, closes the pane, and sends a steer message to the parent. A confirmed missing pane produces an interrupted result and releases the running entry; AGY advertises recovery only when a valid prior conversation snapshot, cwd, and generated agent remain replayable (`pi-extension/subagents/index.ts`, `pi-extension/subagents/activity.ts`, `pi-extension/subagents/status.ts`, `pi-extension/subagents/tmux.ts`).
  >
  > - Finished Pi and AGY names resolve through `artifacts/<parent-session-id>/subagent-registry.json`, whose strict tagged union preserves legacy Pi entry bytes. Pi resume is refused when its loadout is unsafe. AGY resume requires an exact conversation ID and immutable generated-agent snapshot, replays stored cwd/model/effort/identity/tool state without rereading the profile, and atomically updates the conversation ID after success. Canonical state/session reservations prevent concurrent launches. Finished Claude children are not resumable (`pi-extension/subagents/agy.ts`, `pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`).
  > - Running AGY children reject `subagent_message` before pane transport because headless one-shot active steering is unsupported. Pi question and waiting acknowledgments and Claude submission behavior remain separate (`pi-extension/subagents/index.ts`).
  >
  > - Structurally validated Pi loadout sidecars preserve Pi replay state. Separate strict AGY state sidecars preserve the exact conversation ID, runtime/profile identity, cwd, model, effort, logical/native tool mapping, and generated primary-agent Markdown (`pi-extension/subagents/agy.ts`, `pi-extension/subagents/session.ts`, `pi-extension/subagents/index.ts`).
  >
  > - A profile with `cli: agy` uses headless JSON and a package-generated primary-agent allowlist. It never passes unrestricted permission bypass and relies on AGY's default prompt-free workspace-read policy unless user rules override it (`pi-extension/subagents/agy.ts`, `pi-extension/subagents/index.ts`).
  >
  > | `pi-extension/subagents/agents.ts` | YAML profile parsing, harness-specific validation, diagnostics, trusted nearest-project discovery, package extension resolution, global/project precedence, and canonical definitions. |
  > | `pi-extension/subagents/agy.ts` | Pure AGY read-tool translation, generated primary-agent serialization, command construction, strict JSON result parsing, and exact resume-state persistence/validation. |
  >
  > - AGY capability, command, result, or snapshot behavior: `pi-extension/subagents/agy.ts`, routing in `index.ts`, and focused AGY tests in `test/test.ts`.
- **Destination and classification:** `wiki/architecture.md` and `wiki/map.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** The archived plan and outcome, strict helper module, launch/watcher routing, tagged registry state, 237 unit tests, two non-model AGY discovery probes, and both review gates establish the third-harness ownership and lifecycle boundary.
- **Expected future benefit:** Future AGY launch, result, status, or resume work can begin at the correct module seams, preserve one-shot semantics, and avoid accidentally routing AGY through Pi loadouts or Claude behavior.
- **Why this tier:** This is stable current architecture with recurring value for subagent harness work; it is narrower than a repository-wide convention and fully established rather than tentative.

### Strict AGY profile and native read-tool contract

- **Exact written text:**
  > Comma-delimited strings and YAML string arrays are accepted for `builtin-tools`, `skill` or `skills`, and `subagent_agents`; YAML array entries may not contain commas, and nested target entries follow effective-name validation. `extensions` is a YAML array of exact configured package sources with optional exact package-relative `paths`; selectors must stay within enabled package resources. Reject duplicate package strings and selectors, absolute or drive-qualified selectors, `.` or `..` path segments, and explicitly empty `paths`. Legacy `tools` is rejected rather than reinterpreted. Declaring `builtin-tools` or `extensions` on `cli: claude`, even with an empty value, invalidates the profile. `cli: agy` accepts only generic identity/selection fields plus `builtin-tools`; explicit Pi extensions, skills, nesting, prompt/session modes, and lifecycle fields invalidate it even when empty. AGY allows only `read`, `grep`, `find`, and `ls`. `docs/agent-definitions.md` is the complete user-facing field and default reference.
  >
  > - AGY maps `read`, `grep`, `find`, and `ls` in declared order to `view_file`, `grep_search`, `find_by_name`, and `list_dir`; omitted or empty tools grant none. AGY receives no Pi extensions, mutation/shell tools, permission-request tool, or nested-agent capability.
  >
  > For `cli: agy`, `thinking` is passed unchanged as `--effort`; AGY reports unsupported effort or model-effort combinations. The profile body becomes the generated primary-agent system prompt.
- **Destination and classification:** `wiki/conventions/agent-profiles.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** Profile parser tests cover valid scout/reviewer shapes, every explicitly incompatible field, mutation and shell tool rejection, ordered translation, empty default deny, model override, effort, and body routing.
- **Expected future benefit:** Future profile changes can preserve field-specific fail-closed diagnostics and avoid silently granting an AGY capability or pretending Pi lifecycle fields apply to the external harness.
- **Why this tier:** This is a stable profile-schema contract scoped to agent definition work and belongs with existing profile conventions rather than broad architecture or a tentative observation.

### AGY capability isolation and exact replay safety

- **Exact written text:**
  > AGY profiles use a separate native boundary: a dedicated parent-session artifact workspace contains one generated primary agent with exactly the translated read tools, `mainAgent: true`, and `subagent: false`. Launch exposes only that workspace through `--add-dir`, uses headless JSON artifacts, and never passes `--dangerously-skip-permissions`. Default prompt-free workspace reads remain subject to explicit user AGY permission overrides (`pi-extension/subagents/agy.ts`, `pi-extension/subagents/index.ts`).
  >
  > Pi resume never re-reads profiles or package settings and preflights exact stored paths. AGY likewise replays only a strict snapshot containing its exact conversation ID, cwd, model, effort, identity, logical/native tools, and generated-agent content; drift or missing state fails before pane creation, and successful continuation atomically updates the conversation ID. Canonical state or session paths are reserved while launching. Finished Claude children are not resumable (`pi-extension/subagents/agy.ts`, `pi-extension/subagents/index.ts`).
  >
  > - AGY tasks and resume messages are private files; the launch script uses escaped paths and a quoted command substitution, so prompt contents are data rather than executable shell syntax. Running AGY messages are rejected before tmux input (`pi-extension/subagents/agy.ts`, `pi-extension/subagents/index.ts`).
  >
  > Name registries, AGY resume snapshots, and activity snapshots use temp-file rename with strict schema validation. Errors in best-effort metadata writes must not turn into an unrestricted resume; an AGY result may remain delivered but explicitly non-resumable (`pi-extension/subagents/agy.ts`, `pi-extension/subagents/session.ts`, `pi-extension/subagents/activity.ts`).
- **Destination and classification:** `wiki/conventions/runtime-safety.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** Generated Markdown and command tests prove the exact native allowlist and absence of unrestricted bypass; registry, watcher, malformed-state, interruption, active-steering, and continuation tests prove the fail-closed replay boundary.
- **Expected future benefit:** Future capability or resume changes can preserve native tool omission, artifact isolation, shell-data boundaries, immutable replay state, and honest non-resumability after persistence failure.
- **Why this tier:** This is stable safety guidance for the AGY runtime path with high omission cost, so it belongs in runtime safety rather than episodic recall or an observation.

### AGY verification tiers and approval boundary

- **Exact written text:**
  > - `cli: agy` additionally requires an authenticated compatible Antigravity CLI on `PATH`; the verified local baseline is 1.2.11 (`README.md`, `pi-extension/subagents/agy.ts`).
  >
  > | Temporary `agy --add-dir <root> -p /agents --output-format text` probe | Generated custom-agent discovery only. | Safe non-model check; use an ephemeral root outside the repository and remove it afterward. |
  > | `node --test --test-concurrency=1 test/integration/subagent-lifecycle.test.ts` | Real Pi/AGY child lifecycle, profile tools, result delivery, and resume behavior when applicable. | Model-consuming, time- and cost-bearing; requires explicit approval. Do not infer prompt-free AGY tool execution or exact resume from unit/discovery checks alone. |
- **Destination and classification:** `wiki/development.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** AGY 1.2.11 discovered both generated four-tool and empty-tool agents without a model, while the confirmed plan and verification kept live Gemini reads, result delivery, and exact resume behind separate approval.
- **Expected future benefit:** Future verification can use the cheap discovery probe for generated-agent shape without overstating it as live capability evidence or spending model quota without approval.
- **Why this tier:** This is stable repository-specific verification guidance for AGY development, not a universal rule or tentative finding.
