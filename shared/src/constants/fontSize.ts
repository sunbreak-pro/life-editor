import type { FontSize } from "../context/ThemeContextValue";

/**
 * 10-step font-size scale → px (CLAUDE.md §3.3: font sizes 12–25px).
 * Single source of truth shared by ThemeContext (applies the root px) and
 * SettingsAppearance (previews the px) so the two can never drift.
 */
export const FONT_SIZE_PX: Record<number, number> = {
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

/** Default px when a step is out of range (step 5 = 18px). */
export const DEFAULT_FONT_SIZE_PX = 18;

/** Resolve a font-size step to its px value, falling back to the default. */
export function fontSizeToPx(fontSize: FontSize): number {
  return FONT_SIZE_PX[fontSize] ?? DEFAULT_FONT_SIZE_PX;
}
