# Upstream Pi 1.0 MCP and codemode seams

Status: Complete
Source date: 2026-11-16

## Question

How can a restricted child Pi process expose only MCP servers named by its profile while retaining normal model/provider settings and credentials?

## Confirmed upstream behavior

- Pi 1.0 treats `codemode`, `tool-search`, and `mcp` as built-in extensions. `--no-extensions` disables them, while explicit `-e builtin:<name>` reloads an individual built-in.
- Pi 1.0 has no CLI server include/exclude option and no MCP-only config-path override. Tool allow/deny flags operate after server selection and do not prevent server connection.
- `codemode` and `tool_search` are registered inactive. The MCP extension activates the required mechanism based on each enabled server's configured exposure: `codemode`, `deferred`, `direct`, or `hidden`.
- The default MCP extension loads all enabled servers from `<agent-dir>/mcp.json` plus trusted-project `.pi/mcp.json`. Project entries replace global entries of the same name.
- Each enabled returned server starts connecting during `session_start`. Indirect servers are named in the `mcp_servers` system-prompt section. Blocking their tool calls after startup would therefore be too late for a strict server allowlist.
- `unregisterMcpServer(name)` removes only a server registered by the calling extension. It cannot remove a server loaded from `mcp.json`.
- `PI_CODING_AGENT_DIR` selects settings, model configuration, provider auth, MCP config, MCP OAuth defaults, instructions, and resources together. A minimal alternate directory would disturb unrelated child behavior.
- Pi exports `createMcpExtension(options)`. Its `loadConfig(ctx)` option can replace ambient file loading with an explicitly filtered `LoadedMcpConfig` before any connection starts.
- Pi also validates session-only registrations made through `pi.registerMcpServer()`. A package-owned wrapper can run `createMcpExtension` with an empty file loader, register only selected server configs, and let the MCP extension's `mcp_servers_change` path connect them. Such registrations are session-scoped, so `/mcp` exposure/enable changes do not rewrite the user's source file.
- `createMcpExtension` retains its default credential store and provider-token integration when only `loadConfig` changes. OAuth remains keyed by server name and URL in the ordinary agent directory, and provider-backed auth uses the child model registry.
- Pi's server-config validator is not exported from the package root. `registerMcpServer()` does perform public runtime validation. Pre-pane validation and listing diagnostics therefore need either a package-owned documented-shape validator or a deliberately later child-start failure; the latter conflicts with this repository's established fail-before-pane capability pattern.

## Viable architecture

Recommended direction:

1. Resolve exact named entries during trusted profile discovery. The user selected Pi's ordinary active-context merge for every profile: a trusted project entry overrides the same global name, otherwise the global entry is used.
2. Persist only server identity and exact source-file identity in the loadout, not config values or resolved credentials.
3. Load a protected package-owned child MCP control instead of `builtin:mcp`. It runs Pi's exported `createMcpExtension` with ambient file loading disabled and supplies only the snapshotted selections.
4. Explicitly load `builtin:codemode` and `builtin:tool-search` when MCP is granted; load only `builtin:codemode` for a standalone codemode grant.
5. Preserve each allowed server's configured exposure and let Pi activate codemode or tool search accordingly.
6. Re-read only the exact selected source entries on resume. Missing or invalid entries fail closed; whether same-path config changes are accepted remains a user decision.

This avoids connecting, registering, listing, or prompting about ambient unselected file-configured servers and avoids copying credentials or literal header values into session artifacts.

A public-factory caveat remains: `createMcpExtension` also consumes MCP servers registered by other loaded extensions. The repository already treats declared profile extensions as trusted arbitrary code, so discovery must explicitly decide whether `mcp-servers` constrains only ambient file configuration or whether combining MCP grants with profile extensions requires a stricter custom adapter.

## Security implications

- An allowed MCP server is a complete server-level grant. Its tools and resources may perform destructive actions, start a local process, access the network, or use credentials according to its configuration.
- `codemode` is sandboxed from direct Node, filesystem, network, modules, and timers, but can invoke every tool callable through its loadout and can use documented classifier/image-model operations.
- A child with `bash` already has broad subprocess and network authority. MCP isolation still matters for read-only profiles and for preventing accidental prompt/tool expansion.
- Initial resolution uses the active trusted spawn context. Resume must use the snapshotted exact source path and digest rather than re-resolving against the current project or a broader fallback.

## Sources

- [Pi v0.99.0 release](https://github.com/earendil-works/pi/releases/tag/v0.99.0)
- [Pi v0.99.2 release](https://github.com/earendil-works/pi/releases/tag/v0.99.2)
- [Pi v1.0.0 release](https://github.com/earendil-works/pi/releases/tag/v1.0.0)
- [Pi 1.0 MCP documentation](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/docs/mcp.md)
- [Pi 1.0 codemode documentation](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/docs/codemode.md)
- [Pi 1.0 extension documentation](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/docs/extensions.md)
- [Pi 1.0 MCP extension source](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/src/extensions/mcp/index.ts)
- [Pi 1.0 MCP config source](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/src/extensions/mcp/config.ts)
- [Pi 1.0 extension API declarations](https://github.com/earendil-works/pi/blob/v1.0.0/packages/coding-agent/src/core/extensions/types.ts)
