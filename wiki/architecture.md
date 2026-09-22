# Architecture

## System boundary

The package is an in-process Pi extension that supervises child Pi or optional Claude Code CLI processes through tmux. It does not provide a network service. Pi supplies extension lifecycle events, tool registration, session locations, and TUI rendering; tmux supplies pane/process isolation and terminal transport (`package.json`, `pi-extension/subagents/index.ts`, `pi-extension/subagents/tmux.ts`).

## Spawn and completion flow

1. `subagent` discovers definitions from the active `ctx.cwd` and `ctx.isProjectTrusted()` state, applies the inherited allowlist, and selects one canonical parsed definition (`pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`).
2. YAML parsing and validation exclude malformed profiles with file-and-field diagnostics. The nearest trusted project directory overrides global definitions by effective name; an invalid project override blocks fallback to a global profile, and uncertain invalid project identities suppress all global fallback (`pi-extension/subagents/agents.ts`).
3. Before pane creation, the extension rejects unknown profiles, unresolved or invalid package extension selections, invalid generated Pi loadouts or runtime overrides, self-spawn, missing tmux or parent state, and colliding explicit runtime names (`pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`).
4. The extension creates a detached right-hand tmux split, seeds a child session when required, and writes task, launch-script, activity, registry, and sandbox artifacts under the parent Pi session directories (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`, `pi-extension/subagents/tmux.ts`).
5. A new child Pi process starts with extension discovery and built-ins disabled. It loads `subagent-runtime-control.ts` first, optional spawning control second, canonical profile extensions in resolved order, and tool-free `subagent-capability-activation.ts` last. The activation control enables only selected built-ins plus declared extension tools (`pi-extension/subagents/index.ts`, `pi-extension/subagents/subagent-capability-activation.ts`).
6. For an auto-exit Pi child, each `agent_end` replaces the captured low-level run outcome and records a recoverable waiting snapshot. Finalization waits for `agent_settled`, then rechecks pending questions, running nested children, Pi-owned queued messages, and abort state before writing any final error sidecar, recording terminal activity, and requesting shutdown (`pi-extension/subagents/subagent-runtime-control.ts`, `pi-extension/subagents/activity.ts`).
7. The tool returns immediately. A background watcher polls activity and completion signals, updates the widget, extracts the last assistant result and usage, closes the pane, and sends a steer message to the parent. A confirmed missing pane instead produces an interrupted result, releases the running entry, and leaves a Pi session registered for explicit same-name recovery (`pi-extension/subagents/index.ts`, `pi-extension/subagents/activity.ts`, `pi-extension/subagents/status.ts`, `pi-extension/subagents/tmux.ts`).

## Messaging and resume

- Running agents are addressed by a session-unique name. Generic steering trims and flattens multiline text; correlated question answers preserve exact content inside a one-line JSON envelope. Both load into a collision-resistant named tmux buffer through stdin, use application-negotiated bracketed paste, delete the buffer, and submit Enter separately. Message text does not enter a shell command or tmux argv (`pi-extension/subagents/index.ts`, `pi-extension/subagents/tmux.ts`).
- A pending `ask_question` answer uses a versioned private JSON envelope over the stdin-backed tmux path and reports delivery only after an exact question-ID acknowledgment. Timeout is explicitly unconfirmed, retains the one-answer guard, and never triggers automatic replay or termination. Other waiting Pi messages still use newer same-child activity confirmation; active Pi and Claude paths report submission because their activity cannot uniquely acknowledge one input (`pi-extension/subagents/question-protocol.ts`, `pi-extension/subagents/index.ts`, `pi-extension/subagents/activity.ts`).
- Finished Pi names resolve through `artifacts/<parent-session-id>/subagent-registry.json`. Pi resume is refused when the original `.loadout.json` snapshot is missing, malformed, non-canonical, nesting-inconsistent, or references an unavailable extension. New snapshots replay stored built-ins and canonical profile extension paths without rereading profile or package settings; legacy strict snapshots retain their stored `--tools` path. A canonical session-path reservation prevents concurrent resume launches. Finished Claude children are not resumable (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`).
- `ask_question` keeps its tool promise pending after atomically writing a strict versioned `.ask` request with a unique ID. The watcher registers that ID and notifies the parent. A protected first-loaded input handler contains malformed, stale, or mismatched private envelopes; for the exact envelope it writes an ID-only acknowledgment, returns `handled` so no duplicate user message is queued, and resolves the tool with the answer. Pi can request the model again only after that tool result, continuing the same run (`pi-extension/subagents/question-protocol.ts`, `pi-extension/subagents/subagent-runtime-control.ts`, `pi-extension/subagents/index.ts`).

## Data ownership

- Pi session JSONL files are authoritative for conversation entries and result summaries (`pi-extension/subagents/session.ts`).
- Structurally validated Pi loadout sidecars preserve model, identity, capability mode, selected built-ins or legacy strict tools, exact ordered profile extension paths, nested-spawn state, working directory, and Pi agent directory for safe preflighted resume (`pi-extension/subagents/session.ts`, `pi-extension/subagents/index.ts`).
- Activity snapshots are version 1 JSON files written by temp-file rename. `agent_end` is a waiting state that remains writable across retry activity; terminal auto-exit records `latestEvent: "agent_settled"`. Invalid or wrong-child snapshots are rejected (`pi-extension/subagents/activity.ts`).
- `config.json` is an untracked local override; `config.json.example` is the fallback. The current schema accepts only `status.enabled` (`.gitignore`, `config.json.example`, `pi-extension/subagents/status.ts`).

## Invariants

- Every spawn names a known agent. Nested spawning is granted only by a non-empty `subagent_agents` profile field and is constrained through `PI_SUBAGENT_ALLOWED` (`pi-extension/subagents/index.ts`).
- Omitted runtime names receive deterministic suffixes across running, in-flight, and completed agents. Explicit collisions are rejected rather than suffixed (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`).
- Resume replays the stored sandbox rather than re-reading a potentially changed profile (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`).
- Healthy active and waiting snapshots do not become stalled merely because they are old; missing or invalid snapshots cross a fixed 60-second watchdog threshold (`pi-extension/subagents/status.ts`).
- tmux splits use detached mode and are rebalanced to `even-horizontal` without intentionally changing focus. Live-message buffers are UUID-qualified, loaded from stdin, removed by successful paste or best-effort cleanup, and are not reused for shell launch commands (`pi-extension/subagents/tmux.ts`).
- A capture failure alone does not prove pane loss. Exit polling confirms the pane is absent before reporting interruption; recovery remains operator-controlled because an unconfirmed message may already have been accepted (`pi-extension/subagents/tmux.ts`, `pi-extension/subagents/index.ts`).

## Integrations and tradeoffs

- The verified development baseline targets Pi 0.87.0 APIs and matching TypeBox, while public peer ranges remain wildcard. Profile extension paths resolve read-only from exact configured global package sources or, for trusted project profiles, project-first package settings with safe global fallback (`package.json`, `package-lock.json`, `pi-extension/subagents/agents.ts`).
- A profile with `cli: claude` uses a bundled Stop hook and launches Claude Code with `--dangerously-skip-permissions`; this path should be treated as explicitly trusted configuration (`pi-extension/subagents/index.ts`, `pi-extension/subagents/plugin/hooks/on-stop.sh`).
- Unverified: no design history predates the repository's single current commit, so rationale beyond source comments and README statements is unavailable (`git log`).
