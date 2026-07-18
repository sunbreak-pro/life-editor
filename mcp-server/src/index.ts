#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { initDb, closeDb } from "./db.js";
import { TOOLS, callTool } from "./tools.js";

// Optional legacy SQLite path. Supabase-backed tools (schedule / briefing)
// authenticate from env (see supabase.ts) and need no local DB; the
// remaining SQLite tools error at call time when no path is given.
const dbPath = process.argv[2] || process.env.DB_PATH;
if (dbPath) initDb(dbPath);

const server = new Server(
  { name: "life-editor", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    // `await` is load-bearing: without it an async handler rejection
    // escapes this try/catch and crashes the server.
    return await callTool(name, args ?? {});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

process.on("SIGINT", () => {
  closeDb();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeDb();
  process.exit(0);
});
