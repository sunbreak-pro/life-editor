import { defineConfig } from "vitest/config";

/*
 * Tests live in `tests/` (a sibling of `src/`), NOT inside `src/`, on
 * purpose: tsconfig.json is a composite project with `include: ["src"]`
 * and `outDir: dist`. Putting `*.test.ts` under src/ would make
 * `tsc -b` emit test files into dist/ and ship them to consumers. Keeping
 * tests out of `src` preserves the existing build/emit shape untouched
 * while still letting vitest (esbuild transform, no tsc) run them.
 *
 * environment: jsdom (was `node`). W0 added React UI components under
 * `src/components/`, whose tests use @testing-library/react and need a
 * DOM. jsdom is a superset of the node globals the existing pure-logic
 * mapper tests rely on, so the switch is safe for all suites. tsx tests
 * are now included too.
 */
/*
 * TZ is pinned (#420 QA). Several suites exist precisely because a stored UTC
 * instant and a LOCAL calendar key disagree east of UTC — dateKeyOfInstant
 * (#413), analyticsCompletedDayKey (#420). Under CI's default UTC the two days
 * coincide, so those tests pass against the very bug they guard: the assertion
 * is only meaningful where local ≠ UTC. Asia/Tokyo is the app's single user's
 * zone (N=1) and the zone the dev machines already run, so pinning it makes CI
 * reproduce what a developer sees rather than a weaker version of it.
 */
export default defineConfig({
  test: {
    env: { TZ: "Asia/Tokyo" },
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
