import { useEffect, type ReactNode } from "react";
import {
  ThemeContext,
  type Theme,
  type FontSize,
  type Language,
} from "./ThemeContextValue";
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

const VALID_THEMES: readonly string[] = ["light", "dark"];
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

  const [editorFontSize, setEditorFontSize] = useLocalStorage<number>(
    STORAGE_KEYS.EDITOR_FONT_SIZE,
    1.0625,
    {
      serialize: String,
      deserialize: (raw) => {
        const n = parseFloat(raw);
        return n > 0 ? n : 1.0625;
      },
    },
  );

  const [editorFontFamily, setEditorFontFamily] = useLocalStorage<string>(
    STORAGE_KEYS.EDITOR_FONT_FAMILY,
    "system",
    {
      serialize: (v) => v,
      deserialize: (raw) =>
        ["system", "serif", "mono"].includes(raw) ? raw : "system",
    },
  );

  const [editorLineHeight, setEditorLineHeight] = useLocalStorage<number>(
    STORAGE_KEYS.EDITOR_LINE_HEIGHT,
    1.7,
    {
      serialize: String,
      deserialize: (raw) => {
        const n = parseFloat(raw);
        return n >= 1.0 && n <= 3.0 ? n : 1.7;
      },
    },
  );

  const [editorPaddingInline, setEditorPaddingInline] = useLocalStorage<number>(
    STORAGE_KEYS.EDITOR_PADDING_INLINE,
    0,
    {
      serialize: String,
      deserialize: (raw) => {
        const n = parseInt(raw, 10);
        return n >= 0 ? n : 0;
      },
    },
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const px = FONT_SIZE_PX[fontSize] ?? 18;
    document.documentElement.style.fontSize = `${px}px`;
  }, [fontSize]);

  useEffect(() => {
    const el = document.documentElement;
    el.style.setProperty("--editor-font-size", `${editorFontSize}rem`);
    const familyMap: Record<string, string> = {
      system: "var(--font-sans)",
      serif: 'Georgia, "Times New Roman", "Hiragino Mincho ProN", serif',
      mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    };
    el.style.setProperty(
      "--editor-font-family",
      familyMap[editorFontFamily] ?? "var(--font-sans)",
    );
    el.style.setProperty("--editor-line-height", String(editorLineHeight));
    el.style.setProperty("--editor-padding-inline", `${editorPaddingInline}px`);
  }, [editorFontSize, editorFontFamily, editorLineHeight, editorPaddingInline]);

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    i18n.changeLanguage(lang);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        fontSize,
        toggleTheme,
        setTheme,
        setFontSize,
        language,
        setLanguage,
        editorFontSize,
        editorFontFamily,
        editorLineHeight,
        editorPaddingInline,
        setEditorFontSize,
        setEditorFontFamily,
        setEditorLineHeight,
        setEditorPaddingInline,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
