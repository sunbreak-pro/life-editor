import { defineConfig } from "vitest/config";

/*
 * Tests live in `tests/` (a sibling of `src/`), NOT inside `src/`, on
 * purpose: tsconfig.json is a composite project with `include: ["src"]`
 * and `outDir: dist`. Putting `*.test.ts` under src/ would make
 * `tsc -b` emit test files into dist/ and ship them to consumers. Keeping
 * tests out of `src` preserves the existing build/emit shape untouched
 * while still letting vitest (esbuild transform, no tsc) run them.
 */
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
