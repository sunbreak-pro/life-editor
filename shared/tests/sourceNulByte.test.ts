import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/*
 * #1877 — useTourProgress.ts held a RAW NUL byte inside `stepIds.join(...)`
 * instead of the two-character escape. Nothing broke at runtime, which is
 * exactly why it survived: `file` reported the module as `data`, so grep and
 * rg classified it as binary and skipped it without a word. Every rename sweep
 * and every "where is this used" search silently missed one file.
 *
 * A control byte in source is never the intent — the escape says the same
 * thing and stays greppable — so this scans the live packages rather than
 * pinning the one file that happened to have it.
 */

const SOURCE_ROOTS = ["../src", "../../web/src", "../../desktop/src"];

function sourceFilesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFilesUnder(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("source files stay text, not binary (#1877)", () => {
  it("has no raw NUL byte in any .ts / .tsx under the live packages", () => {
    const roots = SOURCE_ROOTS.map((rel) =>
      fileURLToPath(new URL(rel, import.meta.url)),
    );
    // Byte-level on purpose: read as utf8 and a NUL arrives as a harmless
    // "\u0000" in the string, which is the reading that hid this for months.
    const offenders = roots
      .flatMap(sourceFilesUnder)
      .filter((file) => readFileSync(file).includes(0));

    expect(offenders).toEqual([]);
  });
});
