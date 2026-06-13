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
export default defineConfig({
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
