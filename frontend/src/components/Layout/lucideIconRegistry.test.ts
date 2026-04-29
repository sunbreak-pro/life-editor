import { describe, it, expect } from "vitest";
import {
  LUCIDE_ICON_NAMES,
  LUCIDE_ICON_REGISTRY,
  LUCIDE_ICON_PREFIX,
  formatLucideIconValue,
  parseLucideIconName,
} from "./lucideIconRegistry";

describe("lucideIconRegistry", () => {
  describe("parseLucideIconName", () => {
    it("returns null for null/undefined/empty", () => {
      expect(parseLucideIconName(null)).toBeNull();
      expect(parseLucideIconName(undefined)).toBeNull();
      expect(parseLucideIconName("")).toBeNull();
    });

    it("returns null for plain emoji (no prefix)", () => {
      expect(parseLucideIconName("🎨")).toBeNull();
      expect(parseLucideIconName("Globe")).toBeNull();
    });

    it("returns null for unknown lucide name", () => {
      expect(parseLucideIconName("lucide:NotARealIcon")).toBeNull();
    });

    it("returns the icon name for valid lucide value", () => {
      expect(parseLucideIconName("lucide:Globe")).toBe("Globe");
      expect(parseLucideIconName("lucide:Terminal")).toBe("Terminal");
    });
  });

  describe("formatLucideIconValue", () => {
    it("prepends the lucide prefix", () => {
      expect(formatLucideIconValue("Globe")).toBe(`${LUCIDE_ICON_PREFIX}Globe`);
    });

    it("roundtrips through parseLucideIconName for every registered icon", () => {
      for (const name of LUCIDE_ICON_NAMES) {
        expect(parseLucideIconName(formatLucideIconValue(name))).toBe(name);
      }
    });
  });

  describe("registry", () => {
    it("LUCIDE_ICON_NAMES matches registry keys", () => {
      expect(LUCIDE_ICON_NAMES.sort()).toEqual(
        Object.keys(LUCIDE_ICON_REGISTRY).sort(),
      );
    });

    it("every registered value is a renderable component", () => {
      for (const name of LUCIDE_ICON_NAMES) {
        expect(LUCIDE_ICON_REGISTRY[name]).toBeTypeOf("object");
      }
    });
  });
});
