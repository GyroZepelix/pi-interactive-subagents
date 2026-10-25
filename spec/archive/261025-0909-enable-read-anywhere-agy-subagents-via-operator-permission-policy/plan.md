# Plan: Enable read-anywhere AGY subagents via operator permission policy

Work item: `261025-0909-enable-read-anywhere-agy-subagents-via-operator-permission-policy`
Status: Planned
Created: 2026-10-25
Updated: 2026-10-25

Assurance: medium - an operator-approved global AGY permission policy widens what an external model may read on this machine and applies to every AGY run, but it is reversible from a backup; the extension change is a local, non-blocking preflight plus diagnostic and documentation updates.

## Goal

Read-only `cli: agy` subagents can read any host file except an explicit secret deny list, can never write files, and keep commands, MCP, and web at AGY's headless soft-denied Ask default. When the expected policy is missing, every AGY launch carries a one-line warning, and permission denials explain the active workspace boundary and remedy.

## Context

- Every recorded AGY failure (19 denials across sessions, including `focused-0301` on 2026-10-25) was a `read_file` soft-denial of a path outside the AGY workspaces: mostly `/private/tmp` review evidence, plus sibling repositories, worktree `.git` targets, resolved skill symlinks under `~/.local/share/loremaster`, and Pi session artifacts. One denial ends the run after one turn with an empty response.
- The archived parent-workspace fix (`spec/archive/260926-1205-allow-agy-subagents-to-read-the-parent-workspace/`) adds only the distinct parent cwd. It does not help when parent and child cwd match.
- `--add-dir /` is unsuitable: AGY auto-allows workspace reads and writes, and earlier live evidence showed 57 runtime tools (including write and command tools) despite the generated four-tool agent.
- AGY's documented fine-grained rules in `~/.gemini/antigravity-cli/settings.json` evaluate `Deny > Ask > Allow` and override workspace defaults. `read_file(*)` grants all reads without writes; a read deny also denies writes ([Permissions](https://antigravity.google/docs/permissions?tab=cli)).
- Installed AGY is 1.4.7; earlier repository evidence was verified on 1.2.11.
- `parseAgyResult` (`pi-extension/subagents/agy.ts`) already fails non-empty `denied_actions`; its caller is in `pi-extension/subagents/index.ts`. AGY launch preparation and the launch acknowledgment are in `launchSubagent` and the `subagent` tool handler in `index.ts`.

## Requirements

1. Keep the AGY command, workspace derivation, generated agent, tool translation, and resume snapshot contract unchanged. Never pass `--add-dir /` or `--dangerously-skip-permissions`.
2. The extension never writes `~/.gemini` or any AGY settings. It reads only `$HOME/.gemini/antigravity-cli/settings.json`.
3. Add a pure, tested preflight helper that reports the policy as satisfied only when the file parses as a JSON object whose `permissions.allow` contains exactly `read_file(*)` and whose `permissions.deny` contains exactly `write_file(*)`. Missing, unreadable, unparsable, or incomplete settings produce a bounded warning naming the missing rule(s).
4. Run the preflight for new AGY launches and AGY resumes. It never blocks. When it is unsatisfied, add one warning line to the launch or resume acknowledgment returned to the parent. Pi and Claude launches are unaffected.
5. Extend the denied-action failure diagnostic with the run's AGY workspace roots (child cwd, generated-agent root, and any additional roots) and a short remedy: configure the documented `read_file` allow policy or stage the evidence inside a workspace. Keep it bounded and keep the existing action and stderr evidence.
6. After explicit user approval and a timestamped backup, merge the confirmed policy into the operator's settings, preserving existing keys such as `trustedWorkspaces`:
   - allow: `read_file(*)`
   - deny: `write_file(*)`, `read_file(/Users/dgjalic/.ssh)`, `read_file(/Users/dgjalic/.gemini/antigravity-cli/antigravity-oauth-token)`, `read_file(/Users/dgjalic/.pi/agent/auth.json)`, `read_file(/Users/dgjalic/.codex/auth.json)`, `read_file(/Users/dgjalic/.docker/config.json)`, `read_file(/Users/dgjalic/Library/Keychains)`
7. Document the operator setup snippet, global scope (it affects interactive AGY use too), the secret deny-list pattern, the residual exposure of in-repository secrets, and the new warning and diagnostic in `README.md`, `docs/agent-definitions.md`, and source-verified wiki pages.

## Out of scope

- Profile fields, `subagent` parameters, or prompt-derived paths for extra workspace roots.
- Dedicated AGY projects, generated hooks, OS sandboxing, or resuming the parked any-read redesign (`260926-1351`, present only on the `feature/agy-any-read` branch). No supersession is needed.
- Blocking launches on missing policy, auto-installing policy, or reading AGY's conversation databases for denied paths.
- Dependencies, snapshot migrations, commits, pushes, or publishing.

## Assumptions

- A persistent `read_file(*)` allow rule authorizes headless non-workspace reads on AGY 1.4.7 before soft-denial. Revisit if the live canary still denies the outside read.
- Explicit read denies cover symlink-resolved targets for the listed real paths (all listed paths are their own real paths on this machine). Revisit if the canary shows otherwise.
- The default settings location applies. Revisit if AGY documents a relocation variable.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D01 | Read reach | Use the operator-managed global `read_file(*)` allow rule, not added workspaces. | Workspaces are writable by default and runtime tool inventory is not limited to the generated agent. | AGY permissions docs; parked item `260926-1351` live evidence. | AGY adds a process-local read-only flag. |
| D02 | Write boundary | Deny `write_file(*)` globally. | Deny overrides workspace auto-allow, making AGY file tools write-nowhere. | AGY permissions docs; user decision 2026-10-25. | Interactive AGY editing is needed on this machine. |
| D03 | Preflight | Warn but never block. | Keeps existing workflows running while making missing policy visible. | User decision 2026-10-25. | Missing policy causes repeated silent review failures. |
| D04 | Denials | Keep any denied action as a failed run. | A run without required evidence is unsafe for review orchestration. | Archived `260926-1205` D04. | AGY documents intentionally non-fatal denials. |

## Work breakdown

- [x] T01: Add policy preflight and richer denial diagnostics
  - Depends on: none
  - Scope: Pure settings-policy helper and diagnostic formatting in `agy.ts`; wire the warning into AGY launch and resume acknowledgments, and pass workspace roots to the denial diagnostic in `index.ts`.
  - Expected areas: `pi-extension/subagents/agy.ts`, `pi-extension/subagents/index.ts`, `test/test.ts`
  - Acceptance: Requirements 1-5 hold; satisfied policy adds no warning.
  - Verification: `node --test --test-name-pattern='AGY|agy' test/test.ts`, then `env -u PI_SUBAGENT_ALLOWED npm test`.
- [x] T02: Document the policy contract
  - Depends on: T01
  - Scope: User docs and source-verified wiki guidance per Requirement 7; append `wiki/log.md` only if wiki pages change.
  - Expected areas: `README.md`, `docs/agent-definitions.md`, `wiki/architecture.md`, `wiki/conventions/runtime-safety.md`, `wiki/log.md`
  - Acceptance: No current doc claims AGY can read only its workspaces without noting the operator policy; caveats are present.
  - Verification: Markdown link, fence, and ASCII checks; stale-claim search.
- [x] T03: Apply operator policy and run the live canary (approval-gated)
  - Depends on: T01
  - Scope: With explicit approval, back up and merge Requirement 6 into the settings file, then run one low-effort AGY canary from a disposable `/private/tmp` tree.
  - Acceptance: Live acceptance criteria below pass; the temporary canary deny rule is removed and settings equal the approved policy plus preserved keys.
  - Verification: Settings diff against backup; canary result JSON and `denied_actions`; sentinel hashes.

## Acceptance criteria

- Preflight unit cases: satisfied policy gives no warning; missing file, invalid JSON, non-object, missing `permissions`, missing allow, and missing deny each give a bounded warning naming what is missing.
- AGY launch and resume acknowledgments include the warning only when unsatisfied; launches still proceed. Pi and Claude output is unchanged.
- A `denied_actions` result produces a failure containing the actions, the run's workspace roots, the remedy, and bounded stderr.
- Generated AGY commands and snapshots are byte-identical to current behavior for the same inputs.
- Live (T03): an AGY child whose cwd differs from the canary directory reads a harmless file under `/private/tmp` and returns its content; an instructed write inside its workspace is denied and leaves the sentinel unchanged; a read under a temporary canary-only `read_file` deny is denied.

## Verification plan

1. `node --test --test-name-pattern='AGY|agy' test/test.ts`
2. `env -u PI_SUBAGENT_ALLOWED npm test`
3. `npm pack --dry-run --json` to confirm package contents are unchanged in shape.
4. Markdown relative-link, fence-balance, and ASCII checks on changed docs; `git diff --check`.
5. `uv run spec/scripts/manage-spec-item.py --root . validate --item "261025-0909-enable-read-anywhere-agy-subagents-via-operator-permission-policy"` and `uv run spec/scripts/manage-spec-item.py --root . validate --operational`.
6. Approval-gated T03 settings merge and one live canary; otherwise record live behavior as unverified.
7. One focused medium-assurance review of the preflight, diagnostic, unchanged command and snapshot contract, and docs.

## Risks and blockers

- **Reviewer writes trigger failures:** with `write_file(*)` denied, any AGY write attempt (including its own scratch writes) becomes a denied action and fails the run. Observe in the canary; if AGY 1.4.7 writes scratch files by itself, stop and ask before changing D02 or D04.
- **Secret exposure:** in-repository `.env` and similar files stay readable because path globs are unsupported. Documented, not mitigated.
- **Policy drift:** a later AGY update or settings edit can remove the rules; the non-blocking preflight surfaces this.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete: T01, T02, and T03 (with approvals).
- [x] Verification complete: see `verification.md`.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read spec/active/261025-0909-enable-read-anywhere-agy-subagents-via-operator-permission-policy/plan.md, its item.yaml, and applicable repository instructions completely.
Implement the smallest coherent change that satisfies Requirements and Acceptance at medium assurance, preserving Out of scope and the Decision Log.
Run the Verification plan and record only verified evidence, failures, skipped checks, and residual uncertainty.
Stop for explicit approval before editing ~/.gemini settings, running the model-consuming canary, dependencies, destructive actions, commits, pushes, or scope expansion.
```

## Proposed durable knowledge updates

- `wiki/conventions/runtime-safety.md`: AGY read reach depends on the operator `read_file(*)` and `write_file(*)` policy; the extension only reads and warns.
- `wiki/architecture.md`: launch and resume preflight warning, and workspace roots in denial diagnostics.
