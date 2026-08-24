import { defineConfig } from "vitest/config";

/*
 * The timezone is part of this package's contract, not an ambient detail.
 * `src/utils/localDate.ts` formats with `toLocaleDateString("sv-SE")` and
 * builds UTC instant ranges out of local midnight, so every date the briefing
 * tools return depends on the process TZ. Developers here run JST while CI
 * runners are UTC — without a pin the same test means two different things in
 * the two places, and the CI run would be the one telling us nothing.
 *
 * `tests/localDate.test.ts` asserts the pin itself, so deleting this line
 * fails the suite rather than silently loosening it.
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
    env: {
      TZ: "Asia/Tokyo",
    },
    /*
     * #1079 — forks costs one child process per test file; the run is ~90% jsdom
     * + import + transform startup, so the process boundary is most of the bill.
     * threads keeps file-level isolation and shares the process. The one thing
     * it changes that matters here is the timezone — see the note above.
     */
    pool: "threads",
  },
});
