/**
 * tmux surface layer — the only terminal multiplexer this extension supports.
 *
 * Everything the extension does to a pane goes through the small API in this
 * file: create/split a pane, type a command into it, read its screen, close
 * it, and poll for exit. Keeping the tmux calls isolated here means index.ts
 * stays testable without a multiplexer running.
 *
 * Two surface kinds exist:
 * - split: a pane split off the parent pi's pane (`$TMUX_PANE`) on the tmux
 *   server the parent runs in, so new panes follow the agent rather than the
 *   user's focus. Handles are plain tmux pane ids (e.g. `%12`).
 * - detached: a pane in its own detached session on the private per-user
 *   server `tmux -L pi-subagents`. Used when the parent has no tmux client
 *   (`$TMUX` unset) or a profile sets `background: true`. Handles encode the
 *   socket (e.g. `pi-subagents:%3`) and every primitive routes them with
 *   `-L <socket>`.
 */
import { execFile, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { existsSync, readFileSync, realpathSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const execFileAsync = promisify(execFile);

// ── Surface handles and transport ──

/** Fixed per-user private socket name for detached subagent panes. */
export const DETACHED_TMUX_SOCKET = "pi-subagents";

export type SurfaceKind = "split" | "detached";

export interface SurfaceHandle {
  /** Private socket name for detached panes; null for the attached server. */
  socket: string | null;
  /** tmux pane id, e.g. `%3`. */
  pane: string;
}

const SOCKET_HANDLE_PATTERN = /^([A-Za-z0-9_-]+):(%\d+)$/;

/** Split a surface handle into its optional socket and tmux pane id. */
export function parseSurfaceHandle(surface: string): SurfaceHandle {
  const match = SOCKET_HANDLE_PATTERN.exec(surface);
  return match ? { socket: match[1], pane: match[2] } : { socket: null, pane: surface };
}

/** Encode a pane id (and optional private socket) as a surface handle. */
export function formatSurfaceHandle(socket: string | null, pane: string): string {
  return socket ? `${socket}:${pane}` : pane;
}

function socketArgs(socket: string | null): string[] {
  return socket ? ["-L", socket] : [];
}

type TmuxSyncRunner = (args: string[], options?: { input?: string; quiet?: boolean }) => string;
type TmuxAsyncRunner = (args: string[]) => Promise<string>;

/** Throw unless the tmux invocation can reach the server named by its args. */
function requireTmuxForArgs(args: readonly string[]): void {
  // Private-socket commands and version probes need only the binary.
  if (args[0] === "-L" || args[0] === "-V") {
    if (!isCommandAvailable("tmux")) {
      throw new Error(`tmux is required for subagents. ${muxSetupHint()}`);
    }
    return;
  }
  requireTmux();
}

const defaultTmuxTransport: { sync: TmuxSyncRunner; async: TmuxAsyncRunner } = {
  sync(args, options) {
    requireTmuxForArgs(args);
    return execFileSync("tmux", args, {
      ...(options?.input !== undefined ? { input: options.input } : {}),
      // Probes capture stderr instead of echoing tmux errors into the parent TUI.
      ...(options?.quiet ? { stdio: ["pipe", "pipe", "pipe"] as ["pipe", "pipe", "pipe"] } : {}),
      encoding: "utf8",
    });
  },
  async async(args) {
    requireTmuxForArgs(args);
    const { stdout } = await execFileAsync("tmux", args, { encoding: "utf8" });
    return stdout;
  },
};

let tmuxTransport = defaultTmuxTransport;

/**
 * Test seam: replace the tmux process runner so argv can be asserted without
 * a tmux server. Pass null to restore the real transport.
 */
export const __tmuxTransportTest__ = {
  set(transport: { sync: TmuxSyncRunner; async?: TmuxAsyncRunner } | null): void {
    tmuxTransport = transport
      ? { sync: transport.sync, async: transport.async ?? (async (args) => transport.sync(args)) }
      : defaultTmuxTransport;
    commandAvailability.delete("tmux-pane-options");
  },
};

// ── Availability ──

const commandAvailability = new Map<string, boolean>();

export function isCommandAvailable(command: string): boolean {
  if (commandAvailability.has(command)) {
    return commandAvailability.get(command)!;
  }

  let available = false;
  try {
    execFileSync("sh", ["-c", `command -v ${command}`], { stdio: "ignore" });
    available = true;
  } catch {
    available = false;
  }

  commandAvailability.set(command, available);
  return available;
}

/**
 * True when running inside tmux with the tmux binary on PATH.
 * `TMUX` is set by tmux in every process it spawns (shell or pane).
 */
export function isTmuxAvailable(): boolean {
  return !!process.env.TMUX && isCommandAvailable("tmux");
}

/**
 * True when subagents can get a surface: inside tmux (split panes) or, without
 * a tmux client, on the private detached server. Both need only the binary.
 */
export function isMuxAvailable(): boolean {
  return isCommandAvailable("tmux");
}

export function muxSetupHint(): string {
  return (
    "Install tmux and make it available on PATH. Inside tmux subagents open split panes; " +
    "without a tmux client they run on a private detached server (`tmux -L pi-subagents attach` to watch)."
  );
}

function requireTmux(): void {
  if (!isTmuxAvailable()) {
    throw new Error(`tmux is required for subagents. ${muxSetupHint()}`);
  }
}

// ── Shell helpers ──

export function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

// ── Pane layout ──

/**
 * tmux layout applied to the subagent window to keep panes evenly sized.
 * Switchable: "even-horizontal" (equal columns, matches Ctrl+b Alt+1),
 * "main-vertical" (big main pane + tiled column), "tiled" (grid).
 */
const SUBAGENT_TMUX_LAYOUT = "even-horizontal";

let rebalanceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Re-balance subagent panes so repeated splits don't leave them lopsided.
 * tmux halves the target pane on every split and dumps freed space onto a
 * neighbor on close, so without this panes drift to wildly uneven widths.
 * Applies SUBAGENT_TMUX_LAYOUT to the parent pi window. Debounced so a burst
 * of parallel spawns or staggered exits collapses into a single layout call,
 * and non-fatal: a cosmetic resize must never break spawning or watching.
 */
function rebalanceSurfaces(hintPane?: string): void {
  // Prefer the parent pi pane (stable; survives a closing subagent pane).
  const target = process.env.TMUX_PANE ?? hintPane;
  if (!target) return;
  if (rebalanceTimer) clearTimeout(rebalanceTimer);
  const run = tmuxTransport.sync;
  rebalanceTimer = setTimeout(() => {
    rebalanceTimer = null;
    try {
      // -t <pane> resolves to that pane's window; does not change focus.
      run(["select-layout", "-t", target, SUBAGENT_TMUX_LAYOUT]);
    } catch {
      // Pane/window may be gone; balancing is best-effort.
    }
  }, 120);
}

// ── Surface primitives ──

/**
 * Create a new pane for a subagent: a right split off the parent pi's pane,
 * so new panes follow the agent rather than the user's focus.
 * See https://github.com/HazAT/pi-interactive-subagents/issues/12
 *
 * Returns the new pane id (e.g. `%12`).
 */
export function createSurface(name: string): string {
  void name; // tmux panes are not named; the pi process inside shows its own title.
  return createSurfaceSplit(name, "right", process.env.TMUX_PANE);
}

/**
 * Create a new split in the given direction from an optional source pane.
 * Returns the new pane id (e.g. `%12`).
 */
export function createSurfaceSplit(
  name: string,
  direction: "left" | "right" | "up" | "down",
  fromSurface?: string,
): string {
  void name;

  const args = ["split-window", "-d"];
  if (direction === "left" || direction === "right") {
    args.push("-h");
  } else {
    args.push("-v");
  }
  if (direction === "left" || direction === "up") {
    args.push("-b");
  }
  if (fromSurface) {
    args.push("-t", fromSurface);
  }
  args.push("-P", "-F", "#{pane_id}");

  const pane = tmuxTransport.sync(args).trim();
  if (!pane.startsWith("%")) {
    throw new Error(`Unexpected tmux split-window output: ${pane}`);
  }

  rebalanceSurfaces(pane);
  return pane;
}

/** tmux session names may not contain `:` or `.`; keep a readable safe slug. */
function detachedSessionName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "subagent";
  return `${slug}-${randomUUID().slice(0, 8)}`;
}

/**
 * Create a pane in its own detached session on the private subagent server
 * (`tmux -L pi-subagents`). Needs the tmux binary but no `$TMUX`. The server
 * starts on first use with the caller's environment and exits by itself when
 * its last session closes. Returns a socket-qualified handle such as
 * `pi-subagents:%3`.
 */
export function createDetachedSurface(name: string): string {
  const pane = tmuxTransport
    .sync([
      ...socketArgs(DETACHED_TMUX_SOCKET),
      "new-session",
      "-d",
      "-s",
      detachedSessionName(name),
      "-P",
      "-F",
      "#{pane_id}",
    ])
    .trim();
  if (!pane.startsWith("%")) {
    throw new Error(`Unexpected tmux new-session output: ${pane}`);
  }
  return formatSurfaceHandle(DETACHED_TMUX_SOCKET, pane);
}

/** Create a subagent surface of the selected kind. */
export function createSurfaceOfKind(kind: SurfaceKind, name: string): string {
  return kind === "detached" ? createDetachedSurface(name) : createSurface(name);
}

/**
 * Send a command string to a pane and execute it.
 * Typed literally (`-l`) so special characters are not interpreted as keys,
 * then submitted with Enter.
 */
export function sendCommand(surface: string, command: string): void {
  const { socket, pane } = parseSurfaceHandle(surface);
  const prefix = socketArgs(socket);
  tmuxTransport.sync([...prefix, "send-keys", "-t", pane, "-l", command]);
  tmuxTransport.sync([...prefix, "send-keys", "-t", pane, "Enter"]);
}

type TmuxTextRunner = (
  args: string[],
  options?: { input?: string; encoding?: BufferEncoding },
) => unknown;

function runTmuxTextCommand(
  args: string[],
  options?: { input?: string; encoding?: BufferEncoding },
): unknown {
  return tmuxTransport.sync(args, options?.input !== undefined ? { input: options.input } : undefined);
}

/**
 * Submit text to a TUI pane without exposing it in argv or typing it as a
 * burst of individual key events. tmux reads the payload from stdin into a
 * uniquely named server buffer, pastes it with application-negotiated
 * bracketed-paste framing, removes the buffer, and only then sends Enter.
 *
 * Launch commands intentionally continue to use sendCommand/sendLongCommand;
 * this primitive is for live editor input only.
 */
export function submitText(
  surface: string,
  text: string,
  runner: TmuxTextRunner = runTmuxTextCommand,
): void {
  const bufferName = `pi-subagent-${process.pid}-${randomUUID()}`;
  // Buffers are per server, so every step targets the handle's server.
  const { socket, pane } = parseSurfaceHandle(surface);
  const prefix = socketArgs(socket);
  let needsCleanup = true;
  try {
    runner([...prefix, "load-buffer", "-b", bufferName, "-"], { input: text, encoding: "utf8" });
    runner([...prefix, "paste-buffer", "-p", "-d", "-b", bufferName, "-t", pane], {
      encoding: "utf8",
    });
    needsCleanup = false; // paste-buffer -d removed it after the successful paste.
    runner([...prefix, "send-keys", "-t", pane, "Enter"], { encoding: "utf8" });
  } finally {
    if (needsCleanup) {
      try {
        runner([...prefix, "delete-buffer", "-b", bufferName], { encoding: "utf8" });
      } catch {
        // Preserve the original transport failure. Cleanup is best effort when
        // the tmux server itself is unavailable.
      }
    }
  }
}

/**
 * Send a long command to a pane by writing it to a script file first.
 * This avoids terminal line-wrapping issues that break commands exceeding the
 * pane's column width when sent character-by-character via sendCommand.
 *
 * By default the script is written to a temp directory, but callers can pass a
 * stable path (for example under session artifacts) so the exact invocation is
 * preserved for debugging.
 *
 * Returns the script path.
 */
export function sendLongCommand(
  surface: string,
  command: string,
  options?: { scriptPath?: string; scriptPreamble?: string },
): string {
  const scriptPath =
    options?.scriptPath ??
    join(
      tmpdir(),
      "pi-subagent-scripts",
      `cmd-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.sh`,
    );
  mkdirSync(dirname(scriptPath), { recursive: true });

  const scriptParts = ["#!/bin/bash"];
  if (options?.scriptPreamble) {
    scriptParts.push(options.scriptPreamble.trimEnd());
  }
  scriptParts.push(command);

  writeFileSync(scriptPath, scriptParts.join("\n") + "\n", {
    mode: 0o755,
  });
  sendCommand(surface, `bash ${shellEscape(scriptPath)}`);
  return scriptPath;
}

/**
 * Shell suffix appended to every child launch command. After the child exits it
 * records the exit code in `doneFile` (temp file + rename, so a reader never
 * sees a partial write) and then prints the legacy terminal sentinel. The file
 * is the primary completion signal; the sentinel is a fallback that depends on
 * the pane screen and can wrap in narrow panes or be erased by prompt redraws.
 */
export function completionSuffix(doneFile: string): string {
  const tmp = shellEscape(`${doneFile}.tmp`);
  return `; subagent_exit=$?; printf '%s\\n' "$subagent_exit" > ${tmp} && mv -f ${tmp} ${shellEscape(doneFile)}; ` +
    `echo '__SUBAGENT_DONE_'$subagent_exit'__'`;
}

/**
 * Read the screen contents of a pane (sync).
 */
export function readScreen(surface: string, lines = 50): string {
  const { socket, pane } = parseSurfaceHandle(surface);
  return tmuxTransport.sync([
    ...socketArgs(socket),
    "capture-pane",
    "-p",
    "-t",
    pane,
    "-S",
    `-${Math.max(1, lines)}`,
  ]);
}

/**
 * Read the screen contents of a pane (async).
 */
export async function readScreenAsync(
  surface: string,
  lines = 50,
  options?: { joinWrapped?: boolean },
): Promise<string> {
  const { socket, pane } = parseSurfaceHandle(surface);
  return tmuxTransport.async([
    ...socketArgs(socket),
    "capture-pane",
    "-p",
    ...(options?.joinWrapped ? ["-J"] : []),
    "-t",
    pane,
    "-S",
    `-${Math.max(1, lines)}`,
  ]);
}

/**
 * Close a pane. Killing a detached child's only pane also ends its session;
 * detached closes skip split-layout rebalancing.
 */
export function closeSurface(surface: string): void {
  const { socket, pane } = parseSurfaceHandle(surface);
  tmuxTransport.sync([...socketArgs(socket), "kill-pane", "-t", pane]);
  if (!socket) rebalanceSurfaces();
}

// ── Pane tags (live child detection across parent restarts) ──

/** Pane user option holding the child's canonical session (or AGY state) path. */
export const PANE_SESSION_TAG = "@pi_subagent_session";
/** Pane user option holding the per-launch completion file path. */
export const PANE_DONE_TAG = "@pi_subagent_done";

function canonicalPath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

/**
 * Tag a child pane with its session path and completion file so a later
 * parent process can find a still-running child (`findLiveTaggedPane`).
 * Requires tmux 3.0+ pane options. Throws on transport failure; callers treat
 * tagging as best effort.
 */
export function tagSurface(surface: string, tags: { sessionPath: string; doneFile?: string }): void {
  const { socket, pane } = parseSurfaceHandle(surface);
  const args = [
    ...socketArgs(socket),
    "set-option",
    "-p",
    "-t",
    pane,
    PANE_SESSION_TAG,
    canonicalPath(tags.sessionPath),
  ];
  if (tags.doneFile) {
    args.push(";", "set-option", "-p", "-t", pane, PANE_DONE_TAG, resolve(tags.doneFile));
  }
  tmuxTransport.sync(args, { quiet: true });
}

/** True when tmux supports pane user options (`set-option -p`, tmux 3.0+). */
function tmuxSupportsPaneOptions(): boolean {
  const key = "tmux-pane-options";
  if (commandAvailability.has(key)) return commandAvailability.get(key)!;
  let supported = false;
  try {
    const version = tmuxTransport.sync(["-V"], { quiet: true }).trim();
    const match = /(\d+)\.(\d+)/.exec(version);
    supported = !!match && Number(match[1]) >= 3;
  } catch {
    supported = false;
  }
  commandAvailability.set(key, supported);
  return supported;
}

/** Path of the private subagent server socket (tmux default socket dir). */
export function detachedSocketPath(): string {
  const base = process.env.TMUX_TMPDIR || "/tmp";
  const uid = typeof process.getuid === "function" ? process.getuid() : 0;
  return join(base, `tmux-${uid}`, DETACHED_TMUX_SOCKET);
}

/** A failure that proves a private server has no panes (none running). */
function isNoServerError(error: unknown): boolean {
  const err = error as { stderr?: unknown; message?: unknown };
  const text = `${typeof err?.stderr === "string" ? err.stderr : ""}\n${
    typeof err?.message === "string" ? err.message : ""
  }`;
  return (
    /no server running on/i.test(text) ||
    /error connecting to .*\((No such file or directory|Connection refused)\)/i.test(text)
  );
}

export type LiveTaggedPaneLookup =
  | { status: "found"; surface: string }
  | { status: "absent" }
  | { status: "unknown"; error: string };

function sameSocketPath(a: string, b: string): boolean {
  return canonicalPath(a) === canonicalPath(b);
}

/**
 * Find a live child pane tagged with `sessionPath` on the attached tmux server
 * (when `$TMUX` is set) and on the private subagent server. A pane counts as
 * live while its completion file is absent and the pane is not dead.
 * Transport failures return `unknown`, never `absent`; only a missing private
 * server proves absence there.
 */
export function findLiveTaggedPane(sessionPath: string): LiveTaggedPaneLookup {
  if (!isCommandAvailable("tmux")) return { status: "absent" };
  if (!tmuxSupportsPaneOptions()) {
    return { status: "unknown", error: "tmux 3.0 or newer is required to detect live subagent panes" };
  }

  const target = canonicalPath(sessionPath);
  const format = `#{pane_id}\t#{pane_dead}\t#{${PANE_SESSION_TAG}}\t#{${PANE_DONE_TAG}}`;
  const servers: Array<{ socket: string | null }> = [];
  const attachedSocket = process.env.TMUX ? process.env.TMUX.split(",")[0] : null;
  if (attachedSocket) servers.push({ socket: null });
  if (!attachedSocket || !sameSocketPath(attachedSocket, detachedSocketPath())) {
    servers.push({ socket: DETACHED_TMUX_SOCKET });
  }

  for (const { socket } of servers) {
    let output: string;
    try {
      output = tmuxTransport.sync([...socketArgs(socket), "list-panes", "-a", "-F", format], { quiet: true });
    } catch (error) {
      if (socket && isNoServerError(error)) continue;
      const message = error instanceof Error ? error.message : String(error);
      return { status: "unknown", error: message.split("\n")[0] };
    }
    for (const line of output.split("\n")) {
      if (!line) continue;
      const [pane, dead, tag, doneFile] = line.split("\t");
      if (!pane?.startsWith("%") || !tag || dead === "1") continue;
      if (canonicalPath(tag) !== target) continue;
      if (doneFile && existsSync(doneFile)) continue;
      return { status: "found", surface: formatSurfaceHandle(socket, pane) };
    }
  }
  return { status: "absent" };
}

// ── Exit polling ──

export interface PollResult {
  /** How the subagent exited */
  reason: "done" | "sentinel" | "error" | "interrupted";
  /** Shell exit code (from sentinel). 0 for file-based exits. */
  exitCode: number;
  /** Error message if reason is "error" (auto-retry exhausted, provider overload, etc.) */
  errorMessage?: string;
}

/**
 * Interpret an `.exit` sidecar payload (written by the error path in
 * subagent-runtime-control.ts). Centralized so both the fast and slow paths in
 * pollForExit decode the payload the same way. Clean completions write no
 * sidecar and are detected via the terminal sentinel instead.
 *
 * Note: ask_question does NOT write a `.exit` sidecar — it keeps the session
 * open and signals the parent via a separate `.ask` file (see deliverPendingQuestion).
 */
function interpretExitSidecar(data: any): PollResult {
  if (data?.type === "error") {
    const errorMessage =
      typeof data.errorMessage === "string" && data.errorMessage.trim() !== ""
        ? data.errorMessage
        : "Subagent exited with stopReason=error (no errorMessage in sidecar).";
    return { reason: "error", exitCode: 1, errorMessage };
  }
  return { reason: "done", exitCode: 0 };
}

async function surfaceExists(surface: string): Promise<boolean | null> {
  const { socket, pane } = parseSurfaceHandle(surface);
  try {
    const stdout = await tmuxTransport.async([...socketArgs(socket), "list-panes", "-a", "-F", "#{pane_id}"]);
    return stdout.split("\n").includes(pane);
  } catch (error) {
    // The private server exits with its last session, which proves the pane
    // is gone. Any other server/transport failure cannot prove that.
    if (socket && isNoServerError(error)) return false;
    return null;
  }
}

/**
 * Read and remove a completion file written by `completionSuffix`. Returns
 * null when absent or unreadable; unparsable content reports exit code 1.
 */
function consumeDoneFile(doneFile: string): number | null {
  let raw: string;
  try {
    raw = readFileSync(doneFile, "utf-8");
  } catch {
    return null;
  }
  rmSync(doneFile, { force: true });
  const code = /^\d+$/.test(raw.trim()) ? parseInt(raw.trim(), 10) : NaN;
  return Number.isFinite(code) ? code : 1;
}

function readScreenForSentinel(surface: string, lines: number): Promise<string> {
  return readScreenAsync(surface, lines, { joinWrapped: true });
}

export const __pollForExitTest__ = { interpretExitSidecar, surfaceExists, consumeDoneFile, isNoServerError };

/**
 * Poll until the subagent exits. Checks for a `.exit` sidecar file first
 * (written by the error path), falling back to the terminal sentinel for
 * clean-completion and crash detection.
 */
export async function pollForExit(
  surface: string,
  signal: AbortSignal,
  options: {
    interval: number;
    sessionFile?: string;
    sentinelFile?: string;
    /** Exit-code file written by `completionSuffix` after the child exits. */
    doneFile?: string;
    onTick?: (elapsed: number) => void;
    readSurface?: (surface: string, lines: number) => Promise<string>;
    probeSurface?: (surface: string) => Promise<boolean | null>;
  },
): Promise<PollResult> {
  const start = Date.now();

  for (;;) {
    if (signal.aborted) {
      throw new Error("Aborted while waiting for subagent to finish");
    }

    // Sample the completion file first. The `.exit` sidecar and the Claude
    // sentinel are always written before the child exits, so checking them
    // after this sample guarantees they win over the plain exit code.
    let doneSeen = false;
    if (options.doneFile) {
      try {
        doneSeen = existsSync(options.doneFile);
      } catch {}
    }

    // Fast path: check for .exit sidecar file (written by the error path)
    if (options.sessionFile) {
      try {
        const exitFile = `${options.sessionFile}.exit`;
        if (existsSync(exitFile)) {
          const data = JSON.parse(readFileSync(exitFile, "utf-8"));
          rmSync(exitFile, { force: true });
          return interpretExitSidecar(data);
        }
      } catch {}
    }

    // Check Claude sentinel file (written by plugin Stop hook)
    if (options.sentinelFile) {
      try {
        if (existsSync(options.sentinelFile)) {
          return { reason: "sentinel", exitCode: 0 };
        }
      } catch {}
    }

    // Completion file written by the launch script after the child exited.
    if (doneSeen && options.doneFile) {
      const exitCode = consumeDoneFile(options.doneFile);
      if (exitCode !== null) {
        return { reason: "sentinel", exitCode };
      }
    }

    // Slow path: read terminal screen for sentinel (fallback for launches
    // without a completion file, and crash detection). Wrapped lines are
    // joined so a narrow pane cannot split the sentinel.
    try {
      const screen = await (options.readSurface ?? readScreenForSentinel)(surface, 5);
      const match = screen.match(/__SUBAGENT_DONE_(\d+)__/);
      if (match) {
        return { reason: "sentinel", exitCode: parseInt(match[1], 10) };
      }
    } catch {
      // Surface may have been destroyed — first honor a sidecar that appeared
      // during the failed capture, then distinguish confirmed absence from a
      // transient tmux/capture failure.
      if (options.sessionFile) {
        try {
          const exitFile = `${options.sessionFile}.exit`;
          if (existsSync(exitFile)) {
            const data = JSON.parse(readFileSync(exitFile, "utf-8"));
            rmSync(exitFile, { force: true });
            return interpretExitSidecar(data);
          }
        } catch {}
      }

      const exists = await (options.probeSurface ?? surfaceExists)(surface);
      if (exists === false) {
        return {
          reason: "interrupted",
          exitCode: 1,
          errorMessage: `tmux pane ${surface} no longer exists`,
        };
      }
    }

    const elapsed = Math.floor((Date.now() - start) / 1000);
    options.onTick?.(elapsed);

    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(new Error("Aborted"));
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, options.interval);
      function onAbort() {
        clearTimeout(timer);
        reject(new Error("Aborted"));
      }
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
}
