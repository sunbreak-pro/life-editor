import type { ToolDefinition } from "./tools/defineTool.js";
import { buildRegistry, type ToolRegistry } from "./registry.js";
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

/*
 * The tool set that runs ANYWHERE — the everyday domains, with nothing that
 * needs a local filesystem or a local process.
 *
 * This is the list, and `tools.ts` is this list plus the verification domain.
 * The direction matters: composing the stdio server out of the portable set
 * means a new domain file reaches BOTH transports by being spread here once.
 * Two hand-kept lists would let the phone quietly lack a tool the desktop has,
 * and nothing would say so — the only symptom is Claude being told the tool
 * does not exist.
 *
 * WHY VERIFICATION IS NOT HERE. `utils/verification.ts` keeps its ledger in a
 * JSON file next to the package (node:fs) so seeded rows survive a restart,
 * and the tools refuse to run unless the process was declared the verification
 * one. Neither premise survives on Cloudflare Workers: there is no writable
 * filesystem, and an isolate is not a process an operator can point at a
 * separate account. Importing the domain at all would also drag node:fs into
 * the Worker bundle. The tools are a development harness, so the phone loses
 * nothing it would ever ask for — but a lower-privilege remote surface is the
 * better half of the reason: the one tool set exposed to the public internet
 * is also the one that cannot seed or bulk-delete rows.
 */
export const REMOTE_TOOL_DEFINITIONS: ToolDefinition[] = [
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
];

/** The registry the Worker serves (ListTools + dispatch). */
export const remoteRegistry: ToolRegistry = buildRegistry(
  REMOTE_TOOL_DEFINITIONS,
);
