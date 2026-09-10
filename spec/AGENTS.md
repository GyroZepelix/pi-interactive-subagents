# Spec Instructions

Protocol version: 1

## Purpose

`/spec` stores intended change, active planning state, implementation tasks, verification evidence, outcomes, and archived work history.

## Required structure

- `spec/active/<id>/`: every nonterminal initiative or work item.
- `spec/archive/<id>/`: terminal history retained under the same stable ID.
- `spec/templates/`: canonical artifact templates.
- `spec/scripts/manage-spec-item.py`: deterministic creation, resolution, current planning transitions, completed archival, validation, and index maintenance.
- `spec/index.md`: generated routing tables plus human-authored orientation.

## Work-item contract

- Every active item contains `item.yaml` with `schema_version: 1`.
- Quick Plan items contain `plan.md` and start in `planned`.
- Grill With Docs items contain `discovery.md` and start in `discovering`.
- To Spec preserves discovery evidence, creates `plan.md`, and transitions `ready_for_spec` to `planned`.
- Implement creates or updates `verification.md` after successful evidence gates. It creates `outcome.md` only after explicit completion approval.
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
- Active items use `discovering`, `ready_for_spec`, or `planned` as their route permits. Archived items use `completed`.
- Update only the managed regions in `spec/index.md`.
- Explicitly identify an item by ID or path. Infer only when exactly one eligible active item exists.
- Never infer the active item from a Git branch or shared current-item pointer.

## Archive boundary

`spec/archive/` is the only terminal location. After all applicable implementation evidence gates pass, Implement may preflight completion, request explicit terminal approval, create `outcome.md`, and invoke the helper's dedicated `archive` command. That command is the only protocol operation that moves the item, sets `status: completed`, and regenerates both index tables. Missing artifacts, invalid state, an existing destination, or literal canonical `spec/active/<id>` text in Markdown outside the item block a new move. Archive location is the commit point; rerunning the command may idempotently finish archived status or repair the derived index.

Cancellation, supersession, and broader execution-state automation remain unimplemented. Planning skills do not archive items.

## Authority

Explicit user instructions and current `AGENTS.md` files outrank accepted plans. Source at `HEAD` is authoritative for current implementation state. When a plan conflicts with source or current repository instructions, record the conflict and resolve it instead of guessing.
