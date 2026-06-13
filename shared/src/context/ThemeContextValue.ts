import { createContext } from "react";

export type Theme = "light" | "dark";
/** Discrete font-size step 1–10, mapped to 12–25px on documentElement. */
export type FontSize = number;
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
  theme: Theme;
  fontSize: FontSize;
  language: Language;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setFontSize: (size: FontSize) => void;
  setLanguage: (lang: Language) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
