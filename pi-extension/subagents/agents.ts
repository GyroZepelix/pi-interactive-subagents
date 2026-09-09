import {
  CONFIG_DIR_NAME,
  getAgentDir,
  parseFrontmatter,
} from "@earendil-works/pi-coding-agent";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  type Dirent,
} from "node:fs";
import { basename, dirname, join } from "node:path";

export type AgentSource = "global" | "project";
export type SubagentSessionMode = "standalone" | "lineage-only" | "fork";
export type SystemPromptMode = "append" | "replace";
export type AgentCli = "pi" | "claude";

export interface AgentDefinition {
  name: string;
  description?: string;
  model?: string;
  tools: string[];
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
  agents: AgentDefinition[];
  diagnostics: AgentDiagnostic[];
  invalidNames: Set<string>;
  uncertainIdentityFiles: string[];
};

const SUPPORTED_FIELDS = new Set([
  "name",
  "description",
  "model",
  "tools",
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
const CLI_VALUES = new Set(["pi", "claude"]);

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

export function parseAgentDefinition(
  content: string,
  filePath: string,
  source: AgentSource,
): {
  agent: AgentDefinition | null;
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
    if (!SUPPORTED_FIELDS.has(key)) {
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
  const tools = stringList(frontmatter, "tools", filePath, diagnostics);
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
  const spawningTool = tools.find((tool) =>
    ["subagent", "subagent_message", "subagents_list"].includes(tool),
  );
  if (spawningTool) {
    diagnostics.push(
      diagnostic(
        filePath,
        "tools",
        `must not grant spawning tool "${spawningTool}"; use subagent_agents instead`,
      ),
    );
  }

  const agent: AgentDefinition = {
    name,
    description: optionalString(frontmatter, "description", filePath, diagnostics),
    model: optionalString(frontmatter, "model", filePath, diagnostics),
    tools,
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
    cli: optionalEnum(frontmatter, "cli", CLI_VALUES, filePath, diagnostics),
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
  const agents = new Map<string, AgentDefinition>();
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

export function discoverAgentDefinitions(
  options: DiscoverAgentDefinitionsOptions,
): AgentDiscoveryResult {
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

  const discovered = [...agents.values()];
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
