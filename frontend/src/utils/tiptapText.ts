export function extractTextFromTipTap(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  if (n.type === "text" && typeof n.text === "string") return n.text;
  if (Array.isArray(n.content))
    return n.content.map(extractTextFromTipTap).join(" ");
  return "";
}

export function getContentPreview(content: string, maxLength = 100): string {
  if (!content) return "";
  try {
    const parsed = JSON.parse(content);
    return extractTextFromTipTap(parsed).slice(0, maxLength) || "";
  } catch {
    // Legacy/HTML fallback: parse via DOMParser so embedded <script>/onerror
    // attributes are inert (parsed but not executed).
    const doc = new DOMParser().parseFromString(content, "text/html");
    return (doc.body.textContent ?? "").slice(0, maxLength);
  }
}

function findFirstHeadingNode(node: unknown): unknown | null {
  if (!node || typeof node !== "object") return null;
  const n = node as Record<string, unknown>;
  if (n.type === "heading") return n;
  if (Array.isArray(n.content)) {
    for (const child of n.content) {
      const found = findFirstHeadingNode(child);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Extract the plain text of the first heading node (h1/h2/h3) in a TipTap JSON
 * document. Returns null if no heading is found or content is empty/invalid.
 * Used by list views that want to surface a document's "title"
 * from its first heading instead of the stored note.title field.
 */
export function extractFirstHeading(content: string): string | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    const heading = findFirstHeadingNode(parsed);
    if (!heading) return null;
    const text = extractTextFromTipTap(heading).trim();
    return text || null;
  } catch {
    return null;
  }
}
