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
  }),
);
