import type { ObjectSchema } from "../utils/toolSchema.js";

/*
 * The tool entry shape and its constructor (#669 / core-refactor C2, split out
 * of tools.ts by #895).
 *
 * One entry per tool, holding everything that tool needs: its name, the schema
 * Claude Code reads at connect time, and the handler that runs it. Adding a
 * tool used to mean editing three places nothing tied together — an import,
 * the TOOLS array and a `switch` case — and forgetting the third shipped a
 * tool that advertised itself and then answered "Unknown tool".
 *
 * This module holds no tools of its own. It sits below `tools/<domain>.ts` so
 * every domain file can import the constructor without importing a sibling
 * domain — the reason `tools.ts` can now be a composition file.
 */

export type ToolArgs = Record<string, unknown>;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ObjectSchema;
  run: (args: ToolArgs) => Promise<unknown>;
}

/**
 * Bind a handler to its schema. The type parameter keeps each handler's own
 * argument type on the entry, and confines the JSON→typed cast that
 * `callTool` used to repeat once per tool to this single line — sound now
 * because `callTool` validates the arguments against `inputSchema` first.
 */
export function defineTool<A>(def: {
  name: string;
  description: string;
  inputSchema: ObjectSchema;
  handler: (args: A) => Promise<unknown>;
}): ToolDefinition {
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    run: (args) => def.handler(args as unknown as A),
  };
}
