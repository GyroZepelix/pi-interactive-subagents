import {
  CONFIG_DIR_NAME,
  getAgentDir,
  type McpServerConfig,
} from "@earendil-works/pi-coding-agent";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";

export type McpConfigScope = "global" | "project";
export type McpSupportTool = "codemode" | "tool-search";

export interface McpServerReference {
  name: string;
  source: string;
  scope: McpConfigScope;
  digest: string;
}

export interface McpCapabilityResolution {
  serverReferences: McpServerReference[];
  supportTools: McpSupportTool[];
}

export interface McpConfigCatalogOptions {
  cwd: string;
  projectTrusted: boolean;
  agentDir?: string;
}

type JsonRecord = Record<string, unknown>;
type ConfigSource = {
  path: string;
  scope: McpConfigScope;
  entries: JsonRecord | null;
  error?: string;
};

export interface McpConfigCatalog {
  global: ConfigSource;
  project: ConfigSource | null;
}

type NormalizedServerConfig = Record<string, unknown>;

type ValidationResult =
  | { config: McpServerConfig; normalized: NormalizedServerConfig }
  | { error: string };

const SERVER_NAME = /^[A-Za-z0-9_-]+$/;
const EXPOSURES = new Set(["codemode", "deferred", "direct", "hidden"]);
const BASE_FIELDS = new Set([
  "type",
  "exposure",
  "description",
  "toolExposure",
  "enabled",
  "timeout",
]);
const STDIO_FIELDS = new Set([...BASE_FIELDS, "command", "args", "env", "cwd"]);
const HTTP_FIELDS = new Set([...BASE_FIELDS, "url", "headers", "oauth", "auth"]);
const OAUTH_FIELDS = new Set([
  "clientId",
  "clientSecret",
  "callbackPort",
  "callbackUrl",
  "scope",
  "clientName",
  "clientRegistration",
  "authServerMetadataUrl",
]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortedRecord(value: JsonRecord): JsonRecord {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function stringRecord(value: unknown, field: string): { value: Record<string, string> } | { error: string } {
  if (!isRecord(value) || !Object.values(value).every((entry) => typeof entry === "string")) {
    return { error: `${field} must map names to strings` };
  }
  return { value: sortedRecord(value) as Record<string, string> };
}

function exposure(value: unknown, field: string): string | { error: string } {
  const normalized = value === "codemode-deferred" ? "codemode" : value;
  if (typeof normalized !== "string" || !EXPOSURES.has(normalized)) {
    return { error: `${field} must be one of: codemode, deferred, direct, hidden` };
  }
  return normalized;
}

function validateCommon(
  name: string,
  value: JsonRecord,
): { config: JsonRecord; normalized: NormalizedServerConfig } | { error: string } {
  const resolvedExposure = value.exposure === undefined
    ? "codemode"
    : exposure(value.exposure, "exposure");
  if (typeof resolvedExposure !== "string") return resolvedExposure;

  const normalizedToolExposure: Record<string, string> = {};
  if (value.toolExposure !== undefined) {
    if (!isRecord(value.toolExposure)) {
      return { error: "toolExposure must map tool names or patterns to exposures" };
    }
    for (const [tool, rawExposure] of Object.entries(value.toolExposure)) {
      const resolved = exposure(rawExposure, `toolExposure.${tool}`);
      if (typeof resolved !== "string") return resolved;
      normalizedToolExposure[tool] = resolved;
    }
  }

  if (value.enabled !== undefined && typeof value.enabled !== "boolean") {
    return { error: "enabled must be a boolean" };
  }
  if (value.description !== undefined && typeof value.description !== "string") {
    return { error: "description must be a string" };
  }
  if (
    value.timeout !== undefined &&
    (typeof value.timeout !== "number" || !Number.isFinite(value.timeout) || value.timeout <= 0)
  ) {
    return { error: "timeout must be a positive finite number of seconds" };
  }

  const config: JsonRecord = {
    ...(value.exposure === undefined ? {} : { exposure: resolvedExposure }),
    ...(value.description === undefined ? {} : { description: value.description }),
    ...(value.toolExposure === undefined ? {} : { toolExposure: normalizedToolExposure }),
    ...(value.enabled === undefined ? {} : { enabled: value.enabled }),
    ...(value.timeout === undefined ? {} : { timeout: value.timeout }),
  };
  const normalized: NormalizedServerConfig = {
    exposure: resolvedExposure,
    enabled: value.enabled ?? true,
    timeout: value.timeout ?? 60,
    ...(value.description === undefined ? {} : { description: value.description }),
    toolExposure: normalizedToolExposure,
  };
  return { config, normalized };
}

function validateOAuth(value: unknown): { config: JsonRecord; normalized: JsonRecord } | { error: string } {
  if (!isRecord(value)) return { error: "oauth must be an object" };
  const unsupported = Object.keys(value).find((key) => !OAUTH_FIELDS.has(key));
  if (unsupported) return { error: `oauth.${unsupported} is not a supported field` };

  for (const field of ["clientId", "clientSecret", "callbackUrl", "scope", "clientName", "authServerMetadataUrl"] as const) {
    if (value[field] !== undefined && typeof value[field] !== "string") {
      return { error: `oauth.${field} must be a string` };
    }
  }
  if (typeof value.clientName === "string" && !value.clientName.trim()) {
    return { error: "oauth.clientName must be a non-empty string" };
  }
  if (
    value.callbackPort !== undefined &&
    (typeof value.callbackPort !== "number" ||
      !Number.isInteger(value.callbackPort) ||
      value.callbackPort < 1 ||
      value.callbackPort > 65535)
  ) {
    return { error: "oauth.callbackPort must be a port number" };
  }

  let callback: URL | undefined;
  if (typeof value.callbackUrl === "string") {
    try {
      callback = new URL(value.callbackUrl);
    } catch {
      return { error: "oauth.callbackUrl must be an HTTP loopback URI without query or fragment" };
    }
    if (
      callback.protocol !== "http:" ||
      !LOOPBACK_HOSTS.has(callback.hostname) ||
      callback.search !== "" ||
      callback.hash !== ""
    ) {
      return { error: "oauth.callbackUrl must be an HTTP loopback URI without query or fragment" };
    }
    if (
      callback.port &&
      typeof value.callbackPort === "number" &&
      Number(callback.port) !== value.callbackPort
    ) {
      return { error: "oauth.callbackUrl and oauth.callbackPort name different ports" };
    }
  }

  const registration = value.clientRegistration ?? "dcr";
  if (registration !== "dcr" && registration !== "cimd") {
    return { error: 'oauth.clientRegistration must be "dcr" or "cimd"' };
  }
  if (registration === "cimd") {
    if (value.clientId !== undefined || value.clientName !== undefined) {
      return { error: 'oauth.clientRegistration "cimd" cannot be combined with clientId or clientName' };
    }
    if (callback && (callback.hostname === "[::1]" || callback.pathname !== "/callback")) {
      return { error: 'oauth.clientRegistration "cimd" requires a localhost or 127.0.0.1 /callback URL' };
    }
  }

  if (typeof value.authServerMetadataUrl === "string") {
    let metadataUrl: URL;
    try {
      metadataUrl = new URL(value.authServerMetadataUrl);
    } catch {
      return { error: "oauth.authServerMetadataUrl must be an HTTPS URL or loopback HTTP URL" };
    }
    if (
      metadataUrl.protocol !== "https:" &&
      !(metadataUrl.protocol === "http:" && LOOPBACK_HOSTS.has(metadataUrl.hostname))
    ) {
      return { error: "oauth.authServerMetadataUrl must be an HTTPS URL or loopback HTTP URL" };
    }
  }

  const config: JsonRecord = { ...value };
  const normalized: JsonRecord = {
    ...(value.clientId === undefined ? {} : { clientId: value.clientId }),
    ...(value.clientSecret === undefined ? {} : { clientSecret: value.clientSecret }),
    ...(value.callbackPort === undefined ? {} : { callbackPort: value.callbackPort }),
    ...(value.callbackUrl === undefined ? {} : { callbackUrl: value.callbackUrl }),
    ...(value.scope === undefined ? {} : { scope: value.scope }),
    ...(value.clientName === undefined || value.clientName === "pi" ? {} : { clientName: value.clientName }),
    ...(registration === "dcr" ? {} : { clientRegistration: registration }),
    ...(value.authServerMetadataUrl === undefined
      ? {}
      : { authServerMetadataUrl: value.authServerMetadataUrl }),
  };
  return { config, normalized };
}

/** Validate the documented Pi MCP entry without resolving env/command expressions or credentials. */
export function validateAndNormalizeMcpServerConfig(
  name: string,
  raw: unknown,
  scope: McpConfigScope,
): ValidationResult {
  if (!SERVER_NAME.test(name)) {
    return { error: "name must contain only letters, digits, '_' and '-'" };
  }
  if (!isRecord(raw)) return { error: "entry must be an object" };

  const common = validateCommon(name, raw);
  if ("error" in common) return common;

  const http = typeof raw.url === "string" &&
    (raw.type === undefined || raw.type === "http" || raw.type === "streamable-http");
  const stdio = typeof raw.command === "string" &&
    (raw.type === undefined || raw.type === "stdio");
  if (!http && !stdio) {
    if (raw.type === "sse") return { error: "legacy SSE transport is not supported" };
    return { error: 'entry needs "command" (stdio) or "url" (streamable HTTP)' };
  }

  const allowed = http ? HTTP_FIELDS : STDIO_FIELDS;
  const unsupported = Object.keys(raw).find((key) => !allowed.has(key));
  if (unsupported) return { error: `${unsupported} is not supported for this transport` };

  if (stdio) {
    if (raw.args !== undefined && (!Array.isArray(raw.args) || !raw.args.every((arg) => typeof arg === "string"))) {
      return { error: "args must be an array of strings" };
    }
    const env = raw.env === undefined ? { value: {} } : stringRecord(raw.env, "env");
    if ("error" in env) return env;
    if (raw.cwd !== undefined && typeof raw.cwd !== "string") {
      return { error: "cwd must be a string" };
    }
    const config = {
      ...common.config,
      type: "stdio" as const,
      command: raw.command as string,
      ...(raw.args === undefined ? {} : { args: raw.args as string[] }),
      ...(raw.env === undefined ? {} : { env: env.value }),
      ...(raw.cwd === undefined ? {} : { cwd: raw.cwd as string }),
    };
    return {
      config,
      normalized: {
        ...common.normalized,
        type: "stdio",
        command: raw.command,
        args: raw.args ?? [],
        env: env.value,
        ...(raw.cwd === undefined ? {} : { cwd: raw.cwd }),
      },
    };
  }

  let url: URL;
  try {
    url = new URL(raw.url as string);
  } catch {
    return { error: "url must be an HTTP or HTTPS URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: "url must be an HTTP or HTTPS URL" };
  }
  const headers = raw.headers === undefined ? { value: {} } : stringRecord(raw.headers, "headers");
  if ("error" in headers) return headers;
  const oauth = raw.oauth === undefined ? undefined : validateOAuth(raw.oauth);
  if (oauth && "error" in oauth) return oauth;

  let auth: { provider: string } | undefined;
  if (raw.auth !== undefined) {
    if (
      !isRecord(raw.auth) ||
      Object.keys(raw.auth).some((key) => key !== "provider") ||
      typeof raw.auth.provider !== "string" ||
      !raw.auth.provider
    ) {
      return { error: "auth must contain exactly one non-empty provider string" };
    }
    if (scope === "project") return { error: "auth is allowed only in the global mcp.json" };
    if (url.protocol !== "https:" && !LOOPBACK_HOSTS.has(url.hostname)) {
      return { error: "auth requires HTTPS or a loopback HTTP URL" };
    }
    auth = { provider: raw.auth.provider };
  }

  const config = {
    ...common.config,
    type: "http" as const,
    url: raw.url as string,
    ...(raw.headers === undefined ? {} : { headers: headers.value }),
    ...(oauth ? { oauth: oauth.config } : {}),
    ...(auth ? { auth } : {}),
  };
  return {
    config,
    normalized: {
      ...common.normalized,
      type: "http",
      url: raw.url,
      headers: headers.value,
      ...(oauth && Object.keys(oauth.normalized).length > 0 ? { oauth: oauth.normalized } : {}),
      ...(auth ? { auth } : {}),
    },
  };
}

export function digestNormalizedMcpConfig(normalized: NormalizedServerConfig): string {
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function readConfigSource(path: string, scope: McpConfigScope): ConfigSource {
  if (!existsSync(path)) return { path, scope, entries: {} };
  let source: string;
  try {
    source = realpathSync(path);
  } catch (error: any) {
    return { path, scope, entries: null, error: `cannot resolve config file: ${error?.message ?? String(error)}` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(source, "utf8"));
  } catch (error: any) {
    return { path: source, scope, entries: null, error: `invalid JSON: ${error?.message ?? String(error)}` };
  }
  if (!isRecord(parsed) || (parsed.mcpServers !== undefined && !isRecord(parsed.mcpServers))) {
    return {
      path: source,
      scope,
      entries: null,
      error: 'expected an object with an optional "mcpServers" object',
    };
  }
  if (parsed.autoEnableCodemode !== undefined && typeof parsed.autoEnableCodemode !== "boolean") {
    return { path: source, scope, entries: null, error: "autoEnableCodemode must be a boolean" };
  }
  return { path: source, scope, entries: (parsed.mcpServers as JsonRecord | undefined) ?? {} };
}

/** Read only the ambient MCP file identities and literal JSON values for canonical profile resolution. */
export function loadMcpConfigCatalog(options: McpConfigCatalogOptions): McpConfigCatalog {
  const global = readConfigSource(join(options.agentDir ?? getAgentDir(), "mcp.json"), "global");
  const project = options.projectTrusted
    ? readConfigSource(join(options.cwd, CONFIG_DIR_NAME, "mcp.json"), "project")
    : null;
  return { global, project };
}

function namespace(name: string): string {
  return name.replace(/-/g, "_");
}

function effectiveNames(catalog: McpConfigCatalog): string[] {
  if (!catalog.global.entries || (catalog.project && !catalog.project.entries)) return [];
  const names = new Set(Object.keys(catalog.global.entries));
  for (const name of Object.keys(catalog.project?.entries ?? {})) names.add(name);
  return [...names];
}

/** Resolve ordered exact names to non-secret source identities and semantic digests. */
export function resolveMcpServerReferences(
  selectedNames: readonly string[],
  catalog: McpConfigCatalog,
): McpCapabilityResolution | { errors: string[] } {
  if (selectedNames.length === 0) return { serverReferences: [], supportTools: [] };
  const errors: string[] = [];
  for (const source of [catalog.global, catalog.project].filter((entry): entry is ConfigSource => entry !== null)) {
    if (source.error) errors.push(`${source.path}: ${source.error}`);
  }
  if (errors.length > 0) return { errors };

  const allNames = effectiveNames(catalog);
  const references: McpServerReference[] = [];
  const selectedNamespaces = new Map<string, string>();
  let needsCodemode = false;
  let needsToolSearch = false;

  for (const name of selectedNames) {
    if (!SERVER_NAME.test(name)) {
      errors.push(`server "${name}" has an invalid name`);
      continue;
    }
    const normalizedNamespace = namespace(name);
    const prior = selectedNamespaces.get(normalizedNamespace);
    if (prior && prior !== name) {
      errors.push(`server "${name}" conflicts with selected server "${prior}" after '-'/'_' namespace normalization`);
      continue;
    }
    selectedNamespaces.set(normalizedNamespace, name);

    const conflicting = allNames.find((candidate) =>
      candidate !== name && SERVER_NAME.test(candidate) && namespace(candidate) === normalizedNamespace
    );
    if (conflicting) {
      errors.push(`server "${name}" conflicts with configured server "${conflicting}" after '-'/'_' namespace normalization`);
      continue;
    }

    const projectHasName = catalog.project?.entries &&
      Object.prototype.hasOwnProperty.call(catalog.project.entries, name);
    const source = projectHasName ? catalog.project! : catalog.global;
    if (!source.entries || !Object.prototype.hasOwnProperty.call(source.entries, name)) {
      errors.push(`server "${name}" is not configured in the permitted MCP sources`);
      continue;
    }

    const validated = validateAndNormalizeMcpServerConfig(name, source.entries[name], source.scope);
    if ("error" in validated) {
      errors.push(`${source.path}: server "${name}": ${validated.error}`);
      continue;
    }
    if (validated.config.enabled === false) {
      errors.push(`${source.path}: server "${name}" is disabled`);
      continue;
    }

    const exposures = [
      validated.config.exposure ?? "codemode",
      ...Object.values(validated.config.toolExposure ?? {}),
    ];
    needsCodemode ||= exposures.includes("codemode");
    needsToolSearch ||= exposures.includes("deferred");
    references.push({
      name,
      source: source.path,
      scope: source.scope,
      digest: digestNormalizedMcpConfig(validated.normalized),
    });
  }

  if (errors.length > 0) return { errors };
  return {
    serverReferences: references,
    supportTools: [
      ...(needsCodemode ? ["codemode" as const] : []),
      ...(needsToolSearch ? ["tool-search" as const] : []),
    ],
  };
}
