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
export default defineConfig({
  test: {
    env: {
      TZ: "Asia/Tokyo",
    },
  },
});
