/**
 * Integration tests for the tmux surface layer.
 *
 * These tests exercise real tmux operations: creating panes,
 * sending commands, reading screen output, and closing panes.
 * No LLM calls — fast and free.
 *
 * Run inside tmux (split and detached cases):
 *   tmux new 'node --test test/integration/tmux-surface.test.ts'
 * Run without a tmux client (detached cases only; needs the tmux binary):
 *   env -u TMUX -u TMUX_PANE node --test test/integration/tmux-surface.test.ts
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DETACHED_TMUX_SOCKET,
  completionSuffix,
  createDetachedSurface,
  findLiveTaggedPane,
  isCommandAvailable,
  pollForExit,
  submitText,
  tagSurface,
} from "../../pi-extension/subagents/tmux.ts";
import {
  getAvailableBackends,
  createTestEnv,
  cleanupTestEnv,
  createTrackedSurface,
  createTrackedSurfaceSplit,
  focusSurface,
  getFocusedSurface,
  waitForFocusedSurface,
  untrackSurface,
  sendCommand,
  sendLongCommand,
  shellEscape,
  readScreen,
  readScreenAsync,
  closeSurface,
  sleep,
  uniqueId,
  trackTempFile,
  waitForFile,
  waitForScreen,
  type TestEnv,
} from "./harness.ts";

const backends = getAvailableBackends();
const FOCUS_TEST_SHELL_READY_DELAY_MS = Number(process.env.PI_SUBAGENT_SHELL_READY_DELAY_MS ?? "2500");
const BRACKETED_PASTE_FIXTURE = fileURLToPath(
  new URL("./fixtures/bracketed-paste-recorder.mjs", import.meta.url),
);

function tmuxBufferNames(socket?: string): string[] {
  try {
    return execFileSync("tmux", [...(socket ? ["-L", socket] : []), "list-buffers", "-F", "#{buffer_name}"], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    })
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

function screenContainsMarker(screen: string, marker: string): boolean {
  return screen.replace(/\s+/g, "").includes(marker);
}

function wrappedMarkerPattern(marker: string): RegExp {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped.split("").join("\\s*"));
}

if (backends.length === 0) {
  console.log("⚠️  no attached tmux client — skipping split-pane tmux-surface integration tests");
  console.log("   Run inside tmux to enable these tests.");
}

for (const backend of backends) {
  describe(`tmux-surface [${backend}]`, { timeout: 60_000 }, () => {
    let env: TestEnv;

    before(() => {
      env = createTestEnv();
    });

    after(() => {
      cleanupTestEnv(env);
    });

    it("keeps focus on the active surface while creating and targeting subagent surfaces", async () => {
      const anchor = createTrackedSurfaceSplit(env, "focus-anchor", "right");
      await sleep(1000);

      focusSurface(anchor);
      await waitForFocusedSurface(anchor, 10_000);

      const childA = createTrackedSurface(env, "focus-child-a");
      await sleep(FOCUS_TEST_SHELL_READY_DELAY_MS);
      assert.equal(getFocusedSurface(), anchor);

      const childB = createTrackedSurface(env, "focus-child-b");
      await sleep(FOCUS_TEST_SHELL_READY_DELAY_MS);
      assert.equal(getFocusedSurface(), anchor);

      const markerA = uniqueId();
      const markerB = uniqueId();
      sendCommand(childA, `echo "FOCUS_A_${markerA}"`);
      sendCommand(childB, `echo "FOCUS_B_${markerB}"`);

      await Promise.all([
        waitForScreen(childA, wrappedMarkerPattern(`FOCUS_A_${markerA}`), 20_000, 50),
        waitForScreen(childB, wrappedMarkerPattern(`FOCUS_B_${markerB}`), 20_000, 50),
      ]);
      assert.equal(getFocusedSurface(), anchor);
    });

    it("creates a surface, sends a command, reads output, and closes it", async () => {
      const surface = createTrackedSurface(env, "echo-test");
      await sleep(1000);

      const marker = uniqueId();
      sendCommand(surface, `echo "MARKER_${marker}"`);
      await sleep(1500);

      const screen = readScreen(surface, 50);
      assert.ok(
        screenContainsMarker(screen, `MARKER_${marker}`),
        `Expected screen to contain MARKER_${marker}. Got:\n${screen}`,
      );

      closeSurface(surface);
      untrackSurface(env, surface);
    });

    it("preserves shell special characters in echo output", async () => {
      const surface = createTrackedSurface(env, "escape-test");
      await sleep(1000);

      const marker = uniqueId();
      // Single-quoted string — $ and " are literal inside single quotes
      sendCommand(surface, `echo 'SPEC_${marker}_$HOME_"quotes"_done'`);
      await sleep(1500);

      const screen = readScreen(surface, 50);
      assert.ok(
        screenContainsMarker(screen, `SPEC_${marker}`),
        `Expected special-char output. Got:\n${screen}`,
      );
      // $ should be literal inside single quotes
      assert.ok(
        screenContainsMarker(screen, "$HOME"),
        `Expected literal $HOME in output. Got:\n${screen}`,
      );
    });

    it("sends a long command via script file without truncation", async () => {
      const surface = createTrackedSurface(env, "long-cmd-test");
      await sleep(1000);

      const marker = uniqueId();
      const longValue = "X".repeat(500);
      const command = `echo "LONG_${marker}_${longValue}_END"`;

      sendLongCommand(surface, command);
      await sleep(2000);

      const screen = readScreen(surface, 50);
      assert.ok(
        screenContainsMarker(screen, `LONG_${marker}`),
        `Expected long command output. Got:\n${screen.slice(0, 300)}...`,
      );
      assert.ok(
        screenContainsMarker(screen, "_END"),
        `Expected full output (not truncated). Got:\n${screen.slice(-300)}`,
      );
    });

    it("bracket-pastes a 4,283-byte UTF-8 reply exactly once and remains responsive", async () => {
      const surface = createTrackedSurface(env, "bracketed-paste-test");
      const resultFile = join(env.dir, `bracketed-paste-${uniqueId()}.jsonl`);
      trackTempFile(env, resultFile);
      await sleep(FOCUS_TEST_SHELL_READY_DELAY_MS);

      sendCommand(
        surface,
        `node ${shellEscape(BRACKETED_PASTE_FIXTURE)} ${shellEscape(resultFile)}`,
      );
      await waitForScreen(surface, /READY/, 10_000, 50);

      // The live-message caller flattens multiline replies before transport.
      const prefix = "first π🙂 line second line ";
      const payload = prefix + "X".repeat(4_283 - Buffer.byteLength(prefix));
      assert.equal(Buffer.byteLength(payload), 4_283);
      submitText(surface, payload);
      await waitForFile(resultFile, 10_000, /"submissionCount":1/);

      const probe = "responsive-π";
      submitText(surface, probe);
      await waitForFile(resultFile, 10_000, /"submissionCount":2/);
      await waitForScreen(surface, /DONE/, 10_000, 50);

      const records = readFileSync(resultFile, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      assert.deepEqual(records, [
        {
          submissionCount: 1,
          byteLength: 4_283,
          sha256: createHash("sha256").update(payload).digest("hex"),
          bracketedPaste: true,
        },
        {
          submissionCount: 2,
          byteLength: Buffer.byteLength(probe),
          sha256: createHash("sha256").update(probe).digest("hex"),
          bracketedPaste: true,
        },
      ]);
      assert.equal(
        tmuxBufferNames().some((name) => name.startsWith("pi-subagent-")),
        false,
        "named live-message buffers must be deleted after successful paste",
      );
    });

    it("reports interruption after an operator removes a child pane", async () => {
      const surface = createTrackedSurface(env, "missing-pane-test");
      await sleep(1000);

      const pending = pollForExit(surface, new AbortController().signal, { interval: 25 });
      closeSurface(surface);
      untrackSurface(env, surface);

      const result = await pending;
      assert.equal(result.reason, "interrupted");
      assert.equal(result.exitCode, 1);
      assert.match(result.errorMessage ?? "", /no longer exists/);
    });

    it("detects a sentinel that wraps in a pane narrower than the marker", async () => {
      const surface = createTrackedSurface(env, "narrow-sentinel-test");
      await sleep(1000);
      execFileSync("tmux", ["resize-pane", "-t", surface, "-x", "12"]);
      const width = Number(execFileSync("tmux", ["display", "-p", "-t", surface, "#{pane_width}"], { encoding: "utf8" }).trim());
      assert.ok(width < "__SUBAGENT_DONE_5__".length, `pane must be narrower than the marker, got ${width}`);

      sendCommand(surface, "clear; (exit 5); echo '__SUBAGENT_DONE_'$?'__'");
      const result = await pollForExit(surface, new AbortController().signal, { interval: 100 });
      assert.deepEqual(result, { reason: "sentinel", exitCode: 5 });
    });

    it("finishes from the completion file even after the screen is cleared", async () => {
      const surface = createTrackedSurface(env, "done-file-test");
      await sleep(1000);
      const dir = mkdtempSync(join(tmpdir(), "subagent-done-"));
      try {
        const doneFile = join(dir, "id.code");
        sendLongCommand(surface, `(exit 4)${completionSuffix(doneFile)}; clear`);
        await waitForFile(doneFile, 10_000);
        const result = await pollForExit(surface, new AbortController().signal, { interval: 100, doneFile });
        assert.deepEqual(result, { reason: "sentinel", exitCode: 4 });
        assert.equal(existsSync(doneFile), false);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("finds a tagged split pane on the attached server until its completion file exists", async () => {
      const surface = createTrackedSurface(env, "tag-split-test");
      await sleep(500);
      const sessionPath = join(env.dir, `tagged-split-${uniqueId()}.jsonl`);
      const doneFile = join(env.dir, `tagged-split-${uniqueId()}.code`);
      tagSurface(surface, { sessionPath, doneFile });

      assert.deepEqual(findLiveTaggedPane(sessionPath), { status: "found", surface });
      writeFileSync(doneFile, "0\n");
      assert.deepEqual(findLiveTaggedPane(sessionPath), { status: "absent" });
      rmSync(doneFile, { force: true });

      closeSurface(surface);
      untrackSurface(env, surface);
      assert.deepEqual(findLiveTaggedPane(sessionPath), { status: "absent" });
    });

    it("reads screen asynchronously", async () => {
      const surface = createTrackedSurface(env, "async-read-test");
      await sleep(1000);

      const marker = uniqueId();
      sendCommand(surface, `echo "ASYNC_${marker}"`);
      await sleep(1500);

      const screen = await readScreenAsync(surface, 50);
      assert.ok(
        screenContainsMarker(screen, `ASYNC_${marker}`),
        `Async read should find marker. Got:\n${screen}`,
      );
    });

    it("manages multiple surfaces concurrently", async () => {
      const s1 = createTrackedSurface(env, "multi-1");
      const s2 = createTrackedSurface(env, "multi-2");
      await sleep(1500);

      const m1 = uniqueId();
      const m2 = uniqueId();
      sendCommand(s1, `echo "S1_${m1}"`);
      sendCommand(s2, `echo "S2_${m2}"`);
      await sleep(1500);

      const screen1 = readScreen(s1, 50);
      const screen2 = readScreen(s2, 50);

      assert.ok(screenContainsMarker(screen1, `S1_${m1}`), `Surface 1 missing marker. Got:\n${screen1}`);
      assert.ok(screenContainsMarker(screen2, `S2_${m2}`), `Surface 2 missing marker. Got:\n${screen2}`);
    });

    it("writes output to a file and verifies via surface", async () => {
      const surface = createTrackedSurface(env, "file-test");
      await sleep(1000);

      const marker = uniqueId();
      const filePath = `/tmp/pi-tmux-test-${marker}.txt`;

      sendCommand(surface, `echo "FILE_${marker}" > ${filePath} && echo "WRITTEN_${marker}"`);

      await waitForScreen(surface, wrappedMarkerPattern(`WRITTEN_${marker}`), 10_000, 50);
      const content = await waitForFile(filePath, 10_000, new RegExp(`FILE_${marker}`));
      assert.ok(content.includes(`FILE_${marker}`), `File content wrong. Got: ${content}`);

      // Clean up
      try {
        unlinkSync(filePath);
      } catch {}
    });
  });
}

// ── Detached private-server surface (no tmux client required) ──

const tmuxBinary = isCommandAvailable("tmux");
if (!tmuxBinary) {
  console.log("⚠️  tmux binary is not available — skipping detached-surface integration tests");
}

describe("tmux-surface [detached]", { timeout: 60_000, skip: !tmuxBinary }, () => {
  let dir: string;
  const surfaces: string[] = [];
  const savedTmux = process.env.TMUX;
  const savedPane = process.env.TMUX_PANE;

  before(() => {
    // Simulate `env -u TMUX`: a headless parent without a tmux client.
    delete process.env.TMUX;
    delete process.env.TMUX_PANE;
    dir = mkdtempSync(join(tmpdir(), "pi-detached-"));
  });

  after(() => {
    for (const surface of surfaces) {
      try { closeSurface(surface); } catch {}
    }
    if (savedTmux !== undefined) process.env.TMUX = savedTmux;
    if (savedPane !== undefined) process.env.TMUX_PANE = savedPane;
    rmSync(dir, { recursive: true, force: true });
  });

  function detached(name: string): string {
    const surface = createDetachedSurface(name);
    surfaces.push(surface);
    return surface;
  }

  function forget(surface: string): void {
    const index = surfaces.indexOf(surface);
    if (index >= 0) surfaces.splice(index, 1);
  }

  it("creates a socket-qualified pane, runs a command, and captures it sync and async", async () => {
    const surface = detached("detached echo");
    assert.match(surface, new RegExp(`^${DETACHED_TMUX_SOCKET}:%\\d+$`));
    await sleep(1000);

    const marker = uniqueId();
    sendCommand(surface, `echo "DETACHED_${marker}"`);
    await waitForScreen(surface, wrappedMarkerPattern(`DETACHED_${marker}`), 10_000, 50);
    assert.ok(screenContainsMarker(readScreen(surface, 50), `DETACHED_${marker}`));
    assert.ok(screenContainsMarker(await readScreenAsync(surface, 50), `DETACHED_${marker}`));
  });

  it("bracket-pastes live text into a detached pane through the private server's buffers", async () => {
    const surface = detached("detached paste");
    const resultFile = join(dir, `paste-${uniqueId()}.jsonl`);
    await sleep(FOCUS_TEST_SHELL_READY_DELAY_MS);

    sendCommand(surface, `node ${shellEscape(BRACKETED_PASTE_FIXTURE)} ${shellEscape(resultFile)}`);
    await waitForScreen(surface, /READY/, 10_000, 50);

    const payload = "detached π reply";
    submitText(surface, payload);
    await waitForFile(resultFile, 10_000, /"submissionCount":1/);
    const record = JSON.parse(readFileSync(resultFile, "utf8").trim().split("\n")[0]);
    assert.equal(record.sha256, createHash("sha256").update(payload).digest("hex"));
    assert.equal(record.bracketedPaste, true);
    assert.equal(
      tmuxBufferNames(DETACHED_TMUX_SOCKET).some((name) => name.startsWith("pi-subagent-")),
      false,
      "named live-message buffers must be deleted after successful paste",
    );
  });

  it("finishes from the completion file of a long command sent to a detached pane", async () => {
    const surface = detached("detached done");
    await sleep(1000);
    const doneFile = join(dir, `done-${uniqueId()}.code`);
    sendLongCommand(surface, `(exit 6)${completionSuffix(doneFile)}`);
    const result = await pollForExit(surface, new AbortController().signal, { interval: 100, doneFile });
    assert.deepEqual(result, { reason: "sentinel", exitCode: 6 });
  });

  it("tags, finds, and stops finding a detached pane after completion or close", async () => {
    const surface = detached("detached tag");
    await sleep(500);
    const sessionPath = join(dir, `tagged-${uniqueId()}.jsonl`);
    const doneFile = join(dir, `tagged-${uniqueId()}.code`);
    tagSurface(surface, { sessionPath, doneFile });

    assert.deepEqual(findLiveTaggedPane(sessionPath), { status: "found", surface });
    assert.deepEqual(findLiveTaggedPane(join(dir, "other.jsonl")), { status: "absent" });

    writeFileSync(doneFile, "0\n");
    assert.deepEqual(findLiveTaggedPane(sessionPath), { status: "absent" });
    rmSync(doneFile, { force: true });
    assert.deepEqual(findLiveTaggedPane(sessionPath), { status: "found", surface });

    closeSurface(surface);
    forget(surface);
    assert.deepEqual(findLiveTaggedPane(sessionPath), { status: "absent" });
  });

  it("reports interruption after the only detached pane is closed", async () => {
    const surface = detached("detached interrupt");
    await sleep(500);
    const pending = pollForExit(surface, new AbortController().signal, { interval: 25 });
    closeSurface(surface);
    forget(surface);
    const result = await pending;
    assert.equal(result.reason, "interrupted");
    assert.match(result.errorMessage ?? "", /no longer exists/);
  });
});
