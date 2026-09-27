#!/usr/bin/env node
/*
  Contently's MCP server.

      CONTENTLY_API_KEY=ctly_… npx @contently/mcp                  # stdio (Claude, Cursor)
      CONTENTLY_API_KEY=ctly_… npx @contently/mcp --http --port 8787  # Streamable HTTP at /mcp

  Environment:
    CONTENTLY_API_KEY   an organisation's API key (Contently → Settings → API keys)
    CONTENTLY_API_URL   the API's base URL (default: production)

  Over HTTP, a request may bring its own key (`Authorization: Bearer ctly_…`),
  so one server can serve several organisations; without one it uses
  CONTENTLY_API_KEY. The HTTP transport is stateless: each request gets a
  fresh server, which is all these tools need.
*/

import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { ContentlyClient, DEFAULT_BASE_URL } from "./client.js";
import { createServer, VERSION } from "./server.js";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

if (flag("help") || flag("h")) {
  process.stdout.write(`contently-mcp ${VERSION}\n\n  --http          serve Streamable HTTP instead of stdio\n  --port <n>      HTTP port (default 8787)\n  --host <h>      HTTP host (default 127.0.0.1)\n\nEnvironment: CONTENTLY_API_KEY (required for stdio), CONTENTLY_API_URL (default ${DEFAULT_BASE_URL})\n`);
  process.exit(0);
}

const baseUrl = process.env.CONTENTLY_API_URL || DEFAULT_BASE_URL;
const envKey = process.env.CONTENTLY_API_KEY?.trim();

async function stdio() {
  if (!envKey) {
    process.stderr.write("contently-mcp: set CONTENTLY_API_KEY to an API key (Contently → Settings → API keys)\n");
    process.exit(1);
  }
  await createServer(new ContentlyClient({ apiKey: envKey, baseUrl })).connect(new StdioServerTransport());
  process.stderr.write(`contently-mcp ${VERSION} on stdio → ${baseUrl}\n`);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : undefined;
}

function reply(res: ServerResponse, status: number, message: string) {
  res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }));
}

async function http() {
  const port = Number(option("port") ?? process.env.PORT ?? 8787);
  const host = option("host") ?? "127.0.0.1";
  const server = createHttpServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://x").pathname;
    if (path === "/healthz") return void res.writeHead(200).end("ok");
    if (path !== "/mcp") return reply(res, 404, "The MCP endpoint is /mcp");
    if (req.method !== "POST") return reply(res, 405, "Stateless server: POST only");

    const key = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "")?.[1] ?? envKey;
    if (!key) return reply(res, 401, "Send Authorization: Bearer ctly_… or start the server with CONTENTLY_API_KEY");

    let body: unknown;
    try {
      body = await readJson(req);
    } catch {
      return reply(res, 400, "The body must be JSON");
    }
    const mcp = createServer(new ContentlyClient({ apiKey: key, baseUrl }));
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void mcp.close();
    });
    try {
      await mcp.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (error) {
      if (!res.headersSent) reply(res, 500, error instanceof Error ? error.message : String(error));
    }
  });
  server.listen(port, host, () => process.stderr.write(`contently-mcp ${VERSION} on http://${host}:${port}/mcp → ${baseUrl}\n`));
}

await (flag("http") ? http() : stdio());
