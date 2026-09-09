# Verification: Document Git installation

Work item: `260909-1629-document-git-installation`
Date: 2026-09-09

## Result

PASS. The README now contains a dedicated end-user installation section with the user-confirmed GitHub SSH command, separate from development dependency installation.

## Changed paths

- `README.md`
- `spec/index.md`
- `spec/active/260909-1629-document-git-installation/item.yaml`
- `spec/active/260909-1629-document-git-installation/plan.md`
- `spec/active/260909-1629-document-git-installation/verification.md`

## Checks

- `rg -n '^## Installation$|pi install git:git@github.com:GyroZepelix/pi-interactive-subagents\.git' README.md`: PASS.
- Markdown fenced-code and relative-link check for README and plan: PASS.
- `git diff --check -- README.md spec/active/260909-1629-document-git-installation spec/index.md`: PASS.
- `uv run spec/scripts/manage-spec-item.py --root . validate --item "260909-1629-document-git-installation"`: PASS before final evidence update.

## Acceptance

- End-user Git installation command is present and copyable: PASS.
- Installation appears before agent setup and remains distinct from `npm ci`: PASS.
- No runtime, dependency, package metadata, or remote changes were made: PASS.

## Unverified areas

- SSH installation was not network-tested. The GitHub SSH source and required access were confirmed by the user.
