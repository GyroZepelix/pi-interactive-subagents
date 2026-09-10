# 260909-1928 - global profiles and safe Cursor provider

Date: 2026-09-10
Work item: `260909-1928-create-global-scout-researcher-and-worker-profiles`
Status: shipped
In one line: Created five global capability profiles, replaced an unsafe Cursor CLI adapter with a Pi-controlled provider, verified isolation, and archived the completed item.

## Goal

Create polished global scout, researcher, worker, flash-reviewer, and twin profiles using the repository's native capability system. Keep reconnaissance and review structurally read-only, give worker direct research tools, and prevent nested twin recursion.

## How we approached it

The session first revised a stale bridge-based plan to use `builtin-tools`, package `extensions`, and `subagent_agents`. After exact external-write previews and approvals, it created the five profiles and removed an invalid empty-body general profile. The user then changed twin to standalone, added worker research tools, and requested explicit Cursor provider grants for Cursor-backed roles.

A contract review proved the first Cursor CLI provider defeated read-only isolation through TTY-only replay tools and unrestricted native agent execution. Work stopped rather than accepting the apparent non-TTY result. The user installed a direct provider, after which its installed source, live model registry, canonical IDs, thinking-level mapping, profile discovery, and model-free tool surfaces were checked. A final flash-reviewer run passed the targeted contract review, and the approved archive helper completed the item.

## Key decisions

- **Use structural reviewer safety** - flash-reviewer receives only read-oriented Pi tools and no shell, web, or nested-agent grants.
- **Use direct research selectively** - researcher and twin receive both research packages; worker also receives them alongside coding tools, while scout and flash-reviewer do not.
- **Keep twin standalone and top-level only** - twin receives a self-contained task, may delegate to the other four profiles, and is excluded from every nested allowlist.
- **Use the direct Cursor provider** - selected `@offbynan/pi-cursor-provider` after installed-source inspection showed Pi-controlled MCP routing and rejection of provider-native operations.
- **Use canonical provider IDs** - scout and reviewer use `cursor/gemini-3.8-flash` with medium and high thinking; worker uses `cursor/cursor-grok-4.6-fast` with high thinking.
- **Delete the invalid general profile** - fresh discovery showed its empty body could not coexist with zero-diagnostic acceptance, and the user approved the exact deletion.

## What did not work

- **Legacy bridge design** - became obsolete after native package-scoped extension grants were implemented; the plan was rewritten before profile installation.
- **Cursor CLI provider for read-only roles** - TTY-aware source review showed mutating replay tools and unrestricted native execution, so it was rejected rather than weakening the safety contract.
- **Non-TTY activation as sole provider evidence** - initially hid TTY-gated behavior; the final evidence combined real-environment reasoning, installed-source inspection, and active-tool assertions.
- **Planned settings replacement** - the old model string was already absent when the exact edit ran, so the edit failed closed and current state was verified instead of rewriting the file.

## Current state and where we left off

- Shipped/verified: the archived item records five valid profiles, safe provider selection, canonical models and thinking levels, worker research tools, standalone twin behavior, zero discovery diagnostics, and passing review.
- Pending: broad live behavior smoke for scout, researcher, worker, and twin was not requested. The external dotfiles state and repository archive changes remain uncommitted and user-controlled.

## Source of truth

- [Archived outcome](../../spec/archive/260909-1928-create-global-scout-researcher-and-worker-profiles/outcome.md): delivered scope, deviations, risks, and completion state.
- [Archived verification](../../spec/archive/260909-1928-create-global-scout-researcher-and-worker-profiles/verification.md): model mappings, provider checks, exact tool surfaces, test results, and reviews.
- [Archived plan](../../spec/archive/260909-1928-create-global-scout-researcher-and-worker-profiles/plan.md): final R01-R12 contract and decisions D01-D09.
- [Agent definition documentation](../../docs/agent-definitions.md): strict profile schema, package grants, activation, and nesting behavior.

## Verification

- Done: fresh real profile listing returned five definitions and zero diagnostics; model registry had no stale warnings; read-only and worker SDK activation assertions passed; safe provider source rejected ten native operation classes and registered no Pi tools; 198 unit tests, spec validation, Markdown checks, diff checks, and archive checks passed; contract-quality retry passed without findings.
- Not verified yet: broad configured-model role behavior beyond the approved flash-reviewer contract check; future compatibility of the unofficial provider's private protocol.

## Open questions, blockers, next safe action

- Open/blocked: no implementation blocker remains. Provider updates can invalidate the audited behavior.
- Next safe action: review and checkpoint the repository and dotfiles changes without discarding unrelated state; re-audit provider source and tool surfaces before accepting any future provider update.

## Dynamic knowledge trail

- [Agent profile conventions](../conventions/agent-profiles.md): topic-specific provider model-selection guidance.
- [Runtime safety conventions](../conventions/runtime-safety.md): provider execution-boundary and TTY-verification guidance.
