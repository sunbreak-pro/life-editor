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
/*
 * Coverage (#668 C1) is MEASUREMENT ONLY — deliberately no `thresholds` block.
 * A threshold picked before anyone has seen the number either sits below
 * reality (and gates nothing) or above it (and turns every unrelated PR red).
 * The baseline is recorded in the PR that introduced this; raising it into a
 * gate is a separate, deliberate decision.
 *
 * `include` names src/ explicitly instead of leaving it to the default, which
 * only counts files some test happened to import. That default answers "of the
 * code we test, how much did we reach" — the flattering question. Naming src/
 * makes never-imported modules count as 0%, which is the question this audit
 * was opened to ask.
 *
 * @vitest/coverage-v8 is pinned to an EXACT version, not a range: it declares
 * `peerDependencies: { vitest: "<same exact version>" }`, so a caret here would
 * resolve to a newer patch than the vitest this lockfile pins and fail install.
 * Bump it in lockstep with vitest.
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

export default defineConfig({
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
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts"],
    },
  },
});
