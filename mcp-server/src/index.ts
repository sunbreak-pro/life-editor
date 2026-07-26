#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOLS, callTool } from "./tools.js";

// Every tool is Supabase-backed since #360 — the server authenticates from
// env (see supabase.ts) and keeps no local database. The legacy SQLite path
// argument (argv[2] / DB_PATH) is accepted-and-ignored so an old .mcp.json
// entry still starts the server instead of failing.

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
  process.exit(0);
});

process.on("SIGTERM", () => {
  process.exit(0);
});
