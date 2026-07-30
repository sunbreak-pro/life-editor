/*
 * Calendar-grid filters (#466 Step 5-b). Pure array narrowing — no React, no
 * Intl, no DataService.
 *
 * The grid draws the standing scaffolding (routine-generated occurrences) and
 * the one-off events in the same columns, so on a day whose routines fill it
 * there is no room left to SEE where a new event could go. This filter folds
 * the repeat-generated rows away so the remaining gaps are the real ones.
 *
 * Two rules make it safe to build a UI on:
 *   1. The count of what was folded away travels WITH the survivors. A grid
 *      that silently drops rows turns its empty slots into a lie — the caller
 *      needs the number to say "N hidden" in the same breath.
 *   2. Filtering is a VIEW concern. The host keeps its unfiltered store for
 *      selection / mutation and passes the result of this function only to the
 *      grid layer, so hiding a row never changes what an edit writes.
 */

/** The minimum an item must expose to be filtered: its source routine. */
export interface RepeatFilterable {
  /** Set when the row was generated from a Routine template. */
  routineId?: string | null;
}

export interface RepeatFilterResult<T> {
  visible: T[];
  /** How many rows were folded away (0 when the filter is off). */
  hiddenCount: number;
}

/**
 * Fold repeat-generated rows out of a grid list.
 *
 * `hideRepeats === false` is the identity case and returns the SAME array
 * reference, so a host memo downstream of this does not invalidate while the
 * filter is off.
 */
export function applyRepeatFilter<T extends RepeatFilterable>(
  items: T[],
  hideRepeats: boolean,
): RepeatFilterResult<T> {
  if (!hideRepeats) return { visible: items, hiddenCount: 0 };
  const visible = items.filter((i) => i.routineId == null);
  return { visible, hiddenCount: items.length - visible.length };
}
