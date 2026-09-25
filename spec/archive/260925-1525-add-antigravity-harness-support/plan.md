# Plan: Add Antigravity harness support

Work item: `260925-1525-add-antigravity-harness-support`
Status: Planned
Created: 2026-09-25
Updated: 2026-09-25

## Goal

Add `cli: agy` as a supported subagent harness so Pi can launch one directly executing Antigravity CLI process with Gemini 3.8 Flash, a strict prompt-free read-only tool surface, automatic result delivery, and exact-conversation resume.

The observable outcome is that a migrated `scout` or `flash-reviewer` profile can use `model: gemini-3.8-flash`, its existing medium or high `thinking` value, and `builtin-tools: [read, grep, find, ls]`; the parent receives the actual AGY response and can later continue that completed conversation by the same runtime name.

## Assurance

Medium - the change crosses profile validation, external process launch, result parsing, persistent name and resume state, status rendering, and a capability boundary. Incorrect tool translation or resume state could grant unintended behavior or break existing Pi sessions, but the work is local, reversible, and has no dependency, data migration, production, or destructive operation.

Review expectations:

- Review the coherent profile, capability, launch, persistence, and resume boundary after it is integrated and focused tests pass.
- Perform a final contract-quality review after documentation and all approved safe verification complete.

## Context

- The package currently supports Pi and a Claude-specific external path. `cli: claude` is hard-coded across parsing, launch, status, steering, result extraction, and non-resume behavior.
- Pi resume is backed by strict loadout sidecars and a name registry whose current entry shape is Pi-session-specific.
- Locally verified AGY 1.2.11 supports headless JSON results, exact `--conversation` resume, custom primary agents discovered through `--add-dir`, and Gemini 3.8 Flash low, medium, and high effort.
- AGY custom agents separate tool availability from permission policy. Restricting the generated native tool list is required because workspace file operations may otherwise include writes.
- The intended environment is a local trusted Pi session inside tmux. The current AGY settings contain no permission override, so default prompt-free workspace reads apply.
- Discovery and external evidence remain in [discovery.md](./discovery.md) and [research/agy-cli.md](./research/agy-cli.md).

## Requirements

1. Extend the existing canonical `cli` field to accept `agy`; do not introduce a new harness field or rename `cli`.
2. Preserve current Pi and Claude profile, launch, status, messaging, and resume behavior except for narrow shared routing needed to distinguish AGY.
3. For `cli: agy`, accept only generic identity and selection fields (`name`, `description`, `model`, `thinking`, `cwd`, body, `disable-model-invocation`) plus `builtin-tools`.
4. Reject explicit AGY use of `extensions`, `skill` or `skills`, `subagent_agents`, `system-prompt`, `session-mode`, `auto-exit`, and `interactive` with field-specific diagnostics, including explicitly empty incompatible capability fields.
5. For AGY, accept only these logical built-ins and preserve their selected order after existing deduplication:
   - `read` -> `view_file`
   - `grep` -> `grep_search`
   - `find` -> `find_by_name`
   - `ls` -> `list_dir`
6. Omitted or empty AGY `builtin-tools` must generate an empty native tool list. `write`, `edit`, `bash`, and `powershell` must invalidate an AGY profile before pane creation.
7. Preflight that `agy` is available before creating a tmux pane. Never fall back to Pi, Claude, or a broader configuration.
8. Generate a collision-resistant AGY custom primary-agent definition in a dedicated parent-session artifact workspace. It must use the profile body as its system prompt, set `mainAgent: true` and `subagent: false`, and contain exactly the translated native tools.
9. Expose only that dedicated generated-agent workspace through `--add-dir`. Do not modify the target repository, `~/.gemini`, AGY settings, plugins, authentication, or the external dotfiles repository.
10. Launch exactly one AGY process in headless JSON mode from the resolved runtime or profile cwd. Apply the effective model and map profile `thinking` to `--effort`; let AGY report unsupported effort values and model-effort conflicts.
11. Do not pass `--dangerously-skip-permissions`, expose `ask_permission`, or make write, shell, web, MCP, browser, image, scheduler, or nested-agent tools available. In the confirmed no-override environment, required workspace reads must run without permission prompts or headless soft-denial notices.
12. Use collision-resistant artifacts and existing shell-escaping and long-command boundaries for the generated agent, task, stdout JSON, stderr diagnostics, launch script, and resume inputs. Prompt content must not become executable shell syntax.
13. Parse the terminal AGY JSON result strictly enough to distinguish success, error, cancellation, interruption, invalid or waiting states; deliver the exact response on success and actionable diagnostics on failure. Capture usage when present and require a valid exact conversation ID before promising resume.
14. Persist strict, harness-aware AGY resume state without weakening or rewriting existing Pi loadouts or legacy registry entries. The stored contract must include the exact conversation ID, cwd, model, effort, identity, logical and native tools, and enough generated-agent state to resume without rereading the mutable source profile.
15. A message to a currently running AGY child must return an explicit active-steering-is-unsupported result without submitting text to its pane or changing its status optimistically.
16. A message to a completed AGY name must launch a one-shot `agy --conversation <exact-id>` continuation with the stored cwd and capability contract, then deliver the new result and update the persisted exact conversation state. Missing, malformed, mismatched, unavailable, or concurrently claimed state must fail closed before pane creation.
17. Represent AGY in status and result rendering as an external running harness without claiming Pi activity precision. A confirmed missing pane must not claim resume support unless a valid AGY conversation ID and resume snapshot were persisted.
18. Document the AGY profile contract, limitations, permission behavior, active-message rejection, completed resume, and exact migration forms for `scout` and `flash-reviewer`. The migration examples remove their Pi provider extension and unsupported lifecycle fields, set `cli: agy`, use `model: gemini-3.8-flash`, retain medium/high `thinking`, the body, and the four read-only built-ins.
19. Add focused regression coverage for profile validation, tool translation, generated-agent content, command assembly, result parsing, failure handling, registry compatibility, running-message rejection, exact resume, status, and preservation of Pi and Claude behavior.

## Out of scope

- Editing `/Users/dgjalic/.dotfiles/02-agentic-llms`; the user will migrate those profiles separately.
- AGY write, edit, shell, PowerShell, web, MCP, browser, image, scheduler, permission-request, or nested-agent capabilities.
- Active AGY steering or a long-lived AGY stream-input process.
- Changing AGY global or project settings, permissions, plugins, authentication, installation, or model inventory.
- Redesigning Claude permissions, tools, completion, or non-resume behavior.
- Redesigning Pi loadout activation, nested spawning, ask-question handling, or live-message acknowledgment.
- Adding or changing dependencies, migrations, package metadata, CI, lint, formatting, or type-check infrastructure.
- Running model-consuming lifecycle tests without separate explicit approval for external calls, time, and quota.
- Commits, pushes, publishing, production actions, or unrelated cleanup.

## Assumptions

- AGY 1.2.11 or a compatible CLI remains installed and authenticated when AGY-backed profiles run. Revisit if its custom-agent, output, model, or resume contract changes.
- The active cwd is the repository the read-only agent should inspect. Reads outside the active and generated-agent workspaces may remain denied.
- The current AGY settings have no permission override. If the user later adds explicit deny or ask rules for workspace reads, those settings may supersede default prompt-free behavior and require a separately approved policy design.
- `gemini-3.8-flash` with `thinking: medium` or `high` remains accepted as `--model gemini-3.8-flash --effort <value>`. AGY owns compatibility validation and its returned error remains authoritative.
- A failed best-effort persistence write may make a completed AGY result non-resumable, but must never cause unrestricted or profile-rereading resume.

## Design

### Harness-specific profile validation

Keep canonical profile discovery in `agents.ts`. Add `agy` to the `AgentCli` enum and apply cross-field validation after frontmatter normalization by checking whether incompatible fields were explicitly present. Keep global and project precedence, invalid override tombstones, and canonical identity unchanged.

Expose a small pure AGY tool translator or prepared-capability helper so the exact logical-to-native mapping and empty/default-deny behavior can be unit tested without tmux. Do not resolve Pi extension packages for a valid AGY profile because extensions are prohibited there.

### Tagged preparation and launch

Separate Pi sandbox preparation from external harness preparation sufficiently that an AGY profile cannot accidentally receive a Pi loadout or capability environment. A tagged prepared-launch representation should carry only harness-applicable state and make Pi, Claude, and AGY branches explicit.

Before pane creation, validate the executable and all generated-state inputs. Under the parent session artifact directory, create a dedicated per-launch customization root containing only the generated `.agents/agents/<unique-name>/agent.md` contract. Use the profile description or a deterministic package-owned fallback because AGY custom agents require a description.

Build the AGY invocation through the existing escaped launch-script path. Use unique task, stdout JSON, and stderr artifacts so result parsing does not depend on terminal screen capture. The terminal sentinel remains the tmux completion signal, while the artifact files are authoritative for AGY result and diagnostic content.

### Strict result and resume state

Add a small strict AGY result parser for the documented JSON envelope. On success, require non-empty response and conversation ID according to the accepted resume contract; capture numeric usage fields defensively. On non-success or malformed output, combine the structured error and bounded stderr evidence into an actionable result without treating screen content as a successful answer.

Evolve persistent name routing with a strict backward-compatible union rather than adding optional fields to the existing exact Pi entry. Existing `{sessionFile, sessionId}` records must continue to parse byte-for-byte. New AGY entries should reference a package-owned strict sidecar or contain an equally strict tagged state, and atomic updates should add the exact conversation ID only after a valid terminal result.

The AGY snapshot, not the current source profile, owns resume behavior. Resume must validate and replay its stored cwd, identity, model, effort, tool mapping, and generated-agent contract, reserve the persisted conversation against concurrent launches, and update the exact conversation ID after each successful continuation.

### Messaging, status, and result delivery

Route a running AGY name before the generic tmux text submission path and return a stable unsupported result. Keep Pi question and waiting acknowledgments and Claude submission behavior unchanged.

Extend status-source typing and rendering so AGY follows the external `running` behavior while preserving a distinct harness identity. Result details may expose an AGY conversation ID and usage, but user-visible completion should continue through the existing automatic steer-message path.

### Documentation and durable knowledge

Update `README.md` and `docs/agent-definitions.md` together with source semantics. Include migrated `scout` and `flash-reviewer` examples without editing or packaging the user's external profiles. After implementation and verification establish current behavior, update the relevant wiki architecture, map, development, agent-profile, and runtime-safety pages under `wiki/AGENTS.md`.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D01 | Profile selector | Add `agy` to canonical `cli`; do not add `harness` or break `cli`. | Smallest compatible public schema change. | Confirmed discovery D03. | A broader profile schema migration is requested. |
| D02 | Capability boundary | Support only read, grep, find, and ls, translated to exact AGY native tools; reject incompatible fields and tools. | Meets the primary profiles' read-only goal without designing mutation or shell permissions. | Confirmed discovery D04, D11, D12. | A concrete broader capability is requested. |
| D03 | AGY identity | Generate a package-owned primary-agent artifact and select it directly; do not invoke an AGY subagent. | Makes the Pi profile authoritative without project or global customization writes. | Confirmed discovery D09; local no-model discovery probe. | AGY stops discovering agents through added workspaces. |
| D04 | Permission behavior | Use exact tool omission and default workspace reads; never use unrestricted permission bypass. | Delivers prompt-free required reads while preserving read-only isolation. | Confirmed discovery D13 and D15; current settings inspection. | User permission overrides block required workspace reads. |
| D05 | Lifecycle | Use one-shot headless JSON, reject active steering, and resume completed work by exact conversation ID. | KISS lifecycle with deterministic completion and useful continuation. | Confirmed discovery D05. | Active steering becomes a concrete requirement. |
| D06 | Effort | Pass profile `thinking` as AGY `--effort` and surface AGY's compatibility error. | Avoids duplicating model-specific effort rules. | Confirmed discovery D06 and D10; local effort probes. | Errors become too opaque or AGY changes the flag contract. |
| D07 | Compatibility | Preserve existing Claude behavior and legacy Pi registry/loadout state. | Avoids broadening the change or breaking current sessions. | Confirmed discovery D07; current source. | Separate Claude parity or registry migration is approved. |
| D08 | Profile migration | Test and document migrated `scout` and `flash-reviewer`, but do not edit dotfiles. | These are the primary consumers and the user owns their later external update. | Confirmed discovery D12 and D14. | The user requests coordinated external edits. |

## Work breakdown

- [x] T01: Establish the fail-closed AGY profile and generated-agent contract
  - Depends on: none
  - Scope: Extend `AgentCli`; enforce AGY-compatible fields and the four-tool logical vocabulary; skip Pi extension resolution for AGY; add pure tool translation and generated custom-agent preparation with collision-resistant names and exact native tools.
  - Expected areas: `pi-extension/subagents/agents.ts`, focused helpers in `pi-extension/subagents/`, `test/test.ts`
  - Acceptance: Valid migrated scout/reviewer fixtures resolve canonically; incompatible fields and tools produce actionable diagnostics; generated Markdown contains the exact body, identity flags, description, and native tools with no broader capabilities.
  - Verification: Focused parser and pure-helper tests, then `env -u PI_SUBAGENT_ALLOWED npm test`.

- [x] T02: Integrate deterministic AGY launch, results, status, and strict resume
  - Depends on: T01
  - Scope: Add tagged AGY launch preparation; executable preflight; artifact-backed custom agent, task, stdout, and stderr handling; headless command construction; strict result parsing; external status; automatic delivery; backward-compatible harness-aware registry/snapshot persistence; running-message rejection; exact completed resume and concurrent reservation.
  - Expected areas: `pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`, `pi-extension/subagents/status.ts`, `pi-extension/subagents/tmux.ts` only if a narrow executable-availability seam is needed, `test/test.ts`
  - Acceptance: One direct AGY process launches with no dangerous permission flag, returns its exact JSON response, persists valid resume state, rejects active steering without pane input, resumes only from strict exact state, and leaves Pi and Claude behavior unchanged.
  - Verification: Focused command, parser, watcher, registry, steering, resume, interruption, and compatibility tests; `env -u PI_SUBAGENT_ALLOWED npm test`; non-model AGY custom-agent discovery probe.

- [x] T03: Publish the AGY contract and migration path
  - Depends on: T01, T02
  - Scope: Document installation/runtime prerequisites, supported fields and tools, prompt-free read boundary, model/effort behavior, generated artifacts, active-message limitation, completed resume, errors, and exact migrated `scout` and `flash-reviewer` examples. Update only source-verified durable wiki pages after implementation behavior passes focused tests.
  - Expected areas: `README.md`, `docs/agent-definitions.md`, relevant `wiki/` pages under wiki protocol
  - Acceptance: Documentation matches source and tests, clearly excludes unrestricted permission bypass and unsupported tools, and does not imply that dotfiles were changed.
  - Verification: Relative-link and fenced-code checks, targeted stale-claim searches, `npm pack --dry-run --json`, and `git diff --check`.

- [x] T04: Complete medium-assurance verification and review
  - Depends on: T01, T02, T03
  - Scope: Run all safe gates; inspect package output; run a controlled non-model tmux surface check when available; conduct one coherent-boundary review of capability, persistence, and lifecycle behavior and one final review against this contract; resolve blocking findings. Keep live Gemini testing approval-gated.
  - Expected areas: No source changes unless verification or review exposes an in-scope defect; later `verification.md` records evidence.
  - Acceptance: Safe checks pass, reviews find no unresolved contract violation, package contents remain constrained, and any skipped model-consuming evidence is explicit.
  - Verification: Commands in the Verification plan plus work-item validation.

## Acceptance criteria

- `subagents_list` and spawn accept a valid `cli: agy` profile and reject every confirmed incompatible field with a file-and-field diagnostic.
- A migrated scout profile with medium thinking and a migrated flash-reviewer profile with high thinking both produce a direct AGY primary-agent launch using exactly the four native read tools.
- Missing or empty AGY `builtin-tools` grants no native tools. Mutation, shell, permission-request, web, MCP, browser, image, scheduler, and nested-agent tools are absent.
- Generated AGY customization state is isolated under a dedicated parent-session artifact root, collision-resistant across concurrent launches, and does not modify the target repository or user AGY configuration.
- The launch command contains `agy`, `--output-format json`, `--add-dir`, `--agent`, the effective model, and mapped effort as applicable; it does not contain `--dangerously-skip-permissions`.
- Under the confirmed current settings, an approved live read-only run, if separately authorized, can read, grep, find, and list within the active workspace without permission prompts or soft-denial notices.
- Success delivers the exact AGY response and captures its conversation ID and usage. Every documented terminal or parsing failure returns actionable evidence without fallback or false success.
- Running AGY messages are rejected before transport. Completed AGY names resume only through valid exact persisted state, and a successful continuation updates the stored conversation ID.
- Existing strict and legacy Pi resume tests, Claude launch and non-resume tests, runtime-name collision behavior, and tmux transport tests continue to pass.
- README, agent-definition reference, package contents, and verified wiki pages agree with the implemented contract. No external dotfiles are changed.

## Testing decisions and seams

- Keep profile compatibility and tool translation in pure functions exercised directly in `test/test.ts`.
- Keep generated-agent serialization deterministic so exact fields and absence of tools can be asserted without invoking a model.
- Separate AGY command construction and result parsing from tmux side effects through existing `__test__` seams or narrower exported helpers.
- Test registry evolution against existing valid entries, malformed mixed entries, special runtime names, atomic updates, missing state, and concurrent resume claims.
- Inject tmux send and poll functions in focused tests to prove running-message rejection and watcher behavior without a live model.
- Use `agy -p /agents` only as a non-model discovery check for a temporary generated customization root.
- Do not claim real prompt-free tool execution or exact resume until a model-consuming test is explicitly approved and run. Unit and non-model evidence must still prove the generated allowlist and absence of bypass flags.

## Verification plan

1. Run the full unit and source-regression suite without an inherited nested-agent filter:
   - `env -u PI_SUBAGENT_ALLOWED npm test`
2. Run the implementation's focused AGY tests directly when a stable name pattern or dedicated file exists, then repeat the full suite.
3. Perform a temporary, non-model AGY discovery probe using the generated custom-agent shape:
   - create an ephemeral customization root outside the repository;
   - run `agy --add-dir <ephemeral-root> -p /agents --output-format text` from the target cwd;
   - confirm the generated primary-agent name is listed;
   - remove the ephemeral root.
4. Inspect the distributable:
   - `npm pack --dry-run --json`
   - confirm runtime and documentation files remain included and `spec/`, `wiki/`, tests, and repository instructions remain excluded.
5. Run the non-model tmux surface suite in a controlled tmux session when available:
   - `node --test test/integration/tmux-surface.test.ts`
   - record an environmental skip rather than a failure when controlled tmux is unavailable.
6. Check documentation links, fenced-code balance, and targeted stale claims for `cli: pi|claude`, Claude-only external-harness wording, unrestricted AGY permissions, and unsupported fields.
7. Run patch and spec integrity checks:
   - `git diff --check`
   - `uv run spec/scripts/manage-spec-item.py --root . validate --item "260925-1525-add-antigravity-harness-support"`
8. After T01 and T02, perform an independent coherent-boundary review focused on capability isolation, registry backward compatibility, exact result semantics, and resume failure paths. Resolve blocking findings and rerun affected checks.
9. After all safe checks, perform an independent final review against Requirements, Out of scope, Decision Log, acceptance criteria, repository instructions, and the complete diff.
10. Only with separate explicit approval, run the model-consuming lifecycle suite including AGY launch, prompt-free workspace reads, completion delivery, and exact resume:
    - `node --test --test-concurrency=1 test/integration/subagent-lifecycle.test.ts`
    - record model, AGY version, permission behavior, response delivery, conversation ID, and resume result.

## Risks and blockers

- **Registry compatibility:** Changing the exact name-entry schema could invalidate existing Pi handles. Mitigate with a strict tagged union that preserves the existing shape and regression fixtures for current, legacy, malformed, and mixed records.
- **Capability drift:** AGY tool names or custom-agent discovery may change. Mitigate with exact serialization tests, the non-model `/agents` probe, actionable version-sensitive errors, and no fallback to broader tools.
- **Permission override drift:** Future user `ask` or `deny` rules may supersede default workspace reads. The implementation must not bypass those rules; document the boundary and revisit policy only through a separate approved design.
- **Output and resume drift:** Malformed or changed JSON could lose response or conversation identity. Parse fail-closed, preserve bounded stderr, and refuse resume without exact validated state.
- **Partial persistence:** Completion may succeed while registry or sidecar persistence fails. Deliver the valid result but explicitly report that resume is unavailable; never reread the source profile as fallback.
- **Model-consuming evidence:** Full prompt-free tool and resume proof costs external quota. It remains a verification limitation until separately approved.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete.
- [x] Safe verification complete; the separately approval-gated live Gemini lifecycle remains unrun and explicitly unverified.

## Execution handoff

Use PI Agent in a fresh session with this prompt:

```text
Read this plan and its item.yaml completely.
Implement the work step by step while preserving Requirements, Out of scope, Decision Log, and Verification plan.
Update Progress and the Decision Log when confirmed implementation discoveries change the approach.
Run the specified verification before reporting completion.
Stop and ask before dependencies, migrations, destructive operations, external writes, commits, pushes, model-consuming tests, or scope expansion.
```

## Proposed durable knowledge updates

After implementation and verification establish current behavior:

- Update `wiki/map.md` for AGY-specific profile, runtime, persistence, and result seams.
- Update `wiki/architecture.md` for direct headless AGY launch, artifact ownership, result delivery, and exact resume.
- Update `wiki/conventions/agent-profiles.md` for `cli: agy`, supported fields, read-only tool translation, and migration constraints.
- Update `wiki/conventions/runtime-safety.md` for native AGY tool isolation, prompt-free workspace-read assumptions, no unrestricted bypass, and strict resume replay.
- Update `wiki/development.md` for non-model AGY discovery checks and the approval-gated model lifecycle tier.
- Follow `wiki/AGENTS.md` for index, log, and state maintenance only as required by actual durable wiki changes.

## Notes

- Execution mode is direct. Do not create `implementation/` projections for this item.
- Expected remaining implementation sessions: one coherent implementation session, plus any separately approved model-consuming verification session if the user chooses to run it.
- No implementation is authorized by this plan artifact itself.
