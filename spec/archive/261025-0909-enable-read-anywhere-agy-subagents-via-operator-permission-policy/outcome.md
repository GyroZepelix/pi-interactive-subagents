# Outcome: Enable read-anywhere AGY subagents via operator permission policy

Work item: `261025-0909-enable-read-anywhere-agy-subagents-via-operator-permission-policy`
Disposition: completed
Date: 2026-10-25

## Delivered scope

- `pi-extension/subagents/agy.ts`: pure `evaluateAgyPermissionPolicy`, read-only `checkAgyPermissionPolicy` (only `$HOME/.gemini/antigravity-cli/settings.json`), `agyWorkspaceRoots`, and a denial diagnostic that adds workspace roots and a remedy while keeping bounded action and stderr evidence.
- `pi-extension/subagents/index.ts`: non-blocking `withAgyPolicyWarning` on AGY single, model-chain (when any target is AGY), and resume acknowledgments; watcher passes the run's workspace roots to the denial diagnostic. Command, workspace derivation, generated agent, tool translation, and snapshots unchanged.
- `test/test.ts`: policy evaluation cases, acknowledgment warning cases, root listing, and a watcher denial integration test.
- Docs: `README.md` "AGY permission policy" subsection, `docs/agent-definitions.md`, `wiki/architecture.md`, `wiki/conventions/runtime-safety.md`, `wiki/log.md`.
- Operator settings (approved): `~/.gemini/antigravity-cli/settings.json` gained the exact approved `permissions` block; `trustedWorkspaces` preserved; backup `settings.json.bak-20261025-093213`.

## Deviations from plan

- Live AGY 1.4.7 does not list explicit deny-rule matches (write or read denies) in `denied_actions`; the envelope stays `SUCCESS` and the denial is reported to the model as a tool error. The plan risk that writes would fail runs did not materialize. D02 and D04 unchanged. The README caveat was corrected to the observed behavior and re-reviewed.

## Verification summary

- Focused AGY tests 24/24; full unit suite 287/287 with `PI_SUBAGENT_*` unset (one env-only failure under leaked session variables is pre-existing at `HEAD`); `npm pack` shape identical; docs, `git diff --check`, and spec validation clean.
- Live canary (1 of max 3 calls): outside `/private/tmp` read returned its token; canary-only read deny honored; workspace write denied with sentinel unchanged; no scratch writes; temporary rule removed and settings verified.
- Reviews: contract-quality PASS; targeted README re-review PASS (1 retry used of 2).
- Details: `verification.md`.

## Retained, reverted, or transferred work

- All changes retained. Canary trees and temporary rule removed. The settings backup is retained for rollback.

## Residual risks

- In-repository secrets (for example `.env`) remain readable because AGY path globs are unsupported.
- Secret-path denies were proven only through the same deny mechanism on a non-secret path.
- The policy is global; interactive AGY on this machine cannot write files while `write_file(*)` is denied.
- Explicit deny-rule hits do not fail runs; a reviewer whose required read is hard-denied may still return `SUCCESS` with partial evidence.
- Launch and resume acknowledgment wiring is unit- and inspection-verified, not tmux-launch-verified.

## Follow-up work items

- None required.

## Source references

- `plan.md`, `verification.md` in this item.
- [AGY permissions](https://antigravity.google/docs/permissions?tab=cli) (cited by the plan).

## Wiki updates

- `wiki/architecture.md`: launch/resume preflight warning and roots in denial diagnostics.
- `wiki/conventions/runtime-safety.md`: operator read policy convention and caveats.
- `wiki/log.md`: update entry.
