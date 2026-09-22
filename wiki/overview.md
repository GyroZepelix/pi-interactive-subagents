# Project Overview

## Purpose

`pi-interactive-subagents` is a tmux-only Pi extension for running asynchronous subagents in separate panes. A parent Pi session can spawn an agent, continue working, receive status in the TUI, and receive the final result as a steered message. The intended users are Pi users who want visible, concurrent agent sessions with constrained role profiles (`README.md`, `package.json`).

## Deliverable

The repository ships an ESM Pi package whose registered extension entry point is `pi-extension/subagents/index.ts`. It provides no bundled profiles; users manage global or trusted project definitions. The package includes an agent-definition reference, an optional status configuration example, a Claude Code completion-hook plugin, and unit plus live integration tests (`package.json`, `docs/agent-definitions.md`, `config.json.example`, `pi-extension/subagents/plugin/`, `test/`).

## Stack and runtime

- TypeScript is executed directly by Pi/Node; local imports retain `.ts` extensions (`package.json`, `pi-extension/subagents/*.ts`).
- Runtime APIs use a verified Pi 0.87.0 development baseline through `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, and matching `typebox`; public peer ranges remain wildcard (`package.json`, `package-lock.json`).
- tmux is the only supported pane backend and both `$TMUX` and the `tmux` executable are required (`README.md`, `pi-extension/subagents/tmux.ts`).
- Runtime state is file-backed under Pi session and artifact directories, not in a project database (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`).

## Repository boundaries

- Product code is under `pi-extension/subagents/`; user agent definitions live outside the package in global or trusted project configuration.
- `test/` contains local unit tests and side-effecting integration tests.
- `spec/` is the planning protocol, while `wiki/` is durable current-state knowledge (`AGENTS.md`).
- There is no tracked CI, deployment configuration, build pipeline, or application server.

## Needs review

- No tracked CI, release, formatter, linter, or non-emitting type-check configuration exists.
