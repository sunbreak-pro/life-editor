import { describe, it, expect } from "vitest";
import { i18n, LANGUAGE_STORAGE_KEY } from "../src/i18n";

/*
 * W0-4: the shared i18next singleton must boot with both catalogs and
 * resolve en<->ja. This guards the cross-platform i18n base the web /
 * desktop / mobile hosts all consume.
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
    expect(i18n.t("section.tasks")).toBe("Todos");
    await i18n.changeLanguage("ja");
    expect(i18n.t("section.tasks")).toBe("Todo");
    // restore default so test ordering stays neutral
    await i18n.changeLanguage("en");
  });
});
