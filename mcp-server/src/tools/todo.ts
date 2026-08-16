import { defineTool, type ToolDefinition } from "./defineTool.js";
import {
  listTodos,
  getTodo,
  getTodoTree,
  createTodo,
  updateTodo,
  deleteTodo,
} from "../handlers/todoHandlers.js";

/**
 * Todos tools (#895). One file per handler domain, so adding a tool
 * touches only its own domain instead of the middle of a 1,120-line array.
 */
export const TODO_TOOLS: ToolDefinition[] = [
  defineTool({
    name: "list_todos",
    description:
      "List todos. Optionally filter by status (not_started/done), date_range, or parent_id. " +
      "Returns { todos, total, hasMore }: each entry carries a short contentPreview, not the whole body. " +
      "Use get_todo for one todo's full content, or include_content:true to get every body in the page.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["not_started", "done"],
          description: "Filter by todo status",
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
        // Same concept and same name as create_todo's `parent_id` below. It
        // was called `folder_id` until #419 — a leftover from the retired
        // folder node type (#225) that never matched what it filters on
        // (tasks_payload.parent_item_id).
        parent_id: {
          type: "string",
          description: "Filter by parent todo ID",
        },
        include_content: {
          type: "boolean",
          description:
            "Return each todo's full body alongside the preview (default: false). Costly — prefer get_todo.",
        },
        limit: {
          type: "number",
          description:
            "Max todos to return (default: 50). The result reports total and hasMore, so nothing is dropped silently.",
        },
      },
    },
    handler: listTodos,
  }),

  defineTool({
    name: "get_todo",
    description:
      "Get a single todo by ID, with its full body. `content` is TipTap JSON (what the editor stores); " +
      "`contentText` is the same body as plain text — edit that one and write it back via update_todo, which takes Markdown.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Todo ID" },
      },
      required: ["id"],
    },
    handler: getTodo,
  }),

  defineTool({
    name: "get_todo_tree",
    description:
      "Get todos as a hierarchical tree structure. Returns todos with their children, tags, and metadata (excludes content — use get_todo for full content).",
    inputSchema: {
      type: "object" as const,
      properties: {
        root_id: {
          type: "string",
          description:
            "Todo ID to use as root (returns subtree). Omit for full tree.",
        },
        include_done: {
          type: "boolean",
          description: "Include completed todos (default: true).",
        },
        max_depth: {
          type: "number",
          description:
            "Maximum tree depth (default: unlimited). 0 = root only, 1 = root + direct children, etc.",
        },
      },
    },
    handler: getTodoTree,
  }),

  defineTool({
    name: "create_todo",
    description:
      "Create a new todo, body and status included — no follow-up update_todo needed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Todo title" },
        parent_id: {
          type: "string",
          description: "Parent todo ID (optional)",
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
        status: {
          type: "string",
          enum: ["not_started", "done"],
          description: "Initial status (default: not_started)",
        },
        content: {
          type: "string",
          description:
            "Markdown content (# headings, **bold**, *italic*, - lists, - [ ] tasks, > quotes, ```code```, > [!NOTE] callouts). For toggle lists, tables, or complex layouts, use generate_content instead.",
        },
      },
      required: ["title"],
    },
    handler: createTodo,
  }),

  defineTool({
    name: "update_todo",
    description:
      "Update an existing todo. Only provide fields you want to change.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Todo ID" },
        title: { type: "string", description: "New title" },
        status: {
          type: "string",
          enum: ["not_started", "done"],
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
            "Markdown content (# headings, **bold**, *italic*, - lists, - [ ] tasks, > quotes, ```code```, > [!NOTE] callouts). For toggle lists, tables, or complex layouts, use generate_content instead.",
        },
        // The handler has always written this column; it was simply missing
        // from the schema, so the only caller that reads this schema could
        // not know the field existed (#702 ③).
        time_memo: {
          type: "string",
          description:
            "Free-text note about timing (e.g. '朝イチ', '30分'). Pass null to clear it.",
        },
      },
      required: ["id"],
    },
    handler: updateTodo,
  }),

  defineTool({
    name: "delete_todo",
    description: "Soft-delete a todo (moves to trash). Undo with restore_item.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Todo ID" },
      },
      required: ["id"],
    },
    handler: deleteTodo,
  }),
];
