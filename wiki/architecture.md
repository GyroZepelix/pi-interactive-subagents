# Architecture

## System boundary

The package is an in-process Pi extension that supervises child Pi, optional Claude Code CLI, or read-only Antigravity CLI (`agy`) processes through tmux. It does not provide a network service. Pi supplies extension lifecycle events, tool registration, session locations, and TUI rendering; tmux supplies pane/process isolation and terminal transport (`package.json`, `pi-extension/subagents/index.ts`, `pi-extension/subagents/tmux.ts`).

## Sections

- [Spawn and completion flow](./architecture/spawn-and-completion.md): profile discovery, pre-pane validation, surface selection, Pi/AGY/model-chain launch, watcher polling, and completion signals.
- [Messaging and resume](./architecture/messaging-and-resume.md): live tmux message transport, `ask_question` envelopes, `subagent-registry.json` resume, and model-chain ownership handoff.
- [Data ownership](./architecture/data-ownership.md): authoritative Pi session JSONL files, loadout/AGY/chain/activity sidecars, and `config.json` limits.
- [Architecture invariants](./architecture/invariants.md): nesting allowlists, name collision handling, resume revalidation, watchdog thresholds, and tmux socket/pane-loss invariants.
- [Integrations and tradeoffs](./architecture/integrations-and-tradeoffs.md): Pi baseline, Claude Stop-hook trust, AGY permission-policy diagnostics, the `ctx.mode === "rpc"` contract, and history limits.
