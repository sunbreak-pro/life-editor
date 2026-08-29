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

/*
 * Mobile size presets (#1182).
 *
 * The 10-step scale is a fine control for a pointer dragging a slider; on a
 * phone it is ten indistinguishable stops under a thumb, and the reported
 * problem was exactly that — 「段階の幅として使いにくい」. Mobile gets three
 * named sizes instead, mapped onto the SAME scale so nothing downstream
 * changes: the root px still comes from `fontSizeToPx`, and a value chosen on
 * Desktop still means what it meant when the phone opens it.
 *
 * The three land at 14 / 18 / 22px. The middle one is step 5 — the app's own
 * default — so "medium" on a phone is the size the app already shipped, and
 * the two neighbours are a clear step either side rather than the 1px nudges
 * the raw scale offers.
 */
export const MOBILE_FONT_SIZE_STEPS = [3, 5, 8] as const;

/** One of the three mobile presets (a step on the shared 1–10 scale). */
export type MobileFontSizeStep = (typeof MOBILE_FONT_SIZE_STEPS)[number];

/** Default preset — the middle one, which is also the app-wide default step. */
export const DEFAULT_MOBILE_FONT_SIZE_STEP: MobileFontSizeStep = 5;

/**
 * Which preset a stored font size reads as — by px distance, so a value the
 * phone never chose (Desktop's slider, an older build) still lights up the
 * nearest of the three rather than leaving the group with nothing selected.
 *
 * An exact tie rounds UP (16px is between 14 and 18, and reads as medium):
 * a size control that is asked to guess should guess toward legibility.
 */
export function nearestMobileFontSize(fontSize: FontSize): MobileFontSizeStep {
  const px = fontSizeToPx(fontSize);
  let best: MobileFontSizeStep = MOBILE_FONT_SIZE_STEPS[0];
  let bestDistance = Infinity;
  for (const step of MOBILE_FONT_SIZE_STEPS) {
    const distance = Math.abs(fontSizeToPx(step) - px);
    // `<=` is the round-up: later entries are larger, so a tie keeps the last.
    if (distance <= bestDistance) {
      best = step;
      bestDistance = distance;
    }
  }
  return best;
}
