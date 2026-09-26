# Quota-exhaustion signal research

Date: 2026-09-26
Status: Sufficient for a conservative design decision

## Question

Can AGY, Cursor-backed Pi, and OpenAI Codex-backed Pi distinguish durable account usage exhaustion from transient rate limits and unrelated inference failures well enough to trigger automatic fallback?

## Findings

### AGY

- AGY headless JSON has a stable terminal envelope with `status` and failure `error`; failures also go to stderr and exit non-zero. The official contract does not define typed quota subcategories.
- AGY exposes interactive `/usage` and `/quota` views, but the requested fallback occurs after a real attempt fails. Adding a separate quota preflight would introduce another external call and parser surface and is not required.
- Public issue evidence shows concrete durable-quota wording such as `RESOURCE_EXHAUSTED (code 429): Individual quota reached... Resets in ...` and `Individual quota reached. Please upgrade your subscription... Resets in ...`.
- `RESOURCE_EXHAUSTED` or `429` alone is not sufficient evidence of durable usage exhaustion because those categories can also represent transient throttling.

Implication: inspect the strict AGY envelope `error` plus bounded stderr, but advance only when durable quota wording is present. Do not classify malformed output, bare status codes, timeouts, authentication failures, permission denials, unknown models, or generic `RESOURCE_EXHAUSTED` as usage exhaustion.

### Cursor provider through Pi

- The installed Cursor provider preserves Cursor's display message and Connect code. It intentionally does not rewrite new upstream wording.
- `resource_exhausted` is an upstream code, but the provider's own regression fixture demonstrates `resource_exhausted` with `Rate limit reached`; the code is therefore not a durable-quota discriminator.
- Provider-native retryability and Pi's retry loop already handle recognized transient rate limits, overload, server errors, and transport failures before final settlement.

Implication: classify the final Pi assistant `errorMessage` conservatively. Do not advance for bare `resource_exhausted`, `429`, or `rate limit` text.

### Pi and OpenAI Codex

- The installed Pi retry classifier explicitly excludes durable quota/budget/billing wording from transient retry, including `insufficient_quota`, `out of budget`, `quota exceeded`, `billing`, `Monthly usage limit reached`, and free/subscription usage-limit types.
- Pi retries transient `rate limit`, `429`, overload, 5xx, and transport patterns before settlement.

Implication: the fallback classifier can align with Pi's durable-limit vocabulary while remaining narrower than Pi's transient retry vocabulary.

## Recommended normalized contract

Classify a terminal inference failure as `usage_exhausted` only when its normalized, bounded error text contains a durable account-limit signal such as:

- `individual quota reached`
- `quota exceeded` or an unambiguously equivalent `quota ... reached/exhausted`
- `usage limit reached/exceeded/exhausted`
- `monthly` or `weekly` usage limit reached
- `insufficient_quota`
- `out of budget`
- explicit exhausted credits or billing-limit wording

Require meaningful words, not a bare number or protocol code. Explicitly reject as insufficient by themselves:

- `429`
- `RESOURCE_EXHAUSTED`
- `resource_exhausted`
- `rate limit`
- `too many requests`
- overload, 5xx, timeout, network, authentication, permission, invalid model, cancellation, interruption, malformed output, or unknown errors

Keep this classifier pure and fixture-driven. Preserve a bounded original reason in the final provenance. If a real provider emits new durable-quota wording that does not match, fail closed and add a source-backed fixture rather than broadening to arbitrary errors.

## Capability implication for read-only chains

A Cursor target must load its provider extension because child Pi launches disable ambient extensions. Existing flat-profile `extensions` semantics grant complete extension behavior and activate registered tools. A read-only chain therefore needs an explicit provider-loading field or an equivalent rule that does not activate extension tools. Reusing ordinary `extensions` with different semantics would be surprising.

Recommended shape: target-local `provider-extensions` using the existing package selector mapping. These remain trusted executable code, but tools they register are not added to the active model-callable set. The protected final capability activation must reassert the shared read-only built-ins and framework control before provider requests.

## User decision after research

The user chose a broader contract than the research recommendation:

- terminal bare 429 and `RESOURCE_EXHAUSTED`/`resource_exhausted` also advance the chain, accepting possible temporary-throttle false positives;
- target `extensions` keep their ordinary full trusted grant, accepting that extensions other than the currently inspected Cursor provider may register broader tools or behavior.

The discovery dossier records these choices as D13 and D14 and is authoritative for planning.

## Sources

- [AGY headless JSON, statuses, errors, and exit codes](https://antigravity.google/docs/cli/headless/)
- [AGY model quota panel](https://antigravity.google/docs/cli/commands/usage)
- [AGY issue #234, concrete `Individual quota reached` wording](https://github.com/google-antigravity/antigravity-cli/issues/234)
- [AGY issue #966, concrete rolling-quota wording and fallback request](https://github.com/google-antigravity/antigravity-cli/issues/966)
- Installed Cursor provider: `/Users/dgjalic/.pi/agent/git/github.com/GyroZepelix/pi-cursor-provider/cursor-errors.ts`
- Installed Cursor provider tests: `/Users/dgjalic/.pi/agent/git/github.com/GyroZepelix/pi-cursor-provider/errors.test.ts`
- Installed Pi retry classifier: `/Users/dgjalic/.bun/install/global/node_modules/@earendil-works/pi-ai/dist/utils/retry.js`
