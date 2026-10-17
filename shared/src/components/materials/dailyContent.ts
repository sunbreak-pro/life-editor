/*
 * Daily body content helpers (F-1 #258). A DailyNode's `content` is a string
 * that is EITHER a TipTap doc JSON (rich editor / MCP write_briefing) OR a
 * legacy plain-text body from the pre-F-1 textarea era. These pure helpers
 * bridge the two without ever mutating stored data:
 *
 *   - dailyContentToEditorContent: what the TipTap editor should mount with.
 *     Legacy plain text is converted line-by-line to paragraphs AT READ TIME
 *     ONLY — the JSON form is persisted lazily, on the user's first edit
 *     (the editor emits JSON on update; an untouched daily is never written).
 *   - the one-line excerpt lives in utils/contentExcerpt.ts as
 *     `contentExcerpt` (#2224 — shared with the Connect note rows).
 *
 * No React, no DataService — unit-tested in shared/tests/dailyContent.test.ts.
 */

import {
  parseTipTapDoc,
  type TipTapDoc,
  type TipTapNode,
} from "../../utils/contentExcerpt";

export type { TipTapDoc };

/** Build a TipTap doc from plain text: one paragraph per line (empty line = empty paragraph). */
export function plainTextToTipTapDoc(text: string): TipTapDoc {
  return {
    type: "doc",
    // \r?\n: Windows-era plain bodies would otherwise leave a trailing \r
    // on every paragraph.
    content: text.split(/\r?\n/).map((line): TipTapNode => {
      // TipTap forbids empty text nodes — an empty line is a bare paragraph.
      if (line === "") return { type: "paragraph" };
      return { type: "paragraph", content: [{ type: "text", text: line }] };
    }),
  };
}

/**
 * Editor-ready content for a stored daily body: `undefined` for an absent /
 * empty body (empty editor), the string unchanged when it already is a TipTap
 * doc JSON, or the plain-text body converted to a doc JSON otherwise.
 */
export function dailyContentToEditorContent(
  content: string | undefined,
): string | undefined {
  if (content === undefined || content === "") return undefined;
  if (parseTipTapDoc(content) !== null) return content;
  return JSON.stringify(plainTextToTipTapDoc(content));
}

/** TipTap node types that carry no text of their own and no children. */
const STRUCTURAL_TYPES = new Set(["doc", "paragraph", "text"]);

function hasRenderedNode(node: TipTapNode): boolean {
  if (typeof node.text === "string" && node.text.trim() !== "") return true;
  // An atom (itemLink, image, horizontalRule…) has no text and no children,
  // yet the user sees it. Anything outside the structural set counts. A node
  // with no `type` at all is malformed — treat it as structural (invisible)
  // rather than letting it force a save.
  if (node.type !== undefined && !STRUCTURAL_TYPES.has(node.type)) return true;
  if (!Array.isArray(node.content)) return false;
  return node.content.some(hasRenderedNode);
}

/**
 * Does this body show the user anything? Broader than
 * `contentExcerpt !== undefined`, which only sees TEXT.
 *
 * The gap this closes (#371 follow-up): a resolved `[[ ]]` link is an inline
 * ATOM — its JSON carries attrs, never a text node — so a brand-new day whose
 * body is just a link read as empty. The caller that skips saving empty bodies
 * (so an abandoned day never mints a DailyNode) therefore skipped the save
 * that both persists the link AND creates the items_meta row the link's graph
 * edge FK-references. The link vanished on reload and its edge was never
 * written.
 */
export function dailyContentHasRenderedContent(
  content: string | undefined,
): boolean {
  if (!content) return false;
  const doc = parseTipTapDoc(content);
  if (doc) return doc.content.some(hasRenderedNode);
  return content.trim() !== "";
}
