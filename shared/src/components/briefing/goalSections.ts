/*
 * 目標 (Goals) section helpers — the week / month / year goals the morning
 * paper keeps on display (#872).
 *
 * Contract (the same DDL-zero heading convention as 宣言 / 朝刊 / 夕刊, only
 * the document is different):
 *
 *   ONE reserved note, `note-goals`, whose body holds one section per period
 *   the user has ever written for, each heading carrying its PERIOD KEY:
 *
 *     ## 週目標 2026-08-10   → the week beginning 2026-08-10 (one line per goal)
 *     ## 月目標 2026-08      → August 2026
 *     ## 年目標 2026         → 2026
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
 * ROLLOVER (#957, decision D-20260815-briefing-3 = B): the paper reads and
 * writes ONLY the current period's section, so when the week turns over the
 * field is empty because `週目標 <this week>` does not exist yet — and last
 * week's section is still sitting in the note as history. Nothing is deleted,
 * nothing is moved; the key in the heading is the whole mechanism. History is
 * read in Notes, where the goals note opens like any other note; the paper
 * never lists it.
 *
 * MIGRATION off the pre-#957 shape: sections written before this change have a
 * BARE heading (`## 週目標`, no key). Because the heading REs are anchored,
 * "bare" and "keyed" can never be mistaken for one another, so a bare section
 * is an unambiguous marker of old data. It is adopted as the CURRENT period —
 * on read (so the goals never blink out), and rewritten in place to the keyed
 * form by `adoptBareGoalHeadings`, which the host runs once when it finds one.
 * Without that rewrite an untouched bare heading would keep re-adopting itself
 * every week and never roll over at all.
 *
 * INSIDE a goal section the paper owns the format (see below); OUTSIDE the
 * headings nothing is ever touched.
 *
 * The heading REs live here rather than in dailySections.ts because these
 * sections live in their own note: they can never collide with the daily's
 * three conventions, which is exactly what that file's shared RE list is for.
 *
 * `mergeGoalSection` is the concurrency-safe write: read the WHOLE body →
 * replace only one period's range → write back, so saving the week goal can
 * never clobber the month goal, a past period's history, or a Notes-side edit.
 *
 * Pure module (no React, no DataService) — unit-tested in
 * shared/tests/goalSections.test.ts.
 */

import {
  findSectionRange,
  parseDailyDoc,
  sectionLines,
  textOf,
  type TipTapNode,
} from "./dailySections";
import type { GoalPeriodKeys } from "./goalPeriods";
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

/**
 * Accepted heading words per period, as RE alternations. Reading stays
 * generous (the long ja forms and the English ones a Notes-side writer might
 * type); writing always uses GOAL_HEADING_TEXT.
 */
const GOAL_HEADING_BODY: Record<GoalPeriod, string> = {
  week: "週目標|今週の目標|weekly goals?",
  month: "月目標|今月の目標|monthly goals?",
  year: "年目標|今年の目標|yearly goals?|annual goals?",
};

/**
 * Pre-#957 heading markers: the word ALONE, anchored at both ends.
 *
 * The anchoring is load-bearing, not tidiness — it is what makes「週目標」and
 *「週目標 2026-08-10」two disjoint matches, and therefore what lets a bare
 * heading be recognised as old data with no version marker anywhere. Loosen
 * either end and `findSectionRange`'s first-match-wins would hand a merge the
 * OLDEST week section, overwriting history with no undo.
 */
const BARE_HEADING_RE: Record<GoalPeriod, RegExp> = {
  week: new RegExp(`^(?:${GOAL_HEADING_BODY.week})$`, "i"),
  month: new RegExp(`^(?:${GOAL_HEADING_BODY.month})$`, "i"),
  year: new RegExp(`^(?:${GOAL_HEADING_BODY.year})$`, "i"),
};

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The heading of ONE period's ONE key — e.g.「週目標 2026-08-10」. */
function keyedHeadingRe(period: GoalPeriod, key: string): RegExp {
  return new RegExp(
    `^(?:${GOAL_HEADING_BODY[period]})\\s+${escapeRe(key)}$`,
    "i",
  );
}

/**
 * The key written on a heading, or null when it is not this period's heading
 * at all. `""` means a bare (pre-#957) heading.
 */
function headingKeyOf(text: string, period: GoalPeriod): string | null {
  const match = new RegExp(
    `^(?:${GOAL_HEADING_BODY[period]})(?:\\s+(\\S+))?$`,
    "i",
  ).exec(text.trim());
  if (match === null) return null;
  return match[1] ?? "";
}

/** Heading text a merge WRITES (reading also accepts the variants above). */
const GOAL_HEADING_TEXT: Record<GoalPeriod, string> = {
  week: "週目標",
  month: "月目標",
  year: "年目標",
};

function goalHeadingText(period: GoalPeriod, key: string): string {
  return `${GOAL_HEADING_TEXT[period]} ${key}`;
}

/**
 * The range this period's CURRENT text lives in: the keyed section if it
 * exists, else a bare pre-#957 section adopted as the current period.
 *
 * ONE helper for both read and write, so the field always shows exactly the
 * range the next save replaces — an adoption can never read one section and
 * write over a different one.
 */
function currentRange(
  body: TipTapNode[],
  period: GoalPeriod,
  key: string,
): { start: number; end: number } | null {
  return (
    findSectionRange(body, keyedHeadingRe(period, key)) ??
    findSectionRange(body, BARE_HEADING_RE[period])
  );
}

/** Newline-joined goal text per period; null = no section / empty section. */
export type ExtractedGoals = Record<GoalPeriod, string | null>;

/**
 * Canonical form of a goal text: lines trimmed, blank lines dropped, null when
 * nothing remains. Identical rule to the 宣言 field (same plain-line surface),
 * so it is that function rather than a second copy of it.
 */
export const normalizeGoalText = normalizeIntentionText;

/**
 * Extract the CURRENT period's goals from a stored note body. Sections filed
 * under any other key are history and are never returned — the paper shows
 * only the period it is standing in.
 */
export function extractGoals(
  contentJson: string | null | undefined,
  keys: GoalPeriodKeys,
): ExtractedGoals {
  const body = parseDailyDoc(contentJson).content ?? [];
  const goals: ExtractedGoals = { week: null, month: null, year: null };
  for (const period of GOAL_PERIODS) {
    const range = currentRange(body, period, keys[period]);
    if (range === null) continue;
    const lines = sectionLines(body.slice(range.start + 1, range.end));
    goals[period] = lines.length === 0 ? null : lines.join("\n");
  }
  return goals;
}

/**
 * One-shot migration off the pre-#957 shape: rewrite each BARE heading that
 * still holds text into this period's keyed form, leaving the paragraphs under
 * it untouched. Returns the input by identity (`===`) when there is nothing to
 * migrate, so the host can skip the write.
 *
 * Read-side adoption alone would not be enough: an untouched bare heading
 * would keep re-adopting itself every week and never roll over at all. The
 * rewrite is what ends that, and it happens once — the second call finds a
 * keyed section and returns the input.
 *
 * Only headings WITH text are adopted; an empty one is left where it is rather
 * than seeding an empty history section on every turnover. (It self-heals
 * anyway — the first real save replaces it, because `currentRange` finds it.)
 *
 * A period that already has a keyed section is skipped: that one is the live
 * text, and adopting a stray bare heading on top of it would overwrite it.
 */
export function adoptBareGoalHeadings(
  contentJson: string | null | undefined,
  keys: GoalPeriodKeys,
): string {
  const original = contentJson ?? "";
  const doc = parseDailyDoc(contentJson);
  const body = doc.content ?? [];
  let changed = false;
  for (const period of GOAL_PERIODS) {
    if (findSectionRange(body, keyedHeadingRe(period, keys[period])) !== null) {
      continue;
    }
    const bare = findSectionRange(body, BARE_HEADING_RE[period]);
    if (bare === null) continue;
    if (sectionLines(body.slice(bare.start + 1, bare.end)).length === 0) {
      continue;
    }
    const heading = body[bare.start];
    if (heading === undefined) continue;
    body[bare.start] = {
      ...heading,
      content: [{ type: "text", text: goalHeadingText(period, keys[period]) }],
    };
    changed = true;
  }
  if (!changed) return original;
  doc.content = body;
  const merged = JSON.stringify(doc);
  return merged === original ? original : merged;
}

/**
 * Section-merge write: put one period's goal text into a stored note body and
 * return the new content string. Replaces only the CURRENT [heading, next
 * heading) range of that period and leaves every other block untouched — past
 * periods' history included — so a week save can never reach last week's
 * section. A normalized-empty text removes the current section and never
 * creates one. Returns the input unchanged (===) when there is nothing to do,
 * so callers can skip the write (and, on a missing note, skip creating it).
 *
 * Writing always uses the KEYED heading, so a bare pre-#957 section that
 * `currentRange` adopted is migrated in place by the first save.
 *
 * A new section lands above anything it should outrank: the later periods'
 * current sections and every history section, so the three live goals stay at
 * the top of the note as it grows.
 */
export function mergeGoalSection(
  contentJson: string | null | undefined,
  period: GoalPeriod,
  key: string,
  text: string | null,
): string {
  const original = contentJson ?? "";
  const doc = parseDailyDoc(contentJson);
  const body = doc.content ?? [];
  const range = currentRange(body, period, key);
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
      content: [{ type: "text", text: goalHeadingText(period, key) }],
    },
    ...normalized.split("\n").map((line): TipTapNode => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    })),
  ];

  if (range !== null) {
    body.splice(range.start, range.end - range.start, ...section);
  } else {
    body.splice(insertIndexFor(body, period, key), 0, ...section);
  }
  doc.content = body;
  const merged = JSON.stringify(doc);
  return merged === original ? original : merged;
}

/**
 * Where a missing section goes: above the first block it should outrank —
 * a later period's current section, or the first history section of any
 * period. Never index 0, so a Notes-side preamble keeps its place.
 */
function insertIndexFor(
  body: TipTapNode[],
  period: GoalPeriod,
  key: string,
): number {
  const candidates: number[] = [];
  for (const later of GOAL_PERIODS.slice(GOAL_PERIODS.indexOf(period) + 1)) {
    // The later period's own key is unknown here, so take whichever section it
    // has: only one of them can be current, and putting this one above all of
    // them keeps week → month → year regardless.
    const range = findSectionRange(
      body,
      new RegExp(`^(?:${GOAL_HEADING_BODY[later]})(?:\\s+\\S+)?$`, "i"),
    );
    if (range !== null) candidates.push(range.start);
  }
  const history = firstHistoryIndex(body, period, key);
  if (history !== -1) candidates.push(history);
  return candidates.length === 0 ? body.length : Math.min(...candidates);
}

/** First heading of THIS period filed under some other key; -1 if none. */
function firstHistoryIndex(
  body: TipTapNode[],
  period: GoalPeriod,
  key: string,
): number {
  for (let i = 0; i < body.length; i++) {
    const node = body[i];
    if (node === undefined || node.type !== "heading") continue;
    const found = headingKeyOf(textOf(node), period);
    if (found === null || found === "" || found === key) continue;
    return i;
  }
  return -1;
}
