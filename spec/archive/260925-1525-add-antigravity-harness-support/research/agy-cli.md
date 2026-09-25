# Antigravity CLI integration research

Date: 2026-09-25

## Question

Can the installed Antigravity CLI support a Pi-managed subagent profile with Gemini 3.8 Flash, deterministic result delivery, resumability, and a constrained read-only tool set without modifying the user's global Antigravity configuration?

## Verified local environment

- `agy` resolves to `/opt/homebrew/bin/agy`.
- Installed version: `1.2.11`.
- `agy models` exposes `gemini-3.8-flash-high`, `gemini-3.8-flash-medium`, and `gemini-3.8-flash-low`.
- `agy --help` exposes headless print mode, `text`, `json`, and `stream-json` output, exact `--conversation` resume, `--add-dir`, `--agent`, `--model`, `--effort`, and `--sandbox`.
- A no-model local probe created a temporary custom agent under an added directory and verified that both `agy --add-dir <dir> -p /agents` and a primary-workspace `/agents` invocation discover it. The temporary directory was removed after the probe.
- Additional no-model `/agents` probes verified that `--model gemini-3.8-flash` accepts `low`, `medium`, and `high`; rejects `max` because that model exposes only those three efforts; an effort-encoded model slug conflicts with a different explicit `--effort`; and `xhigh` is not an AGY effort value.
- The current `~/.gemini/antigravity-cli/settings.json` exists but has no `permissions` override, so documented default workspace-read behavior applies in the target environment.

## Relevant external contract

- Headless `--output-format json` returns a terminal envelope containing `conversation_id`, `status`, `response`, errors, timing, and usage. `--conversation <id>` resumes an exact conversation.
- Stream JSON exposes initialization, tool-step, response, and terminal result events. Stream-input mode can accept multiple prompts in one process, but the process stays open until stdin closes.
- Custom agents are Markdown files with a system-prompt body and an explicit native `tools` allowlist. They are discovered from workspace or global customization roots.
- Native names matching the requested Pi read-only set are:
  - `read` -> `view_file`
  - `grep` -> `grep_search`
  - `find` -> `find_by_name`
  - `ls` -> `list_dir`
- A custom agent selectable with `--agent` must be a main agent. Setting `mainAgent: true` and `subagent: false` avoids granting Antigravity's own nested-subagent role.
- The profile tool allowlist controls which native tools exist. Fine-grained permissions are a separate layer. Headless approval requests are soft-denied unless pre-approved, while workspace reads and writes may otherwise be auto-allowed. Therefore native tool omission, not only permission prompts, is needed for a reliable read-only profile.
- `--dangerously-skip-permissions` approves every tool and is unsuitable for constrained profiles.
- There is no documented per-run settings-file flag. Generating the custom agent under this extension's session artifacts and exposing that directory with `--add-dir` avoids writes to the target repository and global Antigravity configuration.

## Repository implications

- Current profile parsing supports only `cli: pi|claude`; `builtin-tools` and `extensions` are rejected for Claude profiles.
- Current external-harness behavior is hard-coded to Claude in launch, status, live-message acknowledgment, result extraction, and resume messaging.
- The Claude path launches an interactive TUI with `--dangerously-skip-permissions`, relies on a bundled Stop hook, screen capture, and a sentinel file. That implementation should not be copied for `agy`.
- A headless JSON `agy` path offers cleaner completion and exact conversation IDs, but active steering semantics differ from the current interactive Pi and Claude paths.
- Local probes show extension-side effort prevalidation is possible, but the confirmed KISS contract instead passes profile `thinking` as `--effort` and surfaces AGY's own unsupported-value or model-conflict error after launch.
- A generated AGY custom-agent name must be collision-resistant, and its tool mapping and Markdown must be written before pane creation so launch remains preflightable.

## Sources

- [Headless mode](https://antigravity.google/docs/cli/headless/)
- [Custom subagents](https://antigravity.google/docs/subagents?tab=cli)
- [Agent permissions](https://www.agy.dev/docs/permissions/)
- [Hooks](https://www.antigravity.google/docs/hooks?tab=ide)
- [Agents command](https://www.antigravity.google/docs/cli/commands/agents)
- [Antigravity CLI releases](https://github.com/google-antigravity/antigravity-cli/releases)
