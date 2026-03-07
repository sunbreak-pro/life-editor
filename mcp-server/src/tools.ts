import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
} from "./handlers/taskHandlers.js";
import { getMemo, upsertMemo } from "./handlers/memoHandlers.js";
import { listNotes, createNote, updateNote } from "./handlers/noteHandlers.js";
import { listSchedule } from "./handlers/scheduleHandlers.js";
import { searchAll } from "./handlers/searchHandlers.js";

export const TOOLS: Tool[] = [
  {
    name: "list_tasks",
    description:
      "List tasks. Optionally filter by status (todo/in_progress/done), date_range, or folder_id.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["todo", "in_progress", "done"],
          description: "Filter by task status",
        },
        date_range: {
          type: "object",
          properties: {
            start: { type: "string", description: "Start date (ISO 8601)" },
            end: { type: "string", description: "End date (ISO 8601)" },
          },
          required: ["start", "end"],
          description: "Filter by scheduled date range",
        },
        folder_id: {
          type: "string",
          description: "Filter by parent folder ID",
        },
      },
    },
  },
  {
    name: "get_task",
    description: "Get a single task by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Task ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_task",
    description: "Create a new task.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Task title" },
        parent_id: {
          type: "string",
          description: "Parent folder ID (optional)",
        },
        scheduled_at: {
          type: "string",
          description: "Scheduled start (ISO 8601)",
        },
        scheduled_end_at: {
          type: "string",
          description: "Scheduled end (ISO 8601)",
        },
        is_all_day: { type: "boolean", description: "All-day event" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description:
      "Update an existing task. Only provide fields you want to change.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Task ID" },
        title: { type: "string", description: "New title" },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "done"],
          description: "New status",
        },
        scheduled_at: {
          type: "string",
          description: "New scheduled start (ISO 8601)",
        },
        scheduled_end_at: {
          type: "string",
          description: "New scheduled end (ISO 8601)",
        },
        content: {
          type: "string",
          description:
            "New content (plain text, will be converted to TipTap JSON)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_task",
    description: "Soft-delete a task (moves to trash).",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Task ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_memo",
    description: "Get the daily memo for a specific date.",
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
  },
  {
    name: "upsert_memo",
    description:
      "Create or update a daily memo. Content is plain text and will be converted to TipTap JSON.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format",
        },
        content: { type: "string", description: "Memo content (plain text)" },
      },
      required: ["date", "content"],
    },
  },
  {
    name: "list_notes",
    description: "List all notes, optionally filtered by a search query.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query (matches title and content)",
        },
      },
    },
  },
  {
    name: "create_note",
    description: "Create a new note.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Note title" },
        content: {
          type: "string",
          description:
            "Note content (plain text, will be converted to TipTap JSON)",
        },
      },
      required: ["title"],
    },
  },
  {
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
            "New content (plain text, will be converted to TipTap JSON)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "list_schedule",
    description: "List schedule items and scheduled tasks for a specific date.",
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
  },
  {
    name: "search_all",
    description:
      "Search across tasks, memos, and notes. Use this to find information across all domains.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search keyword (matches title and content via LIKE)",
        },
        domains: {
          type: "array",
          items: {
            type: "string",
            enum: ["tasks", "memos", "notes"],
          },
          description:
            "Domains to search (default: all). Example: ['tasks', 'notes']",
        },
        limit: {
          type: "number",
          description: "Max results per domain (default: 10)",
        },
      },
      required: ["query"],
    },
  },
];

type ToolArgs = Record<string, unknown>;

export function callTool(
  name: string,
  args: ToolArgs,
): { content: Array<{ type: "text"; text: string }> } {
  let result: unknown;

  switch (name) {
    case "list_tasks":
      result = listTasks(args as Parameters<typeof listTasks>[0]);
      break;
    case "get_task":
      result = getTask(args as Parameters<typeof getTask>[0]);
      break;
    case "create_task":
      result = createTask(args as Parameters<typeof createTask>[0]);
      break;
    case "update_task":
      result = updateTask(args as Parameters<typeof updateTask>[0]);
      break;
    case "delete_task":
      result = deleteTask(args as Parameters<typeof deleteTask>[0]);
      break;
    case "get_memo":
      result = getMemo(args as Parameters<typeof getMemo>[0]);
      break;
    case "upsert_memo":
      result = upsertMemo(args as Parameters<typeof upsertMemo>[0]);
      break;
    case "list_notes":
      result = listNotes(args as Parameters<typeof listNotes>[0]);
      break;
    case "create_note":
      result = createNote(args as Parameters<typeof createNote>[0]);
      break;
    case "update_note":
      result = updateNote(args as Parameters<typeof updateNote>[0]);
      break;
    case "list_schedule":
      result = listSchedule(args as Parameters<typeof listSchedule>[0]);
      break;
    case "search_all":
      result = searchAll(args as Parameters<typeof searchAll>[0]);
      break;
    default:
      throw new Error(`Unknown tool: ${name}`);
  }

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}
