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

  it("resolves the same key differently per language", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("sidebar.tasks")).toBe("Tasks");
    await i18n.changeLanguage("ja");
    expect(i18n.t("sidebar.tasks")).toBe("タスク");
    // restore default so test ordering stays neutral
    await i18n.changeLanguage("en");
  });
});
