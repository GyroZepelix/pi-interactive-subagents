# Outcome: Create global scout, researcher, worker, flash-reviewer, and twin profiles

Work item: `260909-1928-create-global-scout-researcher-and-worker-profiles`
Disposition: completed
Date: 2026-09-10

## Delivered scope

- Installed five native global profiles: scout, researcher, worker, flash-reviewer, and twin.
- Applied exact least-privilege built-ins, ordered extension grants, standalone session modes, and bounded nested-agent allowlists.
- Migrated Cursor-backed profiles to canonical IDs and Pi thinking levels through `@offbynan/pi-cursor-provider`.
- Granted worker direct `web_search`, `web_fetch`, and `codex_search` access.
- Removed the invalid empty-body global `general.md` after explicit approval.

## Deviations from plan

- The original preserve-general requirement conflicted with zero-diagnostic discovery; the user approved deleting it.
- Twin changed from forked to standalone by user request.
- Worker gained direct research tools by user request.
- The first Cursor CLI provider was rejected after review proved it bypassed read-only boundaries. The user installed the safer direct provider, and profiles were migrated after source and model validation.
- Broad five-profile model smoke was declined. The approved final flash-reviewer gate exercised the safe Gemini provider successfully.

## Verification summary

- Fresh `subagents_list`: five profiles, zero diagnostics, canonical models and thinking, exact extension order, standalone modes, and nested boundaries.
- Model-free read-only activation: only `ask_question`, `read`, `grep`, `find`, and `ls`.
- Model-free worker activation: coding built-ins plus expected research tools, no standalone web.
- Safe provider source: no Pi tool registration; ten Cursor-native operation classes rejected; only active Pi tools bridged through MCP.
- `npm test`: 198 passed, 0 failed.
- Spec validation, model-list warnings, settings assertions, Markdown checks, and diff checks passed.
- Medium-assurance contract-quality review passed on retry 1 after safe-provider correction.

## Retained, reverted, or transferred work

The five final profile files are staged in the user's dotfiles repository through an external action. The settings file and unrelated dotfiles changes remain user-controlled. This run did not stage, commit, reset, discard, or push anything.

## Residual risks

`@offbynan/pi-cursor-provider` is unofficial and depends on Cursor's reverse-engineered private protocol. Future updates require renewed source and tool-surface review. Only flash-reviewer received a live configured-model exercise; other role behavior was not smoke-tested by user choice.

## Follow-up work items

None required.

## Source references

- `docs/agent-definitions.md`
- `spec/archive/260909-1952-profile-extension-loading/outcome.md`
- Installed `@offbynan/pi-cursor-provider` 0.7.0 source and manifest
- Model and benchmark references recorded in `item.yaml` and `plan.md`

## Wiki updates

None. This work changed user-specific global configuration and established no new repository runtime behavior.
