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
  setScheduleComplete,
  setScheduleDismissed,
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
import { validateToolArgs, type ObjectSchema } from "./utils/toolSchema.js";

/*
 * The tool registry (#669 / core-refactor C2).
 *
 * One entry per tool, holding everything that tool needs: its name, the
 * schema Claude Code reads at connect time, and the handler that runs it.
 * Adding a tool used to mean editing three places nothing tied together — an
 * import, the TOOLS array and a `switch` case — and forgetting the third
 * shipped a tool that advertised itself and then answered "Unknown tool".
 *
 * `TOOLS` (the ListTools response) and the dispatch table are both derived
 * from this one array, so they cannot drift apart.
 */

type ToolArgs = Record<string, unknown>;

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ObjectSchema;
  run: (args: ToolArgs) => Promise<unknown>;
}

/**
 * Bind a handler to its schema. The type parameter keeps each handler's own
 * argument type on the entry, and confines the JSON→typed cast that
 * `callTool` used to repeat once per tool to this single line — sound now
 * because `callTool` validates the arguments against `inputSchema` first.
 */
function defineTool<A>(def: {
  name: string;
  description: string;
  inputSchema: ObjectSchema;
  handler: (args: A) => Promise<unknown>;
}): ToolDefinition {
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    run: (args) => def.handler(args as unknown as A),
  };
}

const TOOL_DEFINITIONS: ToolDefinition[] = [
  defineTool({
    name: "list_tasks",
    description:
      "List tasks. Optionally filter by status (not_started/in_progress/done), date_range, or parent_id.",
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
        // Same concept and same name as create_task's `parent_id` below. It
        // was called `folder_id` until #419 — a leftover from the retired
        // folder node type (#225) that never matched what it filters on
        // (tasks_payload.parent_item_id).
        parent_id: {
          type: "string",
          description: "Filter by parent task ID",
        },
      },
    },
    handler: listTasks,
  }),
  defineTool({
    name: "get_task",
    description: "Get a single task by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Task ID" },
      },
      required: ["id"],
    },
    handler: getTask,
  }),
  defineTool({
    name: "create_task",
    description:
      "Create a new task, body and status included — no follow-up update_task needed.",
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
        status: {
          type: "string",
          enum: ["not_started", "in_progress", "done"],
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
    handler: createTask,
  }),
  defineTool({
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
    handler: updateTask,
  }),
  defineTool({
    name: "delete_task",
    description: "Soft-delete a task (moves to trash).",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Task ID" },
      },
      required: ["id"],
    },
    handler: deleteTask,
  }),
  defineTool({
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
  defineTool({
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
    handler: listNotes,
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
      },
      required: ["id"],
    },
    handler: updateNote,
  }),
  defineTool({
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
    handler: listSchedule,
  }),
  defineTool({
    name: "create_schedule_item",
    description:
      "Create a new schedule item (event) on the calendar. start_time and end_time are required unless is_all_day is true (an all-day event stores no times). For routine-based items, use tasks instead.",
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
          description:
            "Start time in HH:MM format. Required unless is_all_day is true, which stores no times.",
        },
        end_time: {
          type: "string",
          description:
            "End time in HH:MM format. Required unless is_all_day is true, which stores no times.",
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
      // start_time / end_time are conditionally required (see the handler):
      // this schema subset cannot express "unless is_all_day", and listing
      // them here would force a caller to invent two values the all-day path
      // throws away.
      required: ["date", "title"],
    },
    handler: createScheduleItem,
  }),
  defineTool({
    name: "update_schedule_item",
    description:
      "Update an existing schedule item. Only provide fields you want to change. Setting is_all_day true clears the times; setting it false requires times (supplied here or already stored).",
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
        is_all_day: {
          type: "boolean",
          description:
            "All-day event flag. true clears start_time/end_time; false needs both (from this call or already stored).",
        },
      },
      required: ["id"],
    },
    handler: updateScheduleItem,
  }),
  defineTool({
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
    handler: deleteScheduleItem,
  }),
  defineTool({
    name: "set_schedule_complete",
    description:
      "Set whether a schedule item is complete. Replaces toggle_schedule_complete: pass the state you want, so the outcome does not depend on the current value and calling twice does not undo it.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Schedule item ID" },
        completed: {
          type: "boolean",
          description: "true to mark it done, false to reopen it",
        },
      },
      required: ["id", "completed"],
    },
    handler: setScheduleComplete,
  }),
  defineTool({
    name: "set_schedule_dismissed",
    description:
      "Hide a schedule item from list/calendar views without deleting it, or bring it back. Used to skip routine occurrences for a given day. Replaces dismiss_schedule_item / undismiss_schedule_item.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Schedule item ID" },
        dismissed: {
          type: "boolean",
          description: "true to hide it, false to show it again",
        },
      },
      required: ["id", "dismissed"],
    },
    handler: setScheduleDismissed,
  }),
  defineTool({
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
    handler: getTodayContext,
  }),
  defineTool({
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
    handler: writeBriefing,
  }),
  defineTool({
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
    handler: searchAll,
  }),
  defineTool({
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
    handler: generateContent,
  }),
  defineTool({
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
    handler: listWikiTags,
  }),
  defineTool({
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
    handler: tagEntity,
  }),
  defineTool({
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
    handler: searchByTag,
  }),
  defineTool({
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
    handler: getTaskTree,
  }),
  defineTool({
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
    handler: getEntityTags,
  }),
  defineTool({
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
    handler: formatContent,
  }),
];

/** The ListTools response — same names, descriptions and schemas as ever. */
export const TOOLS: Tool[] = TOOL_DEFINITIONS.map((def) => ({
  name: def.name,
  description: def.description,
  inputSchema: def.inputSchema,
}));

const BY_NAME = new Map(TOOL_DEFINITIONS.map((def) => [def.name, def]));

export async function callTool(
  name: string,
  args: ToolArgs,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const def = BY_NAME.get(name);
  if (!def) throw new Error(`Unknown tool: ${name}`);

  // Validate before dispatch: an argument the schema does not allow must not
  // reach a handler, where it would become a Supabase error or a bad write.
  validateToolArgs(name, def.inputSchema, args);
  const result = await def.run(args);

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}
