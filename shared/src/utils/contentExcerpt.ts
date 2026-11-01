/*
 * One-line excerpts of a stored TipTap body (#2224).
 *
 * Moved here from components/materials/dailyContent.ts, where it was
 * `dailyContentExcerpt`, so the notes read side (services/) can use the very
 * same rule the Daily list does without importing from components/. A daily
 * and a note store their bodies the same way (`content_json`, TipTap doc JSON
 * or legacy plain text), so "the first line the user wrote" is one question
 * with one answer.
 *
 * No React, no DataService — unit-tested in shared/tests/dailyContent.test.ts
 * and shared/tests/noteExcerptsRead.test.ts.
 */

export interface TipTapNode {
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
 * Parse a stored body as a TipTap doc. Returns null when the string is not one
 * (legacy plain text, or JSON that isn't a doc — e.g. "123" parses to a
 * number, and an arbitrary object has no `type: "doc"`).
 */
export function parseTipTapDoc(content: string): TipTapDoc | null {
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

/** First non-empty text line of a body (plain or TipTap JSON), for one-line excerpts. */
export function contentExcerpt(
  content: string | undefined,
): string | undefined {
  if (!content) return undefined;
  const doc = parseTipTapDoc(content);
  if (doc) return blocksExcerpt(doc.content);
  const line = content
    .split("\n")
    .map((s) => s.trim())
    .find(Boolean);
  return line || undefined;
}

/**
 * The same rule over the top-level blocks alone — for a read that fetched only
 * the head of a body (the notes excerpt read, which never loads the rest).
 * Entries that are not nodes (a missing block reads back as null) are skipped.
 */
export function blocksExcerpt(
  blocks: readonly (TipTapNode | null | undefined)[],
): string | undefined {
  for (const block of blocks) {
    if (block === null || block === undefined || typeof block !== "object") {
      continue;
    }
    const t = textOf(block).trim();
    if (t !== "") return t;
  }
  return undefined;
}
