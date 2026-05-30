import { describe, it, expect } from "vitest";
import {
  computeNoteDropIntent,
  type NoteDropPosition,
} from "../src/utils/noteDropIntent";

/*
 * computeNoteDropIntent unit tests (DU-G — Notes Folder DnD UX). Pins the
 * widened folder inside-zone (0.2–0.8 = middle 60%) and the simple
 * above/below split for non-folders, plus boundary inclusivity and ratio
 * clamping. "below" on a folder is a sibling-after reorder applied at the
 * host layer (TaskTree parity) — there is no expanded-folder special case
 * — so this stays a pure geometry test.
 */

const intent = (pointerRatio: number, isFolder: boolean): NoteDropPosition =>
  computeNoteDropIntent({ pointerRatio, isFolder });

describe("computeNoteDropIntent — folder rows", () => {
  it("returns 'above' in the top 20% strip (ratio < 0.2)", () => {
    expect(intent(0, true)).toBe("above");
    expect(intent(0.1, true)).toBe("above");
    expect(intent(0.19, true)).toBe("above");
  });

  it("returns 'inside' across the widened middle 60% (0.2–0.8 inclusive)", () => {
    // Lower boundary 0.2 is NOT above (it is the start of inside).
    expect(intent(0.2, true)).toBe("inside");
    expect(intent(0.21, true)).toBe("inside");
    expect(intent(0.5, true)).toBe("inside");
    expect(intent(0.79, true)).toBe("inside");
    // Upper boundary 0.8 is NOT below (it is the end of inside).
    expect(intent(0.8, true)).toBe("inside");
  });

  it("returns 'below' in the bottom 20% strip (ratio > 0.8)", () => {
    expect(intent(0.81, true)).toBe("below");
    expect(intent(0.9, true)).toBe("below");
    expect(intent(1, true)).toBe("below");
  });
});

describe("computeNoteDropIntent — non-folder rows", () => {
  it("never returns 'inside' for a non-folder", () => {
    for (const r of [0, 0.19, 0.2, 0.49, 0.5, 0.8, 0.81, 1]) {
      expect(intent(r, false)).not.toBe("inside");
    }
  });

  it("returns 'above' in the top half and 'below' in the bottom half", () => {
    expect(intent(0, false)).toBe("above");
    expect(intent(0.49, false)).toBe("above");
    // 0.5 is the start of the bottom half (r < 0.5 is above).
    expect(intent(0.5, false)).toBe("below");
    expect(intent(0.8, false)).toBe("below");
    expect(intent(1, false)).toBe("below");
  });
});

describe("computeNoteDropIntent — ratio clamping", () => {
  it("clamps ratios below 0 (folder → above, note → above)", () => {
    expect(intent(-0.5, true)).toBe("above");
    expect(intent(-1, false)).toBe("above");
  });

  it("clamps ratios above 1 (folder → below, note → below)", () => {
    expect(intent(1.5, true)).toBe("below");
    expect(intent(2, false)).toBe("below");
  });
});
