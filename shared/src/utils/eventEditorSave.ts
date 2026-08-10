/*
 * Which fields of one edit a REPEAT can carry (#279 / #628).
 *
 * A routine is a template plus the occurrence rows generated from it. An edit
 * to a field the template also holds — title, start, end — is a real question
 * ("this one, this and later, or all?") and the host parks it in the scope
 * dialog. An edit to a field the template does NOT hold — the day, the all-day
 * flag, the memo — has nowhere to propagate to and applies to the single row,
 * no question asked. That split is what `seriesEditHint` promises the user.
 *
 * Two rules make this more than a field list:
 *
 *   1. An ALL-DAY FLIP disqualifies the times. Turning all-day off has to hand
 *      the row a renderable span back, and the editor fills one in from
 *      `timedSpanForAllDayOff` — a fallback, not a time the user chose. Letting
 *      that reach the template would rewrite a whole series' hours to a
 *      made-up 09:00–10:00, silently, from a switch that says "all-day". This
 *      is the #469 guard ("a patch carrying isAllDay never opens the scope
 *      dialog") restated so it survives #628's batched save, where one patch
 *      can now carry the flip AND the fallback times together.
 *   2. The answer is derived from ONE patch, not per field. #628 made the save
 *      button hand over everything that changed at once, and #553's rule is
 *      that one gesture produces one commit — so one press must raise the
 *      scope dialog at most once, whatever mixture it carries.
 *
 * Pure (no React, no service): the rules above are pinned by tests instead of
 * being re-derived at each call site.
 */

/** The subset of a schedule-item patch this decision looks at. */
export interface SeriesEditablePatch {
  title?: string;
  startTime?: string;
  endTime?: string;
  date?: string;
  isAllDay?: boolean;
}

/** What a routine template can actually be updated with. */
export interface SeriesUpdates {
  title?: string;
  startTime?: string;
  endTime?: string;
}

/**
 * The part of `patch` that a routine template can carry.
 *
 * Empty means the whole edit is occurrence-level, so the host applies it to the
 * one row and never asks about the series.
 */
export function seriesPropagatableFields(
  patch: SeriesEditablePatch,
): SeriesUpdates {
  const updates: SeriesUpdates = {};
  if (patch.title !== undefined) updates.title = patch.title;
  // Rule 1 above: times that came along with an all-day flip are a fallback the
  // editor computed, not an edit to the series' hours.
  if (patch.isAllDay === undefined) {
    if (patch.startTime !== undefined) updates.startTime = patch.startTime;
    if (patch.endTime !== undefined) updates.endTime = patch.endTime;
  }
  return updates;
}

/** Does this patch contain anything worth asking the scope question about? */
export function touchesSeries(patch: SeriesEditablePatch): boolean {
  return Object.keys(seriesPropagatableFields(patch)).length > 0;
}
