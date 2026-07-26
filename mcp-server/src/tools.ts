import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  listTasks,
  getTask,
  getTaskTree,
  createTask,
  updateTask,
  deleteTask,
} from "./handlers/taskHandlers.js";
import { getDaily, upsertDaily } from "./handlers/dailyHandlers.js";
import { listNotes, createNote, updateNote } from "./handlers/noteHandlers.js";
import {
  listSchedule,
  createScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
  toggleScheduleComplete,
  dismissScheduleItem,
  undismissScheduleItem,
} from "./handlers/scheduleHandlers.js";
import { getTodayContext, writeBriefing } from "./handlers/briefingHandlers.js";
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
          description: "Filter by parent task ID",
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
          description: "Parent task ID (optional)",
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
            "Markdown content (# headings, **bold**, *italic*, - lists, - [ ] tasks, > quotes, ```code```, > [!NOTE] callouts). For toggle lists, tables, or complex layouts, use generate_content instead.",
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
    name: "get_daily",
    description: "Get the daily entry for a specific date.",
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
            "Markdown content (# headings, **bold**, *italic*, - lists, - [ ] tasks, > quotes, ```code```, > [!NOTE] callouts). For toggle lists, tables, or complex layouts, use generate_content instead.",
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
            "Markdown content (# headings, **bold**, *italic*, - lists, - [ ] tasks, > quotes, ```code```, > [!NOTE] callouts). For toggle lists, tables, or complex layouts, use generate_content instead.",
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
    description:
      "List schedule items and scheduled tasks for a specific date or date range.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "Single date in YYYY-MM-DD format",
        },
        start_date: {
          type: "string",
          description:
            "Range start date (YYYY-MM-DD). Use with end_date instead of date.",
        },
        end_date: {
          type: "string",
          description: "Range end date (YYYY-MM-DD). Use with start_date.",
        },
      },
    },
  },
  {
    name: "create_schedule_item",
    description:
      "Create a new schedule item (event) on the calendar. For routine-based items, use tasks instead.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format",
        },
        title: { type: "string", description: "Event title" },
        start_time: {
          type: "string",
          description: "Start time in HH:MM format",
        },
        end_time: {
          type: "string",
          description: "End time in HH:MM format",
        },
        is_all_day: {
          type: "boolean",
          description: "All-day event (default: false)",
        },
        memo: {
          type: "string",
          description: "Plain-text memo attached to the event",
        },
      },
      required: ["date", "title", "start_time", "end_time"],
    },
  },
  {
    name: "update_schedule_item",
    description:
      "Update an existing schedule item. Only provide fields you want to change.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Schedule item ID" },
        title: { type: "string", description: "New title" },
        date: {
          type: "string",
          description: "New date (YYYY-MM-DD) — moves the event",
        },
        start_time: {
          type: "string",
          description: "New start time (HH:MM)",
        },
        end_time: {
          type: "string",
          description: "New end time (HH:MM)",
        },
        memo: { type: "string", description: "Memo/notes about the item" },
        is_all_day: { type: "boolean", description: "All-day event flag" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_schedule_item",
    description:
      "Soft-delete a schedule item (moves it to trash; restorable from the Trash view).",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Schedule item ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "toggle_schedule_complete",
    description: "Toggle the completion status of a schedule item.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Schedule item ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "dismiss_schedule_item",
    description:
      "Hide a schedule item from list/calendar views without deleting it. Used to skip routine occurrences for a given day.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Schedule item ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "undismiss_schedule_item",
    description:
      "Restore a previously dismissed schedule item so it appears in views again.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Schedule item ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_today_context",
    description:
      "Get everything needed to write the morning briefing (朝刊) in one call: today's events, tasks scheduled onto today, open tasks (due today / overdue carry-overs / in-progress), the last 3 days of daily notes (夕刊 material), and whether today's daily already has a briefing section.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description:
            "Target date in YYYY-MM-DD (default: today in local time)",
        },
      },
    },
  },
  {
    name: "write_briefing",
    description:
      "Write the morning briefing (朝刊) into the daily note for a date. Upserts a '朝刊' heading section at the top of the DailyNode content: paragraph 1 = the focus line (今日のフォーカス), following paragraphs = the AI comment body. An existing 朝刊 section is replaced; all other daily content (e.g. the 夕刊 section) is preserved. Creates the daily if it does not exist yet.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description:
            "Target date in YYYY-MM-DD (default: today in local time)",
        },
        focus: {
          type: "string",
          description: "The focus line — one short sentence, rendered large",
        },
        paragraphs: {
          type: "array",
          items: { type: "string" },
          description:
            "Comment body paragraphs (yesterday's review, priorities, encouragement, etc.)",
        },
      },
      required: ["focus"],
    },
  },
  {
    name: "search_all",
    description:
      "Search across tasks, dailies, and notes. Use this to find information across all domains.",
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
            enum: ["tasks", "dailies", "notes"],
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
      "PREFERRED tool for creating rich content in notes or dailies. Supports headings, lists, toggle lists, callouts, code blocks, tables, and nested structures. Use this instead of create_note/upsert_daily when you need formatted output.",
    inputSchema: {
      type: "object" as const,
      properties: {
        target: {
          type: "string",
          enum: ["note", "daily"],
          description: "Target entity type",
        },
        target_id: {
          type: "string",
          description:
            "Existing note ID to update (omit to create a new note). Dailies are addressed by target_date instead.",
        },
        target_date: {
          type: "string",
          description: "Date for daily (YYYY-MM-DD). Defaults to today.",
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
      "List all wiki tags. Tags are cross-domain labels that connect tasks, dailies, and notes.",
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
      "Assign a wiki tag to a task, daily, or note. Creates the tag if it doesn't exist.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tag_name: { type: "string", description: "Tag name" },
        entity_id: { type: "string", description: "Entity ID" },
        entity_type: {
          type: "string",
          enum: ["task", "daily", "note"],
          description:
            "Entity type (optional). The real type is read from the item; supplying it asserts the item is of that type.",
        },
      },
      required: ["tag_name", "entity_id"],
    },
  },
  {
    name: "search_by_tag",
    description: "Search for tasks, dailies, and notes by wiki tag name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tag_name: { type: "string", description: "Tag name to search" },
        entity_type: {
          type: "string",
          enum: ["task", "daily", "note"],
          description: "Filter by entity type (optional)",
        },
      },
      required: ["tag_name"],
    },
  },
  {
    name: "get_task_tree",
    description:
      "Get tasks as a hierarchical tree structure. Returns tasks with their children, tags, and metadata (excludes content — use get_task for full content).",
    inputSchema: {
      type: "object" as const,
      properties: {
        root_id: {
          type: "string",
          description:
            "Task ID to use as root (returns subtree). Omit for full tree.",
        },
        include_done: {
          type: "boolean",
          description: "Include completed tasks (default: true).",
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
      "Get all wiki tags assigned to a specific entity (task, daily, or note).",
    inputSchema: {
      type: "object" as const,
      properties: {
        entity_id: {
          type: "string",
          description: "Entity ID (task, daily, or note)",
        },
      },
      required: ["entity_id"],
    },
  },
  {
    name: "format_content",
    description:
      "Read and restructure existing note/daily content. Supports wrapping in callout/toggle, adding headings, inserting blocks, or replacing all content.",
    inputSchema: {
      type: "object" as const,
      properties: {
        target: {
          type: "string",
          enum: ["note", "daily"],
          description: "Target entity type",
        },
        target_id: {
          type: "string",
          description: "Note ID (required when target is note)",
        },
        target_date: {
          type: "string",
          description: "Daily date (YYYY-MM-DD)",
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

export async function callTool(
  name: string,
  args: ToolArgs,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  let result: unknown;

  switch (name) {
    case "list_tasks":
      result = await listTasks(args as Parameters<typeof listTasks>[0]);
      break;
    case "get_task":
      result = await getTask(args as Parameters<typeof getTask>[0]);
      break;
    case "create_task":
      result = await createTask(args as Parameters<typeof createTask>[0]);
      break;
    case "update_task":
      result = await updateTask(args as Parameters<typeof updateTask>[0]);
      break;
    case "delete_task":
      result = await deleteTask(args as Parameters<typeof deleteTask>[0]);
      break;
    case "get_daily":
      result = await getDaily(args as Parameters<typeof getDaily>[0]);
      break;
    case "upsert_daily":
      result = await upsertDaily(args as Parameters<typeof upsertDaily>[0]);
      break;
    case "list_notes":
      result = await listNotes(args as Parameters<typeof listNotes>[0]);
      break;
    case "create_note":
      result = await createNote(args as Parameters<typeof createNote>[0]);
      break;
    case "update_note":
      result = await updateNote(args as Parameters<typeof updateNote>[0]);
      break;
    case "list_schedule":
      result = await listSchedule(args as Parameters<typeof listSchedule>[0]);
      break;
    case "create_schedule_item":
      result = await createScheduleItem(
        args as Parameters<typeof createScheduleItem>[0],
      );
      break;
    case "update_schedule_item":
      result = await updateScheduleItem(
        args as Parameters<typeof updateScheduleItem>[0],
      );
      break;
    case "delete_schedule_item":
      result = await deleteScheduleItem(
        args as Parameters<typeof deleteScheduleItem>[0],
      );
      break;
    case "toggle_schedule_complete":
      result = await toggleScheduleComplete(
        args as Parameters<typeof toggleScheduleComplete>[0],
      );
      break;
    case "dismiss_schedule_item":
      result = await dismissScheduleItem(
        args as Parameters<typeof dismissScheduleItem>[0],
      );
      break;
    case "undismiss_schedule_item":
      result = await undismissScheduleItem(
        args as Parameters<typeof undismissScheduleItem>[0],
      );
      break;
    case "get_today_context":
      result = await getTodayContext(
        args as Parameters<typeof getTodayContext>[0],
      );
      break;
    case "write_briefing":
      result = await writeBriefing(args as Parameters<typeof writeBriefing>[0]);
      break;
    case "search_all":
      result = await searchAll(args as Parameters<typeof searchAll>[0]);
      break;
    case "generate_content":
      result = await generateContent(
        args as unknown as Parameters<typeof generateContent>[0],
      );
      break;
    case "list_wiki_tags":
      result = await listWikiTags(args as Parameters<typeof listWikiTags>[0]);
      break;
    case "tag_entity":
      result = await tagEntity(args as Parameters<typeof tagEntity>[0]);
      break;
    case "search_by_tag":
      result = await searchByTag(args as Parameters<typeof searchByTag>[0]);
      break;
    case "get_task_tree":
      result = await getTaskTree(args as Parameters<typeof getTaskTree>[0]);
      break;
    case "get_entity_tags":
      result = await getEntityTags(args as Parameters<typeof getEntityTags>[0]);
      break;
    case "format_content":
      result = await formatContent(
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
