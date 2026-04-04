import { createContext } from "react";

export type Theme = "light" | "dark";
export type FontSize = number; // 1〜10
export type Language = "en" | "ja";

export interface ThemeContextValue {
  theme: Theme;
  fontSize: FontSize;
  language: Language;
  editorFontSize: number;
  editorFontFamily: string;
  editorLineHeight: number;
  editorPaddingInline: number;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setFontSize: (size: FontSize) => void;
  setLanguage: (lang: Language) => void;
  setEditorFontSize: (size: number) => void;
  setEditorFontFamily: (family: string) => void;
  setEditorLineHeight: (height: number) => void;
  setEditorPaddingInline: (padding: number) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
