# Architecture

## System boundary

The package is an in-process Pi extension that supervises child Pi or optional Claude Code CLI processes through tmux. It does not provide a network service. Pi supplies extension lifecycle events, tool registration, session locations, and TUI rendering; tmux supplies pane/process isolation and terminal transport (`package.json`, `pi-extension/subagents/index.ts`, `pi-extension/subagents/tmux.ts`).

## Spawn and completion flow

1. `subagent` validates the requested profile against the caller's discoverable or inherited allowlist and rejects self-spawn, unknown profiles, missing tmux, or missing parent session state (`pi-extension/subagents/index.ts`).
2. Profile defaults are resolved from project, global, then bundled definitions. The effective working directory can select a local Pi agent directory (`pi-extension/subagents/index.ts`).
3. The extension creates a detached right-hand tmux split, seeds a child session when required, and writes task, launch-script, activity, registry, and sandbox artifacts under the parent Pi session directories (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`, `pi-extension/subagents/tmux.ts`).
4. A child Pi process loads `subagent-done.ts`. Restricted profiles launch with extension discovery disabled and only the requested built-ins, known tool extensions, child control tool, and explicitly granted spawning tools (`pi-extension/subagents/index.ts`).
5. The tool returns immediately. A background watcher polls activity and completion signals, updates the widget, extracts the last assistant result and usage, closes the pane, and sends a steer message to the parent (`pi-extension/subagents/index.ts`, `pi-extension/subagents/activity.ts`, `pi-extension/subagents/status.ts`).

## Messaging and resume

- Running agents are addressed by a session-unique name. A message is flattened and typed into the live pane (`pi-extension/subagents/index.ts`).
- Finished names resolve through `artifacts/<parent-session-id>/subagent-registry.json`. Resume is refused when the original `.loadout.json` sandbox snapshot is missing, preventing an unrestricted fallback (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`).
- `ask_question` writes a per-session `.ask` signal. The watcher notifies the parent, and child auto-exit remains suppressed until an answer arrives (`pi-extension/subagents/subagent-done.ts`, `pi-extension/subagents/index.ts`).

## Data ownership

- Pi session JSONL files are authoritative for conversation entries and result summaries (`pi-extension/subagents/session.ts`).
- Loadout sidecars preserve model, identity, tools, nested-spawn allowlist, working directory, and Pi agent directory for safe resume (`pi-extension/subagents/session.ts`).
- Activity snapshots are version 1 JSON files written by temp-file rename. Invalid or wrong-child snapshots are rejected (`pi-extension/subagents/activity.ts`).
- `config.json` is an untracked local override; `config.json.example` is the fallback. The current schema accepts only `status.enabled` (`.gitignore`, `config.json.example`, `pi-extension/subagents/status.ts`).

## Invariants

- Every spawn names a known agent. Nested spawning is granted only by a non-empty `subagent_agents` profile field and is constrained through `PI_SUBAGENT_ALLOWED` (`pi-extension/subagents/index.ts`).
- Default names remain unique across running, in-flight, and completed agents in one parent session (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`).
- Resume replays the stored sandbox rather than re-reading a potentially changed profile (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`).
- Healthy active and waiting snapshots do not become stalled merely because they are old; missing or invalid snapshots cross a fixed 60-second watchdog threshold (`pi-extension/subagents/status.ts`).
- tmux splits use detached mode and are rebalanced to `even-horizontal` without intentionally changing focus (`pi-extension/subagents/tmux.ts`).

## Integrations and tradeoffs

- The extension depends on Pi APIs and tmux command behavior. Custom tool extension paths may come from Pi's global agent directory or process-global registration (`pi-extension/subagents/index.ts`).
- A profile with `cli: claude` uses a bundled Stop hook and launches Claude Code with `--dangerously-skip-permissions`; this path should be treated as explicitly trusted configuration (`pi-extension/subagents/index.ts`, `pi-extension/subagents/plugin/hooks/on-stop.sh`).
- Inferred: `safe_bash` is a convenience denylist, not a complete sandbox, because it matches a finite regex list before delegating to the normal Bash tool (`pi-extension/subagents/tools/safe-bash.ts`).
- Unverified: no design history predates the repository's single current commit, so rationale beyond source comments and README statements is unavailable (`git log`).
