export function extractTextFromTipTap(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  if (n.type === "text" && typeof n.text === "string") return n.text;
  if (Array.isArray(n.content))
    return n.content.map(extractTextFromTipTap).join(" ");
  return "";
}

/*
 * `getContentPreview` lived here until #702 ①. It was a second copy of
 * contentPlainText + slice that only handled TipTap *strings*, so the jsonb
 * bodies (notes / dailies) could not use it and sliced by hand instead. The
 * one preview every tool shares is now `contentPreview` in ./content.ts.
 */
