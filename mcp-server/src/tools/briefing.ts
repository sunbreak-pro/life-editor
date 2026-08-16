import { defineTool, type ToolDefinition } from "./defineTool.js";
import {
  getTodayContext,
  getWeekContext,
  writeBriefing,
} from "../handlers/briefingHandlers.js";

/**
 * Briefing tools (#895). One file per handler domain, so adding a tool
 * touches only its own domain instead of the middle of a 1,120-line array.
 */
export const BRIEFING_TOOLS: ToolDefinition[] = [
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
];
