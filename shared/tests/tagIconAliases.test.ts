// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, expect, it } from "vitest";
import { TAG_ICON_CHOICES } from "../src/components/tagIcon";
import {
  filterTagIcons,
  matchesTagIconQuery,
  TAG_ICON_ALIASES,
} from "../src/components/tagIconAliases";

/*
 * Guard for the tag icon search (#1701).
 *
 * The picker's search field ORs the English lucide name against a hand-written
 * Japanese table. Nothing in the toolchain notices when an icon is added to
 * TAG_ICONS without an entry here: types stay happy (the table is a plain
 * Record), the picker still draws the glyph, and the only symptom is that no
 * Japanese word ever finds it. This suite is what notices.
 */

describe("every curated icon can be searched in Japanese", () => {
  it("has at least one alias per TAG_ICONS key", () => {
    const missing = TAG_ICON_CHOICES.filter(
      (name) =>
        !Object.hasOwn(TAG_ICON_ALIASES, name) ||
        TAG_ICON_ALIASES[name].length === 0,
    );
    expect(missing, `no Japanese alias for: ${missing.join(", ")}`).toEqual([]);
  });

  it("lists no alias for an icon the picker does not offer", () => {
    // A leftover entry is a name that can be typed and never matches anything,
    // which reads as the search being broken rather than the table being stale.
    const orphans = Object.keys(TAG_ICON_ALIASES).filter(
      (name) => !TAG_ICON_CHOICES.includes(name),
    );
    expect(orphans, `aliases for retired icons: ${orphans.join(", ")}`).toEqual(
      [],
    );
  });

  it("repeats no alias inside one icon's own list", () => {
    for (const [name, aliases] of Object.entries(TAG_ICON_ALIASES)) {
      expect(new Set(aliases).size, `${name} repeats an alias`).toBe(
        aliases.length,
      );
    }
  });

  it("writes no alias with a space or an empty word in it", () => {
    // The table stores one space-separated string per icon, so a space inside
    // a word silently becomes two aliases and a double space becomes an empty
    // one that matches every query.
    for (const [name, aliases] of Object.entries(TAG_ICON_ALIASES)) {
      for (const alias of aliases) {
        expect(alias, `${name} has an empty alias`).not.toBe("");
        expect(alias, `${name} has whitespace inside "${alias}"`).not.toMatch(
          /\s/,
        );
      }
    }
  });

  it("writes every alias in Japanese, not as the English name again", () => {
    // `matchesTagIconQuery` already tests the lucide name, so an ASCII entry is
    // dead weight that also hides a forgotten translation behind a green
    // completeness check.
    for (const [name, aliases] of Object.entries(TAG_ICON_ALIASES)) {
      for (const alias of aliases) {
        expect(
          /[぀-ヿ㐀-鿿＀-￯]/.test(alias),
          `${name} has a non-Japanese alias "${alias}"`,
        ).toBe(true);
      }
    }
  });
});

describe("matchesTagIconQuery — the OR of English name and Japanese alias", () => {
  it("finds an icon by a half-typed Japanese reading", () => {
    // The mid-conversion case (#1701 item 4): 「きん」 is what is on screen
    // while the IME is still offering 筋トレ as a candidate.
    expect(matchesTagIconQuery("Dumbbell", "きん")).toBe(true);
  });

  it("finds an icon by its kanji alias", () => {
    expect(matchesTagIconQuery("PiggyBank", "貯金")).toBe(true);
  });

  it("finds an icon by part of its English name, ignoring case", () => {
    expect(matchesTagIconQuery("Dumbbell", "dumb")).toBe(true);
    expect(matchesTagIconQuery("Dumbbell", "DUMB")).toBe(true);
  });

  it("does not match an unrelated word", () => {
    expect(matchesTagIconQuery("Dumbbell", "貯金")).toBe(false);
    expect(matchesTagIconQuery("Wallet", "きん")).toBe(false);
  });

  it("matches everything on an empty or blank query", () => {
    // The picker leans on this to draw the untouched grid.
    expect(matchesTagIconQuery("Dumbbell", "")).toBe(true);
    expect(matchesTagIconQuery("Dumbbell", "   ")).toBe(true);
  });

  it("is not fooled by an inherited Object key", () => {
    // TAG_ICON_ALIASES is an object literal, so an unguarded lookup for
    // "toString" would reach Object.prototype and `.some` would throw.
    expect(() => matchesTagIconQuery("toString", "あ")).not.toThrow();
    expect(matchesTagIconQuery("toString", "あ")).toBe(false);
  });
});

describe("filterTagIcons", () => {
  it("returns the full grid, in order, for an empty query", () => {
    // What keeps "the panel looks the same before you type" true (#1701 DoD).
    expect(filterTagIcons("")).toEqual(TAG_ICON_CHOICES);
    expect(filterTagIcons("  ")).toEqual(TAG_ICON_CHOICES);
  });

  it("keeps declaration order among the matches", () => {
    const hits = filterTagIcons("ペット");
    const positions = hits.map((name) => TAG_ICON_CHOICES.indexOf(name));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("narrows to the icons the query names", () => {
    // 「きん」 is a substring of several readings on purpose (きんとれ /
    // ちょきん / つうきん), so what is pinned is that it reaches the one the
    // #1701 DoD names and drops an icon with no such reading.
    expect(filterTagIcons("きん")).toContain("Dumbbell");
    expect(filterTagIcons("きん")).not.toContain("Wallet");
    expect(filterTagIcons("貯金")).toEqual(["PiggyBank"]);
  });

  it("returns nothing for a query no icon answers", () => {
    expect(filterTagIcons("ぬりかべ")).toEqual([]);
  });
});
