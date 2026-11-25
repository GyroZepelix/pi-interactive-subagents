# Wiki Index

Durable current-state codebase knowledge. Read this file first when answering codebase questions.

## Start here

- Before editing any file under `wiki/`, read [Wiki instructions](./AGENTS.md): scoped rules for durable memory maintenance.
- When auditing prior wiki maintenance or recording lint or Dream dispositions, read [Wiki log](./log.md): chronological maintenance log.
- Before running Dream or checking wiki ingest checkpoints, read [Wiki state](./state.md): ingest and maintenance state.
- Before adding or consulting inputs under `wiki/raw/`, read [Raw sources](./raw/README.md): rules for untrusted raw inputs.

## Start with project context

- When orienting to repository purpose, deliverables, runtime stack, or boundaries, read [Project overview](./overview.md): purpose, deliverable, stack, and boundaries.
- Before locating modules, public tools or commands, or change entry points across `pi-extension/subagents/` or `test/`, read [Repository map](./map.md): key modules, public extension surfaces, and common change locations.
- When orienting to the extension's Pi/tmux system boundary or locating an architecture leaf, read [Architecture](./architecture.md): system boundary and architecture section map.
- Before or when changing agent discovery, pre-pane validation, surface selection, child launch order, auto-exit settling, AGY/model-chain execution, or completion polling in `pi-extension/subagents/`, read [Spawn and completion flow](./architecture/spawn-and-completion.md): end-to-end launch and completion lifecycle.
- Before or when modifying live steering, `ask_question` envelopes, `subagent-registry.json` resume, or model-chain ownership handoff in `pi-extension/subagents/`, read [Messaging and resume](./architecture/messaging-and-resume.md): live transport, question protocol, and resume boundaries.
- Before or when changing session JSONL handling, loadout/AGY/model-chain/activity sidecar schemas, or `config.json` `maxConcurrent` limits in `pi-extension/subagents/`, read [Data ownership](./architecture/data-ownership.md): authoritative files, sidecar versions, and concurrency-cap accounting.
- Before or when changing `PI_SUBAGENT_ALLOWED` nesting, runtime name allocation, resume revalidation, watchdog thresholds, or tmux socket/buffer/pane-loss invariants in `pi-extension/subagents/`, read [Architecture invariants](./architecture/invariants.md): cross-cutting spawn, resume, status, and tmux invariants.
- Before or when modifying the Pi version baseline, package extension fallback, Claude Stop-hook launches, AGY permission-policy handling, or `ctx.mode === "rpc"` status output in `pi-extension/subagents/`, read [Integrations and tradeoffs](./architecture/integrations-and-tradeoffs.md): harness integrations, RPC host contract, and baseline limits.

## Conventions

- Before setting up the repository, running unit, integration, or package checks, or following the change workflow, read [Development](./conventions/development.md): prerequisites, verification tiers, test organization, package shape, change workflow, and current limitations.
- Before or when parsing, validating, documenting, or changing agent profiles, registries, skills, MCP selections, or model chains in `pi-extension/subagents/` or `docs/agent-definitions.md`, read [Agent profiles](./conventions/agent-profiles.md): profile discovery, validation, capabilities, and defaults.
- Before or when changing child tool isolation, MCP or extension loading, AGY permission boundaries, resume snapshots, tmux input, or session shutdown handling in `pi-extension/subagents/`, read [Runtime safety](./conventions/runtime-safety.md): isolation, resume, shell/live-input, and stale-context invariants.
- Before editing TypeScript modules or unit tests under `pi-extension/subagents/*.ts` or `test/test.ts`, read [TypeScript modules](./conventions/typescript-modules.md): ESM imports, module boundaries, and test seams.

## Reflection and recall

- Before running Dream consolidation or reviewing tentative findings, read [Observation queue](./observations.md): tentative repository-local findings; not normal implementation guidance.
- [Dream episode catalog](./dreams/episodes.jsonl): Metadata-only routing for immutable session episodes.
- Per-spec Dream ledgers: `wiki/dreams/by-spec/<item-id>.md`.
- Workflow retrospectives: `wiki/dreams/retrospectives/<item-id>.md`.
