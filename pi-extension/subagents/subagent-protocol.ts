import {
  areCanonicalMcpServerReferences,
  type McpServerReference,
} from "./mcp-config.ts";

/** Private environment keys shared by the parent launcher and child controls. */
export const SUBAGENT_BUILTIN_TOOLS_ENV = "PI_SUBAGENT_BUILTIN_TOOLS";
export const SUBAGENT_CAPABILITY_VERSION_ENV = "PI_SUBAGENT_CAPABILITY_VERSION";
export const SUBAGENT_MCP_REFERENCES_ENV = "PI_SUBAGENT_MCP_REFERENCES";
export const SUBAGENT_MCP_SUPPORT_TOOLS_ENV = "PI_SUBAGENT_MCP_SUPPORT_TOOLS";
export const SUBAGENT_MODEL_CHAIN_ENV = "PI_SUBAGENT_MODEL_CHAIN";

export function encodeMcpServerReferences(references: readonly McpServerReference[]): string {
  return JSON.stringify(references);
}

export function parseMcpServerReferences(raw: string | undefined): McpServerReference[] | null {
  if (raw === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return areCanonicalMcpServerReferences(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
