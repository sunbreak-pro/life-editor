/*
 * フォーカス (Focus) section helpers — the focus line the morning paper
 * displays, written the previous evening (#1048).
 *
 * Contract (the same DDL-zero heading convention as the 目標 note #872, only
 * the sections are keyed per DAY instead of per period):
 *
 *   ONE reserved note, `note-focus`, whose body holds one section per day the
 *   user has ever written a focus for, each heading carrying its DATE KEY:
 *
 *     ## フォーカス 2026-08-18   → the focus the 2026-08-18 morning paper shows
 *
 * The evening paper of day D writes the section keyed D+1 (setting tomorrow's
 * focus is part of closing today), and the morning paper of day D reads the
 * section keyed D. Past days' sections stay in the note as history the user
 * reads from Notes — nothing is deleted on turnover, exactly like the goals
 * note's period keys (D-20260815-briefing-3 = B).
 *
 * Why a note and not the daily: the focus used to be the first paragraph of
 * the daily's 朝刊 section (extractBriefing), which made "write today's focus"
 * an act of editing the Daily. #1048 removes that reference entirely, so the
 * focus needs a home that is NOT the daily — and the reserved-note precedent
 * (`note-goals`) already syncs, soft-deletes and opens in Notes for free.
 *
 * `mergeFocusSection` is the concurrency-safe write: read the WHOLE body →
 * replace only one day's range → write back, so a save can never clobber
 * another day's history or a Notes-side edit.
 *
 * Pure module (no React, no DataService) — unit-tested in
 * shared/tests/focusSections.test.ts.
 */

import {
  findSectionRange,
  parseDailyDoc,
  sectionLines,
  textOf,
  type TipTapNode,
} from "./dailySections";
import { normalizeIntentionText } from "./intentionSection";

/**
 * Reserved id of the focus note. Deterministic like `note-goals`: the paper
 * finds the note by id, and the row is created on the FIRST SAVE only
 * (opening the paper must not litter Notes with an empty note).
 */
export const FOCUS_NOTE_ID = "note-focus";

/**
 * Accepted heading words, as an RE alternation. Reading stays generous (the
 * English form a Notes-side writer might type); writing always uses
 * `focusHeadingText`.
 */
const FOCUS_HEADING_BODY = "フォーカス|focus";

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The heading of ONE day's section — e.g.「フォーカス 2026-08-18」. */
function keyedHeadingRe(dateKey: string): RegExp {
  return new RegExp(`^(?:${FOCUS_HEADING_BODY})\\s+${escapeRe(dateKey)}$`, "i");
}

/**
 * The key written on a heading, or null when it is not a focus heading at
 * all. Anchored at both ends, so a Notes-side heading that merely contains
 * the word never becomes a section boundary.
 */
function headingKeyOf(text: string): string | null {
  const match = new RegExp(`^(?:${FOCUS_HEADING_BODY})\\s+(\\S+)$`, "i").exec(
    text.trim(),
  );
  if (match === null) return null;
  return match[1] ?? null;
}

/** Heading text a merge WRITES (reading also accepts the variants above). */
function focusHeadingText(dateKey: string): string {
  return `フォーカス ${dateKey}`;
}

/**
 * Canonical form of a focus text: lines trimmed, blank lines dropped, null
 * when nothing remains. Identical rule to the 宣言 field (same plain-line
 * surface), so it is that function rather than a second copy of it.
 */
export const normalizeFocusText = normalizeIntentionText;

/**
 * Extract ONE day's focus from a stored note body. Sections filed under any
 * other day are history and are never returned.
 */
export function extractFocus(
  contentJson: string | null | undefined,
  dateKey: string,
): string | null {
  const body = parseDailyDoc(contentJson).content ?? [];
  const range = findSectionRange(body, keyedHeadingRe(dateKey));
  if (range === null) return null;
  const lines = sectionLines(body.slice(range.start + 1, range.end));
  return lines.length === 0 ? null : lines.join("\n");
}

/**
 * Section-merge write: put one day's focus text into a stored note body and
 * return the new content string. Replaces only that day's [heading, next
 * heading) range and leaves every other block untouched — history included. A
 * normalized-empty text removes the day's section and never creates one.
 * Returns the input unchanged (===) when there is nothing to do, so callers
 * can skip the write (and, on a missing note, skip creating it).
 *
 * A new section lands above the first existing focus section (the note reads
 * newest-first as it grows), never at index 0 unconditionally — a Notes-side
 * preamble keeps its place.
 */
export function mergeFocusSection(
  contentJson: string | null | undefined,
  dateKey: string,
  text: string | null,
): string {
  const original = contentJson ?? "";
  const doc = parseDailyDoc(contentJson);
  const body = doc.content ?? [];
  const range = findSectionRange(body, keyedHeadingRe(dateKey));
  const normalized = normalizeFocusText(text);

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
      content: [{ type: "text", text: focusHeadingText(dateKey) }],
    },
    ...normalized.split("\n").map((line): TipTapNode => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    })),
  ];

  if (range !== null) {
    body.splice(range.start, range.end - range.start, ...section);
  } else {
    body.splice(firstFocusIndex(body), 0, ...section);
  }
  doc.content = body;
  const merged = JSON.stringify(doc);
  return merged === original ? original : merged;
}

/** Index of the first focus heading (any key); body length if none. */
function firstFocusIndex(body: TipTapNode[]): number {
  for (let i = 0; i < body.length; i++) {
    const node = body[i];
    if (node === undefined || node.type !== "heading") continue;
    if (headingKeyOf(textOf(node)) !== null) return i;
  }
  return body.length;
}
