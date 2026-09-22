# Runtime Safety Conventions

## Tool and extension isolation

New named Pi profile launches use `--no-extensions --no-builtin-tools` and do not use strict `--tools`. Explicit extension order is runtime control first, optional spawning control second, canonical profile extensions in resolved order, and tool-free capability activation last (`pi-extension/subagents/index.ts`).

Validated `builtin-tools` cross the child boundary through a private package-owned environment value. The trailing activation control enables that subset plus tools registered by declared profile extensions; undeclared built-ins remain inactive. Declared extensions are trusted executable grants, not per-tool sandboxes (`pi-extension/subagents/subagent-capability-activation.ts`).

For model-provider extensions in restricted profiles, `builtin-tools` constrains only Pi's built-in surface. Audit both tools registered with Pi and the provider's internal subprocess or protocol path; hiding registered tools does not prevent a provider from executing native file or shell operations itself. A read-only provider must reject its native mutating operations and bridge only the profile's active Pi tools (`spec/archive/260909-1928-create-global-scout-researcher-and-worker-profiles/verification.md`).

Match provider verification to the real child environment. A non-TTY SDK session can miss TTY-gated registrations that appear in tmux panes, so inspect the applicable TTY branch or run a TTY-equivalent check before claiming a provider adds no tools (`spec/archive/260909-1928-create-global-scout-researcher-and-worker-profiles/verification.md`).

Pi 0.87.0 dispatches lifecycle handlers in extension load order. Keep protected tool registration controls first so ordinary profile collisions cannot replace framework tools, and keep the tool-free activation control last so it observes same-event profile registrations before the next model request. Do not merge these roles without re-verifying Pi's lifecycle semantics (`package.json`, `spec/archive/260909-1952-profile-extension-loading/plan.md`, Decision D16).

Resolved profile extension files are preflighted before pane creation. This package's spawning extension is reserved: it is rejected from the profile slot without non-empty `subagent_agents`, then filtered and loaded once in the protected spawning slot when granted (`pi-extension/subagents/index.ts`).

Every spawn must name a valid discoverable agent selected from the active trusted context. Child commands always override `PI_SUBAGENT_ALLOWED` with the profile's exact nested targets; a present empty value means deny all, while an undefined value is reserved for an unrestricted top-level process (`pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`).

## Name safety

Omitted runtime names are auto-suffixed across running, in-flight, and registered sessions. Explicit names are trimmed and rejected on collisions before launch, so registry entries and name-only routing cannot become ambiguous. Registry reads validate names and entries, and writes use own data properties so special names such as `__proto__` remain persistent handles instead of mutating object prototypes (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`).

## Resume safety

New Pi profile launches persist a strict version 1 `extension-grants` snapshot containing selected built-ins, ordered canonical profile extension paths, explicit spawning state and targets, and the existing model, identity, cwd, and agent-directory state. New launch and resume use the same snapshot-driven command builder and capability-environment encoding, including explicit empty nested-agent deny-all (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`).

Snapshot parsing is a strict union. Reject unknown, mixed, incomplete, malformed, duplicate, relative, non-canonical, or nesting-inconsistent new snapshots. Existing valid legacy snapshots remain a separate strict `toolAllowlist` shape, replay through `--no-extensions --tools` with their stored extension paths, and are read without automatic rewriting (`pi-extension/subagents/session.ts`).

Resume never re-reads profiles or package settings. It intentionally executes current contents at valid stored paths, but preflights profile and required framework files before pane creation and refuses missing, non-file, non-canonical, duplicate-canonical, or reserved-framework paths. A finished Pi session must not resume without a valid snapshot, and canonical session paths are reserved while a resume is launching so concurrent calls cannot open the same JSONL twice. Finished Claude children are not resumable (`pi-extension/subagents/index.ts`).

## Shell and live-input boundaries

- Build shell commands through `shellEscape`, and use `sendLongCommand` for generated launch scripts (`pi-extension/subagents/tmux.ts`, `pi-extension/subagents/index.ts`).
- Live Pi and Claude messages are not shell commands. Normalize them in the caller, load them into a UUID-qualified tmux buffer through stdin, paste with application-negotiated bracketed framing and deletion, then send Enter separately. Never regress live text to a shell argument or a large `send-keys -l` burst (`pi-extension/subagents/tmux.ts`, `pi-extension/subagents/index.ts`).
- tmux command success proves submission, not child consumption. Confirm waiting Pi delivery only from newer same-child activity; otherwise report submitted or unconfirmed. Never automatically replay or kill after an ambiguous timeout (`pi-extension/subagents/index.ts`, `pi-extension/subagents/activity.ts`).
- Treat child `agent_end` as a recoverable low-level run boundary, never as final completion. Cache its latest messages and keep activity writable so automatic retry, compaction recovery, or queued continuation can replace a transient error. Only `agent_settled` may finalize auto-exit, after rechecking pending questions, running nested children, Pi-owned pending messages, and abort state (`pi-extension/subagents/subagent-runtime-control.ts`, `pi-extension/subagents/activity.ts`).
- A transient capture failure does not establish pane loss. Confirm absence before releasing the running entry; preserve Pi resume registration and keep termination or replay operator-controlled (`pi-extension/subagents/tmux.ts`, `pi-extension/subagents/index.ts`).
- Generated task, system-prompt, and resume-message artifacts include a per-launch UUID after the sanitized runtime-name slug so concurrent distinct names cannot overwrite one another's content (`pi-extension/subagents/index.ts`).
- A `cli: claude` profile invokes `claude --dangerously-skip-permissions`. Only explicitly trusted profiles should enable this path (`pi-extension/subagents/index.ts`).

## Runtime files

Name registries use temp-file rename for atomic updates. Activity snapshots also use temp-file rename and strict schema validation. Errors in best-effort metadata writes must not turn into an unrestricted resume (`pi-extension/subagents/session.ts`, `pi-extension/subagents/activity.ts`).
