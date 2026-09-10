# Built-in and extension tool activation

Status: Complete
Source date: 2026-09-09
Question: Can a subagent select built-in tools separately while automatically activating every tool provided by explicitly loaded extensions?

## Findings

1. Pi already implements the desired extension-tool default. When no strict `tools` option is supplied, `AgentSession` builds its registry with `includeAllExtensionTools: true`, activating all tools registered by loaded extensions.
2. Pi's `--no-builtin-tools` mode sets the initial built-in active list to empty without creating a strict all-tool allowlist. Explicitly loaded extensions therefore remain active.
3. Selected built-ins can be added during `session_start` with `pi.setActiveTools()`. All built-in definitions remain in the registry even when initially inactive, and no model request occurs before `session_start` completes.
4. The subagent child-control extension can perform this activation from a snapshotted environment value or launch artifact, avoiding a new general Pi CLI flag. The parent can validate `builtin-tools` against the fixed built-in set before pane creation.
5. Tools registered dynamically after startup are added automatically when no strict `allowedToolNames` set exists. This naturally gives the child later tools from its loaded extensions, matching an "all extension tools" grant.
6. The launch can remain isolated: `--no-extensions` disables global discovery, explicit `-e` arguments load only resolved profile extensions and required child-control extensions, and `--no-builtin-tools` disables the default built-in active set.
7. This design is simpler than discovering every extension tool in the parent and constructing a strict `--tools` union. It also supports context-dependent and dynamic tool registration without a parent-child inventory mismatch.
8. The security boundary changes meaning. A loaded extension runs arbitrary code and can register event handlers, override built-in tool names, call `pi.setActiveTools()`, or access the operating system directly. `builtin-tools` controls the child's initial model-callable Pi built-ins, but it cannot sandbox a trusted extension. This limitation already follows from Pi's extension model and must be explicit.
9. If an extension registers a tool with a built-in name, Pi's registry gives the extension definition precedence for that name. Because all extension tools are active, the override becomes callable even when the corresponding name is absent from `builtin-tools` unless the subagent runtime explicitly rejects such overrides.
10. Duplicate custom tool names are resolved by extension load order in Pi's registry. Automatic all-tool activation therefore needs either deterministic documented precedence or profile validation that rejects collisions.

## Recommended launch shape

```text
pi --no-extensions --no-builtin-tools \
  -e <required-child-control-extension> \
  -e <resolved-profile-extension-1> \
  -e <resolved-profile-extension-2> ...
```

Before the first model request, the child-control extension activates the validated `builtin-tools` names while preserving every currently active extension tool. Dynamic tools registered later remain automatically activated by Pi.

## Recommendation

Adopt automatic activation of all tools from declared extensions. It is a direct fit for Pi's existing non-strict activation mode and is easier than parent-side tool enumeration. Treat the complete extension module as trusted executable capability. Explicitly decide built-in-name override and duplicate custom-tool collision policy before implementation.

## Evidence

- `/Users/dgjalic/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/docs/settings.md:226-244`
- `/Users/dgjalic/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/docs/usage.md:208-215`
- `/Users/dgjalic/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`, especially extension security, `getAllTools`, `setActiveTools`, overriding built-ins, multiple tools, and dynamic tool loading
- `/Users/dgjalic/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/dist/core/sdk.js:139-165`
- `/Users/dgjalic/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js:2105-2171`
- `pi-extension/subagents/index.ts:795-818,999-1006`
