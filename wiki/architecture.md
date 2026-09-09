# Architecture

## System boundary

The package is an in-process Pi extension that supervises child Pi or optional Claude Code CLI processes through tmux. It does not provide a network service. Pi supplies extension lifecycle events, tool registration, session locations, and TUI rendering; tmux supplies pane/process isolation and terminal transport (`package.json`, `pi-extension/subagents/index.ts`, `pi-extension/subagents/tmux.ts`).

## Spawn and completion flow

1. `subagent` discovers definitions from the active `ctx.cwd` and `ctx.isProjectTrusted()` state, applies the inherited allowlist, and selects one canonical parsed definition (`pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`).
2. YAML parsing and validation exclude malformed profiles with file-and-field diagnostics. The nearest trusted project directory overrides global definitions by effective name; an invalid project override blocks fallback to a global profile, and uncertain invalid project identities suppress all global fallback (`pi-extension/subagents/agents.ts`).
3. Before pane creation, the extension rejects unknown profiles, unresolved extension-backed tools, invalid generated Pi loadouts or runtime overrides, self-spawn, missing tmux or parent state, and colliding explicit runtime names (`pi-extension/subagents/index.ts`).
4. The extension creates a detached right-hand tmux split, seeds a child session when required, and writes task, launch-script, activity, registry, and sandbox artifacts under the parent Pi session directories (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`, `pi-extension/subagents/tmux.ts`).
5. A child Pi process loads `subagent-done.ts`. Every named Pi profile launches with extension discovery disabled, an explicit tool allowlist, the child control tool, and only resolvable requested or spawning-tool extensions (`pi-extension/subagents/index.ts`).
6. The tool returns immediately. A background watcher polls activity and completion signals, updates the widget, extracts the last assistant result and usage, closes the pane, and sends a steer message to the parent (`pi-extension/subagents/index.ts`, `pi-extension/subagents/activity.ts`, `pi-extension/subagents/status.ts`).

## Messaging and resume

- Running agents are addressed by a session-unique name. A message is flattened and typed into the live pane (`pi-extension/subagents/index.ts`).
- Finished Pi names resolve through `artifacts/<parent-session-id>/subagent-registry.json`. Pi resume is refused when the original `.loadout.json` sandbox snapshot is missing, malformed, unrestricted, or references a missing extension. A canonical session-path reservation prevents concurrent resume launches. Finished Claude children are not resumable (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`).
- `ask_question` writes a per-session `.ask` signal. The watcher notifies the parent, and child auto-exit remains suppressed until an answer arrives (`pi-extension/subagents/subagent-done.ts`, `pi-extension/subagents/index.ts`).

## Data ownership

- Pi session JSONL files are authoritative for conversation entries and result summaries (`pi-extension/subagents/session.ts`).
- Structurally validated Pi loadout sidecars preserve model, identity, tools, exact backing extension paths, nested-spawn allowlist, working directory, and Pi agent directory for safe preflighted resume (`pi-extension/subagents/session.ts`, `pi-extension/subagents/index.ts`).
- Activity snapshots are version 1 JSON files written by temp-file rename. Invalid or wrong-child snapshots are rejected (`pi-extension/subagents/activity.ts`).
- `config.json` is an untracked local override; `config.json.example` is the fallback. The current schema accepts only `status.enabled` (`.gitignore`, `config.json.example`, `pi-extension/subagents/status.ts`).

## Invariants

- Every spawn names a known agent. Nested spawning is granted only by a non-empty `subagent_agents` profile field and is constrained through `PI_SUBAGENT_ALLOWED` (`pi-extension/subagents/index.ts`).
- Omitted runtime names receive deterministic suffixes across running, in-flight, and completed agents. Explicit collisions are rejected rather than suffixed (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`).
- Resume replays the stored sandbox rather than re-reading a potentially changed profile (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`).
- Healthy active and waiting snapshots do not become stalled merely because they are old; missing or invalid snapshots cross a fixed 60-second watchdog threshold (`pi-extension/subagents/status.ts`).
- tmux splits use detached mode and are rebalanced to `even-horizontal` without intentionally changing focus (`pi-extension/subagents/tmux.ts`).

## Integrations and tradeoffs

- The extension targets Pi 0.85.1 APIs and tmux command behavior. Custom tool extension paths may come from Pi's global agent directory or process-global registration (`package.json`, `pi-extension/subagents/index.ts`).
- A profile with `cli: claude` uses a bundled Stop hook and launches Claude Code with `--dangerously-skip-permissions`; this path should be treated as explicitly trusted configuration (`pi-extension/subagents/index.ts`, `pi-extension/subagents/plugin/hooks/on-stop.sh`).
- Inferred: `safe_bash` is a convenience denylist, not a complete sandbox, because it matches a finite regex list before delegating to the normal Bash tool (`pi-extension/subagents/tools/safe-bash.ts`).
- Unverified: no design history predates the repository's single current commit, so rationale beyond source comments and README statements is unavailable (`git log`).
