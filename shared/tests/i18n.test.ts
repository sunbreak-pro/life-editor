import { describe, it, expect } from "vitest";
import { i18n, LANGUAGE_STORAGE_KEY } from "../src/i18n";

/*
 * W0-4: the shared i18next singleton must boot with both catalogs and
 * resolve en<->ja. This guards the cross-platform i18n base the web /
 * desktop / mobile hosts all consume.
 *
 * Scope: what the *runtime* does — initialization, `fallbackLng`, and plural
 * resolution through `t()` (plus the undo-label pin below, which is about a
 * silent `defaultValue` fallback rather than the catalogs' shape).
 * The catalogs' key sets (en / ja parity and the
 * `_other` requirement) are NOT checked here; `i18nKeys.test.ts` owns those,
 * since it already reads the JSON files to scan call sites (#778 — both
 * invariants used to be asserted in both files, each with its own plural
 * regex, so a change to one could leave the looser copy quietly green).
 */

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
    expect(i18n.t("section.todos")).toBe("Todos");
    await i18n.changeLanguage("ja");
    expect(i18n.t("section.todos")).toBe("Todo");
    // restore default so test ordering stays neutral
    await i18n.changeLanguage("en");
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

    expect(i18n.t("materials.todos.todoCount", { count: 1 })).toBe("1 todo");
    expect(i18n.t("materials.todos.todoCount", { count: 2 })).toBe("2 todos");
    expect(i18n.t("materials.todos.todoCount", { count: 0 })).toBe("0 todos");
  });

  it("keeps the one Japanese form at every count", async () => {
    await i18n.changeLanguage("ja");

    expect(i18n.t("materials.todos.todoCount", { count: 1 })).toBe("Todo 1 件");
    expect(i18n.t("materials.todos.todoCount", { count: 2 })).toBe("Todo 2 件");

    await i18n.changeLanguage("en");
  });
});
