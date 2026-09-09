# Runtime Safety Conventions

## Tool and extension isolation

Every named Pi profile launches with `--no-extensions`, an explicit `--tools` allowlist, and only extension files known to back those tools. Missing or empty `tools` grants no ordinary tools; `ask_question` is still added. Built-in tools do not require extension paths. Spawning tools are granted only when `subagent_agents` is present and non-empty (`pi-extension/subagents/index.ts`).

A requested non-built-in tool must resolve to an existing backing extension before pane creation. Failure names the agent, tool, source profile, and corrective action rather than silently dropping the restriction (`pi-extension/subagents/index.ts`).

Every spawn must name a valid discoverable agent selected from the active trusted context. A restricted child also receives `PI_SUBAGENT_ALLOWED`, so nested calls cannot select agents outside the parent's profile contract (`pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`).

## Name safety

Omitted runtime names are auto-suffixed across running, in-flight, and registered sessions. Explicit names are trimmed and rejected on collisions before launch, so registry entries and name-only routing cannot become ambiguous. Registry reads validate names and entries, and writes use own data properties so special names such as `__proto__` remain persistent handles instead of mutating object prototypes (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`).

## Resume safety

For Pi children, build and structurally validate the fully resolved loadout before pane creation, then persist it with exact backing extension paths next to the child session. Preflight every stored extension path before resume. A finished Pi session must not resume without this valid snapshot, and canonical session paths are reserved while a resume is launching so concurrent calls cannot open the same JSONL twice (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`). Finished Claude children are not resumable. These constraints prevent silent privilege expansion and concurrent JSONL mutation.

## Shell boundaries

- Build shell commands through `shellEscape`, and use `sendLongCommand` for generated launch scripts (`pi-extension/subagents/tmux.ts`, `pi-extension/subagents/index.ts`).
- Generated task, system-prompt, and resume-message artifacts include a per-launch UUID after the sanitized runtime-name slug so concurrent distinct names cannot overwrite one another's content (`pi-extension/subagents/index.ts`).
- `safe_bash` blocks a fixed dangerous-pattern list before calling Pi's Bash tool (`pi-extension/subagents/tools/safe-bash.ts`). Inferred: it reduces common hazards but is not a general containment boundary.
- A `cli: claude` profile invokes `claude --dangerously-skip-permissions`. Only explicitly trusted profiles should enable this path (`pi-extension/subagents/index.ts`).

## Runtime files

Name registries use temp-file rename for atomic updates. Activity snapshots also use temp-file rename and strict schema validation. Errors in best-effort metadata writes must not turn into an unrestricted resume (`pi-extension/subagents/session.ts`, `pi-extension/subagents/activity.ts`).
