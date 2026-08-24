import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

/*
 * web-side vitest (added with #475 — the editor's click-navigation regression
 * had no test because `web/` had no runner at all).
 *
 * Tests live in `tests/` — a sibling of `src/`, matching shared/vitest.config.ts
 * and for the same reason: `tsconfig.app.json` has `include: ["src"]`, so test
 * files under src/ would be pulled into `tsc -b --force` and into the vite
 * bundle's module graph. Keeping them out leaves the build shape untouched.
 *
 * The vite config is MERGED IN rather than re-declared: `@life-editor/shared`
 * is an alias onto ../shared/src (consumed from source, Phase 1 — so no
 * `shared` build step is needed here) and react & friends need `dedupe` to stay
 * single-instance. A hand-rolled resolve block here would silently drift from
 * the one the app actually builds with.
 *
 * environment: jsdom — these suites drive the TipTap/ProseMirror editor, which
 * needs a DOM. jsdom has no LAYOUT, so anything that maps screen coordinates
 * back to a document position (ProseMirror's posAtCoords, and every click
 * handler built on it) is untestable here — see itemLinkClick.test.tsx.
 */
/*
 * #1079 — the pin is THIS ASSIGNMENT, not the `test.env` entry below.
 *
 * `test.env` is handed to each worker as an env object. A `pool: "threads"`
 * worker is a thread of this process, and Node re-reads the zone from
 * `process.env.TZ` only in the MAIN thread — so such a worker reports
 * `process.env.TZ === "Asia/Tokyo"` while its Date and Intl stay on the OS
 * zone. Setting it here, while this config module is evaluated in the main
 * process, re-initialises the zone BEFORE any worker spawns, and workers
 * inherit the parent's. `test.env` stays for child-process pools
 * (`--pool=forks`), which read their env at startup.
 *
 * Measured on the way in: with this line removed, `TZ=UTC npx vitest run
 * --pool=threads` fails mcp-server's localDate suite; with it, both pools stay
 * green under TZ=UTC.
 */
process.env.TZ = "Asia/Tokyo";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      env: { TZ: "Asia/Tokyo" },
      /*
       * #1079 — forks costs one child process per test file; the run is ~90% jsdom
       * + import + transform startup, so the process boundary is most of the bill.
       * threads keeps file-level isolation and shares the process. The one thing
       * it changes that matters here is the timezone — see the note above.
       */
      pool: "threads",
      include: ["tests/**/*.test.{ts,tsx}"],
      environment: "jsdom",
      globals: true,
      setupFiles: ["./tests/setup.ts"],
      /*
       * Measurement only — no `thresholds` on purpose. See the same block in
       * shared/vitest.config.ts for the reasoning, for why `include` names
       * src/ rather than using the default, and for why @vitest/coverage-v8 is
       * pinned to an exact version (#668 C1).
       *
       * src/ here means WEB's src only. shared/ is reached through a source
       * alias, so leaving `include` at its default would fold shared's files
       * into this number and double-count them against shared's own run.
       */
      coverage: {
        provider: "v8",
        reporter: ["text", "json-summary"],
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/**/*.d.ts"],
      },
    },
    /*
     * recharts is a dependency of BOTH packages, and shared/ is reached
     * through a source alias — so a bare `import "recharts"` from
     * shared/src/components/Analytics resolves against SHARED's node_modules,
     * and the copy found there loads shared's own React. Under vitest that
     * module tree is externalised, where vite's react dedupe no longer
     * applies, so any suite rendering an Analytics widget dies on "Cannot
     * read properties of null (reading 'useContext')" — two Reacts, one with
     * a null dispatcher. Deduping recharts pins it to web's copy, which finds
     * web's React and puts every renderer back on one instance.
     *
     * Test-only: the browser build bundles everything through vite, where the
     * existing react dedupe already keeps the hooks single-instance.
     */
    resolve: {
      dedupe: ["recharts"],
    },
  }),
);
