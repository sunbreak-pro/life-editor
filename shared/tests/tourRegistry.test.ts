import { describe, it, expect } from "vitest";
import { TOUR_STEPS, TOUR_STEP_IDS } from "../src/components/tour/registry";
import en from "../src/i18n/locales/en.json";
import ja from "../src/i18n/locales/ja.json";
import { SECTIONS } from "../src/sections";

/*
 * #1125 — the Materials (Notes) steps, and the registry invariants adding them
 * has to keep.
 *
 * `copyKey` and `section` are already typed (TranslationKey / SectionId), so
 * tsc catches an untranslated key or a retired section where the registry is
 * WRITTEN. What the types cannot see is the ja catalog (en is the type source)
 * and duplicate ids — a duplicate would make the persisted resume point
 * ambiguous, which is the one way a step list can corrupt a user's position
 * rather than merely misplace it.
 */

function lookup(catalog: unknown, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      catalog,
    );
}

describe("tour registry", () => {
  it("gives every step a unique id", () => {
    expect(new Set(TOUR_STEP_IDS).size).toBe(TOUR_STEP_IDS.length);
  });

  it("names a live section on every step", () => {
    const live = new Set(SECTIONS.map((s) => s.id));
    for (const step of TOUR_STEPS) expect(live.has(step.section)).toBe(true);
  });

  it("has copy in BOTH catalogs for every step", () => {
    for (const step of TOUR_STEPS) {
      // en is the type source, so only ja can silently go missing — but
      // asserting both keeps the failure message pointing at the right file.
      expect(typeof lookup(en, step.copyKey)).toBe("string");
      expect(typeof lookup(ja, step.copyKey)).toBe("string");
    }
  });

  it("walks the Notes loop in order: make, write, tag, follow", () => {
    const materials = TOUR_STEPS.filter((s) => s.section === "materials");

    expect(materials.map((s) => s.id)).toEqual([
      "materials-capture",
      "materials-note-body",
      "materials-note-tag",
      "materials-tag-follow",
    ]);
  });

  it("advances the Materials steps on the deed, not on a Next click", () => {
    // The whole point of these four: reading "add a note" is not the same as
    // adding one, so each waits for the host to report the action.
    for (const step of TOUR_STEPS.filter((s) => s.section === "materials")) {
      expect(step.advanceOn.kind).toBe("action");
    }
  });

  it("keeps each Materials action event distinct", () => {
    // notifyAction matches on the event string alone, so two steps sharing one
    // would let the wrong one advance.
    const events = TOUR_STEPS.filter(
      (s) => s.section === "materials" && s.advanceOn.kind === "action",
    ).map((s) => (s.advanceOn as { event: string }).event);

    expect(new Set(events).size).toBe(events.length);
  });
});
