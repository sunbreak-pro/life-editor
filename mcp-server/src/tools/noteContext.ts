import { defineTool, type ToolDefinition } from "./defineTool.js";
import { getNoteContext } from "../handlers/noteContextHandlers.js";

/**
 * Note context tools (#895). One file per handler domain, so adding a tool
 * touches only its own domain instead of the middle of a 1,120-line array.
 */
export const NOTE_CONTEXT_TOOLS: ToolDefinition[] = [
  defineTool({
    name: "get_note_context",
    description:
      "Get everything needed to reorganise a note in one call: the note itself (content + contentText), its tags, and its WikiLink neighbours in both directions — links (this note points at them) and backlinks (they point at this note). Neighbours are id/role/title only; their bodies and tags are not included — follow up with get_note / get_todo by id for the ones you want to read.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Note ID" },
      },
      required: ["id"],
    },
    handler: getNoteContext,
  }),
];
