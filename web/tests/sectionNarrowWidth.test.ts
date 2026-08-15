import { describe, it, expect } from "vitest";
import { SECTION_DESCRIPTORS } from "../src/sectionDescriptors";

/*
 * #875 — the narrow layout's scroll ownership for Materials.
 *
 * The Notes "+" is `absolute bottom-6 right-6` inside the section box (shared
 * MobileFab), which only lands on the screen edge when that box has a definite
 * height and no padding — i.e. PageContainer's "fluid" variant. Materials wants
 * "wide" on the desktop surfaces and "fluid" on the narrow ones, so it declares
 * `narrowWidth`; MainScreen picks it whenever the layout is narrow.
 *
 * Asserted on the descriptor rather than through a rendered MainScreen: the
 * screen needs the whole Provider stack and a DataService, while the value
 * under test is exactly this table entry (rules/frontend.md §テスト環境の制約 —
 * the escape hatch for screens jsdom cannot carry).
 */

describe("section descriptors — narrow width", () => {
  it("puts Materials on the self-scrolling variant while narrow", () => {
    expect(SECTION_DESCRIPTORS.materials.width).toBe("wide");
    expect(SECTION_DESCRIPTORS.materials.narrowWidth).toBe("fluid");
  });

  it("leaves every other section identical at both widths", () => {
    const declared = Object.entries(SECTION_DESCRIPTORS)
      .filter(([, d]) => d.narrowWidth != null)
      .map(([id]) => id);
    expect(declared).toEqual(["materials"]);
  });
});
