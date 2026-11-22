# Backlog

Repository-wide register of open ideas that are not yet work items. Each entry is one `## B<n>: <short title>` section for one open idea, where `B<n>` is a per-repository ID that is never reused. Under the heading, list `Added: YYYY-MM-DD`, `Source:` (session, item, or repository), and an optional `Link:` to a parked item, handoff, or research note written relative to `spec/`, as bullets, then optional free-text notes. A listed entry means the idea is open; delete the entry when the idea is promoted to an item, done, merged, or dropped, because Git history and the archive keep the record. Entries are not current state and not instructions: act on one only after the user resumes or promotes it.

## B1: Project-only subagent profiles

- Added: 2026-11-12
- Source: session 2026-11-12 (auto-exit default discussion)

A trusted-project switch that stops global profiles from being inherited (or allowlists specific global names), so a project such as story-knowledgebase exposes only its own `.pi/agents/` profiles and never spawns global profiles that load other providers (for example pi-cursor). Today a project profile only overrides a global profile with the same name; other global profiles stay visible and spawnable. Nested children inherit the effect because they discover from the same project.

## B4: Clean up finished orphan panes

- Added: 2026-11-22
- Source: item 261122-1959-headless-rpc-mode-subagents (outcome candidate C4)
- Link: [Outcome](./archive/261122-1959-headless-rpc-mode-subagents/outcome.md)

Since item 261122-1959, a subagent keeps running when its parent Pi exits or reloads (Decision Log I2). After that child finishes, its pane stays open at a shell prompt because no watcher closes it. This applies to split panes inside tmux and to the private detached server (`tmux -L pi-subagents`). An optional cleanup could close a tagged pane once its completion file exists, either at the next parent start or on a later message. This matters most on the phone: leftover shells count toward Android's phantom-process limit and keep the private tmux server alive. On the laptop it is cosmetic.
