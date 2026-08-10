import { describe, it, expect } from "vitest";
import { i18n, LANGUAGE_STORAGE_KEY } from "../src/i18n";
import en from "../src/i18n/locales/en.json";
import ja from "../src/i18n/locales/ja.json";

/*
 * W0-4: the shared i18next singleton must boot with both catalogs and
 * resolve en<->ja. This guards the cross-platform i18n base the web /
 * desktop / mobile hosts all consume.
 */

/** Every leaf path in a catalog, dotted: `materials.notes.trash`. */
function leafKeys(node: unknown, prefix = ""): string[] {
  if (node === null || typeof node !== "object" || Array.isArray(node)) {
    return [prefix];
  }
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

/*
 * i18next's JSON v4 plural suffixes. A key is stored once PER PLURAL CATEGORY
 * OF ITS OWN LANGUAGE, and en (one / other) and ja (other only) do not have the
 * same categories — so the two catalogs are compared on the base key, with the
 * `_other` form (the one every language has, and en's fallback) required on
 * both sides separately.
 */
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
const baseKey = (key: string) => key.replace(PLURAL_SUFFIX, "");

const EN_KEYS = leafKeys(en);
const JA_KEYS = leafKeys(ja);

describe("shared i18n", () => {
  it("is initialized with en + ja resources", () => {
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.hasResourceBundle("en", "translation")).toBe(true);
    expect(i18n.hasResourceBundle("ja", "translation")).toBe(true);
  });

  it("falls back to en and exposes the language storage key", () => {
    expect(i18n.options.fallbackLng).toContain("en");
    expect(LANGUAGE_STORAGE_KEY).toBe("life-editor-language");
  });

  /*
   * D-20260810-refactor-1: RoutineProvider now pushes onto the global undo
   * stack, and UndoRedoHost translates the applied command's label with
   * `t("undoRedo.labels.<label>", { defaultValue: label })`. A missing entry
   * is silent — the toast just shows the raw command name ("createRoutine")
   * — so the three routine labels are pinned in both catalogs here.
   */
  it("carries every routine undo label in both catalogs", () => {
    const labels = ["createRoutine", "updateRoutine", "deleteRoutine"];
    for (const lng of ["en", "ja"]) {
      for (const label of labels) {
        // getResource, not t(): `fallbackLng: en` answers for a missing ja
        // entry, which would hide the exact gap this test exists to catch.
        const entry = i18n.getResource(
          lng,
          "translation",
          `undoRedo.labels.${label}`,
        );
        expect(entry, `${lng}/${label}`).toBeTypeOf("string");
      }
    }
  });

  it("resolves the same key differently per language", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("section.tasks")).toBe("Todos");
    await i18n.changeLanguage("ja");
    expect(i18n.t("section.tasks")).toBe("Todo");
    // restore default so test ordering stays neutral
    await i18n.changeLanguage("en");
  });
});

/*
 * en / ja lockstep (CLAUDE.md §9): a one-sided addition is invisible at
 * runtime — `fallbackLng: en` quietly serves English where the ja entry is
 * missing, and an orphaned ja entry is simply never read. Both directions are
 * checked so neither catalog can drift ahead of the other.
 */
describe("shared i18n — catalog parity", () => {
  it("has no key that only one catalog carries", () => {
    const enBases = new Set(EN_KEYS.map(baseKey));
    const jaBases = new Set(JA_KEYS.map(baseKey));

    expect([...enBases].filter((k) => !jaBases.has(k))).toEqual([]);
    expect([...jaBases].filter((k) => !enBases.has(k))).toEqual([]);
  });

  it("gives every plural key an `_other` form in both catalogs", () => {
    const plurals = [...EN_KEYS, ...JA_KEYS]
      .filter((k) => PLURAL_SUFFIX.test(k))
      .map(baseKey);

    for (const base of new Set(plurals)) {
      expect(EN_KEYS, `en/${base}`).toContain(`${base}_other`);
      expect(JA_KEYS, `ja/${base}`).toContain(`${base}_other`);
    }
  });
});

/*
 * #680: "1 todos" shipped because the count key had a single form. The fix is
 * i18next's own plural resolution (en: one / other, ja: other), NOT a ternary
 * at the call site — so these assert through t() with a count, which is exactly
 * how KanbanView asks for the string.
 */
describe("shared i18n — plurals", () => {
  it("picks the singular form for count=1 in en", async () => {
    await i18n.changeLanguage("en");

    expect(i18n.t("materials.tasks.taskCount", { count: 1 })).toBe("1 todo");
    expect(i18n.t("materials.tasks.taskCount", { count: 2 })).toBe("2 todos");
    expect(i18n.t("materials.tasks.taskCount", { count: 0 })).toBe("0 todos");
  });

  it("keeps the one Japanese form at every count", async () => {
    await i18n.changeLanguage("ja");

    expect(i18n.t("materials.tasks.taskCount", { count: 1 })).toBe("Todo 1 件");
    expect(i18n.t("materials.tasks.taskCount", { count: 2 })).toBe("Todo 2 件");

    await i18n.changeLanguage("en");
  });
});
