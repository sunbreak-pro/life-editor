/*
 * Briefing extraction — the read half of the write_briefing convention.
 *
 * Convention (Briefing plan Step 2/3, until 0035): the MCP `write_briefing`
 * tool (or any writer, including the user typing in the Daily editor) put the
 * morning briefing INSIDE the day's DailyNode content as a TipTap section:
 *
 *   heading (any level) whose text is "Briefing" / "朝刊"
 *     paragraphs → the AI comment body (昨日の宣言への講評 etc.)
 *   ...next heading ends the section.
 *
 * The focus line is NOT part of this section any more (#1048): it moved to
 * the reserved focus note, written from the evening paper (focusSections.ts).
 * Every paragraph here is AI comment — a writer that still leads with a focus
 * line (the current write_briefing contract) simply has it read back as the
 * first comment paragraph.
 *
 * Since 0035 (D-20261007-briefing-1) write_briefing no longer writes this
 * section: the comment goes to `dailies_payload.morning_comment`, beside the
 * body. Old days keep their section untouched, so this parser stays as the
 * FALLBACK reader — `readMorningRecord` (dailyMorning.ts) asks the column
 * first and comes here only when it is empty. This parser is deliberately
 * forgiving — a daily without the section (or with unparseable content)
 * yields `null`.
 *
 * Pure data helper (no React, no DataService) — unit-tested in
 * extractBriefing.test.ts.
 */

import { BRIEFING_HEADING_RE, textOf, type TipTapNode } from "./dailySections";

export interface ExtractedBriefing {
  /** The section's paragraphs — rendered as the AI comment block. */
  paragraphs: string[];
}

/**
 * Extract the briefing section from a DailyNode's TipTap JSON content.
 * Returns `null` when the content is missing, unparseable, or has no
 * "Briefing" / "朝刊" heading section with at least one paragraph of text.
 */
export function extractBriefing(
  contentJson: string | null | undefined,
): ExtractedBriefing | null {
  if (contentJson === null || contentJson === undefined || contentJson === "")
    return null;

  let doc: TipTapNode;
  try {
    doc = JSON.parse(contentJson) as TipTapNode;
  } catch {
    return null;
  }
  const body = doc?.content;
  if (!Array.isArray(body)) return null;

  const texts: string[] = [];
  let inSection = false;
  for (const node of body) {
    if (node.type === "heading") {
      // A second heading (any text) closes the briefing section.
      if (inSection) break;
      if (BRIEFING_HEADING_RE.test(textOf(node).trim())) inSection = true;
      continue;
    }
    if (inSection) {
      const t = textOf(node).trim();
      if (t !== "") texts.push(t);
    }
  }
  if (!inSection || texts.length === 0) return null;

  return { paragraphs: texts };
}

/**
 * The `morning_comment` column's paragraphs (0035), trimmed, with every
 * non-string and blank element dropped — `[]` for null, a non-array, or an
 * array with nothing left. The mapper already drops those on read; this
 * reads again because a DailyNode can also come from a snapshot replay or a
 * hand-built fixture.
 */
export function normalizeMorningComment(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const paragraphs: string[] = [];
  for (const p of value) {
    if (typeof p !== "string") continue;
    const text = p.trim();
    if (text !== "") paragraphs.push(text);
  }
  return paragraphs;
}

/**
 * The most recent date (YYYY-MM-DD) whose daily carries a morning comment,
 * or `null` when none does — Settings' "last AI activity" line (#1210).
 *
 * This is EVIDENCE, not a log. `write_briefing` puts its comment in the
 * `morning_comment` column (0035) and used to put it in the 朝刊 section of
 * the body; the user can type into that heading by hand, so the date answers
 * "when was a briefing last written", never "when did Claude last run". The
 * UI wording carries that caveat; keeping the ambiguity out of the function
 * name would only move the lie somewhere harder to see.
 *
 * "Carries a comment" is `readMorningRecord(d).comment.length > 0` — the
 * column, else the body's section. It is spelled out with the two readers
 * here because dailyMorning.ts imports this module, and calling back into it
 * would make the two modules import each other.
 *
 * Deleted dailies are skipped: a day the user threw away should not keep
 * standing as the latest activity.
 */
export function lastBriefingDate(
  dailies: ReadonlyArray<{
    date: string;
    content: string;
    isDeleted?: boolean;
    morningComment?: readonly string[] | null;
  }>,
): string | null {
  let latest: string | null = null;
  for (const d of dailies) {
    if (d.isDeleted === true) continue;
    if (
      normalizeMorningComment(d.morningComment).length === 0 &&
      extractBriefing(d.content) === null
    )
      continue;
    // String compare is the date compare here: YYYY-MM-DD sorts lexically.
    if (latest === null || d.date > latest) latest = d.date;
  }
  return latest;
}
