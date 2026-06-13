import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ja from "./locales/ja.json";

/*
 * Shared i18n — single source of truth for the en/ja translation catalog
 * across web / desktop / mobile (W0-4). Ported verbatim from the FROZEN
 * `frontend/src/i18n/index.ts` (Tauri, to be discarded), with the locale
 * JSON copied 1:1 into ./locales.
 *
 * Design-system PRIMITIVES (Button/Input/...) still receive copy via props
 * — they MUST NOT call useTranslation (CLAUDE.md §6.4). This module is for
 * APP + SCREEN code: host entry points init it, screens call useTranslation
 * (re-exported below so every host resolves the SAME i18next singleton).
 */

// Self-contained so shared has no dependency on a host's constants module.
// Mirrors STORAGE_KEYS.LANGUAGE in the frozen frontend.
const LANGUAGE_STORAGE_KEY = "life-editor-language";

function readSavedLanguage(): string {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) || "en";
  } catch {
    // localStorage can throw (private mode / disabled storage). Fall back.
    return "en";
  }
}

// Idempotent: importing this module from several entry points (and React
// StrictMode double-invoking) must not re-init or reset the active language.
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      ja: { translation: ja },
    },
    lng: readSavedLanguage(),
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
}

export { i18n, LANGUAGE_STORAGE_KEY };
export { I18nextProvider as I18nProvider } from "react-i18next";
// Re-exported so hosts get the singleton tied to THIS configured instance.
export { useTranslation, Trans } from "react-i18next";
