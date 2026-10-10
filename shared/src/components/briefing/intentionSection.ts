/*
 * 宣言 (Intention) section helpers — briefing-loop Step 4, read side only.
 *
 * Contract (same heading-section convention family as 朝刊 / 夕刊):
 *
 *   heading whose text is "宣言" / "Intention" (or "Intentions")
 *     paragraph per line → the user's declaration for the day
 *   ...the next heading (any text) ends the section.
 *
 * The morning paper used to take the declaration and merge it into this
 * section of the daily body. Since D-20261007-briefing-1 nothing writes it:
 * the paper's field went with #2106, and its section-merge writer
 * (`mergeIntentionSection`) and save caption helper (`hasIntentionToReport`)
 * went with it. Older days keep their section untouched, so the READ stays —
 * `readMorningRecord` (dailyMorning.ts) hands it to the blocks that show it
 * outside the body, and `readDailyText` (dailyText.ts) leaves it out of the
 * day's one text.
 *
 * The section body is modelled as LINES: extraction flattens it to
 * newline-joined text (list items count one per line).
 * `normalizeIntentionText` is that line model's canonical form, and stays the
 * one the focus and goal fields reuse (focusSections.ts / goalSections.ts).
 *
 * Pure module (no React, no DataService) — unit-tested in
 * shared/tests/intentionSection.test.ts.
 */

import {
  INTENTION_HEADING_RE,
  findSectionRange,
  parseDailyDoc,
  sectionLines,
} from "./dailySections";

export interface ExtractedIntentionSection {
  /**
   * Newline-joined declaration lines, or null when the daily has no 宣言
   * section (or the section carries no text).
   */
  text: string | null;
  /** True when the daily contains a 宣言 heading at all. */
  hasSection: boolean;
}

/**
 * Canonical form of a declaration text: lines trimmed, blank lines dropped.
 * Returns null when nothing remains — the "no declaration" value.
 */
export function normalizeIntentionText(
  text: string | null | undefined,
): string | null {
  if (text === null || text === undefined) return null;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  return lines.length === 0 ? null : lines.join("\n");
}

/**
 * Extract the 宣言 section from a stored daily body (TipTap JSON or legacy
 * plain text — the latter never contains headings, so it yields "no section").
 */
export function extractIntentionSection(
  contentJson: string | null | undefined,
): ExtractedIntentionSection {
  const body = parseDailyDoc(contentJson).content ?? [];
  const range = findSectionRange(body, INTENTION_HEADING_RE);
  if (range === null) return { text: null, hasSection: false };
  const lines = sectionLines(body.slice(range.start + 1, range.end));
  return {
    text: lines.length === 0 ? null : lines.join("\n"),
    hasSection: true,
  };
}
