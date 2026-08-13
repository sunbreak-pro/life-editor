import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  listTodos,
  getTodo,
  getTodoTree,
  createTodo,
  updateTodo,
  deleteTodo,
} from "./handlers/todoHandlers.js";
import { getDaily, upsertDaily } from "./handlers/dailyHandlers.js";
import {
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
} from "./handlers/noteHandlers.js";
import {
  listSchedule,
  createScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
  setScheduleComplete,
  setScheduleDismissed,
} from "./handlers/scheduleHandlers.js";
import {
  getTodayContext,
  getWeekContext,
  writeBriefing,
} from "./handlers/briefingHandlers.js";
import { getNoteContext } from "./handlers/noteContextHandlers.js";
import { searchAll } from "./handlers/searchHandlers.js";
import { generateContent, formatContent } from "./handlers/contentHandlers.js";
import {
  listWikiTags,
  tagEntity,
  untagEntity,
  searchByTag,
  getEntityTags,
} from "./handlers/wikiTagHandlers.js";
import { restoreItem } from "./handlers/trashHandlers.js";
import {
  seedVerificationState,
  readVerificationState,
  cleanupVerificationState,
} from "./handlers/verificationHandlers.js";
import {
  validateToolArgs,
  unknownArgNames,
  type ObjectSchema,
} from "./utils/toolSchema.js";

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
    name: "list_todos",
    description:
      "List todos. Optionally filter by status (not_started/in_progress/done), date_range, or parent_id. " +
      "Returns { todos, total, hasMore }: each entry carries a short contentPreview, not the whole body. " +
      "Use get_todo for one todo's full content, or include_content:true to get every body in the page.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["not_started", "in_progress", "done"],
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
  defineTool({
    name: "get_daily",
    // A date with no daily and a date whose daily is in the trash both come
    // back with content: null, so the flags are the only way to tell them
    // apart (#782 ②).
    description:
      "Get the daily entry for a specific date. Returns exists (is there a readable daily), isTrashed (there is one, but it is in the trash — its body is withheld and writing to this date would restore it) and hasBriefing (the 朝刊 section is already written; write_briefing would replace it) alongside content. When exists is false, hasBriefing is always false — a trashed body is not read.",
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
  defineTool({
    name: "list_schedule",
    description:
      "List schedule items and scheduled todos for a specific date or date range. " +
      "Pass either date (one day) or start_date AND end_date (a range) — half a range, or both forms at once, is an error rather than a silent fallback to today. Omit all three for today.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description:
            "Single date in YYYY-MM-DD format. Defaults to today when no date and no range is given.",
        },
        start_date: {
          type: "string",
          description:
            "Range start date (YYYY-MM-DD). Requires end_date; use date instead for a single day.",
        },
        end_date: {
          type: "string",
          description: "Range end date (YYYY-MM-DD). Requires start_date.",
        },
      },
    },
    handler: listSchedule,
  }),
  defineTool({
    name: "create_schedule_item",
    description:
      "Create a new schedule item (event) on the calendar. start_time and end_time are required unless is_all_day is true (an all-day event stores no times). For routine-based items, use todos instead.",
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
            "Start time in 24-hour HH:MM format (e.g. 09:00). Required unless is_all_day is true, which stores no times.",
        },
        end_time: {
          type: "string",
          description:
            "End time in 24-hour HH:MM format (e.g. 09:15). Required unless is_all_day is true, which stores no times.",
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
          description: "New start time in 24-hour HH:MM format (e.g. 09:00)",
        },
        end_time: {
          type: "string",
          description: "New end time in 24-hour HH:MM format (e.g. 09:15)",
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
      "Soft-delete a schedule item (moves it to trash; restorable with restore_item or from the Trash view).",
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
    name: "restore_item",
    description:
      "Restore an item from the trash — the inverse of delete_todo / delete_note / delete_schedule_item. " +
      "Restorable roles: todo, note, event (schedule item); a daily comes back through upsert_daily instead. " +
      "Restoring an item that is not in the trash is a no-op, not an error. " +
      "Restores the one item only — a todo whose parent is still trashed stays out of get_todo_tree (it does appear in list_todos).",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "ID of the trashed todo, note or schedule item",
        },
      },
      required: ["id"],
    },
    handler: restoreItem,
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
      "Get everything needed to write the morning briefing (朝刊) in one call: today's events, todos scheduled onto today, open todos (due today / overdue carry-overs / in-progress), the last 3 days of daily notes (夕刊 material), and whether today's daily already has a briefing section.",
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
    name: "get_week_context",
    description:
      "Get everything needed for a weekly review (週次レビュー) in one call, instead of 7 get_today_context calls: 7 days each with its events, the todos scheduled onto it and its daily note text, plus the open todos carried into the week (overdue carry-overs / in-progress). Defaults to the current local week, Monday to Sunday. Todo and note BODIES are not included — read one with get_todo / get_note when you decide you need it.",
    inputSchema: {
      type: "object" as const,
      properties: {
        start_date: {
          type: "string",
          description:
            "First day of the 7-day window, YYYY-MM-DD (default: the Monday of the current local week)",
        },
      },
    },
    handler: getWeekContext,
  }),
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
      "List all wiki tags. Tags are cross-domain labels that connect todos, dailies, and notes.",
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
      "Assign a wiki tag to a todo, daily, or note. Creates the tag if it doesn't exist.",
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
    name: "untag_entity",
    description:
      "Remove a wiki tag from a todo, daily, or note. Only this assignment goes away — the tag itself, and its other assignments, stay. " +
      "Removing a tag that is not assigned is a no-op, not an error.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tag_name: { type: "string", description: "Tag name" },
        entity_id: { type: "string", description: "Entity ID" },
      },
      required: ["tag_name", "entity_id"],
    },
    handler: untagEntity,
  }),
  defineTool({
    name: "search_by_tag",
    description: "Search for todos, dailies, and notes by wiki tag name.",
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
    name: "get_entity_tags",
    description:
      "Get all wiki tags assigned to a specific entity (todo, daily, or note).",
    inputSchema: {
      type: "object" as const,
      properties: {
        entity_id: {
          type: "string",
          description: "Entity ID (todo, daily, or note)",
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

  /*
   * The verification harness (#700). All three refuse to run unless the
   * server was started in verification mode, against the dedicated
   * verification account — see src/utils/verification.ts.
   */
  defineTool({
    name: "seed_verification_state",
    description:
      "VERIFICATION ONLY. Build a known state on one day — todos, events and notes — so a change can be checked without arranging data by hand in the UI. " +
      "Writes through the ordinary create tools, records every row it creates in a ledger, and returns a run_id; " +
      "read_verification_state reads that run back and cleanup_verification_state deletes exactly it. " +
      "Disabled unless the server runs in verification mode against the verification account.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description:
            "Day to place the fixture on, YYYY-MM-DD (default: today in local time)",
        },
        preset: {
          type: "string",
          enum: ["busy_day"],
          description:
            "Ready-made fixture. busy_day = two overlapping events + an all-day event + a done todo + an open todo + an undated todo.",
        },
        items: {
          type: "array",
          description:
            "Items to create, appended after any preset. At least one item (here or from a preset) is required.",
          items: {
            type: "object",
            properties: {
              kind: {
                type: "string",
                enum: ["task", "event", "note"],
                description:
                  "What to create. Dailies are not seedable: their id comes from the date, so a seeded one cannot be told apart from a real entry.",
              },
              title: {
                type: "string",
                description:
                  "Title (a [verify] marker is prepended). Defaults to 'kind N'.",
              },
              content: {
                type: "string",
                description: "Markdown body (todo and note)",
              },
              status: {
                type: "string",
                enum: ["not_started", "in_progress", "done"],
                description: "Todo status (todo only, default: not_started)",
              },
              start_time: {
                type: "string",
                description:
                  "HH:MM. Event: its start. Todo: schedules it at that time on the day — a todo with no time and no is_all_day stays undated.",
              },
              end_time: {
                type: "string",
                description: "HH:MM. Event: its end. Todo: its scheduled end.",
              },
              is_all_day: {
                type: "boolean",
                description:
                  "All-day item. An all-day event stores no times; an all-day todo lands on the day's local midnight.",
              },
              memo: { type: "string", description: "Event memo (event only)" },
            },
            required: ["kind"],
          },
        },
        label: {
          type: "string",
          description:
            "Free-text note stored with the run (e.g. the Issue being verified)",
        },
      },
    },
    handler: seedVerificationState,
  }),
  defineTool({
    name: "read_verification_state",
    description:
      "VERIFICATION ONLY. Read what the DB actually stores, without going through the UI: both rows of the 2-row model (items_meta + <role>_payload) in one object per item. " +
      "Soft-deleted items are included and flagged, so 'the screen stopped showing it' and 'the row is gone' can be told apart. " +
      "Select by run_id (a seed run), date (everything on one local day), or id (one item) — exactly one of the three.",
    inputSchema: {
      type: "object" as const,
      properties: {
        run_id: {
          type: "string",
          description: "A run_id returned by seed_verification_state",
        },
        date: {
          type: "string",
          description:
            "Local day (YYYY-MM-DD): events on it plus todos scheduled into it",
        },
        id: { type: "string", description: "A single item id" },
      },
    },
    handler: readVerificationState,
  }),
  defineTool({
    name: "cleanup_verification_state",
    description:
      "VERIFICATION ONLY. Delete the rows seeded earlier — read from the ledger, not from the caller's memory — hard, so nothing is left in the trash. " +
      "Defaults to every recorded run; pass run_id for one. Rows that fail to delete stay in the ledger so a re-run finishes them. " +
      "Retire the verification account only after this reports the ledger empty: user_id has no FK to auth.users, so rows outlive a deleted account.",
    inputSchema: {
      type: "object" as const,
      properties: {
        run_id: {
          type: "string",
          description: "Clean one run (default: every run in the ledger)",
        },
        dry_run: {
          type: "boolean",
          description: "Report what would be deleted and delete nothing",
        },
      },
    },
    handler: cleanupVerificationState,
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
  const ignored = unknownArgNames(def.inputSchema, args);
  const result = await def.run(args);

  const content: Array<{ type: "text"; text: string }> = [
    { type: "text", text: JSON.stringify(result, null, 2) },
  ];

  // #702 ②: an undeclared argument is accepted by the validator and then read
  // by nobody. Left unsaid, a misremembered name looks exactly like a
  // successful edit — so say it, next to the result it did not affect.
  if (ignored.length > 0) {
    content.push({
      type: "text",
      text:
        `Note: ${name} does not accept ${ignored.join(", ")}. ` +
        `Nothing was applied for ${ignored.length === 1 ? "it" : "them"} — ` +
        `check this tool's schema for the argument you meant.`,
    });
  }

  return { content };
}
