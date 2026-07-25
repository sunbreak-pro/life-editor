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
