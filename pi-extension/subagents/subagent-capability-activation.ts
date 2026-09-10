import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { SUBAGENT_BUILTIN_TOOLS_ENV } from "./subagent-protocol.ts";

export { SUBAGENT_BUILTIN_TOOLS_ENV } from "./subagent-protocol.ts";

const PROFILE_BUILTIN_TOOLS = new Set([
  "read",
  "write",
  "edit",
  "bash",
  "powershell",
  "grep",
  "find",
  "ls",
]);

interface AvailableTool {
  name: string;
  sourceInfo?: { source?: string };
}

/**
 * Resolve the initial active tool names for a profile-capability child.
 * Undefined preserves launches that do not opt into this private protocol.
 * Malformed private input fails closed to extension tools only.
 */
export function resolveProfileActiveTools(
  rawBuiltinTools: string | undefined,
  availableTools: readonly AvailableTool[],
): string[] | null {
  if (rawBuiltinTools === undefined) return null;

  const requested = rawBuiltinTools === "" ? [] : rawBuiltinTools.split(",");
  const validRequest =
    requested.every((name) => PROFILE_BUILTIN_TOOLS.has(name)) &&
    new Set(requested).size === requested.length;
  const selectedBuiltins = validRequest ? requested : [];
  const extensionTools = availableTools
    .filter((tool) => tool.sourceInfo?.source !== "builtin")
    .map((tool) => tool.name)
    .filter(Boolean);

  return [...new Set([...selectedBuiltins, ...extensionTools])];
}

/**
 * Child-only activation control. The launcher places this extension after all
 * profile extensions so each checkpoint observes registrations made by their
 * handlers in the same event. It registers no tools and therefore cannot win
 * a tool-name collision.
 */
export default function (pi: ExtensionAPI) {
  let profileActivationEnabled = false;
  let observedToolSources = new Map<string, string | undefined>();

  function rememberToolSources(tools: readonly AvailableTool[]) {
    observedToolSources = new Map(
      tools.map((tool) => [tool.name, tool.sourceInfo?.source]),
    );
  }

  function activateInitialProfileTools() {
    const tools = pi.getAllTools();
    const requestedActiveTools = resolveProfileActiveTools(
      process.env[SUBAGENT_BUILTIN_TOOLS_ENV],
      tools,
    );
    profileActivationEnabled = requestedActiveTools !== null;
    rememberToolSources(tools);
    if (requestedActiveTools !== null) {
      pi.setActiveTools(requestedActiveTools);
    }
  }

  function activateNewProfileExtensionTools() {
    if (!profileActivationEnabled) return;
    const tools = pi.getAllTools();
    const activeTools = pi.getActiveTools();
    const active = new Set(activeTools);
    const additions = tools
      .filter((tool) => {
        if (tool.sourceInfo?.source === "builtin" || active.has(tool.name)) return false;
        const previousSource = observedToolSources.get(tool.name);
        return previousSource === undefined || previousSource === "builtin";
      })
      .map((tool) => tool.name);

    rememberToolSources(tools);
    if (additions.length > 0) {
      pi.setActiveTools([...new Set([...activeTools, ...additions])]);
    }
  }

  pi.on("session_start", activateInitialProfileTools);
  pi.on("resources_discover", activateNewProfileExtensionTools);
  pi.on("input", activateNewProfileExtensionTools);
  pi.on("before_agent_start", activateNewProfileExtensionTools);
  pi.on("agent_start", activateNewProfileExtensionTools);
  pi.on("turn_start", activateNewProfileExtensionTools);
  pi.on("context", activateNewProfileExtensionTools);
  pi.on("message_end", activateNewProfileExtensionTools);
  pi.on("tool_call", activateNewProfileExtensionTools);
  pi.on("tool_result", activateNewProfileExtensionTools);
  pi.on("tool_execution_end", activateNewProfileExtensionTools);
  pi.on("turn_end", activateNewProfileExtensionTools);
  pi.on("before_provider_request", activateNewProfileExtensionTools);
  pi.on("after_provider_response", activateNewProfileExtensionTools);
}
