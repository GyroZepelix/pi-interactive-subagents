# Dream learnings: 261025-0909-enable-read-anywhere-agy-subagents-via-operator-permission-policy

Work item: `261025-0909-enable-read-anywhere-agy-subagents-via-operator-permission-policy`

> Historical snapshot: this ledger records what Dream retained at each Gamemaster checkpoint. Current source, plans, verification, outcomes, and current dynamic destinations remain authoritative.

<!-- dream-checkpoints:start -->

## Gamemaster checkpoint: 261025-0909-enable-read-anywhere-agy-subagents-via-operator-permission-policy/direct

Date: 2026-10-25
Dream log: [2026-10-25-0946-gamemaster-checkpoint-261025-0909-enable-read-anywhere-agy-subagents-via-operato.md](../2026-10-25-0946-gamemaster-checkpoint-261025-0909-enable-read-anywhere-agy-subagents-via-operato.md)
Outcome: retained learning

### AGY deny-rule hits are not reported as denied actions

- **Exact written text:**
  > On AGY 1.4.7, explicit deny-rule matches (including `write_file(*)` and secret-path read denies) reach the model as tool errors, are absent from `denied_actions`, and leave the envelope `SUCCESS`; only headless soft-denials populate `denied_actions`. The package therefore fails runs only for soft-denials. When an AGY review or scout result could be missing required evidence, inspect the response text for permission errors instead of trusting `SUCCESS` alone (`pi-extension/subagents/agy.ts`, `spec/archive/261025-0909-enable-read-anywhere-agy-subagents-via-operator-permission-policy/verification.md`).
- **Destination and classification:** `wiki/conventions/runtime-safety.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** The approved live canary on AGY 1.4.7 returned `SUCCESS` with no `denied_actions` field, while its response reported both the canary-only read deny and the workspace write deny as user-configured deny-rule matches. This contradicted the plan's expected risk.
- **Expected future benefit:** Prevents treating a `SUCCESS` AGY review as complete evidence when a required read was hard-denied, and prevents future attempts to rely on `denied_actions` for deny-rule detection.
- **Why this tier:** It is a stable runtime contract proven by live behavior that changes how AGY results are interpreted. It belongs beside the existing AGY permission-boundary guidance rather than in a broad convention or the observation queue.

### Clear every inherited child variable for clean unit runs

- **Exact written text:**
  > When running the top-level unit suite from inside a spawned subagent, unset `PI_SUBAGENT_ALLOWED` unless the test specifically targets nested allowlisting. A present value intentionally filters discovery and makes top-level profile and command expectations fail (`pi-extension/subagents/agents.ts`, `pi-extension/subagents/index.ts`, `spec/archive/260914-1641-fix-frozen-subagent-reply-delivery/verification.md`). Other inherited child variables such as `PI_SUBAGENT_BUILTIN_TOOLS` also leak into tests: with only `PI_SUBAGENT_ALLOWED` unset, `applies the profile activation during session_start` fails identically at clean `HEAD`. For a full clean run from a child, unset every `PI_SUBAGENT_*` variable, and confirm any remaining failure against `HEAD` before treating it as a regression (`spec/archive/261025-0909-enable-read-anywhere-agy-subagents-via-operator-permission-policy/verification.md`).
- **Destination and classification:** `wiki/development.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** The plan's verification command `env -u PI_SUBAGENT_ALLOWED npm test` failed one test in this Twin session. A detached HEAD worktree reproduced the failure identically, and clearing every `PI_SUBAGENT_*` variable made the suite pass 287/287.
- **Expected future benefit:** Avoids misdiagnosing an environment leak as a regression and avoids repeated HEAD comparisons when Twins or other subagents run the suite.
- **Why this tier:** It refines existing development guidance on the same procedure, recurs whenever verification runs inside a child session, and is not broad enough for a convention page.
