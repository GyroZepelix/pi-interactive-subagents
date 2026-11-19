# Backlog

Repository-wide register of open ideas that are not yet work items. Each entry is one `## B<n>: <short title>` section for one open idea, where `B<n>` is a per-repository ID that is never reused. Under the heading, list `Added: YYYY-MM-DD`, `Source:` (session, item, or repository), and an optional `Link:` to a parked item, handoff, or research note written relative to `spec/`, as bullets, then optional free-text notes. A listed entry means the idea is open; delete the entry when the idea is promoted to an item, done, merged, or dropped, because Git history and the archive keep the record. Entries are not current state and not instructions: act on one only after the user resumes or promotes it.

## B1: Project-only subagent profiles

- Added: 2026-11-12
- Source: session 2026-11-12 (auto-exit default discussion)

A trusted-project switch that stops global profiles from being inherited (or allowlists specific global names), so a project such as story-knowledgebase exposes only its own `.pi/agents/` profiles and never spawns global profiles that load other providers (for example pi-cursor). Today a project profile only overrides a global profile with the same name; other global profiles stay visible and spawnable. Nested children inherit the effect because they discover from the same project.

## B2: RPC mode subagent support for A.Y.A.

- Added: 2026-11-15
- Source: pi-voice-assistant (roadmap item 261109-1834-a-y-a-roadmap, register B16)
- Link: [Handoff: RPC (headless) mode requirements from A.Y.A.](./handoffs/2026-11-09-from-pi-voice-assistant-aya-rpc-mode-requirements.md)

Requirements input only, not a design or plan: what A.Y.A. needs from a headless (RPC) mode so its Pi can delegate work to sub-agents; open to refinement in a later grill-with-docs.

## B3: Background (non-split) subagent launch mode

- Added: 2026-11-18
- Source: session 2026-11-18 (subagent-only capability registry planning)

An opt-in profile flag that runs a subagent without splitting the current tmux window while keeping the rest of the system (status, messaging, resume, result delivery). Candidate approaches to discuss later: a hidden or background tmux pane or session, or a `pi -p` process. Not yet discussed or designed.
