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
 *   - dailyContentExcerpt: first non-empty text line for list excerpts,
 *     readable from both forms.
 *
 * No React, no DataService — unit-tested in shared/tests/dailyContent.test.ts.
 */

interface TipTapNode {
  type?: string;
  text?: string;
  content?: TipTapNode[];
}

export interface TipTapDoc {
  type: "doc";
  content: TipTapNode[];
}

/** Flatten a TipTap node subtree to plain text (same shape as extractBriefing). */
function textOf(node: TipTapNode): string {
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.content)) return "";
  return node.content.map(textOf).join("");
}

/**
 * Parse a stored daily body as a TipTap doc. Returns null when the string is
 * not one (legacy plain text, or JSON that isn't a doc — e.g. "123" parses to
 * a number, and an arbitrary object has no `type: "doc"`).
 */
function parseTipTapDoc(content: string): TipTapDoc | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as TipTapNode).type === "doc" &&
      Array.isArray((parsed as TipTapNode).content)
    ) {
      return parsed as TipTapDoc;
    }
  } catch {
    // fall through — legacy plain text
  }
  return null;
}

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

/** First non-empty text line of a daily body (plain or TipTap JSON), for one-line excerpts. */
export function dailyContentExcerpt(
  content: string | undefined,
): string | undefined {
  if (!content) return undefined;
  const doc = parseTipTapDoc(content);
  if (doc) {
    for (const block of doc.content) {
      const t = textOf(block).trim();
      if (t !== "") return t;
    }
    return undefined;
  }
  const line = content
    .split("\n")
    .map((s) => s.trim())
    .find(Boolean);
  return line || undefined;
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
 * `dailyContentExcerpt !== undefined`, which only sees TEXT.
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
