---
schema_version: 1
episode_id: "2026-10-11-2220-gamemaster-checkpoint-261002-1653-add-mcp-and-codemode-profile-access-02-02"
timestamp: "2026-10-11T22:20:13+09:00"
summary: "Completed, independently reviewed, and archived the final non-model MCP isolation, documentation, and whole-plan verification slice."
kind: "gamemaster-checkpoint"
status: "shipped"
work_item: "261002-1653-add-mcp-and-codemode-profile-access"
current: "02.02"
topics: ["mcp","capability-isolation","resume"]
---

# Gamemaster checkpoint: 261002-1653-add-mcp-and-codemode-profile-access/02.02

Date: 2026-10-11
Work item: 261002-1653-add-mcp-and-codemode-profile-access
Status: shipped
In one line: Completed, independently reviewed, and archived the final non-model MCP isolation, documentation, and whole-plan verification slice.

## Goal

Finish Current 02.02 by proving selected-versus-ambient MCP process isolation without a model call, documenting the verified Pi 1.0+ contract, completing high-assurance whole-plan reviews, and archiving the item only after explicit terminal approval.

## How we approached it

The implementation built a disposable stdio MCP marker server and isolated Pi SDK sessions around the runtime completed in 02.01. The fixture used temporary agent/project roots, a generated credential canary, a local HTTP 401 endpoint, and Pi's public lifecycle APIs to inspect real tool registration, active/callable exposure, resource behavior, prompt metadata, diagnostics, and shutdown without prompting a model. User documentation and durable architecture, profile, runtime-safety, map, and development guidance were then aligned with observed behavior. Focused, Standards, and Spec reviewers inspected the Current and the strict ancestor whole-plan boundaries; targeted corrections closed temporary-root cleanup and snapshot-terminology findings. After completion approval, the helper archived the validated item. Its first preflight exposed four active-item prefixes in earlier immutable checkpoint logs, so the parent authorized an exact prefix-only archive-link correction before the successful final preflight.

## Key decisions

- **Use real Pi SDK lifecycle with local-only fixtures** - chose external-process and local HTTP evidence without a model request because filtering, exposure, resources, diagnostics, and teardown can be proven deterministically without provider cost or user configuration.
- **Keep credentials and ambient authority outside durable capability state** - used a generated canary and selected-only config references so the test could prove runtime delivery while snapshots and diagnostics retained only source identity and digest.
- **Preserve the configured-model approval gate** - left the model-consuming lifecycle suite unrun because the accepted plan required separate approval and the non-model suite covered the scoped isolation contract.
- **Correct immutable checkpoint links narrowly** - replaced only four canonical active prefixes with the stable archive location because archive preflight rejected them; preserved every other historical byte, identity, catalog record, ledger route, and narrative.

## What did not work

- **Early fixture assumptions differed from Pi and macOS behavior** - canonical temporary paths, Pi's internal codemode exposure representation, OAuth-store creation, built-in factory injection, and request-time prompt rendering required harness corrections before the final 2/2 lifecycle pass.
- **One focused unit run inherited nested-agent filtering** - `PI_SUBAGENT_ALLOWED` changed four discovery expectations; rerunning with the documented top-level unset boundary passed 98/98 and the full suite passed 266/266.
- **Initial cleanup and terminology evidence was incomplete** - independent reviews found a disposable-root cleanup gap and inaccurate version-2 mode wording; targeted corrections and one re-review per affected gate passed.
- **Initial archive preflight was blocked by historical active paths** - exact archive-aware prefix correction and Dream identity/catalog safety checks resolved the blocker without changing checkpoint meaning.

## Current state and where we left off

- Shipped/verified: Current 02.02, T02, and whole-plan verification are complete; the canonical item is archived with a completed manifest, outcome, verification, and archive index row, and the active copy is absent.
- Pending: no implementation work remains. Live configured-model and real external MCP/OAuth interoperability remain optional, separately approval-gated evidence.

## Source of truth

- spec/archive/261002-1653-add-mcp-and-codemode-profile-access/implementation/02-02-integration-docs-verification.md: final slice attempts, process-isolation evidence, checks, reviews, archive-link correction, and handoff.
- spec/archive/261002-1653-add-mcp-and-codemode-profile-access/verification.md: consolidated commands, R01-R14 coverage, review history, failures, skipped gate, and residual uncertainty.
- spec/archive/261002-1653-add-mcp-and-codemode-profile-access/outcome.md: completed disposition, delivered scope, deviations, risks, and follow-up boundary.
- test/integration/mcp-capability.test.ts and test/integration/fixtures/mcp-marker-server.mjs: selected-versus-ambient lifecycle, exposure, resource, diagnostic, secret-boundary, and cleanup evidence.
- README.md and docs/agent-definitions.md: user-facing syntax, trust, complete-server grant, support, failure, trusted-extension, and replay contract.

## Verification

- Done: focused MCP lifecycle passed 2/2; focused whole-plan unit selection passed 98/98; the full deterministic suite passed 266/266; controlled tmux passed 9/9; dependency, package allowlist, Markdown, cleanup, spec, archive, and diff checks passed; Focused and Standards reviews passed after one targeted retry each and Spec passed initially.
- Not verified yet: configured-model lifecycle and real external MCP/OAuth interoperability were not run under the explicit approval gate.

## Open questions, blockers, next safe action

- Open/blocked: no blocker remains in the accepted and archived contract.
- Next safe action: return the exact Dream paths and checks to Gamemaster for its parent-controlled Git checkpoint; do not stage or commit in this session.

## Dynamic knowledge trail

- wiki/observations.md: Observation.
