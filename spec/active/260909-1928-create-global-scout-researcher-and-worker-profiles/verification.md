# Verification: Create global scout, researcher, and worker profiles

Work item: `260909-1928-create-global-scout-researcher-and-worker-profiles`
Date: 2026-09-09

## Environment

- Mode: direct
- Invocation starting `HEAD`: `423c560bba831b17af31df3bd3a8b60a5874e90d`
- Current repository had the planning changes to `spec/index.md` and this untracked work-item directory.
- The dotfiles repository had unrelated pre-existing modifications and untracked directories; no dotfiles or global configuration files were changed in this attempt.

## Commands and checks

| Check | Result | Evidence |
| --- | --- | --- |
| Resolve selected item | Passed | Helper resolved this active planned item explicitly. |
| Confirm Git repository | Passed | Root is `/Users/dgjalic/Documents/1-Projects/10-software-development/pi-interactive-subagents`. |
| Confirm selected Cursor models | Passed | Local model list contains all three exact planned slugs. |
| Confirm research-tool entrypoints | Passed | Both installed extension entrypoint files exist. |
| Inspect global path resolution | Blocked plan assumption | Both `~/.pi/agent/agents` and `~/.pi/agent/extensions` resolve into `/Users/dgjalic/.dotfiles/02-agentic-llms/.pi/agent/`. |

## Requirement coverage

| Requirement | Evidence | Status |
| --- | --- | --- |
| Preserve existing global configuration before writes | Existing targets, symlinks, dotfiles status, and `general.md` checksum were inspected. | In progress |
| Implement three profiles and tool bridge | No external write was performed. | Not started |
| Preserve unrelated files | No implementation target changed. | Passed for this attempt |

## Review findings

Focused review was not started because implementation is blocked before external writes.

## Failures and skipped checks

- Plan text incorrectly states that `~/.pi/agent/extensions/subagent-research-tools.ts` is outside the dotfiles repository. The extensions directory is a symlink into the same dotfiles tree as the agent definitions.
- Per the implementation protocol, this source contradiction requires approval for a plan correction before implementation continues.
- The user then stopped implementation to reconsider the bridge in product and proposed first-class profile-controlled extension loading instead. This changes the runtime and security contract beyond the confirmed global-config plan, so the current item remains blocked and all tasks remain unchecked.
- Profile parsing, bridge loading, fresh-session discovery, and model-consuming smoke checks were not run.

## Unverified areas

- Exact bridge lifecycle behavior in a fresh Pi session.
- Profile parsing and tool preflight.
- Any model-consuming role behavior.
- The design, compatibility, and security implications of a new declarative profile extension field.
