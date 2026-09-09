# 260909-1230 - Harden agent profiles and adapt the fork

Date: 2026-09-09
Work item: `260909-1230-harden-agent-profiles-and-adapt-the-fork`
Status: partial
In one line: Completed and independently reviewed the user-managed profile migration and fail-closed launch hardening; the working tree awaits a user-controlled Git checkpoint.

## Goal

Remove package-provided agent discovery, define the complete user-managed profile contract, and prevent malformed definitions, missing restrictions, identity mismatches, unsafe resume state, or runtime naming collisions from broadening child capabilities.

## How we approached it

The session resumed a direct-mode planned item from a large but fully attributed uncommitted working tree. It validated the existing implementation, ran unit, package, syntax, documentation, spec, and controlled tmux checks, then repeatedly sent the complete diff and every untracked file to independent read-only `generalist` review. Each blocking review finding was reproduced or grounded against source, corrected with focused production-path tests, and reviewed again until the complete final review passed. The plan and verification evidence were finalized only after that PASS.

## Key decisions

- **User-managed inventory** - removed package discovery and distribution of default profiles while preserving the former profiles under repository-only `agent-examples/` at the user's request.
- **Fail-closed identity and launch** - used one canonical parsed definition throughout discovery and launch, and treated uncertain invalid project identities conservatively rather than exposing global fallback.
- **Current runtime target** - migrated to the installed Pi 0.85.1 package namespaces and APIs after explicit approval rather than retaining the obsolete package target.
- **Verification boundary** - ran safe unit, package, syntax, Markdown, spec, and controlled tmux checks; kept the model-consuming lifecycle suite behind explicit approval.
- **Review completion** - did not mark T01-T07 complete until an independent reviewer covered the full diff, all deletions, and all untracked files and returned PASS.

## What did not work

- **Early focused reviews blocked the change** - successive reviews exposed malformed override identity gaps, inconsistent generated loadouts, prototype-sensitive registry names, resume alias concurrency, and artifact filename collisions; focused regressions and complete repeat reviews were required.
- **Tmux focus from the active Pi TUI was unstable** - the host TUI competed with the focus assertion even though marker behavior passed; controlled detached sessions at multiple widths completed 7/7.
- **One read-only reviewer staged the tree** - the Git index changed while untracked files were being included; only the index was restored, leaving every working-tree change intact.
- **Ad hoc Markdown checking misread prompt placeholders** - literal placeholder links in agent example text looked like repository links until the checker distinguished placeholders from relative documentation targets.
- **The first empty-name fixture used an incorrect basename assumption** - Node treats `.md` as the basename rather than an empty stem; the regression was corrected to use an explicit whitespace-only effective name.

## Current state and where we left off

- Shipped/verified: all plan tasks are checked; the final independent focused review passed; 171 unit tests, 7 controlled tmux tests, package-content assertions, syntax, dependency, Markdown, patch, and spec checks passed.
- Pending: all changes remain unstaged and uncommitted. End-to-end model-consuming lifecycle behavior remains intentionally unverified without approval.

## Source of truth

- `spec/active/260909-1230-harden-agent-profiles-and-adapt-the-fork/plan.md`: authoritative requirements, decisions, completed tasks, and completion handoff.
- `spec/active/260909-1230-harden-agent-profiles-and-adapt-the-fork/verification.md`: commands, failures, review findings and resolutions, final PASS, and remaining uncertainty.
- `pi-extension/subagents/agents.ts`: canonical profile parsing, validation, diagnostics, trust, and precedence.
- `pi-extension/subagents/index.ts`: launch preparation, fail-closed sandboxing, runtime naming, artifact creation, messaging, and resume orchestration.
- `pi-extension/subagents/session.ts`: loadout validation, session helpers, and prototype-safe persistent name registry.
- `test/test.ts`: focused production-path regressions.

## Verification

- Done: `npm test` passed 171/171; controlled detached tmux surface tests passed 7/7; package allowlist contained 16 expected files; syntax, dependency tree, searches, Markdown links/fences, patch integrity, and work-item validation passed; final independent review passed.
- Not verified yet: model-consuming lifecycle integration, intentionally skipped because external calls, time, and cost were not approved.

## Open questions, blockers, next safe action

- Open/blocked: no implementation blocker remains. A user-controlled Git checkpoint is still pending.
- Next safe action: review the working tree and create the desired Git checkpoint without changing the verified scope.

## Dynamic knowledge trail

- `wiki/map.md`: topic-specific dynamic knowledge.
- `wiki/development.md`: topic-specific dynamic knowledge.
- `wiki/observations.md`: observation queue.
- `wiki/conventions/agent-profiles.md`, `wiki/conventions/runtime-safety.md`, and `wiki/architecture.md`: existing dynamic pages that already contain the final runtime contracts.
