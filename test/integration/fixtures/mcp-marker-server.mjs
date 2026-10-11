#!/usr/bin/env node
import { appendFileSync } from "node:fs";

const [markerPath, serverName] = process.argv.slice(2);
if (!markerPath || !serverName) {
  process.stderr.write("usage: mcp-marker-server.mjs <marker-path> <server-name>\n");
  process.exit(2);
}

function mark(event, details = {}) {
  appendFileSync(markerPath, `${JSON.stringify({ event, serverName, pid: process.pid, ...details })}\n`);
}

function send(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function sendError(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
}

mark("started", { hasCredential: Boolean(process.env.MCP_FIXTURE_CREDENTIAL) });

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
  while (true) {
    const newline = input.indexOf("\n");
    if (newline < 0) break;
    const line = input.slice(0, newline).trim();
    input = input.slice(newline + 1);
    if (!line) continue;

    let message;
    try {
      message = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof message.method !== "string") continue;
    mark("request", { method: message.method });
    if (message.id === undefined) continue;

    switch (message.method) {
      case "initialize":
        send(message.id, {
          protocolVersion: message.params?.protocolVersion ?? "2025-06-18",
          capabilities: { tools: {}, resources: {} },
          serverInfo: { name: `${serverName}-fixture`, version: "1.0.0" },
          instructions: `${serverName}-instructions`,
        });
        break;
      case "tools/list":
        send(message.id, {
          tools: [
            { name: "direct", description: `${serverName} direct tool`, inputSchema: { type: "object" } },
            { name: "code", description: `${serverName} codemode tool`, inputSchema: { type: "object" } },
            { name: "deferred", description: `${serverName} deferred tool`, inputSchema: { type: "object" } },
            { name: "hidden", description: `${serverName} hidden tool`, inputSchema: { type: "object" } },
          ],
        });
        break;
      case "tools/call":
        send(message.id, {
          content: [{ type: "text", text: `${serverName}:${message.params?.name ?? "unknown"}` }],
        });
        break;
      case "resources/list":
        send(message.id, {
          resources: [
            {
              uri: `fixture://${serverName}/document`,
              name: `${serverName}-document`,
              description: `${serverName} resource`,
              mimeType: "text/plain",
            },
          ],
        });
        break;
      case "resources/templates/list":
        send(message.id, {
          resourceTemplates: [
            {
              uriTemplate: `fixture://${serverName}/{name}`,
              name: `${serverName}-template`,
              description: `${serverName} resource template`,
              mimeType: "text/plain",
            },
          ],
        });
        break;
      case "resources/read":
        send(message.id, {
          contents: [
            {
              uri: message.params?.uri ?? `fixture://${serverName}/document`,
              mimeType: "text/plain",
              text: `${serverName}-resource-content`,
            },
          ],
        });
        break;
      case "ping":
        send(message.id, {});
        break;
      default:
        sendError(message.id, -32601, `Unsupported fixture method: ${message.method}`);
    }
  }
});

process.stdin.on("end", () => {
  mark("stdin-ended");
  process.exit(0);
});
process.on("SIGTERM", () => {
  mark("sigterm");
  process.exit(0);
});
