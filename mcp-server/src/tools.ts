import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolArgs, ToolDefinition } from "./tools/defineTool.js";
import { buildRegistry } from "./registry.js";
import { REMOTE_TOOL_DEFINITIONS } from "./remoteTools.js";
import { VERIFICATION_TOOLS } from "./tools/verification.js";

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
 *
 * The composition is now in two pieces (Remote MCP work — plan:
 * .claude/docs/vision/plans/2026-09-09-remote-mcp-mobile.md). Everything
 * portable lives in `remoteTools.ts`, which the Cloudflare Worker serves as
 * is; THIS list is that one plus the verification domain, which only a local
 * process can run (it keeps a ledger on disk). Adding a domain therefore means
 * editing `remoteTools.ts`, not this file — and it reaches both transports.
 * `tests/remoteRegistry.test.ts` pins the difference to exactly the
 * verification tools, so a new domain landing in the wrong file fails there.
 */
const TOOL_DEFINITIONS: ToolDefinition[] = [
  ...REMOTE_TOOL_DEFINITIONS,
  ...VERIFICATION_TOOLS,
];

const registry = buildRegistry(TOOL_DEFINITIONS);

/** The ListTools response — same names, descriptions and schemas as ever. */
export const TOOLS: Tool[] = registry.tools;

export async function callTool(
  name: string,
  args: ToolArgs,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  return registry.call(name, args);
}
