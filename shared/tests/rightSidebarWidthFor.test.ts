import { describe, it, expect } from "vitest";
import { rightSidebarWidthFor } from "../src/components/RightSidebar";

/*
 * #2544 — the arithmetic twin of RightSidebar's CAP_CLASS
 * (`max(240px, calc(100% - 520px))` over the 240–560 clamp). AppShell folds
 * the nav from this number, so it has to say what the browser draws.
 */
describe("rightSidebarWidthFor", () => {
  it.each([
    // [stored width, row width (= <main> + panel), drawn width]
    [320, 1010, 320], // room enough: the stored width wins
    [560, 1010, 490], // the 520px floor under <main> caps it
    [560, 498, 240], // a small window: the panel's own floor wins
    [100, 1010, 240], // a stale stored width is clamped up
    [900, 2000, 560], // …and clamped down
  ])("stored %i in a %ipx row → %ipx", (stored, row, drawn) => {
    expect(rightSidebarWidthFor(stored, row)).toBe(drawn);
  });
});
