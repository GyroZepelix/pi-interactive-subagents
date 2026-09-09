# Runtime Safety Conventions

## Tool and extension isolation

Restricted Pi profiles launch with `--no-extensions`, an explicit `--tools` allowlist, and only extension files known to back those tools. Built-in tools do not require extension paths. Spawning tools are granted only when `subagent_agents` is present and non-empty (`pi-extension/subagents/index.ts`).

Every spawn must name a discoverable agent. A restricted child also receives `PI_SUBAGENT_ALLOWED`, so nested calls cannot select agents outside the parent's profile contract (`pi-extension/subagents/index.ts`).

## Resume safety

Persist the fully resolved loadout next to each child session. A finished session must not resume without this snapshot, and a session that is still running must be steered instead of opened by a second process (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`). This prevents silent privilege expansion and concurrent JSONL mutation.

## Shell boundaries

- Build shell commands through `shellEscape`, and use `sendLongCommand` for generated launch scripts (`pi-extension/subagents/tmux.ts`, `pi-extension/subagents/index.ts`).
- `safe_bash` blocks a fixed dangerous-pattern list before calling Pi's Bash tool (`pi-extension/subagents/tools/safe-bash.ts`). Inferred: it reduces common hazards but is not a general containment boundary.
- A `cli: claude` profile invokes `claude --dangerously-skip-permissions`. Only explicitly trusted profiles should enable this path (`pi-extension/subagents/index.ts`).

## Runtime files

Name registries use temp-file rename for atomic updates. Activity snapshots also use temp-file rename and strict schema validation. Errors in best-effort metadata writes must not turn into an unrestricted resume (`pi-extension/subagents/session.ts`, `pi-extension/subagents/activity.ts`).
