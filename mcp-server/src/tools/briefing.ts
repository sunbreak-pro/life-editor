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
      "Get everything needed to write the morning briefing (朝刊) in one call: today's events, todos scheduled onto today, open todos (due today / overdue carry-overs / in-progress), the last 3 days of daily notes (夕刊 material), today's and those days' `morningComment` (Claude's morning comment, kept beside the daily body: the daily's `morning_comment` column, or the 朝刊 heading section of an older day's body; null when there is none or the day is locked), whether today already has one (`hasBriefing`), and `goals`: the year / month / week goals (目標) of the date with their progress and achievement, shaped like list_goals.",
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
      "Get everything needed for a weekly review (週次レビュー) in one call, instead of 7 get_today_context calls: 7 days each with its events, the todos scheduled onto it, its daily note text and its morningComment (as in get_today_context), plus the open todos carried into the week (overdue carry-overs / in-progress), and `goals`: the goals of every year / month / week period the 7 days fall in (a mid-week start spans two weeks) with their progress and achievement, shaped like list_goals. Defaults to the current local week, Sunday to Saturday. Todo and note BODIES are not included — read one with get_todo / get_note when you decide you need it.",
    inputSchema: {
      type: "object" as const,
      properties: {
        start_date: {
          type: "string",
          description:
            "First day of the 7-day window, YYYY-MM-DD (default: the Sunday of the current local week)",
        },
      },
    },
    handler: getWeekContext,
  }),

  defineTool({
    name: "write_briefing",
    description:
      "Write the morning briefing (朝刊) for a date, in two places the app reads from (#1048): the focus line (今日のフォーカス) is upserted as that date's section of the reserved focus note (`note-focus`), and the comment paragraphs replace the daily's morning comment — a field of the daily kept beside its body (`morning_comment`), never written into the body text. The body is neither read nor changed, so an older day's 朝刊 heading section stays as it is (readers prefer the new comment over it), and rewriting the body with upsert_daily does not erase the comment. The focus note's existing section for the date is replaced in place; other days' focus history is preserved. Creates the focus note / the daily on first write. With no paragraphs, only the focus note is written and the daily is left untouched.",
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
          description:
            "The focus line — one short sentence, rendered large. Written into the focus note's section for the date (not into the daily).",
        },
        paragraphs: {
          type: "array",
          items: { type: "string" },
          description:
            "AI comment body paragraphs (yesterday's review, priorities, encouragement, etc.), saved as the daily's morning comment (`morning_comment`, beside the body — not in it)",
        },
      },
      required: ["focus"],
    },
    handler: writeBriefing,
  }),
];
