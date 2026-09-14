import { defineTool, type ToolDefinition } from "./defineTool.js";
import { listWorkSessions } from "../handlers/workHandlers.js";

/**
 * Work timer tools. Read-only on purpose — see workHandlers.ts.
 * One file per handler domain, like every other domain here (#895).
 */
export const WORK_TOOLS: ToolDefinition[] = [
  defineTool({
    name: "list_work_sessions",
    description:
      "What the Work timer recorded — the time actually spent, as opposed to what was planned. " +
      "Defaults to today; pass date for one day or start_date/end_date for a range (local days, inclusive). " +
      "Returns { range, sessions, totals, hasMore }: `totals` covers the WHOLE range (minutesByType, and byItem " +
      "ranked by minutes) while `sessions` is capped by limit. A session still running has durationMinutes null " +
      "and is counted in totals.openSessions rather than as zero.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description:
            "A single local day, YYYY-MM-DD. Shorthand for start_date = end_date; wins over both.",
        },
        start_date: {
          type: "string",
          description: "First local day of the range, YYYY-MM-DD (inclusive).",
        },
        end_date: {
          type: "string",
          description: "Last local day of the range, YYYY-MM-DD (inclusive).",
        },
        session_type: {
          type: "string",
          enum: ["WORK", "BREAK", "LONG_BREAK", "FREE"],
          description:
            "Only this kind of session. 'FREE' is the open-ended timer, the rest are pomodoro phases. Omit for all.",
        },
        limit: {
          type: "number",
          description:
            "Max session rows to return (default: 50, capped at 200). Does not affect totals.",
        },
      },
    },
    handler: listWorkSessions,
  }),
];
