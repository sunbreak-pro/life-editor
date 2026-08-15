/*
 * 目標 (Goals) section helpers — the week / month / year goals the morning
 * paper keeps on display (#872).
 *
 * Contract (the same DDL-zero heading convention as 宣言 / 朝刊 / 夕刊, only
 * the document is different):
 *
 *   ONE reserved note, `note-goals`, whose body holds up to three sections
 *
 *     ## 週目標   → this week's goals   (one line per goal)
 *     ## 月目標   → this month's goals
 *     ## 年目標   → this year's goals
 *
 * Why a note and not a table: nothing here needs querying, joining or a
 * date range — it is three pieces of standing text the user rereads every
 * morning. A reserved id (`daily-YYYY-MM-DD` set the precedent) is what makes
 * "the goals note" findable without a lookup table, and the note opens in
 * Notes like any other.
 *
 * INSIDE a goal section the paper owns the format: the merge rewrites the
 * whole [heading, next heading) range as PLAIN LINES (one paragraph per line),
 * so a bullet list or bold text written into a goal section from Notes is
 * flattened by the next edit made on the paper — the same "last writing
 * surface wins, per section" rule the 宣言 field has. Blocks OUTSIDE the three
 * headings are never touched.
 *
 * NO ROLLOVER: these are standing texts, not per-week rows. Nothing resets on
 * Monday and nothing is archived — the period LABEL is computed for display
 * (goalPeriods.ts) while the text is whatever the user last wrote.
 *
 * The heading REs live here rather than in dailySections.ts because these
 * sections live in their own note: they can never collide with the daily's
 * three conventions, which is exactly what that file's shared RE list is for.
 *
 * `mergeGoalSection` is the concurrency-safe write: read the WHOLE body →
 * replace only one period's range → write back, so saving the week goal can
 * never clobber the month goal or a Notes-side edit.
 *
 * Pure module (no React, no DataService) — unit-tested in
 * shared/tests/goalSections.test.ts.
 */

import {
  findSectionRange,
  parseDailyDoc,
  sectionLines,
  type TipTapNode,
} from "./dailySections";
import { normalizeIntentionText } from "./intentionSection";

/**
 * Reserved id of the goals note. Deterministic like `daily-YYYY-MM-DD`: the
 * paper finds the note by id, and the row is created on the FIRST SAVE only
 * (opening the paper must not litter Notes with an empty note).
 */
export const GOALS_NOTE_ID = "note-goals";

export type GoalPeriod = "week" | "month" | "year";

/** Display + write order: week → month → year (widening horizon). */
export const GOAL_PERIODS: readonly GoalPeriod[] = ["week", "month", "year"];

/** Section heading markers (case-insensitive, trimmed). */
const GOAL_HEADING_RE: Record<GoalPeriod, RegExp> = {
  week: /^(週目標|今週の目標|weekly goals?)$/i,
  month: /^(月目標|今月の目標|monthly goals?)$/i,
  year: /^(年目標|今年の目標|yearly goals?|annual goals?)$/i,
};

/** Heading text a merge WRITES (reading also accepts the variants above). */
const GOAL_HEADING_TEXT: Record<GoalPeriod, string> = {
  week: "週目標",
  month: "月目標",
  year: "年目標",
};

/** Newline-joined goal text per period; null = no section / empty section. */
export type ExtractedGoals = Record<GoalPeriod, string | null>;

/**
 * Canonical form of a goal text: lines trimmed, blank lines dropped, null when
 * nothing remains. Identical rule to the 宣言 field (same plain-line surface),
 * so it is that function rather than a second copy of it.
 */
export const normalizeGoalText = normalizeIntentionText;

/** Extract all three goal sections from a stored note body. */
export function extractGoals(
  contentJson: string | null | undefined,
): ExtractedGoals {
  const body = parseDailyDoc(contentJson).content ?? [];
  const goals: ExtractedGoals = { week: null, month: null, year: null };
  for (const period of GOAL_PERIODS) {
    const range = findSectionRange(body, GOAL_HEADING_RE[period]);
    if (range === null) continue;
    const lines = sectionLines(body.slice(range.start + 1, range.end));
    goals[period] = lines.length === 0 ? null : lines.join("\n");
  }
  return goals;
}

/**
 * Section-merge write: put one period's goal text into a stored note body and
 * return the new content string. Replaces only that period's
 * [heading, next heading) range and leaves every other block untouched — a
 * normalized-empty text removes an existing section and never creates one.
 * Returns the input unchanged (===) when there is nothing to do, so callers
 * can skip the write (and, on a missing note, skip creating it).
 *
 * A new section lands in GOAL_PERIODS order: before the first later period
 * already present, else at the end of the document.
 */
export function mergeGoalSection(
  contentJson: string | null | undefined,
  period: GoalPeriod,
  text: string | null,
): string {
  const original = contentJson ?? "";
  const doc = parseDailyDoc(contentJson);
  const body = doc.content ?? [];
  const range = findSectionRange(body, GOAL_HEADING_RE[period]);
  const normalized = normalizeGoalText(text);

  if (normalized === null) {
    // Nothing to keep — drop an existing section, never create one.
    if (range === null) return original;
    body.splice(range.start, range.end - range.start);
    doc.content = body;
    return JSON.stringify(doc);
  }

  const section: TipTapNode[] = [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: GOAL_HEADING_TEXT[period] }],
    },
    ...normalized.split("\n").map((line): TipTapNode => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    })),
  ];

  if (range !== null) {
    body.splice(range.start, range.end - range.start, ...section);
  } else {
    body.splice(insertIndexFor(body, period), 0, ...section);
  }
  doc.content = body;
  const merged = JSON.stringify(doc);
  return merged === original ? original : merged;
}

/** Where a missing section goes: before the first later period present. */
function insertIndexFor(body: TipTapNode[], period: GoalPeriod): number {
  const after = GOAL_PERIODS.slice(GOAL_PERIODS.indexOf(period) + 1);
  for (const later of after) {
    const range = findSectionRange(body, GOAL_HEADING_RE[later]);
    if (range !== null) return range.start;
  }
  return body.length;
}
