import { defineTool, type ToolDefinition } from "./defineTool.js";
import {
  listSchedule,
  createScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
  setScheduleComplete,
  setScheduleDismissed,
} from "../handlers/scheduleHandlers.js";

/**
 * Schedule tools (#895). One file per handler domain, so adding a tool
 * touches only its own domain instead of the middle of a 1,120-line array.
 */
export const SCHEDULE_TOOLS: ToolDefinition[] = [
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
];
