import { defineTool, type ToolDefinition } from "./defineTool.js";
import {
  listRoutines,
  getRoutine,
  createRoutine,
  deleteRoutine,
} from "../handlers/routineHandlers.js";

/**
 * Routine (repeating event) tools (#1620). The tools write and read the
 * routine TEMPLATE only; the app generates the events — see the header of
 * handlers/routineHandlers.ts for why, and for the tools deliberately absent.
 */
export const ROUTINE_TOOLS: ToolDefinition[] = [
  defineTool({
    name: "list_routines",
    description:
      "List repeating events (routines): each one's title, frequency and time slot. Archived routines are left out unless include_archived is true. Returns total and hasMore.",
    inputSchema: {
      type: "object" as const,
      properties: {
        include_archived: {
          type: "boolean",
          description: "Include archived routines (default: false)",
        },
        limit: {
          type: "number",
          description: "Max routines to return (default: 50, positive integer)",
        },
      },
    },
    handler: listRoutines,
  }),

  defineTool({
    name: "get_routine",
    description:
      "Get one repeating event (routine) and the occurrences that already exist on the calendar for it. Pass the routineId that list_schedule returns on an item to see which series it belongs to. Occurrences are only the ones the app has generated so far; this tool never creates them.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "Routine ID (the routineId field of a schedule item)",
        },
        start_date: {
          type: "string",
          description:
            "Only occurrences on or after this date (YYYY-MM-DD). Requires end_date.",
        },
        end_date: {
          type: "string",
          description:
            "Only occurrences on or before this date (YYYY-MM-DD). Requires start_date.",
        },
        limit: {
          type: "number",
          description:
            "Max occurrences to return, earliest first (default: 50, positive integer)",
        },
      },
      required: ["id"],
    },
    handler: getRoutine,
  }),

  defineTool({
    name: "create_routine",
    description:
      "Create a repeating event (routine), e.g. every Tuesday 19:00-20:00. This stores the repeat rule only: the Life Editor app generates the actual events for the days it displays, so they will not show up in list_schedule until the app has done so. " +
      "frequency_type daily needs nothing else; weekdays needs frequency_days; interval needs frequency_interval (and optionally frequency_start_date, default today). A field that does not belong to the chosen type is an error. " +
      "To make an existing one-off event repeat, create the routine and delete the one-off with delete_schedule_item; there is no conversion tool.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Event title" },
        frequency_type: {
          type: "string",
          enum: ["daily", "weekdays", "interval"],
          description:
            "daily = every day; weekdays = on the days in frequency_days; interval = every frequency_interval days from frequency_start_date",
        },
        frequency_days: {
          type: "array",
          items: { type: "number" },
          description:
            'Weekdays as integers, 0=Sun 1=Mon … 6=Sat (e.g. [2] for every Tuesday). Required for "weekdays" only.',
        },
        frequency_interval: {
          type: "number",
          description:
            'Repeat every N days (positive integer). Required for "interval" only.',
        },
        frequency_start_date: {
          type: "string",
          description:
            'First day of an "interval" routine (YYYY-MM-DD, default today). "interval" only.',
        },
        start_time: {
          type: "string",
          description:
            "Start time in 24-hour HH:MM format. Pass with end_time, or omit both for the app's default slot (09:00-09:30).",
        },
        end_time: {
          type: "string",
          description:
            "End time in 24-hour HH:MM format. Pass with start_time.",
        },
      },
      required: ["title", "frequency_type"],
    },
    handler: createRoutine,
  }),

  defineTool({
    name: "delete_routine",
    description:
      'Soft-delete a repeating event (routine) together with every occurrence already on the calendar, completed ones included — the same as deleting all events of a series in the app. Everything goes to the Trash view and can be restored from the app. It takes no scope, because a routine id has no day to count from: to remove one day, or one day and every later one, call delete_schedule_item on that occurrence with scope "this" or "future".',
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Routine ID" },
      },
      required: ["id"],
    },
    handler: deleteRoutine,
  }),
];
