import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Code-split guard for the heaviest section bodies (#676 (a)).
 *
 * Notes carries the TipTap editor stack and Analytics carries recharts. (A
 * third row, Connect with the d3 force/zoom stack, left with the section in
 * #1152.) Each is reachable only through its own row of the section descriptor
 * table, so `lazySections.ts` loads it with lazy() and the table renders it
 * behind a <Suspense> boundary; that is what keeps those bundles out of the
 * initial chunk. A plain `import { NotesView } from "./notes/…"` added back
 * later would silently undo it — the app still works, the build still passes,
 * and only the dist listing (which nobody reads on a green PR) would show the
 * regression. This test reads the source instead.
 *
 * Source text rather than behaviour, deliberately: what is being protected is
 * a BUILD property (which module lands in which chunk). Rendering the table in
 * jsdom would prove nothing about chunking.
 *
 * The bodies moved out of MainScreen in #676 (b): the lazy() declarations into
 * lazySections.ts and the JSX into sectionDescriptors.tsx. The guard followed
 * them, and the boundary check is anchored on the component name rather than
 * on the old `section === "…" &&` guard the descriptor table replaced.
 */

const here = dirname(fileURLToPath(import.meta.url));
// CRLF-normalised: this repo is edited on both macOS and Windows, and the
// assertions below span line breaks.
const read = (rel: string): string =>
  readFileSync(resolve(here, rel), "utf8").replace(/\r\n/g, "\n");

const lazySections = read("../src/lazySections.ts");
const descriptors = read("../src/sectionDescriptors.tsx");
// A static import anywhere on the path from the shell to the screen re-merges
// the chunk, so BOTH files are checked for one.
const sources = `${lazySections}\n${descriptors}`;

const LAZY_SECTIONS = [
  { name: "NotesView", path: "./notes/NotesView" },
  { name: "AnalyticsScreen", path: "./analytics/AnalyticsScreen" },
] as const;

/** Escape a module specifier for use inside a RegExp. */
const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("the section descriptor table keeps the heavy bodies code-split", () => {
  for (const { name, path } of LAZY_SECTIONS) {
    it(`loads ${name} through lazy(() => import(...))`, () => {
      // Whitespace-tolerant: prettier may re-wrap the arrow body.
      const lazyImport = new RegExp(
        `lazy\\(\\(\\)\\s*=>\\s*\\n?\\s*import\\("${escape(path)}"\\)`,
      );
      expect(lazyImport.test(lazySections)).toBe(true);
    });

    it(`never imports ${name} statically, in any import form`, () => {
      // Anything ending in `from "<path>"` is a static import — named,
      // default (`import NotesView from …`), namespace (`import * as …`)
      // or side-effect-only. Matching on the `from` clause instead of the
      // binding shape is what makes this airtight; an earlier version only
      // looked for `{ … }` and would have waved a default import through.
      const staticImport = new RegExp(
        `import\\s[^;]*from\\s*"${escape(path)}"|import\\s*"${escape(path)}"`,
      );
      expect(staticImport.test(sources)).toBe(false);
    });

    it(`renders ${name} behind a Suspense boundary`, () => {
      // Anchored on the component rather than counting <Suspense> tags: a
      // global count passes as soon as any two unrelated boundaries exist
      // elsewhere in the file, which is exactly the regression this is for.
      // Only JSX punctuation, props and whitespace may sit between them.
      const guarded = new RegExp(`<Suspense[\\s\\S]{0,200}?<${name}`);
      expect(guarded.test(descriptors)).toBe(true);
    });
  }
});
