/*
 * 宣言 (Intention) section helpers — briefing-loop Step 4.
 *
 * Contract (same DDL-zero convention family as 朝刊 / 夕刊):
 *
 *   heading whose text is "宣言" / "Intention" (or "Intentions")
 *     paragraph per line → the user's declaration for the day
 *   ...the next heading (any text) ends the section.
 *
 * The loop: the user declares in the morning paper, the evening paper shows
 * the declaration back while the day is closed, and the next morning's
 * write_briefing critiques it (get_today_context reads the daily body raw,
 * so the declaration reaches the analysis with no MCP change).
 *
 * The morning input is a plain-line surface, so the section body is modelled
 * as LINES: extraction flattens the section to newline-joined text (list
 * items count one per line), and the merge writes one paragraph per line.
 * Richer markup written into the section from the Daily side survives until
 * the next morning-paper edit, which rewrites the section as paragraphs
 * (the same "last writing surface wins, per section" rule as the mood line).
 *
 * `mergeIntentionSection` is the concurrency-safe write shared with the
 * evening tab: read the WHOLE content → replace only the 宣言 range → write
 * back, so a save never clobbers the 朝刊 / 夕刊 sections or Daily-side
 * edits. A new section lands right below the 朝刊 section (or at the top
 * when there is none — the morning writer's later prepend still puts the
 * paper above it).
 *
 * Pure module (no React, no DataService) — unit-tested in
 * shared/tests/intentionSection.test.ts.
 */

import {
  BRIEFING_HEADING_RE,
  INTENTION_HEADING_RE,
  findSectionRange,
  parseDailyDoc,
  textOf,
  type TipTapNode,
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

/** Section nodes → one trimmed line per block (list items line-by-line). */
function sectionLines(nodes: TipTapNode[]): string[] {
  const lines: string[] = [];
  for (const node of nodes) {
    const blocks =
      (node.type === "bulletList" || node.type === "orderedList") &&
      Array.isArray(node.content)
        ? node.content
        : [node];
    for (const block of blocks) {
      const line = textOf(block).trim();
      if (line !== "") lines.push(line);
    }
  }
  return lines;
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

/**
 * Section-merge write: put a declaration text into a stored daily body and
 * return the new content string. Reads the whole document, replaces only the
 * 宣言 [heading, next heading) range, and leaves every other block untouched.
 * A normalized-empty text removes an existing section and never creates one.
 * Returns the input unchanged (===) when there is nothing to do, so callers
 * can skip the write.
 */
export function mergeIntentionSection(
  contentJson: string | null | undefined,
  text: string | null,
): string {
  const original = contentJson ?? "";
  const doc = parseDailyDoc(contentJson);
  const body = doc.content ?? [];
  const range = findSectionRange(body, INTENTION_HEADING_RE);
  const normalized = normalizeIntentionText(text);

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
      content: [{ type: "text", text: "宣言" }],
    },
    ...normalized.split("\n").map((line): TipTapNode => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    })),
  ];

  if (range !== null) {
    body.splice(range.start, range.end - range.start, ...section);
  } else {
    const briefing = findSectionRange(body, BRIEFING_HEADING_RE);
    body.splice(briefing === null ? 0 : briefing.end, 0, ...section);
  }
  doc.content = body;
  const merged = JSON.stringify(doc);
  return merged === original ? original : merged;
}
