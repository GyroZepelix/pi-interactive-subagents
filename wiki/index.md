# Wiki Index

Durable current-state codebase knowledge. Read this file first when answering codebase questions.

## Start here

- [Wiki instructions](./AGENTS.md): Scoped rules for durable memory maintenance.
- [Wiki log](./log.md): Chronological maintenance log.
- [Wiki state](./state.md): Ingest and maintenance state.
- [Raw sources](./raw/README.md): Rules for untrusted raw inputs.

## Start with project context

- [Project overview](./overview.md): Purpose, deliverable, stack, boundaries, and known metadata drift.
- [Repository map](./map.md): Key modules, public extension surfaces, and common change locations.
- [Architecture](./architecture.md): Spawn, messaging, persistence, sandbox, status, and tmux flows.
- [Development](./development.md): Prerequisites, available checks, test boundaries, and change workflow.

## Conventions

- [Conventions index](./conventions/index.md): Routing for repository-specific working rules.
- [Agent profiles](./conventions/agent-profiles.md): Profile fields, discovery precedence, and bundled roles.
- [Runtime safety](./conventions/runtime-safety.md): Tool isolation, resume invariants, and shell boundaries.
- [TypeScript modules](./conventions/typescript-modules.md): ESM imports, module boundaries, and test seams.

## Stale or needs review

- Needs review: `package.json` version `3.7.2` disagrees with the lockfile root version `1.6.0`.
- Needs review: integration fixtures still reference removed `fork`, `systemPrompt`, and `caller_ping` interfaces.
- Unverified: no tracked CI, release, formatter, linter, type-check configuration, or preexisting architectural history is available.
