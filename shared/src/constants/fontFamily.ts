import type { FontFamily } from "../context/ThemeContextValue";

/**
 * Body font-family choice → CSS font stack (§216 lightweight prefs). "system"
 * returns an empty string so the host clears the documentElement inline style
 * and falls back to the stylesheet default. serif/mono are generic stacks —
 * font *names* (not colors), so the literal stack is allowed here (CLAUDE.md
 * §6 forbids hardcoded colors, not font families). Single source of truth
 * shared by ThemeContext (applies the root style) and any preview surface so
 * the two can never drift.
 */
export const FONT_FAMILY_STACK: Record<FontFamily, string> = {
  system: "",
  serif: 'Georgia, "Times New Roman", serif',
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

/** Resolve a font-family choice to its CSS stack ("" for the system default). */
export function fontFamilyToStack(family: FontFamily): string {
  return FONT_FAMILY_STACK[family] ?? "";
}
