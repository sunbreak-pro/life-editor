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
    // Fallback: strip HTML tags
    const tmp = document.createElement("div");
    tmp.innerHTML = content;
    return (tmp.textContent || tmp.innerText || "").slice(0, maxLength);
  }
}
