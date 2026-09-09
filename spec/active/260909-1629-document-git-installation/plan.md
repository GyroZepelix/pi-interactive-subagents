# Plan: Document Git installation

Work item: `260909-1629-document-git-installation`
Status: Planned
Created: 2026-09-09
Updated: 2026-09-09

## Goal

Give end users one copyable Pi command that installs this fork from its canonical GitHub repository over SSH.

## Context

The README documents requirements, tmux startup, profile setup, and development dependency installation, but it does not explain how an end user installs the Pi package. Pi 0.85.1 accepts protocol Git URLs through `pi install`.

## Requirements

- Add a clearly labeled end-user installation section near the README requirements.
- Document `pi install git:git@github.com:GyroZepelix/pi-interactive-subagents.git` as the canonical command.
- Keep development-only `npm ci` guidance separate.
- Retain the existing Pi 0.85.1 and tmux requirements and agent setup flow.

## Out of scope

- Publishing or documenting an npm package installation.
- Changing package repository metadata, dependencies, runtime behavior, or Git remotes.
- Committing or pushing the follow-up automatically.

## Assumptions

- Intended users have GitHub SSH access and configured keys. Revisit if the canonical repository or preferred transport changes.

## Design

Insert a short `Installation` section after `Requirements`, with a source-review warning and one fenced GitHub SSH command, before tmux startup and agent profile setup.

## Decision Log

| ID | Scope | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- | --- |
| D01 | Install source | Use the GitHub SSH repository source | The canonical remote is GitHub and intended users have SSH access | User confirmation; configured Git remote; Pi package documentation | Canonical distribution or transport changes |

## Work breakdown

- [x] T01: Add and verify end-user Git installation guidance
  - Depends on: none
  - Scope: Add the Pi Git install command to README without changing runtime or package metadata.
  - Expected areas: `README.md`
  - Acceptance: README contains a clearly labeled, copyable command for installing this fork and keeps development setup distinct.
  - Verification: Search the rendered Markdown source, check relative links and fenced blocks, run `git diff --check`, and validate this work item.

## Acceptance criteria

- `README.md` contains `pi install git:git@github.com:GyroZepelix/pi-interactive-subagents.git` in an end-user installation section.
- The command appears before agent setup and is not presented as a development dependency command.
- Markdown structure and repository patch integrity pass.

## Testing decisions and seams

This is documentation-only. Runtime tests are unnecessary because no executable behavior changes.

## Verification plan

- `rg -n "^## Installation$|pi install git:git@github.com:GyroZepelix/pi-interactive-subagents\\.git" README.md`
- Check changed Markdown links and fenced-code balance.
- `git diff --check -- README.md spec/active/260909-1629-document-git-installation spec/index.md`
- `uv run spec/scripts/manage-spec-item.py --root . validate --item "260909-1629-document-git-installation"`

## Risks and blockers

- SSH installation requires a configured GitHub key with repository access. The README states the user-confirmed canonical source without claiming anonymous availability.

## Progress

- [x] Planning complete and confirmed.
- [x] Implementation complete.
- [x] Verification complete.

## Execution handoff

Implement the single README section, run the documentation checks, record verification, and leave the changes uncommitted.

## Proposed durable knowledge updates

None. The README is the user-facing installation authority; no durable wiki update is needed for this narrow documentation addition.

## Notes

- Pi package syntax was verified against the installed Pi 0.85.1 `docs/packages.md` documentation.
