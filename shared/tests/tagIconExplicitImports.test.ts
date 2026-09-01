// @vitest-environment node (#1079 — this suite touches no DOM)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveTagIcon, TAG_ICON_CHOICES } from "../src/components/tagIcon";

/*
 * Guard for the tag-icon bundle fix (#1114, measured in #994 / PR #1112 §8.6).
 *
 * `import { icons } from "lucide-react"` pulls the registry OBJECT, and a
 * bundler cannot see which keys get read — so all 1,704 icon modules ship in
 * the eager chunk to serve the 26 curated names. Removing it took the eager
 * chunk from 417.52 KB → 300.64 KB gzip (−28.0%).
 *
 * Nothing else notices a regression here: re-introducing the registry keeps
 * types, lint and every other suite green while the initial download silently
 * grows back. Same failure mode the Analytics guard exists for
 * (analyticsTabsLightweight.test.ts).
 */

const here = dirname(fileURLToPath(import.meta.url));
const tagIconModule = resolve(here, "../src/components/tagIcon.ts");

describe("tagIcon imports lucide icons explicitly", () => {
  it("never pulls the lucide registry object", () => {
    const source = readFileSync(tagIconModule, "utf8");
    // Strip block comments: the BUNDLE NOTE names the banned import on purpose.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
    const lucideImports =
      code.match(/import\s*\{[\s\S]*?\}\s*from\s*"lucide-react"/g) ?? [];
    expect(lucideImports.length).toBeGreaterThan(0);
    for (const stmt of lucideImports) {
      // The registry is exported under these three names; any of them defeats
      // tree-shaking the same way.
      expect(stmt).not.toMatch(
        /\b(icons|dynamicIconImports|createLucideIcon)\b/,
      );
    }
  });

  it("imports one named icon per curated choice", () => {
    const source = readFileSync(tagIconModule, "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const name of TAG_ICON_CHOICES) {
      // Each choice must arrive as its own named import, which is what lets the
      // bundler keep only these modules.
      expect(code).toMatch(new RegExp(`^\\s*${name},\\s*$`, "m"));
    }
  });
});

describe("resolveTagIcon", () => {
  it("resolves every curated choice, so the picker never draws a fallback", () => {
    expect(TAG_ICON_CHOICES.length).toBeGreaterThan(0);
    for (const name of TAG_ICON_CHOICES) {
      expect(
        resolveTagIcon(name),
        `choice ${name} did not resolve`,
      ).not.toBeNull();
    }
  });

  it("resolves the names actually stored in wiki_tags today", () => {
    // `select distinct icon from wiki_tags where icon is not null` at the time
    // of the switch returned exactly these two — the check that made dropping
    // arbitrary-name resolution safe (#1114).
    expect(resolveTagIcon("Clock")).not.toBeNull();
    expect(resolveTagIcon("File")).not.toBeNull();
  });

  it("returns null for a lucide name outside the curated set", () => {
    // The deliberate trade-off: a real lucide icon that is not curated no
    // longer resolves, and callers draw their default glyph
    // (TagHeadingIcon.tsx:29 / TagIconPicker.tsx:89).
    expect(resolveTagIcon("Airplay")).toBeNull();
    expect(TAG_ICON_CHOICES).not.toContain("Airplay");
  });

  it("returns null for an absent or unknown name", () => {
    expect(resolveTagIcon(null)).toBeNull();
    expect(resolveTagIcon("")).toBeNull();
    expect(resolveTagIcon("NotAnIconName")).toBeNull();
  });

  it("does not resolve inherited Object keys", () => {
    // The map is a plain object literal, so a name like "toString" would hit
    // Object.prototype if the lookup were unguarded — it must read as unknown.
    expect(resolveTagIcon("toString")).toBeNull();
    expect(resolveTagIcon("constructor")).toBeNull();
  });
});

/** The names listed inside the file's `… from "lucide-react"` statement. */
function lucideImportNames(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const stmt = /import\s*\{([\s\S]*?)\}\s*from\s*"lucide-react"/.exec(code);
  return (stmt?.[1] ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && !entry.startsWith("type "));
}

describe("every curated choice arrives as its own named import", () => {
  /*
   * The check above matches a bare `Name,` line anywhere in the file, which the
   * TAG_ICONS literal satisfies on its own — so it would stay green if an
   * import went missing and the name resolved from somewhere else. This one
   * reads only inside the import statement, which is the thing that actually
   * decides what ships.
   */
  it("lists each choice in the lucide import statement itself", () => {
    const imported = lucideImportNames(readFileSync(tagIconModule, "utf8"));
    for (const name of TAG_ICON_CHOICES) {
      expect(imported, `${name} is curated but not imported`).toContain(name);
    }
  });

  it("imports nothing the picker does not offer", () => {
    // A leftover import is dead weight in the eager chunk that nothing renders.
    const imported = lucideImportNames(readFileSync(tagIconModule, "utf8"));
    expect(imported.filter((name) => !TAG_ICON_CHOICES.includes(name))).toEqual(
      [],
    );
  });
});

/**
 * A few names per life area the picker is meant to cover (#1366). Not the full
 * set — just enough per area that dropping a category would fail here.
 */
const AREA_ICONS: Record<string, readonly string[]> = {
  life: ["Home", "Bed", "ShoppingCart", "Shirt", "PawPrint"],
  work: ["Briefcase", "Building2", "Mail", "Users"],
  study: ["Book", "GraduationCap", "Pencil", "Library", "FlaskConical"],
  health: ["Dumbbell", "HeartPulse", "Pill", "Stethoscope"],
  money: ["Wallet", "PiggyBank", "CreditCard", "Coins"],
  travel: ["Plane", "Car", "TrainFront", "MapPin"],
  food: ["Coffee", "Utensils", "Pizza", "Apple", "Wine"],
  hobby: ["Music", "Camera", "Gamepad2", "Palette"],
};

describe("the curated set spans the life areas the picker is for (#1366)", () => {
  it("offers 55–60 choices and lists no name twice", () => {
    // The band #1366 settled on: enough that a tag can find a fitting glyph,
    // few enough that the grid stays scannable. Both ends are load-bearing —
    // below 55 an area has gone thin, and past 60 the flat grid is the wrong
    // shape and the picker wants real grouping instead of another row.
    expect(TAG_ICON_CHOICES.length).toBeGreaterThanOrEqual(55);
    expect(TAG_ICON_CHOICES.length).toBeLessThanOrEqual(60);
    expect(new Set(TAG_ICON_CHOICES).size).toBe(TAG_ICON_CHOICES.length);
  });

  it("keeps at least three usable icons in every area", () => {
    for (const [area, names] of Object.entries(AREA_ICONS)) {
      const present = names.filter((name) =>
        TAG_ICON_CHOICES.includes(name),
      );
      expect(
        present.length,
        `${area} is down to [${present.join(", ")}]`,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
