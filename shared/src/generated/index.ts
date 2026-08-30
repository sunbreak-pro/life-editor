/*
 * Generated artifacts — committed, but never hand-edited (#1210).
 *
 * `mcpToolCatalog.json` is written by `mcp-server/scripts/dump-tool-catalog.mjs`
 * (`cd mcp-server && npm run catalog`). It exists because shared/ cannot import
 * the MCP registry directly: every `tools/<domain>.ts` pulls its handlers in,
 * and the handlers pull in the Supabase client, so the import would drag the
 * server's data layer into the browser bundle. The catalog crosses the package
 * line as data instead.
 *
 * mcp-server/tests/toolCatalogFreshness.test.ts compares this file against the
 * live registry, so a tool added without re-running the script fails CI rather
 * than quietly leaving Settings showing yesterday's list.
 */

import catalog from "./mcpToolCatalog.json";

/** One MCP tool as the server publishes it (ListTools response shape). */
export interface McpToolCatalogEntry {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/** Every tool Claude Code can call against this database, in registry order. */
export const MCP_TOOL_CATALOG: McpToolCatalogEntry[] =
  catalog as McpToolCatalogEntry[];

/**
 * The argument names one tool accepts, required first — what the Settings
 * card shows under each row so the list says what a tool *takes*, not only
 * that it exists. Order within each group is the schema's own.
 */
export function toolArgNames(entry: McpToolCatalogEntry): string[] {
  const all = Object.keys(entry.inputSchema.properties ?? {});
  const required = new Set(entry.inputSchema.required ?? []);
  return [...all.filter((n) => required.has(n)), ...all.filter((n) => !required.has(n))];
}
