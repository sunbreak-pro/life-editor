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
 * Section registry (SSOT) contract. These lock the target-IA 8-section set
 * (7 + Briefing, added by the Briefing plan Step 1 as the home surface),
 * both nav orders, and the icon/label coverage so the web host can derive its
 * nav from here (web/src/MainScreen.tsx) without parallel literal lists.
 */
describe("section registry", () => {
  it("holds exactly the target-IA 8 sections in canonical (desktop) order", () => {
    expect(SECTION_IDS).toEqual([
      "briefing",
      "schedule",
      "materials",
      "connect",
      "work",
      "analytics",
      "settings",
      "trash",
    ]);
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
    expect(UTILITY_SECTIONS.map((s) => s.id)).toEqual(["settings", "trash"]);
  });

  it("orders the mobile bottom bar as fixed-4 + More overflow", () => {
    // Fixed 4 = briefing/schedule/materials/work;
    // More = analytics/connect/settings/trash.
    expect(MOBILE_SECTIONS.map((s) => s.id)).toEqual([
      "briefing",
      "schedule",
      "materials",
      "work",
      "analytics",
      "connect",
      "settings",
      "trash",
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

  it("assigns each group correctly (main = 6, utility = 2)", () => {
    expect(SECTIONS.filter((s) => s.group === "main")).toHaveLength(6);
    expect(SECTIONS.filter((s) => s.group === "utility")).toHaveLength(2);
  });
});
