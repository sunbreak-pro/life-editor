import { defineTool, type ToolDefinition } from "./defineTool.js";
import { searchAll } from "../handlers/searchHandlers.js";

/**
 * Search tools (#895). One file per handler domain, so adding a tool
 * touches only its own domain instead of the middle of a 1,120-line array.
 */
export const SEARCH_TOOLS: ToolDefinition[] = [
  defineTool({
    name: "search_all",
    description:
      "Search across todos, dailies, and notes. Use this to find information across all domains. Each requested domain answers as { results, total, hasMore }: total counts every match in that domain, results is the page cut by limit/offset, and hasMore says whether matches remain beyond it — page through with offset instead of re-searching with a bigger limit. totalHits is the sum of the per-domain totals. Daily hits carry the daily's id (the handle tag_entity / get_entity_tags take) as well as its date.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search keyword (case-insensitive substring match on title and content)",
        },
        domains: {
          type: "array",
          items: {
            type: "string",
            enum: ["todos", "dailies", "notes"],
          },
          description:
            "Domains to search (default: all). Example: ['todos', 'notes']",
        },
        limit: {
          type: "number",
          description:
            "Max results per domain (default: 10, positive integer). Each domain reports total and hasMore, so nothing is dropped silently.",
        },
        offset: {
          type: "number",
          description:
            "Rows to skip per domain (default: 0) — page with limit.",
        },
      },
      required: ["query"],
    },
    handler: searchAll,
  }),
];
