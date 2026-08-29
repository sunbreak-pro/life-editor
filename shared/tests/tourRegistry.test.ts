import { describe, it, expect } from "vitest";
import { TOUR_ANCHORS } from "../src/components/tour/anchors";
import {
  TOUR_STEPS,
  TOUR_STEP_IDS,
  TOUR_SECTION_IDS,
  tourSectionIds,
} from "../src/components/tour/registry";
import { TOUR_SECTION_SUMMARY_KEYS } from "../src/components/tour/launcher";
import { SECTION_IDS } from "../src/sections";
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

  it("opens on Briefing, anchored on something that is really there", () => {
    // The row shipped with #1122 pointed at `briefing-today`, which no
    // component ever carried, so step one was skipped on every single run
    // (#1201). Asserting the anchor against TOUR_ANCHORS rather than a string
    // literal is what makes that failure impossible to reintroduce silently:
    // the registry and the component that wears it now name the same constant.
    const first = TOUR_STEPS[0];

    expect(first.id).toBe("briefing-intro");
    expect(first.section).toBe("briefing");
    expect(first.anchor).toBe(TOUR_ANCHORS.briefingMorningTab);
  });

  it("advances the Briefing step on Next, since there is nothing to do there", () => {
    // Every other step teaches a deed and waits for it. This one explains a
    // screen the user does not fill in at all, so an `action` here would wait
    // for something that can never happen.
    expect(TOUR_STEPS[0].advanceOn.kind).toBe("next");
  });

  it("names the mechanism that fills Briefing, in both catalogs", () => {
    // The point of the step (#1201): Briefing is written by `write_briefing`
    // over MCP, so on the web alone it stays empty. A user who is not told
    // that reads an empty page as a broken one — and there is nothing on
    // screen to correct them. Copy is normally not asserted, but here the
    // specific facts ARE the feature.
    for (const catalog of [en, ja]) {
      const copy = lookup(catalog, TOUR_STEPS[0].copyKey);
      expect(typeof copy).toBe("string");
      expect(copy as string).toMatch(/Claude Code/);
      expect(copy as string).toMatch(/MCP/);
    }
  });

  it("derives the startable sections from the steps themselves", () => {
    // #1194: the launcher's menu IS this list. Deriving it is what keeps a
    // section from being offered before its steps exist (and from staying
    // hidden after they land) without anyone remembering to edit a menu.
    expect(TOUR_SECTION_IDS).toEqual([
      ...new Set(TOUR_STEPS.map((s) => s.section)),
    ]);
  });

  it("lists a section once, in the order the tour walks it", () => {
    // Registry order, not sidebar order: the menu should read the same way the
    // full walkthrough does. Five Schedule steps must contribute ONE row.
    expect(
      tourSectionIds([
        { ...TOUR_STEPS[0], section: "materials" },
        { ...TOUR_STEPS[0], section: "briefing" },
        { ...TOUR_STEPS[0], section: "materials" },
      ]),
    ).toEqual(["materials", "briefing"]);
  });

  it("has a launcher summary for every live section, in both catalogs", () => {
    // The map is `satisfies Record<SectionId, TranslationKey>`, so tsc already
    // refuses a missing or untranslated-in-en entry. ja is the half the types
    // cannot see, and a section reaching the welcome page with a blank line
    // under it is exactly what #1194's first page is made of.
    for (const id of SECTION_IDS) {
      const key = TOUR_SECTION_SUMMARY_KEYS[id];
      expect(typeof key).toBe("string");
      expect(typeof lookup(en, key)).toBe("string");
      expect(typeof lookup(ja, key)).toBe("string");
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
