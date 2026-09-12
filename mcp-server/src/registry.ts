import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolArgs, ToolDefinition } from "./tools/defineTool.js";
import { validateToolArgs, unknownArgNames } from "./utils/toolSchema.js";

/*
 * The registry constructor, lifted out of tools.ts by the Remote MCP work
 * (plan: .claude/docs/vision/plans/2026-09-09-remote-mcp-mobile.md).
 *
 * `tools.ts` used to hold both the composition ("which domains does this
 * server publish?") and the mechanism ("how is a call validated and
 * dispatched?"). There are now TWO compositions — the stdio server publishes
 * every domain, the Worker publishes every domain except verification, whose
 * ledger needs a filesystem Workers does not have — and only one mechanism.
 *
 * Keeping the mechanism here means the two registries cannot drift in the way
 * that would matter: argument validation, the unknown-argument note (#702 ②)
 * and the "Unknown tool" error are the same code for both transports, so a
 * fix to any of them reaches the phone and the desktop at once.
 */

export interface ToolRegistry {
  /** The ListTools response — name, description and schema per tool. */
  tools: Tool[];
  /** Validate and dispatch one call. Same contract as the old `callTool`. */
  call(
    name: string,
    args: ToolArgs,
  ): Promise<{ content: Array<{ type: "text"; text: string }> }>;
}

export function buildRegistry(definitions: ToolDefinition[]): ToolRegistry {
  const tools: Tool[] = definitions.map((def) => ({
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
  }));

  const byName = new Map(definitions.map((def) => [def.name, def]));

  return {
    tools,
    async call(name, args) {
      const def = byName.get(name);
      if (!def) throw new Error(`Unknown tool: ${name}`);

      // Validate before dispatch: an argument the schema does not allow must
      // not reach a handler, where it would become a Supabase error or a bad
      // write.
      validateToolArgs(name, def.inputSchema, args);
      const ignored = unknownArgNames(def.inputSchema, args);
      const result = await def.run(args);

      const content: Array<{ type: "text"; text: string }> = [
        { type: "text", text: JSON.stringify(result, null, 2) },
      ];

      // #702 ②: an undeclared argument is accepted by the validator and then
      // read by nobody. Left unsaid, a misremembered name looks exactly like a
      // successful edit — so say it, next to the result it did not affect.
      if (ignored.length > 0) {
        content.push({
          type: "text",
          text:
            `Note: ${name} does not accept ${ignored.join(", ")}. ` +
            `Nothing was applied for ${ignored.length === 1 ? "it" : "them"} — ` +
            `check this tool's schema for the argument you meant.`,
        });
      }

      return { content };
    },
  };
}
