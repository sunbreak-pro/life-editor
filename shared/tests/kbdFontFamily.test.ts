// @vitest-environment node (reads source files, renders nothing)
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * #1672 — every <kbd> names its font instead of inheriting preflight's.
 *
 * Tailwind preflight puts `kbd` on --font-mono. Nobody chose that for four of
 * the five keycaps; it just stayed, while the sidebar's hint had to move to
 * `font-sans` (#1468) because a fixed-pitch "Ctrl K" overran the row. The
 * result was two typefaces for the same kind of thing on one screen.
 *
 * The decision is sans everywhere (a keycap is chrome, not code). This scan
 * pins it for keycaps added later too: an element that forgets `font-sans`
 * would silently fall back to the monospace preflight default again.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(name) ? [path] : [];
  });
}

/** Comments mention <kbd> too; only real elements are under guard. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** The opening tag of each JSX <kbd> element, up to its closing `>`. */
function kbdOpeningTags(source: string): string[] {
  const text = withoutComments(source);
  const tags: string[] = [];
  const re = /<kbd[\s>]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    let depth = 0;
    let end = match.index;
    for (; end < text.length; end++) {
      const ch = text[end];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth === 0) break;
    }
    tags.push(text.slice(match.index, end + 1));
  }
  return tags;
}

describe("<kbd> font family (#1672)", () => {
  const found = sourceFiles(SRC).flatMap((file) =>
    kbdOpeningTags(readFileSync(file, "utf8")).map((tag) => ({
      file: relative(SRC, file).replace(/\\/g, "/"),
      tag,
    })),
  );

  it("finds the keycaps it is meant to guard", () => {
    // A scan that matches nothing would pass vacuously.
    expect(found.length).toBeGreaterThanOrEqual(5);
  });

  it("sets font-sans on every <kbd>", () => {
    const missing = found
      .filter(({ tag }) => !/\bfont-sans\b/.test(tag))
      .map(({ file }) => file);
    expect(missing).toEqual([]);
  });
});
