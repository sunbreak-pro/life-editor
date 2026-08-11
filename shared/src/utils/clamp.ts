/**
 * Clamp `value` into the inclusive range [lo, hi].
 *
 * Lived in `utils/scheduleGridLayout.ts` (its first caller) until #670 C3
 * PR 3, which left generic consumers — a stepped slider, a volume control —
 * either importing a schedule-grid module for two lines of arithmetic or
 * writing their own copy. They wrote their own.
 */
export function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), hi);
}
