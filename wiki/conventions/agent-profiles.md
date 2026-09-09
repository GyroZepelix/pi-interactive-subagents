# Agent Profile Conventions

## Location and precedence

Profiles are Markdown files with YAML-like frontmatter and a prompt body. Discovery loads bundled `agents/`, then global `$PI_CODING_AGENT_DIR/agents`, then project `.pi/agents`; later entries override the same name. Direct lookup applies project, global, bundled precedence (`pi-extension/subagents/index.ts`).

## Durable fields

Supported fields include `name`, `description`, `model`, `thinking`, `tools`, `skills` or `skill`, `subagent_agents`, `system-prompt`, `session-mode`, `auto-exit`, `interactive`, `cwd`, `cli`, and `disable-model-invocation` (`README.md`, `pi-extension/subagents/index.ts`).

- Use `system-prompt: append` or `replace` when the body is identity text that belongs in the system prompt.
- Use comma-separated `tools` as a strict requested allowlist. Child control tool `ask_question` is added automatically to restricted Pi profiles.
- Presence of a non-empty `subagent_agents` list grants the spawning toolset and limits nested targets to those names.
- `disable-model-invocation: true` hides a profile from listings while preserving explicit direct loading.
- `session-mode` is `standalone` by default; `lineage-only` or `fork` must be profile-defined. These modes are not public `subagent` tool arguments (`pi-extension/subagents/index.ts`, `test/test.ts`).

## Bundled roles

- `scout` is read-only codebase reconnaissance (`agents/scout.md`).
- `researcher` has web tools plus `safe_bash` for research support (`agents/researcher.md`).
- `worker` has editing, Bash, and web tools and may spawn only `scout` and `researcher` (`agents/worker.md`).

When changing a profile field or precedence rule, update README reference material and discovery/allowlist tests in `test/test.ts`.
