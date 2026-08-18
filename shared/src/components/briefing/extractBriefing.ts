/*
 * Briefing extraction — the read half of the write_briefing convention.
 *
 * Convention (Briefing plan Step 2/3): the MCP `write_briefing` tool (or any
 * writer, including the user typing in the Daily editor) puts the morning
 * briefing INSIDE today's DailyNode content as a TipTap section:
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
 * Storing the briefing inside the existing dailies_payload row means Step 1
 * ships with ZERO DDL: the DailyNode is already synced, soft-deletable and
 * MCP-reachable. This parser is deliberately forgiving — a daily without the
 * section (or with unparseable content) yields `null` and the view hides the
 * AI comment block.
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
