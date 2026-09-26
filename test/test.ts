import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  mkdirSync,
  realpathSync,
  rmSync,
  existsSync,
  symlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createAgentSession,
  DefaultPackageManager,
  DefaultResourceLoader,
  SessionManager as PiSessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import * as subagentsModule from "../pi-extension/subagents/index.ts";
import {
  discoverAgentDefinitions,
  parseAgentDefinition,
} from "../pi-extension/subagents/agents.ts";

import {
  getLeafId,
  getNewEntries,
  countSessionEntryLines,
  getSessionId,
  readNameRegistry,
  readSubagentLoadout,
  registerName,
  resolveNameInRegistry,
  nameRegistryPath,
  writeSubagentLoadout,
  loadoutSidecarPath,
  type SubagentLoadout,
  resetSessionIndexCache,
  resolveSessionFileById,
  findLastAssistantMessage,
  appendBranchSummary,
  copySessionFile,
  mergeNewEntries,
  seedSubagentSessionFile,
  summarizeSessionStats,
} from "../pi-extension/subagents/session.ts";

import { pollForExit, shellEscape, submitText } from "../pi-extension/subagents/tmux.ts";
import {
  agyAdditionalWorkspaceRoots,
  agyAgentDefinitionPath,
  buildAgyAgentName,
  buildAgyCommand,
  deriveAgyAdditionalWorkspaceRoots,
  isAgyResumeState,
  parseAgyResult,
  readAgyResumeState,
  serializeAgyAgent,
  translateAgyTools,
  validateAgyReplayState,
  writeAgyAgent,
  writeAgyResumeState,
  type AgyResumeState,
  type AgyResumeStateV1,
  type AgyResumeStateV2,
} from "../pi-extension/subagents/agy.ts";
import {
  advanceStatusState,
  capStatusLines,
  classifyStatus,
  createStatusState,
  forceStatusAfterInterrupt,
  formatStatusAggregate,
  formatStatusLine,
  formatTransitionLine,
  observeStatus,
  loadStatusConfig,
  parseStatusConfig,
} from "../pi-extension/subagents/status.ts";
import {
  createSubagentActivityRecorder,
  getSubagentActivityFile,
  readSubagentActivityFile,
} from "../pi-extension/subagents/activity.ts";
import {
  shouldMarkUserTookOver,
  shouldFinalizeOnAgentSettled,
  findLatestAssistantError,
  runningChildrenCount,
} from "../pi-extension/subagents/subagent-runtime-control.ts";
import subagentRuntimeControlExtension from "../pi-extension/subagents/subagent-runtime-control.ts";
import capabilityActivationExtension, {
  resolveProfileActiveTools,
  SUBAGENT_BUILTIN_TOOLS_ENV,
} from "../pi-extension/subagents/subagent-capability-activation.ts";
import { __pollForExitTest__ } from "../pi-extension/subagents/tmux.ts";
import {
  QUESTION_ANSWER_PREFIX,
  QUESTION_PROTOCOL_VERSION,
  createQuestionId,
  encodeQuestionAnswer,
  parseQuestionAnswer,
  parseQuestionRequest,
  questionAcknowledgmentPath,
  questionRequestPath,
  readQuestionAcknowledgment,
  readQuestionRequest,
  writeQuestionAcknowledgment,
  writeQuestionRequest,
} from "../pi-extension/subagents/question-protocol.ts";

// --- Helpers ---

function createTestDir(): string {
  return mkdtempSync(join(tmpdir(), "subagents-test-"));
}

function createSessionFile(dir: string, entries: object[]): string {
  const file = join(dir, "test-session.jsonl");
  const content = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  writeFileSync(file, content);
  return file;
}

function withTempDir(run: (dir: string) => void) {
  const dir = createTestDir();
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function createMockExtensionApi() {
  const registeredTools: Array<any> = [];
  const registeredCommands: Array<any> = [];
  const registeredMessageRenderers: Array<any> = [];
  const sentUserMessages: string[] = [];
  const sentMessages: Array<any> = [];
  return {
    registeredTools,
    registeredCommands,
    registeredMessageRenderers,
    sentUserMessages,
    sentMessages,
    api: {
      on() {},
      registerTool(tool: any) {
        registeredTools.push(tool);
      },
      registerCommand(name: string, command: any) {
        registeredCommands.push({ name, ...command });
      },
      registerMessageRenderer(name: string, renderer: any) {
        registeredMessageRenderers.push({ name, renderer });
      },
      registerShortcut() {},
      sendUserMessage(message: string) {
        sentUserMessages.push(message);
      },
      sendMessage(message: any, options?: any) {
        sentMessages.push({ message, options });
      },
      getAllTools() {
        return [];
      },
    } as any,
  };
}

function createMockContext(cwd = process.cwd(), trusted = true) {
  return {
    cwd,
    isProjectTrusted() {
      return trusted;
    },
    sessionManager: {
      getSessionFile() {
        return null;
      },
      getSessionId() {
        return "test-session";
      },
      getSessionDir() {
        return cwd;
      },
    },
    ui: { notify() {} },
  } as any;
}

function restoreEnvVar(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

function withMockedNow<T>(now: number, fn: () => T): T {
  const originalNow = Date.now;
  Date.now = () => now;
  try {
    return fn();
  } finally {
    Date.now = originalNow;
  }
}

function writeAgentFile(
  agentsDir: string,
  name: string,
  frontmatter: string,
  body = "You are a test agent.",
) {
  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(join(agentsDir, `${name}.md`), `---\n${frontmatter}\n---\n\n${body}\n`);
}

function writePackageFixture(packageRoot: string, extensionPaths: readonly string[]) {
  mkdirSync(packageRoot, { recursive: true });
  writeFileSync(
    join(packageRoot, "package.json"),
    JSON.stringify({
      name: "profile-extension-fixture",
      version: "1.0.0",
      pi: { extensions: extensionPaths },
    }),
  );
  for (const extensionPath of extensionPaths) {
    const absolutePath = join(packageRoot, extensionPath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, "export default function () {}\n");
  }
}

async function withIsolatedAgentEnv(
  fn: (paths: {
    projectDir: string;
    projectAgentsDir: string;
    globalDir: string;
    globalAgentsDir: string;
  }) => Promise<void> | void,
) {
  const root = createTestDir();
  const previousCwd = process.cwd();
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  const projectDir = join(root, "project");
  const projectAgentsDir = join(projectDir, ".pi", "agents");
  const globalDir = join(root, "global");
  const globalAgentsDir = join(globalDir, "agents");

  mkdirSync(projectAgentsDir, { recursive: true });
  mkdirSync(globalAgentsDir, { recursive: true });
  process.chdir(projectDir);
  process.env.PI_CODING_AGENT_DIR = globalDir;

  try {
    await fn({ projectDir, projectAgentsDir, globalDir, globalAgentsDir });
  } finally {
    process.chdir(previousCwd);
    restoreEnvVar("PI_CODING_AGENT_DIR", previousAgentDir);
    rmSync(root, { recursive: true, force: true });
  }
}
const SESSION_HEADER = { type: "session", id: "sess-001", version: 3 };
const MODEL_CHANGE = { type: "model_change", id: "mc-001", parentId: null };
const USER_MSG = {
  type: "message",
  id: "user-001",
  parentId: "mc-001",
  message: {
    role: "user",
    content: [{ type: "text", text: "Hello, plan something" }],
  },
};
const ASSISTANT_MSG = {
  type: "message",
  id: "asst-001",
  parentId: "user-001",
  message: {
    role: "assistant",
    content: [{ type: "text", text: "Here is my plan..." }],
  },
};
const ASSISTANT_MSG_2 = {
  type: "message",
  id: "asst-002",
  parentId: "asst-001",
  message: {
    role: "assistant",
    content: [
      { type: "thinking", thinking: "Let me think..." },
      { type: "text", text: "Updated plan with details." },
    ],
  },
};
const TOOL_RESULT = {
  type: "message",
  id: "tool-001",
  parentId: "asst-001",
  message: {
    role: "toolResult",
    toolCallId: "tc-001",
    toolName: "bash",
    content: [{ type: "text", text: "output here" }],
  },
};

// --- Tests ---

describe("session.ts", () => {
  let dir: string;

  before(() => {
    dir = createTestDir();
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe("getLeafId", () => {
    it("returns last entry id", () => {
      const file = createSessionFile(dir, [SESSION_HEADER, MODEL_CHANGE, USER_MSG, ASSISTANT_MSG]);
      assert.equal(getLeafId(file), "asst-001");
    });

    it("returns null for empty file", () => {
      const file = join(dir, "empty.jsonl");
      writeFileSync(file, "");
      assert.equal(getLeafId(file), null);
    });
  });

  describe("getNewEntries", () => {
    it("returns entries after a given line", () => {
      const file = createSessionFile(dir, [SESSION_HEADER, MODEL_CHANGE, USER_MSG, ASSISTANT_MSG]);
      const entries = getNewEntries(file, 2);
      assert.equal(entries.length, 2);
      assert.equal(entries[0].id, "user-001");
      assert.equal(entries[1].id, "asst-001");
    });

    it("returns empty array when no new entries", () => {
      const file = createSessionFile(dir, [SESSION_HEADER, MODEL_CHANGE]);
      const entries = getNewEntries(file, 2);
      assert.equal(entries.length, 0);
    });

    it("countSessionEntryLines matches getNewEntries(0).length without parsing", () => {
      const file = createSessionFile(dir, [SESSION_HEADER, MODEL_CHANGE, USER_MSG, ASSISTANT_MSG]);
      assert.equal(countSessionEntryLines(file), getNewEntries(file, 0).length);
      assert.equal(countSessionEntryLines(file), 4);
    });

    it("countSessionEntryLines ignores blank lines and returns 0 for missing files", () => {
      const file = join(dir, "blanks.jsonl");
      writeFileSync(file, JSON.stringify({ type: "session", id: "x" }) + "\n\n\n");
      assert.equal(countSessionEntryLines(file), 1);
      assert.equal(countSessionEntryLines(join(dir, "does-not-exist.jsonl")), 0);
    });
  });

  describe("getSessionId / resolveSessionFileById", () => {
    function writeSession(d: string, fname: string, id: string): string {
      const p = join(d, fname);
      writeFileSync(p, JSON.stringify({ type: "session", id, version: 3 }) + "\n");
      return p;
    }

    // The resolver caches an id→file index per root; reset it so each test
    // builds a fresh index from the current on-disk state.
    beforeEach(() => {
      resetSessionIndexCache();
    });

    it("reads the header id from a session file", () => {
      const file = createSessionFile(dir, [SESSION_HEADER, MODEL_CHANGE, USER_MSG]);
      assert.equal(getSessionId(file), "sess-001");
    });

    it("returns null for a file without a session header", () => {
      const file = createSessionFile(dir, [USER_MSG]);
      assert.equal(getSessionId(file), null);
    });

    it("resolves a session file by exact id under the root", () => {
      const a = writeSession(dir, "a.jsonl", "019f-aaaa");
      writeSession(dir, "b.jsonl", "019f-bbbb");
      assert.equal(resolveSessionFileById("019f-aaaa", dir), a);
    });

    it("resolves a session file by id prefix", () => {
      const a = writeSession(dir, "p.jsonl", "019f-prefix-match");
      assert.equal(resolveSessionFileById("019f-prefix", dir), a);
    });

    it("returns null when no session matches", () => {
      writeSession(dir, "c.jsonl", "abc");
      assert.equal(resolveSessionFileById("zzz", dir), null);
    });

    it("picks up newly added sessions on repeat calls without a reset", () => {
      // Prime the index (first call builds it).
      writeSession(dir, "first.jsonl", "id-first");
      assert.equal(resolveSessionFileById("id-first", dir) !== null, true);
      // Add a new session AFTER the index was built — no reset. The resolver's
      // cheap refresh should index it.
      const b = writeSession(dir, "second.jsonl", "id-second");
      assert.equal(resolveSessionFileById("id-second", dir), b);
    });
  });

  describe("subagent loadout snapshot", () => {
    const legacySample: SubagentLoadout = {
      agent: "implementer",
      toolAllowlist: "read,write,edit,custom_tool,web_search,subagent,subagent_message,subagents_list,ask_question",
      extensionPaths: ["/extensions/custom-tool.ts", "/extensions/web-search.ts"],
      model: "openrouter/z-ai/glm-5.2",
      thinking: "medium",
      systemPromptMode: "append",
      identity: "You are an implementer agent.",
      spawnable: ["inspector", "analyst"],
      autoExit: true,
      cwd: "/work/dir",
      agentDir: "/home/u/.pi/agent",
    };
    const versionedSample: SubagentLoadout = {
      version: 1,
      capabilityMode: "extension-grants",
      agent: "researcher",
      builtinTools: ["read", "grep"],
      extensionPaths: ["/extensions/web-search.ts", "/extensions/codex-search.ts"],
      grantSpawning: true,
      model: "cursor/research-model",
      thinking: "high",
      systemPromptMode: "replace",
      identity: "You are a researcher agent.",
      spawnable: ["scout"],
      autoExit: true,
      cwd: "/work/research",
      agentDir: "/home/u/.pi/agent",
    };

    it("writes the versioned sidecar next to the session file", () => {
      const sf = join(dir, "s1.jsonl");
      writeSubagentLoadout(sf, versionedSample);
      assert.equal(loadoutSidecarPath(sf), sf + ".loadout.json");
      assert.ok(existsSync(sf + ".loadout.json"));
    });

    it("round-trips new versioned and valid legacy strict loadouts", () => {
      for (const [name, sample] of [["versioned", versionedSample], ["legacy", legacySample]] as const) {
        const sf = join(dir, `${name}.jsonl`);
        writeSubagentLoadout(sf, sample);
        assert.deepEqual(readSubagentLoadout(sf), sample);
      }
    });

    it("reads a legacy strict sidecar without rewriting it", () => {
      const sf = join(dir, "legacy-preserved.jsonl");
      const original = JSON.stringify(legacySample, null, 2) + "\n";
      writeFileSync(loadoutSidecarPath(sf), original, "utf8");
      assert.deepEqual(readSubagentLoadout(sf), legacySample);
      assert.equal(readFileSync(loadoutSidecarPath(sf), "utf8"), original);
    });

    it("returns null when the sidecar is absent", () => {
      assert.equal(readSubagentLoadout(join(dir, "missing.jsonl")), null);
    });

    it("rejects corrupt, unknown, incomplete, and mixed snapshot modes", () => {
      const corrupt = join(dir, "corrupt.jsonl");
      writeFileSync(corrupt + ".loadout.json", "not json{", "utf8");
      assert.equal(readSubagentLoadout(corrupt), null);

      const cases = [
        { ...versionedSample, version: 2 },
        { ...versionedSample, capabilityMode: "strict-tools" },
        { ...versionedSample, capabilityMode: undefined },
        { ...versionedSample, toolAllowlist: "read" },
        { ...legacySample, version: 1 },
        { ...legacySample, extensionPaths: undefined },
        { ...legacySample, autoExit: "yes" },
        { ...legacySample, toolAllowlist: null },
        { ...versionedSample, unexpected: true },
      ];
      for (const [index, value] of cases.entries()) {
        const sf = join(dir, `invalid-mode-${index}.jsonl`);
        writeFileSync(sf + ".loadout.json", JSON.stringify(value), "utf8");
        assert.equal(readSubagentLoadout(sf), null, `expected case ${index} to fail closed`);
      }
    });

    it("rejects malformed built-ins and versioned extension paths", () => {
      const cases = [
        { builtinTools: ["read", "unknown"] },
        { builtinTools: ["read", "read"] },
        { builtinTools: "read" },
        { extensionPaths: ["relative/extension.ts"] },
        { extensionPaths: ["/extensions/a.ts", "/extensions/a.ts"] },
        { extensionPaths: ["/extensions/../extensions/a.ts"] },
      ];
      for (const [index, overrides] of cases.entries()) {
        const sf = join(dir, `invalid-capability-${index}.jsonl`);
        writeFileSync(
          sf + ".loadout.json",
          JSON.stringify({ ...versionedSample, ...overrides }),
          "utf8",
        );
        assert.equal(readSubagentLoadout(sf), null, `expected case ${index} to fail closed`);
      }
    });

    it("rejects inconsistent nesting in both snapshot modes", () => {
      const cases = [
        { ...versionedSample, grantSpawning: false },
        { ...versionedSample, spawnable: null },
        { ...versionedSample, spawnable: [] },
        { ...versionedSample, spawnable: ["   "] },
        { ...legacySample, spawnable: null },
        { ...legacySample, spawnable: [] },
        { ...legacySample, toolAllowlist: "read,subagent,ask_question" },
        { ...legacySample, toolAllowlist: "read,ask_question" },
      ];

      for (const [index, value] of cases.entries()) {
        const sf = join(dir, `spawn-mismatch-${index}.jsonl`);
        writeFileSync(sf + ".loadout.json", JSON.stringify(value), "utf8");
        assert.equal(readSubagentLoadout(sf), null, `expected case ${index} to fail closed`);
      }
    });
  });

  describe("subagent name registry", () => {
    it("registers and resolves a name to its session file", () => {
      const adir = join(dir, "art-1");
      registerName(adir, "implementer", { sessionFile: "/s/implementer.jsonl", sessionId: "id-implementer" });
      const entry = resolveNameInRegistry(adir, "implementer");
      assert.deepEqual(entry, { sessionFile: "/s/implementer.jsonl", sessionId: "id-implementer" });
      assert.ok(existsSync(nameRegistryPath(adir)));
    });

    it("accumulates multiple names and overwrites on re-register", () => {
      const adir = join(dir, "art-2");
      registerName(adir, "inspector", { sessionFile: "/s/inspector.jsonl", sessionId: "id-inspector" });
      registerName(adir, "inspector-2", { sessionFile: "/s/inspector2.jsonl", sessionId: "id-inspector2" });
      const reg = readNameRegistry(adir);
      assert.deepEqual(Object.keys(reg).sort(), ["inspector", "inspector-2"]);
      // Overwrite inspector with a new session file.
      registerName(adir, "inspector", { sessionFile: "/s/inspector-new.jsonl", sessionId: "id-inspector-new" });
      assert.equal(resolveNameInRegistry(adir, "inspector")!.sessionFile, "/s/inspector-new.jsonl");
    });

    it("returns null for unknown names and {} for a missing/corrupt registry", () => {
      const adir = join(dir, "art-3");
      assert.equal(resolveNameInRegistry(adir, "nope"), null);
      assert.deepEqual(readNameRegistry(adir), {});
      mkdirSync(adir, { recursive: true });
      writeFileSync(nameRegistryPath(adir), "not json{", "utf8");
      assert.deepEqual(readNameRegistry(adir), {});
    });

    it("persists special property names without mutating the registry prototype", () => {
      const adir = join(dir, "art-special-name");
      const entry = { sessionFile: "/s/proto.jsonl", sessionId: "id-proto" };
      registerName(adir, "__proto__", entry);

      const registry = readNameRegistry(adir);
      assert.deepEqual(Object.keys(registry), ["__proto__"]);
      assert.deepEqual(resolveNameInRegistry(adir, "__proto__"), entry);
      assert.equal(Object.getPrototypeOf(registry), Object.prototype);
    });
  });

  describe("AGY registry entries", () => {
    it("round-trips tagged AGY entries without changing legacy Pi entries", () => {
      const adir = join(dir, "art-agy");
      const piEntry = { sessionFile: "/sessions/pi.jsonl", sessionId: "pi-id" };
      const agyEntry = { harness: "agy" as const, stateFile: "/artifacts/agy/state.json" };
      registerName(adir, "pi-child", piEntry);
      registerName(adir, "agy-child", agyEntry);
      assert.deepEqual(resolveNameInRegistry(adir, "pi-child"), piEntry);
      assert.deepEqual(resolveNameInRegistry(adir, "agy-child"), agyEntry);
    });

    it("rejects mixed or malformed registry entries fail-closed", () => {
      const adir = join(dir, "art-agy-invalid");
      mkdirSync(adir, { recursive: true });
      writeFileSync(nameRegistryPath(adir), JSON.stringify({
        child: { harness: "agy", stateFile: "relative.json", sessionFile: "/bad" },
      }));
      assert.deepEqual(readNameRegistry(adir), {});
    });
  });

  describe("findLastAssistantMessage", () => {
    it("finds last assistant text", () => {
      const entries = [USER_MSG, ASSISTANT_MSG, ASSISTANT_MSG_2] as any[];
      const text = findLastAssistantMessage(entries);
      assert.equal(text, "Updated plan with details.");
    });

    it("skips thinking blocks, gets text only", () => {
      const entries = [ASSISTANT_MSG_2] as any[];
      const text = findLastAssistantMessage(entries);
      assert.equal(text, "Updated plan with details.");
    });

    it("skips tool results", () => {
      const entries = [ASSISTANT_MSG, TOOL_RESULT] as any[];
      const text = findLastAssistantMessage(entries);
      assert.equal(text, "Here is my plan...");
    });

    it("returns null when no assistant messages", () => {
      const entries = [USER_MSG] as any[];
      assert.equal(findLastAssistantMessage(entries), null);
    });

    it("returns null for empty array", () => {
      assert.equal(findLastAssistantMessage([]), null);
    });

    it("skips empty assistant messages and returns real content above", () => {
      const realMsg = {
        type: "message",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Real summary content." }],
        },
      };
      const emptyMsg = {
        type: "message",
        message: {
          role: "assistant",
          content: [],
        },
      };
      const entries = [realMsg, emptyMsg] as any[];
      assert.equal(findLastAssistantMessage(entries), "Real summary content.");
    });

    it("surfaces errorMessage when last assistant ended with stopReason=error and no text", () => {
      // Reproduces the overload-exhaustion case: an earlier turn looked
      // normal, then the provider went 529 and auto-retry gave up. Without
      // the errorMessage fallback we'd return the stale earlier summary and
      // the orchestrator would believe the subagent completed.
      const earlierGood = {
        type: "message",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Investigating the bug..." }],
        },
      };
      const overloadError = {
        type: "message",
        message: {
          role: "assistant",
          content: [],
          stopReason: "error",
          errorMessage: "Anthropic 529 Overloaded after 3 retries",
        },
      };
      const entries = [earlierGood, overloadError] as any[];
      assert.equal(
        findLastAssistantMessage(entries),
        "Subagent error: Anthropic 529 Overloaded after 3 retries",
      );
    });

    it("prefers text content even when an error stopReason is set", () => {
      // If the model produced text before the error (rare but possible), we
      // prefer the actual content over the synthetic error fallback.
      const msg = {
        type: "message",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Here is partial output." }],
          stopReason: "error",
          errorMessage: "stream interrupted",
        },
      };
      assert.equal(findLastAssistantMessage([msg] as any[]), "Here is partial output.");
    });

    it("does not invent a summary for a stop=error message with no errorMessage", () => {
      const msg = {
        type: "message",
        message: {
          role: "assistant",
          content: [],
          stopReason: "error",
        },
      };
      assert.equal(findLastAssistantMessage([msg] as any[]), null);
    });
  });

  describe("appendBranchSummary", () => {
    it("appends valid branch_summary entry", () => {
      const file = createSessionFile(dir, [SESSION_HEADER, USER_MSG, ASSISTANT_MSG]);
      const id = appendBranchSummary(file, "user-001", "asst-001", "The plan was created.");

      assert.ok(id, "should return an id");
      assert.equal(typeof id, "string");

      // Read back and verify
      const lines = readFileSync(file, "utf8").trim().split("\n");
      assert.equal(lines.length, 4); // 3 original + 1 summary

      const summary = JSON.parse(lines[3]);
      assert.equal(summary.type, "branch_summary");
      assert.equal(summary.id, id);
      assert.equal(summary.parentId, "user-001");
      assert.equal(summary.fromId, "asst-001");
      assert.equal(summary.summary, "The plan was created.");
      assert.ok(summary.timestamp);
    });

    it("uses branchPointId as fromId fallback", () => {
      const file = createSessionFile(dir, [SESSION_HEADER]);
      appendBranchSummary(file, "branch-pt", null, "summary");

      const lines = readFileSync(file, "utf8").trim().split("\n");
      const summary = JSON.parse(lines[1]);
      assert.equal(summary.fromId, "branch-pt");
    });
  });

  describe("copySessionFile", () => {
    it("creates a copy with different path", () => {
      const file = createSessionFile(dir, [SESSION_HEADER, USER_MSG]);
      const copyDir = join(dir, "copies");
      mkdirSync(copyDir, { recursive: true });
      const copy = copySessionFile(file, copyDir);

      assert.notEqual(copy, file);
      assert.ok(copy.endsWith(".jsonl"));
      assert.equal(readFileSync(copy, "utf8"), readFileSync(file, "utf8"));
    });
  });

  describe("seedSubagentSessionFile", () => {
    it("creates a lineage-only child session with parent linkage and no copied turns", () => {
      const parentFile = createSessionFile(dir, [SESSION_HEADER, MODEL_CHANGE, USER_MSG, ASSISTANT_MSG]);
      const childFile = join(dir, "lineage-child.jsonl");

      seedSubagentSessionFile({
        mode: "lineage-only",
        parentSessionFile: parentFile,
        childSessionFile: childFile,
        childCwd: "/tmp/child-cwd",
      });

      const lines = readFileSync(childFile, "utf8").trim().split("\n");
      assert.equal(lines.length, 1);

      const header = JSON.parse(lines[0]);
      assert.equal(header.type, "session");
      assert.equal(header.parentSession, parentFile);
      assert.equal(header.cwd, "/tmp/child-cwd");
    });

    it("creates a forked child session with copied context before the triggering user turn", () => {
      const parentFile = createSessionFile(dir, [SESSION_HEADER, MODEL_CHANGE, USER_MSG, ASSISTANT_MSG]);
      const childFile = join(dir, "fork-child.jsonl");

      seedSubagentSessionFile({
        mode: "fork",
        parentSessionFile: parentFile,
        childSessionFile: childFile,
        childCwd: "/tmp/fork-child-cwd",
      });

      const entries = readFileSync(childFile, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      assert.equal(entries.length, 2);
      assert.equal(entries[0].type, "session");
      assert.equal(entries[0].parentSession, parentFile);
      assert.equal(entries[0].cwd, "/tmp/fork-child-cwd");
      assert.equal(entries[1].type, "model_change");
      assert.equal(entries.some((entry) => entry.type === "session" && entry.parentSession !== parentFile), false);
      assert.equal(entries.some((entry) => entry.type === "message"), false);
    });
  });

  describe("mergeNewEntries", () => {
    it("appends new entries from source to target", () => {
      // Source starts with same base (2 entries), then has 1 new entry
      const sourceFile = join(dir, "merge-source.jsonl");
      const targetFile = join(dir, "merge-target.jsonl");
      writeFileSync(
        sourceFile,
        [SESSION_HEADER, USER_MSG, ASSISTANT_MSG].map((e) => JSON.stringify(e)).join("\n") + "\n",
      );
      writeFileSync(
        targetFile,
        [SESSION_HEADER, USER_MSG].map((e) => JSON.stringify(e)).join("\n") + "\n",
      );

      // Merge entries after line 2 (the shared base)
      const merged = mergeNewEntries(sourceFile, targetFile, 2);
      assert.equal(merged.length, 1);
      assert.equal(merged[0].id, "asst-001");

      // Target should now have 3 entries
      const targetLines = readFileSync(targetFile, "utf8").trim().split("\n");
      assert.equal(targetLines.length, 3);
    });
  });

  describe("summarizeSessionStats", () => {
    const asstWithUsage = (id: string, opts: {
      model?: string;
      tools?: string[];
      usage?: Record<string, unknown>;
    }) => ({
      type: "message",
      id,
      parentId: "user-001",
      message: {
        role: "assistant",
        ...(opts.model ? { model: opts.model } : {}),
        content: [
          { type: "text", text: "ok" },
          ...(opts.tools ?? []).map((name, i) => ({ type: "toolCall", name, id: `${id}-tc${i}` })),
        ],
        ...(opts.usage ? { usage: opts.usage } : {}),
      },
    });

    it("aggregates tokens/cost cumulatively and tracks last context size", () => {
      const file = createSessionFile(dir, [
        SESSION_HEADER,
        { type: "model_change", id: "mc-001", parentId: null, modelId: "claude-sonnet-4-6" },
        USER_MSG,
        asstWithUsage("a1", {
          tools: ["read", "grep"],
          usage: { input: 100, output: 50, cacheRead: 1000, cacheWrite: 200, totalTokens: 1350, cost: { total: 0.01 } },
        }),
        asstWithUsage("a2", {
          tools: ["write"],
          usage: { input: 30, output: 70, cacheRead: 2000, cacheWrite: 0, totalTokens: 3500, cost: { total: 0.02 } },
        }),
      ]);
      const stats = summarizeSessionStats(file)!;
      assert.equal(stats.model, "claude-sonnet-4-6");
      assert.equal(stats.toolCount, 3);
      assert.equal(stats.inputTokens, 130);
      assert.equal(stats.outputTokens, 120);
      assert.equal(stats.cacheReadTokens, 3000);
      assert.equal(stats.cacheWriteTokens, 200);
      // contextTokens is the LAST assistant turn's totalTokens, not the sum.
      assert.equal(stats.contextTokens, 3500);
      assert.ok(Math.abs(stats.cost - 0.03) < 1e-9);
    });

    it("prefers per-message model over model_change", () => {
      const file = createSessionFile(dir, [
        SESSION_HEADER,
        { type: "model_change", id: "mc-001", parentId: null, modelId: "claude-haiku-4-5" },
        asstWithUsage("a1", { model: "claude-sonnet-4-6", usage: { totalTokens: 10, cost: { total: 0 } } }),
      ]);
      assert.equal(summarizeSessionStats(file)!.model, "claude-sonnet-4-6");
    });

    it("handles missing usage gracefully", () => {
      const file = createSessionFile(dir, [SESSION_HEADER, USER_MSG, ASSISTANT_MSG]);
      const stats = summarizeSessionStats(file)!;
      assert.equal(stats.toolCount, 0);
      assert.equal(stats.inputTokens, 0);
      assert.equal(stats.cost, 0);
      assert.equal(stats.contextTokens, 0);
    });

    it("returns null for an unreadable file", () => {
      assert.equal(summarizeSessionStats(join(dir, "does-not-exist.jsonl")), null);
    });
  });
});

describe("status.ts", () => {
  it("parses strict config objects", () => {
    const disabled = parseStatusConfig({ status: { enabled: false } });

    assert.deepEqual(disabled, {
      enabled: false,
      lineLimit: 4,
    });
  });

  it("loads a valid config file", () => {
    const examplePath = fileURLToPath(new URL("../config.json.example", import.meta.url));
    const config = loadStatusConfig(examplePath);

    assert.deepEqual(config, {
      enabled: true,
      lineLimit: 4,
    });
  });

  it("loads the shared example when local config is absent", () => {
    withTempDir((dir) => {
      const examplePath = join(dir, "config.json.example");
      writeFileSync(
        examplePath,
        JSON.stringify({ status: { enabled: true } }, null, 2) + "\n",
      );

      const config = loadStatusConfig(join(dir, "config.json"), examplePath);

      assert.deepEqual(config, {
        enabled: true,
        lineLimit: 4,
      });
    });
  });

  it("fails fast for invalid config shapes", () => {
    assert.throws(
      () => parseStatusConfig({ status: { enabled: "false" } }),
      /status\.enabled must be a boolean/,
    );
    assert.throws(
      () => parseStatusConfig({ status: { enabled: true, defaultCadenceSeconds: 60 } }),
      /status has unsupported key\(s\): defaultCadenceSeconds/,
    );
  });

  it("reports when neither local nor shared config exists", () => {
    withTempDir((dir) => {
      assert.throws(
        () => loadStatusConfig(join(dir, "config.json"), join(dir, "config.json.example")),
        /Missing subagent status config\. Expected .*config\.json.*or.*config\.json\.example/,
      );
    });
  });

  it("reports invalid JSON from the shared example path", () => {
    withTempDir((dir) => {
      const examplePath = join(dir, "config.json.example");
      writeFileSync(examplePath, "{\n");

      assert.throws(
        () => loadStatusConfig(join(dir, "config.json"), examplePath),
        /Invalid JSON in subagent config .*config\.json\.example/,
      );
    });
  });

  it("fails on invalid local config instead of falling back to the shared example", () => {
    withTempDir((dir) => {
      const configPath = join(dir, "config.json");
      const examplePath = join(dir, "config.json.example");
      writeFileSync(configPath, "{\n");
      writeFileSync(
        examplePath,
        JSON.stringify({ status: { enabled: true } }, null, 2) + "\n",
      );

      assert.throws(
        () => loadStatusConfig(configPath, examplePath),
        /Invalid JSON in subagent config .*config\.json/,
      );
    });
  });

  it("keeps a missing snapshot as starting until the fixed watchdog threshold", () => {
    let state = createStatusState({ source: "pi", startTimeMs: 0 });
    state = observeStatus(state, { snapshot: "missing" }, 1_000);

    assert.equal(classifyStatus(state, 60_999).kind, "starting");
    const stalled = classifyStatus(state, 61_000);
    assert.equal(stalled.kind, "stalled");
    assert.equal(stalled.statusLabel, null);
  });

  it("classifies active snapshots without aging into stalled", () => {
    let state = createStatusState({ source: "pi", startTimeMs: 0 });
    state = observeStatus(state, {
      snapshot: "present",
      updatedAt: 5_000,
      sequence: 1,
      phase: "active",
      active: true,
      activeScope: "tool",
      activeSince: 5_000,
      activityLabel: "bash",
      latestEvent: "tool_execution_start",
    }, 5_000);

    const snapshot = classifyStatus(state, 240_000);
    assert.equal(snapshot.kind, "active");
    assert.equal(snapshot.activityLabel, "bash");
    assert.equal(snapshot.activeDurationText, "3m");
  });

  it("classifies waiting snapshots as healthy idle without becoming stalled", () => {
    let state = createStatusState({ source: "pi", startTimeMs: 0 });
    state = observeStatus(state, {
      snapshot: "present",
      updatedAt: 10_000,
      sequence: 1,
      phase: "waiting",
      waitingSince: 10_000,
      latestEvent: "agent_end",
    }, 10_000);

    const snapshot = classifyStatus(state, 240_000);
    assert.equal(snapshot.kind, "waiting");
    assert.equal(snapshot.waitingDurationText, "3m");
  });

  it("uses elapsed-only fallback for external Claude and AGY subagents", () => {
    for (const source of ["claude", "agy"] as const) {
      const state = createStatusState({ source, startTimeMs: 0 });
      const snapshot = classifyStatus(state, 125_000);
      assert.equal(snapshot.kind, "running");
      assert.equal(snapshot.elapsedText, "2m");
      assert.equal(observeStatus(state, { snapshot: "missing" }, 130_000), state);
    }
  });

  it("detects stalled transitions and recovery", () => {
    let state = createStatusState({ source: "pi", startTimeMs: 0 });
    state = observeStatus(state, { snapshot: "missing" }, 1_000);

    let advanced = advanceStatusState(state, 95_000);
    assert.equal(advanced.transition, "stalled");
    assert.equal(advanced.snapshot.kind, "stalled");

    state = observeStatus(advanced.nextState, {
      snapshot: "present",
      updatedAt: 96_000,
      sequence: 1,
      phase: "waiting",
      waitingSince: 96_000,
      latestEvent: "agent_end",
    }, 96_000);
    advanced = advanceStatusState(state, 97_000);
    assert.equal(advanced.transition, "recovered");
    assert.equal(advanced.snapshot.kind, "waiting");
  });

  it("keeps the last healthy kind during transient snapshot loss", () => {
    let state = createStatusState({ source: "pi", startTimeMs: 0 });
    state = observeStatus(state, {
      snapshot: "present",
      updatedAt: 5_000,
      sequence: 1,
      phase: "active",
      active: true,
      activeScope: "streaming",
      activeSince: 5_000,
    }, 5_000);
    state = advanceStatusState(state, 6_000).nextState;
    state = observeStatus(state, { snapshot: "missing" }, 10_000);

    const snapshot = classifyStatus(state, 20_000);
    assert.equal(snapshot.kind, "active");
    assert.equal(snapshot.statusLabel, null);
  });

  it("forces an active state to waiting after interrupt", () => {
    const now = 20_000;
    let state = createStatusState({ source: "pi", startTimeMs: 0 });
    state = observeStatus(state, {
      snapshot: "present",
      updatedAt: 5_000,
      sequence: 1,
      phase: "active",
      active: true,
      activeScope: "tool",
      activeSince: 5_000,
      activityLabel: "bash",
    }, 5_000);

    assert.equal(classifyStatus(state, now).kind, "active");

    const forced = forceStatusAfterInterrupt(state, now);
    const snapshot = classifyStatus(forced, now);

    assert.equal(snapshot.kind, "waiting");
    assert.equal(snapshot.activityLabel, "interrupted");
    assert.equal(snapshot.waitingDurationText, "0s");
    assert.equal(forced.activeNow, false);
  });

  it("orders same-millisecond snapshots by sequence", () => {
    let state = createStatusState({ source: "pi", startTimeMs: 0 });
    state = observeStatus(state, {
      snapshot: "present",
      updatedAt: 10_000,
      sequence: 2,
      phase: "active",
      active: true,
      activeScope: "tool",
      activeSince: 10_000,
      activityLabel: "bash",
    }, 10_000);

    state = observeStatus(state, {
      snapshot: "present",
      updatedAt: 10_000,
      sequence: 3,
      phase: "waiting",
      waitingSince: 10_000,
      latestEvent: "agent_end",
    }, 10_001);

    const snapshot = classifyStatus(state, 11_000);
    assert.equal(snapshot.kind, "waiting");
    assert.equal(snapshot.latestEvent, "agent_end");
  });

  it("recovers from a transient snapshot read failure with the same valid snapshot", () => {
    let state = createStatusState({ source: "pi", startTimeMs: 0 });
    state = observeStatus(state, {
      snapshot: "present",
      updatedAt: 5_000,
      sequence: 2,
      phase: "active",
      active: true,
      activeScope: "tool",
      activeSince: 5_000,
      activityLabel: "bash",
    }, 5_000);
    state = observeStatus(state, { snapshot: "missing" }, 10_000);
    assert.equal(classifyStatus(state, 10_000).statusLabel, null);

    state = observeStatus(state, {
      snapshot: "present",
      updatedAt: 5_000,
      sequence: 2,
      phase: "active",
      active: true,
      activeScope: "tool",
      activeSince: 5_000,
      activityLabel: "bash",
    }, 11_000);

    const snapshot = classifyStatus(state, 11_000);
    assert.equal(snapshot.kind, "active");
    assert.equal(snapshot.statusLabel, null);
  });

  it("ignores stale and exact old snapshots after interrupt and accepts newer snapshots", () => {
    let state = createStatusState({ source: "pi", startTimeMs: 0 });
    state = observeStatus(state, {
      snapshot: "present",
      updatedAt: 5_000,
      sequence: 1,
      phase: "active",
      active: true,
      activeScope: "tool",
      activeSince: 5_000,
      activityLabel: "bash",
    }, 5_000);
    state = forceStatusAfterInterrupt(state, 20_000);

    const stale = observeStatus(state, {
      snapshot: "present",
      updatedAt: 5_000,
      sequence: 1,
      phase: "active",
      active: true,
      activeScope: "tool",
      activeSince: 5_000,
      activityLabel: "bash",
    }, 21_000);
    let snapshot = classifyStatus(stale, 21_000);
    assert.equal(snapshot.kind, "waiting");
    assert.equal(snapshot.activityLabel, "interrupted");

    const sameTimestamp = observeStatus(stale, {
      snapshot: "present",
      updatedAt: 20_000,
      sequence: 1,
      phase: "active",
      active: true,
      activeScope: "tool",
      activeSince: 20_000,
      activityLabel: "bash",
    }, 22_000);
    snapshot = classifyStatus(sameTimestamp, 22_000);
    assert.equal(snapshot.kind, "waiting");
    assert.equal(snapshot.activityLabel, "interrupted");

    const resumed = observeStatus(sameTimestamp, {
      snapshot: "present",
      sequence: 2,
      updatedAt: 25_000,
      phase: "active",
      active: true,
      activeScope: "streaming",
      activeSince: 25_000,
      activityLabel: "streaming",
    }, 25_000);
    snapshot = classifyStatus(resumed, 25_000);
    assert.equal(snapshot.kind, "active");
    assert.equal(resumed.activeScope, "streaming");
  });

  it("normalizes and truncates long newline-heavy names", () => {
    const longName = `Implementer\n\n${"very-long-name-".repeat(12)}`;
    const stalledState = observeStatus(
      createStatusState({ source: "pi", startTimeMs: 0 }),
      { snapshot: "missing" },
      1_000,
    );
    const activeState = observeStatus(
      createStatusState({ source: "pi", startTimeMs: 0 }),
      {
        snapshot: "present",
        updatedAt: 299_000,
        sequence: 1,
        phase: "active",
        active: true,
        activeScope: "tool",
        activeSince: 299_000,
        activityLabel: "write",
      },
      299_000,
    );
    const line = formatStatusLine(longName, classifyStatus(stalledState, 240_000));
    const recovered = formatTransitionLine(longName, classifyStatus(activeState, 300_000), "recovered");

    assert.doesNotMatch(line, /\n/);
    assert.doesNotMatch(recovered, /\n/);
    assert.ok(line.length <= 120, `expected bounded line length, got ${line.length}`);
    assert.ok(recovered.length <= 120, `expected bounded line length, got ${recovered.length}`);
  });

  it("caps visible status lines and reports overflow consistently", () => {
    const waitingState = observeStatus(
      createStatusState({ source: "pi", startTimeMs: 0 }),
      { snapshot: "present", updatedAt: 180_000, sequence: 1, phase: "waiting", waitingSince: 180_000 },
      180_000,
    );
    const activeState = observeStatus(
      createStatusState({ source: "pi", startTimeMs: 0 }),
      {
        snapshot: "present",
        updatedAt: 419_000,
        sequence: 1,
        phase: "active",
        active: true,
        activeScope: "tool",
        activeSince: 419_000,
        activityLabel: "bash",
      },
      419_000,
    );
    const waitingLine = formatStatusLine("Implementer", classifyStatus(waitingState, 300_000));
    const recoveredLine = formatTransitionLine("Implementer", classifyStatus(activeState, 420_000), "recovered");
    const lines = [waitingLine, recoveredLine, "Inspector running 2m.", "Reviewer running 4m.", "Planner running 6m."];
    const capped = capStatusLines(lines, 3);
    const aggregate = formatStatusAggregate(lines, 3);

    assert.equal(waitingLine, "Implementer running 5m, waiting 2m.");
    assert.equal(recoveredLine, "Implementer running 7m, recovered; active (bash 1s).");
    assert.deepEqual(capped.visibleLines, [waitingLine, recoveredLine, "Inspector running 2m."]);
    assert.equal(capped.overflow, 2);
    assert.match(aggregate, /^Subagent status:/);
    assert.match(aggregate, /\+2 more running\./);
    assert.doesNotMatch(aggregate, /\/tmp|\.jsonl/);
  });
});

describe("subagent discovery", () => {
  const testApi = (subagentsModule as any).__test__;

  it("repository agent profiles use the current schema", () => {
    const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
    const profileDirectories = [
      join(repositoryRoot, "agent-examples"),
      join(repositoryRoot, "test", "integration", "agents"),
    ];
    const failures: string[] = [];

    for (const directory of profileDirectories) {
      for (const filename of readdirSync(directory).filter((name) => name.endsWith(".md")).sort()) {
        const filePath = join(directory, filename);
        const parsed = parseAgentDefinition(readFileSync(filePath, "utf8"), filePath, "global");
        if (parsed.agent && parsed.diagnostics.length === 0) continue;

        const details = parsed.diagnostics
          .map((entry) => `${entry.field ?? "profile"}: ${entry.message}`)
          .join("; ");
        failures.push(`${filePath}: ${details || "profile was rejected without diagnostics"}`);
      }
    }

    assert.deepEqual(failures, [], failures.join("\n"));
  });

  it("loads session-mode from frontmatter", async () => {
    await withIsolatedAgentEnv(async ({ projectAgentsDir }) => {
      writeAgentFile(
        projectAgentsDir,
        "lineage-mode-test-agent",
        [
          "name: lineage-mode-test-agent",
          "model: anthropic/test-lineage",
          "session-mode: lineage-only",
        ].join("\n"),
      );

      const loaded = await testApi.findAgentDefinition("lineage-mode-test-agent");
      assert.ok(loaded, "expected agent to load");
      assert.equal(loaded.sessionMode, "lineage-only");
    });
  });

  it("loads explicit interactive flag from frontmatter", async () => {
    await withIsolatedAgentEnv(async ({ projectAgentsDir }) => {
      writeAgentFile(
        projectAgentsDir,
        "interactive-true-test-agent",
        [
          "name: interactive-true-test-agent",
          "model: anthropic/test-interactive-true",
          "interactive: true",
        ].join("\n"),
      );
      writeAgentFile(
        projectAgentsDir,
        "interactive-false-test-agent",
        [
          "name: interactive-false-test-agent",
          "model: anthropic/test-interactive-false",
          "interactive: false",
        ].join("\n"),
      );

      const loadedTrue = await testApi.findAgentDefinition("interactive-true-test-agent");
      assert.equal(loadedTrue?.interactive, true);

      const loadedFalse = await testApi.findAgentDefinition("interactive-false-test-agent");
      assert.equal(loadedFalse?.interactive, false);
    });
  });

  it("leaves interactive undefined when not set in frontmatter", async () => {
    await withIsolatedAgentEnv(async ({ projectAgentsDir }) => {
      writeAgentFile(
        projectAgentsDir,
        "interactive-unset-test-agent",
        [
          "name: interactive-unset-test-agent",
          "model: anthropic/test-interactive-unset",
        ].join("\n"),
      );

      const loaded = await testApi.findAgentDefinition("interactive-unset-test-agent");
      assert.equal(loaded?.interactive, undefined);
    });
  });

  it("resolveEffectiveInteractive defaults to the inverse of auto-exit", () => {
    // Autonomous agents (auto-exit: true) are NOT interactive — parent gets stall pings.
    assert.equal(
      testApi.resolveEffectiveInteractive({ name: "A", task: "T" }, { autoExit: true }),
      false,
    );
    // Agents without auto-exit ARE interactive — parent does not receive status transition pings.
    assert.equal(
      testApi.resolveEffectiveInteractive({ name: "A", task: "T" }, { autoExit: false }),
      true,
    );
    assert.equal(
      testApi.resolveEffectiveInteractive({ name: "A", task: "T" }, {}),
      true,
    );
    // Defensive null profile input remains interactive by default.
    assert.equal(
      testApi.resolveEffectiveInteractive({ name: "A", task: "T" }, null),
      true,
    );
  });

  it("resolveEffectiveInteractive honors explicit frontmatter over the auto-exit default", () => {
    // Autonomous agent that still wants to be treated as interactive.
    assert.equal(
      testApi.resolveEffectiveInteractive(
        { name: "A", task: "T" },
        { autoExit: true, interactive: true },
      ),
      true,
    );
    // Non-auto-exit agent that opts back into stall pings.
    assert.equal(
      testApi.resolveEffectiveInteractive(
        { name: "A", task: "T" },
        { interactive: false },
      ),
      false,
    );
  });

  it("grants spawning controls only from subagent_agents", async () => {
    await withIsolatedAgentEnv(async ({ projectAgentsDir }) => {
      writeAgentFile(
        projectAgentsDir,
        "coordinator",
        [
          "name: coordinator",
          "builtin-tools: [read, bash]",
          "subagent_agents: [inspector, implementer]",
        ].join("\n"),
      );
      const coordinator = await testApi.findAgentDefinition("coordinator");
      assert.ok(coordinator);
      assert.deepEqual(coordinator.subagentAgents, ["inspector", "implementer"]);

      const prepared = testApi.prepareAgentSandbox(coordinator);
      assert.ok("sandbox" in prepared);
      assert.equal(prepared.sandbox.grantSpawning, true);
      assert.deepEqual(prepared.sandbox.builtinTools, ["read", "bash"]);
    });
  });

  it("rejects spawning tools listed under builtin-tools", () => {
    const parsed = parseAgentDefinition(
      `---\nname: unsafe\nbuiltin-tools: [read, subagent]\n---\nbody`,
      "/tmp/unsafe.md",
      "global",
    );
    assert.equal(parsed.agent, null);
    assert.ok(
      parsed.diagnostics.some((entry) =>
        entry.field === "builtin-tools" && /use subagent_agents/.test(entry.message)
      ),
    );
  });

  it("rejects legacy tools with actionable migration guidance", () => {
    const parsed = parseAgentDefinition(
      `---\nname: legacy\ntools: [read, web_search]\n---\nbody`,
      "/tmp/legacy.md",
      "global",
    );
    assert.equal(parsed.agent, null);
    assert.ok(
      parsed.diagnostics.some((entry) =>
        entry.field === "tools" &&
        /builtin-tools/.test(entry.message) &&
        /extensions/.test(entry.message)
      ),
    );
  });

  it("normalizes builtin-tools forms with a default-deny empty value", () => {
    const parse = (line: string | null) => parseAgentDefinition(
      `---\nname: builtins\n${line ? `${line}\n` : ""}---\nbody`,
      "/tmp/builtins.md",
      "global",
    );

    assert.deepEqual(parse(null).agent?.builtinTools, []);
    assert.deepEqual(parse('builtin-tools: ""').agent?.builtinTools, []);
    assert.deepEqual(parse("builtin-tools: []").agent?.builtinTools, []);
    assert.deepEqual(
      parse("builtin-tools: read, bash, read").agent?.builtinTools,
      ["read", "bash"],
    );
    assert.deepEqual(
      parse("builtin-tools: [grep, find, ls]").agent?.builtinTools,
      ["grep", "find", "ls"],
    );
  });

  it("retains exact package sources and ordered extension selectors", () => {
    const parsed = parseAgentDefinition(
      [
        "---",
        "name: researcher",
        "builtin-tools: [read, grep]",
        "extensions:",
        "  - package: 'git:git@github.com:example/search@main'",
        "  - package: 'npm:@example/web-tools'",
        "    paths:",
        "      - index.ts",
        "      - packages/web/index.ts",
        "---",
        "body",
      ].join("\n"),
      "/tmp/researcher.md",
      "project",
    );

    assert.deepEqual(parsed.diagnostics, []);
    assert.deepEqual(parsed.agent?.builtinTools, ["read", "grep"]);
    assert.deepEqual(parsed.agent?.extensions, [
      { package: "git:git@github.com:example/search@main" },
      {
        package: "npm:@example/web-tools",
        paths: ["index.ts", "packages/web/index.ts"],
      },
    ]);
    assert.equal(parsed.agent?.source, "project");
    assert.equal(parsed.agent?.filePath, "/tmp/researcher.md");
  });

  it("preserves extension strings exactly and compares duplicates exactly", () => {
    const parsed = parseAgentDefinition(
      [
        "---",
        "name: exact-strings",
        "extensions:",
        "  - package: ' pkg '",
        "    paths: [' index.ts ', index.ts]",
        "  - package: pkg",
        "---",
        "body",
      ].join("\n"),
      "/tmp/exact-strings.md",
      "global",
    );

    assert.deepEqual(parsed.diagnostics, []);
    assert.deepEqual(parsed.agent?.extensions, [
      { package: " pkg ", paths: [" index.ts ", "index.ts"] },
      { package: "pkg" },
    ]);
  });

  it("resolves enabled global package resources with selector order and canonical deduplication", async () => {
    await withIsolatedAgentEnv(async ({ globalDir, globalAgentsDir }) => {
      const source = "./packages/global-tools";
      const packageRoot = join(globalDir, "packages", "global-tools");
      const absoluteSource = packageRoot;
      const otherSource = "./packages/other-tools";
      const otherRoot = join(globalDir, "packages", "other-tools");
      writePackageFixture(packageRoot, [
        "extensions/one.ts",
        "extensions/two.ts",
        "extensions/disabled.ts",
      ]);
      writePackageFixture(otherRoot, ["extensions/other.ts"]);
      const enabledFilter = ["extensions/*.ts", "!extensions/disabled.ts"];
      writeFileSync(
        join(globalDir, "settings.json"),
        JSON.stringify({
          packages: [
            { source, extensions: enabledFilter },
            { source: absoluteSource, extensions: enabledFilter },
            otherSource,
          ],
        }),
      );

      writeAgentFile(globalAgentsDir, "all", `name: all\nextensions:\n  - package: ${source}`);
      writeAgentFile(
        globalAgentsDir,
        "ordered",
        `name: ordered\nextensions:\n  - package: ${source}\n    paths: [extensions/two.ts, extensions/one.ts]`,
      );
      writeAgentFile(
        globalAgentsDir,
        "deduped",
        [
          "name: deduped",
          "extensions:",
          `  - package: ${source}`,
          `  - package: ${JSON.stringify(absoluteSource)}`,
        ].join("\n"),
      );
      writeAgentFile(
        globalAgentsDir,
        "package-order",
        [
          "name: package-order",
          "extensions:",
          `  - package: ${otherSource}`,
          `  - package: ${source}`,
        ].join("\n"),
      );
      writeAgentFile(
        globalAgentsDir,
        "disabled",
        `name: disabled\nextensions:\n  - package: ${source}\n    paths: [extensions/disabled.ts]`,
      );

      const discovery = await discoverAgentDefinitions({
        cwd: globalDir,
        projectTrusted: false,
      });
      const one = realpathSync(join(packageRoot, "extensions", "one.ts"));
      const two = realpathSync(join(packageRoot, "extensions", "two.ts"));
      const other = realpathSync(join(otherRoot, "extensions", "other.ts"));
      assert.deepEqual(
        discovery.agents.find((agent) => agent.name === "all")?.extensionPaths,
        [one, two],
      );
      assert.deepEqual(
        discovery.agents.find((agent) => agent.name === "ordered")?.extensionPaths,
        [two, one],
      );
      assert.deepEqual(
        discovery.agents.find((agent) => agent.name === "deduped")?.extensionPaths,
        [one, two],
      );
      assert.deepEqual(
        discovery.agents.find((agent) => agent.name === "package-order")?.extensionPaths,
        [other, one, two],
      );
      assert.equal(discovery.agents.some((agent) => agent.name === "disabled"), false);
      assert.ok(
        discovery.diagnostics.some((entry) =>
          entry.filePath.endsWith("disabled.md") &&
          entry.field === "extensions[0].paths[0]" &&
          /not an enabled extension resource/.test(entry.message)
        ),
      );
    });
  });

  it("contains global and trusted project package scope with project-first fallback", async () => {
    await withIsolatedAgentEnv(async ({
      projectDir,
      projectAgentsDir,
      globalDir,
      globalAgentsDir,
    }) => {
      const sharedSource = "./packages/shared";
      const fallbackSource = "./packages/fallback";
      const projectOnlySource = "./packages/project-only";
      const globalSharedRoot = join(globalDir, "packages", "shared");
      const projectSharedRoot = join(projectDir, ".pi", "packages", "shared");
      const projectOnlyRoot = join(projectDir, ".pi", "packages", "project-only");
      const fallbackRoot = join(globalDir, "packages", "fallback");
      writePackageFixture(globalSharedRoot, ["extensions/global.ts"]);
      writePackageFixture(projectSharedRoot, ["extensions/project.ts"]);
      writePackageFixture(projectOnlyRoot, ["extensions/project-only.ts"]);
      writePackageFixture(fallbackRoot, ["extensions/fallback.ts"]);
      writeFileSync(
        join(globalDir, "settings.json"),
        JSON.stringify({ packages: [sharedSource, fallbackSource] }),
      );
      writeFileSync(
        join(projectDir, ".pi", "settings.json"),
        JSON.stringify({ packages: [sharedSource, projectOnlySource] }),
      );

      writeAgentFile(
        globalAgentsDir,
        "global-scope",
        `name: global-scope\nextensions:\n  - package: ${sharedSource}`,
      );
      writeAgentFile(
        globalAgentsDir,
        "project-package-from-global-profile",
        `name: project-package-from-global-profile\nextensions:\n  - package: ${projectOnlySource}`,
      );
      writeAgentFile(
        projectAgentsDir,
        "project-scope",
        `name: project-scope\nextensions:\n  - package: ${sharedSource}`,
      );
      writeAgentFile(
        projectAgentsDir,
        "global-fallback",
        `name: global-fallback\nextensions:\n  - package: ${fallbackSource}`,
      );

      const nestedCwd = join(projectDir, "src", "nested");
      mkdirSync(nestedCwd, { recursive: true });
      const trusted = await discoverAgentDefinitions({ cwd: nestedCwd, projectTrusted: true });
      assert.equal(trusted.projectAgentsDir, projectAgentsDir);
      assert.deepEqual(
        trusted.agents.find((agent) => agent.name === "global-scope")?.extensionPaths,
        [realpathSync(join(globalSharedRoot, "extensions", "global.ts"))],
      );
      assert.deepEqual(
        trusted.agents.find((agent) => agent.name === "project-scope")?.extensionPaths,
        [realpathSync(join(projectSharedRoot, "extensions", "project.ts"))],
      );
      assert.deepEqual(
        trusted.agents.find((agent) => agent.name === "global-fallback")?.extensionPaths,
        [realpathSync(join(fallbackRoot, "extensions", "fallback.ts"))],
      );
      assert.equal(
        trusted.agents.some((agent) => agent.name === "project-package-from-global-profile"),
        false,
      );
      assert.ok(trusted.diagnostics.some((entry) =>
        entry.filePath.endsWith("project-package-from-global-profile.md") &&
        /permitted global settings/.test(entry.message)
      ));

      const untrusted = await discoverAgentDefinitions({ cwd: nestedCwd, projectTrusted: false });
      assert.equal(untrusted.projectAgentsDir, null);
      assert.equal(untrusted.agents.some((agent) => agent.name === "project-scope"), false);
      assert.deepEqual(
        untrusted.agents.find((agent) => agent.name === "global-scope")?.extensionPaths,
        [realpathSync(join(globalSharedRoot, "extensions", "global.ts"))],
      );
    });
  });

  it("preserves inherited resources and exclusions for project autoload deltas", async () => {
    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir, globalDir }) => {
      const packageRoot = join(globalDir, "packages", "delta-tools");
      const source = packageRoot;
      const filePackageRoot = join(globalDir, "packages", "file-delta-tools");
      const fileSource = pathToFileURL(filePackageRoot).href;
      writePackageFixture(packageRoot, ["extensions/one.ts", "extensions/two.ts"]);
      writePackageFixture(filePackageRoot, ["extensions/one.ts", "extensions/two.ts"]);
      writeFileSync(
        join(globalDir, "settings.json"),
        JSON.stringify({ packages: [source, fileSource] }),
      );
      writeFileSync(
        join(projectDir, ".pi", "settings.json"),
        JSON.stringify({
          packages: [
            {
              source,
              autoload: false,
              extensions: ["-extensions/two.ts"],
            },
            {
              source: fileSource,
              autoload: false,
              extensions: ["-extensions/two.ts"],
            },
          ],
        }),
      );
      writeAgentFile(
        projectAgentsDir,
        "delta-inherited",
        `name: delta-inherited\nextensions:\n  - package: ${JSON.stringify(source)}`,
      );
      writeAgentFile(
        projectAgentsDir,
        "file-delta-inherited",
        `name: file-delta-inherited\nextensions:\n  - package: ${JSON.stringify(fileSource)}`,
      );
      writeAgentFile(
        projectAgentsDir,
        "delta-excluded",
        [
          "name: delta-excluded",
          "extensions:",
          `  - package: ${JSON.stringify(source)}`,
          "    paths: [extensions/two.ts]",
        ].join("\n"),
      );

      const discovery = await discoverAgentDefinitions({ cwd: projectDir, projectTrusted: true });
      assert.deepEqual(
        discovery.agents.find((agent) => agent.name === "delta-inherited")?.extensionPaths,
        [realpathSync(join(packageRoot, "extensions", "one.ts"))],
      );
      assert.deepEqual(
        discovery.agents.find((agent) => agent.name === "file-delta-inherited")?.extensionPaths,
        [realpathSync(join(filePackageRoot, "extensions", "one.ts"))],
      );
      assert.equal(discovery.agents.some((agent) => agent.name === "delta-excluded"), false);
      assert.ok(discovery.diagnostics.some((entry) =>
        entry.filePath.endsWith("delta-excluded.md") &&
        entry.field === "extensions[0].paths[0]" &&
        /not an enabled extension resource/.test(entry.message)
      ));
    });
  });

  it("uses Pi package identity for autoload delta inheritance", async () => {
    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir, globalDir }) => {
      const previousHome = process.env.HOME;
      const isolatedHome = join(dirname(projectDir), "home");
      process.env.HOME = isolatedHome;

      try {
        const npmSource = "npm:@profile-fixture/delta@1.0.0";
        const npmRoot = join(globalDir, "npm", "node_modules", "@profile-fixture", "delta");
        const gitSource = "git:https://github.com/profile-fixture/delta.git";
        const gitRoot = join(globalDir, "git", "github.com", "profile-fixture", "delta");
        const versionedNpmGlobalSource = "npm:@profile-fixture/versioned-delta@1.0.0";
        const versionedNpmProjectSource = "npm:@profile-fixture/versioned-delta@2.0.0";
        const versionedNpmRoot = join(
          globalDir,
          "npm",
          "node_modules",
          "@profile-fixture",
          "versioned-delta",
        );
        const protocolGitGlobalSource =
          "git:https://github.com/profile-fixture/protocol-delta.git";
        const protocolGitProjectSource =
          "git:ssh://git@github.com/profile-fixture/protocol-delta.git";
        const protocolGitRoot = join(
          globalDir,
          "git",
          "github.com",
          "profile-fixture",
          "protocol-delta",
        );
        const tildeSource = "~/delta-tools";
        const tildeRoot = join(isolatedHome, "delta-tools");
        const invalidGitSource = "git:https://";
        const windowsAbsoluteSource = "C:\\delta-tools";
        const windowsTildeSource = "~\\delta-tools";
        const sources = [
          npmSource,
          gitSource,
          tildeSource,
          invalidGitSource,
          windowsAbsoluteSource,
          windowsTildeSource,
        ];

        writePackageFixture(npmRoot, ["extensions/one.ts", "extensions/two.ts"]);
        writePackageFixture(gitRoot, ["extensions/one.ts", "extensions/two.ts"]);
        writePackageFixture(versionedNpmRoot, ["extensions/one.ts", "extensions/two.ts"]);
        writePackageFixture(protocolGitRoot, ["extensions/one.ts", "extensions/two.ts"]);
        writePackageFixture(tildeRoot, ["extensions/one.ts", "extensions/two.ts"]);
        writePackageFixture(resolve(globalDir, invalidGitSource), ["extensions/global.ts"]);
        writePackageFixture(resolve(globalDir, windowsAbsoluteSource), ["extensions/global.ts"]);
        writePackageFixture(resolve(globalDir, windowsTildeSource), ["extensions/global.ts"]);

        writeFileSync(
          join(globalDir, "settings.json"),
          JSON.stringify({
            packages: [
              ...sources,
              versionedNpmGlobalSource,
              protocolGitGlobalSource,
            ],
          }),
        );
        writeFileSync(
          join(projectDir, ".pi", "settings.json"),
          JSON.stringify({
            packages: [
              ...sources.map((source) => ({
                source,
                autoload: false,
                extensions: ["-extensions/two.ts"],
              })),
              {
                source: versionedNpmProjectSource,
                autoload: false,
                extensions: ["-extensions/two.ts"],
              },
              {
                source: protocolGitProjectSource,
                autoload: false,
                extensions: ["-extensions/two.ts"],
              },
            ],
          }),
        );

        for (const [name, source] of [
          ["npm-delta", npmSource],
          ["git-delta", gitSource],
          ["tilde-delta", tildeSource],
          ["versioned-npm-delta", versionedNpmProjectSource],
          ["protocol-git-delta", protocolGitProjectSource],
          ["invalid-git-delta", invalidGitSource],
          ["windows-absolute-delta", windowsAbsoluteSource],
          ["windows-tilde-delta", windowsTildeSource],
        ] as const) {
          writeAgentFile(
            projectAgentsDir,
            name,
            `name: ${name}\nextensions:\n  - package: ${JSON.stringify(source)}`,
          );
        }

        const discovery = await discoverAgentDefinitions({ cwd: projectDir, projectTrusted: true });
        assert.deepEqual(
          discovery.agents.find((agent) => agent.name === "npm-delta")?.extensionPaths,
          [realpathSync(join(npmRoot, "extensions", "one.ts"))],
        );
        assert.deepEqual(
          discovery.agents.find((agent) => agent.name === "git-delta")?.extensionPaths,
          [realpathSync(join(gitRoot, "extensions", "one.ts"))],
        );
        assert.deepEqual(
          discovery.agents.find((agent) => agent.name === "tilde-delta")?.extensionPaths,
          [realpathSync(join(tildeRoot, "extensions", "one.ts"))],
        );
        assert.deepEqual(
          discovery.agents.find((agent) => agent.name === "versioned-npm-delta")?.extensionPaths,
          [realpathSync(join(versionedNpmRoot, "extensions", "one.ts"))],
        );
        assert.deepEqual(
          discovery.agents.find((agent) => agent.name === "protocol-git-delta")?.extensionPaths,
          [realpathSync(join(protocolGitRoot, "extensions", "one.ts"))],
        );
        for (const name of [
          "invalid-git-delta",
          "windows-absolute-delta",
          "windows-tilde-delta",
        ]) {
          assert.equal(discovery.agents.some((agent) => agent.name === name), false);
          assert.ok(
            discovery.diagnostics.some((entry) =>
              entry.filePath.endsWith(`${name}.md`) &&
              entry.field?.startsWith("extensions[0]")
            ),
            `${name} should fail closed with an extension diagnostic`,
          );
        }
      } finally {
        restoreEnvVar("HOME", previousHome);
      }
    });
  });

  it("fails package resolution closed without installs, settings writes, or global fallback", async () => {
    await withIsolatedAgentEnv(async ({
      projectDir,
      projectAgentsDir,
      globalDir,
      globalAgentsDir,
    }) => {
      const projectConfigDir = join(projectDir, ".pi");
      const disabledSource = "./packages/disabled";
      const safeSource = "./packages/safe";
      const escapeSource = "./packages/escape";
      const missingSource = "npm:@profile-fixture/missing@0.0.0";
      const emptySource = "npm:@profile-fixture/empty@1.0.0";
      writePackageFixture(join(projectConfigDir, "packages", "disabled"), ["extensions/tool.ts"]);
      writePackageFixture(join(projectConfigDir, "packages", "safe"), ["extensions/tool.ts"]);

      const escapeRoot = join(projectConfigDir, "packages", "escape");
      mkdirSync(escapeRoot, { recursive: true });
      writeFileSync(
        join(escapeRoot, "package.json"),
        JSON.stringify({
          name: "escape-fixture",
          version: "1.0.0",
          pi: { extensions: ["escape.ts"] },
        }),
      );
      const outsideExtension = join(projectConfigDir, "outside.ts");
      writeFileSync(outsideExtension, "export default function () {}\n");
      symlinkSync(outsideExtension, join(escapeRoot, "escape.ts"));

      const emptyRoot = join(
        projectConfigDir,
        "npm",
        "node_modules",
        "@profile-fixture",
        "empty",
      );
      mkdirSync(emptyRoot, { recursive: true });
      writeFileSync(
        join(emptyRoot, "package.json"),
        JSON.stringify({ name: "@profile-fixture/empty", version: "1.0.0" }),
      );

      writeFileSync(join(globalDir, "settings.json"), JSON.stringify({ packages: [] }));
      const projectSettingsPath = join(projectConfigDir, "settings.json");
      const projectSettings = JSON.stringify({
        packages: [
          { source: disabledSource, extensions: [] },
          safeSource,
          escapeSource,
          missingSource,
          emptySource,
        ],
      });
      writeFileSync(projectSettingsPath, projectSettings);

      writeAgentFile(globalAgentsDir, "shadowed", "name: shadowed");
      writeAgentFile(
        projectAgentsDir,
        "shadowed",
        `name: shadowed\nextensions:\n  - package: ${missingSource}`,
      );
      writeAgentFile(
        projectAgentsDir,
        "disabled-package",
        `name: disabled-package\nextensions:\n  - package: ${disabledSource}`,
      );
      writeAgentFile(
        projectAgentsDir,
        "absent-selector",
        `name: absent-selector\nextensions:\n  - package: ${safeSource}\n    paths: [extensions/missing.ts]`,
      );
      writeAgentFile(
        projectAgentsDir,
        "escaping-resource",
        `name: escaping-resource\nextensions:\n  - package: ${escapeSource}`,
      );
      writeAgentFile(
        projectAgentsDir,
        "empty-package",
        `name: empty-package\nextensions:\n  - package: ${emptySource}`,
      );

      const missingInstall = join(
        projectConfigDir,
        "npm",
        "node_modules",
        "@profile-fixture",
        "missing",
      );
      assert.equal(existsSync(missingInstall), false);

      const packagePrototype = DefaultPackageManager.prototype as any;
      const settingsPrototype = SettingsManager.prototype as any;
      const originalResolve = packagePrototype.resolve;
      const restoredMethods: Array<[any, string, any]> = [];
      const missingActions: Array<{ source: string; action: string }> = [];
      packagePrototype.resolve = function (onMissing: (source: string) => Promise<string>) {
        assert.equal(typeof onMissing, "function");
        return originalResolve.call(this, async (source: string) => {
          const action = await onMissing(source);
          missingActions.push({ source, action });
          return action;
        });
      };
      for (const [target, methods] of [
        [packagePrototype, [
          "installParsedSource",
          "runCommand",
          "runCommandCapture",
          "spawnCommand",
          "spawnCaptureCommand",
        ]],
        [settingsPrototype, ["setPackages", "setProjectPackages", "flush"]],
      ] as const) {
        for (const method of methods) {
          const original = target[method];
          restoredMethods.push([target, method, original]);
          target[method] = () => {
            throw new Error(`forbidden package-resolution side effect: ${method}`);
          };
        }
      }

      let discovery: Awaited<ReturnType<typeof discoverAgentDefinitions>>;
      try {
        discovery = await discoverAgentDefinitions({ cwd: projectDir, projectTrusted: true });
      } finally {
        packagePrototype.resolve = originalResolve;
        for (const [target, method, original] of restoredMethods) target[method] = original;
      }
      assert.deepEqual(missingActions, [{ source: missingSource, action: "skip" }]);
      assert.equal(readFileSync(projectSettingsPath, "utf8"), projectSettings);
      assert.equal(existsSync(missingInstall), false);
      for (const name of [
        "shadowed",
        "disabled-package",
        "absent-selector",
        "escaping-resource",
        "empty-package",
      ]) {
        assert.equal(discovery.agents.some((agent) => agent.name === name), false, name);
      }
      assert.ok(discovery.diagnostics.some((entry) =>
        entry.filePath.endsWith("shadowed.md") && /not installed/.test(entry.message)
      ));
      assert.ok(discovery.diagnostics.some((entry) =>
        entry.filePath.endsWith("disabled-package.md") && /no enabled extension/.test(entry.message)
      ));
      assert.ok(discovery.diagnostics.some((entry) =>
        entry.filePath.endsWith("absent-selector.md") && /does not exist/.test(entry.message)
      ));
      assert.ok(discovery.diagnostics.some((entry) =>
        entry.filePath.endsWith("escaping-resource.md") && /escapes package root/.test(entry.message)
      ));
      assert.ok(discovery.diagnostics.some((entry) =>
        entry.filePath.endsWith("empty-package.md") && /no enabled extension/.test(entry.message)
      ));
    });
  });

  it("contains malformed package settings as per-profile diagnostics", async () => {
    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir, globalDir, globalAgentsDir }) => {
      const source = "./packages/global-fallback";
      const packageRoot = join(globalDir, "packages", "global-fallback");
      writePackageFixture(packageRoot, ["extensions/tool.ts"]);
      writeFileSync(join(globalDir, "settings.json"), JSON.stringify({ packages: [source] }));
      writeFileSync(join(projectDir, ".pi", "settings.json"), "{ invalid json");
      writeAgentFile(
        globalAgentsDir,
        "global-valid",
        `name: global-valid\nextensions:\n  - package: ${source}`,
      );
      writeAgentFile(
        projectAgentsDir,
        "project-fallback-blocked",
        `name: project-fallback-blocked\nextensions:\n  - package: ${source}`,
      );
      writeAgentFile(projectAgentsDir, "project-no-extensions", "name: project-no-extensions");

      const discovery = await discoverAgentDefinitions({ cwd: projectDir, projectTrusted: true });
      assert.deepEqual(
        discovery.agents.find((agent) => agent.name === "global-valid")?.extensionPaths,
        [realpathSync(join(packageRoot, "extensions", "tool.ts"))],
      );
      assert.ok(discovery.agents.some((agent) => agent.name === "project-no-extensions"));
      assert.equal(
        discovery.agents.some((agent) => agent.name === "project-fallback-blocked"),
        false,
      );
      assert.ok(discovery.diagnostics.some((entry) =>
        entry.filePath.endsWith("project-fallback-blocked.md") &&
        entry.field === "extensions[0].package" &&
        /cannot determine trusted project package overrides safely/.test(entry.message)
      ));
    });

    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir, globalDir, globalAgentsDir }) => {
      writeFileSync(join(globalDir, "settings.json"), JSON.stringify({ packages: {} }));
      writeFileSync(
        join(projectDir, ".pi", "settings.json"),
        JSON.stringify({
          packages: [
            { source: "./broken", extensions: {} },
            { source: "./typo", extensons: [] },
            null,
          ],
        }),
      );
      writeAgentFile(
        globalAgentsDir,
        "bad-global-settings",
        "name: bad-global-settings\nextensions:\n  - package: ./anything",
      );
      writeAgentFile(
        projectAgentsDir,
        "bad-project-entry",
        "name: bad-project-entry\nextensions:\n  - package: ./broken",
      );
      writeAgentFile(
        projectAgentsDir,
        "typo-project-entry",
        "name: typo-project-entry\nextensions:\n  - package: ./typo",
      );
      writeAgentFile(projectAgentsDir, "still-valid", "name: still-valid");

      const discovery = await discoverAgentDefinitions({ cwd: projectDir, projectTrusted: true });
      assert.ok(discovery.agents.some((agent) => agent.name === "still-valid"));
      assert.equal(discovery.agents.some((agent) => agent.name === "bad-global-settings"), false);
      assert.equal(discovery.agents.some((agent) => agent.name === "bad-project-entry"), false);
      assert.equal(discovery.agents.some((agent) => agent.name === "typo-project-entry"), false);
      assert.ok(discovery.diagnostics.some((entry) =>
        entry.filePath.endsWith("bad-global-settings.md") && /packages must be an array/.test(entry.message)
      ));
      assert.ok(discovery.diagnostics.some((entry) =>
        entry.filePath.endsWith("bad-project-entry.md") &&
        /project package configuration|project package overrides/.test(entry.message)
      ));
      assert.ok(discovery.diagnostics.some((entry) =>
        entry.filePath.endsWith("typo-project-entry.md") &&
        /unsupported field "extensons"/.test(entry.message)
      ));
    });
  });

  it("excludes a profile when Pi package resolution throws", async () => {
    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir }) => {
      const source = "./packages/throws";
      writeFileSync(
        join(projectDir, ".pi", "settings.json"),
        JSON.stringify({ packages: [source] }),
      );
      writeAgentFile(
        projectAgentsDir,
        "resolver-error",
        `name: resolver-error\nextensions:\n  - package: ${source}`,
      );

      const prototype = DefaultPackageManager.prototype as any;
      const originalResolve = prototype.resolve;
      prototype.resolve = async () => {
        throw new Error("fixture resolver failure");
      };
      try {
        const discovery = await discoverAgentDefinitions({ cwd: projectDir, projectTrusted: true });
        assert.equal(discovery.agents.some((agent) => agent.name === "resolver-error"), false);
        assert.ok(discovery.diagnostics.some((entry) =>
          entry.filePath.endsWith("resolver-error.md") &&
          entry.field === "extensions[0].package" &&
          /fixture resolver failure/.test(entry.message)
        ));
      } finally {
        prototype.resolve = originalResolve;
      }
    });
  });

  it("shares asynchronous resolution diagnostics across list, spawn, and command paths", async () => {
    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir }) => {
      const source = "npm:@profile-fixture/unavailable@0.0.0";
      const settingsPath = join(projectDir, ".pi", "settings.json");
      writeFileSync(settingsPath, JSON.stringify({ packages: [source] }));
      writeAgentFile(
        projectAgentsDir,
        "unavailable",
        `name: unavailable\nextensions:\n  - package: ${source}`,
      );
      const { api, registeredTools, registeredCommands, sentUserMessages } = createMockExtensionApi();
      (subagentsModule as any).default(api);
      const context = createMockContext(projectDir, true);
      const notifications: string[] = [];
      context.ui.notify = (message: string) => notifications.push(message);

      const listTool = registeredTools.find((tool) => tool.name === "subagents_list");
      const spawnTool = registeredTools.find((tool) => tool.name === "subagent");
      const command = registeredCommands.find((entry) => entry.name === "subagent");
      assert.ok(listTool && spawnTool && command);

      const listed = await listTool.execute("list", {}, undefined, undefined, context);
      const spawned = await spawnTool.execute(
        "spawn",
        { agent: "unavailable", task: "test" },
        undefined,
        undefined,
        context,
      );
      await command.handler("unavailable test", context);

      assert.equal(listed.details?.agents.length, 0);
      assert.equal(spawned.details?.error, "unknown agent");
      assert.equal(sentUserMessages.length, 0);
      for (const text of [listed.content[0].text, spawned.content[0].text, notifications[0]]) {
        assert.match(text, /unavailable/);
        assert.match(text, /extensions\[0\]\.package/);
        assert.match(text, /not installed/);
      }
    });
  });

  it("rejects unknown built-ins and every malformed extension shape", () => {
    const invalidCases = [
      { name: "extensions mapping", yaml: "extensions: { package: pkg }", field: "extensions" },
      { name: "scalar entry", yaml: "extensions: [pkg]", field: "extensions[0]" },
      { name: "missing package", yaml: "extensions:\n  - paths: [index.ts]", field: "extensions[0].package" },
      { name: "empty package", yaml: "extensions:\n  - package: '   '", field: "extensions[0].package" },
      { name: "unknown key", yaml: "extensions:\n  - package: pkg\n    alias: web", field: "extensions[0].alias" },
      { name: "duplicate package", yaml: "extensions:\n  - package: pkg\n  - package: pkg", field: "extensions[1].package" },
      { name: "scalar paths", yaml: "extensions:\n  - package: pkg\n    paths: index.ts", field: "extensions[0].paths" },
      { name: "empty paths", yaml: "extensions:\n  - package: pkg\n    paths: []", field: "extensions[0].paths" },
      { name: "empty selector", yaml: "extensions:\n  - package: pkg\n    paths: ['']", field: "extensions[0].paths[0]" },
      { name: "non-string selector", yaml: "extensions:\n  - package: pkg\n    paths: [42]", field: "extensions[0].paths[0]" },
      { name: "duplicate selector", yaml: "extensions:\n  - package: pkg\n    paths: [index.ts, index.ts]", field: "extensions[0].paths[1]" },
      { name: "absolute selector", yaml: "extensions:\n  - package: pkg\n    paths: [/index.ts]", field: "extensions[0].paths[0]" },
      { name: "Windows absolute selector", yaml: "extensions:\n  - package: pkg\n    paths: ['C:\\index.ts']", field: "extensions[0].paths[0]" },
      { name: "Windows drive selector", yaml: "extensions:\n  - package: pkg\n    paths: ['C:relative\\index.ts']", field: "extensions[0].paths[0]" },
      { name: "Windows drive parent slash", yaml: "extensions:\n  - package: pkg\n    paths: ['C:../index.ts']", field: "extensions[0].paths[0]" },
      { name: "Windows drive parent backslash", yaml: "extensions:\n  - package: pkg\n    paths: ['C:..\\index.ts']", field: "extensions[0].paths[0]" },
      { name: "dot selector", yaml: "extensions:\n  - package: pkg\n    paths: [./index.ts]", field: "extensions[0].paths[0]" },
      { name: "parent selector", yaml: "extensions:\n  - package: pkg\n    paths: [lib/../index.ts]", field: "extensions[0].paths[0]" },
    ];

    for (const invalid of invalidCases) {
      const parsed = parseAgentDefinition(
        `---\nname: invalid\n${invalid.yaml}\n---\nbody`,
        `/tmp/${invalid.name}.md`,
        "global",
      );
      assert.equal(parsed.agent, null, invalid.name);
      assert.ok(
        parsed.diagnostics.some((entry) => entry.field === invalid.field),
        `${invalid.name}: expected diagnostic for ${invalid.field}`,
      );
    }

    const unknownBuiltin = parseAgentDefinition(
      "---\nname: invalid\nbuiltin-tools: [read, web_search]\n---\nbody",
      "/tmp/unknown-builtin.md",
      "global",
    );
    assert.equal(unknownBuiltin.agent, null);
    assert.ok(
      unknownBuiltin.diagnostics.some((entry) =>
        entry.field === "builtin-tools" && /web_search/.test(entry.message)
      ),
    );
  });

  it("accepts the strict AGY profile contract and preserves read-tool order", () => {
    const parsed = parseAgentDefinition(
      [
        "---",
        "name: agy-scout",
        "description: Read-only scout",
        "cli: agy",
        "model: gemini-3.8-flash",
        "thinking: medium",
        "builtin-tools: [read, grep, find, ls, read]",
        "disable-model-invocation: true",
        "---",
        "Inspect without changing files.",
      ].join("\n"),
      "/tmp/agy-scout.md",
      "global",
    );
    assert.deepEqual(parsed.diagnostics, []);
    assert.equal(parsed.agent?.cli, "agy");
    assert.deepEqual(parsed.agent?.builtinTools, ["read", "grep", "find", "ls"]);
    assert.deepEqual(translateAgyTools(parsed.agent?.builtinTools ?? []), [
      "view_file", "grep_search", "find_by_name", "list_dir",
    ]);
  });

  it("rejects every incompatible AGY field even when explicitly empty", () => {
    for (const line of [
      "extensions: []",
      "skill: ''",
      "skills: []",
      "subagent_agents: []",
      "system-prompt: append",
      "session-mode: standalone",
      "auto-exit: false",
      "interactive: false",
    ]) {
      const parsed = parseAgentDefinition(
        `---\nname: agy-invalid\ncli: agy\n${line}\n---\nbody`,
        "/tmp/agy-invalid.md",
        "global",
      );
      assert.equal(parsed.agent, null, line);
      assert.ok(parsed.diagnostics.some((entry) => entry.field === line.split(":", 1)[0]), line);
    }
  });

  it("rejects AGY mutation and shell built-ins while defaulting to no tools", () => {
    const empty = parseAgentDefinition(
      "---\nname: agy-empty\ncli: agy\n---\nbody",
      "/tmp/agy-empty.md",
      "global",
    );
    assert.deepEqual(empty.agent?.builtinTools, []);
    assert.deepEqual(translateAgyTools([]), []);

    for (const tool of ["write", "edit", "bash", "powershell"]) {
      const parsed = parseAgentDefinition(
        `---\nname: agy-${tool}\ncli: agy\nbuiltin-tools: [${tool}]\n---\nbody`,
        `/tmp/agy-${tool}.md`,
        "global",
      );
      assert.equal(parsed.agent, null);
      assert.ok(parsed.diagnostics.some((entry) =>
        entry.field === "builtin-tools" && /supported tools: read, grep, find, ls/.test(entry.message)
      ));
    }
  });

  it("rejects Pi capability fields on Claude profiles even when empty", () => {
    for (const capability of ["builtin-tools: []", "extensions: []"]) {
      const parsed = parseAgentDefinition(
        `---\nname: claude-agent\ncli: claude\n${capability}\n---\nbody`,
        "/tmp/claude-agent.md",
        "global",
      );
      assert.equal(parsed.agent, null);
      assert.ok(
        parsed.diagnostics.some((entry) =>
          entry.field === capability.split(":", 1)[0] && /Pi-only/.test(entry.message)
        ),
      );
    }
  });

  it("excludes invalid enum values with a field-specific diagnostic", async () => {
    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir }) => {
      writeAgentFile(
        projectAgentsDir,
        "invalid-mode-test-agent",
        [
          "name: invalid-mode-test-agent",
          "model: anthropic/test-invalid",
          "session-mode: sideways",
        ].join("\n"),
      );

      const discovery = await discoverAgentDefinitions({ cwd: projectDir, projectTrusted: true });
      assert.equal(
        discovery.agents.some((agent) => agent.name === "invalid-mode-test-agent"),
        false,
      );
      assert.ok(
        discovery.diagnostics.some((entry) =>
          entry.filePath.endsWith("invalid-mode-test-agent.md") && entry.field === "session-mode"
        ),
      );
    });
  });

  it("parses YAML arrays, comma lists, strict booleans, and filename fallback", () => {
    const parsed = parseAgentDefinition(
      [
        "---",
        "builtin-tools: [read, bash]",
        "skills: review, lint",
        "subagent_agents: [inspector]",
        "auto-exit: true",
        "interactive: false",
        "thinking: xhigh",
        "cli: pi",
        "---",
        "Profile body.",
      ].join("\n"),
      "/tmp/fallback-name.md",
      "global",
    );

    assert.ok(parsed.agent);
    assert.equal(parsed.agent.name, "fallback-name");
    assert.deepEqual(parsed.agent.builtinTools, ["read", "bash"]);
    assert.deepEqual(parsed.agent.extensions, []);
    assert.deepEqual(parsed.agent.skills, ["review", "lint"]);
    assert.deepEqual(parsed.agent.subagentAgents, ["inspector"]);
    assert.equal(parsed.agent.autoExit, true);
    assert.equal(parsed.agent.interactive, false);
    assert.equal(parsed.agent.thinking, "xhigh");
    assert.equal(parsed.agent.body, "Profile body.");
  });

  it("rejects unknown keys, conflicting aliases, non-string list entries, and pseudo-booleans", () => {
    const parsed = parseAgentDefinition(
      [
        "---",
        "name: malformed",
        "skill: review",
        "skills: [lint]",
        "builtin-tools: [read, 42]",
        "auto-exit: \"true\"",
        "mystery: value",
        "---",
        "body",
      ].join("\n"),
      "/tmp/malformed.md",
      "global",
    );

    assert.equal(parsed.agent, null);
    assert.deepEqual(
      new Set(parsed.diagnostics.map((entry) => entry.field)),
      new Set(["mystery", "skill/skills", "builtin-tools", "auto-exit"]),
    );
  });

  it("rejects unterminated frontmatter and delimiter-bearing names or array entries", () => {
    const unterminated = parseAgentDefinition(
      "---\nname: broken\nbuiltin-tools: []\nbody without closing delimiter",
      "/tmp/broken.md",
      "global",
    );
    assert.equal(unterminated.agent, null);
    assert.ok(unterminated.diagnostics.some((entry) => entry.field === "frontmatter"));

    const scalarRoot = parseAgentDefinition(
      "---\n42\n---\nbody",
      "/tmp/scalar-root.md",
      "global",
    );
    assert.equal(scalarRoot.agent, null);
    assert.ok(scalarRoot.diagnostics.some((entry) => entry.field === "frontmatter"));

    const emptyEffectiveName = parseAgentDefinition(
      '---\nname: "   "\nbuiltin-tools: []\n---\nbody',
      "/tmp/empty-name.md",
      "global",
    );
    assert.equal(emptyEffectiveName.agent, null);
    assert.ok(emptyEffectiveName.diagnostics.some((entry) => entry.field === "name"));

    const commaName = parseAgentDefinition(
      "---\nname: safe,evil\nbuiltin-tools: []\n---\nbody",
      "/tmp/comma-name.md",
      "global",
    );
    assert.equal(commaName.agent, null);
    assert.ok(commaName.diagnostics.some((entry) => entry.field === "name"));

    const commaGrant = parseAgentDefinition(
      '---\nname: parent\nsubagent_agents: ["safe,evil"]\n---\nbody',
      "/tmp/comma-grant.md",
      "global",
    );
    assert.equal(commaGrant.agent, null);
    assert.ok(commaGrant.diagnostics.some((entry) => entry.field === "subagent_agents"));

    const pathGrant = parseAgentDefinition(
      "---\nname: parent\nsubagent_agents: [child/name]\n---\nbody",
      "/tmp/path-grant.md",
      "global",
    );
    assert.equal(pathGrant.agent, null);
    assert.ok(
      pathGrant.diagnostics.some((entry) =>
        entry.field === "subagent_agents" && /path separators/.test(entry.message)
      ),
    );
  });

  it("rejects an empty profile body", () => {
    const parsed = parseAgentDefinition(
      "---\nname: empty-body\nbuiltin-tools: []\n---\n",
      "/tmp/empty-body.md",
      "global",
    );
    assert.equal(parsed.agent, null);
    assert.ok(parsed.diagnostics.some((entry) => entry.field === "body"));
  });

  it("carries a filename-mismatched canonical definition into launch preparation", async () => {
    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir, globalDir }) => {
      writeAgentFile(
        projectAgentsDir,
        "filename-only",
        [
          "name: declared-name",
          "model: provider/restricted",
          "builtin-tools: [read]",
          "skills: [review]",
          "thinking: medium",
          "subagent_agents: [child-agent]",
          "system-prompt: replace",
          "session-mode: lineage-only",
          "cwd: profile-workspace",
        ].join("\n"),
        "Canonical body.",
      );

      const discovery = await discoverAgentDefinitions({ cwd: projectDir, projectTrusted: true });
      const agent = discovery.agents.find((entry) => entry.name === "declared-name");
      assert.ok(agent);
      assert.equal(agent.filePath, join(projectAgentsDir, "filename-only.md"));

      const sandbox = testApi.prepareAgentSandbox(agent);
      assert.ok("sandbox" in sandbox);
      assert.deepEqual(sandbox.sandbox, {
        builtinTools: ["read"],
        extensionPaths: [],
        grantSpawning: true,
      });
      const prepared = testApi.prepareAgentLaunch(
        { agent: "declared-name", task: "Inspect the change" },
        agent,
        sandbox.sandbox,
        projectDir,
      );
      assert.ok("launch" in prepared);
      const launch = prepared.launch;
      assert.equal(launch.effectiveModel, "provider/restricted");
      assert.deepEqual(launch.effectiveSkills, ["review"]);
      assert.equal(launch.effectiveThinking, "medium");
      assert.equal(launch.effectiveCwd, join(globalDir, "profile-workspace"));
      assert.equal(launch.launchBehavior.sessionMode, "lineage-only");
      assert.match(launch.fullTask, /Inspect the change/);
      assert.doesNotMatch(launch.fullTask, /Canonical body/);
      assert.deepEqual(launch.capabilityEnvironment, [
        `${SUBAGENT_BUILTIN_TOOLS_ENV}='read'`,
        "PI_SUBAGENT_ALLOWED='child-agent'",
      ]);
      assert.deepEqual(launch.loadout, {
        version: 1,
        capabilityMode: "extension-grants",
        agent: "declared-name",
        builtinTools: ["read"],
        extensionPaths: [],
        grantSpawning: true,
        model: "provider/restricted",
        thinking: "medium",
        systemPromptMode: "replace",
        identity: "Canonical body.",
        spawnable: ["child-agent"],
        autoExit: false,
        cwd: join(globalDir, "profile-workspace"),
        agentDir: globalDir,
      });

      const commandParts: string[] = [];
      testApi.applySandboxToParts(commandParts, launch.loadout, {
        artifactDir: projectDir,
        name: "runtime-name",
        artifactId: "canonical-launch",
      });
      assert.deepEqual(commandParts.slice(0, 2), ["--model", "'provider/restricted:medium'"]);
      assert.ok(commandParts.includes("--no-extensions"));
      assert.ok(commandParts.includes("--no-builtin-tools"));
      assert.equal(commandParts.includes("--tools"), false);
      const extensionPaths = commandParts
        .flatMap((part, index) => part === "-e" ? [commandParts[index + 1].slice(1, -1)] : []);
      assert.deepEqual(extensionPaths, [
        fileURLToPath(new URL("../pi-extension/subagents/subagent-runtime-control.ts", import.meta.url)),
        fileURLToPath(new URL("../pi-extension/subagents/index.ts", import.meta.url)),
        fileURLToPath(new URL("../pi-extension/subagents/subagent-capability-activation.ts", import.meta.url)),
      ]);
    });
  });

  it("prepares AGY as a separate external harness without a Pi loadout", () => {
    const parsed = parseAgentDefinition(
      [
        "---",
        "name: agy-reviewer",
        "cli: agy",
        "model: gemini-3.8-flash",
        "thinking: high",
        "builtin-tools: [read, grep, find, ls]",
        "---",
        "Review only.",
      ].join("\n"),
      "/tmp/agy-reviewer.md",
      "global",
    );
    assert.ok(parsed.agent);
    const agent = { ...parsed.agent, extensionPaths: [] };
    const sandbox = testApi.prepareAgentSandbox(agent);
    assert.ok("sandbox" in sandbox);
    const prepared = testApi.prepareAgentLaunch(
      { agent: "agy-reviewer", task: "Review", cwd: "/tmp" },
      agent,
      sandbox.sandbox,
      "/project",
    );
    assert.ok("launch" in prepared);
    assert.equal(prepared.launch.harness, "agy");
    assert.equal(prepared.launch.loadout, null);
    assert.deepEqual(prepared.launch.agyNativeTools, [
      "view_file", "grep_search", "find_by_name", "list_dir",
    ]);
    assert.equal(prepared.launch.effectiveModel, "gemini-3.8-flash");
    assert.equal(prepared.launch.effectiveThinking, "high");
  });

  it("fails launch preparation when a resolved profile extension disappears", () => {
    const parsed = parseAgentDefinition(
      "---\nname: missing-extension\nbuiltin-tools: [read]\n---\nbody",
      "/tmp/missing-extension.md",
      "global",
    );
    assert.ok(parsed.agent);
    const prepared = testApi.prepareAgentSandbox({
      ...parsed.agent,
      extensionPaths: ["/definitely/missing/profile-extension.ts"],
    });
    assert.ok("error" in prepared);
    assert.match(prepared.error, /no longer available/);
    assert.match(prepared.error, /extensions/);
  });

  it("reserves the spawning extension behind subagent_agents", () => {
    const spawningExtension = fileURLToPath(
      new URL("../pi-extension/subagents/index.ts", import.meta.url),
    );
    const withoutGrant = parseAgentDefinition(
      "---\nname: no-nesting\nbuiltin-tools: []\n---\nbody",
      "/tmp/no-nesting.md",
      "global",
    );
    assert.ok(withoutGrant.agent);
    const rejected = testApi.prepareAgentSandbox({
      ...withoutGrant.agent,
      extensionPaths: [spawningExtension],
    });
    assert.ok("error" in rejected);
    assert.match(rejected.error, /without a subagent_agents grant/);

    const withGrant = parseAgentDefinition(
      "---\nname: coordinator\nbuiltin-tools: []\nsubagent_agents: [scout]\n---\nbody",
      "/tmp/coordinator.md",
      "global",
    );
    assert.ok(withGrant.agent);
    const prepared = testApi.prepareAgentSandbox({
      ...withGrant.agent,
      extensionPaths: [spawningExtension],
    });
    assert.ok("sandbox" in prepared);
    assert.deepEqual(prepared.sandbox, {
      builtinTools: [],
      extensionPaths: [],
      grantSpawning: true,
    });
  });

  it("uses nearest trusted project definitions with project-over-global precedence", async () => {
    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir, globalAgentsDir }) => {
      writeAgentFile(globalAgentsDir, "shared", "name: shared\nmodel: provider/global");
      writeAgentFile(projectAgentsDir, "shared-local", "name: shared\nmodel: provider/project");
      const nested = join(projectDir, "src", "deep");
      mkdirSync(nested, { recursive: true });

      const trusted = await discoverAgentDefinitions({ cwd: nested, projectTrusted: true });
      assert.equal(trusted.projectAgentsDir, projectAgentsDir);
      assert.equal(trusted.agents.find((agent) => agent.name === "shared")?.model, "provider/project");

      const untrusted = await discoverAgentDefinitions({ cwd: nested, projectTrusted: false });
      assert.equal(untrusted.projectAgentsDir, null);
      assert.equal(untrusted.agents.find((agent) => agent.name === "shared")?.model, "provider/global");
    });
  });

  it("does not fall back to a global definition when its project override is invalid", async () => {
    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir, globalAgentsDir }) => {
      writeAgentFile(globalAgentsDir, "shared", "name: shared\nmodel: provider/global\nbuiltin-tools: [read]");
      writeAgentFile(projectAgentsDir, "shared-local", "name: shared\nbuiltin-tools: [read, 42]");

      const discovery = await discoverAgentDefinitions({ cwd: projectDir, projectTrusted: true });
      assert.equal(discovery.agents.some((agent) => agent.name === "shared"), false);
      assert.ok(discovery.diagnostics.some((entry) => entry.field === "builtin-tools"));
    });
  });

  it("tombstones a malformed project override whose filename differs from its name", async () => {
    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir, globalAgentsDir }) => {
      writeAgentFile(globalAgentsDir, "target", "name: target\nmodel: provider/global\nbuiltin-tools: [read]");
      writeAgentFile(globalAgentsDir, "neighbor", "name: neighbor\nbuiltin-tools: [read]");
      writeFileSync(
        join(projectAgentsDir, "override.md"),
        "---\nname: target\nbuiltin-tools: [read\n---\nbody",
      );

      const discovery = await discoverAgentDefinitions({ cwd: projectDir, projectTrusted: true });
      assert.equal(discovery.agents.some((agent) => agent.name === "target"), false);
      assert.equal(discovery.agents.some((agent) => agent.name === "neighbor"), true);
      assert.ok(
        discovery.diagnostics.some((entry) =>
          entry.filePath.endsWith("override.md") && entry.field === "frontmatter"
        ),
      );
    });
  });

  it("suppresses global fallback when an explicit project name has an invalid type", async () => {
    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir, globalAgentsDir }) => {
      writeAgentFile(globalAgentsDir, "target", "name: target\nbuiltin-tools: [read]");
      writeAgentFile(globalAgentsDir, "neighbor", "name: neighbor\nbuiltin-tools: [read]");
      writeAgentFile(projectAgentsDir, "local", "name: local\nbuiltin-tools: []");
      writeAgentFile(projectAgentsDir, "override", "name: [target]\nbuiltin-tools: []");

      const discovery = await discoverAgentDefinitions({ cwd: projectDir, projectTrusted: true });
      assert.deepEqual(discovery.agents.map((agent) => agent.name), ["local"]);
      assert.ok(
        discovery.diagnostics.some((entry) =>
          entry.filePath.endsWith("override.md") &&
          entry.field === "name" &&
          /all global definitions are suppressed/.test(entry.message)
        ),
      );
    });
  });

  it("suppresses global fallback when malformed YAML declares multiple possible names", async () => {
    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir, globalAgentsDir }) => {
      writeAgentFile(globalAgentsDir, "target", "name: target\nbuiltin-tools: [read]");
      writeAgentFile(globalAgentsDir, "neighbor", "name: neighbor\nbuiltin-tools: [read]");
      writeAgentFile(projectAgentsDir, "local", "name: local\nbuiltin-tools: []");
      writeFileSync(
        join(projectAgentsDir, "ambiguous.md"),
        "---\nname: target\nname: neighbor\nbuiltin-tools: [read\n---\nbody",
      );

      const parsed = parseAgentDefinition(
        readFileSync(join(projectAgentsDir, "ambiguous.md"), "utf8"),
        join(projectAgentsDir, "ambiguous.md"),
        "project",
      );
      assert.equal(parsed.agent, null);
      assert.equal(parsed.identityUncertain, true);

      const discovery = await discoverAgentDefinitions({ cwd: projectDir, projectTrusted: true });
      assert.deepEqual(discovery.agents.map((agent) => agent.name), ["local"]);
      assert.ok(
        discovery.diagnostics.some((entry) =>
          entry.filePath.endsWith("ambiguous.md") &&
          entry.field === "name" &&
          /all global definitions are suppressed/.test(entry.message)
        ),
      );
    });
  });

  it("excludes same-source duplicates regardless of lexical validity order", async () => {
    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir }) => {
      writeAgentFile(projectAgentsDir, "a-valid", "name: duplicate\nbuiltin-tools: [read]");
      writeAgentFile(projectAgentsDir, "z-invalid", "name: duplicate\nbuiltin-tools: [read, 42]");

      const discovery = await discoverAgentDefinitions({ cwd: projectDir, projectTrusted: true });
      assert.equal(discovery.agents.some((agent) => agent.name === "duplicate"), false);
      assert.ok(discovery.diagnostics.some((entry) => entry.filePath.endsWith("z-invalid.md")));
    });
  });

  it("reports malformed YAML without hiding valid neighboring definitions", async () => {
    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir }) => {
      writeAgentFile(projectAgentsDir, "valid", "name: valid\nbuiltin-tools: []");
      writeFileSync(join(projectAgentsDir, "broken.md"), "---\nname: [unterminated\n---\nbody");

      const discovery = await discoverAgentDefinitions({ cwd: projectDir, projectTrusted: true });
      assert.ok(discovery.agents.some((agent) => agent.name === "valid"));
      assert.ok(
        discovery.diagnostics.some((entry) =>
          entry.filePath.endsWith("broken.md") &&
          entry.field === "frontmatter" &&
          /invalid YAML/.test(entry.message)
        ),
      );
    });
  });

  it("rejects legacy tools in the public spawn path before tmux prerequisites", async () => {
    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir }) => {
      writeAgentFile(
        projectAgentsDir,
        "legacy-tool-agent",
        "name: legacy-tool-agent\ntools: [read]",
      );
      const { api, registeredTools } = createMockExtensionApi();
      (subagentsModule as any).default(api);
      const subagentTool = registeredTools.find((tool) => tool.name === "subagent");
      assert.ok(subagentTool);

      const result = await subagentTool.execute(
        "legacy-tool",
        { agent: "legacy-tool-agent", task: "do it" },
        undefined,
        undefined,
        createMockContext(projectDir, true),
      );
      assert.equal(result.details?.error, "unknown agent");
      assert.match(result.content[0].text, /legacy-tool-agent/);
      assert.match(result.content[0].text, /builtin-tools/);
      assert.match(result.content[0].text, /extensions/);
    });
  });

  it("rejects empty runtime model and cwd overrides before tmux prerequisites", async () => {
    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir }) => {
      writeAgentFile(projectAgentsDir, "configured-agent", "name: configured-agent\nbuiltin-tools: []");
      const { api, registeredTools } = createMockExtensionApi();
      (subagentsModule as any).default(api);
      const subagentTool = registeredTools.find((tool) => tool.name === "subagent");
      assert.ok(subagentTool);

      const emptyModel = await subagentTool.execute(
        "empty-model",
        { agent: "configured-agent", task: "do it", model: "   " },
        undefined,
        undefined,
        createMockContext(projectDir, true),
      );
      assert.equal(emptyModel.details?.error, "invalid agent launch");
      assert.match(emptyModel.content[0].text, /model override must not be empty/i);

      const emptyCwd = await subagentTool.execute(
        "empty-cwd",
        { agent: "configured-agent", task: "do it", cwd: "   " },
        undefined,
        undefined,
        createMockContext(projectDir, true),
      );
      assert.equal(emptyCwd.details?.error, "invalid agent launch");
      assert.match(emptyCwd.content[0].text, /cwd override must not be empty/i);
    });
  });

  it("trims runtime model and cwd overrides in launch preparation", async () => {
    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir }) => {
      writeAgentFile(
        projectAgentsDir,
        "configured-agent",
        "name: configured-agent\nmodel: provider/profile\nbuiltin-tools: []\ncwd: profile-dir",
      );
      const agent = (await discoverAgentDefinitions({ cwd: projectDir, projectTrusted: true }))
        .agents.find((entry) => entry.name === "configured-agent");
      assert.ok(agent);
      const sandbox = testApi.prepareAgentSandbox(agent);
      assert.ok("sandbox" in sandbox);

      const prepared = testApi.prepareAgentLaunch(
        {
          agent: "configured-agent",
          task: "do it",
          model: "  provider/runtime  ",
          cwd: "  runtime-dir  ",
        },
        agent,
        sandbox.sandbox,
        projectDir,
      );
      assert.ok("launch" in prepared);
      assert.ok(prepared.launch.loadout);
      assert.equal(prepared.launch.effectiveModel, "provider/runtime");
      assert.equal(prepared.launch.effectiveCwd, join(projectDir, "runtime-dir"));
      assert.equal(prepared.launch.loadout.model, "provider/runtime");
      assert.equal(prepared.launch.loadout.cwd, join(projectDir, "runtime-dir"));
    });
  });

  it("resolves session mode from frontmatter (standalone default)", () => {
    assert.equal(testApi.resolveEffectiveSessionMode({ name: "A", task: "T" }, null), "standalone");
    assert.equal(
      testApi.resolveEffectiveSessionMode({ name: "A", task: "T" }, { sessionMode: "lineage-only" }),
      "lineage-only",
    );
    assert.equal(
      testApi.resolveEffectiveSessionMode({ name: "A", task: "T" }, { sessionMode: "fork" }),
      "fork",
    );
  });

  it("resolves launch behavior for standalone, lineage-only, and fork modes", () => {
    assert.deepEqual(testApi.resolveLaunchBehavior({ name: "A", task: "T" }, null), {
      sessionMode: "standalone",
      seededSessionMode: null,
      inheritsConversationContext: false,
      taskDelivery: "artifact",
    });
    assert.deepEqual(
      testApi.resolveLaunchBehavior({ name: "A", task: "T" }, { sessionMode: "lineage-only" }),
      {
        sessionMode: "lineage-only",
        seededSessionMode: "lineage-only",
        inheritsConversationContext: false,
        taskDelivery: "artifact",
      },
    );
    assert.deepEqual(
      testApi.resolveLaunchBehavior({ name: "A", task: "T" }, { sessionMode: "fork" }),
      {
        sessionMode: "fork",
        seededSessionMode: "fork",
        inheritsConversationContext: true,
        taskDelivery: "direct",
      },
    );
  });

  it("builds the private capability environment and pins nesting targets", () => {
    assert.deepEqual(
      testApi.buildProfileCapabilityEnvironment(
        { builtinTools: ["read", "grep"], extensionPaths: [], grantSpawning: false },
        [],
      ),
      [
        `${SUBAGENT_BUILTIN_TOOLS_ENV}='read,grep'`,
        "PI_SUBAGENT_ALLOWED=''",
      ],
    );
    assert.deepEqual(
      testApi.buildProfileCapabilityEnvironment(
        { builtinTools: [], extensionPaths: [], grantSpawning: true },
        ["scout", "worker"],
      ),
      [
        `${SUBAGENT_BUILTIN_TOOLS_ENV}=''`,
        "PI_SUBAGENT_ALLOWED='scout,worker'",
      ],
    );
    assert.throws(
      () => testApi.buildProfileCapabilityEnvironment(
        { builtinTools: [], extensionPaths: [], grantSpawning: true },
        [],
      ),
      /inconsistent nested-spawn state/,
    );
  });

  it("replays versioned capability environment and explicit nested deny-all from snapshots", () => {
    assert.deepEqual(
      testApi.buildResumeCapabilityEnvironment({
        version: 1,
        capabilityMode: "extension-grants",
        agent: "scout",
        builtinTools: ["read", "grep"],
        extensionPaths: [],
        grantSpawning: false,
        model: null,
        thinking: null,
        systemPromptMode: null,
        identity: null,
        spawnable: null,
        autoExit: true,
        cwd: "/work",
        agentDir: "/agent",
      }),
      [
        `${SUBAGENT_BUILTIN_TOOLS_ENV}='read,grep'`,
        "PI_SUBAGENT_ALLOWED=''",
      ],
    );
    assert.deepEqual(
      testApi.buildResumeCapabilityEnvironment({
        agent: "legacy",
        toolAllowlist: "read,ask_question",
        extensionPaths: [],
        model: null,
        thinking: null,
        systemPromptMode: null,
        identity: null,
        spawnable: null,
        autoExit: true,
        cwd: "/work",
        agentDir: "/agent",
      }),
      ["PI_SUBAGENT_ALLOWED=''"],
    );
  });

  it("treats an explicit empty nested-agent allowlist as deny-all", () => {
    assert.equal(testApi.parseSubagentAllowlist(undefined), null);

    const inheritedOverride = testApi.parseSubagentAllowlist("");
    assert.ok(inheritedOverride);
    assert.equal(inheritedOverride.size, 0);

    assert.deepEqual(
      [...(testApi.parseSubagentAllowlist(" scout, worker ") ?? [])],
      ["scout", "worker"],
    );
  });

  it("applySandboxToParts constructs framework-first profile capability launches", () => {
    withTempDir((d) => {
      const parts: string[] = [];
      const profileOne = join(d, "profile-one.ts");
      const profileTwo = join(d, "profile-two.ts");
      testApi.applySandboxToParts(
        parts,
        {
          version: 1,
          capabilityMode: "extension-grants",
          agent: "researcher",
          builtinTools: ["read"],
          extensionPaths: [profileOne, profileTwo],
          grantSpawning: true,
          model: null,
          thinking: null,
          systemPromptMode: null,
          identity: null,
          spawnable: ["scout"],
          autoExit: true,
          cwd: d,
          agentDir: d,
        },
        {
          artifactDir: d,
          name: "researcher",
          artifactId: "profile-launch",
        },
      );

      assert.equal(parts.includes("--no-extensions"), true);
      assert.equal(parts.includes("--no-builtin-tools"), true);
      assert.equal(parts.includes("--tools"), false);
      const extensionPaths = parts
        .flatMap((part, index) => part === "-e" ? [parts[index + 1].slice(1, -1)] : []);
      assert.deepEqual(extensionPaths, [
        fileURLToPath(new URL("../pi-extension/subagents/subagent-runtime-control.ts", import.meta.url)),
        fileURLToPath(new URL("../pi-extension/subagents/index.ts", import.meta.url)),
        profileOne,
        profileTwo,
        fileURLToPath(new URL("../pi-extension/subagents/subagent-capability-activation.ts", import.meta.url)),
      ]);
    });
  });

  it("applySandboxToParts omits spawning controls without a nesting grant", () => {
    withTempDir((d) => {
      const parts: string[] = [];
      const profileExtension = join(d, "profile.ts");
      testApi.applySandboxToParts(
        parts,
        {
          version: 1,
          capabilityMode: "extension-grants",
          agent: "scout",
          builtinTools: ["read"],
          extensionPaths: [profileExtension],
          grantSpawning: false,
          model: null,
          thinking: null,
          systemPromptMode: null,
          identity: null,
          spawnable: null,
          autoExit: true,
          cwd: d,
          agentDir: d,
        },
        {
          artifactDir: d,
          name: "scout",
          artifactId: "non-nesting-launch",
        },
      );

      const extensionPaths = parts
        .flatMap((part, index) => part === "-e" ? [parts[index + 1].slice(1, -1)] : []);
      assert.deepEqual(extensionPaths, [
        fileURLToPath(new URL("../pi-extension/subagents/subagent-runtime-control.ts", import.meta.url)),
        profileExtension,
        fileURLToPath(new URL("../pi-extension/subagents/subagent-capability-activation.ts", import.meta.url)),
      ]);
    });
  });

  it("applySandboxToParts replays legacy model, identity, and strict tool restriction", () => {
    withTempDir((d) => {
      const parts: string[] = [];
      testApi.applySandboxToParts(
        parts,
        {
          agent: "implementer",
          toolAllowlist: "read,write,custom_tool",
          extensionPaths: ["/extensions/custom-tool.ts"],
          model: "openrouter/z-ai/glm-5.2",
          thinking: "medium",
          systemPromptMode: "append",
          identity: "You are a implementer.",
          spawnable: ["inspector"],
          autoExit: true,
          cwd: d,
          agentDir: d,
        },
        { artifactDir: d, name: "implementer", artifactId: "legacy-replay" },
      );
      const joined = parts.join(" ");
      // Model with thinking suffix.
      assert.ok(joined.includes("--model"), "expected --model");
      assert.ok(joined.includes("openrouter/z-ai/glm-5.2:medium"), "expected model:thinking");
      // Identity written to a file and appended.
      assert.ok(joined.includes("--append-system-prompt"), "expected --append-system-prompt");
      // Default-deny restriction.
      assert.ok(parts.includes("--no-extensions"), "expected --no-extensions");
      const toolsIdx = parts.indexOf("--tools");
      assert.ok(toolsIdx >= 0, "expected --tools");
      // The value is shell-escaped (single-quoted) before joining.
      assert.ok(
        parts[toolsIdx + 1].includes("read,write,custom_tool"),
        "expected the tool allowlist as the --tools value",
      );
      const extensionValues = parts
        .flatMap((part, index) => part === "-e" ? [parts[index + 1]] : []);
      assert.ok(
        extensionValues.some((value) => value.includes("/extensions/custom-tool.ts")),
        "expected the snapshotted extension path",
      );
    });
  });

  it("keeps colliding runtime-name slugs in separate artifacts", () => {
    withTempDir((d) => {
      const baseLoadout: SubagentLoadout = {
        agent: "profile",
        toolAllowlist: "ask_question",
        extensionPaths: [],
        model: null,
        thinking: null,
        systemPromptMode: "append",
        identity: "first identity",
        spawnable: null,
        autoExit: false,
        cwd: d,
        agentDir: d,
      };
      const firstParts: string[] = [];
      const secondParts: string[] = [];
      testApi.applySandboxToParts(firstParts, baseLoadout, {
        artifactDir: d,
        name: "a!",
        artifactId: "child-one",
      });
      testApi.applySandboxToParts(
        secondParts,
        { ...baseLoadout, identity: "second identity" },
        { artifactDir: d, name: "a?", artifactId: "child-two" },
      );

      const firstPath = firstParts[firstParts.indexOf("--append-system-prompt") + 1].slice(1, -1);
      const secondPath = secondParts[secondParts.indexOf("--append-system-prompt") + 1].slice(1, -1);
      assert.notEqual(firstPath, secondPath);
      assert.equal(readFileSync(firstPath, "utf8"), "first identity");
      assert.equal(readFileSync(secondPath, "utf8"), "second identity");

      const now = new Date("2026-09-09T12:00:00.000Z");
      for (const [subdir, kind] of [["context", "task"], ["subagent-resume", "message"]]) {
        const first = testApi.buildArtifactPath({
          artifactDir: d,
          subdir,
          name: "a!",
          fallbackName: "subagent",
          kind,
          uniqueId: "child-one",
          now,
        });
        const second = testApi.buildArtifactPath({
          artifactDir: d,
          subdir,
          name: "a?",
          fallbackName: "subagent",
          kind,
          uniqueId: "child-two",
          now,
        });
        assert.notEqual(first, second);
      }
    });
  });

  it("keeps a profile body in a fork task when system-prompt is omitted", () => {
    const task = testApi.buildSubagentTask({
      task: "Do the work",
      body: "You are the constrained profile.",
      autoExit: true,
      inheritsConversationContext: true,
    });
    assert.equal(task, "You are the constrained profile.\n\nDo the work");

    const systemPromptTask = testApi.buildSubagentTask({
      task: "Do the work",
      body: "System identity",
      systemPromptMode: "append",
      autoExit: true,
      inheritsConversationContext: true,
    });
    assert.equal(systemPromptTask, "Do the work");
  });

  it("replays exact versioned paths with current contents and no profile lookup", () => {
    withTempDir((d) => {
      const extensionFixture = join(d, "profile-extension.ts");
      const sessionFile = join(d, "child.jsonl");
      writeFileSync(extensionFixture, "export default 'first';", "utf8");
      const extensionPath = realpathSync(extensionFixture);
      const snapshot: SubagentLoadout = {
        version: 1,
        capabilityMode: "extension-grants",
        agent: "researcher",
        builtinTools: ["read"],
        extensionPaths: [extensionPath],
        grantSpawning: false,
        model: null,
        thinking: null,
        systemPromptMode: null,
        identity: null,
        spawnable: null,
        autoExit: true,
        cwd: d,
        agentDir: d,
      };
      writeSubagentLoadout(sessionFile, snapshot);

      // Profile and package settings are intentionally absent. Replay consumes
      // only the sidecar and executes whatever currently exists at its path.
      writeFileSync(extensionPath, "export default 'updated';", "utf8");
      const read = readSubagentLoadout(sessionFile);
      assert.ok(read && "version" in read);
      assert.equal(testApi.validateLoadoutExtensionPaths(read), null);
      const parts: string[] = [];
      testApi.applySandboxToParts(parts, read, {
        artifactDir: d,
        name: "researcher",
        artifactId: "snapshot-replay",
      });
      const extensionValues = parts
        .flatMap((part, index) => part === "-e" ? [parts[index + 1].slice(1, -1)] : []);
      assert.ok(extensionValues.includes(extensionPath));
      assert.equal(readFileSync(extensionPath, "utf8"), "export default 'updated';");
    });
  });

  it("refuses missing and non-file versioned extension paths", () => {
    withTempDir((d) => {
      const base: SubagentLoadout = {
        version: 1,
        capabilityMode: "extension-grants",
        agent: "restricted",
        builtinTools: ["read"],
        extensionPaths: [join(d, "missing.ts")],
        grantSpawning: false,
        model: null,
        thinking: null,
        systemPromptMode: null,
        identity: null,
        spawnable: null,
        autoExit: true,
        cwd: d,
        agentDir: d,
      };
      assert.match(testApi.validateLoadoutExtensionPaths(base), /sandbox extension is missing/);

      const directoryPath = join(d, "not-a-file.ts");
      mkdirSync(directoryPath);
      assert.match(
        testApi.validateLoadoutExtensionPaths({ ...base, extensionPaths: [directoryPath] }),
        /sandbox extension is missing/,
      );

      const canonicalPath = join(d, "canonical.ts");
      const aliasPath = join(d, "alias.ts");
      writeFileSync(canonicalPath, "export default {};", "utf8");
      symlinkSync(canonicalPath, aliasPath);
      assert.match(
        testApi.validateLoadoutExtensionPaths({ ...base, extensionPaths: [aliasPath] }),
        /not canonical/,
      );
    });
  });

  it("rejects reserved framework controls from versioned profile extension paths", () => {
    const runtimeControlPath = fileURLToPath(
      new URL("../pi-extension/subagents/subagent-runtime-control.ts", import.meta.url),
    );
    const error = testApi.validateLoadoutExtensionPaths({
      version: 1,
      capabilityMode: "extension-grants",
      agent: "restricted",
      builtinTools: [],
      extensionPaths: [runtimeControlPath],
      grantSpawning: false,
      model: null,
      thinking: null,
      systemPromptMode: null,
      identity: null,
      spawnable: null,
      autoExit: true,
      cwd: "/tmp",
      agentDir: "/tmp/agent",
    });
    assert.match(error, /reserved framework path/);
  });

  it("refuses a missing snapshotted path through the public resume tool before pane creation", async () => {
    const d = createTestDir();
    try {
      const sessionPath = join(d, "finished-child.jsonl");
      writeFileSync(sessionPath, '{"type":"session","id":"child-session"}\n', "utf8");
      writeSubagentLoadout(sessionPath, {
        version: 1,
        capabilityMode: "extension-grants",
        agent: "researcher",
        builtinTools: ["read"],
        extensionPaths: [join(d, "removed-extension.ts")],
        grantSpawning: false,
        model: null,
        thinking: null,
        systemPromptMode: null,
        identity: null,
        spawnable: null,
        autoExit: true,
        cwd: d,
        agentDir: d,
      });
      registerName(join(d, "artifacts", "test-session"), "researcher", {
        sessionFile: sessionPath,
        sessionId: "child-session",
      });
      const { api, registeredTools } = createMockExtensionApi();
      (subagentsModule as any).default(api);
      const messageTool = registeredTools.find((tool) => tool.name === "subagent_message");
      assert.ok(messageTool);

      const result = await messageTool.execute(
        "resume-missing-path",
        { name: "researcher", message: "Continue" },
        undefined,
        undefined,
        createMockContext(d, true),
      );
      assert.equal(result.details?.error, result.content[0].text);
      assert.match(result.content[0].text, /sandbox extension is missing/);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it("refuses malformed AGY resume state through the public tool before pane creation", async () => {
    const d = createTestDir();
    try {
      const stateFile = join(d, "agy-state.json");
      writeFileSync(stateFile, JSON.stringify({ version: 1, harness: "agy", conversationId: "conv" }));
      registerName(join(d, "artifacts", "test-session"), "agy-scout", {
        harness: "agy",
        stateFile,
      });
      const { api, registeredTools } = createMockExtensionApi();
      (subagentsModule as any).default(api);
      const messageTool = registeredTools.find((tool) => tool.name === "subagent_message");
      assert.ok(messageTool);
      const result = await messageTool.execute(
        "resume-malformed-agy",
        { name: "agy-scout", message: "Continue" },
        undefined,
        undefined,
        createMockContext(d, true),
      );
      assert.match(result.content[0].text, /AGY snapshot is missing or malformed/);
      assert.equal(testApi.runningSubagents.size, 0);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it("refuses an unavailable version 2 AGY workspace through the public tool before pane creation", async () => {
    const d = createTestDir();
    try {
      const agentName = "pi-agy-scout-workspace";
      const agentRoot = join(d, "agent-workspace");
      const identity = "Inspect only.";
      const description = "Scout";
      const nativeTools = ["view_file"];
      const agentMarkdown = serializeAgyAgent({ name: agentName, description, nativeTools, identity });
      writeAgyAgent(agentRoot, agentName, agentMarkdown);
      const stateFile = join(d, "agy-state-v2.json");
      writeAgyResumeState(stateFile, {
        version: 2,
        harness: "agy",
        conversationId: "conv-123",
        profileName: "agy-scout",
        runtimeName: "agy-scout",
        description,
        cwd: resolve(d),
        model: null,
        effort: null,
        identity,
        logicalTools: ["read"],
        nativeTools,
        agentRoot: resolve(agentRoot),
        agentName,
        agentMarkdown,
        additionalWorkspaceRoots: [resolve(join(d, "removed-parent-workspace"))],
      });
      registerName(join(d, "artifacts", "test-session"), "agy-scout", {
        harness: "agy",
        stateFile,
      });
      const { api, registeredTools } = createMockExtensionApi();
      (subagentsModule as any).default(api);
      const messageTool = registeredTools.find((tool) => tool.name === "subagent_message");
      assert.ok(messageTool);
      const result = await messageTool.execute(
        "resume-missing-agy-workspace",
        { name: "agy-scout", message: "Continue" },
        undefined,
        undefined,
        createMockContext(d, true),
      );
      assert.match(result.content[0].text, /stored AGY replay state is unavailable.*removed-parent-workspace/);
      assert.equal(testApi.runningSubagents.size, 0);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it("requires the spawning extension path when a legacy snapshot grants nesting", () => {
    const error = testApi.validateLoadoutExtensionPaths({
      agent: "coordinator",
      toolAllowlist: "read,subagent,subagent_message,subagents_list,ask_question",
      extensionPaths: [],
      model: null,
      thinking: null,
      systemPromptMode: null,
      identity: null,
      spawnable: ["inspector"],
      autoExit: true,
      cwd: "/tmp",
      agentDir: "/tmp/agent",
    });
    assert.match(error, /no extension paths|spawning extension path/);
  });

  it("buildPiPromptArgs inserts separator for artifact-backed launches with skills", () => {
    assert.deepEqual(
      testApi.buildPiPromptArgs({ effectiveSkills: ["review", "lint"], taskDelivery: "artifact", taskArg: "@artifact.md" }),
      ["", "/skill:review", "/skill:lint", "@artifact.md"],
    );
  });

  it("buildPiPromptArgs omits separator for artifact-backed launches without skills", () => {
    assert.deepEqual(
      testApi.buildPiPromptArgs({ effectiveSkills: undefined, taskDelivery: "artifact", taskArg: "@artifact.md" }),
      ["@artifact.md"],
    );
  });

  it("buildPiPromptArgs omits separator for direct launches with skills", () => {
    assert.deepEqual(
      testApi.buildPiPromptArgs({ effectiveSkills: ["review"], taskDelivery: "direct", taskArg: "do the task" }),
      ["/skill:review", "do the task"],
    );
  });

  it("lists visible agents from discovery", async () => {
    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir }) => {
      writeAgentFile(
        projectAgentsDir,
        "visible-discovery-test-agent",
        [
          "name: visible-discovery-test-agent",
          "description: Visible test agent",
          "model: anthropic/test-visible",
        ].join("\n"),
      );

      const { api, registeredTools } = createMockExtensionApi();
      (subagentsModule as any).default(api);

      const tool = registeredTools.find((tool) => tool.name === "subagents_list");
      assert.ok(tool, "expected subagents_list to be registered");

      const result = await tool.execute(
        "list-visible",
        {},
        undefined,
        undefined,
        createMockContext(projectDir, true),
      );
      const agents = result.details?.agents ?? [];

      assert.ok(agents.some((agent: any) => agent.name === "visible-discovery-test-agent"));
      assert.match(result.content[0].text, /visible-discovery-test-agent/);
    });
  });

  it("hides disable-model-invocation agents from listings but keeps direct loading", async () => {
    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir }) => {
      writeAgentFile(
        projectAgentsDir,
        "hidden-discovery-test-agent",
        [
          "name: hidden-discovery-test-agent",
          "description: Hidden test agent",
          "model: anthropic/test-hidden",
          "disable-model-invocation: true",
        ].join("\n"),
        "You are the hidden agent.",
      );

      const { api, registeredTools } = createMockExtensionApi();
      (subagentsModule as any).default(api);

      const tool = registeredTools.find((tool) => tool.name === "subagents_list");
      assert.ok(tool, "expected subagents_list to be registered");

      const result = await tool.execute(
        "list-hidden",
        {},
        undefined,
        undefined,
        createMockContext(projectDir, true),
      );
      const agents = result.details?.agents ?? [];

      assert.equal(agents.some((agent: any) => agent.name === "hidden-discovery-test-agent"), false);
      assert.doesNotMatch(result.content[0].text, /hidden-discovery-test-agent/);

      const loaded = await testApi.findAgentDefinition("hidden-discovery-test-agent");
      assert.ok(loaded, "expected hidden agent to remain directly loadable");
      assert.equal(loaded.model, "anthropic/test-hidden");
      assert.equal(loaded.body, "You are the hidden agent.");
      assert.equal(loaded.disableModelInvocation, true);
    });
  });

  it("lets a hidden project agent shadow a visible global agent", async () => {
    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir, globalAgentsDir }) => {
      writeAgentFile(
        globalAgentsDir,
        "shadowed-discovery-test-agent",
        [
          "name: shadowed-discovery-test-agent",
          "description: Global visible agent",
          "model: anthropic/test-global",
        ].join("\n"),
        "You are the global visible agent.",
      );
      writeAgentFile(
        projectAgentsDir,
        "shadowed-discovery-test-agent",
        [
          "name: shadowed-discovery-test-agent",
          "description: Project hidden agent",
          "model: anthropic/test-project",
          "disable-model-invocation: true",
        ].join("\n"),
        "You are the project hidden agent.",
      );

      const { api, registeredTools } = createMockExtensionApi();
      (subagentsModule as any).default(api);

      const tool = registeredTools.find((tool) => tool.name === "subagents_list");
      assert.ok(tool, "expected subagents_list to be registered");

      const result = await tool.execute(
        "list-shadowed",
        {},
        undefined,
        undefined,
        createMockContext(projectDir, true),
      );
      const agents = result.details?.agents ?? [];

      assert.equal(agents.some((agent: any) => agent.name === "shadowed-discovery-test-agent"), false);
      assert.doesNotMatch(result.content[0].text, /shadowed-discovery-test-agent/);

      const loaded = await testApi.findAgentDefinition("shadowed-discovery-test-agent");
      assert.ok(loaded, "expected project override to remain directly loadable");
      assert.equal(loaded.model, "anthropic/test-project");
      assert.equal(loaded.body, "You are the project hidden agent.");
      assert.equal(loaded.disableModelInvocation, true);
    });
  });
});
describe("AGY harness helpers", () => {
  function makeState(dir: string, overrides: Partial<AgyResumeStateV1> = {}): AgyResumeStateV1 {
    const agentName = "pi-scout-abc123";
    const agentRoot = join(dir, "workspace");
    const identity = "Inspect the repository without changing it.";
    const description = "Read-only scout";
    const nativeTools = ["view_file", "grep_search", "find_by_name", "list_dir"];
    const agentMarkdown = serializeAgyAgent({ name: agentName, description, nativeTools, identity });
    return {
      version: 1,
      harness: "agy",
      conversationId: "conversation-123",
      profileName: "scout",
      runtimeName: "scout-run",
      description,
      cwd: resolve(dir),
      model: "gemini-3.8-flash",
      effort: "medium",
      identity,
      logicalTools: ["read", "grep", "find", "ls"],
      nativeTools,
      agentRoot: resolve(agentRoot),
      agentName,
      agentMarkdown,
      ...overrides,
    };
  }

  it("serializes one primary non-subagent with exactly translated tools", () => {
    const name = buildAgyAgentName("Scout Review", "unique_123");
    const empty = serializeAgyAgent({
      name: "pi-empty-tools",
      description: "No tools",
      nativeTools: [],
      identity: "Answer without tools.",
    });
    assert.match(empty, /\ntools: \[\]\nmainAgent: true\n/);

    const markdown = serializeAgyAgent({

      name,
      description: "Read-only scout",
      nativeTools: translateAgyTools(["ls", "read", "grep"]),
      identity: "Read only.",
    });
    assert.match(markdown, /^---\nname: pi-scout-review-unique_123\n/);
    assert.match(markdown, /tools:\n  - list_dir\n  - view_file\n  - grep_search\n/);
    assert.match(markdown, /mainAgent: true\nsubagent: false/);
    for (const forbidden of ["write_file", "run_command", "ask_permission", "web", "mcp", "browser", "image", "scheduler"]) {
      assert.doesNotMatch(markdown, new RegExp(forbidden));
    }
  });

  it("derives only a distinct resolved parent workspace", () => {
    assert.deepEqual(deriveAgyAdditionalWorkspaceRoots("/control/./", "/target"), ["/control"]);
    assert.deepEqual(deriveAgyAdditionalWorkspaceRoots("/target/./", "/target"), []);
  });

  it("builds a stable deduplicated escaped AGY workspace command without permission bypass", () => {
    const command = buildAgyCommand({
      agentRoot: "/tmp/agent root",
      additionalWorkspaceRoots: ["/tmp/control root", "/tmp/control root", "/tmp/agent root"],
      agentName: "pi-scout-123",
      taskFile: "/tmp/task'file.txt",
      stdoutFile: "/tmp/result.json",
      stderrFile: "/tmp/result.stderr",
      model: "gemini-3.8-flash",
      effort: "high",
      conversationId: "conversation-123",
    });
    assert.match(command, /^agy --output-format json /);
    assert.match(command, /--add-dir '\/tmp\/agent root' --add-dir '\/tmp\/control root' --agent 'pi-scout-123'/);
    assert.equal([...command.matchAll(/--add-dir/g)].length, 2);
    assert.match(command, /--agent 'pi-scout-123'/);
    assert.match(command, /--model 'gemini-3\.8-flash' --effort 'high'/);
    assert.match(command, /--conversation 'conversation-123'/);
    assert.match(command, /\$\(cat -- '\/tmp\/task'\\''file\.txt'\)/);
    assert.match(command, /> '\/tmp\/result\.json' 2> '\/tmp\/result\.stderr'/);
    assert.doesNotMatch(command, /dangerously-skip-permissions/);
    assert.throws(() => buildAgyCommand({
      agentRoot: "/tmp/agent",
      additionalWorkspaceRoots: ["relative/workspace"],
      agentName: "pi-scout-123",
      taskFile: "/tmp/task.txt",
      stdoutFile: "/tmp/result.json",
      stderrFile: "/tmp/result.stderr",
      model: null,
      effort: null,
    }), /absolute resolved path/);
  });

  it("strictly parses success usage, denied actions, and all failure classes", () => {
    assert.deepEqual(parseAgyResult(JSON.stringify({
      conversation_id: "conv-1",
      status: "SUCCESS",
      response: "exact response\n",
      usage: {
        input_tokens: 12,
        output_tokens: 7,
        thinking_tokens: 3,
        cache_read_tokens: 2,
        total_tokens: 24,
      },
    })), {
      ok: true,
      response: "exact response\n",
      conversationId: "conv-1",
      usage: { inputTokens: 12, outputTokens: 7, thinkingTokens: 3, cacheReadTokens: 2, totalTokens: 24 },
    });
    const denied = parseAgyResult(JSON.stringify({
      conversation_id: "conv-denied",
      status: "SUCCESS",
      response: "",
      denied_actions: [{ tool: "read_file", path: "/outside/plan.md" }],
    }), "approval unavailable in headless mode");
    assert.equal(denied.ok, false);
    assert.match((denied as any).error, /denied one or more actions.*read_file.*outside\/plan\.md.*stderr: approval unavailable/);
    assert.doesNotMatch((denied as any).error, /success without a non-empty response/);
    const boundedDenied = parseAgyResult(JSON.stringify({
      status: "SUCCESS",
      denied_actions: ["x".repeat(5000)],
    }), "y".repeat(5000));
    assert.ok((boundedDenied as any).error.length < 8100);

    assert.match((parseAgyResult("not-json", "diagnostic") as any).error, /invalid JSON.*diagnostic/);
    assert.match((parseAgyResult(JSON.stringify({ status: "SUCCESS", response: "ok", conversation_id: "" })) as any).error, /conversation ID/);
    assert.match((parseAgyResult(JSON.stringify({ status: "ERROR", error: "bad effort" })) as any).error, /bad effort/);
    assert.match((parseAgyResult(JSON.stringify({ status: "WAITING" })) as any).error, /non-terminal/);
    assert.match((parseAgyResult(JSON.stringify({ status: "CANCELLED", error: "cancelled" })) as any).error, /cancelled/);
  });

  it("round-trips strict version 1 and version 2 resume state and detects workspace drift", () => {
    withTempDir((dir) => {
      const stateV1 = makeState(dir);
      mkdirSync(stateV1.cwd, { recursive: true });
      writeAgyAgent(stateV1.agentRoot, stateV1.agentName, stateV1.agentMarkdown);
      assert.equal(agyAgentDefinitionPath(stateV1.agentRoot, stateV1.agentName).endsWith("agent.md"), true);
      assert.equal(isAgyResumeState(stateV1), true);
      assert.deepEqual(agyAdditionalWorkspaceRoots(stateV1), []);
      assert.equal(validateAgyReplayState(stateV1), null);
      const stateV1File = join(dir, "state", "agy-v1.json");
      writeAgyResumeState(stateV1File, stateV1);
      assert.deepEqual(readAgyResumeState(stateV1File), stateV1);

      const parentWorkspace = resolve(join(dir, "parent-workspace"));
      mkdirSync(parentWorkspace);
      const stateV2: AgyResumeStateV2 = {
        ...stateV1,
        version: 2,
        additionalWorkspaceRoots: [parentWorkspace],
      };
      assert.equal(isAgyResumeState(stateV2), true);
      assert.deepEqual(agyAdditionalWorkspaceRoots(stateV2), [parentWorkspace]);
      assert.equal(validateAgyReplayState(stateV2), null);
      const stateV2File = join(dir, "state", "agy-v2.json");
      writeAgyResumeState(stateV2File, stateV2);
      assert.deepEqual(readAgyResumeState(stateV2File), stateV2);

      const { additionalWorkspaceRoots: _missing, ...missingRoots } = stateV2;
      assert.equal(isAgyResumeState(missingRoots), false);
      assert.equal(isAgyResumeState({ ...stateV2, additionalWorkspaceRoots: [parentWorkspace, parentWorkspace] }), false);
      assert.equal(isAgyResumeState({ ...stateV2, additionalWorkspaceRoots: [stateV2.cwd] }), false);
      assert.equal(isAgyResumeState({ ...stateV2, additionalWorkspaceRoots: [stateV2.agentRoot] }), false);
      assert.equal(isAgyResumeState({ ...stateV2, additionalWorkspaceRoots: ["relative"] }), false);
      assert.equal(isAgyResumeState({ ...stateV2, additionalWorkspaceRoots: [`${parentWorkspace}/../parent-workspace`] }), false);
      const unavailable = { ...stateV2, additionalWorkspaceRoots: [resolve(join(dir, "missing-workspace"))] };
      assert.equal(isAgyResumeState(unavailable), true);
      assert.match(validateAgyReplayState(unavailable) ?? "", /stored AGY replay state is unavailable.*missing-workspace/);

      writeFileSync(agyAgentDefinitionPath(stateV1.agentRoot, stateV1.agentName), "broadened");
      assert.match(validateAgyReplayState(stateV1) ?? "", /no longer matches/);
      assert.equal(isAgyResumeState({ ...stateV1, nativeTools: [...stateV1.nativeTools, "write_file"] }), false);
      assert.equal(isAgyResumeState({ ...stateV1, runtimeName: "other", extra: true }), false);
    });
  });
});

describe("question protocol", () => {
  it("strictly round-trips requests and private multiline answers", () => {
    withTempDir((dir) => {
      const id = createQuestionId();
      const requestFile = join(dir, "session.ask");
      const request = {
        version: QUESTION_PROTOCOL_VERSION,
        id,
        name: "worker",
        agent: "implementer",
        question: "Choose one?",
      } as const;
      writeQuestionRequest(requestFile, request);
      assert.deepEqual(readQuestionRequest(requestFile), request);
      assert.deepEqual(parseQuestionRequest({ ...request, extra: true }), null);

      const encoded = encodeQuestionAnswer(id, "/slash\nline two  ");
      assert.equal(encoded.startsWith("/"), false);
      assert.deepEqual(parseQuestionAnswer(encoded), {
        private: true,
        answer: { version: QUESTION_PROTOCOL_VERSION, id, answer: "/slash\nline two  " },
      });
      assert.deepEqual(parseQuestionAnswer(`${QUESTION_ANSWER_PREFIX}{bad`), {
        private: true,
        answer: null,
      });
      assert.deepEqual(parseQuestionAnswer("ordinary"), { private: false });
    });
  });

  it("accepts only exact ID-only acknowledgment markers", () => {
    withTempDir((dir) => {
      const file = join(dir, "session.ask.ack");
      const id = createQuestionId();
      writeQuestionAcknowledgment(file, id);
      assert.equal(readQuestionAcknowledgment(file), id);
      writeFileSync(file, `${id}\nextra\n`);
      assert.equal(readQuestionAcknowledgment(file), null);
    });
  });
});

describe("subagent runtime control", () => {
  function setupCapturingExtension(
    sessionFile: string,
    options: { autoExit?: boolean; activityFile?: string; runningChildId?: string } = {},
  ) {
    const handlers = new Map<string, Array<(...args: any[]) => any>>();
    const tools: any[] = [];
    const api = {
      on(event: string, handler: (...args: any[]) => any) {
        if (!handlers.has(event)) handlers.set(event, []);
        handlers.get(event)!.push(handler);
      },
      registerTool(tool: any) { tools.push(tool); },
      registerCommand() {}, registerMessageRenderer() {}, registerShortcut() {},
      sendUserMessage() {}, sendMessage() {}, getAllTools() { return []; },
    } as any;
    const saved = {
      session: process.env.PI_SUBAGENT_SESSION,
      name: process.env.PI_SUBAGENT_NAME,
      agent: process.env.PI_SUBAGENT_AGENT,
      autoExit: process.env.PI_SUBAGENT_AUTO_EXIT,
      activityFile: process.env.PI_SUBAGENT_ACTIVITY_FILE,
      runningChildId: process.env.PI_SUBAGENT_ID,
    };
    process.env.PI_SUBAGENT_SESSION = sessionFile;
    process.env.PI_SUBAGENT_NAME = "inspector-2";
    process.env.PI_SUBAGENT_AGENT = "inspector";
    process.env.PI_SUBAGENT_AUTO_EXIT = options.autoExit === false ? "0" : "1";
    if (options.activityFile) process.env.PI_SUBAGENT_ACTIVITY_FILE = options.activityFile;
    else delete process.env.PI_SUBAGENT_ACTIVITY_FILE;
    if (options.runningChildId) process.env.PI_SUBAGENT_ID = options.runningChildId;
    else delete process.env.PI_SUBAGENT_ID;
    subagentRuntimeControlExtension(api);
    const emit = async (event: string, ...args: any[]) => {
      for (const handler of handlers.get(event) ?? []) {
        const result = await handler(...args);
        if (result?.action === "handled") return result;
      }
      return { action: "continue" };
    };
    const restore = () => {
      restoreEnvVar("PI_SUBAGENT_SESSION", saved.session);
      restoreEnvVar("PI_SUBAGENT_NAME", saved.name);
      restoreEnvVar("PI_SUBAGENT_AGENT", saved.agent);
      restoreEnvVar("PI_SUBAGENT_AUTO_EXIT", saved.autoExit);
      restoreEnvVar("PI_SUBAGENT_ACTIVITY_FILE", saved.activityFile);
      restoreEnvVar("PI_SUBAGENT_ID", saved.runningChildId);
    };
    const tool = tools.find((candidate) => candidate.name === "ask_question");
    return { emit, handlers, tool, tools, restore };
  }

  describe("shouldMarkUserTookOver", () => {
    it("ignores the initial injected task before the first agent run", () => {
      assert.equal(shouldMarkUserTookOver(false), false);
    });

    it("treats later input as manual takeover", () => {
      assert.equal(shouldMarkUserTookOver(true), true);
    });
  });

  describe("shouldFinalizeOnAgentSettled", () => {
    it("finalizes after normal completion when there was no takeover", () => {
      const messages = [{ role: "assistant", stopReason: "stop" }];
      assert.equal(shouldFinalizeOnAgentSettled(false, messages), true);
    });

    it("finalizes after normal completion even when the user sent the prompt", () => {
      const messages = [{ role: "assistant", stopReason: "stop" }];
      assert.equal(shouldFinalizeOnAgentSettled(true, messages), true);
    });

    it("stays open after Escape aborts the run", () => {
      const messages = [{ role: "assistant", stopReason: "aborted" }];
      assert.equal(shouldFinalizeOnAgentSettled(false, messages), false);
    });

    it("still finalizes when the latest run ended with stopReason=error", () => {
      // Auto-exit subagents must shut down on retry-exhaustion errors so the
      // parent is woken. The error sidecar (written separately) carries the
      // failure detail; staying open would just strand the implementer.
      const messages = [{ role: "assistant", stopReason: "error", errorMessage: "529 overloaded" }];
      assert.equal(shouldFinalizeOnAgentSettled(false, messages), true);
    });
  });

  describe("findLatestAssistantError", () => {
    it("returns the error info from a stopReason=error message", () => {
      const messages = [
        { role: "assistant", stopReason: "stop", content: [{ type: "text", text: "ok" }] },
        { role: "toolResult", content: [] },
        { role: "assistant", stopReason: "error", errorMessage: "Anthropic 529 Overloaded" },
      ];
      assert.deepEqual(findLatestAssistantError(messages), {
        errorMessage: "Anthropic 529 Overloaded",
        stopReason: "error",
      });
    });

    it("returns null when the latest assistant turn completed normally", () => {
      const messages = [
        { role: "assistant", stopReason: "error", errorMessage: "old failure" },
        { role: "user", content: [] },
        { role: "assistant", stopReason: "stop", content: [{ type: "text", text: "done" }] },
      ];
      assert.equal(findLatestAssistantError(messages), null);
    });

    it("returns null when the latest assistant turn was aborted by the user", () => {
      const messages = [{ role: "assistant", stopReason: "aborted" }];
      assert.equal(findLatestAssistantError(messages), null);
    });

    it("falls back to a placeholder when stopReason=error has no errorMessage field", () => {
      const messages = [{ role: "assistant", stopReason: "error" }];
      const info = findLatestAssistantError(messages);
      assert.ok(info);
      assert.equal(info!.stopReason, "error");
      assert.match(info!.errorMessage, /stopReason=error/);
    });

    it("returns null when messages is undefined or empty", () => {
      assert.equal(findLatestAssistantError(undefined), null);
      assert.equal(findLatestAssistantError([]), null);
    });
  });

  describe("runningChildrenCount", () => {
    const KEY = Symbol.for("pi-subagents/running-children-count");
    function withGlobal(value: unknown, run: () => void) {
      const prev = (globalThis as any)[KEY];
      (globalThis as any)[KEY] = value;
      try {
        run();
      } finally {
        (globalThis as any)[KEY] = prev;
      }
    }

    it("returns 0 when the spawning tools aren't loaded (no global)", () => {
      withGlobal(undefined, () => {
        assert.equal(runningChildrenCount(), 0);
      });
    });

    it("reflects the live child count published by index.ts", () => {
      withGlobal(() => 3, () => {
        assert.equal(runningChildrenCount(), 3);
      });
    });

    it("treats zero/negative/non-number/throwing getters as 0", () => {
      withGlobal(() => 0, () => assert.equal(runningChildrenCount(), 0));
      withGlobal(() => -1, () => assert.equal(runningChildrenCount(), 0));
      withGlobal(() => "two", () => assert.equal(runningChildrenCount(), 0));
      withGlobal(() => { throw new Error("boom"); }, () => assert.equal(runningChildrenCount(), 0));
    });
  });

  describe("settled auto-exit lifecycle", () => {
    const normalMessages = [{ role: "assistant", stopReason: "stop" }];
    const settledContext = (pending: () => boolean, shutdown: () => void) => ({
      hasPendingMessages: pending,
      shutdown,
    });

    it("replaces a transient error with a successful retry before finalizing", async () => {
      const dir = createTestDir();
      const sessionFile = join(dir, "session.jsonl");
      const activityFile = join(dir, "activity.json");
      const childId = "retry-child";
      const { emit, restore } = setupCapturingExtension(sessionFile, { activityFile, runningChildId: childId });
      let shutdowns = 0;
      const ctx = settledContext(() => false, () => { shutdowns += 1; });
      try {
        await emit("agent_start", { type: "agent_start" }, ctx);
        await emit("agent_end", {
          type: "agent_end",
          messages: [{ role: "assistant", stopReason: "error", errorMessage: "temporary 529" }],
        }, ctx);

        assert.equal(existsSync(`${sessionFile}.exit`), false);
        assert.equal(shutdowns, 0);
        let activity = readSubagentActivityFile(activityFile, childId);
        assert.ok(activity.ok);
        assert.equal(activity.activity.phase, "waiting");
        assert.equal(activity.activity.latestEvent, "agent_end");

        await emit("agent_start", { type: "agent_start" }, ctx);
        activity = readSubagentActivityFile(activityFile, childId);
        assert.ok(activity.ok);
        assert.equal(activity.activity.phase, "active");
        assert.equal(activity.activity.latestEvent, "agent_start");

        await emit("agent_end", { type: "agent_end", messages: normalMessages }, ctx);
        await emit("agent_settled", { type: "agent_settled" }, ctx);

        assert.equal(existsSync(`${sessionFile}.exit`), false);
        assert.equal(shutdowns, 1);
        activity = readSubagentActivityFile(activityFile, childId);
        assert.ok(activity.ok);
        assert.equal(activity.activity.phase, "done");
        assert.equal(activity.activity.latestEvent, "agent_settled");

        await emit("agent_settled", { type: "agent_settled" }, ctx);
        assert.equal(shutdowns, 1, "duplicate settlement must not finalize twice");
      } finally {
        restore();
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("writes the latest exhausted error only after settlement", async () => {
      const dir = createTestDir();
      const sessionFile = join(dir, "session.jsonl");
      const activityFile = join(dir, "activity.json");
      const childId = "error-child";
      const { emit, restore } = setupCapturingExtension(sessionFile, { activityFile, runningChildId: childId });
      let shutdowns = 0;
      const ctx = settledContext(() => false, () => { shutdowns += 1; });
      try {
        await emit("agent_end", {
          type: "agent_end",
          messages: [{ role: "assistant", stopReason: "error", errorMessage: "final 529" }],
        }, ctx);
        assert.equal(existsSync(`${sessionFile}.exit`), false);
        assert.equal(shutdowns, 0);

        await emit("agent_settled", { type: "agent_settled" }, ctx);
        assert.deepEqual(JSON.parse(readFileSync(`${sessionFile}.exit`, "utf8")), {
          type: "error",
          errorMessage: "final 529",
          stopReason: "error",
        });
        assert.equal(shutdowns, 1);
        const activity = readSubagentActivityFile(activityFile, childId);
        assert.ok(activity.ok);
        assert.equal(activity.activity.phase, "done");
        assert.equal(activity.activity.latestEvent, "agent_settled");
      } finally {
        restore();
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("leaves an aborted final run waiting without completion artifacts", async () => {
      const dir = createTestDir();
      const sessionFile = join(dir, "session.jsonl");
      const activityFile = join(dir, "activity.json");
      const childId = "abort-child";
      const { emit, restore } = setupCapturingExtension(sessionFile, { activityFile, runningChildId: childId });
      let shutdowns = 0;
      const ctx = settledContext(() => false, () => { shutdowns += 1; });
      try {
        await emit("agent_end", {
          type: "agent_end",
          messages: [{ role: "assistant", stopReason: "aborted" }],
        }, ctx);
        await emit("agent_settled", { type: "agent_settled" }, ctx);

        assert.equal(existsSync(`${sessionFile}.exit`), false);
        assert.equal(shutdowns, 0);
        const activity = readSubagentActivityFile(activityFile, childId);
        assert.ok(activity.ok);
        assert.equal(activity.activity.phase, "waiting");
        assert.equal(activity.activity.latestEvent, "agent_end");
      } finally {
        restore();
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("rechecks Pi-owned pending messages at each settlement", async () => {
      const dir = createTestDir();
      const sessionFile = join(dir, "session.jsonl");
      const { emit, restore } = setupCapturingExtension(sessionFile);
      let pendingMessages = true;
      let shutdowns = 0;
      const ctx = settledContext(() => pendingMessages, () => { shutdowns += 1; });
      try {
        await emit("agent_end", { type: "agent_end", messages: normalMessages }, ctx);
        await emit("agent_settled", { type: "agent_settled" }, ctx);
        assert.equal(shutdowns, 0);

        pendingMessages = false;
        await emit("agent_start", { type: "agent_start" }, ctx);
        await emit("agent_end", { type: "agent_end", messages: normalMessages }, ctx);
        await emit("agent_settled", { type: "agent_settled" }, ctx);
        assert.equal(shutdowns, 1);
      } finally {
        restore();
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("rechecks running nested children at each settlement", async () => {
      const dir = createTestDir();
      const sessionFile = join(dir, "session.jsonl");
      const key = Symbol.for("pi-subagents/running-children-count");
      const previous = (globalThis as any)[key];
      let runningChildren = 1;
      (globalThis as any)[key] = () => runningChildren;
      const { emit, restore } = setupCapturingExtension(sessionFile);
      let shutdowns = 0;
      const ctx = settledContext(() => false, () => { shutdowns += 1; });
      try {
        await emit("agent_end", { type: "agent_end", messages: normalMessages }, ctx);
        await emit("agent_settled", { type: "agent_settled" }, ctx);
        assert.equal(shutdowns, 0);

        runningChildren = 0;
        await emit("agent_start", { type: "agent_start" }, ctx);
        await emit("agent_end", { type: "agent_end", messages: normalMessages }, ctx);
        await emit("agent_settled", { type: "agent_settled" }, ctx);
        assert.equal(shutdowns, 1);
      } finally {
        (globalThis as any)[key] = previous;
        restore();
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("rechecks a pending parent question at each settlement", async () => {
      const dir = createTestDir();
      const sessionFile = join(dir, "session.jsonl");
      const { emit, tool, restore } = setupCapturingExtension(sessionFile);
      let shutdowns = 0;
      const ctx = settledContext(() => false, () => { shutdowns += 1; });
      try {
        const answerPromise = tool.execute("question-1", { question: "continue?" }, undefined, undefined, ctx);
        await Promise.resolve();
        await emit("agent_end", { type: "agent_end", messages: normalMessages }, ctx);
        await emit("agent_settled", { type: "agent_settled" }, ctx);
        assert.equal(shutdowns, 0);

        const request = readQuestionRequest(questionRequestPath(sessionFile));
        assert.ok(request);
        await emit("input", {
          type: "input",
          text: encodeQuestionAnswer(request.id, "yes"),
        });
        await answerPromise;
        await emit("agent_start", { type: "agent_start" }, ctx);
        await emit("agent_end", { type: "agent_end", messages: normalMessages }, ctx);
        await emit("agent_settled", { type: "agent_settled" }, ctx);
        assert.equal(shutdowns, 1);
      } finally {
        restore();
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("keeps non-auto-exit profiles waiting after settlement", async () => {
      const dir = createTestDir();
      const sessionFile = join(dir, "session.jsonl");
      const { emit, restore } = setupCapturingExtension(sessionFile, { autoExit: false });
      let shutdowns = 0;
      const ctx = settledContext(() => false, () => { shutdowns += 1; });
      try {
        await emit("agent_end", { type: "agent_end", messages: normalMessages }, ctx);
        await emit("agent_settled", { type: "agent_settled" }, ctx);
        assert.equal(shutdowns, 0);
        assert.equal(existsSync(`${sessionFile}.exit`), false);
      } finally {
        restore();
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("profile capability activation", () => {
    const availableTools = [
      { name: "read", sourceInfo: { source: "builtin" } },
      { name: "bash", sourceInfo: { source: "builtin" } },
      { name: "ask_question", sourceInfo: { source: "local" } },
      { name: "web_search", sourceInfo: { source: "package" } },
      { name: "write", sourceInfo: { source: "package" } },
    ];

    it("activates selected built-ins plus every startup extension tool", () => {
      assert.deepEqual(resolveProfileActiveTools("read", availableTools), [
        "read",
        "ask_question",
        "web_search",
        "write",
      ]);
    });

    it("keeps extension overrides active when the matching built-in is omitted", () => {
      const active = resolveProfileActiveTools("", availableTools);
      assert.ok(active);
      assert.equal(active.includes("write"), true);
      assert.equal(active.includes("read"), false);
      assert.equal(active.includes("bash"), false);
    });

    it("fails malformed private built-in input closed without disabling extension tools", () => {
      assert.deepEqual(resolveProfileActiveTools("read,unknown", availableTools), [
        "ask_question",
        "web_search",
        "write",
      ]);
      assert.deepEqual(resolveProfileActiveTools("read,read", availableTools), [
        "ask_question",
        "web_search",
        "write",
      ]);
      assert.equal(resolveProfileActiveTools(undefined, availableTools), null);
    });

    it("preserves Pi dynamic activation and activates later built-in overrides", async () => {
      const dir = createTestDir();
      const savedBuiltinTools = process.env[SUBAGENT_BUILTIN_TOOLS_ENV];
      process.env[SUBAGENT_BUILTIN_TOOLS_ENV] = "";
      let firstProfileApi: any;
      let registerDynamicRead = false;
      const makeTool = (name: string, label: string) => ({
        name,
        label,
        description: label,
        parameters: Type.Object({}),
        async execute() {
          return { content: [{ type: "text", text: label }], details: {} };
        },
      });
      const settingsManager = SettingsManager.inMemory();
      const resourceLoader = new DefaultResourceLoader({
        cwd: dir,
        agentDir: dir,
        settingsManager,
        noExtensions: true,
        noSkills: true,
        noPromptTemplates: true,
        noThemes: true,
        noContextFiles: true,
        extensionFactories: [
          { name: "runtime-control", factory: subagentRuntimeControlExtension },
          {
            name: "profile-first",
            factory(pi) {
              firstProfileApi = pi;
              pi.registerTool(makeTool("duplicate_custom", "first duplicate"));
              pi.registerTool(makeTool("write", "startup write override"));
              pi.on("session_start", () => {
                pi.registerTool(makeTool("session_dynamic", "session dynamic"));
                pi.registerTool(makeTool("ls", "session ls override"));
              });
              pi.on("before_agent_start", () => {
                if (!registerDynamicRead) return;
                registerDynamicRead = false;
                pi.registerTool(makeTool("read", "dynamic read override"));
              });
            },
          },
          {
            name: "profile-second",
            factory(pi) {
              pi.registerTool(makeTool("duplicate_custom", "second duplicate"));
              pi.registerTool(makeTool("ask_question", "profile collision"));
            },
          },
          { name: "capability-activation", factory: capabilityActivationExtension },
        ],
      });
      let session: Awaited<ReturnType<typeof createAgentSession>>["session"] | undefined;

      try {
        await resourceLoader.reload();
        const created = await createAgentSession({
          cwd: dir,
          agentDir: dir,
          noTools: "builtin",
          resourceLoader,
          settingsManager,
          sessionManager: PiSessionManager.inMemory(dir),
        });
        session = created.session;
        await session.bindExtensions({});

        assert.deepEqual(
          created.extensionsResult.extensions.map((extension: any) => extension.path),
          [
            "<inline:runtime-control>",
            "<inline:profile-first>",
            "<inline:profile-second>",
            "<inline:capability-activation>",
          ],
        );
        const activationControl = created.extensionsResult.extensions.at(-1) as any;
        assert.equal(activationControl.tools.size, 0, "the trailing control must register no tools");
        assert.equal(session.getToolDefinition("duplicate_custom")?.label, "first duplicate");
        assert.equal(session.getToolDefinition("ask_question")?.label, "ask_question");
        assert.equal(session.getToolDefinition("write")?.label, "startup write override");
        assert.equal(session.getToolDefinition("ls")?.label, "session ls override");
        assert.deepEqual(
          new Set(session.getActiveToolNames()),
          new Set(["ask_question", "duplicate_custom", "write", "session_dynamic", "ls"]),
        );

        firstProfileApi.registerTool(makeTool("later_custom", "later custom"));
        assert.equal(session.getActiveToolNames().includes("later_custom"), true);

        registerDynamicRead = true;
        assert.equal(session.getActiveToolNames().includes("read"), false);
        await (session as any)._extensionRunner.emitBeforeAgentStart(
          "test prompt",
          [],
          "test system prompt",
          { cwd: dir },
        );
        assert.equal(session.getToolDefinition("read")?.label, "dynamic read override");
        assert.equal(
          session.getActiveToolNames().includes("read"),
          true,
          "the trailing activation handler must enable a same-event profile override",
        );

        session.setActiveToolsByName(
          session.getActiveToolNames().filter((name) => name !== "later_custom"),
        );
        await (session as any)._extensionRunner.emit({
          type: "turn_start",
          turnIndex: 2,
          timestamp: Date.now(),
        });
        assert.equal(
          session.getActiveToolNames().includes("later_custom"),
          false,
          "an observed extension tool that is explicitly deactivated must stay inactive",
        );
      } finally {
        session?.dispose();
        restoreEnvVar(SUBAGENT_BUILTIN_TOOLS_ENV, savedBuiltinTools);
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("applies the profile activation during session_start", () => {
      const savedBuiltinTools = process.env[SUBAGENT_BUILTIN_TOOLS_ENV];
      process.env[SUBAGENT_BUILTIN_TOOLS_ENV] = "read";
      const handlers = new Map<string, Array<(...args: any[]) => void>>();
      const activeCalls: string[][] = [];
      let activeTools: string[] = [];
      const api = {
        on(event: string, handler: (...args: any[]) => void) {
          if (!handlers.has(event)) handlers.set(event, []);
          handlers.get(event)!.push(handler);
        },
        registerTool() {}, registerCommand() {}, registerMessageRenderer() {}, registerShortcut() {},
        sendUserMessage() {}, sendMessage() {},
        getAllTools() { return availableTools; },
        getActiveTools() { return [...activeTools]; },
        setActiveTools(names: string[]) {
          activeTools = [...names];
          activeCalls.push([...names]);
        },
      } as any;

      try {
        capabilityActivationExtension(api);
        for (const handler of handlers.get("session_start") ?? []) {
          handler(
            { type: "session_start", reason: "startup" },
            { ui: { setWidget() {} } },
          );
        }
        assert.deepEqual(activeCalls, [["read", "ask_question", "web_search", "write"]]);
      } finally {
        restoreEnvVar(SUBAGENT_BUILTIN_TOOLS_ENV, savedBuiltinTools);
      }
    });
  });

  describe("ask_question tool", () => {
    it("registers ask_question without the retired ping tool", () => {
      const dir = createTestDir();
      const { tool, tools, restore } = setupCapturingExtension(join(dir, "s.jsonl"));
      try {
        const names = tools.map((candidate) => candidate.name);
        assert.ok(names.includes("ask_question"));
        assert.ok(!names.includes(["caller", "ping"].join("_")));
        assert.deepEqual(Object.keys(tool.parameters.properties), ["question"]);
        assert.match(tool.description, /orchestrator/i);
      } finally {
        restore();
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("keeps the tool pending until the exact private answer is handled", async () => {
      const dir = createTestDir();
      const sessionFile = join(dir, "s.jsonl");
      const { emit, tool, restore } = setupCapturingExtension(sessionFile);
      try {
        let settled = false;
        const resultPromise = tool.execute(
          "call-1",
          { question: "Which API base URL?" },
          undefined,
          undefined,
          { shutdown() {} },
        ).then((result: any) => {
          settled = true;
          return result;
        });

        await Promise.resolve();
        assert.equal(settled, false, "ask_question must remain pending before an answer");
        const request = readQuestionRequest(questionRequestPath(sessionFile));
        assert.ok(request);
        assert.equal(request.question, "Which API base URL?");
        assert.equal(request.name, "inspector-2");
        assert.equal(request.agent, "inspector");

        const mismatch = await emit("input", {
          type: "input",
          text: encodeQuestionAnswer(createQuestionId(), "wrong"),
        });
        assert.deepEqual(mismatch, { action: "handled" });
        assert.equal(settled, false, "a mismatched ID must not resolve the question");

        const handled = await emit("input", {
          type: "input",
          text: encodeQuestionAnswer(request.id, "/keep\nexact spacing  "),
        });
        assert.deepEqual(handled, { action: "handled" });
        const result = await resultPromise;
        assert.equal(result.terminate, undefined);
        assert.equal(result.details.answer, "/keep\nexact spacing  ");
        assert.match(result.content[0].text, /orchestrator replied/i);
        assert.equal(readQuestionAcknowledgment(questionAcknowledgmentPath(sessionFile)), request.id);
        assert.equal(existsSync(questionRequestPath(sessionFile)), false);
      } finally {
        restore();
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("contains malformed private input and leaves ordinary input unchanged", async () => {
      const dir = createTestDir();
      const { emit, restore } = setupCapturingExtension(join(dir, "s.jsonl"));
      try {
        assert.deepEqual(
          await emit("input", { type: "input", text: `${QUESTION_ANSWER_PREFIX}{bad` }),
          { action: "handled" },
        );
        assert.deepEqual(
          await emit("input", { type: "input", text: "ordinary follow-up" }),
          { action: "continue" },
        );
      } finally {
        restore();
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("rejects a second question while one is pending", async () => {
      const dir = createTestDir();
      const sessionFile = join(dir, "s.jsonl");
      const { emit, tool, restore } = setupCapturingExtension(sessionFile);
      try {
        const first = tool.execute("c1", { question: "first?" }, undefined, undefined, {});
        await assert.rejects(
          tool.execute("c2", { question: "second?" }, undefined, undefined, {}),
          /already has a pending question/,
        );
        const request = readQuestionRequest(questionRequestPath(sessionFile));
        assert.ok(request);
        await emit("input", { type: "input", text: encodeQuestionAnswer(request.id, "done") });
        await first;
      } finally {
        restore();
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("aborts promptly and removes only matching rendezvous artifacts", async () => {
      const dir = createTestDir();
      const sessionFile = join(dir, "s.jsonl");
      const { tool, restore } = setupCapturingExtension(sessionFile);
      const controller = new AbortController();
      try {
        const resultPromise = tool.execute(
          "c1",
          { question: "still needed?" },
          controller.signal,
          undefined,
          {},
        );
        const request = readQuestionRequest(questionRequestPath(sessionFile));
        assert.ok(request);
        writeQuestionAcknowledgment(questionAcknowledgmentPath(sessionFile), request.id);
        controller.abort();
        await assert.rejects(resultPromise, (error: any) => error?.name === "AbortError");
        assert.equal(existsSync(questionRequestPath(sessionFile)), false);
        assert.equal(existsSync(questionAcknowledgmentPath(sessionFile)), false);
      } finally {
        restore();
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

});

describe("tmux text submission and exit polling", () => {
  it("loads live text from stdin, bracket-pastes it, deletes the buffer, then submits Enter", () => {
    const calls: Array<{ args: string[]; options?: { input?: string } }> = [];
    const runner = (args: string[], options?: { input?: string }) => {
      calls.push({ args, options });
      return "";
    };
    const payload = "large π payload\nsecond line";

    submitText("%42", payload, runner);

    assert.equal(calls.length, 3);
    assert.deepEqual(calls[0].args.slice(0, 3), ["load-buffer", "-b", calls[0].args[2]]);
    assert.equal(calls[0].args.at(-1), "-");
    assert.equal(calls[0].options?.input, payload);
    const bufferName = calls[0].args[2];
    assert.ok(bufferName.startsWith(`pi-subagent-${process.pid}-`));
    assert.deepEqual(calls[1].args, ["paste-buffer", "-p", "-d", "-b", bufferName, "-t", "%42"]);
    assert.deepEqual(calls[2].args, ["send-keys", "-t", "%42", "Enter"]);
    assert.equal(calls.some((call) => call.args[0] === "delete-buffer"), false);
  });

  it("uses collision-resistant buffer names and cleans up before propagating load or paste failures", () => {
    const names: string[] = [];
    for (let run = 0; run < 2; run++) {
      const failureCalls: string[][] = [];
      assert.throws(() => submitText("%7", "secret", (args) => {
        failureCalls.push(args);
        if (args[0] === "load-buffer") names.push(args[2]);
        if (args[0] === (run === 0 ? "load-buffer" : "paste-buffer")) throw new Error("tmux failed");
        return "";
      }), /tmux failed/);
      assert.deepEqual(failureCalls.at(-1)?.slice(0, 2), ["delete-buffer", "-b"]);
    }
    assert.equal(new Set(names).size, 2);

    const calls: string[][] = [];
    assert.throws(() => submitText("%7", "secret", (args) => {
      calls.push(args);
      if (args[0] === "paste-buffer") throw new Error("paste failed");
      return "";
    }), /paste failed/);
    assert.equal(calls.some((args) => args[0] === "send-keys"), false);
    assert.deepEqual(calls.at(-1)?.slice(0, 2), ["delete-buffer", "-b"]);
  });

  it("keeps payload text out of argv and does not retain a buffer when Enter fails", () => {
    const calls: Array<{ args: string[]; input?: string }> = [];
    const payload = "sensitive π text";
    assert.throws(() => submitText("%7", payload, (args, options) => {
      calls.push({ args, input: options?.input });
      if (args[0] === "send-keys") throw new Error("enter failed");
      return "";
    }), /enter failed/);

    assert.equal(calls.flatMap((call) => call.args).includes(payload), false);
    assert.equal(calls[0].input, payload);
    assert.equal(calls.some((call) => call.args[0] === "delete-buffer"), false);
    assert.deepEqual(calls.map((call) => call.args[0]), ["load-buffer", "paste-buffer", "send-keys"]);
  });

  it("keeps polling after a transient capture/probe failure", async () => {
    let reads = 0;
    const result = await pollForExit("%9", new AbortController().signal, {
      interval: 1,
      async readSurface() {
        reads += 1;
        if (reads === 1) throw new Error("transient capture failure");
        return "__SUBAGENT_DONE_0__";
      },
      async probeSurface() { return null; },
    });
    assert.equal(reads, 2);
    assert.deepEqual(result, { reason: "sentinel", exitCode: 0 });
  });

  it("converges with an interrupted result when the pane is confirmed missing", async () => {
    const result = await pollForExit("%404", new AbortController().signal, {
      interval: 1,
      async readSurface() { throw new Error("capture failed"); },
      async probeSurface() { return false; },
    });
    assert.equal(result.reason, "interrupted");
    assert.equal(result.exitCode, 1);
    assert.match(result.errorMessage ?? "", /no longer exists/);
  });
});

describe("tmux.ts interpretExitSidecar", () => {
  const { interpretExitSidecar } = __pollForExitTest__;

  it("no longer decodes ping payloads (ask_question keeps the session open instead)", () => {
    // ask_question writes a `.ask` signal, not a `.exit` ping sidecar, so an
    // unknown `type: "ping"` payload now falls through to a clean done.
    assert.deepEqual(
      interpretExitSidecar({ type: "ping", name: "Implementer", message: "need help" }),
      { reason: "done", exitCode: 0 },
    );
  });

  it("decodes done payloads", () => {
    assert.deepEqual(interpretExitSidecar({ type: "done" }), {
      reason: "done",
      exitCode: 0,
    });
  });

  it("decodes error payloads and propagates the message with a non-zero exit code", () => {
    assert.deepEqual(
      interpretExitSidecar({
        type: "error",
        errorMessage: "Anthropic 529 Overloaded after 3 retries",
        stopReason: "error",
      }),
      {
        reason: "error",
        exitCode: 1,
        errorMessage: "Anthropic 529 Overloaded after 3 retries",
      },
    );
  });

  it("falls back to a placeholder when error payload has no errorMessage", () => {
    const result = interpretExitSidecar({ type: "error" });
    assert.equal(result.reason, "error");
    assert.equal(result.exitCode, 1);
    assert.match(result.errorMessage ?? "", /no errorMessage/);
  });

  it("treats unknown payload shapes as done", () => {
    assert.deepEqual(interpretExitSidecar({}), { reason: "done", exitCode: 0 });
    assert.deepEqual(interpretExitSidecar(null), { reason: "done", exitCode: 0 });
  });
});
describe("commands", () => {
  it("/subagent emits a spawn tool call for a known agent", async () => {
    await withIsolatedAgentEnv(async ({ projectDir, projectAgentsDir }) => {
      writeAgentFile(projectAgentsDir, "inspector", "name: inspector\nbuiltin-tools: [read]");
      const { api, registeredCommands, sentUserMessages } = createMockExtensionApi();

      (subagentsModule as any).default(api);

      const subagent = registeredCommands.find((command) => command.name === "subagent");
      assert.ok(subagent, "expected /subagent to be registered");

      await subagent.handler("inspector map the auth code", createMockContext(projectDir, true));

      assert.equal(sentUserMessages.length, 1);
      assert.match(sentUserMessages[0], /agent: "inspector"/);
      assert.doesNotMatch(sentUserMessages[0], /name:/);
      assert.match(sentUserMessages[0], /map the auth code/);
    });
  });

  it("does not register the removed /iterate or /plan commands", () => {
    const { api, registeredCommands } = createMockExtensionApi();
    (subagentsModule as any).default(api);
    assert.equal(registeredCommands.find((c) => c.name === "iterate"), undefined);
    assert.equal(registeredCommands.find((c) => c.name === "plan"), undefined);
  });
});

describe("tool registration", () => {
  it("always resumes subagents as autonomous (auto-exit, non-interactive tracking)", () => {
    const testApi = (subagentsModule as any).__test__;

    assert.deepEqual(testApi.resolveResumeLaunchBehavior(), {
      autoExit: true,
      interactive: false,
    });
  });


  it("rejects a top-level spawn with no agent and no fork", async () => {
    const { api, registeredTools } = createMockExtensionApi();
    (subagentsModule as any).default(api);
    const subagentTool = registeredTools.find((tool) => tool.name === "subagent");
    assert.ok(subagentTool, "expected subagent tool to be registered");

    const result = await subagentTool.execute(
      "call-1",
      { name: "x", task: "do it" },
      undefined,
      undefined,
      createMockContext(),
    );
    assert.equal(result.details?.error, "agent required");
    assert.match(result.content[0].text, /specify which agent/i);
  });

  it("rejects a top-level spawn naming an unknown agent", async () => {
    await withIsolatedAgentEnv(async ({ projectDir }) => {
      const { api, registeredTools } = createMockExtensionApi();
      (subagentsModule as any).default(api);
      const subagentTool = registeredTools.find((tool) => tool.name === "subagent");
      assert.ok(subagentTool, "expected subagent tool to be registered");

      const result = await subagentTool.execute(
        "call-1",
        { name: "x", task: "do it", agent: "wizard" },
        undefined,
        undefined,
        createMockContext(projectDir, true),
      );
      assert.equal(result.details?.error, "unknown agent");
      assert.match(result.content[0].text, /not a valid known agent/i);
      assert.match(result.content[0].text, /global\/agents/);
      assert.match(result.content[0].text, /project\/\.pi\/agents/);
    });
  });

  it("exposes a debloated schema: agent+task required, name/model/cwd optional, no override knobs", () => {
    const { api, registeredTools } = createMockExtensionApi();
    (subagentsModule as any).default(api);

    const subagentTool = registeredTools.find((tool) => tool.name === "subagent");
    assert.ok(subagentTool, "expected subagent tool to be registered");

    const props = subagentTool.parameters.properties;
    assert.deepEqual(
      Object.keys(props).sort(),
      ["agent", "cwd", "model", "name", "task"],
      "only agent/task/name/model/cwd should remain",
    );
    assert.deepEqual(
      [...(subagentTool.parameters.required ?? [])].sort(),
      ["agent", "task"],
      "agent and task must be required",
    );
    // `name` is optional and addresses the runtime session; `agent` selects the profile.
    assert.match(props.name.description, /display and addressing/i);
    assert.match(props.name.description, /does not select the profile/i);
    // The removed override knobs must be gone.
    for (const gone of ["tools", "skills", "systemPrompt", "fork", "interactive", "resumeSessionId"]) {
      assert.equal(props[gone], undefined, `expected ${gone} param to be removed`);
    }
  });

  it("renders partial subagent tool-call args without throwing", () => {
    const { api, registeredTools } = createMockExtensionApi();
    (subagentsModule as any).default(api);

    const subagentTool = registeredTools.find((tool) => tool.name === "subagent");
    assert.ok(subagentTool, "expected subagent tool to be registered");

    const theme = {
      fg(_color: string, text: string) {
        return text;
      },
      bold(text: string) {
        return text;
      },
    };
    const rendered = subagentTool.renderCall({}, theme);
    const output = rendered.render(80).join("\n");

    assert.match(output, /\(unnamed\)/);
  });

  it("registers subagent_message with name + message both required (name-only addressing)", () => {
    const { api, registeredTools } = createMockExtensionApi();
    (subagentsModule as any).default(api);

    const messageTool = registeredTools.find((tool) => tool.name === "subagent_message");
    assert.ok(messageTool, "expected subagent_message tool to be registered");

    const props = messageTool.parameters.properties;
    assert.deepEqual(
      Object.keys(props).sort(),
      ["message", "name"],
      "only name/message should remain (sessionId dropped)",
    );
    assert.equal(props.message.type, "string");
    assert.equal(props.name.type, "string");
    assert.deepEqual(
      messageTool.parameters.required?.slice().sort(),
      ["message", "name"],
      "name and message should both be required",
    );
    assert.equal(props.sessionId, undefined, "sessionId should be removed");
    assert.equal(props.autoExit, undefined, "autoExit knob should be removed");
  });

  it("no longer registers subagent_interrupt or subagent_resume", () => {
    const { api, registeredTools } = createMockExtensionApi();
    (subagentsModule as any).default(api);
    const names = registeredTools.map((tool) => tool.name);
    assert.equal(names.includes("subagent_interrupt"), false);
    assert.equal(names.includes("subagent_resume"), false);
  });
});

describe("subagent activity snapshots", () => {
  function validActivity(overrides: Record<string, unknown> = {}) {
    return {
      version: 1,
      runningChildId: "child-1",
      createdAt: 1_000,
      updatedAt: 1_000,
      sequence: 1,
      latestEvent: "session_start",
      phase: "starting",
      agentActive: false,
      turnActive: false,
      providerActive: false,
      toolActive: false,
      ...overrides,
    };
  }

  it("writes and validates activity files by running child id", () => {
    withTempDir((dir) => {
      const activityFile = getSubagentActivityFile(dir, "child-1");
      const recorder = createSubagentActivityRecorder({
        runningChildId: "child-1",
        activityFile,
        now: () => 1_000,
      });

      recorder.sessionStart();
      recorder.toolExecutionStart("tool-1", "bash");

      const read = readSubagentActivityFile(activityFile, "child-1");
      assert.ok(read.ok);
      assert.equal(read.activity.phase, "active");
      assert.equal(read.activity.activeScope, "tool");
      assert.equal(read.activity.toolName, "bash");

      assert.deepEqual(readSubagentActivityFile(activityFile, "other-child"), {
        ok: false,
        reason: "wrong-id",
      });
    });
  });

  it("records waiting and final done states", () => {
    withTempDir((dir) => {
      let currentNow = 2_000;
      const activityFile = getSubagentActivityFile(dir, "child-2");
      const recorder = createSubagentActivityRecorder({
        runningChildId: "child-2",
        activityFile,
        now: () => currentNow,
      });

      recorder.sessionStart();
      currentNow = 3_000;
      recorder.agentEndWaiting();
      let read = readSubagentActivityFile(activityFile, "child-2");
      assert.ok(read.ok);
      assert.equal(read.activity.phase, "waiting");
      assert.equal(read.activity.waitingSince, 3_000);

      currentNow = 4_000;
      recorder.agentSettledDone();
      read = readSubagentActivityFile(activityFile, "child-2");
      assert.ok(read.ok);
      assert.equal(read.activity.phase, "done");
      assert.equal(read.activity.latestEvent, "agent_settled");
      assert.equal(read.activity.agentActive, false);
    });
  });

  it("rejects malformed activity fields used by classification and rendering", () => {
    withTempDir((dir) => {
      mkdirSync(join(dir, "subagent-activity"), { recursive: true });
      const cases = [
        { activeSince: "bad" },
        { waitingSince: "bad" },
        { activeScope: "database" },
        { latestEvent: "unknown" },
        { runningChildId: 42 },
        { toolActive: "yes" },
        { toolName: "bad\nname" },
      ];

      for (const [index, overrides] of cases.entries()) {
        const activityFile = getSubagentActivityFile(dir, `child-${index}`);
        const activity = validActivity({ runningChildId: `child-${index}`, ...overrides });
        writeFileSync(activityFile, `${JSON.stringify(activity)}\n`);

        const read = readSubagentActivityFile(activityFile, `child-${index}`);
        assert.equal(read.ok, false);
        assert.equal((read as { ok: false; reason: string }).reason, "invalid");
      }
    });
  });

  it("does not let tool_result resurrect finished tool activity", () => {
    withTempDir((dir) => {
      let currentNow = 1_000;
      const activityFile = getSubagentActivityFile(dir, "child-3");
      const recorder = createSubagentActivityRecorder({
        runningChildId: "child-3",
        activityFile,
        now: () => currentNow,
      });

      recorder.sessionStart();
      recorder.agentStart();
      recorder.turnStart(1);
      currentNow = 2_000;
      recorder.toolExecutionStart("tool-1", "bash");
      currentNow = 3_000;
      recorder.toolExecutionEnd("tool-1", "bash");
      currentNow = 4_000;
      recorder.toolResult("tool-1", "bash");

      const read = readSubagentActivityFile(activityFile, "child-3");
      assert.ok(read.ok);
      assert.equal(read.activity.toolActive, false);
      assert.equal(read.activity.activeScope, "turn");
    });
  });

  it("does not mark reload shutdown as the final done snapshot", () => {
    withTempDir((dir) => {
      const activityFile = getSubagentActivityFile(dir, "child-4");
      const recorder = createSubagentActivityRecorder({
        runningChildId: "child-4",
        activityFile,
        now: () => 1_000,
      });

      recorder.sessionStart();
      recorder.sessionShutdown("reload");

      const read = readSubagentActivityFile(activityFile, "child-4");
      assert.ok(read.ok);
      assert.equal(read.activity.phase, "starting");
      assert.equal(read.activity.latestEvent, "session_start");
    });
  });

  it("cancels pending throttled writes on reload shutdown", async () => {
    const dir = createTestDir();
    try {
      await new Promise<void>((resolve) => {
        let currentNow = 1_000;
        const activityFile = getSubagentActivityFile(dir, "child-5");
        const recorder = createSubagentActivityRecorder({
          runningChildId: "child-5",
          activityFile,
          now: () => currentNow,
        });

        recorder.sessionStart();
        currentNow = 1_100;
        recorder.messageUpdate("delta");
        recorder.sessionShutdown("reload");

        setTimeout(() => {
          const read = readSubagentActivityFile(activityFile, "child-5");
          assert.ok(read.ok);
          assert.equal(read.activity.phase, "starting");
          assert.equal(read.activity.latestEvent, "session_start");
          resolve();
        }, 650);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("subagent interruption", () => {
  function makeRunning(overrides: Record<string, unknown> = {}) {
    return {
      id: "a1",
      name: "Implementer",
      task: "",
      surface: "pane-1",
      startTime: 0,
      sessionFile: "implementer.jsonl",
      interactive: false,
      statusState: createStatusState({ source: "pi", startTimeMs: 0 }),
      ...overrides,
    };
  }

  function activity(sequence: number, overrides: Record<string, unknown> = {}) {
    return {
      version: 1,
      runningChildId: "a1",
      createdAt: 1,
      updatedAt: sequence + 1,
      sequence,
      latestEvent: "agent_end",
      phase: "waiting",
      agentActive: false,
      turnActive: false,
      providerActive: false,
      toolActive: false,
      waitingSince: sequence + 1,
      ...overrides,
    };
  }

  it("registers subagent_message and not the old interrupt/resume tools", () => {
    const { api, registeredTools } = createMockExtensionApi();
    (subagentsModule as any).default(api);
    const names = registeredTools.map((tool) => tool.name);
    assert.equal(names.includes("subagent_message"), true);
    assert.equal(names.includes("subagent_interrupt"), false);
    assert.equal(names.includes("subagent_resume"), false);
  });

  it("resolves a running subagent by exact name and reports ambiguity", () => {
    const testApi = (subagentsModule as any).__test__;
    const runningMap = testApi.runningSubagents as Map<string, any>;
    runningMap.clear();

    try {
      runningMap.set("a1", makeRunning({ id: "a1", name: "Implementer", surface: "a1", sessionFile: "a1.jsonl" }));
      runningMap.set("b2", makeRunning({ id: "b2", name: "Implementer", surface: "b2", sessionFile: "b2.jsonl" }));
      runningMap.set("c3", makeRunning({ id: "c3", name: "Inspector", surface: "c3", sessionFile: "c3.jsonl" }));

      const byName = testApi.resolveRunningByName("Inspector");
      assert.equal(byName.running.id, "c3");

      const ambiguous = testApi.resolveRunningByName("Implementer");
      assert.match(ambiguous.error, /Ambiguous subagent name/);

      const missing = testApi.resolveRunningByName("Ghost");
      assert.match(missing.error, /No running subagent named "Ghost"/);
    } finally {
      runningMap.clear();
    }
  });

  it("uniqueRunningName suffixes defaulted names that collide with running subagents", () => {
    const testApi = (subagentsModule as any).__test__;
    const runningMap = testApi.runningSubagents as Map<string, any>;
    runningMap.clear();

    try {
      // No collision: base name is returned untouched.
      assert.equal(testApi.uniqueRunningName("implementer"), "implementer");

      runningMap.set("a1", makeRunning({ id: "a1", name: "implementer", surface: "a1" }));
      assert.equal(testApi.uniqueRunningName("implementer"), "implementer-2");

      runningMap.set("b2", makeRunning({ id: "b2", name: "implementer-2", surface: "b2" }));
      assert.equal(testApi.uniqueRunningName("implementer"), "implementer-3");

      // A distinct base is unaffected by the implementer collisions.
      assert.equal(testApi.uniqueRunningName("inspector"), "inspector");
    } finally {
      runningMap.clear();
    }
  });

  it("uniqueRunningName also avoids names already taken in the persistent registry", () => {
    const testApi = (subagentsModule as any).__test__;
    const runningMap = testApi.runningSubagents as Map<string, any>;
    const reserved = testApi.reservedNames as Set<string>;
    runningMap.clear();
    reserved.clear();

    try {
      // A finished subagent's name lives in the registry even though nothing is
      // running — a fresh default must skip it so names stay unique session-wide.
      const registryNames = new Set(["implementer", "implementer-2"]);
      assert.equal(testApi.uniqueRunningName("implementer", registryNames), "implementer-3");
      // A name not in the registry (or running/reserved) is unaffected.
      assert.equal(testApi.uniqueRunningName("inspector", registryNames), "inspector");
      // An empty registry behaves like before.
      assert.equal(testApi.uniqueRunningName("implementer", new Set()), "implementer");
    } finally {
      runningMap.clear();
      reserved.clear();
    }
  });

  it("uniqueRunningName also avoids names reserved by in-flight parallel spawns", () => {
    const testApi = (subagentsModule as any).__test__;
    const runningMap = testApi.runningSubagents as Map<string, any>;
    const reserved = testApi.reservedNames as Set<string>;
    runningMap.clear();
    reserved.clear();

    try {
      // Simulate the first parallel spawn reserving its default name before it
      // has registered in runningSubagents.
      reserved.add(testApi.uniqueRunningName("inspector")); // "inspector"
      // The second spawn, running concurrently, must not reuse it.
      assert.equal(testApi.uniqueRunningName("inspector"), "inspector-2");
      reserved.add("inspector-2");
      assert.equal(testApi.uniqueRunningName("inspector"), "inspector-3");
    } finally {
      runningMap.clear();
      reserved.clear();
    }
  });

  it("claimRuntimeName rejects explicit collisions and only suffixes omitted names", () => {
    const testApi = (subagentsModule as any).__test__;
    const runningMap = testApi.runningSubagents as Map<string, any>;
    const reserved = testApi.reservedNames as Set<string>;
    runningMap.clear();
    reserved.clear();

    try {
      runningMap.set("a1", makeRunning({ id: "a1", name: "agent" }));
      assert.match(testApi.claimRuntimeName(" agent ", "agent", new Set()).error, /already/);
      assert.match(testApi.claimRuntimeName("   ", "agent", new Set()).error, /must not be empty/);
      assert.match(testApi.claimRuntimeName("finished", "agent", new Set(["finished"])).error, /already/);

      const omitted = testApi.claimRuntimeName(undefined, "agent", new Set(["agent-2"]));
      assert.deepEqual(omitted, { name: "agent-3" });
      assert.ok(reserved.has("agent-3"));
    } finally {
      runningMap.clear();
      reserved.clear();
    }
  });

  it("treats persisted special property names as runtime collisions", () => {
    const testApi = (subagentsModule as any).__test__;
    const reserved = testApi.reservedNames as Set<string>;
    reserved.clear();

    withTempDir((dir) => {
      registerName(dir, "__proto__", {
        sessionFile: join(dir, "child.jsonl"),
        sessionId: "child-id",
      });
      const registryNames = new Set(Object.keys(readNameRegistry(dir)));
      assert.match(testApi.claimRuntimeName("__proto__", "agent", registryNames).error, /already/);
      const omitted = testApi.claimRuntimeName(undefined, "__proto__", registryNames);
      assert.deepEqual(omitted, { name: "__proto__-2" });
      reserved.delete("__proto__-2");
    });
  });

  it("reserves real and symlinked paths as the same concurrent resume", () => {
    const testApi = (subagentsModule as any).__test__;
    const reservations = testApi.reservedResumeSessions as Set<string>;
    reservations.clear();

    withTempDir((dir) => {
      const realPath = join(dir, "session.jsonl");
      const aliasPath = join(dir, "session-alias.jsonl");
      writeFileSync(realPath, "{}\n");
      symlinkSync(realPath, aliasPath);

      try {
        const first = testApi.claimResumeSession(realPath);
        assert.ok(!("error" in first));
        assert.equal(testApi.canonicalSessionPath(aliasPath), testApi.canonicalSessionPath(realPath));
        assert.match(testApi.claimResumeSession(aliasPath).error, /already being resumed/);
        first.release();
        first.release();
        const next = testApi.claimResumeSession(aliasPath);
        assert.ok(!("error" in next));
        next.release();
      } finally {
        reservations.clear();
      }
    });
  });

  it("steers a running subagent by typing into its pane (newlines flattened)", () => {
    const testApi = (subagentsModule as any).__test__;
    let sentSurface = "";
    let sentText = "";
    const running = makeRunning();

    const result = testApi.steerSubagent(running, "do this\nthen that", (surface: string, text: string) => {
      sentSurface = surface;
      sentText = text;
    });

    assert.deepEqual(result, { ok: true });
    assert.equal(sentSurface, "pane-1");
    assert.equal(sentText, "do this then that");
  });

  it("rejects active AGY steering before tmux transport or status mutation", async () => {
    const testApi = (subagentsModule as any).__test__;
    const runningMap = testApi.runningSubagents as Map<string, any>;
    let sends = 0;
    const statusState = createStatusState({ source: "agy", startTimeMs: 0 });
    runningMap.clear();
    try {
      runningMap.set("agy-1", makeRunning({ id: "agy-1", cli: "agy", statusState }));
      const result = await testApi.handleSubagentSteer(
        { name: "Implementer", message: "continue" },
        { send() { sends += 1; } },
      );
      assert.equal(sends, 0);
      assert.equal(result.details.status, "unsupported");
      assert.match(result.content[0].text, /Active steering is unsupported for AGY/);
      assert.equal(runningMap.get("agy-1").statusState, statusState);
    } finally {
      runningMap.clear();
    }
  });

  it("returns an explicit error when steering submission fails", () => {
    const testApi = (subagentsModule as any).__test__;
    const running = makeRunning();

    const result = testApi.steerSubagent(running, "hi", () => {
      throw new Error("mux write failed");
    });

    assert.match(result.error, /Failed to submit message/);
  });

  it("routes a pending-question answer as an exact private envelope and requires its matching ack", async () => {
    const testApi = (subagentsModule as any).__test__;
    const runningMap = testApi.runningSubagents as Map<string, any>;
    const questionId = createQuestionId();
    let submitted = "";
    let clock = 0;
    let reads = 0;
    runningMap.clear();

    try {
      runningMap.set("a1", makeRunning({
        pendingQuestion: {
          id: questionId,
          answerSubmitted: false,
          confirmationPending: false,
          sawWaiting: true,
        },
      }));
      const result = await testApi.handleSubagentSteer(
        { name: "Implementer", message: "/slash\nline two  " },
        {
          send(_surface: string, text: string) { submitted = text; },
          timeoutMs: 100,
          pollMs: 10,
          now: () => clock,
          sleep: async (ms: number) => { clock += ms; },
          readAcknowledgment: () => (++reads >= 2 ? questionId : null),
        },
      );

      assert.deepEqual(parseQuestionAnswer(submitted), {
        private: true,
        answer: {
          version: QUESTION_PROTOCOL_VERSION,
          id: questionId,
          answer: "/slash\nline two  ",
        },
      });
      assert.equal(runningMap.get("a1").pendingQuestion, undefined);
      assert.deepEqual(result.details, {
        id: "a1",
        name: "Implementer",
        questionId,
        status: "delivered",
      });
    } finally {
      runningMap.clear();
    }
  });

  it("retains the one-answer guard after a question acknowledgment timeout", async () => {
    const testApi = (subagentsModule as any).__test__;
    const runningMap = testApi.runningSubagents as Map<string, any>;
    const questionId = createQuestionId();
    let clock = 0;
    let sends = 0;
    runningMap.clear();

    try {
      runningMap.set("a1", makeRunning({
        pendingQuestion: {
          id: questionId,
          answerSubmitted: false,
          confirmationPending: false,
          sawWaiting: true,
        },
      }));
      const first = await testApi.handleSubagentSteer(
        { name: "Implementer", message: "answer" },
        {
          send() { sends += 1; },
          timeoutMs: 20,
          pollMs: 10,
          now: () => clock,
          sleep: async (ms: number) => { clock += ms; },
          readAcknowledgment: () => null,
        },
      );
      const duplicate = await testApi.handleSubagentSteer(
        { name: "Implementer", message: "answer again" },
        { send() { sends += 1; }, readAcknowledgment: () => null },
      );

      assert.equal(sends, 1);
      assert.equal(first.details.status, "unconfirmed");
      assert.match(duplicate.details.error, /already submitted/);
      assert.equal(runningMap.get("a1").pendingQuestion.answerSubmitted, true);
    } finally {
      runningMap.clear();
    }
  });

  it("registers a strict atomic question request once and ignores mismatched identity", () => {
    const testApi = (subagentsModule as any).__test__;
    withTempDir((dir) => {
      const sessionFile = join(dir, "child.jsonl");
      const running = makeRunning({ sessionFile, name: "Implementer", agent: "implementer" });
      const id = createQuestionId();
      writeQuestionRequest(questionRequestPath(sessionFile), {
        version: QUESTION_PROTOCOL_VERSION,
        id,
        name: "Other",
        agent: "implementer",
        question: "wrong child?",
      });
      testApi.deliverPendingQuestion(running);
      assert.equal(running.pendingQuestion, undefined);
      assert.equal(existsSync(questionRequestPath(sessionFile)), false);

      writeQuestionRequest(questionRequestPath(sessionFile), {
        version: QUESTION_PROTOCOL_VERSION,
        id,
        name: "Implementer",
        agent: "implementer",
        question: "Proceed?",
      });
      testApi.deliverPendingQuestion(running);
      assert.equal(running.pendingQuestion.id, id);
      assert.equal(existsSync(questionRequestPath(sessionFile)), false);
      testApi.deliverPendingQuestion(running);
      assert.equal(running.pendingQuestion.id, id);
    });
  });

  it("accepts only newer same-child input or active activity as a waiting-reply acknowledgment", () => {
    const testApi = (subagentsModule as any).__test__;
    const validInput = { ok: true, activity: activity(11, { latestEvent: "input" }) };
    const validActive = {
      ok: true,
      activity: activity(12, { latestEvent: "agent_start", phase: "active", agentActive: true }),
    };

    assert.equal(testApi.activityAcknowledgesReply(validInput, "a1", 10), true);
    assert.equal(testApi.activityAcknowledgesReply(validActive, "a1", 10), true);
    assert.equal(
      testApi.activityAcknowledgesReply({ ok: true, activity: activity(10, { latestEvent: "input" }) }, "a1", 10),
      false,
    );
    assert.equal(
      testApi.activityAcknowledgesReply({ ok: true, activity: activity(11, { runningChildId: "other", latestEvent: "input" }) }, "a1", 10),
      false,
    );
    assert.equal(testApi.activityAcknowledgesReply({ ok: false, reason: "invalid" }, "a1", 10), false);
    assert.equal(
      testApi.activityAcknowledgesReply({ ok: true, activity: activity(11) }, "a1", 10),
      false,
    );
  });

  it("confirms a waiting Pi reply only after newer child activity", async () => {
    const testApi = (subagentsModule as any).__test__;
    const runningMap = testApi.runningSubagents as Map<string, any>;
    const reads = [
      { ok: true, activity: activity(10) },
      { ok: true, activity: activity(10, { latestEvent: "input" }) },
      { ok: false, reason: "wrong-id" },
      { ok: true, activity: activity(11, { latestEvent: "input" }) },
    ];
    let clock = 0;
    let sentText = "";
    runningMap.clear();

    try {
      runningMap.set("a1", makeRunning({ activityFile: "activity.json" }));
      const result = await testApi.handleSubagentSteer(
        { name: "Implementer", message: "first line\nsecond line" },
        {
          send(_surface: string, text: string) { sentText = text; },
          timeoutMs: 100,
          pollMs: 10,
          now: () => clock,
          sleep: async (ms: number) => { clock += ms; },
          readActivity: () => reads.shift() ?? { ok: true, activity: activity(11, { latestEvent: "input" }) },
        },
      );

      assert.equal(sentText, "first line second line");
      assert.deepEqual(result.details, { id: "a1", name: "Implementer", status: "delivered" });
      assert.match(result.content[0].text, /newer child activity confirmed/);
      assert.equal(runningMap.get("a1").pendingWaitingReply, false);
    } finally {
      runningMap.clear();
    }
  });

  it("does not submit a second waiting reply while the first acknowledgment is pending", async () => {
    const testApi = (subagentsModule as any).__test__;
    const runningMap = testApi.runningSubagents as Map<string, any>;
    let sends = 0;
    runningMap.clear();

    try {
      runningMap.set("a1", makeRunning({ activityFile: "activity.json", pendingWaitingReply: true }));
      const result = await testApi.handleSubagentSteer(
        { name: "Implementer", message: "duplicate" },
        {
          send() { sends += 1; },
          readActivity: () => ({ ok: true, activity: activity(10) }),
        },
      );
      assert.equal(sends, 0);
      assert.match(result.details.error, /already awaiting confirmation/);
      assert.equal(runningMap.has("a1"), true);
    } finally {
      runningMap.clear();
    }
  });

  it("times out a waiting Pi reply as unconfirmed without resending or removing it", async () => {
    const testApi = (subagentsModule as any).__test__;
    const runningMap = testApi.runningSubagents as Map<string, any>;
    let clock = 0;
    let sends = 0;
    runningMap.clear();

    try {
      runningMap.set("a1", makeRunning({ activityFile: "activity.json" }));
      const result = await testApi.handleSubagentSteer(
        { name: "Implementer", message: "keep going" },
        {
          send() { sends += 1; },
          timeoutMs: 100,
          pollMs: 25,
          now: () => clock,
          sleep: async (ms: number) => { clock += ms; },
          readActivity: () => ({ ok: true, activity: activity(10) }),
        },
      );

      assert.equal(sends, 1);
      assert.deepEqual(result.details, { id: "a1", name: "Implementer", status: "unconfirmed" });
      assert.match(result.content[0].text, /Do not resend or terminate it automatically/);
      assert.equal(runningMap.has("a1"), true);
      assert.equal(runningMap.get("a1").pendingWaitingReply, false);
    } finally {
      runningMap.clear();
    }
  });

  it("reports active Pi and Claude live messages as submitted rather than delivered", async () => {
    const testApi = (subagentsModule as any).__test__;
    const runningMap = testApi.runningSubagents as Map<string, any>;
    runningMap.clear();

    try {
      for (const running of [
        makeRunning({ activityFile: "activity.json" }),
        makeRunning({ cli: "claude" }),
      ]) {
        runningMap.set("a1", running);
        const result = await testApi.handleSubagentSteer(
          { name: "Implementer", message: "keep going" },
          {
            send() {},
            now: () => 20_000,
            readActivity: () => ({
              ok: true,
              activity: activity(4, { latestEvent: "tool_call", phase: "active", agentActive: true }),
            }),
          },
        );
        assert.deepEqual(result.details, { id: "a1", name: "Implementer", status: "submitted" });
        assert.match(result.content[0].text, /cannot uniquely confirm consumption/);
      }
    } finally {
      runningMap.clear();
    }
  });

  it("requires a message when steering", async () => {
    const testApi = (subagentsModule as any).__test__;
    const runningMap = testApi.runningSubagents as Map<string, any>;
    runningMap.clear();
    try {
      runningMap.set("a1", makeRunning());
      const result = await testApi.handleSubagentSteer({ name: "Implementer", message: "  " });
      assert.match(result.content[0].text, /`message` is required/);
    } finally {
      runningMap.clear();
    }
  });

  it("leaves status unchanged when steering submission fails in the tool path", async () => {
    const testApi = (subagentsModule as any).__test__;
    const runningMap = testApi.runningSubagents as Map<string, any>;
    runningMap.clear();

    const activeState = observeStatus(
      createStatusState({ source: "pi", startTimeMs: 0 }),
      {
        snapshot: "present",
        updatedAt: 5_000,
        sequence: 1,
        phase: "active",
        active: true,
        activeScope: "tool",
        activeSince: 5_000,
        activityLabel: "bash",
      },
      5_000,
    );

    try {
      runningMap.set("a1", makeRunning({ statusState: activeState }));
      const result = await testApi.handleSubagentSteer(
        { name: "Implementer", message: "go" },
        {
          send() { throw new Error("mux write failed"); },
          now: () => 20_000,
        },
      );

      assert.match(result.content[0].text, /Failed to submit message/);
      assert.equal(classifyStatus(runningMap.get("a1").statusState, 20_000).kind, "active");
    } finally {
      runningMap.clear();
    }
  });

  it("removes a confirmed-missing pane from the running map while preserving same-name resume registration", async () => {
    const testApi = (subagentsModule as any).__test__;
    const runningMap = testApi.runningSubagents as Map<string, any>;
    runningMap.clear();

    await withIsolatedAgentEnv(async ({ projectDir }) => {
      const sessionFile = createSessionFile(projectDir, [{ type: "session", id: "child-id" }]);
      registerName(projectDir, "Implementer", { sessionFile, sessionId: "child-id" });
      const running = makeRunning({ sessionFile, startTime: Date.now() });
      runningMap.set("a1", running);

      const result = await testApi.watchSubagent(
        running,
        new AbortController().signal,
        async () => ({
          reason: "interrupted",
          exitCode: 1,
          errorMessage: "tmux pane pane-1 no longer exists",
        }),
      );

      assert.equal(result.interrupted, true);
      assert.equal(runningMap.has("a1"), false);
      assert.equal(resolveNameInRegistry(projectDir, "Implementer")?.sessionFile, sessionFile);
      assert.match(testApi.resolveResultPresentation(result, "Implementer"), /same name to resume/);
    });
    runningMap.clear();
  });

  it("parses an AGY watcher result, persists its exact conversation, and exposes usage", async () => {
    const testApi = (subagentsModule as any).__test__;
    const runningMap = testApi.runningSubagents as Map<string, any>;
    runningMap.clear();
    await withIsolatedAgentEnv(async ({ projectDir }) => {
      const agentName = "pi-scout-result";
      const agentRoot = join(projectDir, "agy-workspace");
      const identity = "Inspect only.";
      const description = "Scout";
      const nativeTools = ["view_file"];
      const agentMarkdown = serializeAgyAgent({ name: agentName, description, nativeTools, identity });
      writeAgyAgent(agentRoot, agentName, agentMarkdown);
      const stateFile = join(projectDir, "agy-state.json");
      const parentWorkspace = join(projectDir, "parent-workspace");
      mkdirSync(parentWorkspace);
      const state: AgyResumeState = {
        version: 2,
        harness: "agy",
        conversationId: null,
        profileName: "scout",
        runtimeName: "Implementer",
        description,
        cwd: resolve(projectDir),
        model: "gemini-3.8-flash",
        effort: "medium",
        identity,
        logicalTools: ["read"],
        nativeTools,
        agentRoot: resolve(agentRoot),
        agentName,
        agentMarkdown,
        additionalWorkspaceRoots: [resolve(parentWorkspace)],
      };
      writeAgyResumeState(stateFile, state);
      const stdoutFile = join(projectDir, "result.json");
      const stderrFile = join(projectDir, "result.stderr");
      writeFileSync(stdoutFile, JSON.stringify({
        conversation_id: "conv-new",
        status: "SUCCESS",
        response: "exact AGY answer",
        usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14 },
      }));
      writeFileSync(stderrFile, "");
      const running = makeRunning({
        id: "agy-result",
        cli: "agy",
        sessionFile: stdoutFile,
        agyStdoutFile: stdoutFile,
        agyStderrFile: stderrFile,
        agyStateFile: stateFile,
        statusState: createStatusState({ source: "agy", startTimeMs: Date.now() }),
        startTime: Date.now(),
      });
      runningMap.set(running.id, running);
      const result = await testApi.watchSubagent(
        running,
        new AbortController().signal,
        async () => ({ reason: "sentinel", exitCode: 0 }),
        () => {},
      );
      assert.equal(result.summary, "exact AGY answer");
      assert.equal(result.agyConversationId, "conv-new");
      assert.equal(result.resumeSupported, true);
      assert.equal(result.stats.inputTokens, 10);
      const persistedState = readAgyResumeState(stateFile);
      assert.equal(persistedState?.conversationId, "conv-new");
      assert.equal(persistedState?.version, 2);
      assert.deepEqual(persistedState && agyAdditionalWorkspaceRoots(persistedState), [resolve(parentWorkspace)]);
      assert.equal(runningMap.has(running.id), false);
    });
  });

  it("does not promise AGY resume after interruption without a persisted conversation ID", async () => {
    const testApi = (subagentsModule as any).__test__;
    const runningMap = testApi.runningSubagents as Map<string, any>;
    runningMap.clear();
    const running = makeRunning({
      id: "agy-interrupted",
      cli: "agy",
      agyStateFile: "/missing/agy-state.json",
      startTime: Date.now(),
      statusState: createStatusState({ source: "agy", startTimeMs: Date.now() }),
    });
    runningMap.set(running.id, running);
    const result = await testApi.watchSubagent(
      running,
      new AbortController().signal,
      async () => ({ reason: "interrupted", exitCode: 1, errorMessage: "pane missing" }),
    );
    assert.equal(result.resumeSupported, false);
    assert.match(testApi.resolveResultPresentation(result, running.name), /resume is unavailable/);
  });

  it("does not offer same-name resume for an interrupted Claude child", () => {
    const testApi = (subagentsModule as any).__test__;
    const presentation = testApi.resolveResultPresentation(
      {
        exitCode: 1,
        elapsed: 5,
        summary: "pane disappeared",
        interrupted: true,
        resumeSupported: false,
      },
      "ClaudeWorker",
    );
    assert.match(presentation, /Claude Code sessions cannot be resumed/);
    assert.doesNotMatch(presentation, /Follow up with subagent_message/);
  });

  it("formats exit code 130 as an ordinary failure", () => {
    const testApi = (subagentsModule as any).__test__;
    const presentation = testApi.resolveResultPresentation(
      {
        exitCode: 130,
        elapsed: 61,
        summary: "Sub-agent exited with code 130",
        sessionFile: "/tmp/subagent.jsonl",
        sessionId: "019f-abc",
      },
      "Implementer",
    );

    assert.match(presentation, /failed \(exit code 130\)/);
    assert.doesNotMatch(presentation, /interrupted/);
    // Follow-ups reference the name (not the session id).
    assert.match(presentation, /subagent_message\(\{ name: "Implementer"/);
    assert.doesNotMatch(presentation, /Session id:/);
  });

  it("renders a clear provider/agent error when errorMessage is set", () => {
    // Previously, an overload retry-exhaustion produced exitCode 0 with a
    // stale summary — the orchestrator thought the subagent finished
    // quickly. With the error sidecar plumbed through, the presentation
    // must call out the failure, include the underlying error, and tell the
    // orchestrator how to recover.
    const testApi = (subagentsModule as any).__test__;
    const presentation = testApi.resolveResultPresentation(
      {
        exitCode: 1,
        elapsed: 14,
        summary: "ignored when errorMessage is present",
        sessionFile: "/tmp/subagent.jsonl",
        sessionId: "019f-xyz",
        errorMessage: "Anthropic 529 Overloaded after 3 retries",
      },
      "Implementer",
    );

    assert.match(presentation, /Sub-agent "Implementer" failed/);
    assert.match(presentation, /provider\/agent error — auto-retry exhausted/);
    assert.match(presentation, /Error: Anthropic 529 Overloaded after 3 retries/);
    assert.match(presentation, /subagent_message\(\{ name: "Implementer"/);
    assert.doesNotMatch(presentation, /Session id:/);
    assert.doesNotMatch(presentation, /ignored when errorMessage is present/);
  });
});

describe("subagent status renderer", () => {
  function createTheme() {
    return {
      fg(_color: string, text: string) {
        return text;
      },
      bg(_color: string, text: string) {
        return text;
      },
      bold(text: string) {
        return text;
      },
    };
  }

  it("renders only capped lines plus overflow", () => {
    const { api, registeredMessageRenderers } = createMockExtensionApi();
    (subagentsModule as any).default(api);

    const rendererEntry = registeredMessageRenderers.find((entry) => entry.name === "subagent_status");
    assert.ok(rendererEntry, "expected subagent_status renderer to be registered");

    const visibleLines = [
      "Implementer running 5m, active (bash 2m).",
      "Inspector running 3m, waiting 1m.",
      "Reviewer running 2m, active (streaming 30s).",
      "Planner running 4m, waiting 2m.",
    ];
    const rendered = rendererEntry.renderer(
      {
        customType: "subagent_status",
        content: "Subagent status:\n• Implementer running 5m, active (bash 2m).",
        details: {
          lines: visibleLines,
          overflow: 2,
        },
      },
      { expanded: true },
      createTheme(),
    );
    const output = rendered.render(80).join("\n");

    assert.match(output, /Subagent status/);
    for (const line of visibleLines) {
      assert.match(output, new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.match(output, /\+2 more running\./);
  });

  it("stays within narrow widths", () => {
    const { api, registeredMessageRenderers } = createMockExtensionApi();
    (subagentsModule as any).default(api);

    const rendererEntry = registeredMessageRenderers.find((entry) => entry.name === "subagent_status");
    assert.ok(rendererEntry, "expected subagent_status renderer to be registered");

    const rendered = rendererEntry.renderer(
      {
        customType: "subagent_status",
        content: "Subagent status:\n• Implementer running 5m, active (bash 2m).",
        details: { lines: ["Implementer running 5m, active (bash 2m)."], overflow: 0 },
      },
      { expanded: true },
      createTheme(),
    );

    for (const width of [4, 5, 6]) {
      for (const line of rendered.render(width)) {
        assert.ok(
          visibleWidth(line) <= width,
          `expected line width <= ${width}, got ${visibleWidth(line)} for ${JSON.stringify(line)}`,
        );
      }
    }
  });
});

describe("subagent startup delay", () => {
  it("defaults to 500ms when no env var is set", () => {
    const testApi = (subagentsModule as any).__test__;
    assert.ok(testApi, "expected subagents test helpers to be exported");
    assert.equal(typeof testApi.getShellReadyDelayMs, "function");

    const original = process.env.PI_SUBAGENT_SHELL_READY_DELAY_MS;
    delete process.env.PI_SUBAGENT_SHELL_READY_DELAY_MS;
    try {
      assert.equal(testApi.getShellReadyDelayMs(), 500);
    } finally {
      if (original == null) delete process.env.PI_SUBAGENT_SHELL_READY_DELAY_MS;
      else process.env.PI_SUBAGENT_SHELL_READY_DELAY_MS = original;
    }
  });

  it("uses PI_SUBAGENT_SHELL_READY_DELAY_MS when it is set", () => {
    const testApi = (subagentsModule as any).__test__;
    assert.ok(testApi, "expected subagents test helpers to be exported");
    assert.equal(typeof testApi.getShellReadyDelayMs, "function");

    const original = process.env.PI_SUBAGENT_SHELL_READY_DELAY_MS;
    process.env.PI_SUBAGENT_SHELL_READY_DELAY_MS = "2500";
    try {
      assert.equal(testApi.getShellReadyDelayMs(), 2500);
    } finally {
      if (original == null) delete process.env.PI_SUBAGENT_SHELL_READY_DELAY_MS;
      else process.env.PI_SUBAGENT_SHELL_READY_DELAY_MS = original;
    }
  });
});
describe("subagents widget rendering", () => {
  it("keeps every rendered line within a very narrow width", () => {
    const testApi = (subagentsModule as any).__test__;
    assert.ok(testApi, "expected subagents test helpers to be exported");
    assert.equal(typeof testApi.renderSubagentWidgetLines, "function");

    const originalNow = Date.now;
    Date.now = () => 1_000_000;
    try {
      const lines = testApi.renderSubagentWidgetLines([
        {
          id: "a1",
          name: "A",
          task: "",
          surface: "s1",
          startTime: 1_000_000 - 13_000,
          sessionFile: "sess1",
          statusState: createStatusState({ source: "pi", startTimeMs: 1_000_000 - 13_000 }),
        },
        {
          id: "a2",
          name: "B",
          task: "",
          surface: "s2",
          startTime: 1_000_000 - 21_000,
          sessionFile: "sess2",
          statusState: createStatusState({ source: "pi", startTimeMs: 1_000_000 - 21_000 }),
        },
        {
          id: "a3",
          name: "C",
          task: "",
          surface: "s3",
          startTime: 1_000_000 - 27_000,
          sessionFile: "sess3",
          statusState: createStatusState({ source: "pi", startTimeMs: 1_000_000 - 27_000 }),
        },
      ], 16);

      assert.deepEqual(
        lines.map((line: string) => visibleWidth(line)),
        [16, 16, 16, 16, 16],
      );
    } finally {
      Date.now = originalNow;
    }
  });

  it("identifies AGY as an external running harness without Pi activity precision", () => {
    const testApi = (subagentsModule as any).__test__;
    const startTime = Date.now() - 5_000;
    const lines = testApi.renderSubagentWidgetLines([{
      id: "agy-1",
      name: "Scout",
      agent: "scout",
      cli: "agy",
      task: "",
      surface: "s1",
      startTime,
      sessionFile: "result.json",
      interactive: false,
      statusState: createStatusState({ source: "agy", startTimeMs: startTime }),
    }], 80).join("\n").replace(/\x1b\[[0-9;]*m/g, "");
    assert.match(lines, /Scout \(scout · agy\)/);
    assert.match(lines, /running 5s/);
    assert.doesNotMatch(lines, /active|waiting|stalled/);
  });

  it("truncates the right-hand status instead of overflowing when it alone is too wide", () => {
    const testApi = (subagentsModule as any).__test__;
    assert.ok(testApi, "expected subagents test helpers to be exported");
    assert.equal(typeof testApi.borderLine, "function");

    const line = testApi.borderLine(" A ", " 999 msgs (999.9KB) ", 16);
    assert.equal(visibleWidth(line), 16);
  });

  it("handles ultra-narrow widths without exceeding the width contract", () => {
    const testApi = (subagentsModule as any).__test__;
    assert.ok(testApi, "expected subagents test helpers to be exported");
    assert.equal(typeof testApi.renderSubagentWidgetLines, "function");

    const widths = [0, 1, 2];
    for (const width of widths) {
      const startTime = Date.now() - 5_000;
      const lines = testApi.renderSubagentWidgetLines([
        {
          id: "a1",
          name: "A",
          task: "",
          surface: "s1",
          startTime,
          sessionFile: "sess1",
          statusState: createStatusState({ source: "pi", startTimeMs: startTime }),
        },
      ], width);

      for (const line of lines) {
        assert.ok(
          visibleWidth(line) <= width,
          `expected line width <= ${width}, got ${visibleWidth(line)} for ${JSON.stringify(line)}`,
        );
      }
    }
  });
});

describe("subagent display helpers", () => {
  const testApi = (subagentsModule as any).__test__;

  describe("formatTokens", () => {
    it("renders raw counts below 1k, 1 decimal below 10k, rounded k above", () => {
      assert.equal(testApi.formatTokens(850), "850");
      assert.equal(testApi.formatTokens(3200), "3.2k");
      assert.equal(testApi.formatTokens(45000), "45k");
    });
  });

  describe("contextWindowFor", () => {
    it("maps known model families and returns undefined otherwise", () => {
      assert.equal(testApi.contextWindowFor("claude-sonnet-4-6"), 200_000);
      assert.equal(testApi.contextWindowFor("gemini-2.5-pro"), 1_000_000);
      assert.equal(testApi.contextWindowFor("some-unknown-model"), undefined);
      assert.equal(testApi.contextWindowFor(null), undefined);
    });
  });

  describe("formatContextUsage", () => {
    it("shows a percent gauge when the window is known", () => {
      assert.equal(testApi.formatContextUsage(36_000, 200_000), "18.0%/200k");
      assert.equal(testApi.formatContextUsage(500_000, 1_000_000), "50.0%/1.0M");
    });

    it("falls back to a window-less ctx label when unknown", () => {
      assert.equal(testApi.formatContextUsage(37_000, undefined), "37k ctx");
    });
  });

  describe("formatUsageSegments", () => {
    it("emits arrow/cache/cost segments, skipping zero fields", () => {
      const segs = testApi.formatUsageSegments({
        model: "claude-sonnet-4-6",
        toolCount: 3,
        inputTokens: 3200,
        outputTokens: 890,
        cacheReadTokens: 45000,
        cacheWriteTokens: 0,
        contextTokens: 7000,
        cost: 0.042,
      });
      assert.deepEqual(segs, ["↑3.2k", "↓890", "R45k", "$0.042"]);
    });

    it("returns an empty list when there is no usage", () => {
      assert.deepEqual(
        testApi.formatUsageSegments({
          model: null,
          toolCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          contextTokens: 0,
          cost: 0,
        }),
        [],
      );
    });
  });

  describe("widgetIcon", () => {
    it("maps active/running to a glyph and waiting/starting to another", () => {
      const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
      assert.equal(strip(testApi.widgetIcon("active")), "⟳");
      assert.equal(strip(testApi.widgetIcon("running")), "⟳");
      assert.equal(strip(testApi.widgetIcon("stalled")), "⟳");
      assert.equal(strip(testApi.widgetIcon("waiting")), "○");
      assert.equal(strip(testApi.widgetIcon("starting")), "○");
    });
  });
});

describe("tmux.ts", () => {
  describe("shellEscape", () => {
    it("wraps in single quotes", () => {
      assert.equal(shellEscape("hello"), "'hello'");
    });

    it("escapes single quotes", () => {
      assert.equal(shellEscape("it's"), "'it'\\''s'");
    });

    it("handles empty string", () => {
      assert.equal(shellEscape(""), "''");
    });

    it("handles special characters", () => {
      const input = 'echo "hello $world" && rm -rf /';
      const escaped = shellEscape(input);
      assert.ok(escaped.startsWith("'"));
      assert.ok(escaped.endsWith("'"));
      // Inside single quotes, everything is literal
      assert.ok(escaped.includes("$world"));
    });
  });
});
