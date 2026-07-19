/*
 * jsonDocEquals — semantic equality for two serialized JSON documents.
 *
 * Postgres `jsonb` does not preserve object key order (keys come back
 * sorted length-then-bytewise), so a document string that round-trips
 * through a jsonb column can differ byte-wise from what was written while
 * representing the same document — e.g. a TipTap text node is emitted as
 * `{"type":"text","text":…}` but returned as `{"text":…,"type":"text"}`.
 * Byte equality is therefore the wrong test for "is this stored content my
 * own write echoing back" (#300: the Daily editor remounted on every save
 * echo, flashing its [[wiki-link]] pills and dropping the caret).
 *
 * Strings that are not JSON fall back to plain byte equality (legacy
 * plain-text daily bodies are stored unwrapped and never hit the reorder
 * problem).
 */
export function jsonDocEquals(a: string, b: string): boolean {
  if (a === b) return true;
  let va: unknown;
  let vb: unknown;
  try {
    va = JSON.parse(a);
    vb = JSON.parse(b);
  } catch {
    // At least one side is not JSON and the bytes already differ.
    return false;
  }
  return jsonValueEquals(va, vb);
}

/** Deep equality over parsed JSON values (object key order ignored). */
function jsonValueEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((v, i) => jsonValueEquals(v, b[i]));
  }
  if (
    typeof a === "object" &&
    typeof b === "object" &&
    a !== null &&
    b !== null
  ) {
    const ra = a as Record<string, unknown>;
    const rb = b as Record<string, unknown>;
    const keys = Object.keys(ra);
    if (keys.length !== Object.keys(rb).length) return false;
    return keys.every(
      (k) =>
        Object.prototype.hasOwnProperty.call(rb, k) &&
        jsonValueEquals(ra[k], rb[k]),
    );
  }
  return false;
}
