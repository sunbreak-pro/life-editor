/*
 * The day's ONE text (#2107, D-20261006-main-1) — what the evening paper's
 * 「一日の締めくくり」edits now, and what the Daily body will edit (#2123).
 *
 * Definition: the Daily body MINUS the 朝刊 section, the 宣言 section, the
 * 「夕刊」heading and its「気分: n/5」line, the rest kept in document order.
 * It is deliberately "what is left" rather than "the 夕刊 section's body":
 * a section ends at the next heading, so a heading the user types inside
 * their own text would otherwise cut the text in two (plan §Daily と夕刊の
 * 文章を 1 本にする).
 *
 * The write puts the whole text back under the「夕刊」heading (after the mood
 * line) as one block and keeps every excluded node as the very object it was.
 * A text that reads the same as what is stored returns the input itself, so
 * merely opening a day — or opening its editor — never moves an old body into
 * the 夕刊 section: the plan's「保存し直すのは編集したときだけ」, enforced
 * here as well as in the hosts.
 *
 * Heading-less text AFTER the 朝刊 or 宣言 lines (A1): write_briefing
 * prepends 朝刊 above an old body, and typing at the end of a Daily lands
 * under 宣言. By the plan's definition a section runs to the next heading, so
 * that text belongs to the 朝刊 / 宣言 section and is excluded from the one
 * text here, while plan l.221 expects it in the reflection field. How to treat
 * it is an open decision, raised in the #2107 PR (there is no queue entry).
 * This module's write leaves that text where it is, but it is NOT safe there:
 * the section writers replace the whole [heading, next heading) range, so a
 * later 宣言 save (mergeIntentionSection — from MCP or an older client; the
 * app itself stops writing 宣言 with #2106 / #2107) replaces text typed after
 * the 宣言 lines with whatever declaration it writes.
 *
 * Known limits, pinned in shared/tests/dailyText.test.ts:
 *   - A2: a user heading spelled 朝刊 / 宣言 / 夕刊 is read as that section.
 *   - A3: on a day without a mood, a text whose first paragraph looks like
 *     「気分: n/5」becomes the mood line once written.
 *
 * Pure module (no React, no DataService).
 */

import {
  BRIEFING_HEADING_RE,
  EVENING_HEADING_RE,
  INTENTION_HEADING_RE,
  findSectionRange,
  parseDailyDoc,
  type TipTapNode,
} from "./dailySections";
import {
  eveningBodyEquals,
  extractEveningSection,
  isEmptyDocJson,
} from "./eveningSection";

/**
 * Indexes of the top-level nodes that are NOT part of the one text. The mood
 * line is asked of `extractEveningSection` so its pattern lives in one place.
 */
function excludedIndexes(
  body: TipTapNode[],
  contentJson: string | null | undefined,
): {
  excluded: Set<number>;
  /** The node the text goes after: the mood line, else the 夕刊 heading. */
  eveningAnchor: number | null;
  hasMood: boolean;
} {
  const excluded = new Set<number>();
  for (const re of [BRIEFING_HEADING_RE, INTENTION_HEADING_RE]) {
    const range = findSectionRange(body, re);
    if (range === null) continue;
    for (let i = range.start; i < range.end; i++) excluded.add(i);
  }
  const evening = findSectionRange(body, EVENING_HEADING_RE);
  if (evening === null)
    return { excluded, eveningAnchor: null, hasMood: false };
  excluded.add(evening.start);
  const hasMood = extractEveningSection(contentJson).mood !== null;
  if (hasMood) excluded.add(evening.start + 1);
  return {
    excluded,
    eveningAnchor: hasMood ? evening.start + 1 : evening.start,
    hasMood,
  };
}

/** The one text as a TipTap doc JSON, or null when it holds no text. */
export function readDailyText(
  contentJson: string | null | undefined,
): string | null {
  const body = parseDailyDoc(contentJson).content ?? [];
  const { excluded } = excludedIndexes(body, contentJson);
  const doc = JSON.stringify({
    type: "doc",
    content: body.filter((_, i) => !excluded.has(i)),
  });
  return isEmptyDocJson(doc) ? null : doc;
}

/** Parsed top-level nodes of a text doc, [] for an empty / unreadable one. */
function textNodes(textDocJson: string | null): TipTapNode[] {
  if (textDocJson === null || isEmptyDocJson(textDocJson)) return [];
  try {
    const parsed = JSON.parse(textDocJson) as TipTapNode;
    return Array.isArray(parsed.content) ? parsed.content : [];
  } catch {
    return [];
  }
}

/**
 * Write `textDocJson` back as the day's one text and return the new content.
 * Returns the input unchanged (===) when the text reads the same as what is
 * stored, so a caller can skip the write.
 */
export function writeDailyText(
  contentJson: string | null | undefined,
  textDocJson: string | null,
): string {
  const original = contentJson ?? "";
  const nodes = textNodes(textDocJson);
  const next = nodes.length === 0 ? null : textDocJson;
  if (eveningBodyEquals(readDailyText(contentJson), next)) return original;

  const doc = parseDailyDoc(contentJson);
  const body = doc.content ?? [];
  const { excluded, eveningAnchor, hasMood } = excludedIndexes(
    body,
    contentJson,
  );

  const out: TipTapNode[] = [];
  body.forEach((node, i) => {
    if (!excluded.has(i)) return;
    // An empty text on a day without a mood takes the「夕刊」heading with
    // it — the same "never keep an empty section" rule mergeEveningSection
    // follows.
    if (i === eveningAnchor && !hasMood && nodes.length === 0) return;
    out.push(node);
    if (i === eveningAnchor) out.push(...nodes);
  });
  if (eveningAnchor === null && nodes.length > 0) {
    out.push(
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "夕刊" }],
      },
      ...nodes,
    );
  }
  doc.content = out;
  return JSON.stringify(doc);
}
