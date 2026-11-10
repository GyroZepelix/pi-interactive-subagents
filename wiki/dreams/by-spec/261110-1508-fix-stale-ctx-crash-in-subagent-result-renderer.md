# Dream learnings: 261110-1508-fix-stale-ctx-crash-in-subagent-result-renderer

Work item: `261110-1508-fix-stale-ctx-crash-in-subagent-result-renderer`

> Historical snapshot: this ledger records what Dream retained at each Gamemaster checkpoint. Current source, plans, verification, outcomes, and current dynamic destinations remain authoritative.

<!-- dream-checkpoints:start -->

## Gamemaster checkpoint: 261110-1508-fix-stale-ctx-crash-in-subagent-result-renderer/direct

Date: 2026-11-10
Dream log: [2026-11-10-1527-gamemaster-checkpoint-261110-1508-fix-stale-ctx-crash-in-subagent-result-rendere.md](../2026-11-10-1527-gamemaster-checkpoint-261110-1508-fix-stale-ctx-crash-in-subagent-result-rendere.md)
Outcome: retained learning

### Isolate lifecycle tests in a fresh extension instance

- **Exact written text:**
  > - **Isolate lifecycle tests in a fresh extension instance** - `test/test.ts` imports `index.ts` once, so module-level session state (`latestCtx`, `latestPi`, shutdown flag, `runningSubagents`) is shared by every `default(api)` call. A test that fires `session_start` or `session_shutdown` should import a fresh instance with a unique query string (`new URL("../pi-extension/subagents/index.ts", import.meta.url)` plus `?<unique>`), which mirrors Pi's per-session `moduleCache: false`. Afterward, restore the process-global symbols that the import and shutdown touch: `pi-subagents/running-children-count`, and a non-aborted `pi-subagents/poll-abort-controller` (`test/test.ts` "stale session context safety").
- **Destination and classification:** `wiki/conventions/typescript-modules.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** The regression tests fire `session_start` and `session_shutdown`, which mutate module-level state that every other `default(api)` test shares. Importing `index.ts` with a unique query string gave each test its own instance. The import aborts and replaces the global poll controller and rebinds the running-children-count symbol, so the tests restore both.
- **Expected future benefit:** Future lifecycle or renderer tests avoid leaking shut-down state (for example, suppressed result delivery or a null `latestPi`) into later tests, and they can model Pi's real per-session module reload.
- **Why this tier:** It is a stable, repository-specific test seam within the existing Test seams topic, not a broad convention or a one-off event. It is too concrete and action-changing to leave as an observation.

### Render `subagent_result` expanded in unit tests

- **Exact written text:**
  > - **Render `subagent_result` expanded in unit tests** - the collapsed view calls Pi's `keyHint`, which throws `Theme not initialized` outside the interactive TUI. Pass `{ expanded: true }` unless the test initializes Pi's theme (`pi-extension/subagents/index.ts`, `test/test.ts`).
- **Destination and classification:** `wiki/conventions/typescript-modules.md` - `Topic-specific dynamic knowledge`
- **Session evidence or selection reason:** The first run of the new renderer tests failed with `Theme not initialized` from Pi's `keyHint` in the collapsed branch. Rendering with `{ expanded: true }` fixed it, and no existing test covered this renderer.
- **Expected future benefit:** Prevents a confusing failure that is unrelated to the behavior under test the next time someone unit-tests the `subagent_result` renderer.
- **Why this tier:** It is a narrow, stable test-seam fact for this renderer and belongs next to the existing test-seam guidance. It does not justify a page of its own or a broad convention.
