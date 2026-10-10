/*
 * The day's morning record (D-20261007-briefing-1) — what Claude said about
 * the day and what the user declared for it, read for the blocks that show
 * them OUTSIDE the Daily body (the morning paper's「昨日へのひとこと」now, the
 * Daily screen's own blocks with #2123).
 *
 * Neither is written into the body any more: MCP `write_briefing` puts the
 * comment in `dailies_payload.morning_comment` (0035), and nothing writes a
 * 宣言 once the paper's field is gone (#2106). Older days still carry both as
 * heading sections of the body, and those are never rewritten, so each half
 * is read from where it can be:
 *
 *   comment   — the column when it holds a paragraph, else the body's 朝刊
 *               section (extractBriefing).
 *   intention — the body's 宣言 section (extractIntentionSection). There is
 *               no column for it.
 *
 * Both sections run [heading, next heading) — the same range readDailyText
 * leaves out of the day's one text (dailyText.ts) — so heading-less text a
 * user wrote after those lines comes back here instead of being lost from
 * every screen. On an old day where write_briefing put 朝刊 above the old
 * body, that means a diary line can show up as part of the comment; the
 * decision was to show it rather than hide it.
 *
 * A day with both a column and a body section shows the column only: the
 * section's text then reaches no block (still in the raw body that get_daily
 * returns). That happens only on a day that already had a section when the
 * column shipped and was written again after.
 *
 * Pure module (no React, no DataService) — dailyMorning.test.ts.
 */

import { extractBriefing, normalizeMorningComment } from "./extractBriefing";
import { extractIntentionSection } from "./intentionSection";

export interface MorningRecord {
  /** Claude's comment paragraphs, trimmed; [] when there is none. */
  comment: string[];
  /** The 宣言 section's lines joined by "\n"; "" when there is none. */
  intention: string;
}

/**
 * A DailyNode (or the two fields of one). `content` may be null for "no body
 * in hand", which the morning paper's fetch state uses for a day without a
 * daily.
 */
export interface MorningRecordSource {
  content?: string | null;
  morningComment?: readonly string[] | null;
}

export function readMorningRecord(
  daily: MorningRecordSource | null | undefined,
): MorningRecord {
  const content = daily?.content ?? null;
  const column = normalizeMorningComment(daily?.morningComment);
  return {
    comment:
      column.length > 0 ? column : (extractBriefing(content)?.paragraphs ?? []),
    intention: extractIntentionSection(content).text ?? "",
  };
}
