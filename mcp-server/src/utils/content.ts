import { extractTextFromTipTap } from "./tiptapText.js";

/*
 * jsonb content helpers (#360).
 *
 * The unified schema stores note / daily bodies in `content_json` (jsonb),
 * whereas the legacy SQLite tables kept a TipTap JSON *string*. PostgREST
 * hands jsonb back as a parsed value, so every read normalises it and every
 * write parses it — the same policy as notesUnifiedMapper /
 * dailiesUnifiedMapper in shared/.
 */

/** jsonb value → TipTap JSON string ("" when empty). */
export function contentJsonToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/** jsonb value → plain text, for previews and substring search. */
export function contentPlainText(value: unknown): string {
  const s = contentJsonToString(value);
  if (s === "") return "";
  try {
    return extractTextFromTipTap(JSON.parse(s)).trim();
  } catch {
    return s;
  }
}

/** Characters of body text a list result carries per item. */
export const PREVIEW_LENGTH = 100;

/**
 * jsonb value or TipTap JSON string → a short plain-text preview (#702 ①).
 *
 * The one preview used by every list-shaped tool. `search_all` grew its own
 * copy of this line three times over while `list_tasks` / `list_notes`
 * returned whole documents instead — the reason a single note read used to
 * cost a whole collection of TipTap JSON.
 */
export function contentPreview(
  value: unknown,
  maxLength = PREVIEW_LENGTH,
): string {
  return contentPlainText(value).slice(0, maxLength);
}

/*
 * There is deliberately no string→jsonb helper here: every write path
 * already holds a TipTap document object (markdownToTiptap / the
 * generate_content builders) and hands it to PostgREST as-is.
 */
