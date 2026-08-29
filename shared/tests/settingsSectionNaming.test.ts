// @vitest-environment node (#1243 — catalog values only, no DOM)
import { describe, expect, it } from "vitest";
import en from "../src/i18n/locales/en.json";
import ja from "../src/i18n/locales/ja.json";
import { SECTIONS } from "../src/sections";

/*
 * A settings pane must call its section what the sidebar calls it (#1243).
 *
 * Since the categories became tabs (#1174), the row on the left takes its
 * label from the section registry (`section.*`, sections.ts SSOT) while the
 * body heading is the pane's own `settings.<id>.heading`. Nothing tied the
 * two together, so ja drifted: the row said 「予定」 and the heading right
 * next to it said 「スケジュール」 — two names for one place, in the one
 * screen whose whole job is to say which place you are configuring. en never
 * showed it because both strings happened to be "Schedule".
 *
 * i18nKeys.test.ts checks that en and ja declare the same KEYS; this checks
 * that these particular two keys carry the same VALUE, per locale. Panes that
 * are not named after a section (appearance, account, reset …) are untouched
 * — the rule only applies where a `settings.<id>` block shares its id with a
 * registered section.
 */

type Catalog = { [key: string]: string | Catalog };

function lookup(catalog: Catalog, path: string): string | undefined {
  let node: string | Catalog | undefined = catalog;
  for (const part of path.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

const LOCALES = [
  ["en", en as Catalog],
  ["ja", ja as Catalog],
] as const;

describe("settings pane naming (#1243)", () => {
  it("names each section-scoped pane the way the section registry does", () => {
    const mismatches: string[] = [];
    for (const [locale, catalog] of LOCALES) {
      for (const section of SECTIONS) {
        const heading = lookup(catalog, `settings.${section.id}.heading`);
        // Most sections have no pane of their own yet (they render the
        // placeholder), and that is fine — only a pane that exists is pinned.
        if (heading === undefined) continue;
        const sidebar = lookup(catalog, section.labelKey);
        if (heading !== sidebar) {
          mismatches.push(
            `${locale}: settings.${section.id}.heading="${heading}" vs ${section.labelKey}="${sidebar}"`,
          );
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("actually finds a pane to check (guards the lookup itself)", () => {
    // Without this, a typo in the path above would make the test vacuous.
    const covered = SECTIONS.filter(
      (s) => lookup(en as Catalog, `settings.${s.id}.heading`) !== undefined,
    );
    expect(covered.length).toBeGreaterThan(0);
  });
});
