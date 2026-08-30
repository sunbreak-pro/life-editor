// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import {
  SECTIONS,
  MAIN_SECTIONS,
  UTILITY_SECTIONS,
  MOBILE_SECTIONS,
  SECTION_IDS,
  SECTION_ICONS,
} from "../src/sections";

/*
 * Section registry (SSOT) contract. These lock the current section set, both
 * nav orders, and the icon/label coverage so the web host can derive its nav
 * from here (web/src/MainScreen.tsx) without parallel literal lists.
 *
 * The REPL section (#146) is retired for good, so the "never includes" case
 * below is the guard against it being re-added by reflex. `connect` is NOT in
 * that category: the id was retired with the force-directed graph (#1152) and
 * re-taken by the tag hub (#1171), which is a different screen answering the
 * same IA question ("the topic-axis entrance"). Its row here pins the slot.
 */
describe("section registry", () => {
  it("holds exactly the target-IA sections in canonical (desktop) order", () => {
    expect(SECTION_IDS).toEqual([
      "briefing",
      "schedule",
      "materials",
      "connect",
      "work",
      "analytics",
      "settings",
    ]);
  });

  it("no longer carries Trash as a section of its own (#1293)", () => {
    // It moved INSIDE Settings — a place you visit to undo something does not
    // earn a permanent sidebar row or a mobile More slot. The view is still
    // there; only its entrance moved.
    expect(SECTION_IDS).not.toContain("trash");
  });

  it("never includes the retired REPL section", () => {
    expect(SECTION_IDS).not.toContain("terminal");
  });

  it("splits mainline vs. utility groups", () => {
    expect(MAIN_SECTIONS.map((s) => s.id)).toEqual([
      "briefing",
      "schedule",
      "materials",
      "connect",
      "work",
      "analytics",
    ]);
    expect(UTILITY_SECTIONS.map((s) => s.id)).toEqual(["settings"]);
  });

  it("orders the mobile bottom bar as fixed-4 + More overflow", () => {
    // Fixed 4 = briefing/schedule/materials/work;
    // More = analytics/connect/settings. Adding Connect (#1171) moved nothing
    // on the bar itself — it took the More slot the retired Connect had, which
    // is what keeps the phone's four first-open sections stable. #1293 dropped
    // Trash off the end of More for the same reason it left the sidebar.
    expect(MOBILE_SECTIONS.map((s) => s.id)).toEqual([
      "briefing",
      "schedule",
      "materials",
      "work",
      "analytics",
      "connect",
      "settings",
    ]);
  });

  it("gives every section an icon and a section.* label key", () => {
    for (const s of SECTIONS) {
      // lucide icons are forwardRef components (objects), so assert presence
      // as a renderable value rather than a plain function.
      expect(s.icon).toBeTruthy();
      expect(["function", "object"]).toContain(typeof s.icon);
      expect(s.labelKey).toBe(`section.${s.id}`);
    }
  });

  it("exposes an icon lookup covering every section id", () => {
    for (const id of SECTION_IDS) {
      expect(SECTION_ICONS[id]).toBeDefined();
    }
    expect(Object.keys(SECTION_ICONS).sort()).toEqual([...SECTION_IDS].sort());
  });

  it("keeps the utility group to settings alone, everything else mainline", () => {
    expect(
      SECTIONS.filter((s) => s.group === "utility").map((s) => s.id),
    ).toEqual(["settings"]);
    expect(SECTIONS.filter((s) => s.group === "main")).toHaveLength(
      SECTIONS.length - 1,
    );
  });

  it("gives every section a distinct mobile order", () => {
    // A duplicate is not a type error and does not throw — MOBILE_SECTIONS
    // just sorts the pair arbitrarily, so the bottom bar and the More sheet
    // would swap two rows between builds. Adding a section is exactly when
    // that happens (this one had to renumber settings and trash).
    const orders = SECTIONS.map((s) => s.mobileOrder);
    expect(new Set(orders).size).toBe(orders.length);
  });
});
