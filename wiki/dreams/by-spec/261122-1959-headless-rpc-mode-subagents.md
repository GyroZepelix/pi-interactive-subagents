# Dream learnings: 261122-1959-headless-rpc-mode-subagents

Work item: `261122-1959-headless-rpc-mode-subagents`

> Historical snapshot: this ledger records what Dream retained at each Gamemaster checkpoint. Current source, plans, verification, outcomes, and current dynamic destinations remain authoritative.

<!-- dream-checkpoints:start -->

## Gamemaster checkpoint: 261122-1959-headless-rpc-mode-subagents/direct

Date: 2026-11-22
Dream log: [2026-11-22-2143-gamemaster-checkpoint-261122-1959-headless-rpc-mode-subagents-direct.md](../2026-11-22-2143-gamemaster-checkpoint-261122-1959-headless-rpc-mode-subagents-direct.md)
Outcome: retained learning

### Spawn surface selection

- **Exact written text:**

````markdown
4. The extension chooses the child surface with `selectSurfaceKind`. When `$TMUX` is set it creates a detached right-hand tmux split of the parent's pane. When `$TMUX` is unset, or for a new spawn whose profile sets `background: true`, it creates the child in its own detached session on the private per-user server `tmux -L pi-subagents`. A resume inside tmux always splits. It tags the pane with the child's session (or AGY state) path and completion file, seeds a child session when required, and writes task, launch-script, activity, registry, and sandbox artifacts under the parent Pi session directories (`pi-extension/subagents/index.ts`, `pi-extension/subagents/session.ts`, `pi-extension/subagents/tmux.ts`).
````

- **Destination and classification:** `wiki/architecture.md` - `Topic-specific dynamic knowledge` - `SUPERSEDE`
- **Closest existing guidance:** `wiki/architecture.md:12` "The extension creates a detached right-hand tmux split" - the replaced statement said every child splits; the source now chooses split or the private detached server and tags panes.
- **Admission basis:** `stale-fact correction`
- **Session evidence or selection reason:** `selectSurfaceKind` and `createSurfaceOfKind` in `index.ts` and `tmux.ts`; E2E run 1 showed a child on `tmux -L pi-subagents` with TMUX unset.
- **Expected future benefit:** Agents reasoning about spawn flow will not assume a split pane or a `$TMUX` requirement.
- **Why this tier:** Corrects the existing architecture step in place; not new guidance.

### Config schema with maxConcurrent

- **Exact written text:**

````markdown
- `config.json` is an untracked local override; `config.json.example` is the fallback. The schema accepts `status.enabled` and an optional top-level positive-integer `maxConcurrent`. When set, it rejects a spawn or resume before pane creation once this parent's running plus in-flight launches reach the cap. Steering, model-chain fallback attempts, and orphans of earlier parents are not counted (`.gitignore`, `config.json.example`, `pi-extension/subagents/status.ts`, `pi-extension/subagents/index.ts`).
````

- **Destination and classification:** `wiki/architecture.md` - `Topic-specific dynamic knowledge` - `SUPERSEDE`
- **Closest existing guidance:** `wiki/architecture.md:35` "The current schema accepts only `status.enabled`" - stale after `parseMaxConcurrent` was added.
- **Admission basis:** `stale-fact correction`
- **Session evidence or selection reason:** `status.ts` `parseMaxConcurrent` and `index.ts` `reserveLaunchSlot`; unit tests for parse and over-cap spawn and resume.
- **Expected future benefit:** Prevents config changes or reviews that treat `maxConcurrent` as unknown, and records what the cap does not count.
- **Why this tier:** In-place correction of a data-ownership statement.

### Detached handle routing invariant

- **Exact written text:**

````markdown
- Detached surface handles are `pi-subagents:%n`. Every tmux primitive parses the handle and prefixes `-L pi-subagents`, including the `submitText` buffer load, paste, and delete steps, because buffers are per server. Plain `%n` handles keep their exact argv, and detached closes skip layout rebalancing. Exit polling treats a missing private server (`no server running`, or a connect error for a missing socket or a refused connection) as confirmed pane loss (`pi-extension/subagents/tmux.ts`).
````

- **Destination and classification:** `wiki/architecture.md` - `Topic-specific dynamic knowledge` - `ADD`
- **Closest existing guidance:** `wiki/architecture.md:43` "tmux splits use detached mode and are rebalanced to `even-horizontal`" - covers split layout only, not socket routing or per-server buffers.
- **Admission basis:** `observed stable contract`
- **Session evidence or selection reason:** `tmux.ts` `parseSurfaceHandle` and `socketArgs` on every primitive; unit argv tests; detached integration paste case verifying buffer cleanup on the private server.
- **Expected future benefit:** A future tmux primitive or buffer step that forgets `-L` would silently target the wrong server; this invariant prevents that.
- **Why this tier:** Architecture invariants hold surface-layer contracts; too specific for conventions.

### RPC status contract

- **Exact written text:**

````markdown
- Only when `ctx.mode === "rpc"`, the parent emits a plain string-lines `setWidget("subagent-status")`, a `setStatus("subagents")` with compact JSON `{"v":1,"running":[{name, agent?, state, sessionFile?}]}`, and one `notify` per `subagent_result`. Widget and status are sent only when their content changes, carry no per-second timer, and are cleared when idle. The TUI keeps the component widget and none of these records. RPC hosts parse the v1 shape, so an incompatible change needs a new `v` (`pi-extension/subagents/index.ts`, `README.md`).
````

- **Destination and classification:** `wiki/architecture.md` - `Topic-specific dynamic knowledge` - `ADD`
- **Closest existing guidance:** none found - searched architecture, runtime-safety, map, and development for widget, setStatus, and RPC; only the TUI widget was described.
- **Admission basis:** `observed stable contract`
- **Session evidence or selection reason:** `updateRpcStatus` and `notifyRpcResult` in `index.ts`; unit tests; E2E run 1 captured the records (5 widget and 5 status records over 44 s).
- **Expected future benefit:** Keeps the external host contract (`v` bump on incompatible change, change-only emission) visible to anyone editing the widget code.
- **Why this tier:** It is an integration contract with an external host, which belongs on the architecture page under integrations.

### Aborted watch keeps child running

- **Exact written text:**

````markdown
- Late watcher and chain results are delivered through `deliverSubagentMessage`, which skips delivery after shutdown and contains a throw from a stale API. Results cancelled by shutdown are not re-delivered to the replacement session. Watcher aborts come only from parent shutdown or extension reload, so an aborted watch must never close the child pane: the child keeps running, and only completion or an unexpected watcher error closes it. A later `subagent_message` steers a still-live child and resumes a finished one (`pi-extension/subagents/index.ts`, `spec/archive/261122-1959-headless-rpc-mode-subagents/verification.md`).
````

- **Destination and classification:** `wiki/conventions/runtime-safety.md` - `Topic-specific dynamic knowledge` - `SUPERSEDE`
- **Closest existing guidance:** `wiki/conventions/runtime-safety.md:65` "Results cancelled by shutdown are not re-delivered to the replacement session; child session files remain resumable." - contradicted: the aborted watcher used to close the pane, and a live child must now be steered rather than resumed.
- **Admission basis:** `stale-fact correction`
- **Session evidence or selection reason:** E2E run 1 restart phase failed because the watcher catch path closed panes on shutdown; after the I2 fix, E2E run 2 passed with the orphan surviving and being steered.
- **Expected future benefit:** Prevents reintroducing `close(surface)` on abort paths, which silently kills every child when the parent exits or reloads.
- **Why this tier:** Corrects the existing session-shutdown bullet in place in the safety page that owns lifecycle rules.

### Live-orphan steering guard

- **Exact written text:**

````markdown
- **Steer a live orphan instead of resuming it** - Before resuming a registered name that this process does not run, `subagent_message` looks for a live tagged pane on the attached server (when `$TMUX` is set) and on `tmux -L pi-subagents`. A pane counts as live only when its `@pi_subagent_session` canonical path matches, its `@pi_subagent_done` completion file is absent, and it is not dead. The tag alone is not enough, because after a parent exit nobody closes the pane and its shell outlives the child. A live Pi or Claude orphan is steered (its result is not delivered to this parent), and a live AGY orphan is refused. An `unknown` lookup refuses the resume: any transport failure or tmux older than 3.0 is unknown, and only a missing private server proves absence (`pi-extension/subagents/tmux.ts`, `pi-extension/subagents/index.ts`).
````

- **Destination and classification:** `wiki/conventions/runtime-safety.md` - `Topic-specific dynamic knowledge` - `ADD`
- **Closest existing guidance:** `wiki/architecture.md:24` "Canonical state/session reservations prevent concurrent launches." - in-process reservations only; they do not survive a parent restart and do not define pane liveness.
- **Admission basis:** `observed stable contract`
- **Session evidence or selection reason:** `guardLiveOrphan` and `findLiveTaggedPane` in source; unit tests for found, unknown, absent, AGY, and in-process; E2E run 2 returned `submitted` with `orphan: true` and no second launch.
- **Expected future benefit:** Agents changing resume paths keep the cross-restart double-process guard and the completion-file liveness rule.
- **Why this tier:** Resume-safety rule on the runtime-safety page; specific to this subsystem.

### Development prerequisites

- **Exact written text:**

````markdown
- Runtime use requires Pi 1.0 or newer and the tmux executable; the locked development graph currently resolves Pi 1.1.x. Inside tmux (for example `tmux new -A -s pi 'pi'`) children split the parent's window; without `$TMUX` they run on the private detached server `tmux -L pi-subagents` (`README.md`, `package.json`, `package-lock.json`, `pi-extension/subagents/tmux.ts`).
````

- **Destination and classification:** `wiki/development.md` - `Topic-specific dynamic knowledge` - `SUPERSEDE`
- **Closest existing guidance:** `wiki/development.md:5` "Pi must run inside tmux, for example `tmux new -A -s pi 'pi'`" - stale since `isMuxAvailable` needs only the binary.
- **Admission basis:** `stale-fact correction`
- **Session evidence or selection reason:** `tmux.ts` `isMuxAvailable`; unit suite passes 333/333 with TMUX unset.
- **Expected future benefit:** Agents will not refuse or misconfigure headless runs.
- **Why this tier:** In-place correction of the prerequisites bullet.

### tmux surface test scope

- **Exact written text:**

````markdown
| `node --test test/integration/tmux-surface.test.ts` | Real tmux pane creation, delivery, focus, capture, and cleanup. | Requires tmux but does not invoke a model. Prefer a controlled detached tmux session when an active Pi TUI may compete for pane focus. Split-pane cases run only with an attached client; the detached private-server cases also run under `env -u TMUX -u TMUX_PANE`. |
````

- **Destination and classification:** `wiki/development.md` - `Topic-specific dynamic knowledge` - `MERGE`
- **Closest existing guidance:** `wiki/development.md:19` "Prefer a controlled detached tmux session when an active Pi TUI may compete for pane focus." - adds which cases run without an attached client.
- **Admission basis:** `observed stable contract`
- **Session evidence or selection reason:** `harness.ts` gates split cases on `isTmuxAvailable`; runs gave 17/17 in a controlled session and 5/5 detached with TMUX unset.
- **Expected future benefit:** Agents can verify detached behavior from a headless shell and know why split cases are skipped.
- **Why this tier:** One clause merged into the existing verification-tier row.

### tmux.ts map responsibility

- **Exact written text:**

````markdown
| `pi-extension/subagents/tmux.ts` | tmux availability, split and detached (`-L pi-subagents`) pane lifecycle, socket-qualified handle routing through an injectable transport, pane tags and live-pane lookup, command delivery, screen capture, layout balancing, and completion polling. |
````

- **Destination and classification:** `wiki/map.md` - `Topic-specific dynamic knowledge` - `MERGE`
- **Closest existing guidance:** `wiki/map.md:12` "tmux availability, pane lifecycle, command delivery" - adds the detached surface, handle routing, and pane tags.
- **Admission basis:** `observed stable contract`
- **Session evidence or selection reason:** `tmux.ts` now owns detached creation, the injectable transport, tags, and lookup.
- **Expected future benefit:** Routes changes to detached surfaces and tags to the right module.
- **Why this tier:** Map row merge; routing knowledge only.

### tmux transport and test setters

- **Exact written text:**

````markdown
Implementation modules expose focused named functions, types, and explicit test-hook objects such as `__test__` and `__pollForExitTest__`. `__tmuxTransportTest__.set(runner)` replaces the tmux process runner, so argv can be asserted without a server; restore it with `set(null)`. `__test__` setters (`setLatestCtxForTest`, `setOrphanPaneOpsForTest`, `setLaunchCapForTest`) inject RPC context, orphan lookup, and the concurrency cap; reset each one after the test. The unit suite imports these directly and uses mocked ExtensionAPI objects and temporary directories (`pi-extension/subagents/index.ts`, `pi-extension/subagents/tmux.ts`, `test/test.ts`).
````

- **Destination and classification:** `wiki/conventions/typescript-modules.md` - `Topic-specific dynamic knowledge` - `MERGE`
- **Closest existing guidance:** `wiki/conventions/typescript-modules.md:16` "explicit test-hook objects such as `__test__` and `__pollForExitTest__`" - names the new seams and the reset obligation.
- **Admission basis:** `observed stable contract`
- **Session evidence or selection reason:** Unit tests use `__tmuxTransportTest__.set` for byte-identical argv and the new `__test__` setters for RPC, orphan, and cap tests.
- **Expected future benefit:** Future tests assert tmux argv without a server and avoid leaking module state between tests.
- **Why this tier:** Merged into the existing test-seam paragraph.
