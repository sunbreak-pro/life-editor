import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Code-split guard for the TipTap editor (#991).
 *
 * Same shape as lazySectionChunks.test.ts, and for the same reason: what is
 * being protected is a BUILD property — which module lands in the first
 * download — so the check reads source text rather than rendering anything.
 *
 * The failure this exists for is specific and has happened once already at the
 * section level. RichTextEditor is 389 KB of TipTap + ProseMirror. Notes has
 * been behind lazy() since #676 (a), but Briefing, Daily and the todo detail
 * each imported the editor DIRECTLY, and Briefing is the default landing
 * section — so one of those three static imports was enough to put the whole
 * editor back in the first download while the Notes split still looked intact.
 * Nothing errors, the build stays green, and only the dist listing shows it.
 *
 * The allowed static importers all live inside NotesView, which is itself lazy,
 * so their copy is off the first download anyway and a second boundary there
 * would only delay typing.
 */

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, "../src");

/** Every .ts/.tsx under web/src, as [repo-relative path, CRLF-normalised text]. */
function sourceFiles(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) {
        out.push([
          relative(srcDir, full).replace(/\\/g, "/"),
          readFileSync(full, "utf8").replace(/\r\n/g, "\n"),
        ]);
      }
    }
  };
  walk(srcDir);
  return out;
}

/** Files allowed to name RichTextEditor without going through lazy(). */
const ALLOWED = new Set([
  // The boundary itself — its import() is what makes the chunk.
  "notes/LazyRichTextEditor.tsx",
  // The module being imported.
  "notes/RichTextEditor.tsx",
  // Inside the already-lazy NotesView chunk; see the header.
  "notes/NoteBodyEditor.tsx",
  // Same: the templates panel (#1047) is mounted by NotesView, so its copy of
  // the editor rides in the Notes chunk rather than the first download.
  "notes/NoteTemplateHost.tsx",
]);

describe("the TipTap editor stays out of the initial chunk", () => {
  it("is reached through lazy(() => import(...)) in exactly one place", () => {
    const boundary = readFileSync(
      resolve(srcDir, "notes/LazyRichTextEditor.tsx"),
      "utf8",
    ).replace(/\r\n/g, "\n");

    // Whitespace-tolerant: prettier may re-wrap the arrow body.
    expect(
      /lazy\(\(\)\s*=>\s*\n?\s*import\("\.\/RichTextEditor"\)/.test(boundary),
    ).toBe(true);
  });

  it("is warmed through the same specifier as the boundary", () => {
    // #1115 fetches the chunk ahead of the gesture that needs it. A different
    // specifier here would emit a SECOND chunk — the warm-up would download
    // TipTap twice and the boundary would still wait, with every assertion
    // above still green.
    // No CRLF normalisation needed: the assertion spans no line break.
    const preload = readFileSync(
      resolve(srcDir, "notes/preloadRichTextEditor.ts"),
      "utf8",
    );

    expect(/import\("\.\/RichTextEditor"\)/.test(preload)).toBe(true);
  });

  it("is never imported statically outside the allowed files", () => {
    // Anything ending in `from "…/RichTextEditor"` is a static import —
    // named, default, namespace or side-effect-only. Matching the `from`
    // clause rather than the binding shape is what makes this airtight.
    const staticImport =
      /import\s[^;]*from\s*"[^"]*\/RichTextEditor"|import\s*"[^"]*\/RichTextEditor"/;

    const offenders = sourceFiles()
      .filter(([path]) => !ALLOWED.has(path))
      .filter(([, text]) => staticImport.test(text))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });

  it("does not re-introduce a manualChunks vendor split", () => {
    /*
     * The vendor split named a chunk without removing it from the entry
     * graph, so index.html preloaded it anyway — the same bytes in more
     * requests, while the build output looked smaller. If it comes back, the
     * measurements in this Issue stop meaning what they say.
     */
    const config = readFileSync(resolve(here, "../vite.config.ts"), "utf8");
    expect(config).not.toMatch(/^\s*manualChunks\s*\(/m);
  });
});
