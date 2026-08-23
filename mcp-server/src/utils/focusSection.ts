/*
 * Focus note section writer — the MCP write half of the focus convention
 * (#1048 / #1097; read half = shared/src/components/briefing/focusSections.ts,
 * whose header documents the contract in full).
 *
 * In short: ONE reserved note, `note-focus`, holds one section per day,
 * each heading carrying its date key —「## フォーカス 2026-08-18」is the
 * focus the 2026-08-18 morning paper prints. `mergeFocusSection` replaces
 * only that day's [heading, next heading) range and leaves every other
 * block — past days' history, a Notes-side preamble — untouched. A new
 * section lands above the first existing focus section (the note reads
 * newest-first), never at index 0 unconditionally.
 *
 * Deliberate delta from the shared merge: unparseable existing content
 * THROWS here (parseDoc) instead of being treated as empty — an MCP write
 * must refuse to clobber a note body it cannot read, the same rule as
 * briefingSection.ts.
 *
 * Pure module (no Supabase, no MCP) — unit-tested in
 * tests/focusSection.test.ts, including a round-trip against the shared
 * extractFocus parser.
 */

import { parseDoc, textOf, type TipTapNode } from "./briefingSection.js";

/**
 * Reserved id of the focus note (= shared FOCUS_NOTE_ID). Deterministic like
 * `note-goals`: the paper finds the note by id, and the row is created on the
 * FIRST SAVE only.
 */
export const FOCUS_NOTE_ID = "note-focus";

/**
 * items_meta.title the first save creates the note with (NOT NULL column).
 * The web side titles it from i18n (`briefing.focusNoteTitle`); this is that
 * catalog's ja value, the app's primary locale.
 */
export const FOCUS_NOTE_TITLE = "フォーカス";

/** Accepted heading words (reading is generous; writing uses the ja form). */
const FOCUS_HEADING_BODY = "フォーカス|focus";

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The heading of ONE day's section — e.g.「フォーカス 2026-08-18」. */
function keyedHeadingRe(dateKey: string): RegExp {
  return new RegExp(`^(?:${FOCUS_HEADING_BODY})\\s+${escapeRe(dateKey)}$`, "i");
}

/** The key on a heading, or null when it is not a focus heading at all. */
function headingKeyOf(text: string): string | null {
  const match = new RegExp(`^(?:${FOCUS_HEADING_BODY})\\s+(\\S+)$`, "i").exec(
    text.trim(),
  );
  if (match === null) return null;
  return match[1] ?? null;
}

/**
 * Canonical form of a focus text (= shared normalizeFocusText): lines
 * trimmed, blank lines dropped, null when nothing remains.
 */
export function normalizeFocusText(
  text: string | null | undefined,
): string | null {
  if (text === null || text === undefined) return null;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  return lines.length === 0 ? null : lines.join("\n");
}

/** [start, end) of the section keyed `dateKey`, or null when absent. */
function findFocusRange(
  body: TipTapNode[],
  dateKey: string,
): { start: number; end: number } | null {
  const headingRe = keyedHeadingRe(dateKey);
  for (let i = 0; i < body.length; i++) {
    const node = body[i];
    if (node.type !== "heading") continue;
    if (!headingRe.test(textOf(node).trim())) continue;
    let end = body.length;
    for (let j = i + 1; j < body.length; j++) {
      if (body[j].type === "heading") {
        end = j;
        break;
      }
    }
    return { start: i, end };
  }
  return null;
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

/**
 * Section-merge write: put one day's focus text into a stored note body and
 * return the new content string. Returns the input unchanged (===) when the
 * merge is a no-op, so callers can skip the write. The text must be
 * normalized-non-empty — write_briefing rejects an empty focus before it
 * gets here, and this writer never deletes a section.
 */
export function mergeFocusSection(
  contentJson: string | null | undefined,
  dateKey: string,
  text: string,
): string {
  const normalized = normalizeFocusText(text);
  if (normalized === null) {
    throw new Error("write_briefing: focus must be a non-empty string");
  }

  const original = contentJson ?? "";
  const doc = parseDoc(contentJson);
  const body = doc.content ?? [];
  const range = findFocusRange(body, dateKey);

  const section: TipTapNode[] = [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: `フォーカス ${dateKey}` }],
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
  if (doc.type === undefined) doc.type = "doc";
  const merged = JSON.stringify(doc);
  return merged === original ? original : merged;
}
