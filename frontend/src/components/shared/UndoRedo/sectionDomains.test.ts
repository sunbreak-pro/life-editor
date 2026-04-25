import { describe, it, expect } from "vitest";
import { SECTION_UNDO_DOMAINS, getMobileUndoDomains } from "./sectionDomains";

describe("SECTION_UNDO_DOMAINS", () => {
  it("declares the expected Desktop sections", () => {
    expect(Object.keys(SECTION_UNDO_DOMAINS).sort()).toEqual(
      ["connect", "materials", "schedule", "settings", "work"].sort(),
    );
  });

  it("includes scheduleItem / routine / taskTree / calendar in schedule", () => {
    expect(SECTION_UNDO_DOMAINS.schedule).toEqual([
      "scheduleItem",
      "routine",
      "taskTree",
      "calendar",
    ]);
  });

  it("includes daily / note / wikiTag in materials", () => {
    expect(SECTION_UNDO_DOMAINS.materials).toEqual([
      "daily",
      "note",
      "wikiTag",
    ]);
  });
});

describe("getMobileUndoDomains", () => {
  it("returns the same domains as Desktop for schedule (no Mobile-omitted domains)", () => {
    expect(getMobileUndoDomains("schedule")).toEqual([
      "scheduleItem",
      "routine",
      "taskTree",
      "calendar",
    ]);
  });

  it("returns the same domains as Desktop for materials", () => {
    expect(getMobileUndoDomains("materials")).toEqual([
      "daily",
      "note",
      "wikiTag",
    ]);
  });

  it("filters out Mobile-omitted domains for work (playlist / sound)", () => {
    // Desktop work has [playlist, sound]; Mobile omits AudioProvider.
    expect(getMobileUndoDomains("work")).toEqual([]);
  });

  it("filters out Mobile-omitted domains for settings", () => {
    // Desktop settings has [settings]; Mobile omits ShortcutConfigProvider.
    expect(getMobileUndoDomains("settings")).toEqual([]);
  });

  it("returns an empty array for unknown sections", () => {
    // Desktop-only sections like terminal / analytics aren't mapped at all.
    expect(getMobileUndoDomains("terminal")).toEqual([]);
    expect(getMobileUndoDomains("analytics")).toEqual([]);
  });
});
