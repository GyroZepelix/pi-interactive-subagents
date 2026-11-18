import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  createCodemodeExtension,
  createToolSearchExtension,
  type CreateAgentSessionRuntimeFactory,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import {
  loadMcpConfigCatalog,
  loadMcpRegistrySource,
  resolveMcpServerReferences,
  type McpServerReference,
  type McpSupportTool,
} from "../../pi-extension/subagents/mcp-config.ts";
import {
  encodeMcpServerReferences,
  SUBAGENT_BUILTIN_TOOLS_ENV,
  SUBAGENT_CAPABILITY_VERSION_ENV,
  SUBAGENT_MCP_REFERENCES_ENV,
  SUBAGENT_MCP_SUPPORT_TOOLS_ENV,
} from "../../pi-extension/subagents/subagent-protocol.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, "../..");
const MCP_FIXTURE = join(HERE, "fixtures", "mcp-marker-server.mjs");
const MCP_CONTROL = join(PROJECT_ROOT, "pi-extension", "subagents", "subagent-mcp-control.ts");
const CAPABILITY_ACTIVATION = join(
  PROJECT_ROOT,
  "pi-extension",
  "subagents",
  "subagent-capability-activation.ts",
);
const CAPABILITY_ENV_KEYS = [
  "PI_CODING_AGENT_DIR",
  SUBAGENT_BUILTIN_TOOLS_ENV,
  SUBAGENT_CAPABILITY_VERSION_ENV,
  SUBAGENT_MCP_REFERENCES_ENV,
  SUBAGENT_MCP_SUPPORT_TOOLS_ENV,
] as const;

interface MarkerRecord {
  event: string;
  serverName: string;
  pid: number;
  method?: string;
  hasCredential?: boolean;
}

interface IsolatedRuntime {
  root: string;
  cwd: string;
  agentDir: string;
  notifications: string[];
  runtime: Awaited<ReturnType<typeof createAgentSessionRuntime>>;
}

const activeRuntimes: IsolatedRuntime[] = [];
const originalEnvironment = new Map<string, string | undefined>();

for (const key of CAPABILITY_ENV_KEYS) originalEnvironment.set(key, process.env[key]);

afterEach(async () => {
  while (activeRuntimes.length > 0) {
    const current = activeRuntimes.pop()!;
    await current.runtime.dispose().catch(() => undefined);
    rmSync(current.root, { recursive: true, force: true });
  }
  for (const [key, value] of originalEnvironment) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function readMarkers(path: string): MarkerRecord[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as MarkerRecord);
}

async function waitFor(
  description: string,
  predicate: () => boolean,
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
  assert.fail(`Timed out waiting for ${description}`);
}

function pidIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: any) {
    return error?.code !== "ESRCH";
  }
}

function writeMcpConfig(agentDir: string, mcpServers: Record<string, unknown>): string {
  const configPath = join(agentDir, "mcp.json");
  writeFileSync(configPath, `${JSON.stringify({ mcpServers }, null, 2)}\n`);
  return configPath;
}

/** Write a subagent-only global registry `mcp.json` under `<agentDir>/agents/.pi/`. */
function writeRegistryMcpConfig(agentDir: string, mcpServers: Record<string, unknown>): string {
  const registryRoot = join(agentDir, "agents", ".pi");
  mkdirSync(registryRoot, { recursive: true });
  return writeMcpConfig(registryRoot, mcpServers);
}

function resolveReferences(
  cwd: string,
  agentDir: string,
  names: string[],
  options: { globalRegistry?: boolean } = {},
): { references: McpServerReference[]; supportTools: McpSupportTool[] } {
  const resolution = resolveMcpServerReferences(
    names,
    {
      ...loadMcpConfigCatalog({ cwd, agentDir, projectTrusted: false }),
      ...(options.globalRegistry
        ? { registries: [loadMcpRegistrySource(join(agentDir, "agents", ".pi"), "global-registry")] }
        : {}),
    },
  );
  assert.ok(!("errors" in resolution), "fixture MCP configuration must resolve");
  return {
    references: resolution.serverReferences,
    supportTools: resolution.supportTools,
  };
}

async function startIsolatedRuntime(
  references: McpServerReference[],
  supportTools: McpSupportTool[],
  options: { root: string; cwd: string; agentDir: string; builtinTools?: string[] },
): Promise<IsolatedRuntime> {
  process.env.PI_CODING_AGENT_DIR = options.agentDir;
  process.env[SUBAGENT_CAPABILITY_VERSION_ENV] = "2";
  process.env[SUBAGENT_BUILTIN_TOOLS_ENV] = (options.builtinTools ?? []).join(",");
  process.env[SUBAGENT_MCP_REFERENCES_ENV] = encodeMcpServerReferences(references);
  process.env[SUBAGENT_MCP_SUPPORT_TOOLS_ENV] = supportTools.join(",");

  const createRuntime: CreateAgentSessionRuntimeFactory = async ({
    cwd,
    agentDir,
    sessionManager,
    sessionStartEvent,
  }) => {
    const services = await createAgentSessionServices({
      cwd,
      agentDir,
      settingsManager: SettingsManager.inMemory({}, { projectTrusted: false }),
      resourceLoaderOptions: {
        noExtensions: true,
        noSkills: true,
        noPromptTemplates: true,
        noThemes: true,
        noContextFiles: true,
        extensionFactories: [createCodemodeExtension(), createToolSearchExtension()],
        additionalExtensionPaths: [
          "builtin:codemode",
          "builtin:tool-search",
          MCP_CONTROL,
          CAPABILITY_ACTIVATION,
        ],
      },
    });
    return {
      ...(await createAgentSessionFromServices({
        services,
        sessionManager,
        sessionStartEvent,
        noTools: "builtin",
      })),
      services,
      diagnostics: services.diagnostics,
    };
  };

  const runtime = await createAgentSessionRuntime(createRuntime, {
    cwd: options.cwd,
    agentDir: options.agentDir,
    sessionManager: SessionManager.inMemory(options.cwd),
  });
  const notifications: string[] = [];
  await runtime.session.bindExtensions({
    mode: "rpc",
    uiContext: {
      notify(message: string, type?: string) {
        notifications.push(`${type ?? "info"}:${message}`);
      },
    } as any,
  });
  const isolated = { ...options, notifications, runtime };
  activeRuntimes.push(isolated);
  return isolated;
}

function makeIsolatedRoot(): { root: string; cwd: string; agentDir: string } {
  const root = mkdtempSync(join(tmpdir(), "pi-mcp-capability-"));
  const cwd = join(root, "project");
  const agentDir = join(root, "agent");
  mkdirSync(cwd, { recursive: true });
  mkdirSync(agentDir, { recursive: true });
  return { root, cwd, agentDir };
}

async function disposeAndAssertStopped(isolated: IsolatedRuntime, markerPath: string): Promise<void> {
  const started = readMarkers(markerPath).find((entry) => entry.event === "started");
  assert.ok(started, "selected fixture process must have started");
  await isolated.runtime.dispose();
  // Keep the disposed runtime tracked so afterEach still removes its isolated root.
  await waitFor("selected MCP fixture process shutdown", () => !pidIsAlive(started.pid));
  assert.ok(
    readMarkers(markerPath).some((entry) => entry.event === "stdin-ended" || entry.event === "sigterm"),
    "fixture must record an orderly transport shutdown",
  );
}

function assertNoCredentialArtifacts(root: string, credential: string): void {
  const visit = (path: string) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (entry.name !== "mcp.json") {
        assert.doesNotMatch(readFileSync(child, "utf8"), new RegExp(credential));
      }
    }
  };
  visit(root);
}

describe("filtered MCP child lifecycle", { concurrency: 1 }, () => {
  it("starts only selected ambient configuration and preserves Pi exposure and resources", async () => {
    const paths = makeIsolatedRoot();
    const selectedMarker = join(paths.root, "selected.jsonl");
    const ambientMarker = join(paths.root, "ambient.jsonl");
    const credential = `fixture-secret-${process.pid}-${Date.now()}`;
    const configPath = writeMcpConfig(paths.agentDir, {
      "selected-server": {
        command: process.execPath,
        args: [MCP_FIXTURE, selectedMarker, "selected"],
        env: { MCP_FIXTURE_CREDENTIAL: credential },
        exposure: "direct",
        description: "selected-config-description",
        toolExposure: {
          code: "codemode",
          deferred: "deferred",
          hidden: "hidden",
        },
      },
      "ambient-server": {
        command: process.execPath,
        args: [MCP_FIXTURE, ambientMarker, "ambient"],
        exposure: "direct",
        description: "ambient-config-description",
      },
    });
    const { references, supportTools } = resolveReferences(
      paths.cwd,
      paths.agentDir,
      ["selected-server"],
    );
    assert.deepEqual(supportTools, ["codemode", "tool-search"]);
    assert.equal(references[0].source, realpathSync(configPath));
    const capabilityPayload = encodeMcpServerReferences(references);
    assert.doesNotMatch(capabilityPayload, new RegExp(credential));
    assert.doesNotMatch(capabilityPayload, /MCP_FIXTURE_CREDENTIAL|mcp-marker-server/);

    const isolated = await startIsolatedRuntime(references, supportTools, paths);
    await waitFor("selected MCP tool registration", () =>
      isolated.runtime.session.getAllTools().some((tool) =>
        tool.name === "mcp__selected_server__direct"
      ));

    const session = isolated.runtime.session;
    const tools = session.getAllTools();
    const names = tools.map((tool) => tool.name);
    const active = session.getActiveToolNames();
    const callable = session.getCallableToolNames();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    assert.equal(existsSync(ambientMarker), false, "unselected ambient server must never start");
    assert.ok(readMarkers(selectedMarker).some((entry) => entry.event === "started"));
    assert.equal(
      readMarkers(selectedMarker).find((entry) => entry.event === "started")?.hasCredential,
      true,
      "selected server retains its runtime environment without copying it into capability state",
    );
    assert.ok(names.includes("mcp__selected_server__direct"));
    assert.ok(names.includes("mcp__selected_server__code"));
    assert.ok(names.includes("mcp__selected_server__deferred"));
    assert.ok(names.includes("mcp__selected_server__hidden"));
    assert.equal(names.some((name) => name.includes("ambient_server")), false);
    assert.equal(tools.some((tool) => tool.description.includes("ambient")), false);

    assert.equal(byName.get("mcp__selected_server__direct")?.exposure, "direct");
    // Pi represents configured codemode/deferred MCP tools as callable-but-undeclared
    // tools; the active codemode/tool_search support pair preserves the distinction.
    assert.equal(byName.get("mcp__selected_server__code")?.exposure, "deferred");
    assert.equal(byName.get("mcp__selected_server__deferred")?.exposure, "deferred");
    assert.equal(byName.get("mcp__selected_server__hidden")?.exposure, "hidden");
    for (const name of [
      "mcp__selected_server__direct",
      "mcp__selected_server__code",
      "mcp__selected_server__deferred",
      "mcp__selected_server__hidden",
    ]) {
      assert.equal(byName.get(name)?.sourceInfo.path, MCP_CONTROL);
    }
    assert.ok(active.includes("codemode"), `active tools: ${active.join(", ")}`);
    assert.ok(active.includes("tool_search"), `active tools: ${active.join(", ")}`);
    assert.ok(active.includes("mcp__selected_server__direct"));
    assert.equal(active.includes("mcp__selected_server__code"), false);
    assert.equal(active.includes("mcp__selected_server__deferred"), false);
    assert.equal(active.includes("mcp__selected_server__hidden"), false);
    assert.ok(callable.includes("mcp__selected_server__direct"));
    assert.ok(callable.includes("mcp__selected_server__code"));
    assert.ok(callable.includes("mcp__selected_server__deferred"));
    assert.equal(callable.includes("mcp__selected_server__hidden"), false);

    const preparedPrompt = await session.extensionRunner.emitBeforeAgentStart(
      "",
      undefined,
      session.extensionRunner.createCommandContext().getSystemPromptOptions(),
    );
    const mcpPromptSection = preparedPrompt.systemPromptOptions.sections.mcp_servers ?? "";
    assert.match(mcpPromptSection, /selected-server|selected-config-description/);
    assert.doesNotMatch(
      mcpPromptSection,
      /ambient-server|ambient-config-description|ambient-instructions/,
    );

    const directResult = await session.getToolDefinition("mcp__selected_server__direct")!.execute(
      "fixture-direct",
      {},
      undefined,
      undefined,
      undefined as any,
    );
    assert.match(JSON.stringify(directResult), /selected:direct/);

    for (const resourceTool of [
      "list_mcp_resources",
      "list_mcp_resource_templates",
      "read_mcp_resource",
    ]) {
      assert.ok(names.includes(resourceTool), `${resourceTool} must be registered`);
      assert.ok(active.includes(resourceTool), `${resourceTool} must follow selected direct exposure`);
    }
    const resourceList = await session.getToolDefinition("list_mcp_resources")!.execute(
      "fixture-resources",
      { server: "selected-server" },
      undefined,
      undefined,
      undefined as any,
    );
    assert.match(JSON.stringify(resourceList), /fixture:\/\/selected\/document/);
    assert.doesNotMatch(JSON.stringify(resourceList), /ambient/);
    const resourceRead = await session.getToolDefinition("read_mcp_resource")!.execute(
      "fixture-resource-read",
      { server: "selected-server", uri: "fixture://selected/document" },
      undefined,
      undefined,
      undefined as any,
    );
    assert.match(JSON.stringify(resourceRead), /selected-resource-content/);

    const requestedMethods = readMarkers(selectedMarker)
      .filter((entry) => entry.event === "request")
      .map((entry) => entry.method);
    for (const method of [
      "initialize",
      "tools/list",
      "resources/list",
      "resources/templates/list",
      "tools/call",
      "resources/read",
    ]) {
      assert.ok(requestedMethods.includes(method), `selected fixture must receive ${method}`);
    }

    await disposeAndAssertStopped(isolated, selectedMarker);
    assert.equal(existsSync(ambientMarker), false, "ambient marker remains absent after teardown");
    assert.equal(existsSync(join(paths.agentDir, "mcp-auth.json")), false);
    assertNoCredentialArtifacts(paths.root, credential);
  });

  it("starts a registry-only server in the child while the parent's ambient config never names it", async () => {
    const paths = makeIsolatedRoot();
    const registryMarker = join(paths.root, "registry.jsonl");
    const ambientMarker = join(paths.root, "ambient-shadowed.jsonl");
    writeMcpConfig(paths.agentDir, {
      shared: {
        command: process.execPath,
        args: [MCP_FIXTURE, ambientMarker, "ambient"],
        exposure: "direct",
      },
    });
    const registryPath = writeRegistryMcpConfig(paths.agentDir, {
      shared: {
        command: process.execPath,
        args: [MCP_FIXTURE, registryMarker, "registry"],
        exposure: "direct",
      },
    });
    const { references, supportTools } = resolveReferences(
      paths.cwd,
      paths.agentDir,
      ["shared"],
      { globalRegistry: true },
    );
    assert.deepEqual(references.map(({ scope, source }) => ({ scope, source })), [
      { scope: "global-registry", source: realpathSync(registryPath) },
    ]);
    // The parent's ambient catalog (global plus project mcp.json) never reads the registry.
    const ambientCatalog = loadMcpConfigCatalog({ cwd: paths.cwd, agentDir: paths.agentDir, projectTrusted: true });
    assert.notEqual(ambientCatalog.global.path, realpathSync(registryPath));

    const isolated = await startIsolatedRuntime(references, supportTools, paths);
    await waitFor("registry MCP tool registration", () =>
      isolated.runtime.session.getAllTools().some((tool) => tool.name === "mcp__shared__direct"));
    const directResult = await isolated.runtime.session.getToolDefinition("mcp__shared__direct")!.execute(
      "fixture-registry-direct",
      {},
      undefined,
      undefined,
      undefined as any,
    );
    assert.match(JSON.stringify(directResult), /registry:direct/);
    assert.equal(existsSync(ambientMarker), false, "the shadowed ambient server must never start");
    await disposeAndAssertStopped(isolated, registryMarker);
  });

  it("finds OAuth credentials for a registry server in the shared agent-dir credential store", async () => {
    const paths = makeIsolatedRoot();
    const authorizations: Array<string | undefined> = [];
    let authServer: Server | undefined;
    try {
      authServer = createServer((request, response) => {
        authorizations.push(request.headers.authorization);
        response.writeHead(401, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "unauthorized" }));
      });
      await new Promise<void>((resolvePromise, reject) => {
        authServer!.once("error", reject);
        authServer!.listen(0, "127.0.0.1", resolvePromise);
      });
      const address = authServer.address();
      assert.ok(address && typeof address === "object");
      const url = `http://127.0.0.1:${address.port}/mcp`;
      writeRegistryMcpConfig(paths.agentDir, {
        "registry-oauth": { url, exposure: "direct", timeout: 1 },
      });
      // Pi stores MCP OAuth state in <agentDir>/mcp-auth.json keyed by server
      // namespace and URL, independent of which mcp.json defined the server.
      const token = `registry-token-${process.pid}`;
      writeFileSync(join(paths.agentDir, "mcp-auth.json"), JSON.stringify({
        [`mcp__registry_oauth|${new URL(url).toString()}`]: { tokens: { access_token: token, token_type: "Bearer" } },
      }));
      const resolved = resolveReferences(paths.cwd, paths.agentDir, ["registry-oauth"], { globalRegistry: true });
      await startIsolatedRuntime(resolved.references, resolved.supportTools, paths);
      await waitFor("authorized registry MCP request", () => authorizations.length > 0);
      assert.equal(authorizations[0], `Bearer ${token}`);
    } finally {
      await new Promise<void>((resolvePromise) => authServer?.close(() => resolvePromise()) ?? resolvePromise());
    }
  });

  it("keeps valid connection and authentication failures on Pi's diagnostic path", async () => {
    const connectionPaths = makeIsolatedRoot();
    writeMcpConfig(connectionPaths.agentDir, {
      unavailable: {
        command: join(connectionPaths.root, "missing-mcp-command"),
        exposure: "direct",
        timeout: 1,
      },
    });
    const unavailable = resolveReferences(
      connectionPaths.cwd,
      connectionPaths.agentDir,
      ["unavailable"],
    );
    const connectionRuntime = await startIsolatedRuntime(
      unavailable.references,
      unavailable.supportTools,
      connectionPaths,
    );
    await waitFor("Pi-native MCP connection diagnostic", () =>
      connectionRuntime.notifications.some((message) => /unavailable:\s+failed:/i.test(message))
    );
    assert.equal(connectionRuntime.runtime.session.getAllTools().some((tool) => tool.name.startsWith("mcp__unavailable__")), false);

    const authPaths = makeIsolatedRoot();
    const requests: string[] = [];
    let authServer: Server | undefined;
    try {
      authServer = createServer((request, response) => {
        requests.push(`${request.method} ${request.url}`);
        const address = authServer!.address();
        assert.ok(address && typeof address === "object");
        response.writeHead(401, {
          "content-type": "application/json",
          "www-authenticate": `Bearer resource_metadata="http://127.0.0.1:${address.port}/.well-known/oauth-protected-resource"`,
        });
        response.end(JSON.stringify({ error: "unauthorized" }));
      });
      await new Promise<void>((resolvePromise, reject) => {
        authServer!.once("error", reject);
        authServer!.listen(0, "127.0.0.1", resolvePromise);
      });
      const address = authServer.address();
      assert.ok(address && typeof address === "object");
      writeMcpConfig(authPaths.agentDir, {
        "auth-required": {
          url: `http://127.0.0.1:${address.port}/mcp`,
          exposure: "direct",
          timeout: 1,
        },
      });
      const auth = resolveReferences(authPaths.cwd, authPaths.agentDir, ["auth-required"]);
      const authRuntime = await startIsolatedRuntime(auth.references, auth.supportTools, authPaths);
      await waitFor("Pi-native MCP authentication diagnostic", () =>
        authRuntime.notifications.some((message) => /needs sign-in/i.test(message))
      );
      assert.ok(requests.length > 0, "local auth fixture must receive the MCP connection attempt");
      assert.ok(
        !existsSync(join(authPaths.agentDir, "mcp-auth.json")) ||
          resolve(join(authPaths.agentDir, "mcp-auth.json")).startsWith(resolve(authPaths.root)),
        "any empty Pi OAuth store remains inside the disposable root",
      );
    } finally {
      await new Promise<void>((resolvePromise) => authServer?.close(() => resolvePromise()) ?? resolvePromise());
    }
  });
});
