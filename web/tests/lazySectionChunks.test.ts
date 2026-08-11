import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Code-split guard for the two heaviest section bodies (#676 (a)).
 *
 * Analytics carries recharts and Connect carries the d3 force/zoom stack. Both
 * are reachable only behind their own `section === …` guard, so MainScreen
 * loads them with lazy() + <Suspense>; that is what keeps ~160 kB out of the
 * initial chunk. A plain `import { ConnectScreen } from "./connect/…"` added
 * back later would silently undo it — the app still works, the build still
 * passes, and only the dist listing (which nobody reads on a green PR) would
 * show the regression. This test reads the source instead.
 *
 * Source text rather than behaviour, deliberately: what is being protected is
 * a BUILD property (which module lands in which chunk). Rendering MainScreen
 * in jsdom would prove nothing about chunking, and MainScreen needs a Supabase
 * session to render at all.
 */

const here = dirname(fileURLToPath(import.meta.url));
// CRLF-normalised: this repo is edited on both macOS and Windows, and the
// assertions below span line breaks.
const mainScreen = readFileSync(
  resolve(here, "../src/MainScreen.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

const LAZY_SECTIONS = [
  {
    name: "AnalyticsScreen",
    path: "./analytics/AnalyticsScreen",
    section: "analytics",
  },
  {
    name: "ConnectScreen",
    path: "./connect/ConnectScreen",
    section: "connect",
  },
] as const;

/** Escape a module specifier for use inside a RegExp. */
const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("MainScreen keeps the heavy section bodies code-split", () => {
  for (const { name, path, section } of LAZY_SECTIONS) {
    it(`loads ${name} through lazy(() => import(...))`, () => {
      // Whitespace-tolerant: prettier may re-wrap the arrow body.
      const lazyImport = new RegExp(
        `lazy\\(\\(\\)\\s*=>\\s*\\n?\\s*import\\("${escape(path)}"\\)`,
      );
      expect(lazyImport.test(mainScreen)).toBe(true);
    });

    it(`never imports ${name} statically, in any import form`, () => {
      // Anything ending in `from "<path>"` is a static import — named,
      // default (`import ConnectScreen from …`), namespace (`import * as …`)
      // or side-effect-only. Matching on the `from` clause instead of the
      // binding shape is what makes this airtight; an earlier version only
      // looked for `{ … }` and would have waved a default import through.
      const staticImport = new RegExp(
        `import\\s[^;]*from\\s*"${escape(path)}"|import\\s*"${escape(path)}"`,
      );
      expect(staticImport.test(mainScreen)).toBe(false);
    });

    it(`renders ${name} behind a Suspense boundary`, () => {
      // Anchored at the section guard rather than counting <Suspense> tags:
      // a global count passes as soon as any two unrelated boundaries exist
      // elsewhere in the file, which is exactly the regression this is for.
      // The guard and the boundary must be adjacent — only JSX punctuation
      // and whitespace between them.
      const guarded = new RegExp(
        `section === "${section}" &&[\\s(\\n]*<Suspense`,
      );
      expect(guarded.test(mainScreen)).toBe(true);
    });
  }

  it("keeps the pre-existing Notes boundary", () => {
    // NotesView was already lazy (#475 era). Nothing here should have taken
    // its boundary away while adding the other two.
    expect(/<NotesView/.test(mainScreen)).toBe(true);
    expect(/<Suspense[\s\S]{0,200}?<NotesView/.test(mainScreen)).toBe(true);
  });
});
