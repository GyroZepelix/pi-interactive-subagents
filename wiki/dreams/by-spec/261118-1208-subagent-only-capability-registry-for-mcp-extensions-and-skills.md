# Dream learnings: 261118-1208-subagent-only-capability-registry-for-mcp-extensions-and-skills

Work item: `261118-1208-subagent-only-capability-registry-for-mcp-extensions-and-skills`

> Historical snapshot: this ledger records what Dream retained at each Gamemaster checkpoint. Current source, plans, verification, outcomes, and current dynamic destinations remain authoritative.

<!-- dream-checkpoints:start -->

## Gamemaster checkpoint: 261118-1208-subagent-only-capability-registry-for-mcp-extensions-and-skills/direct

Date: 2026-11-18
Dream log: [2026-11-18-1326-gamemaster-checkpoint-261118-1208-subagent-only-capability-registry-for-mcp-exte.md](../2026-11-18-1326-gamemaster-checkpoint-261118-1208-subagent-only-capability-registry-for-mcp-exte.md)
Outcome: retained learning

### Seeded MCP OAuth store key shape in capability fixtures

- **Exact written text:**

````markdown
- `test/integration/mcp-capability.test.ts` starts isolated Pi SDK sessions without prompting a model. Its local stdio/HTTP fixtures prove selected-versus-ambient MCP process isolation, direct/indirect/hidden exposure, resources, prompt metadata, native failure diagnostics, credential-safe capability state, and process cleanup, plus registry-sourced servers and shared OAuth-store lookup. Seeded `<agentDir>/mcp-auth.json` keys must be `mcp__<server name with - as _>|<normalized URL>`, independent of which `mcp.json` defined the server; a plain server-name key is ignored and the request goes out unauthenticated (`test/integration/mcp-capability.test.ts`, Pi `extensions/mcp/oauth.js` `storeKeys`).
````

- **Destination and classification:** `wiki/development.md` - `Topic-specific dynamic knowledge` - `MERGE`
- **Closest existing guidance:** `wiki/development.md:15` "Safe non-model check using disposable config, credential, marker, HTTP, and stdio fixtures; never use real user MCP files." - names credential fixtures but not the key shape Pi requires or registry coverage.
- **Admission basis:** `observed failure prevention`
- **Session evidence or selection reason:** The first registry OAuth integration run failed because the seeded key lacked Pi's `mcp__<namespace>|<url>` shape, so the request went out without a token; Pi `oauth.js` `storeKeys` confirmed the format and the corrected test passed.
- **Expected future benefit:** Future credential or registry MCP fixture work seeds the store correctly on the first attempt and knows the store is scope-independent.
- **Why this tier:** Stable Pi contract the repository's integration fixtures depend on; narrow to the test organization bullet that already describes this suite, so a one-clause merge fits rather than a new page or observation.
