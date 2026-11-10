# Handoff: pi crash from stale ctx in the `subagent_result` renderer

Date: 2026-11-10
From: debugging session in the A.Y.A. project (`~/Documents/1-Projects/10-software-development/pi-voice-assistant`), where the crash surfaced.
Status: bug report and fix input. Not a plan. Confirm the fix approach with the user before planning, per `AGENTS.md`.

## Symptom

pi printed this on startup after the crash:

```text
Warning: pi crashed on 11/10/2026, 12:09:07 PM (This extension ctx is stale after session
replacement or reload. Do not use a captured pi or command ctx after ctx.newSession(), ctx.fork(),
ctx.switchSession(), or ctx.reload(). ...). Run /bug to report it; the crash details are attached
automatically.
```

## Evidence (verified)

### E1 Crash record

Source: `~/.pi/agent/crashes.json` (single entry).

- `timestamp`: `2026-11-10T11:09:07.547Z`
- `version`: `1.5.0` (pi has since been updated to `1.5.1`; the relevant code below was read from 1.5.1 and is unchanged in shape)
- `kind`: `uncaught_exception`
- `sessionFile`: `~/.pi/agent/sessions/--Users-dgjalic-Documents-1-Projects-10-software-development-pi-voice-assistant--/2026-11-08T07-59-42-779Z_01a1ba2b-9cbb-7314-a808-8b42205c4198.jsonl`
- Top of stack:

```text
at ExtensionRunner.assertActive  (pi bundle chunk-44DLKSKE.js)
at get modelRegistry             (pi bundle chunk-44DLKSKE.js)
at Object.render                 (~/.pi/agent/git/github.com/GyroZepelix/pi-interactive-subagents/pi-extension/subagents/index.ts:3982:87)
at CustomMessageComponent.render (pi bundle chunk-4EYXVSA5.js)
at Container.render ...
at renderCached / layoutComponent  (TUI layout loop)
```

The installed copy under `~/.pi/agent/git/github.com/GyroZepelix/pi-interactive-subagents` and this repository are both at `0ba4432`, so line numbers match this repo.

### E2 Session context

- The crashed session file has 45 `subagent_result` messages, so the chat was full of components using this renderer.
- Its last entry is `2026-11-10T10:08:42Z`. Nothing was written in the hour before the crash at `11:09:07Z`.
- A new session file in the same directory starts at `2026-11-10T11:10:06Z`.
- Inference: the user ran a session-replacing action (`/new`, `/resume`, `/fork` or `/reload`) at about 11:09. The TUI redrew while the old extension instance was already invalidated, and pi crashed.

### E3 Faulty code in this repo

File: `pi-extension/subagents/index.ts` at `0ba4432`.

- Line 712: module-level `let latestCtx: ExtensionContext | null = null;`
- Line 2871-2872: `pi.on("session_start", (_event, ctx) => { latestCtx = ctx; ... })`
- Line 2884-2900: the `session_shutdown` handler clears intervals, aborts polling and clears `runningSubagents`, but **never resets `latestCtx`** (or `latestPi`).
- Line 3937-3941: `pi.registerMessageRenderer("subagent_result", ...)` returns `{ render(width) { ... } }`. The body runs lazily on **every TUI frame**, not once at construction.
- Line 3982 (crash site):

```ts
const window = resolveContextWindow(stats.model, stats.provider, latestCtx?.modelRegistry);
```

`latestCtx?.modelRegistry` is evaluated at the call site, so the getter throws **before** `resolveContextWindow` runs. The `try/catch` blocks inside `resolveContextWindow` (lines 412-433) do not protect this. Optional chaining only guards `null`/`undefined`, not a throwing getter.

### E4 Regression origin

Commit `464d98e` ("fix: used model registry for subagent context window gauge", 2026-10-24) changed line 3982 from

```ts
const window = contextWindowFor(stats.model);
```

to the `latestCtx?.modelRegistry` version. Before that commit the renderer did not touch `ctx`, so it could not hit this error. Spec record: `spec/archive/261024-1924-use-model-registry-for-subagent-context-window-gauge/`.

### E5 Why pi throws (pi internals, version 1.5.1)

Paths under `~/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/dist/`:

- `core/extensions/runner.js` ~482-492: `invalidate(message)` stores `staleMessage`; `assertActive()` throws `new Error(staleMessage)` if set.
- `core/extensions/runner.js` ~614-700 `createContext()`: **every** ctx getter (`ui`, `hasUI`, `cwd`, `sessionManager`, `modelRegistry`, `model`, ...) calls `runner.assertActive()` first.
- `core/agent-session.js` ~1081 `dispose()`: calls `this._extensionRunner.invalidate(...)` on session replacement.
- `core/agent-session.js` ~3094-3104 `reload()`: emits `session_shutdown`, then `oldRunner.invalidate()`, then does more async work before the new runner is up.
- `core/extensions/loader.js` ~486-487: extensions load through jiti with `moduleCache: false`, so each load gets a **fresh module instance** with its own `latestCtx`. Code from the old instance keeps pointing at the old, invalidated ctx.
- `modes/interactive/components/custom-message.js` ~58-70 `rebuild()`: wraps the renderer **factory** call in `try/catch`. The returned component's `render(width)` is called later by the TUI layout loop **without** a `try/catch`. A throw there becomes an uncaught exception and crashes pi.
- `modes/interactive/interactive-mode.js` ~3273: `CustomMessageComponent` gets its renderer from the current runner when the message is added. Existing chat components keep the closure from the instance that created them.

### E6 pi documentation

`~/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`, section "Session replacement lifecycle and footguns" (~line 1470): "Captured old `pi` / old command `ctx` session-bound objects are stale after replacement and will throw if used." Keeping a module-level `latestCtx` and reading it lazily from a renderer is exactly this captured-ctx case.

## Root cause (summary)

The `subagent_result` renderer reads a captured, module-level `ExtensionContext` (`latestCtx`) on every frame. After session replacement or reload, pi invalidates that ctx, and any getter on it throws. Old chat components still hold the old renderer closure and old module instance. The next frame calls `render()`, and the throw escapes pi's render loop, crashing the process. Commit `464d98e` introduced the regression.

## Secondary risks (not verified as crashing; check while fixing)

- `updateWidget()` (line 820+) reads `latestCtx.hasUI` and `latestCtx.ui.setWidget(...)`. It is called from many places (lines 1711, 1781, 1809, 1857, 1937-1939, 3087, 3120, 3202), including watcher and poll callbacks. Any callback that runs after `session_shutdown` and before the module is dropped would throw the same error. `session_shutdown` aborts polling, which reduces but may not eliminate this.
- The ask-question path at line 2356 calls `latestPi?.sendMessage(...)`. pi also invalidates the old `pi` API object (`runner.invalidate` -> `runtime.invalidate`), so a late question notification from an old instance could throw too.
- `subagent_status` (line ~4058) and `subagent_question` (line ~4087) renderers should be checked for any `latestCtx`/`latestPi` access inside `render()`.

## Fix options (to be confirmed with the user)

- A1 In `session_shutdown`, set `latestCtx = null` (and consider `latestPi = null`). With `?.` at line 3982 this falls back to the static `contextWindowFor` table. Note: this alone does not cover a frame rendered between `invalidate()` and the `session_shutdown` handler finishing if the order differs by path (in `reload()`, shutdown runs first, then invalidate, so A1 covers reload; `dispose()` ordering for newSession/switchSession should be checked).
- A2 Read the registry defensively at the call site, for example a helper `safeModelRegistry()` that wraps `latestCtx?.modelRegistry` in `try/catch` and returns `undefined` on error. A renderer should never be able to crash pi.
- A3 Better: resolve the context window once when the `subagent_result` message is created (where a live ctx is available) and store it in `message.details` (for example `details.contextWindow`). The renderer then reads only plain data. This also makes old sessions render consistently after `/resume`.
- A4 Apply the same guard pattern to `updateWidget()` and `latestPi` uses (see secondary risks).

Suggested minimum: A1 + A2. Preferred: A3 + A1, with A4 as a hardening pass.

## Suggested verification

- Unit test in `test/test.ts`: build the `subagent_result` renderer with a fake `latestCtx` whose `modelRegistry` getter throws, call `render(80)`, assert no throw and that the gauge uses the static fallback (or `details.contextWindow` for A3).
- Manual: run a subagent so a `subagent_result` with `contextTokens > 0` is in the chat, then run `/reload`, `/new`, `/resume` and `/fork`. pi must not crash and `~/.pi/agent/crashes.json` must not get a new entry.
- Run the repo's documented checks (see `wiki/development.md`).

## Upstream note

pi itself could arguably wrap `CustomMessageComponent` child `render()` in a `try/catch` the way `rebuild()` already wraps the factory. That is a pi-core change and out of scope here, but worth reporting with `/bug` if desired.
