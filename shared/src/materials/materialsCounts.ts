/*
 * Materials tab count badges (plan 2026-07-08 Step 4).
 *
 * The Materials providers (TaskTree / Notes / Dailies / WikiTags) are mounted
 * per-tab inside the section body, so the shell can't read their counts from
 * context. A headless host bridge (web/src/MaterialsCountsBridge.tsx) asks the
 * injected DataService for the three numbers and feeds them to the shell,
 * which renders them as HeaderTabs badges.
 *
 * #511: the numbers used to be derived here, in app memory, from the same
 * full list fetches the surfaces use — the badge paid for every column of
 * every row just to call `.length`. The counting moved into the DataService
 * (countUnfinishedTodos / countLiveNotes / countLiveDailies), which asks
 * PostgREST for a header-only COUNT. This file keeps the badge's MEANING —
 * the definition each query has to reproduce — plus the shared types; the
 * queries carry it clause by clause and cite this file.
 *
 *   - tasks: live tasks that still need doing. Excludes soft-deleted rows,
 *     DONE rows, retired 'folder' rows (#225), and payload-less orphans.
 *     A task with no status yet counts as unfinished.
 *   - notes: live notes. Excludes soft-deleted rows, retired 'folder' rows
 *     (#375), and payload-less orphans.
 *   - daily: live dailies. Excludes soft-deleted rows and payload-less
 *     orphans (Daily is flat — no folder rows exist).
 */

/**
 * Badge count per document surface. Named for Materials because that is where
 * all three tabs lived when this was written; `tasks` feeds Schedule's Todo tab
 * since #411, so the keys are surfaces rather than one section's tab union.
 */
export interface MaterialsCounts {
  /** Incomplete tasks (a task that still needs doing = a meaningful number). */
  tasks: number;
  notes: number;
  daily: number;
}

/** All-zero counts — the initial / error fallback (no badges shown). */
export const EMPTY_MATERIALS_COUNTS: MaterialsCounts = {
  tasks: 0,
  notes: 0,
  daily: 0,
};
