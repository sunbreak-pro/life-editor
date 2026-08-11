/*
 * `content_json` (jsonb) <-> string conversion, shared by every payload
 * table that stores TipTap document bodies (`notes_payload.content_json`
 * and `dailies_payload.content_json` today).
 *
 * Both mappers carried a byte-identical private copy of these two
 * functions — dailiesUnifiedMapper's section header even said "shared
 * shape with notesUnifiedMapper" — so a fix to one silently missed the
 * other. One implementation now, imported by both (#670 C3 PR 2).
 *
 * NOT the same as `mcp-server/src/utils/content.ts`, which is a third copy
 * living in a different package. Merging across the package boundary needs
 * the shared build contract from #677 (C7) and is out of scope here.
 */

/**
 * Materialize a domain `content` string from a payload `content_json`
 * (jsonb) value. NULL / undefined -> empty string. An already-string jsonb
 * value (e.g. a primitive string stored at the top level) comes back as-is
 * to preserve legacy data shapes; otherwise JSON.stringify the object.
 */
export function contentJsonToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/**
 * Project a domain `content` string into a payload `content_json` (jsonb)
 * value. Empty string -> null (so a fresh item doesn't store the JSON
 * literal `""`). Otherwise attempt JSON.parse; if the parse fails, store
 * the raw string as a jsonb string literal (legacy safety — TipTap is the
 * normal producer, but ad-hoc free text MUST not throw on write, and the
 * round-trip re-materialises the same string on read).
 */
export function contentStringToJson(value: string): unknown {
  if (value === "") return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
