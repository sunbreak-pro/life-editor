import { extractTextFromTipTap } from "./tiptapText";

/**
 * Wrap plain text as a TipTap JSON document string.
 */
export function wrapTextAsTipTap(text: string): string {
  if (!text.trim()) return "";
  const paragraphs = text.split("\n").map((line) => ({
    type: "paragraph" as const,
    content: line ? [{ type: "text" as const, text: line }] : [],
  }));
  return JSON.stringify({ type: "doc", content: paragraphs });
}

/**
 * Extract plain text from a TipTap JSON string.
 */
export function extractPlainText(tiptapJson: string): string {
  if (!tiptapJson) return "";
  try {
    const parsed = JSON.parse(tiptapJson);
    return extractTextFromTipTap(parsed);
  } catch {
    return tiptapJson;
  }
}

/**
 * Merge TaskNode content (TipTap JSON) with a plain-text memo into a single TipTap JSON string.
 */
export function mergeContentWithMemo(
  content?: string,
  memo?: string | null,
): string {
  const parts: string[] = [];

  if (content) {
    try {
      // Validate it's parseable TipTap JSON; pass through as-is if so
      JSON.parse(content);
      parts.push(content);
    } catch {
      // Not JSON — wrap as TipTap
      parts.push(wrapTextAsTipTap(content));
    }
  }

  if (memo) {
    const memoDoc = wrapTextAsTipTap(memo);
    if (memoDoc) parts.push(memoDoc);
  }

  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];

  // Merge multiple TipTap docs by concatenating their content arrays
  const merged: unknown[] = [];
  for (const part of parts) {
    try {
      const doc = JSON.parse(part);
      if (doc.content && Array.isArray(doc.content)) {
        merged.push(...doc.content);
      }
    } catch {
      // skip
    }
  }
  return JSON.stringify({ type: "doc", content: merged });
}
