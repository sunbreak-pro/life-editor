import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  listTasks,
  getTask,
  getTaskTree,
  createTask,
  updateTask,
  deleteTask,
} from "./handlers/taskHandlers.js";
import { getMemo, upsertMemo } from "./handlers/memoHandlers.js";
import { listNotes, createNote, updateNote } from "./handlers/noteHandlers.js";
import { listSchedule } from "./handlers/scheduleHandlers.js";
import { searchAll } from "./handlers/searchHandlers.js";
import { generateContent, formatContent } from "./handlers/contentHandlers.js";
import {
  listWikiTags,
  tagEntity,
  searchByTag,
  getEntityTags,
} from "./handlers/wikiTagHandlers.js";
export const TOOLS: Tool[] = [
  {
    name: "list_tasks",
    description:
      "List tasks. Optionally filter by status (not_started/in_progress/done), date_range, or folder_id.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["not_started", "in_progress", "done"],
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
          enum: ["not_started", "in_progress", "done"],
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
        color: {
          type: "string",
          description: "Note icon color (hex, e.g. #E8D5F5)",
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
  {
    name: "generate_content",
    description:
      "Generate structured rich content (headings, lists, callouts, code blocks, tables, etc.) for a note or memo. Use this to create well-formatted documents with complex structure.",
    inputSchema: {
      type: "object" as const,
      properties: {
        target: {
          type: "string",
          enum: ["note", "memo"],
          description: "Target entity type",
        },
        target_id: {
          type: "string",
          description: "Existing note/memo ID to update (omit to create new)",
        },
        target_date: {
          type: "string",
          description: "Date for memo (YYYY-MM-DD). Defaults to today.",
        },
        title: {
          type: "string",
          description: "Title for new note",
        },
        structure: {
          type: "array",
          description:
            "Array of content blocks. Each block has a 'type' and type-specific fields.",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: [
                  "heading",
                  "paragraph",
                  "bulletList",
                  "orderedList",
                  "taskList",
                  "toggleList",
                  "callout",
                  "codeBlock",
                  "blockquote",
                  "horizontalRule",
                  "table",
                ],
                description: "Block type",
              },
              level: {
                type: "number",
                description: "Heading level (1-3)",
              },
              fontSize: {
                type: "string",
                description: "Custom font size (e.g. '32px')",
              },
              text: {
                type: "string",
                description:
                  "Text content for heading, paragraph, callout, blockquote",
              },
              items: {
                type: "array",
                items: { type: "string" },
                description: "List items for bulletList/orderedList",
              },
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    checked: { type: "boolean" },
                  },
                  required: ["text", "checked"],
                },
                description: "Task items for taskList",
              },
              summary: {
                type: "string",
                description: "Toggle list summary text",
              },
              content: {
                type: "array",
                description:
                  "Nested content blocks (for toggleList, callout, blockquote)",
              },
              code: { type: "string", description: "Code content" },
              language: {
                type: "string",
                description: "Code language (e.g. 'typescript')",
              },
              color: {
                type: "string",
                enum: ["default", "blue", "green", "yellow", "red", "purple"],
                description: "Callout color",
              },
              iconName: {
                type: "string",
                description:
                  "Callout icon name (Lucide icon, e.g. 'Lightbulb')",
              },
              headers: {
                type: "array",
                items: { type: "string" },
                description: "Table header cells",
              },
              rows: {
                type: "array",
                items: {
                  type: "array",
                  items: { type: "string" },
                },
                description: "Table data rows",
              },
            },
            required: ["type"],
          },
        },
      },
      required: ["target", "structure"],
    },
  },
  {
    name: "list_wiki_tags",
    description:
      "List all wiki tags. Tags are cross-domain labels that connect tasks, memos, and notes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Filter by tag name (optional)",
        },
      },
    },
  },
  {
    name: "tag_entity",
    description:
      "Assign a wiki tag to a task, memo, or note. Creates the tag if it doesn't exist.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tag_name: { type: "string", description: "Tag name" },
        entity_id: { type: "string", description: "Entity ID" },
        entity_type: {
          type: "string",
          enum: ["task", "memo", "note"],
          description: "Entity type",
        },
      },
      required: ["tag_name", "entity_id", "entity_type"],
    },
  },
  {
    name: "search_by_tag",
    description: "Search for tasks, memos, and notes by wiki tag name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tag_name: { type: "string", description: "Tag name to search" },
        entity_type: {
          type: "string",
          enum: ["task", "memo", "note"],
          description: "Filter by entity type (optional)",
        },
      },
      required: ["tag_name"],
    },
  },
  {
    name: "get_task_tree",
    description:
      "Get tasks as a hierarchical tree structure. Returns folders and tasks with their children, tags, and metadata (excludes content — use get_task for full content).",
    inputSchema: {
      type: "object" as const,
      properties: {
        root_id: {
          type: "string",
          description:
            "Folder/task ID to use as root (returns subtree). Omit for full tree.",
        },
        include_done: {
          type: "boolean",
          description:
            "Include completed tasks (default: true). Folders are always included.",
        },
        max_depth: {
          type: "number",
          description:
            "Maximum tree depth (default: unlimited). 0 = root only, 1 = root + direct children, etc.",
        },
      },
    },
  },
  {
    name: "get_entity_tags",
    description:
      "Get all wiki tags assigned to a specific entity (task, memo, or note).",
    inputSchema: {
      type: "object" as const,
      properties: {
        entity_id: {
          type: "string",
          description: "Entity ID (task, memo, or note)",
        },
      },
      required: ["entity_id"],
    },
  },
  {
    name: "format_content",
    description:
      "Read and restructure existing note/memo content. Supports wrapping in callout/toggle, adding headings, inserting blocks, or replacing all content.",
    inputSchema: {
      type: "object" as const,
      properties: {
        target: {
          type: "string",
          enum: ["note", "memo"],
          description: "Target entity type",
        },
        target_id: {
          type: "string",
          description: "Note ID (required for notes)",
        },
        target_date: {
          type: "string",
          description: "Memo date (YYYY-MM-DD)",
        },
        operations: {
          type: "array",
          description: "Operations to apply to content",
          items: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: [
                  "wrap_callout",
                  "wrap_toggle",
                  "add_heading",
                  "insert_block",
                  "replace_all",
                ],
                description: "Operation type",
              },
              iconName: { type: "string", description: "Icon for callout" },
              color: { type: "string", description: "Color for callout" },
              summary: {
                type: "string",
                description: "Summary for toggle",
              },
              level: { type: "number", description: "Heading level" },
              text: { type: "string", description: "Text content" },
              fontSize: { type: "string", description: "Font size" },
              position: {
                type: "string",
                enum: ["start", "end"],
                description: "Where to add heading",
              },
              block: {
                type: "object",
                description: "Content block to insert",
              },
              structure: {
                type: "array",
                description: "Full content structure for replace_all",
              },
            },
            required: ["action"],
          },
        },
      },
      required: ["target", "operations"],
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
    case "generate_content":
      result = generateContent(
        args as unknown as Parameters<typeof generateContent>[0],
      );
      break;
    case "list_wiki_tags":
      result = listWikiTags(args as Parameters<typeof listWikiTags>[0]);
      break;
    case "tag_entity":
      result = tagEntity(args as Parameters<typeof tagEntity>[0]);
      break;
    case "search_by_tag":
      result = searchByTag(args as Parameters<typeof searchByTag>[0]);
      break;
    case "get_task_tree":
      result = getTaskTree(args as Parameters<typeof getTaskTree>[0]);
      break;
    case "get_entity_tags":
      result = getEntityTags(args as Parameters<typeof getEntityTags>[0]);
      break;
    case "format_content":
      result = formatContent(
        args as unknown as Parameters<typeof formatContent>[0],
      );
      break;
    default:
      throw new Error(`Unknown tool: ${name}`);
  }

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}
