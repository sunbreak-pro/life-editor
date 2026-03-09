import { useEffect, type ReactNode } from "react";
import { ThemeContext, type Theme, type FontSize, type Language } from "./ThemeContextValue";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { useLocalStorage } from "../hooks/useLocalStorage";
import i18n from "../i18n";

export type { Theme, FontSize, Language };

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

const VALID_THEMES: readonly string[] = ["light", "dark", "monochrome", "monochrome-dark"];
const VALID_LANGUAGES: readonly string[] = ["en", "ja"];

// Migrate legacy "small"/"medium"/"large" to numeric 1-10
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useLocalStorage<Theme>(
    STORAGE_KEYS.THEME,
    "light",
    {
      serialize: (v) => v,
      deserialize: (raw) =>
        VALID_THEMES.includes(raw) ? (raw as Theme) : "light",
    },
  );

  const [fontSize, setFontSize] = useLocalStorage<FontSize>(
    STORAGE_KEYS.FONT_SIZE,
    5,
    {
      serialize: String,
      deserialize: deserializeFontSize,
    },
  );

  const [language, setLanguageState] = useLocalStorage<Language>(
    STORAGE_KEYS.LANGUAGE,
    "en",
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

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    i18n.changeLanguage(lang);
  };

  return (
    <ThemeContext.Provider
      value={{ theme, fontSize, toggleTheme, setTheme, setFontSize, language, setLanguage }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
