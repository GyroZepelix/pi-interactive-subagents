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
- [Agent profiles](./conventions/agent-profiles.md): Validated user-managed profiles, trust-aware discovery, precedence, and nesting.
- [Runtime safety](./conventions/runtime-safety.md): Tool isolation, resume invariants, and shell/live-input boundaries.
- [TypeScript modules](./conventions/typescript-modules.md): ESM imports, module boundaries, and test seams.

## Reflection and recall

- [Observation queue](./observations.md): Tentative findings for later Dream comparison; not normal implementation guidance.
- [Dream episode catalog](./dreams/episodes.jsonl): Metadata-only routing for immutable session episodes.
- Per-spec Dream ledgers: `wiki/dreams/by-spec/<item-id>.md`.
- Workflow retrospectives: `wiki/dreams/retrospectives/<item-id>.md`.

## Stale or needs review

- Unverified: no tracked CI, release, formatter, linter, type-check configuration, or preexisting architectural history is available.
- Deferred: general stop/interrupt controls, correlation-safe acknowledgment for active Pi or Claude input, automatic replay, shell-readiness redesign, broader configuration, orchestration modularization, and unrelated dead-code cleanup.
