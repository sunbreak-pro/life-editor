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
  { name: "AnalyticsScreen", path: "./analytics/AnalyticsScreen" },
  { name: "ConnectScreen", path: "./connect/ConnectScreen" },
] as const;

describe("MainScreen keeps the heavy section bodies code-split", () => {
  for (const { name, path } of LAZY_SECTIONS) {
    it(`loads ${name} through lazy(() => import(...))`, () => {
      // Whitespace-tolerant: prettier may re-wrap the arrow body.
      const lazyImport = new RegExp(
        `lazy\\(\\(\\)\\s*=>\\s*\\n?\\s*import\\("${path.replace(/\./g, "\\.")}"\\)`,
      );
      expect(lazyImport.test(mainScreen)).toBe(true);
    });

    it(`never imports ${name} statically`, () => {
      // A static import of the module — with or without other named bindings.
      const staticImport = new RegExp(
        `import\\s*\\{[^}]*\\}\\s*from\\s*"${path.replace(/\./g, "\\.")}"`,
      );
      expect(staticImport.test(mainScreen)).toBe(false);
    });
  }

  it("wraps every lazy section in a Suspense boundary", () => {
    // Without a boundary the lazy import throws to the nearest ancestor
    // Suspense — or, if there is none, blanks the shell.
    const suspenseCount = mainScreen.match(/<Suspense/g)?.length ?? 0;
    // Notes (pre-existing) + Analytics + Connect.
    expect(suspenseCount).toBeGreaterThanOrEqual(3);
  });
});
