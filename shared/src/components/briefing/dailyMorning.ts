/*
 * The day's morning record (D-20261007-briefing-1) — what Claude said about
 * the day, read for the blocks that show it OUTSIDE the Daily body (the
 * morning paper's「昨日へのひとこと」).
 *
 * The comment is not written into the body any more: MCP `write_briefing`
 * puts it in `dailies_payload.morning_comment` (0035). Older days still carry
 * it as a 朝刊 heading section of the body, never rewritten, so it is read
 * from the column when that holds a paragraph, else from the body's 朝刊
 * section (extractBriefing).
 *
 * The record also carried the body's 宣言 section until #2757. Nothing writes
 * a 宣言 since #2106 and no screen showed it, so it is no longer read.
 *
 * The section runs [heading, next heading) — the same range readDailyText
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

export interface MorningRecord {
  /** Claude's comment paragraphs, trimmed; [] when there is none. */
  comment: string[];
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
  };
}
