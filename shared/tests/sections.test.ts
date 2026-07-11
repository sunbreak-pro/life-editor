import { describe, it, expect } from "vitest";
import {
  SECTIONS,
  MAIN_SECTIONS,
  UTILITY_SECTIONS,
  MOBILE_SECTIONS,
  SECTION_IDS,
  SECTION_ICONS,
  SECTION_DEFAULT_PAGE_WIDTH,
} from "../src/sections";

/*
 * Section registry (SSOT) contract. These lock the target-IA 7-section set,
 * both nav orders, and the icon/label coverage so the web host can derive its
 * nav from here (web/src/MainScreen.tsx) without parallel literal lists.
 */
describe("section registry", () => {
  it("holds exactly the target-IA 7 sections in canonical (desktop) order", () => {
    expect(SECTION_IDS).toEqual([
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
      "schedule",
      "materials",
      "connect",
      "work",
      "analytics",
    ]);
    expect(UTILITY_SECTIONS.map((s) => s.id)).toEqual(["settings", "trash"]);
  });

  it("orders the mobile bottom bar as fixed-4 + More overflow", () => {
    // Fixed 4 = schedule/materials/work/analytics; More = connect/settings/trash.
    expect(MOBILE_SECTIONS.map((s) => s.id)).toEqual([
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

  it("assigns each group correctly (main = 5, utility = 2)", () => {
    expect(SECTIONS.filter((s) => s.group === "main")).toHaveLength(5);
    expect(SECTIONS.filter((s) => s.group === "utility")).toHaveLength(2);
  });
});

/*
 * Width-tab defaults (Layout Standard v2 §5). The registry is the runtime
 * SSOT for each section's initial width mode (the v2 plan's §5 table is the
 * decision record); the host falls back to these when no per-section choice
 * is persisted yet. Initial values mirror the pre-v2 look. The former
 * rightSidebar gate is retired (v2 §3 — every section shows the toggle;
 * Analytics / Trash open the shared placeholder empty state).
 */
describe("section default page width (Layout Standard v2 §5)", () => {
  it("mirrors each section's pre-v2 look (v2 plan §5 table)", () => {
    expect(SECTION_DEFAULT_PAGE_WIDTH).toEqual({
      schedule: "wide",
      materials: "wide",
      connect: "wide",
      work: "narrow",
      analytics: "wide",
      settings: "narrow",
      trash: "narrow",
    });
  });

  it("exposes a lookup covering every section id, matching the registry field", () => {
    expect(Object.keys(SECTION_DEFAULT_PAGE_WIDTH).sort()).toEqual(
      [...SECTION_IDS].sort(),
    );
    for (const s of SECTIONS) {
      expect(SECTION_DEFAULT_PAGE_WIDTH[s.id]).toBe(s.defaultPageWidth);
    }
  });
});
