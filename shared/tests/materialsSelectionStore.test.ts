import { describe, it, expect, beforeEach } from "vitest";
import {
  getNotesSelection,
  setNotesSelection,
  clearNotesSelection,
  getDailySelection,
  setDailySelection,
  clearDailySelection,
  getTaskSelection,
  setTaskSelection,
  clearTaskSelection,
  resetMaterialsSelection,
} from "../src/state/materialsSelectionStore";

/*
 * #282 — module-level Materials selection store. It survives provider unmounts
 * (module state outlives React trees) and resets on app restart. These unit
 * tests pin: per-domain independence, null clears, and resetMaterialsSelection
 * clearing all three.
 */

describe("materialsSelectionStore", () => {
  beforeEach(() => {
    resetMaterialsSelection();
  });

  it("defaults every domain to null on a fresh store", () => {
    expect(getNotesSelection()).toBeNull();
    expect(getDailySelection()).toBeNull();
    expect(getTaskSelection()).toBeNull();
  });

  it("round-trips each domain independently (no cross-talk)", () => {
    setNotesSelection("note-1");
    setDailySelection("2026-07-01");
    setTaskSelection("task-9");

    expect(getNotesSelection()).toBe("note-1");
    expect(getDailySelection()).toBe("2026-07-01");
    expect(getTaskSelection()).toBe("task-9");
  });

  it("clearing one domain does not touch the others", () => {
    setNotesSelection("note-1");
    setDailySelection("2026-07-01");
    setTaskSelection("task-9");

    clearNotesSelection();
    expect(getNotesSelection()).toBeNull();
    expect(getDailySelection()).toBe("2026-07-01");
    expect(getTaskSelection()).toBe("task-9");

    clearDailySelection();
    expect(getDailySelection()).toBeNull();
    expect(getTaskSelection()).toBe("task-9");

    clearTaskSelection();
    expect(getTaskSelection()).toBeNull();
  });

  it("setting null via the setters clears the entry", () => {
    setNotesSelection("note-1");
    setNotesSelection(null);
    expect(getNotesSelection()).toBeNull();

    setDailySelection("2026-07-01");
    setDailySelection(null);
    expect(getDailySelection()).toBeNull();

    setTaskSelection("task-9");
    setTaskSelection(null);
    expect(getTaskSelection()).toBeNull();
  });

  it("resetMaterialsSelection clears all three domains at once", () => {
    setNotesSelection("note-1");
    setDailySelection("2026-07-01");
    setTaskSelection("task-9");

    resetMaterialsSelection();

    expect(getNotesSelection()).toBeNull();
    expect(getDailySelection()).toBeNull();
    expect(getTaskSelection()).toBeNull();
  });
});
