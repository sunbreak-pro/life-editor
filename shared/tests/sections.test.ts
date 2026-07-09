import { describe, it, expect } from "vitest";
import {
  SECTIONS,
  MAIN_SECTIONS,
  UTILITY_SECTIONS,
  MOBILE_SECTIONS,
  SECTION_IDS,
  SECTION_ICONS,
  SECTION_HAS_RIGHT_SIDEBAR,
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
 * rightSidebar ownership (plan 2026-07-08 Step 3). The host gates the detail-
 * panel toggle on this flag so a section without portal content never opens an
 * empty panel. These lock the "toggle shown ⟺ content supplied" invariant at
 * the SSOT: only Analytics / Trash (no per-item detail context) are false; every
 * other section supplies RightSidebarPortal content (Connect / Work / Settings
 * via the shared panel, Materials / Schedule via their own in-section chrome).
 */
describe("section rightSidebar ownership", () => {
  it("marks exactly Analytics and Trash as having no detail panel", () => {
    const withoutPanel = SECTIONS.filter((s) => !s.rightSidebar).map(
      (s) => s.id,
    );
    expect(withoutPanel.sort()).toEqual(["analytics", "trash"]);
  });

  it("marks every portal-supplying section as owning the panel", () => {
    for (const id of [
      "schedule",
      "materials",
      "connect",
      "work",
      "settings",
    ] as const) {
      expect(SECTION_HAS_RIGHT_SIDEBAR[id]).toBe(true);
    }
    expect(SECTION_HAS_RIGHT_SIDEBAR.analytics).toBe(false);
    expect(SECTION_HAS_RIGHT_SIDEBAR.trash).toBe(false);
  });

  it("exposes a lookup covering every section id, matching the registry field", () => {
    expect(Object.keys(SECTION_HAS_RIGHT_SIDEBAR).sort()).toEqual(
      [...SECTION_IDS].sort(),
    );
    for (const s of SECTIONS) {
      expect(SECTION_HAS_RIGHT_SIDEBAR[s.id]).toBe(s.rightSidebar);
    }
  });
});
