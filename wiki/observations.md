# Observations

Tentative repository-local findings retained for later comparison. This page is used by Dream and memory maintenance, not normal task context.

## Review evidence

- **Read-only reviewers may still alter the Git index while trying to include untracked files** - May matter when review coverage includes untracked work because future review prompts should prohibit intent-to-add and the orchestrator should compare staged state before and after review. Provenance: [profile-hardening verification](../spec/active/260909-1230-harden-agent-profiles-and-adapt-the-fork/verification.md).

## Markdown checks

- **Literal link placeholders inside agent prompt examples can look like broken repository links** - May matter when ad hoc Markdown checks scan profile bodies because placeholder targets such as `url` should be distinguished from actual relative documentation links. Provenance: [profile-hardening verification](../spec/active/260909-1230-harden-agent-profiles-and-adapt-the-fork/verification.md).
