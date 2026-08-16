import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolArgs, ToolDefinition } from "./tools/defineTool.js";
import { TODO_TOOLS } from "./tools/todo.js";
import { DAILY_TOOLS } from "./tools/daily.js";
import { NOTE_TOOLS } from "./tools/note.js";
import { NOTE_CONTEXT_TOOLS } from "./tools/noteContext.js";
import { SCHEDULE_TOOLS } from "./tools/schedule.js";
import { BRIEFING_TOOLS } from "./tools/briefing.js";
import { SEARCH_TOOLS } from "./tools/search.js";
import { CONTENT_TOOLS } from "./tools/content.js";
import { WIKI_TAG_TOOLS } from "./tools/wikiTag.js";
import { TRASH_TOOLS } from "./tools/trash.js";
import { VERIFICATION_TOOLS } from "./tools/verification.js";
import { validateToolArgs, unknownArgNames } from "./utils/toolSchema.js";

/*
 * The tool registry (#669 / core-refactor C2), split by domain in #895.
 *
 * #669 made this a declarative registry: `TOOLS` (the ListTools response) and
 * the dispatch table are both derived from one array, so they cannot drift
 * apart. What it left behind was 986 of these 1,120 lines being that single
 * array. The handlers had been in `handlers/` — eleven files on domain lines —
 * since well before that, so adding a tool meant editing the middle of the
 * longest file in the package, and two branches doing it at once conflicted
 * every time.
 *
 * The definitions now live beside their handlers, one `tools/<domain>.ts` per
 * `handlers/<domain>Handlers.ts`, and this file only composes them. The pairing
 * is not a convention anyone has to remember: `tests/toolDomains.test.ts` fails
 * if a domain gains a tools file without a handlers file or the other way
 * round.
 *
 * The registry's own guarantees are unchanged — same names, same schemas, same
 * dispatch, same argument validation. Only the array's ORDER changed, since it
 * is now domain by domain rather than the order tools happened to be added;
 * nothing reads it positionally (`TOOLS` is looked up by name).
 */

const TOOL_DEFINITIONS: ToolDefinition[] = [
  ...TODO_TOOLS,
  ...DAILY_TOOLS,
  ...NOTE_TOOLS,
  ...NOTE_CONTEXT_TOOLS,
  ...SCHEDULE_TOOLS,
  ...BRIEFING_TOOLS,
  ...SEARCH_TOOLS,
  ...CONTENT_TOOLS,
  ...WIKI_TAG_TOOLS,
  ...TRASH_TOOLS,
  ...VERIFICATION_TOOLS,
];

/** The ListTools response — same names, descriptions and schemas as ever. */
export const TOOLS: Tool[] = TOOL_DEFINITIONS.map((def) => ({
  name: def.name,
  description: def.description,
  inputSchema: def.inputSchema,
}));

const BY_NAME = new Map(TOOL_DEFINITIONS.map((def) => [def.name, def]));

export async function callTool(
  name: string,
  args: ToolArgs,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const def = BY_NAME.get(name);
  if (!def) throw new Error(`Unknown tool: ${name}`);

  // Validate before dispatch: an argument the schema does not allow must not
  // reach a handler, where it would become a Supabase error or a bad write.
  validateToolArgs(name, def.inputSchema, args);
  const ignored = unknownArgNames(def.inputSchema, args);
  const result = await def.run(args);

  const content: Array<{ type: "text"; text: string }> = [
    { type: "text", text: JSON.stringify(result, null, 2) },
  ];

  // #702 ②: an undeclared argument is accepted by the validator and then read
  // by nobody. Left unsaid, a misremembered name looks exactly like a
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
}
