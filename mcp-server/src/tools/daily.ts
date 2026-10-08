import { defineTool, type ToolDefinition } from "./defineTool.js";
import { getDaily, upsertDaily } from "../handlers/dailyHandlers.js";

/**
 * Daily tools (#895). One file per handler domain, so adding a tool
 * touches only its own domain instead of the middle of a 1,120-line array.
 */
export const DAILY_TOOLS: ToolDefinition[] = [
  defineTool({
    name: "get_daily",
    // A date with no daily and a date whose daily is in the trash both come
    // back with content: null, so the flags are the only way to tell them
    // apart (#782 ②).
    description:
      "Get the daily entry for a specific date. Returns exists (is there a readable daily), isTrashed (there is one, but it is in the trash — its body is withheld and writing to this date would restore it), morningComment (Claude's morning comment, kept beside the body rather than in it: the daily's `morning_comment` field, or the 朝刊 heading section of an older day's body; null when there is none) and hasBriefing (morningComment is not null; write_briefing would replace the field) alongside content. When exists is false or the day is locked, hasBriefing is false and morningComment is null — a trashed or locked day is not read.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format",
        },
      },
      required: ["date"],
    },
    handler: getDaily,
  }),

  defineTool({
    name: "upsert_daily",
    description:
      "Create or update a daily entry. Content is plain text and will be converted to TipTap JSON.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format",
        },
        content: {
          type: "string",
          description:
            "Markdown content (# headings, **bold**, *italic*, - lists, - [ ] tasks, > quotes, ```code```, > [!NOTE] callouts). For toggle lists, tables, or complex layouts, use generate_content instead.",
        },
      },
      required: ["date", "content"],
    },
    handler: upsertDaily,
  }),
];
