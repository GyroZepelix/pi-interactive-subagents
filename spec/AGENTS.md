# Spec Instructions

Protocol version: 1

## Purpose

`/spec` stores intended change, active planning state, implementation tasks, verification evidence, outcomes, and archived work history.

## Required structure

- `spec/active/<id>/`: every nonterminal initiative or work item.
- `spec/archive/<id>/`: terminal history retained under the same stable ID.
- `spec/templates/`: canonical artifact templates.
- `spec/scripts/manage-spec-item.py`: deterministic creation, resolution, current planning transitions, validation, and index maintenance.
- `spec/index.md`: generated routing tables plus human-authored orientation.

## Work-item contract

- Every active item contains `item.yaml` with `schema_version: 1`.
- Quick Plan items contain `plan.md` and start in `planned`.
- Grill With Docs items contain `discovery.md` and start in `discovering`.
- To Spec preserves discovery evidence, creates `plan.md`, and transitions `ready_for_spec` to `planned`.
- `verification.md` and `outcome.md` are created only by later workflows that own those lifecycle phases.
- `plan.md` is the canonical implementation contract. Discovery and research cannot silently override it.

## Planning boundaries

- Ask questions before planning.
- Keep unresolved and evolving design in `discovery.md`.
- Keep confirmed implementation decisions in the plan Decision Log.
- Keep task-specific research under the active item.
- Do not mirror every spec into the wiki.
- Keep future design out of current-state wiki guidance until implementation and verification establish it.

## Indexing

- `item.yaml` and filesystem location are authoritative for item identity and status.
- Update only the managed regions in `spec/index.md`.
- Explicitly identify an item by ID or path. Infer only when exactly one eligible active item exists.
- Never infer the active item from a Git branch or shared current-item pointer.

## Archive boundary

`spec/archive/` is the only terminal location. Completion, cancellation, supersession, verification automation, and archive transitions are reserved for a later workflow and are not implemented by the current planning skills.

## Authority

Explicit user instructions and current `AGENTS.md` files outrank accepted plans. Source at `HEAD` is authoritative for current implementation state. When a plan conflicts with source or current repository instructions, record the conflict and resolve it instead of guessing.
