import type { FontFamily } from "../context/ThemeContextValue";

/**
 * Body font-family choice → CSS value for the documentElement inline style
 * (§216 lightweight prefs; unified with the utility classes in #556).
 * "system" returns an empty string so the host clears the inline style and
 * falls back to the stylesheet default (--font-sans). serif/mono are var()
 * references into tokens.css — the same custom properties the Tailwind
 * font-serif / font-mono utilities consume — so the Settings choice and any
 * direct font-serif/font-mono usage (e.g. the briefing masthead) resolve to
 * one stack that can never drift. The literal stacks live in tokens.css only.
 */
export const FONT_FAMILY_STACK: Record<FontFamily, string> = {
  system: "",
  serif: "var(--font-serif)",
  mono: "var(--font-mono)",
};

/** Resolve a font-family choice to its CSS stack ("" for the system default). */
export function fontFamilyToStack(family: FontFamily): string {
  return FONT_FAMILY_STACK[family] ?? "";
}
