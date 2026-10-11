import {
  createMcpExtension,
  type ExtensionAPI,
  type LoadedMcpConfig,
} from "@earendil-works/pi-coding-agent";
import { verifyMcpServerReferences } from "./mcp-config.ts";
import {
  parseMcpServerReferences,
  SUBAGENT_CAPABILITY_VERSION_ENV,
  SUBAGENT_MCP_REFERENCES_ENV,
} from "./subagent-protocol.ts";

const EMPTY_MCP_CONFIG: LoadedMcpConfig = {
  servers: [],
  errors: [],
};

/**
 * Protected child-only MCP control. It never asks Pi to discover ambient files:
 * only exact, digest-pinned entries from the parent capability channel are registered.
 */
export default function (pi: ExtensionAPI) {
  if (process.env[SUBAGENT_CAPABILITY_VERSION_ENV] !== "2") {
    throw new Error("Filtered MCP control requires capability protocol version 2");
  }
  const references = parseMcpServerReferences(process.env[SUBAGENT_MCP_REFERENCES_ENV]);
  if (!references || references.length === 0) {
    throw new Error("Filtered MCP control requires a non-empty canonical capability reference set");
  }

  const verified = verifyMcpServerReferences(references);
  if ("errors" in verified) {
    throw new Error(`Filtered MCP capability preflight failed: ${verified.errors.join("; ")}`);
  }

  for (const server of verified.servers) {
    pi.registerMcpServer(server.name, server.config);
  }

  return createMcpExtension({
    loadConfig: () => EMPTY_MCP_CONFIG,
  })(pi);
}
