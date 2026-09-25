# Discovery: Add Antigravity harness support

Work item: `260925-1525-add-antigravity-harness-support`
Status: Ready for Spec
Created: 2026-09-25
Updated: 2026-09-25

Assurance: medium - the change crosses profile validation, process launch, lifecycle/result parsing, persistence, and a capability boundary; regressions are recoverable locally but an incorrect tool mapping could grant unintended operations.

## Objective

Repair the profile-selectable external-harness feature and extend it so a configured subagent can run through Antigravity CLI (`agy`), including Gemini 3.8 Flash and profile-controlled native tools.

## Desired outcome

A user can define an Antigravity-backed subagent, select an exact installed `agy` model such as `gemini-3.8-flash-medium`, grant a logical read-only set such as `builtin-tools: [read, grep, find, ls]`, launch it asynchronously in tmux, and receive its real final response through the existing parent delivery flow.

## Repository and domain context

- Intended environment: a local trusted user session running Pi inside tmux, with `agy` already installed and authenticated through the user's existing Antigravity CLI state. The locally verified CLI is macOS arm64 `agy` 1.2.11.
- Expected scale: a small number of concurrent local subagents, each with isolated launch and result artifacts; no distributed orchestration or shared service is involved.
- The extension is tmux-only and currently supervises Pi plus a special Claude Code path.
- Profiles are validated once in `pi-extension/subagents/agents.ts`; launch and lifecycle orchestration are concentrated in `pi-extension/subagents/index.ts`.
- Pi profiles use package-owned activation controls and strict loadout snapshots. Claude profiles bypass those controls and are currently non-resumable.
- `cli: claude` is implemented through several Claude-specific branches rather than a harness abstraction.

## Scope

- Extend the existing `cli` profile field with `agy`; do not introduce a second harness-selection field.
- Pass an exact profile or runtime model override to `agy`.
- Translate the approved logical `builtin-tools` subset to exact Antigravity native custom-agent tools.
- Generate and preflight the Antigravity custom-agent definition needed to enforce that native tool allowlist.
- Launch, observe, parse, and deliver Antigravity results through the existing asynchronous tmux flow.
- Reject active messages to AGY explicitly and resume a finished AGY conversation by exact persisted conversation ID using the same stored profile contract.
- Add focused parser, launch-command, lifecycle, result, persistence, and failure tests plus user documentation.

## Out of scope

- Running model-consuming lifecycle tests without separate approval for external calls, time, and cost.
- Changing Antigravity's global settings, permissions, installed plugins, authentication, or model inventory.
- Exposing Antigravity MCP, browser, image, scheduler, nested-agent, arbitrary custom tools, or mutation and shell tools.
- Modifying `/Users/dgjalic/.dotfiles/02-agentic-llms`; the user will migrate the live profiles separately after this package change.
- Replacing tmux or redesigning unrelated Pi sandbox and resume behavior.
- Repairing unrelated Claude lifecycle or permission limitations unless a narrow shared abstraction is required for `agy`.

## Confirmed facts and evidence

- Fact: `AgentCli` is currently `"pi" | "claude"`; `cli: claude` rejects `builtin-tools` and `extensions` (`pi-extension/subagents/agents.ts`).
- Fact: launch, status, steering acknowledgment, result extraction, and resume messaging use explicit `running.cli === "claude"` branches (`pi-extension/subagents/index.ts`, `pi-extension/subagents/status.ts`).
- Fact: the Claude path launches with `--dangerously-skip-permissions`, a bundled Stop hook, a sentinel file, and screen fallback. Finished Claude children are not resumable (`pi-extension/subagents/index.ts`, `docs/agent-definitions.md`).
- Fact: local `agy` version 1.2.11 exposes Gemini 3.8 Flash high, medium, and low model slugs.
- Fact: `agy` headless JSON returns a response, terminal status, exact conversation ID, and usage; exact conversations can resume with `--conversation`.
- Fact: Antigravity custom-agent Markdown provides a system-prompt body and an explicit native tool allowlist.
- Fact: requested read-only mappings are `read -> view_file`, `grep -> grep_search`, `find -> find_by_name`, and `ls -> list_dir`.
- Fact: a local no-model probe verified that a custom agent under a temporary added workspace is discovered through `agy --add-dir <artifact-root> -p /agents`. This provides a per-launch path without repository or global Antigravity configuration writes.
- Fact: Antigravity permissions and custom-agent tool availability are separate. The custom-agent allowlist is required because workspace writes may otherwise be auto-allowed.
- Fact: `/Users/dgjalic/.dotfiles/02-agentic-llms/.pi/agent/agents/scout.md` exists and is the live global `scout` profile through the `~/.pi/agent/agents` symlink. It currently uses the requested four read-only built-ins but also declares a Cursor provider extension, `session-mode`, `system-prompt`, and `auto-exit`, which the confirmed minimal AGY contract would reject if the profile were changed to `cli: agy` without migration.
- Fact: the supplied `flash-researcher.md` path does not exist. The same directory contains `flash-reviewer.md`, which has the same four read-only built-ins and the same incompatible Pi-only fields, plus `researcher.md`, which instead relies on web and Codex-search extensions.
- Fact: AGY headless mode cannot show an interactive permission prompt. Required read-only file operations inside the active workspace and the dedicated added artifact workspace are auto-allowed by AGY's documented permission defaults; protected or out-of-workspace actions would otherwise be soft-denied unless explicitly granted.
- Fact: the current `~/.gemini/antigravity-cli/settings.json` has no `permissions` section, so no user rule overrides default workspace-read behavior in the intended environment.
- Fact: local no-model probes show `gemini-3.8-flash` accepts low, medium, and high effort. AGY rejects max for that model, demonstrating the selected post-launch model-effort validation behavior.

## Constraints and invariants

- Existing Pi profile behavior, loadout replay, nested-agent allowlists, and default-deny tool activation must remain unchanged.
- An `agy` profile must not use `--dangerously-skip-permissions` when claiming a constrained tool surface.
- Tool names must be translated to documented exact native names; unknown or unsupported combinations must fail before pane creation.
- Generated Antigravity customization files should stay under the parent session's artifact ownership and use collision-resistant names.
- The target project and global Antigravity customization directories should not be modified by default.
- Shell command assembly and task/model/profile values must retain the existing escaping and artifact-backed safety boundary.
- Authentication absence, missing `agy`, unknown model, malformed JSON, non-success terminal status, and missing conversation ID where resume is promised must produce actionable failures rather than fallback to Pi or Claude.

## Domain language

- **Harness**: the child CLI/runtime supervised by this extension, currently Pi or Claude Code and proposed to include Antigravity CLI.
- **Logical built-in**: a portable profile capability name such as `read` or `grep`.
- **Native AGY tool**: an exact Antigravity custom-agent tool name such as `view_file` or `grep_search`.
- **Custom-agent artifact**: generated Markdown that supplies the AGY system prompt and native tool allowlist for one launch contract.

## Decision tree

1. Choose the public profile field and backward-compatibility contract.
2. Choose the first supported logical tool set.
3. Choose AGY execution and messaging/resume semantics.
4. Confirm generated custom-agent artifact discovery versus user-managed AGY definitions.
5. Settle model and effort interaction.
6. Derive acceptance and failure evidence inside the confirmed assurance envelope.

## Confirmed decisions

| ID | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- |
| D01 | Title the item `Add Antigravity harness support`. | User selected the Antigravity-centered framing while retaining repair of the external-harness path. | User answer, 2026-09-25 | The requested scope stops being Antigravity-centered. |
| D02 | Antigravity must support Gemini 3.8 Flash and a profile example granting only read, grep, find, and ls. | This is the requested outcome. | User request; local `agy models` output | AGY removes these model or tool contracts. |
| D03 | Extend the canonical `cli` field with `agy`; do not add or rename it to `harness`. | This is the smallest compatible profile-schema change. | User decision, 2026-09-25 | A broader profile schema migration is separately requested. |
| D04 | Initially support only `read`, `grep`, `find`, and `ls` in `builtin-tools` for `cli: agy`; reject the other logical built-ins. | Meets the read-only goal without prematurely designing AGY mutation or shell permissions. | User decision, 2026-09-25 | Write, edit, or command execution becomes a concrete requirement. |
| D05 | Launch AGY in deterministic one-shot headless mode, explicitly reject messages to a running AGY child, and resume a finished child by exact conversation ID. | Keeps the lifecycle simple while retaining useful same-name continuation. | User decision with KISS direction, 2026-09-25 | Active AGY steering becomes a concrete requirement. |
| D06 | Map profile `thinking` to AGY `--effort`. AGY, rather than extension-side model-name logic, validates unsupported effort values and model-effort conflicts after launch. | The user prefers a common profile-level effort control and KISS validation behavior. | User decisions, 2026-09-25; local no-model effort probes | AGY removes or materially changes `--effort`, or post-launch errors prove too opaque. |
| D07 | Preserve existing Claude behavior and compatibility while sharing only the routing needed for the extended `cli` schema. | Avoids expanding this item into Claude tool and resume redesign. | User decision, 2026-09-25 | A separate Claude parity change is requested. |
| D08 | Keep medium assurance. | The capability boundary and cross-component lifecycle warrant focused failure and persistence evidence, but remain locally recoverable. | User decision, 2026-09-25 | Risk evidence or explicit quality posture changes. |
| D09 | Generate a unique AGY custom-agent Markdown file in a dedicated session-artifact workspace and expose it with `--add-dir`; do not write project or global AGY configuration. This configures the one directly launched primary AGY process and does not invoke an AGY subagent. | Keeps the Pi profile authoritative while avoiding user-configuration mutation or nested delegation. | User confirmation after direct-execution clarification, 2026-09-25; local no-model discovery probe | AGY stops discovering custom agents from added workspace roots. |
| D10 | Pass mapped `thinking` through as AGY `--effort` and let AGY report unsupported values or model-effort conflicts after launch. | Minimizes extension-side model naming logic. | User decision, 2026-09-25 | Post-launch validation proves too opaque or costly. |
| D11 | Reject fields with no defined AGY equivalent instead of ignoring them. `cli: agy` accepts generic identity, model, thinking, cwd, body, visibility, and the four read-only logical built-ins. | Fail-closed diagnostics prevent misleading capability and lifecycle declarations. | User decision, 2026-09-25 | A specific additional field mapping is requested. |
| D12 | Treat the user's live `scout` and `flash-reviewer` profiles as the primary migration compatibility targets; `flash-researcher` was a reference to existing `flash-reviewer`. | These are the most important intended consumers and both already express the requested read-only role. | User clarification and selection, 2026-09-25 | The user identifies a different profile set. |
| D13 | AGY-backed work must not pause for permission questions. Required granted tools must operate autonomously. | Background one-shot subagents cannot depend on interactive approval. | User clarification, 2026-09-25 | The lifecycle changes to an explicitly interactive mode. |
| D14 | Keep implementation inside this package and provide exact migration guidance for `scout` and `flash-reviewer`; do not edit the external dotfiles repository or include those edits in the implementation plan. | The user will migrate dotfiles separately. | User decision, 2026-09-25 | The user explicitly requests a coordinated dotfiles change. |
| D15 | Permission behavior is restricted and prompt-free: only the four native read tools are available, workspace reads proceed under AGY's default policy, and unrestricted permission bypass is forbidden. | Meets autonomous background operation without weakening the read-only boundary. | User decision, 2026-09-25; current settings and AGY permission documentation | Required reads move outside configured workspaces or explicit user permission rules override defaults. |

## Rejected alternatives

- Copying the Claude launch flags is rejected as a proposed direction because `--dangerously-skip-permissions` contradicts the requested tool restriction and Claude's Stop-hook protocol is not AGY's lifecycle contract.
- Relying only on AGY permission prompts is rejected because workspace writes can be auto-allowed and headless approval failures are soft denials rather than capability removal.
- A new `harness` field or breaking rename is rejected for this item; `cli` remains canonical and gains `agy`.
- Mapping mutation and shell tools now is rejected; the initial AGY vocabulary is intentionally limited to the requested read-only four.
- Stream-input active steering is rejected in favor of one-shot completion and exact finished resume.
- User-managed or project-temporary AGY definitions are rejected because they either permit profile drift or mutate the target repository.
- Expanding Claude to tool or resume parity is rejected; only compatibility with shared routing is retained.
- Silently ignoring Pi-only fields on AGY profiles is rejected in favor of fail-closed diagnostics.

## Open questions and prerequisites

No consequential design questions remain open.

## Current frontier

Empty. The user confirmed the revised shared understanding on 2026-09-25.

## Research index

- [Antigravity CLI integration research](./research/agy-cli.md)
- [Research index](./research/index.md)

## Proposed test seams and acceptance evidence

- A profile with `cli: agy`, `model: gemini-3.8-flash`, `thinking: medium`, and `builtin-tools: [read, grep, find, ls]` is valid and produces `--model gemini-3.8-flash --effort medium`.
- `cli: agy` maps only `read -> view_file`, `grep -> grep_search`, `find -> find_by_name`, and `ls -> list_dir`; omitted or empty `builtin-tools` produces an empty native tool list, while write, edit, bash, powershell, and unknown names fail profile validation.
- Explicit `extensions`, skills, nested agents, prompt mode, session mode, auto-exit, or interactive fields invalidate an AGY profile with field-specific diagnostics, even when an incompatible capability field is explicitly empty.
- Generated custom-agent artifact tests prove exact frontmatter, body-as-system-prompt routing, unique naming, dedicated artifact location, `mainAgent: true`, `subagent: false`, and absence of mutation, shell, MCP, browser, image, scheduler, and nested-agent tools.
- Launch-command tests prove direct invocation of exactly one `agy` process from the requested cwd, discovery through `--add-dir <dedicated-artifact-root>`, selected generated agent, safe task transport, JSON output, captured stderr/result artifacts, and absence of `--dangerously-skip-permissions`.
- Compatibility fixtures and migration examples derived from `scout.md` and `flash-reviewer.md` prove their intended migrated forms validate and launch with `model: gemini-3.8-flash`, their existing medium/high thinking levels, body prompts, and read-only native tools after removing their Pi-only provider and lifecycle fields. The external files themselves are not changed.
- Under the current no-override AGY permission settings, required read-only operations inside the active workspace do not request permission or emit headless soft-denial notices; `ask_permission` and capabilities outside the generated native allowlist are unavailable.
- Missing `agy` fails before pane creation. Authentication failure, unknown model, AGY effort conflict, malformed JSON, non-success status, interruption, or absent required conversation ID produces an actionable failure without fallback to another harness.
- A successful terminal JSON envelope delivers its exact `response`, records usage when present, and persists the exact AGY conversation ID plus the immutable resume-relevant profile contract.
- `subagent_message` to a running AGY child returns an explicit unsupported-active-steering error without writing to its pane. The same name after completion launches one-shot `agy --conversation <exact-id>` with the stored cwd, generated agent artifact, model, effort, and read-only tools, then delivers the new response.
- Missing, malformed, mismatched, or unavailable AGY resume state fails closed before pane creation. Existing Pi registries/loadouts and Claude non-resume behavior remain compatible.
- Status and result renderers identify AGY without claiming Pi activity precision. Existing Pi and Claude focused regressions continue to pass.
- A non-model CLI probe verifies generated-agent discovery through `--add-dir`. A real Gemini lifecycle and resume check remains separately approval-gated because it consumes external model time and quota.

## Proposed wiki updates after implementation

If implementation verifies the contract, update architecture, repository map, profile conventions, runtime safety, and development verification tiers for the third harness and its native capability boundary.

## Resume state

The user confirmed the complete shared understanding. The exact next action is `/skill:to-spec 260925-1525-add-antigravity-harness-support` after the readiness transition and final dossier validation.

## Readiness for To Spec

- [x] Every consequential branch is resolved or explicitly out of scope.
- [x] Facts are distinguished from user decisions and hypotheses.
- [x] Requirements, constraints, and non-goals are clear.
- [x] Acceptance evidence and proposed test seams are defined.
- [x] The user confirmed shared understanding.
