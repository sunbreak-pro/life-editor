import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ThemeContext,
  type Theme,
  type ThemeMode,
  type FontSize,
  type FontFamily,
  type ReduceMotion,
  type Language,
} from "./ThemeContextValue";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { i18n, LANGUAGE_STORAGE_KEY } from "../i18n";
import { fontSizeToPx } from "../constants/fontSize";
import { fontFamilyToStack } from "../constants/fontFamily";

export type { Theme, ThemeMode, FontSize, FontFamily, ReduceMotion, Language };

const THEME_STORAGE_KEY = "life-editor-theme";
const THEME_MODE_STORAGE_KEY = "life-editor-theme-mode";
const FONT_SIZE_STORAGE_KEY = "life-editor-font-size";
const FONT_FAMILY_STORAGE_KEY = "life-editor-font-family";
const REDUCE_MOTION_STORAGE_KEY = "life-editor-reduce-motion";

const VALID_THEMES: readonly string[] = ["light", "dark"];
const VALID_THEME_MODES: readonly string[] = ["light", "dark", "system"];
const VALID_FONT_FAMILIES: readonly string[] = ["system", "serif", "mono"];
const VALID_REDUCE_MOTION: readonly string[] = ["system", "reduce", "off"];
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
 * Default themeMode migration (§216). Before this change users only had a
 * light|dark `theme` under `life-editor-theme`; there was no mode key. When
 * `life-editor-theme-mode` is absent we seed the mode from that legacy value
 * so an existing dark user is NOT silently flipped. We deliberately DON'T
 * default new/untouched users to "system" (which could flip a fresh install
 * to dark on an OS-dark machine) — the app has always defaulted to light, so
 * the surprise-free default stays "light". Users opt into OS-follow explicitly.
 */
function readLegacyThemeAsMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark") return raw;
  } catch {
    /* ignore — fall through to light */
  }
  return "light";
}

function systemPrefersDark(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/*
 * Shared ThemeProvider (W1, extended §216). Applies `data-theme` +
 * `data-reduce-motion` + root font-size + root font-family to documentElement
 * and persists via useLocalStorage. `theme` is the RESOLVED value (system mode
 * is resolved here via matchMedia and re-resolved on OS change); `themeMode` is
 * the user's stored choice. Language changes are forwarded to the SHARED
 * i18next singleton (`i18n.changeLanguage`) — the same instance hosts wrap
 * their tree with, and it reads/writes LANGUAGE_STORAGE_KEY so reload restores
 * the choice (CLAUDE.md §6.4: the Provider owns i18n/DOM side-effects;
 * primitives stay copy-via-props).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Seed the mode default from the legacy theme key exactly once (avoids a
  // per-render localStorage read; useLocalStorage only reads its own key).
  const initialThemeMode = useMemo(() => readLegacyThemeAsMode(), []);

  const [themeMode, setThemeMode] = useLocalStorage<ThemeMode>(
    THEME_MODE_STORAGE_KEY,
    initialThemeMode,
    {
      serialize: (v) => v,
      deserialize: (raw) =>
        VALID_THEME_MODES.includes(raw) ? (raw as ThemeMode) : "light",
    },
  );

  const [fontSize, setFontSize] = useLocalStorage<FontSize>(
    FONT_SIZE_STORAGE_KEY,
    5,
    {
      serialize: String,
      deserialize: deserializeFontSize,
    },
  );

  const [fontFamily, setFontFamily] = useLocalStorage<FontFamily>(
    FONT_FAMILY_STORAGE_KEY,
    "system",
    {
      serialize: (v) => v,
      deserialize: (raw) =>
        VALID_FONT_FAMILIES.includes(raw) ? (raw as FontFamily) : "system",
    },
  );

  const [reduceMotion, setReduceMotion] = useLocalStorage<ReduceMotion>(
    REDUCE_MOTION_STORAGE_KEY,
    "system",
    {
      serialize: (v) => v,
      deserialize: (raw) =>
        VALID_REDUCE_MOTION.includes(raw) ? (raw as ReduceMotion) : "system",
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

  // Track the OS color-scheme so "system" mode re-resolves on change. jsdom
  // has no matchMedia — systemPrefersDark() returns false and the effect
  // no-ops there (same guard as useMediaQuery).
  const [prefersDark, setPrefersDark] = useState<boolean>(systemPrefersDark);
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setPrefersDark(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Resolved applied theme: system mode maps to the live OS preference.
  const theme: Theme = useMemo(
    () =>
      themeMode === "system" ? (prefersDark ? "dark" : "light") : themeMode,
    [themeMode, prefersDark],
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    // Persist the RESOLVED value under the legacy key too so any early
    // pre-hydration reader (and back-compat consumers) sees the applied theme.
    try {
      if (VALID_THEMES.includes(theme)) {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      }
    } catch {
      /* ignore quota errors */
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSizeToPx(fontSize)}px`;
  }, [fontSize]);

  useEffect(() => {
    // "system" clears the inline style (empty stack) → stylesheet default.
    document.documentElement.style.fontFamily = fontFamilyToStack(fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    // "system" removes the attribute so the OS media query alone decides;
    // "reduce"/"off" set it so tokens.css can force / opt out (see the
    // three-state block there).
    if (reduceMotion === "system") {
      document.documentElement.removeAttribute("data-reduce-motion");
    } else {
      document.documentElement.setAttribute("data-reduce-motion", reduceMotion);
    }
  }, [reduceMotion]);

  // Explicit theme setter (back-compat): record it as an explicit mode so the
  // picker and the resolved value stay consistent. toggleTheme flips the
  // CURRENT resolved theme into an explicit choice.
  const setTheme = useCallback(
    (next: Theme) => setThemeMode(next),
    [setThemeMode],
  );
  const toggleTheme = useCallback(
    () => setThemeMode(theme === "light" ? "dark" : "light"),
    [theme, setThemeMode],
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
      themeMode,
      fontSize,
      fontFamily,
      reduceMotion,
      language,
      toggleTheme,
      setTheme,
      setThemeMode,
      setFontSize,
      setFontFamily,
      setReduceMotion,
      setLanguage,
    }),
    [
      theme,
      themeMode,
      fontSize,
      fontFamily,
      reduceMotion,
      language,
      toggleTheme,
      setTheme,
      setThemeMode,
      setFontSize,
      setFontFamily,
      setReduceMotion,
      setLanguage,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
