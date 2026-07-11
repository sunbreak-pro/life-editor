import { createContext } from "react";

export type Theme = "light" | "dark";
/**
 * User theme *choice* (§216 lightweight prefs). Distinct from `Theme` (the
 * resolved, applied value): "system" follows the OS `prefers-color-scheme`,
 * light/dark are explicit. `theme` above is always the resolved value.
 */
export type ThemeMode = "light" | "dark" | "system";
/** Discrete font-size step 1–10, mapped to 12–25px on documentElement. */
export type FontSize = number;
/** Body font-family choice (§216). Applied as documentElement inline style. */
export type FontFamily = "system" | "serif" | "mono";
/**
 * Reduce-motion choice (§216). "system" follows the OS
 * `prefers-reduced-motion`; "reduce" forces motion off regardless of the OS;
 * "off" keeps motion even when the OS asks to reduce it. Reflected on
 * documentElement as `data-reduce-motion` (absent for "system").
 */
export type ReduceMotion = "system" | "reduce" | "off";
export type Language = "en" | "ja";

/*
 * Shared Theme context (W1). Web-lean variant of the FROZEN
 * `frontend/src/context/ThemeContextValue.ts`: theme + fontSize + language
 * only. The editor-* fields (editorFontSize/Family/LineHeight/Padding) were
 * dropped — no web/shared consumer reads the `--editor-*` CSS vars they fed,
 * so carrying them would be dead state. They can be re-added in a later batch
 * once a shared rich-text editor consumes them.
 */
export interface ThemeContextValue {
  /** Resolved, applied theme (light|dark) — "system" is resolved here. */
  theme: Theme;
  /** User theme choice (light|dark|system). Source of truth for the picker. */
  themeMode: ThemeMode;
  fontSize: FontSize;
  fontFamily: FontFamily;
  reduceMotion: ReduceMotion;
  language: Language;
  toggleTheme: () => void;
  /** Set an explicit theme (light|dark). Reflected into themeMode. */
  setTheme: (theme: Theme) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setFontSize: (size: FontSize) => void;
  setFontFamily: (family: FontFamily) => void;
  setReduceMotion: (reduceMotion: ReduceMotion) => void;
  setLanguage: (lang: Language) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
