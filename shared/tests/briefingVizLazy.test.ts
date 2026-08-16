import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Code-split guard for the briefing's recharts widgets (#991).
 *
 * Source text rather than behaviour, for the reason lazySectionChunks.test.ts
 * gives: the property under protection is which module lands in the first
 * download, and rendering in jsdom proves nothing about chunking.
 *
 * Why this one is easy to undo by accident: BriefingVizPanel is exported from
 * the shared barrel, and Briefing is the default landing section
 * (useStartupSection). A static `import { WorkBreakBalance }` added back here
 * puts ~296 KB of recharts into the first download of every session, including
 * sessions that never open the panel — with no error, no failing build, and no
 * visible symptom short of measuring the bundle.
 *
 * StreakDisplay is deliberately NOT in this list: it imports no charting code
 * at all, so deferring it would buy nothing and add a boundary to flicker
 * through. If it ever gains a chart, it belongs here.
 */

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  resolve(here, "../src/components/briefing/BriefingVizPanel.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

const LAZY_CHARTS = ["TodoCompletionTrend", "WorkBreakBalance"] as const;

describe("the briefing panel keeps recharts out of the initial chunk", () => {
  for (const name of LAZY_CHARTS) {
    it(`loads ${name} through lazy(() => import(...))`, () => {
      // Whitespace-tolerant: prettier may re-wrap the arrow body.
      const lazyImport = new RegExp(
        `lazy\\(\\(\\)\\s*=>\\s*\\n?\\s*import\\("\\.\\./Analytics/${name}"\\)`,
      );
      expect(lazyImport.test(source)).toBe(true);
    });

    it(`never imports ${name} as a value`, () => {
      /*
       * `import type { …Labels }` is fine and is what the props still use —
       * type-only imports are erased, so they name the module without pulling
       * it into the chunk. Only a VALUE import re-merges it, so the check
       * excludes any import line that starts with `import type`.
       */
      const valueImport = new RegExp(
        `import\\s+(?!type\\s)[^;]*from\\s*"\\.\\./Analytics/${name}"`,
      );
      expect(valueImport.test(source)).toBe(false);
    });
  }

  it("renders them behind a Suspense boundary", () => {
    // Anchored on the first chart rather than counting <Suspense> tags: a
    // global count passes as soon as any two unrelated boundaries exist.
    expect(/<Suspense[\s\S]{0,400}?<TodoCompletionTrend/.test(source)).toBe(
      true,
    );
  });
});
