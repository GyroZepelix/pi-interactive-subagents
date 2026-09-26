# Discovery: Configurable model fallback

Work item: `260926-1248-configurable-model-fallback`
Status: Ready for Spec
Created: 2026-09-26
Updated: 2026-09-26

## Objective

Design a KISS, configurable, ordered inference fallback for subagent profiles. The motivating profiles are the read-only global `scout` and `flash-reviewer`: try AGY first, then Cursor Gemini 3.8 Flash, then OpenAI Codex GPT-5.6 Luna when the prior target has exhausted usable account inference.

Assurance: medium - the change crosses strict profile validation, AGY and Pi launch paths, terminal error classification, whole-task replay, name registry and resume behavior, and result presentation. It remains local, opt-in, and reversible, and the requested initial consumers are read-only.

## Desired outcome

One agent profile declares an ordered inline model/harness chain. The extension executes one target at a time, advances only on recognized usage exhaustion, and delivers one final result under the original runtime name without requiring the parent to poll or manually respawn the role.

## Repository and domain context

- The extension runs local trusted Pi sessions in tmux and currently supports separate Pi, Claude, and AGY harnesses.
- Current global `scout.md` and `flash-reviewer.md` use `cli: agy`, `model: gemini-3.8-flash`, and only `read`, `grep`, `find`, and `ls`.
- AGY is an external one-shot process with its own result and resume snapshot. Cursor models run in a Pi child and require the configured Cursor provider extension.
- `pi --list-models` currently exposes `cursor/gemini-3.8-flash`, `cursor/gpt-5.6-luna`, and `openai-codex/gpt-5.6-luna`. The user selected OpenAI Codex for the third example target so it uses a distinct provider after Cursor.

## Scope

- Ordered inline targets in one profile.
- Cross-harness fallback from AGY to Pi providers.
- Quota/resource-exhaustion activation, including terminal bare 429 and `RESOURCE_EXHAUSTED` signals after native retries.
- Backward compatibility for profiles that keep the current scalar `cli` and `model` fields.
- Medium-assurance validation, tests, documentation, and observable final behavior.

## Out of scope

- Falling back on authentication, configuration, permission, tool, interruption, cancellation, malformed-output, or otherwise unknown errors.
- Claude targets in version 1; the requested chain uses AGY and Pi provider targets.
- Model-consuming verification without separate explicit approval.
- Editing global profiles or settings during discovery.
- Dependencies, migrations, commits, pushes, or production actions.

## Confirmed facts and evidence

- `agents.ts` parses one profile-level `cli`, `model`, `thinking`, capability set, and provider-extension set. AGY currently rejects Pi-only fields such as `extensions`, skills, nesting, session mode, system prompt mode, and lifecycle controls.
- `prepareAgentLaunch()` selects one harness and one effective model. `launchSubagent()` has distinct AGY and Pi branches, and `watchSubagent()` currently emits one terminal result without fallback.
- AGY success requires a non-empty response and conversation ID. Its terminal error contract is text-bearing JSON without a repository-known typed quota category.
- Pi records terminal assistant `stopReason: "error"` and `errorMessage`. Pi already retries transient overload, rate-limit, server, and transport failures before settlement.
- Pi's installed retry classifier explicitly treats recognizable quota, budget, billing, and account usage limits as non-retryable terminal failures.
- Official AGY headless output provides `status`, `error`, stderr, and non-zero failure exit, but no typed quota category. Public AGY evidence consistently includes durable phrases such as `Individual quota reached` alongside `RESOURCE_EXHAUSTED` and 429.
- The installed Cursor provider preserves native error text and demonstrates that `resource_exhausted` can mean `Rate limit reached`; bare protocol codes and 429 therefore cannot safely mean durable usage exhaustion.
- Existing flat-profile `extensions` are full trusted grants whose tools become active. The user chose to preserve that meaning on Pi chain targets, accepting that generic extension grants can broaden behavior beyond read-only built-ins.
- Changing only the model cannot move an AGY process to a Cursor-backed Pi process. Cross-harness fallback must start a fresh process and replay the original task.
- Current resume registries point one runtime name to one Pi session or one AGY snapshot. A successful fallback will require a defined final ownership rule.

Evidence: `pi-extension/subagents/agents.ts`, `index.ts`, `agy.ts`, `session.ts`, `subagent-runtime-control.ts`; `docs/agent-definitions.md`; Pi extension and model documentation; installed Pi retry implementation; current global profile files; local model discovery.

## Constraints and invariants

- Preserve fail-closed harness-specific field validation. Unsupported parameters must not be silently ignored or passed to the wrong harness.
- Preserve one visible asynchronous subagent operation and one final parent delivery for the logical runtime name.
- Do not advance on an unknown error merely because the prior target failed.
- Provider-native retry behavior settles before the extension considers advancing.
- Preserve capability isolation and profile extension ordering for every Pi target.
- Preserve current scalar profile behavior when no chain is declared. Existing profiles require no migration, and the existing runtime `model` argument remains valid for them.
- Reject an explicit runtime `model` argument for a chained profile so one invocation cannot ambiguously rewrite only part of a validated chain.
- With `model-chain`, keep role identity, body, built-in tools, cwd, and visibility policy shared. Validate model, thinking, extensions, and Pi-only prompt/session settings on their individual targets.
- Reject harness-specific fields on a target whose `cli` does not support them rather than ignoring them.
- Version 1 chains limit shared built-ins to `read`, `grep`, `find`, and `ls`, with no skills or nested spawning.
- Target `extensions` retain the existing complete trusted grant, including any tools or hooks they register. The user accepts that generic extensions can broaden behavior; the motivating installed Cursor provider currently registers no Pi tools.
- Accept the trade-off that terminal bare 429 or resource-exhausted signals can advance during temporary throttling, particularly when an external harness has no observable native retry phase.

## Domain language

- **Target:** one ordered harness, provider/model, effort, and harness-specific configuration candidate.
- **Usage exhaustion:** a durable account quota, subscription allowance, budget, or billing limit, plus terminal bare 429 or resource-exhausted signals selected by the user. The broader signals can also represent temporary throttling.
- **Whole-task replay:** starting a fresh target with the original task and role prompt because AGY and Pi cannot share one conversation.
- **Chain success:** the first target that completes normally and becomes the runtime name's native resumable child.
- **Fresh continuation:** a new, self-contained `subagent` task created by the main agent after a resumed conversation later exhausts usage. It is not an automatic cross-provider transcript transfer.

The confirmed scout shape is:

```yaml
---
name: scout
description: Fast read-only codebase reconnaissance with exact paths and evidence
builtin-tools: [read, grep, find, ls]
model-chain:
  - cli: agy
    model: gemini-3.8-flash
    thinking: medium
  - cli: pi
    model: cursor/gemini-3.8-flash
    thinking: medium
    extensions:
      - package: git:github.com/GyroZepelix/pi-cursor-provider
        paths: [index.ts]
    session-mode: standalone
    system-prompt: append
  - cli: pi
    model: openai-codex/gpt-5.6-luna
    thinking: medium
    session-mode: standalone
    system-prompt: append
---

Shared scout Markdown body remains here.
```

`flash-reviewer` uses the same target order with its own description/body and `thinking: high`. Flat profiles continue to use their current top-level fields.

## Decision tree

1. Validate the complete ordered chain before pane creation.
2. Launch the first target.
3. On normal completion, deliver it and stop.
4. On recognized usage exhaustion, launch the next target with the original task.
5. On any other failure, deliver that failure and stop.
6. If every target is exhausted, deliver one aggregate terminal failure with bounded per-target evidence.
7. After success, `subagent_message` resumes only the winning target's native conversation. If that later continuation exhausts, report it to the main agent and stop; do not transfer context automatically.

## Confirmed decisions

| ID | Decision | Rationale | Evidence | Revisit when |
| --- | --- | --- | --- | --- |
| D01 | Use ordered inline targets in one profile. | Keeps one role prompt and tool policy while making harness/provider order explicit. | User decision, round 1. | Target-specific settings make the format unreasonably nested or ambiguous. |
| D02 | Advance only on the selected quota/resource-exhaustion category, not unrelated terminal failures. | Matches the requested provider-availability goal without hiding authentication, configuration, permission, cancellation, or unknown defects; D13 records the accepted ambiguity within the selected category. | User decision, rounds 1 and 5; provider evidence. | A provider cannot expose usable terminal evidence. |
| D03 | Use `openai-codex/gpt-5.6-luna` as the third example target. | It is a distinct provider after Cursor and is locally discoverable. | User decision, round 1; `pi --list-models`. | The example model or provider becomes unavailable. |
| D04 | Use medium assurance. | Cross-harness replay and persistence have meaningful regression cost, but the feature is local, opt-in, and reversible. | User decision, round 1. | Scope expands to broad mutating profiles or hardened crash recovery. |
| D05 | Put harness-specific parameters directly on each inline target and reject incompatible fields. | Pi-only settings remain expressible without being passed to or silently ignored by AGY; flat profiles remain unchanged. | User decision, round 2; current harness validators. | Repeated target fields make real profiles materially difficult to maintain. |
| D06 | Limit version 1 shared built-ins and nesting to read-only chains. | Fresh cross-harness execution can duplicate prior effects; this directly fits scout and flash-reviewer. Full target-extension risk is accepted separately in D14. | User decision, round 2; current profiles use only four read tools. | A concrete mutating role requires explicit replay semantics. |
| D07 | Keep flat non-chain profiles fully backward compatible. | The chain is additive and should not force unrelated profile migrations. | User decision, round 3. | A future intentional schema migration is separately approved. |
| D08 | Reject the existing runtime `model` override for chained profiles. | Ordinary calls already execute the configured chain; rejecting the ambiguous partial override keeps validation and provider selection explicit. | User decision, round 3. | A complete runtime target-chain API is requested later. |
| D09 | Show the active target and attempt in the widget, but send only one final parent result with fallback provenance. | Preserves fire-and-forget behavior without hiding which quota pool was used. | User decision, round 3. | Operational debugging requires intermediate parent wake-ups. |
| D10 | Apply automatic fallback only within a fresh `subagent` launch, not after a later `subagent_message` continuation exhausts. | The main agent should receive the exhaustion result and create a fresh, self-contained subagent rather than relying on lossy cross-provider context transfer. | User decision, round 4. | A concrete automatic conversation-handoff contract is requested. |
| D11 | Move forward only within a chain run; a new runtime starts again at target one. | Ordered fallback stays deterministic, while a fresh launch can benefit if an earlier provider's quota has reset. | User decision, round 4 and clarified fresh-runtime boundary. | Persistent provider cooldown or quota-state caching is requested. |
| D12 | Declaring `model-chain` owns autonomous completion and rejects interactive lifecycle settings. | The controller must observe settled success or failure to decide whether to stop or advance; repeated `auto-exit` boilerplate is unnecessary. | User decision, round 4; current AGY is one-shot and Pi otherwise may remain open. | Interactive chain orchestration is separately designed. |
| D13 | Treat terminal bare 429 and resource-exhausted signals as fallback triggers in addition to durable usage-limit phrases. | Maximizes provider switching when inference is unavailable, accepting that temporary throttling can consume fallback quota. | User decision, round 5; research shows these codes are ambiguous. | False-positive fallback becomes costly or disruptive. |
| D14 | Keep ordinary full-grant `extensions` semantics on Pi chain targets. | Avoids another field and preserves established meaning, while trusting configured extension code and its registered tools. | User decision, round 5; installed Cursor provider currently registers no Pi tools. | Structural read-only enforcement becomes more important than configuration simplicity. |
| D15 | Confirm the complete shared-understanding synthesis for To Spec. | Outcome, scope, risks, resume behavior, non-goals, and verification seams are sufficiently explicit for implementation planning. | User confirmation after round 5. | New evidence contradicts a confirmed contract. |

## Rejected alternatives

- Named fallback profiles were not selected because they duplicate role prompt and capability configuration.
- Global backend presets were not selected because they add another configuration surface before reuse is demonstrated.
- Broad fallback on any inference error was rejected for the initial contract.

## Open questions and prerequisites

No consequential question remains. Future provider wording drift is a non-blocking compatibility risk handled by fixtures and bounded diagnostics.

## Current frontier

The consequential frontier is empty and the user confirmed the shared-understanding synthesis.

## Research index

- [Research index](./research/index.md)
- [Quota-exhaustion signals](./research/quota-signals.md): official AGY contracts, observed AGY quota wording, installed Cursor provider behavior, installed Pi retry vocabulary, and read-only provider-extension implications.

## Proposed test seams and acceptance evidence

- Pure parser/validator tests for ordered targets, backward compatibility, field ownership, and invalid mixed-harness settings.
- Pure classifier fixtures for durable usage wording, bare 429/resource-exhausted triggers, and unrelated near-miss failures that must not advance.
- Injected launch/watch tests proving sequential order, one active attempt, original-task replay, stop-on-success, stop-on-unknown-error, and aggregate all-exhausted behavior.
- Registry tests proving only the winning native target is resumable, all-exhausted names fail clearly, and later native-resume exhaustion does not auto-transfer context.
- Rendering tests for current target, transitions, and final provenance.
- Full unit regression suite and package/documentation checks. Any real provider exhaustion test remains separately approval-gated and may be infeasible to induce safely.

## Proposed wiki updates after implementation

Update durable agent-profile and architecture guidance only after implementation and verification establish the final chain, replay, classifier, and resume contracts.

## Resume state

Round 1 confirmed inline targets, usage-exhaustion-only fallback, OpenAI Codex Luna as the third example provider, and medium assurance. Round 2 confirmed direct target-specific fields with fail-closed harness validation and read-only-only chains. Round 3 confirmed flat-profile compatibility, rejection of explicit runtime model overrides for chained profiles, and widget-plus-final visibility. Round 4 rejected automatic fallback after a later native resume exhausts: report to the main agent, which may create a fresh self-contained subagent. Each fresh chain starts at target one and advances only forward, and `model-chain` owns autonomous exit behavior. Round 5 broadened fallback to terminal bare 429/resource-exhausted signals and retained full extension-grant semantics, explicitly accepting temporary-throttle and extension-capability risks.

Exact next action: run `/skill:to-spec 260926-1248-configurable-model-fallback` to create the canonical implementation plan.

## Readiness for To Spec

- [x] Every consequential branch is resolved or explicitly out of scope.
- [x] Facts are distinguished from user decisions and hypotheses.
- [x] Requirements, constraints, and non-goals are clear.
- [x] Acceptance evidence and proposed test seams are defined.
- [x] The user confirmed shared understanding.
