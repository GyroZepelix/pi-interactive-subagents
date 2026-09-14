import { appendFileSync } from "node:fs";
import { createHash } from "node:crypto";

const outputFile = process.argv[2];
if (!outputFile) throw new Error("output file argument is required");
if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
  throw new Error("bracketed-paste recorder requires a TTY");
}

const PASTE_START = Buffer.from("\x1b[200~");
const PASTE_END = Buffer.from("\x1b[201~");
let input = Buffer.alloc(0);
let pendingPaste = null;
let submissionCount = 0;

function record(payload, bracketedPaste) {
  submissionCount += 1;
  appendFileSync(
    outputFile,
    `${JSON.stringify({
      submissionCount,
      byteLength: payload.length,
      sha256: createHash("sha256").update(payload).digest("hex"),
      bracketedPaste,
    })}\n`,
    "utf8",
  );
  process.stdout.write(`RECORDED_${submissionCount}\r\n`);
  if (submissionCount >= 2) {
    process.stdout.write("\x1b[?2004lDONE\r\n");
    process.stdin.setRawMode(false);
    process.exit(0);
  }
}

function consumeInput() {
  for (;;) {
    if (pendingPaste) {
      const enterIndex = input.findIndex((byte) => byte === 10 || byte === 13);
      if (enterIndex < 0) return;
      record(pendingPaste, true);
      pendingPaste = null;
      input = input.subarray(enterIndex + 1);
      continue;
    }

    if (input.subarray(0, PASTE_START.length).equals(PASTE_START)) {
      const endIndex = input.indexOf(PASTE_END, PASTE_START.length);
      if (endIndex < 0) return;
      pendingPaste = Buffer.from(input.subarray(PASTE_START.length, endIndex));
      input = input.subarray(endIndex + PASTE_END.length);
      continue;
    }

    const enterIndex = input.findIndex((byte) => byte === 10 || byte === 13);
    if (enterIndex < 0) return;
    record(Buffer.from(input.subarray(0, enterIndex)), false);
    input = input.subarray(enterIndex + 1);
  }
}

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on("data", (chunk) => {
  input = Buffer.concat([input, chunk]);
  consumeInput();
});
process.stdout.write("\x1b[?2004hREADY\r\n");
