import {
  CONFIG_DIR_NAME,
  DefaultPackageManager,
  SettingsManager,
  getAgentDir,
  parseFrontmatter,
  type PackageSource,
  type ResolvedResource,
} from "@earendil-works/pi-coding-agent";
import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  type Dirent,
} from "node:fs";
import { translateAgyTools } from "./agy.ts";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
  win32,
} from "node:path";

export type AgentSource = "global" | "project";
export type SubagentSessionMode = "standalone" | "lineage-only" | "fork";
export type SystemPromptMode = "append" | "replace";
export type AgentCli = "pi" | "claude" | "agy";

export interface AgentExtensionSelector {
  package: string;
  paths?: string[];
}

export interface ParsedAgentDefinition {
  name: string;
  description?: string;
  model?: string;
  builtinTools: string[];
  extensions: AgentExtensionSelector[];
  skills: string[];
  thinking?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
  subagentAgents: string[];
  autoExit?: boolean;
  interactive?: boolean;
  systemPromptMode?: SystemPromptMode;
  sessionMode?: SubagentSessionMode;
  cwd?: string;
  cli?: AgentCli;
  body?: string;
  disableModelInvocation: boolean;
  source: AgentSource;
  filePath: string;
}

export interface AgentDefinition extends ParsedAgentDefinition {
  extensionPaths: string[];
}

export interface AgentDiagnostic {
  filePath: string;
  field?: string;
  message: string;
}

export interface AgentDiscoveryResult {
  agents: AgentDefinition[];
  diagnostics: AgentDiagnostic[];
  globalAgentsDir: string;
  projectAgentsDir: string | null;
}

export interface DiscoverAgentDefinitionsOptions {
  cwd: string;
  projectTrusted: boolean;
  allowedNames?: ReadonlySet<string> | null;
}

type AgentFrontmatter = Record<string, unknown>;

type DirectoryLoadResult = {
  agents: ParsedAgentDefinition[];
  diagnostics: AgentDiagnostic[];
  invalidNames: Set<string>;
  uncertainIdentityFiles: string[];
};

const SUPPORTED_FIELDS = new Set([
  "name",
  "description",
  "model",
  "builtin-tools",
  "extensions",
  "skill",
  "skills",
  "thinking",
  "subagent_agents",
  "auto-exit",
  "interactive",
  "system-prompt",
  "session-mode",
  "cwd",
  "cli",
  "disable-model-invocation",
]);

const THINKING_VALUES = new Set([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);
const SYSTEM_PROMPT_VALUES = new Set(["append", "replace"]);
const SESSION_MODE_VALUES = new Set(["standalone", "lineage-only", "fork"]);
const CLI_VALUES = new Set(["pi", "claude", "agy"]);
const BUILTIN_TOOL_VALUES = new Set([
  "read",
  "write",
  "edit",
  "bash",
  "powershell",
  "grep",
  "find",
  "ls",
]);
const SPAWNING_TOOL_VALUES = new Set([
  "subagent",
  "subagent_message",
  "subagents_list",
]);

function hasOwn(record: AgentFrontmatter, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function diagnostic(filePath: string, field: string | undefined, message: string): AgentDiagnostic {
  return { filePath, ...(field ? { field } : {}), message };
}

function effectiveFallbackName(filePath: string): string {
  return basename(filePath, ".md").trim();
}

function invalidAgentNameReason(name: string): string | null {
  if (!name) return "must not be empty";
  if (/[\x00-\x1f\x7f,/\\]/.test(name) || name === "." || name === "..") {
    return "must not contain commas, path separators, or control characters, or equal '.' or '..'";
  }
  return null;
}

function validateAgentName(
  value: unknown,
  fallbackName: string,
  filePath: string,
  diagnostics: AgentDiagnostic[],
): string {
  if (value !== undefined && typeof value !== "string") {
    diagnostics.push(diagnostic(filePath, "name", "must be a string when provided"));
    return fallbackName;
  }

  const name = (typeof value === "string" ? value : fallbackName).trim();
  const reason = invalidAgentNameReason(name);
  if (reason) diagnostics.push(diagnostic(filePath, "name", reason));
  return name || fallbackName;
}

/**
 * Recover a safely parsed explicit name from the valid YAML prefix of otherwise
 * malformed frontmatter. This lets an invalid project override tombstone the
 * intended global definition even when a later field breaks YAML parsing.
 */
function recoverMalformedName(content: string): string | null {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") return null;
  const closingIndex = lines.findIndex((line, index) => index > 0 && line === "---");
  const frontmatterLines = lines.slice(1, closingIndex === -1 ? undefined : closingIndex);
  // Prefix parsing can recover a name before a later syntax error, but a
  // duplicate declaration makes that identity ambiguous because the full YAML
  // document is invalid. This conservative text check does not parse a value;
  // all recovered values still come from Pi's YAML parser below.
  const possibleNameDeclarations = frontmatterLines.filter((line) =>
    /^\s*(?:name|["']name["'])\s*:/.test(line)
  ).length;
  if (possibleNameDeclarations !== 1) return null;

  const candidates = new Set<string>();
  const collectCandidate = (fragment: readonly string[]) => {
    try {
      const yaml = `---\n${fragment.join("\n")}\n---\nplaceholder`;
      const parsed = parseFrontmatter<AgentFrontmatter>(yaml).frontmatter;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !hasOwn(parsed, "name")) {
        return;
      }
      if (typeof parsed.name !== "string") return;
      const name = parsed.name.trim();
      if (!invalidAgentNameReason(name)) candidates.add(name);
    } catch {
      // Another valid fragment may still expose a complete YAML name.
    }
  };

  // Whole prefixes recover ordinary and multiline names before a later syntax
  // error. Individual lines expose additional simple/tagged duplicate names
  // that make the full invalid document's intended identity ambiguous.
  for (let end = 1; end <= frontmatterLines.length; end++) {
    collectCandidate(frontmatterLines.slice(0, end));
  }
  for (const line of frontmatterLines) collectCandidate([line]);

  return candidates.size === 1 ? [...candidates][0] : null;
}

function optionalString(
  frontmatter: AgentFrontmatter,
  field: string,
  filePath: string,
  diagnostics: AgentDiagnostic[],
): string | undefined {
  const value = frontmatter[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    diagnostics.push(diagnostic(filePath, field, "must be a string"));
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    diagnostics.push(diagnostic(filePath, field, "must not be empty when provided"));
    return undefined;
  }
  return normalized;
}

function optionalBoolean(
  frontmatter: AgentFrontmatter,
  field: string,
  filePath: string,
  diagnostics: AgentDiagnostic[],
): boolean | undefined {
  const value = frontmatter[field];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    diagnostics.push(diagnostic(filePath, field, "must be a YAML boolean (true or false)"));
    return undefined;
  }
  return value;
}

function optionalEnum<T extends string>(
  frontmatter: AgentFrontmatter,
  field: string,
  values: ReadonlySet<string>,
  filePath: string,
  diagnostics: AgentDiagnostic[],
): T | undefined {
  const value = frontmatter[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !values.has(value)) {
    diagnostics.push(
      diagnostic(filePath, field, `must be one of: ${[...values].join(", ")}`),
    );
    return undefined;
  }
  return value as T;
}

function stringList(
  frontmatter: AgentFrontmatter,
  field: string,
  filePath: string,
  diagnostics: AgentDiagnostic[],
): string[] {
  const value = frontmatter[field];
  if (value === undefined || value === null) {
    if (value === null) {
      diagnostics.push(diagnostic(filePath, field, "must be a string or an array of strings"));
    }
    return [];
  }

  let raw: string[];
  if (typeof value === "string") {
    raw = value.split(",");
  } else if (Array.isArray(value)) {
    if (!value.every((entry) => typeof entry === "string")) {
      diagnostics.push(diagnostic(filePath, field, "array entries must all be strings"));
      return [];
    }
    raw = value as string[];
  } else {
    diagnostics.push(diagnostic(filePath, field, "must be a comma-delimited string or an array of strings"));
    return [];
  }

  if (raw.some((entry) => entry.includes(","))) {
    diagnostics.push(
      diagnostic(filePath, field, "YAML array entries must not contain commas"),
    );
    return [];
  }

  return [...new Set(raw.map((entry) => entry.trim()).filter(Boolean))];
}

function builtinToolList(
  frontmatter: AgentFrontmatter,
  filePath: string,
  diagnostics: AgentDiagnostic[],
): string[] {
  const tools = stringList(frontmatter, "builtin-tools", filePath, diagnostics);
  for (const tool of tools) {
    if (BUILTIN_TOOL_VALUES.has(tool)) continue;
    diagnostics.push(
      diagnostic(
        filePath,
        "builtin-tools",
        SPAWNING_TOOL_VALUES.has(tool)
          ? `entry "${tool}" is not a Pi built-in; use subagent_agents for nested spawning`
          : `entry "${tool}" must be one of: ${[...BUILTIN_TOOL_VALUES].join(", ")}`,
      ),
    );
  }
  return tools;
}

function extensionSelectors(
  frontmatter: AgentFrontmatter,
  filePath: string,
  diagnostics: AgentDiagnostic[],
): AgentExtensionSelector[] {
  const value = frontmatter.extensions;
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    diagnostics.push(diagnostic(filePath, "extensions", "must be a YAML array of mappings"));
    return [];
  }

  const selectors: AgentExtensionSelector[] = [];
  const seenPackages = new Set<string>();
  for (const [index, entry] of value.entries()) {
    const field = `extensions[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      diagnostics.push(diagnostic(filePath, field, "must be a mapping"));
      continue;
    }

    const record = entry as AgentFrontmatter;
    let valid = true;
    for (const key of Object.keys(record)) {
      if (key === "package" || key === "paths") continue;
      diagnostics.push(diagnostic(filePath, `${field}.${key}`, "is not a supported extension field"));
      valid = false;
    }

    let packageSource: string | undefined;
    if (typeof record.package !== "string") {
      diagnostics.push(diagnostic(filePath, `${field}.package`, "must be a non-empty string"));
      valid = false;
    } else {
      packageSource = record.package;
      if (!packageSource.trim()) {
        diagnostics.push(diagnostic(filePath, `${field}.package`, "must be a non-empty string"));
        valid = false;
      } else if (seenPackages.has(packageSource)) {
        diagnostics.push(
          diagnostic(filePath, `${field}.package`, `duplicates package "${packageSource}"`),
        );
        valid = false;
      } else {
        seenPackages.add(packageSource);
      }
    }

    let paths: string[] | undefined;
    if (hasOwn(record, "paths")) {
      if (!Array.isArray(record.paths)) {
        diagnostics.push(
          diagnostic(filePath, `${field}.paths`, "must be a non-empty YAML array of strings"),
        );
        valid = false;
      } else if (record.paths.length === 0) {
        diagnostics.push(
          diagnostic(filePath, `${field}.paths`, "must not be empty when provided"),
        );
        valid = false;
      } else {
        paths = [];
        const seenPaths = new Set<string>();
        for (const [pathIndex, rawPath] of record.paths.entries()) {
          const pathField = `${field}.paths[${pathIndex}]`;
          if (typeof rawPath !== "string") {
            diagnostics.push(diagnostic(filePath, pathField, "must be a non-empty string"));
            valid = false;
            continue;
          }
          const selector = rawPath;
          if (!selector.trim()) {
            diagnostics.push(diagnostic(filePath, pathField, "must be a non-empty string"));
            valid = false;
            continue;
          }
          if (seenPaths.has(selector)) {
            diagnostics.push(diagnostic(filePath, pathField, `duplicates selector "${selector}"`));
            valid = false;
            continue;
          }
          seenPaths.add(selector);
          if (
            isAbsolute(selector) ||
            win32.isAbsolute(selector) ||
            /^[A-Za-z]:/.test(selector)
          ) {
            diagnostics.push(diagnostic(filePath, pathField, "must be package-relative"));
            valid = false;
            continue;
          }
          if (selector.split(/[\\/]+/).some((segment) => segment === "." || segment === "..")) {
            diagnostics.push(
              diagnostic(filePath, pathField, "must not contain '.' or '..' path segments"),
            );
            valid = false;
            continue;
          }
          paths.push(selector);
        }
      }
    }

    if (valid && packageSource) {
      selectors.push({ package: packageSource, ...(paths ? { paths } : {}) });
    }
  }
  return selectors;
}

export function parseAgentDefinition(
  content: string,
  filePath: string,
  source: AgentSource,
): {
  agent: ParsedAgentDefinition | null;
  diagnostics: AgentDiagnostic[];
  effectiveName: string;
  identityUncertain: boolean;
} {
  const diagnostics: AgentDiagnostic[] = [];
  const fallbackName = effectiveFallbackName(filePath);
  const hasDelimitedFrontmatter =
    /^---\r?\n(?:---(?:\r?\n|$)|[\s\S]*?\r?\n---(?:\r?\n|$))/.test(content);
  if (!hasDelimitedFrontmatter) {
    diagnostics.push(
      diagnostic(
        filePath,
        "frontmatter",
        "must begin with YAML frontmatter closed by a second '---' line",
      ),
    );
    const recoveredName = recoverMalformedName(content);
    return {
      agent: null,
      diagnostics,
      effectiveName: recoveredName ?? fallbackName,
      identityUncertain: recoveredName === null,
    };
  }

  let parsed: { frontmatter: AgentFrontmatter; body: string };
  try {
    parsed = parseFrontmatter<AgentFrontmatter>(content);
  } catch (error: any) {
    diagnostics.push(
      diagnostic(filePath, "frontmatter", `invalid YAML: ${error?.message ?? String(error)}`),
    );
    const recoveredName = recoverMalformedName(content);
    return {
      agent: null,
      diagnostics,
      effectiveName: recoveredName ?? fallbackName,
      identityUncertain: recoveredName === null,
    };
  }

  const { frontmatter, body } = parsed;
  if (!frontmatter || typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
    diagnostics.push(
      diagnostic(filePath, "frontmatter", "must be a YAML mapping of supported fields"),
    );
    return {
      agent: null,
      diagnostics,
      effectiveName: fallbackName,
      identityUncertain: true,
    };
  }
  for (const key of Object.keys(frontmatter)) {
    if (key === "tools") {
      diagnostics.push(
        diagnostic(
          filePath,
          key,
          "has been removed; use builtin-tools for Pi built-ins and extensions for package extension capabilities",
        ),
      );
    } else if (!SUPPORTED_FIELDS.has(key)) {
      diagnostics.push(diagnostic(filePath, key, "is not a supported agent-definition field"));
    }
  }
  if (hasOwn(frontmatter, "skill") && hasOwn(frontmatter, "skills")) {
    diagnostics.push(
      diagnostic(filePath, "skill/skills", "aliases cannot be used together; choose exactly one"),
    );
  }

  const explicitNameInvalid = hasOwn(frontmatter, "name") && (
    typeof frontmatter.name !== "string" ||
    invalidAgentNameReason(
      typeof frontmatter.name === "string" ? frontmatter.name.trim() : "",
    ) !== null
  );
  const name = validateAgentName(frontmatter.name, fallbackName, filePath, diagnostics);
  const normalizedBody = body.trim();
  if (!normalizedBody) {
    diagnostics.push(diagnostic(filePath, "body", "must contain a non-empty Markdown prompt"));
  }
  const skillsField = hasOwn(frontmatter, "skill") ? "skill" : "skills";
  const builtinTools = builtinToolList(frontmatter, filePath, diagnostics);
  const extensions = extensionSelectors(frontmatter, filePath, diagnostics);
  const skills = stringList(frontmatter, skillsField, filePath, diagnostics);
  const subagentAgents = stringList(frontmatter, "subagent_agents", filePath, diagnostics);
  for (const target of subagentAgents) {
    const reason = invalidAgentNameReason(target);
    if (reason) {
      diagnostics.push(
        diagnostic(filePath, "subagent_agents", `entry "${target}" ${reason}`),
      );
    }
  }
  const cli = optionalEnum<AgentCli>(frontmatter, "cli", CLI_VALUES, filePath, diagnostics);
  if (cli === "claude") {
    for (const field of ["builtin-tools", "extensions"] as const) {
      if (hasOwn(frontmatter, field)) {
        diagnostics.push(
          diagnostic(filePath, field, `cannot be used with cli: claude; ${field} is Pi-only`),
        );
      }
    }
  }
  if (cli === "agy") {
    for (const field of [
      "extensions",
      "skill",
      "skills",
      "subagent_agents",
      "system-prompt",
      "session-mode",
      "auto-exit",
      "interactive",
    ] as const) {
      if (hasOwn(frontmatter, field)) {
        diagnostics.push(
          diagnostic(filePath, field, `cannot be used with cli: agy; ${field} has no supported AGY mapping`),
        );
      }
    }
    for (const tool of builtinTools) {
      try {
        translateAgyTools([tool]);
      } catch {
        diagnostics.push(
          diagnostic(
            filePath,
            "builtin-tools",
            `entry "${tool}" cannot be used with cli: agy; supported tools: read, grep, find, ls`,
          ),
        );
      }
    }
  }

  const agent: ParsedAgentDefinition = {
    name,
    description: optionalString(frontmatter, "description", filePath, diagnostics),
    model: optionalString(frontmatter, "model", filePath, diagnostics),
    builtinTools,
    extensions,
    skills,
    thinking: optionalEnum(frontmatter, "thinking", THINKING_VALUES, filePath, diagnostics),
    subagentAgents,
    autoExit: optionalBoolean(frontmatter, "auto-exit", filePath, diagnostics),
    interactive: optionalBoolean(frontmatter, "interactive", filePath, diagnostics),
    systemPromptMode: optionalEnum(
      frontmatter,
      "system-prompt",
      SYSTEM_PROMPT_VALUES,
      filePath,
      diagnostics,
    ),
    sessionMode: optionalEnum(
      frontmatter,
      "session-mode",
      SESSION_MODE_VALUES,
      filePath,
      diagnostics,
    ),
    cwd: optionalString(frontmatter, "cwd", filePath, diagnostics),
    cli,
    body: normalizedBody || undefined,
    disableModelInvocation:
      optionalBoolean(frontmatter, "disable-model-invocation", filePath, diagnostics) ?? false,
    source,
    filePath,
  };

  return {
    agent: diagnostics.length === 0 ? agent : null,
    diagnostics,
    effectiveName: name,
    identityUncertain: explicitNameInvalid,
  };
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isAgentFile(entry: Dirent): boolean {
  return entry.name.endsWith(".md") && (entry.isFile() || entry.isSymbolicLink());
}

function loadAgentsFromDir(dir: string, source: AgentSource): DirectoryLoadResult {
  const agents = new Map<string, ParsedAgentDefinition>();
  const diagnostics: AgentDiagnostic[] = [];
  const invalidNames = new Set<string>();
  const uncertainIdentityFiles: string[] = [];

  if (!existsSync(dir)) return { agents: [], diagnostics, invalidNames, uncertainIdentityFiles };

  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true }).filter(isAgentFile);
  } catch (error: any) {
    diagnostics.push(
      diagnostic(dir, undefined, `cannot read agent directory: ${error?.message ?? String(error)}`),
    );
    uncertainIdentityFiles.push(dir);
    return { agents: [], diagnostics, invalidNames, uncertainIdentityFiles };
  }

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const filePath = join(dir, entry.name);
    let content: string;
    try {
      content = readFileSync(filePath, "utf8");
    } catch (error: any) {
      const fallbackName = effectiveFallbackName(filePath);
      invalidNames.add(fallbackName);
      uncertainIdentityFiles.push(filePath);
      diagnostics.push(
        diagnostic(filePath, undefined, `cannot read agent definition: ${error?.message ?? String(error)}`),
      );
      continue;
    }

    const parsed = parseAgentDefinition(content, filePath, source);
    diagnostics.push(...parsed.diagnostics);
    if (!parsed.agent) {
      agents.delete(parsed.effectiveName);
      invalidNames.add(parsed.effectiveName);
      if (parsed.identityUncertain) uncertainIdentityFiles.push(filePath);
      continue;
    }

    if (agents.has(parsed.agent.name) || invalidNames.has(parsed.agent.name)) {
      agents.delete(parsed.agent.name);
      invalidNames.add(parsed.agent.name);
      diagnostics.push(
        diagnostic(
          filePath,
          "name",
          `duplicates another ${source} definition named "${parsed.agent.name}"; all duplicates are excluded`,
        ),
      );
      continue;
    }
    agents.set(parsed.agent.name, parsed.agent);
  }

  return { agents: [...agents.values()], diagnostics, invalidNames, uncertainIdentityFiles };
}

export function findNearestProjectAgentsDir(cwd: string): string | null {
  let current = cwd;
  while (true) {
    const candidate = join(current, CONFIG_DIR_NAME, "agents");
    if (isDirectory(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

type PackageScope = "user" | "project";
type SettingsScope = "global" | "project";

type ResolvedPackage = {
  manager: DefaultPackageManager;
  resources: ResolvedResource[];
};

type PackageCatalog = {
  cwd: string;
  agentDir: string;
  globalPackages: PackageSource[];
  projectPackages: PackageSource[];
  settingsErrors: Partial<Record<SettingsScope, string>>;
  invalidPackages: Record<SettingsScope, Map<string, string>>;
  identityManager: DefaultPackageManager;
  cache: Map<string, Promise<ResolvedPackage>>;
};

class ReadOnlyPackageSettingsStorage {
  private readonly content: Record<SettingsScope, string>;

  constructor(globalPackages: PackageSource[], projectPackages: PackageSource[]) {
    this.content = {
      global: JSON.stringify({ packages: globalPackages }),
      project: JSON.stringify({ packages: projectPackages }),
    };
  }

  withLock(
    scope: SettingsScope,
    fn: (current: string | undefined) => string | undefined,
  ): void {
    const replacement = fn(this.content[scope]);
    if (replacement !== undefined) {
      throw new Error("Package resolution attempted to write read-only settings");
    }
  }
}

function packageSource(entry: PackageSource): string {
  return typeof entry === "string" ? entry : entry.source;
}

function appendSettingsError(
  errors: Partial<Record<SettingsScope, string>>,
  scope: SettingsScope,
  message: string,
): void {
  errors[scope] = errors[scope] ? `${errors[scope]}; ${message}` : message;
}

function validateConfiguredPackages(
  value: unknown,
  scope: SettingsScope,
  settingsErrors: Partial<Record<SettingsScope, string>>,
  invalidPackages: Map<string, string>,
): PackageSource[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    appendSettingsError(settingsErrors, scope, "packages must be an array");
    return [];
  }

  const packages: PackageSource[] = [];
  for (const [index, entry] of value.entries()) {
    if (typeof entry === "string") {
      if (!entry.trim()) {
        invalidPackages.set(entry, `packages[${index}] must be a non-empty string`);
      } else {
        packages.push(entry);
      }
      continue;
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      appendSettingsError(
        settingsErrors,
        scope,
        `packages[${index}] must be a string or package mapping`,
      );
      continue;
    }

    const record = entry as Record<string, unknown>;
    if (typeof record.source !== "string" || !record.source.trim()) {
      appendSettingsError(
        settingsErrors,
        scope,
        `packages[${index}].source must be a non-empty string`,
      );
      continue;
    }

    const reasons: string[] = [];
    const supportedKeys = new Set([
      "source",
      "autoload",
      "extensions",
      "skills",
      "prompts",
      "themes",
    ]);
    for (const key of Object.keys(record)) {
      if (!supportedKeys.has(key)) reasons.push(`unsupported field "${key}"`);
    }
    if (record.autoload !== undefined && typeof record.autoload !== "boolean") {
      reasons.push("autoload must be a boolean");
    }
    for (const resourceType of ["extensions", "skills", "prompts", "themes"] as const) {
      const resourceFilter = record[resourceType];
      if (
        resourceFilter !== undefined &&
        (!Array.isArray(resourceFilter) ||
          !resourceFilter.every((filter) => typeof filter === "string"))
      ) {
        reasons.push(`${resourceType} must be an array of strings`);
      }
    }
    if (reasons.length > 0) {
      invalidPackages.set(
        record.source,
        `packages[${index}] is invalid: ${reasons.join("; ")}`,
      );
      continue;
    }
    packages.push(entry as PackageSource);
  }
  return packages;
}

function loadPackageCatalog(
  options: DiscoverAgentDefinitionsOptions,
  projectAgentsDir: string | null,
): PackageCatalog {
  const agentDir = getAgentDir();
  const settingsCwd = projectAgentsDir ? dirname(dirname(projectAgentsDir)) : options.cwd;
  const settingsManager = SettingsManager.create(settingsCwd, agentDir, {
    projectTrusted: options.projectTrusted,
  });
  const settingsErrors: Partial<Record<SettingsScope, string>> = {};
  for (const entry of settingsManager.drainErrors()) {
    appendSettingsError(
      settingsErrors,
      entry.scope,
      entry.error?.message ?? String(entry.error),
    );
  }

  const invalidPackages = {
    global: new Map<string, string>(),
    project: new Map<string, string>(),
  };
  const globalSettings = settingsManager.getGlobalSettings() as { packages?: unknown };
  const projectSettings = settingsManager.getProjectSettings() as { packages?: unknown };
  const globalPackages = validateConfiguredPackages(
    globalSettings.packages,
    "global",
    settingsErrors,
    invalidPackages.global,
  );
  const projectPackages = options.projectTrusted
    ? validateConfiguredPackages(
        projectSettings.packages,
        "project",
        settingsErrors,
        invalidPackages.project,
      )
    : [];

  const identitySettingsManager = SettingsManager.fromStorage(
    new ReadOnlyPackageSettingsStorage([], []),
    { projectTrusted: options.projectTrusted },
  );
  const identityManager = new DefaultPackageManager({
    cwd: settingsCwd,
    agentDir,
    settingsManager: identitySettingsManager,
  });

  return {
    cwd: settingsCwd,
    agentDir,
    globalPackages,
    projectPackages,
    settingsErrors,
    invalidPackages,
    identityManager,
    cache: new Map(),
  };
}

function findExactPackage(
  entries: readonly PackageSource[],
  source: string,
): PackageSource | undefined {
  return entries.find((entry) => packageSource(entry) === source);
}

type PiPackageIdentityReader = {
  getPackageIdentity(source: string, scope: PackageScope): string;
};

function piPackageIdentity(
  manager: DefaultPackageManager,
  source: string,
  scope: PackageScope,
): string | null {
  // Pi does not export its package parser or identity method, but its delta
  // semantics depend on that exact implementation. Keep this compatibility
  // seam fail-closed rather than approximating protocol and platform paths.
  const reader = manager as unknown as Partial<PiPackageIdentityReader>;
  if (typeof reader.getPackageIdentity !== "function") return null;
  try {
    const identity = reader.getPackageIdentity.call(manager, source, scope);
    return typeof identity === "string" && identity.length > 0 ? identity : null;
  } catch {
    return null;
  }
}

function matchingGlobalDeltaBases(
  catalog: PackageCatalog,
  projectSource: string,
): PackageSource[] {
  const projectIdentity = piPackageIdentity(
    catalog.identityManager,
    projectSource,
    "project",
  );
  if (projectIdentity === null) return [];

  return catalog.globalPackages.filter((entry) =>
    piPackageIdentity(
      catalog.identityManager,
      packageSource(entry),
      "user",
    ) === projectIdentity
  );
}

function resolveConfiguredPackage(
  catalog: PackageCatalog,
  entry: PackageSource,
  scope: PackageScope,
): Promise<ResolvedPackage> {
  const source = packageSource(entry);
  const cacheKey = `${scope}\u0000${source}`;
  const cached = catalog.cache.get(cacheKey);
  if (cached) return cached;

  const resolution = (async () => {
    const needsGlobalDeltaBase =
      scope === "project" && typeof entry === "object" && entry.autoload === false;
    const deltaBases = needsGlobalDeltaBase
      ? matchingGlobalDeltaBases(catalog, source)
      : [];
    const inheritedSources = new Set(deltaBases.map(packageSource));
    const storage = new ReadOnlyPackageSettingsStorage(
      scope === "user" ? [entry] : deltaBases,
      scope === "project" ? [entry] : [],
    );
    const settingsManager = SettingsManager.fromStorage(storage, {
      projectTrusted: scope === "project",
    });
    const manager = new DefaultPackageManager({
      cwd: catalog.cwd,
      agentDir: catalog.agentDir,
      settingsManager,
    });
    const resolved = await manager.resolve(async () => "skip");
    return {
      manager,
      resources: resolved.extensions.filter((resource) =>
        resource.metadata.origin === "package" && (
          (resource.metadata.scope === scope && resource.metadata.source === source) ||
          (needsGlobalDeltaBase &&
            resource.metadata.scope === "user" &&
            inheritedSources.has(resource.metadata.source))
        )
      ),
    };
  })();

  catalog.cache.set(cacheKey, resolution);
  return resolution;
}

function pathIsInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (
    rel !== ".." &&
    !rel.startsWith(`..${sep}`) &&
    !isAbsolute(rel)
  );
}

function installedPackageRoot(
  resolvedPackage: ResolvedPackage,
  source: string,
  scope: PackageScope,
): string | null {
  const metadataRoot = resolvedPackage.resources.find((resource) =>
    typeof resource.metadata.baseDir === "string"
  )?.metadata.baseDir;
  if (metadataRoot) return metadataRoot;

  const installedPath = resolvedPackage.manager.getInstalledPath(source, scope);
  if (!installedPath) return null;
  try {
    return statSync(installedPath).isFile() ? dirname(installedPath) : installedPath;
  } catch {
    return null;
  }
}

function canonicalFileWithinRoot(
  path: string,
  canonicalRoot: string,
): { path: string } | { error: string } {
  let canonicalPath: string;
  try {
    canonicalPath = realpathSync(path);
  } catch (error: any) {
    return { error: `does not exist or cannot be resolved: ${error?.message ?? String(error)}` };
  }
  try {
    if (!statSync(canonicalPath).isFile()) {
      return { error: "must resolve to a file" };
    }
  } catch (error: any) {
    return { error: `cannot be inspected: ${error?.message ?? String(error)}` };
  }
  if (!pathIsInside(canonicalRoot, canonicalPath)) {
    return { error: `escapes package root ${canonicalRoot}` };
  }
  return { path: canonicalPath };
}

async function resolveAgentExtensions(
  agent: ParsedAgentDefinition,
  catalog: PackageCatalog,
): Promise<{ agent: AgentDefinition | null; diagnostics: AgentDiagnostic[] }> {
  const diagnostics: AgentDiagnostic[] = [];
  const extensionPaths: string[] = [];
  const seenPaths = new Set<string>();

  for (const [extensionIndex, selector] of agent.extensions.entries()) {
    const packageField = `extensions[${extensionIndex}].package`;
    const selectorField = `extensions[${extensionIndex}]`;
    let scope: PackageScope;
    let configured: PackageSource | undefined;

    if (agent.source === "project") {
      const invalidProjectPackage = catalog.invalidPackages.project.get(selector.package);
      if (invalidProjectPackage) {
        diagnostics.push(
          diagnostic(
            agent.filePath,
            packageField,
            `project package configuration for "${selector.package}" is invalid: ${invalidProjectPackage}`,
          ),
        );
        continue;
      }
      if (catalog.settingsErrors.project) {
        diagnostics.push(
          diagnostic(
            agent.filePath,
            packageField,
            `cannot determine trusted project package overrides safely: ${catalog.settingsErrors.project}`,
          ),
        );
        continue;
      }
      configured = findExactPackage(catalog.projectPackages, selector.package);
      if (configured) {
        scope = "project";
      } else {
        const invalidGlobalPackage = catalog.invalidPackages.global.get(selector.package);
        if (invalidGlobalPackage) {
          diagnostics.push(
            diagnostic(
              agent.filePath,
              packageField,
              `global package configuration for "${selector.package}" is invalid: ${invalidGlobalPackage}`,
            ),
          );
          continue;
        }
        if (catalog.settingsErrors.global) {
          diagnostics.push(
            diagnostic(
              agent.filePath,
              packageField,
              `cannot inspect global package fallback safely: ${catalog.settingsErrors.global}`,
            ),
          );
          continue;
        }
        configured = findExactPackage(catalog.globalPackages, selector.package);
        scope = "user";
      }
    } else {
      const invalidGlobalPackage = catalog.invalidPackages.global.get(selector.package);
      if (invalidGlobalPackage) {
        diagnostics.push(
          diagnostic(
            agent.filePath,
            packageField,
            `global package configuration for "${selector.package}" is invalid: ${invalidGlobalPackage}`,
          ),
        );
        continue;
      }
      if (catalog.settingsErrors.global) {
        diagnostics.push(
          diagnostic(
            agent.filePath,
            packageField,
            `cannot inspect global package settings safely: ${catalog.settingsErrors.global}`,
          ),
        );
        continue;
      }
      configured = findExactPackage(catalog.globalPackages, selector.package);
      scope = "user";
    }

    if (!configured) {
      const settingsScope = agent.source === "project" ? "project or global" : "global";
      diagnostics.push(
        diagnostic(
          agent.filePath,
          packageField,
          `package "${selector.package}" is not configured in permitted ${settingsScope} settings`,
        ),
      );
      continue;
    }

    let resolvedPackage: ResolvedPackage;
    try {
      resolvedPackage = await resolveConfiguredPackage(catalog, configured, scope);
    } catch (error: any) {
      diagnostics.push(
        diagnostic(
          agent.filePath,
          packageField,
          `cannot resolve configured package "${selector.package}": ${error?.message ?? String(error)}`,
        ),
      );
      continue;
    }

    const packageRoot = installedPackageRoot(resolvedPackage, selector.package, scope);
    if (!packageRoot) {
      diagnostics.push(
        diagnostic(
          agent.filePath,
          packageField,
          `configured package "${selector.package}" is not installed or has no resolvable package root`,
        ),
      );
      continue;
    }

    let canonicalRoot: string;
    try {
      canonicalRoot = realpathSync(packageRoot);
      if (!statSync(canonicalRoot).isDirectory()) {
        throw new Error("package root is not a directory");
      }
    } catch (error: any) {
      diagnostics.push(
        diagnostic(
          agent.filePath,
          packageField,
          `cannot inspect package root for "${selector.package}": ${error?.message ?? String(error)}`,
        ),
      );
      continue;
    }

    if (selector.paths === undefined) {
      const enabled = resolvedPackage.resources.filter((resource) => resource.enabled);
      if (enabled.length === 0) {
        diagnostics.push(
          diagnostic(
            agent.filePath,
            selectorField,
            `package "${selector.package}" selects no enabled extension resources`,
          ),
        );
        continue;
      }
      for (const resource of enabled) {
        const canonical = canonicalFileWithinRoot(resource.path, canonicalRoot);
        if ("error" in canonical) {
          diagnostics.push(
            diagnostic(
              agent.filePath,
              selectorField,
              `extension resource "${resource.path}" ${canonical.error}`,
            ),
          );
          continue;
        }
        if (!seenPaths.has(canonical.path)) {
          seenPaths.add(canonical.path);
          extensionPaths.push(canonical.path);
        }
      }
      continue;
    }

    const resourcesByCanonicalPath = new Map<string, ResolvedResource[]>();
    for (const resource of resolvedPackage.resources) {
      try {
        const canonicalPath = realpathSync(resource.path);
        const matches = resourcesByCanonicalPath.get(canonicalPath) ?? [];
        matches.push(resource);
        resourcesByCanonicalPath.set(canonicalPath, matches);
      } catch {
        // The selected path receives the actionable missing-resource diagnostic below.
      }
    }

    for (const [pathIndex, pathSelector] of selector.paths.entries()) {
      const pathField = `extensions[${extensionIndex}].paths[${pathIndex}]`;
      const canonical = canonicalFileWithinRoot(resolve(packageRoot, pathSelector), canonicalRoot);
      if ("error" in canonical) {
        diagnostics.push(
          diagnostic(
            agent.filePath,
            pathField,
            `selector "${pathSelector}" ${canonical.error}`,
          ),
        );
        continue;
      }
      const matches = resourcesByCanonicalPath.get(canonical.path) ?? [];
      if (!matches.some((resource) => resource.enabled)) {
        diagnostics.push(
          diagnostic(
            agent.filePath,
            pathField,
            `selector "${pathSelector}" is not an enabled extension resource from package "${selector.package}"`,
          ),
        );
        continue;
      }
      if (!seenPaths.has(canonical.path)) {
        seenPaths.add(canonical.path);
        extensionPaths.push(canonical.path);
      }
    }
  }

  return {
    agent: diagnostics.length === 0 ? { ...agent, extensionPaths } : null,
    diagnostics,
  };
}

export async function discoverAgentDefinitions(
  options: DiscoverAgentDefinitionsOptions,
): Promise<AgentDiscoveryResult> {
  const globalAgentsDir = join(getAgentDir(), "agents");
  const global = loadAgentsFromDir(globalAgentsDir, "global");
  const diagnostics = [...global.diagnostics];
  const agents = new Map(global.agents.map((agent) => [agent.name, agent]));

  const projectAgentsDir = options.projectTrusted
    ? findNearestProjectAgentsDir(options.cwd)
    : null;
  if (projectAgentsDir) {
    const project = loadAgentsFromDir(projectAgentsDir, "project");
    diagnostics.push(...project.diagnostics);
    if (project.uncertainIdentityFiles.length > 0) {
      agents.clear();
      for (const filePath of project.uncertainIdentityFiles) {
        diagnostics.push(
          diagnostic(
            filePath,
            "name",
            "effective name cannot be determined safely; all global definitions are suppressed to prevent an unrestricted fallback",
          ),
        );
      }
    } else {
      for (const invalidName of project.invalidNames) agents.delete(invalidName);
    }
    for (const agent of project.agents) agents.set(agent.name, agent);
  }

  const parsedAgents = [...agents.values()];
  let discovered: AgentDefinition[];
  if (parsedAgents.some((agent) => agent.extensions.length > 0)) {
    const catalog = loadPackageCatalog(options, projectAgentsDir);
    const resolved = await Promise.all(
      parsedAgents.map((agent) => resolveAgentExtensions(agent, catalog)),
    );
    discovered = [];
    for (const result of resolved) {
      diagnostics.push(...result.diagnostics);
      if (result.agent) discovered.push(result.agent);
    }
  } else {
    discovered = parsedAgents.map((agent) => ({ ...agent, extensionPaths: [] }));
  }

  const allowed = options.allowedNames;
  return {
    agents: allowed ? discovered.filter((agent) => allowed.has(agent.name)) : discovered,
    diagnostics,
    globalAgentsDir,
    projectAgentsDir,
  };
}

export function formatAgentDiagnostic(entry: AgentDiagnostic): string {
  const field = entry.field ? ` (field "${entry.field}")` : "";
  return `${entry.filePath}${field}: ${entry.message}`;
}
