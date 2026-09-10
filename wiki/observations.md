# Observations

Tentative repository-local findings retained for later comparison. This page is used by Dream and memory maintenance, not normal task context.

## Review evidence

- **Read-only reviewers may still alter the Git index while trying to include untracked files** - May matter when review coverage includes untracked work because future review prompts should prohibit intent-to-add and the orchestrator should compare staged state before and after review. Provenance: [profile-hardening verification](../spec/archive/260909-1230-harden-agent-profiles-and-adapt-the-fork/verification.md).

## Markdown checks

- **Literal link placeholders inside agent prompt examples can look like broken repository links** - May matter when ad hoc Markdown checks scan profile bodies because placeholder targets such as `url` should be distinguished from actual relative documentation links. Provenance: [profile-hardening verification](../spec/archive/260909-1230-harden-agent-profiles-and-adapt-the-fork/verification.md).

## Runtime display

- **The subagent tool widget can omit tools registered by later profile `session_start` handlers** - May matter when debugging a child's capabilities because activation is correct but runtime control snapshots display names earlier; refresh the widget after activation if exact dynamic display becomes required. Provenance: [02.01 focused review](../spec/active/260909-1952-profile-extension-loading/implementation/02-01-child-capability-launch.md).
