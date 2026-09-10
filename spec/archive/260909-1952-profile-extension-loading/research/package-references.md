# Installed package extension references

Status: Complete
Source date: 2026-09-09
Question: How difficult and robust would it be for an agent profile to reference already-installed Pi package extensions instead of local entrypoint paths?

## Findings

1. Pi exposes the required package-resolution building blocks. `DefaultPackageManager`, `SettingsManager`, `ResolvedPaths`, and `ResolvedResource` are exported. `DefaultPackageManager.resolve()` returns enabled extension resources with absolute paths and metadata containing the configured package source, scope, origin, and package base directory.
2. Resolution can be kept read-only. Calling `resolve(onMissing)` with an `error` or `skip` result prevents missing npm or git sources from being installed. By contrast, `resolveExtensionSources()` has no missing-source callback and installs missing package sources by default, so it is unsuitable for fail-closed spawn-time lookup.
3. Matching an exact configured package source is moderate work. The runtime can load trusted global/project settings, resolve installed resources, match `ResolvedResource.metadata.source`, and retain the resulting absolute paths in the existing loadout snapshot.
4. A package is not the same as an extension. One package can expose several extension entrypoints. The installed `rpiv-mono-selfhost-firecrawl` package exposes both web-tools and ask-user-question entrypoints, so a package-only reference would grant more extension code than the desired web-tools selection.
5. Pi does not define stable logical names for individual extension entrypoints. Resource identity is path-based, with package provenance in `sourceInfo`. Selecting one entrypoint from a multi-extension package therefore needs either an explicit package-relative resource path or a new alias system.
6. A structured package reference is feasible without hardcoding the installation root, for example a configured package source plus a package-relative extension path. The resolver can verify that the selected resource is enabled by the package manifest/settings filters and belongs to that package.
7. Friendly shorthand such as `rpiv-web-tools` would be substantially harder and less deterministic because Pi currently has no extension-name registry. It would require a new naming, collision, precedence, and migration contract.

## Difficulty assessment

- Local entrypoint strings: low complexity, but brittle when Pi moves installed package directories.
- Exact configured package source loading all enabled extension resources: medium complexity, but too broad for multi-extension packages.
- Configured package source plus package-relative resource selector: medium complexity and the strongest initial package-aware design.
- New friendly extension aliases independent of package paths: high complexity and not recommended for the first version.

## Recommendation

Support structured references to already-configured packages, selecting an exact enabled extension resource within the package. Keep local path references as a secondary form for user-authored standalone extensions. Never install, update, or persist a package during subagent discovery or spawn.

Illustrative shape:

```yaml
extensions:
  - package: git:git@github.com:GyroZepelix/rpiv-mono-selfhost-firecrawl@main
    path: packages/rpiv-web-tools/index.ts
  - package: git:git@github.com:tejesh0/pi-codex-search@pi_latest_compat
    path: index.ts
```

The exact configured source strings and whether `path` can be omitted for single-extension packages remain product decisions.

## Evidence

- `/Users/dgjalic/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/docs/packages.md`
- `/Users/dgjalic/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`
- `/Users/dgjalic/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/dist/core/package-manager.d.ts`
- `/Users/dgjalic/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/dist/core/package-manager.js:680-738,981-1035`
- `/Users/dgjalic/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/dist/core/source-info.d.ts`
- `/Users/dgjalic/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
- `/Users/dgjalic/.pi/agent/settings.json`
- `/Users/dgjalic/.pi/agent/git/github.com/GyroZepelix/rpiv-mono-selfhost-firecrawl/package.json`
