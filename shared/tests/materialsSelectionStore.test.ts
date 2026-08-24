// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect, beforeEach } from "vitest";
import {
  getNotesSelection,
  setNotesSelection,
  clearNotesSelection,
  getDailySelection,
  setDailySelection,
  clearDailySelection,
  getTodoSelection,
  setTodoSelection,
  clearTodoSelection,
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
    expect(getTodoSelection()).toBeNull();
  });

  it("round-trips each domain independently (no cross-talk)", () => {
    setNotesSelection("note-1");
    setDailySelection("2026-07-01");
    setTodoSelection("task-9");

    expect(getNotesSelection()).toBe("note-1");
    expect(getDailySelection()).toBe("2026-07-01");
    expect(getTodoSelection()).toBe("task-9");
  });

  it("clearing one domain does not touch the others", () => {
    setNotesSelection("note-1");
    setDailySelection("2026-07-01");
    setTodoSelection("task-9");

    clearNotesSelection();
    expect(getNotesSelection()).toBeNull();
    expect(getDailySelection()).toBe("2026-07-01");
    expect(getTodoSelection()).toBe("task-9");

    clearDailySelection();
    expect(getDailySelection()).toBeNull();
    expect(getTodoSelection()).toBe("task-9");

    clearTodoSelection();
    expect(getTodoSelection()).toBeNull();
  });

  it("setting null via the setters clears the entry", () => {
    setNotesSelection("note-1");
    setNotesSelection(null);
    expect(getNotesSelection()).toBeNull();

    setDailySelection("2026-07-01");
    setDailySelection(null);
    expect(getDailySelection()).toBeNull();

    setTodoSelection("task-9");
    setTodoSelection(null);
    expect(getTodoSelection()).toBeNull();
  });

  it("resetMaterialsSelection clears all three domains at once", () => {
    setNotesSelection("note-1");
    setDailySelection("2026-07-01");
    setTodoSelection("task-9");

    resetMaterialsSelection();

    expect(getNotesSelection()).toBeNull();
    expect(getDailySelection()).toBeNull();
    expect(getTodoSelection()).toBeNull();
  });
});
