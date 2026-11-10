# Handoff: RPC (headless) mode requirements from A.Y.A.

Date: 2026-11-09
From: A.Y.A. voice assistant project (`~/Documents/1-Projects/10-software-development/pi-voice-assistant`, roadmap item `261109-1834-a-y-a-roadmap`, backlog B16)
Status: requirements input for a later grill-with-docs in this repository. Not a design and not a plan. Everything here is open to refinement.

## Why

A.Y.A. is the user's Android assistant. Holding the power button opens an overlay; the user speaks or types; the request goes to Pi running in Termux on the phone. The user wants to delegate work from that Pi to sub-agents exactly as in the terminal ("start a twin on this", long-running research while the overlay is closed), and later wants a fast "System 1" front agent that hands complex requests to a stronger sub-agent with the user's exact prompt.

Architecture today:

```text
A.Y.A. app (Kotlin/Compose overlay)
   <-> WebSocket on 127.0.0.1 (Durable-shaped protocol: snapshot + changes per conversation)
aya-bridge (Node, in Termux; lazy start, exits after an idle timeout, wake lock only during turns)
   <-> JSONL over stdin/stdout
pi --mode rpc (cwd ~/aya, global extensions + ~/aya/.pi project layer)
```

## Current behaviour (fact, checked 2026-11-09)

- The README states "This fork is tmux-only"; `pi-extension/subagents/tmux.ts` is the only surface layer and `isTmuxAvailable()` requires `$TMUX` plus the tmux binary. Under A.Y.A.'s `pi --mode rpc` there is no tmux pane, so `subagent` cannot launch children.
- Completion is delivered to the parent as a steer message, and a widget tracks running children (TUI).

## What A.Y.A. needs (requirements)

- R1 Headless launch surface. When no terminal multiplexer is available (or when configured), launch children as background processes instead of panes, for example `pi --mode rpc` or `--mode json` with the agent profile's model, tools and prompt. The existing agent profile files (`~/.pi/agent/agents/*.md`, project `.pi/agents/*.md`) stay the source of truth.
- R2 Same tool contract. `subagent` returns immediately; completion wakes the parent with the result as a steer message; independent calls can run concurrently; auto-exit and finalisation rules stay the same.
- R3 Steering and resume. `subagent_message` must work headless (steer a running child, resume a finished one) through the child's RPC stdin rather than tmux input.
- R4 Status for RPC clients. Report running children through Pi's RPC-visible channels so A.Y.A. can show them: `setWidget` text lines and `setStatus` (supported in RPC), `notify` on completion or failure, plus a structured form the host can parse (for example a stable `setStatus` key with JSON, a custom session entry, or `details` on tool results). Define it so the A.Y.A. bridge can turn completion into an Android notification.
- R5 Transcript access. Without a pane the user cannot watch a child. Each child needs a discoverable session file and log path so a client can show its transcript or tail its progress.
- R6 Parent lifetime. A.Y.A.'s bridge stops its Pi after an idle timeout and Android may kill Termux processes. Decide and document what happens to children when the parent exits:
  - children keep running detached and their results are stored in an inbox that the next parent session receives, or
  - the parent stays alive (and the host keeps a wake lock) while children run, with an API the host can query ("children running?").
  A.Y.A. needs one of these to be explicit.
- R7 Mobile constraints. Children on Termux need: bounded concurrency (configurable), a way for the host to hold `termux-wake-lock` while children run, survival or clean failure under Android phantom-process killing, and modest memory use.
- R8 Credentials and profiles. Children use the same Pi auth and settings resolution as the parent (including `PI_CODING_AGENT_DIR` and project trust); no credentials in arguments or logs.
- R9 No regression for tmux users.

## Concrete A.Y.A. examples

- Voice: "Start a twin on: research the best e-bike under 3000 euros and give me a short summary." -> A.Y.A. answers "Started." immediately; the overlay closes; 10 minutes later a notification "Twin finished" opens the overlay with the result.
- Voice mid-conversation: "Ask a scout to check which files mention the bridge token." -> the overlay shows a small "1 running" strip; the result arrives as a message.
- Later (A.Y.A. quick actions / System 1): a fast front model answers "On it" and delegates the user's exact prompt to a stronger sub-agent profile.
- "Tell the twin to also compare prices in Croatia." -> `subagent_message` steers the running child.

## Non-goals for this extension

- A.Y.A.-specific UI (A.Y.A. renders status from the RPC-visible channels).
- Android notifications themselves (the A.Y.A. bridge and app own them).

## Open questions for the grill here

- Child process mode (`rpc` vs `json`) and how steering maps onto it.
- Inbox vs keep-alive for parent exit (R6).
- Structured status format (R4) and its versioning.
- Whether headless mode is automatic (no tmux) or explicit (config or flag).
- Support for non-Pi harnesses (Claude Code, `agy`) headless, or Pi-only first.

## Acceptance ideas

- Under `pi --mode rpc` without tmux: `subagent` launches a child, returns immediately, the parent receives the steer message on completion, `subagent_message` steers and resumes, and status appears through `setWidget`/`setStatus`/`notify` in the RPC event stream.
- Parent exit behaviour matches the chosen R6 option in a scripted test.
- tmux behaviour and tests unchanged.

## A.Y.A. side (for context, built later in A.Y.A.)

A.Y.A. will render sub-agent status in its overlay, turn completions into Android notifications through the bridge, and manage wake locks while children run, in a separate A.Y.A. item after this extension supports headless mode.
