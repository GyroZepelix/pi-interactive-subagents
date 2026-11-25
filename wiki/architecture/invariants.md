# Architecture invariants

## Invariants

- Every spawn names a known agent. Nested spawning is granted only by a non-empty `subagent_agents` profile field and is constrained through `PI_SUBAGENT_ALLOWED` (`pi-extension/subagents/index.ts`).
- Omitted runtime names receive deterministic suffixes across running, in-flight, and completed agents. Explicit collisions are rejected rather than suffixed (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`).
- Resume replays the stored sandbox rather than re-reading a potentially changed profile. Versions 2 and 3 revalidate every exact MCP source/digest, version 3 also requires every stored skill file, and drift is refused before pane creation (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`, `pi-extension/subagents/mcp-config.ts`).
- Healthy active and waiting snapshots do not become stalled merely because they are old; missing or invalid snapshots cross a fixed 60-second watchdog threshold, and only then are labelled `no activity` or `invalid activity` (`pi-extension/subagents/status.ts`).
- tmux splits use detached mode and are rebalanced to `even-horizontal` without intentionally changing focus. Live-message buffers are UUID-qualified, loaded from stdin, removed by successful paste or best-effort cleanup, and are not reused for shell launch commands (`pi-extension/subagents/tmux.ts`).
- Detached surface handles are `pi-subagents:%n`. Every tmux primitive parses the handle and prefixes `-L pi-subagents`, including the `submitText` buffer load, paste, and delete steps, because buffers are per server. Plain `%n` handles keep their exact argv, and detached closes skip layout rebalancing. Exit polling treats a missing private server (`no server running`, or a connect error for a missing socket or a refused connection) as confirmed pane loss (`pi-extension/subagents/tmux.ts`).
- A capture failure alone does not prove pane loss. Exit polling confirms the pane is absent before reporting interruption; recovery remains operator-controlled because an unconfirmed message may already have been accepted (`pi-extension/subagents/tmux.ts`, `pi-extension/subagents/index.ts`).
