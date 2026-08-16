import { defineConfig } from "vitest/config";

/*
 * desktop's first test runner (#894).
 *
 * Deliberately separate from `electron.vite.config.ts`: that file configures
 * three Electron bundles (main / preload / renderer-from-../web) and pulling
 * the renderer's react + tailwind plugins into a Node test run would be a lot
 * of machinery for tests that only load two plain TS modules with `electron`
 * mocked.
 *
 * Node environment on purpose — there is no DOM here. `main` and `preload`
 * are Node-side modules; the renderer is web/'s and has its own suite.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
