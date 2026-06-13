import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import {
  ThemeContext,
  type Theme,
  type FontSize,
  type Language,
} from "./ThemeContextValue";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { i18n, LANGUAGE_STORAGE_KEY } from "../i18n";

export type { Theme, FontSize, Language };

// 10-step scale → px (CLAUDE.md §3.3: font sizes 12–25px).
const FONT_SIZE_PX: Record<number, number> = {
  1: 12,
  2: 13,
  3: 14,
  4: 16,
  5: 18,
  6: 19,
  7: 20,
  8: 22,
  9: 23,
  10: 25,
};

const THEME_STORAGE_KEY = "life-editor-theme";
const FONT_SIZE_STORAGE_KEY = "life-editor-font-size";

const VALID_THEMES: readonly string[] = ["light", "dark"];
const VALID_LANGUAGES: readonly string[] = ["en", "ja"];

// Migrate legacy "small"/"medium"/"large" to numeric 1-10.
const LEGACY_FONT_SIZE_MAP: Record<string, number> = {
  small: 1,
  medium: 5,
  large: 10,
};

function deserializeFontSize(raw: string): FontSize {
  if (raw in LEGACY_FONT_SIZE_MAP) {
    return LEGACY_FONT_SIZE_MAP[raw];
  }
  const num = parseInt(raw, 10);
  return num >= 1 && num <= 10 ? num : 5;
}

/*
 * Shared ThemeProvider (W1). Applies `data-theme` + root font-size to
 * documentElement and persists via useLocalStorage. Language changes are
 * forwarded to the SHARED i18next singleton (`i18n.changeLanguage`) — the
 * same instance hosts wrap their tree with, and it reads/writes
 * LANGUAGE_STORAGE_KEY so reload restores the choice (CLAUDE.md §6.4: the
 * Provider owns i18n side-effects; primitives stay copy-via-props).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useLocalStorage<Theme>(THEME_STORAGE_KEY, "light", {
    serialize: (v) => v,
    deserialize: (raw) =>
      VALID_THEMES.includes(raw) ? (raw as Theme) : "light",
  });

  const [fontSize, setFontSize] = useLocalStorage<FontSize>(
    FONT_SIZE_STORAGE_KEY,
    5,
    {
      serialize: String,
      deserialize: deserializeFontSize,
    },
  );

  const [language, setLanguageState] = useLocalStorage<Language>(
    LANGUAGE_STORAGE_KEY,
    (i18n.language as Language) === "ja" ? "ja" : "en",
    {
      serialize: (v) => v,
      deserialize: (raw) =>
        VALID_LANGUAGES.includes(raw) ? (raw as Language) : "en",
    },
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const px = FONT_SIZE_PX[fontSize] ?? 18;
    document.documentElement.style.fontSize = `${px}px`;
  }, [fontSize]);

  const toggleTheme = useCallback(
    () => setTheme(theme === "light" ? "dark" : "light"),
    [theme, setTheme],
  );

  const setLanguage = useCallback(
    (lang: Language) => {
      setLanguageState(lang);
      void i18n.changeLanguage(lang);
    },
    [setLanguageState],
  );

  const value = useMemo(
    () => ({
      theme,
      fontSize,
      language,
      toggleTheme,
      setTheme,
      setFontSize,
      setLanguage,
    }),
    [
      theme,
      fontSize,
      language,
      toggleTheme,
      setTheme,
      setFontSize,
      setLanguage,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
