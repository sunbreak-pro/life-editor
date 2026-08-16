import { defineTool, type ToolDefinition } from "./defineTool.js";
import {
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
} from "../handlers/noteHandlers.js";

/**
 * Notes tools (#895). One file per handler domain, so adding a tool
 * touches only its own domain instead of the middle of a 1,120-line array.
 */
export const NOTE_TOOLS: ToolDefinition[] = [
  defineTool({
    name: "list_notes",
    description:
      "List notes, optionally filtered by a search query. " +
      "Returns { notes, total, hasMore }: each entry carries a short contentPreview, not the whole body. " +
      "Use get_note for one note's full content, or include_content:true to get every body in the page.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query (matches title and content)",
        },
        include_content: {
          type: "boolean",
          description:
            "Return each note's full body alongside the preview (default: false). Costly — prefer get_note.",
        },
        limit: {
          type: "number",
          description:
            "Max notes to return (default: 50). The result reports total and hasMore, so nothing is dropped silently.",
        },
      },
    },
    handler: listNotes,
  }),

  defineTool({
    name: "get_note",
    description:
      "Get a single note by ID, with its full body. `content` is TipTap JSON (what the editor stores); " +
      "`contentText` is the same body as plain text — edit that one and write it back via update_note, which takes Markdown.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Note ID" },
      },
      required: ["id"],
    },
    handler: getNote,
  }),

  defineTool({
    name: "create_note",
    description: "Create a new note.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Note title" },
        content: {
          type: "string",
          description:
            "Markdown content (# headings, **bold**, *italic*, - lists, - [ ] tasks, > quotes, ```code```, > [!NOTE] callouts). For toggle lists, tables, or complex layouts, use generate_content instead.",
        },
      },
      required: ["title"],
    },
    handler: createNote,
  }),

  defineTool({
    name: "update_note",
    description:
      "Update an existing note. Only provide fields you want to change.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Note ID" },
        title: { type: "string", description: "New title" },
        content: {
          type: "string",
          description:
            "Markdown content (# headings, **bold**, *italic*, - lists, - [ ] tasks, > quotes, ```code```, > [!NOTE] callouts). For toggle lists, tables, or complex layouts, use generate_content instead.",
        },
        color: {
          type: "string",
          description: "Note icon color (hex, e.g. #E8D5F5)",
        },
        is_pinned: {
          type: "boolean",
          description: "Pin the note to the top of the list",
        },
      },
      required: ["id"],
    },
    handler: updateNote,
  }),

  defineTool({
    name: "delete_note",
    description: "Soft-delete a note (moves to trash). Undo with restore_item.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Note ID" },
      },
      required: ["id"],
    },
    handler: deleteNote,
  }),
];
