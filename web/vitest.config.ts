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
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      env: { TZ: "Asia/Tokyo" },
      include: ["tests/**/*.test.{ts,tsx}"],
      environment: "jsdom",
      globals: true,
      setupFiles: ["./tests/setup.ts"],
    },
    /*
     * recharts is a dependency of BOTH packages, and shared/ is reached
     * through a source alias — so a bare `import "recharts"` from
     * shared/src/components/Analytics resolves against SHARED's node_modules,
     * and the copy found there loads shared's own React. Under vitest that
     * module tree is externalised, where vite's react dedupe no longer
     * applies, so any suite rendering an Analytics widget dies on "Cannot
     * read properties of null (reading 'useContext')": two Reacts, one with a
     * null dispatcher. Deduping recharts pins it to web's copy, which finds
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
