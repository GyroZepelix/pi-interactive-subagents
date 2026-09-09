# Project Overview

## Purpose

`pi-interactive-subagents` is a tmux-only Pi extension for running asynchronous subagents in separate panes. A parent Pi session can spawn an agent, continue working, receive status in the TUI, and receive the final result as a steered message. The intended users are Pi users who want visible, concurrent agent sessions with constrained role profiles (`README.md`, `package.json`).

## Deliverable

The repository ships an ESM Pi package whose registered extension entry point is `pi-extension/subagents/index.ts`. It also includes three bundled profiles in `agents/`, an optional status configuration example, a Claude Code completion-hook plugin, and unit plus live integration tests (`package.json`, `agents/`, `config.json.example`, `pi-extension/subagents/plugin/`, `test/`).

## Stack and runtime

- TypeScript is executed directly by Pi/Node; local imports retain `.ts` extensions (`package.json`, `pi-extension/subagents/*.ts`).
- Runtime APIs come from `@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui`, and `@sinclair/typebox` (`package.json`).
- tmux is the only supported pane backend and both `$TMUX` and the `tmux` executable are required (`README.md`, `pi-extension/subagents/tmux.ts`).
- Runtime state is file-backed under Pi session and artifact directories, not in a project database (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`).

## Repository boundaries

- Product code is under `pi-extension/subagents/` and agent definitions are under `agents/`.
- `test/` contains local unit tests and side-effecting integration tests.
- `spec/` is the planning protocol, while `wiki/` is durable current-state knowledge (`AGENTS.md`).
- There is no tracked CI, deployment configuration, build pipeline, or application server.

## Needs review

- `package.json` reports version `3.7.2`, while the lockfile root reports `1.6.0` (`package.json`, `package-lock.json`).
- Parts of the integration suite still request removed `fork`, `systemPrompt`, and `caller_ping` interfaces, while current unit tests assert those interfaces are absent (`test/integration/subagent-lifecycle.test.ts`, `test/integration/agents/test-ping.md`, `test/test.ts`).
