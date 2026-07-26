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

/*
 * There is deliberately no string→jsonb helper here: every write path
 * already holds a TipTap document object (markdownToTiptap / the
 * generate_content builders) and hands it to PostgREST as-is.
 */
