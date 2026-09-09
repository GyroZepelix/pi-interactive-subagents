# Wiki State

Last full ingest commit: `e17580a389d2157629a594c706ccadb972c213ef`
Last incremental ingest commit: none
Last lint date: 2026-09-09

## Last full ingest

- Completion status: Complete.
- Analysis commit: `e17580a389d2157629a594c706ccadb972c213ef`.
- Ingest date: 2026-09-09.
- Working-tree snapshot: clean at capture; baseline outside `wiki/` was clean.
- Output pages: `wiki/overview.md`, `wiki/map.md`, `wiki/architecture.md`, `wiki/development.md`, `wiki/conventions/index.md`, `wiki/conventions/agent-profiles.md`, `wiki/conventions/runtime-safety.md`, `wiki/conventions/typescript-modules.md`, `wiki/index.md`, `wiki/log.md`, `wiki/state.md`.
- Allowed checks: none run; no lint, formatter-check, non-emitting type-check, or CI command is configured, and `node_modules/` was absent.
- Unresolved gaps: package version metadata and stale integration interfaces need review; CI, release, lint, format, type-check, and earlier design rationale are unverified.

## Processed inputs

| Input | Type | Source | Processed date | Output pages | Notes |
| --- | --- | --- | --- | --- | --- |
| `https://git.dgjalic.com/dgjalic/repo-wiki-template` | Protocol version 1 template installer | Forgejo repository | 2026-09-09 | `AGENTS.md`, `spec/`, `wiki/` | Installed lean repo wiki template. |
| `e17580a389d2157629a594c706ccadb972c213ef` | Initial full codebase ingest | Clean Git working tree | 2026-09-09 | Core pages, focused conventions, navigation, and completion records | Complete; no eligible safe project check; metadata and integration drift need review. |

## Maintenance policy

This file is compact processing state for resume, dedupe, lint, and ingest checkpoints. It is not append-only history.

Update this file when:

- Full or incremental ingest checkpoints change.
- Lint date or lint checkpoint state changes.
- Raw files, source batches, URL batches, specs, verification, outcomes, or commit ranges are processed into durable wiki knowledge and need dedupe/resume tracking.

Do not add rows for every session, chat turn, verification command, routine implementation plan, routine wiki edit, log-only event, or codebase change that does not affect durable wiki knowledge.

For wiki maintenance rows, `Output pages` should name wiki pages. Install/bootstrap rows may summarize the broader installed payload.

- Update checkpoints only after affected wiki pages are processed.
- Keep raw sources separate from trusted wiki synthesis.
- Mark uncertain or unverified pages as stale in `wiki/index.md`.
