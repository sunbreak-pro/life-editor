/*
 * Moving the goals note into goals (#2105, plan Step 6) — the pure half.
 *
 * Until #2101 the 週 / 月 / 年 goals were plain lines in the reserved note
 * `note-goals` (goalSections.ts). Goals are rows now (0034), so the lines of
 * the CURRENT week / month / year sections become one goal each, once. The
 * host (web/src/briefing/hooks/useNoteGoalsMigration.ts) does the reads and
 * the writes; this module only decides what to create.
 *
 * What stays where it is:
 *   - The note. Nothing here writes to it, so past periods' sections remain
 *     as history and the moved lines are still readable in Notes.
 *   - Lines past the per-period limit. Only a section's first three lines can
 *     ever move; the rest, and any of those three that find the period
 *     already full, are reported back as `leftInNote` so the host can say so.
 *
 * "Once" is carried by `legacy_key`, one per moved line
 * (`note-goals:<period>:<key>:<line index>`), and decided per line:
 *   - A line whose key is on a live goal has been moved and is skipped. The
 *     other lines of its section are still planned, so a run that failed
 *     halfway through a period finishes it on the next open.
 *   - The DB holds `legacy_key` unique per user, trashed goals included
 *     (0034 `uq_goals_payload_legacy_key`), so a create that races another
 *     device, or re-creates a goal the user trashed, fails instead of making
 *     a second copy. The host treats that failure as "already moved". The
 *     plan cannot tell a trashed line from a never-moved one (goal reads
 *     return live rows only), so a trashed line costs one refused create per
 *     open until its period ends.
 *
 * A period that is already full of goals made elsewhere (the MCP tools) moves
 * nothing and reports nothing: there is no row to remember "told the user"
 * on, and a toast on every open would teach the user to dismiss it.
 */

import type { Goal, GoalPeriodKind } from "../../types/goal";
import { goalPeriodKey } from "../../utils/goalAchievement";
import { WEEK_STARTS_ON } from "../../utils/scheduleGridLayout";
import { goalPeriodKeys } from "./goalPeriods";
import { GOAL_PERIODS, GOALS_NOTE_ID, extractGoals } from "./goalSections";

/** Goals per period (plan: 1 期間 3 つまで). The MCP tools (#2104) keep it too. */
export const GOALS_PER_PERIOD_LIMIT = 3;

/** One goal the host should create. Fields match `GoalCreateInput`. */
export interface NoteGoalCreate {
  title: string;
  periodKind: GoalPeriodKind;
  periodKey: string;
  sortOrder: number;
  legacyKey: string;
}

export interface NoteGoalPeriodPlan {
  period: GoalPeriodKind;
  creates: NoteGoalCreate[];
  /** Lines of this period that did not fit under the limit. */
  leftInNote: number;
}

/** The fields of a stored goal the plan reads. */
export type ExistingGoal = Pick<
  Goal,
  "periodKind" | "periodKey" | "sortOrder" | "legacyKey"
>;

/** The `legacy_key` of the `index`-th line of one period's section. */
export function noteGoalLegacyKey(
  period: GoalPeriodKind,
  key: string,
  index: number,
): string {
  return `${GOALS_NOTE_ID}:${period}:${key}:${index}`;
}

/**
 * The current-period lines of the goals note, one array per period, in the
 * note's order. Empty arrays when the note has no section for a period.
 */
export function currentNoteGoalLines(
  contentJson: string | null | undefined,
  todayKey: string,
): Record<GoalPeriodKind, string[]> {
  const extracted = extractGoals(
    contentJson,
    goalPeriodKeys(todayKey, WEEK_STARTS_ON),
  );
  return {
    week: extracted.week?.split("\n") ?? [],
    month: extracted.month?.split("\n") ?? [],
    year: extracted.year?.split("\n") ?? [],
  };
}

/**
 * What to create for the day `todayKey`, given the live goals of its three
 * periods. Periods with nothing to do are left out of the result.
 */
export function planNoteGoalMigration(
  contentJson: string | null | undefined,
  todayKey: string,
  existing: readonly ExistingGoal[],
): NoteGoalPeriodPlan[] {
  const lines = currentNoteGoalLines(contentJson, todayKey);
  const plans: NoteGoalPeriodPlan[] = [];
  for (const period of GOAL_PERIODS) {
    const periodLines = lines[period];
    if (periodLines.length === 0) continue;
    // The goal's key, not the heading's: a goal week is always Sunday-based
    // (goalPeriodKey), and the heading key is the same day while
    // WEEK_STARTS_ON is Sunday (#1102).
    const periodKey = goalPeriodKey(period, todayKey);
    const inPeriod = existing.filter(
      (g) => g.periodKind === period && g.periodKey === periodKey,
    );
    const live = new Set(inPeriod.map((g) => g.legacyKey));
    const movable = periodLines
      .slice(0, GOALS_PER_PERIOD_LIMIT)
      .map((title, index) => ({
        title,
        legacyKey: noteGoalLegacyKey(period, periodKey, index),
      }))
      .filter((l) => !live.has(l.legacyKey));
    const room = Math.max(0, GOALS_PER_PERIOD_LIMIT - inPeriod.length);
    const moved = movable.slice(0, room);
    if (moved.length === 0) continue;
    const firstOrder =
      inPeriod.length === 0
        ? 0
        : Math.max(...inPeriod.map((g) => g.sortOrder)) + 1;
    plans.push({
      period,
      creates: moved.map((l, i) => ({
        title: l.title,
        periodKind: period,
        periodKey,
        sortOrder: firstOrder + i,
        legacyKey: l.legacyKey,
      })),
      leftInNote:
        Math.max(0, periodLines.length - GOALS_PER_PERIOD_LIMIT) +
        (movable.length - moved.length),
    });
  }
  return plans;
}
