import { useEffect } from "react";
import {
  GOALS_NOTE_ID,
  currentNoteGoalLines,
  generateId,
  planNoteGoalMigration,
  useToastOptional,
  useTranslation,
  type DataService,
} from "@life-editor/shared";

/*
 * Moves the current-period lines of the goals note into goals, once (#2105,
 * plan Step 6). What moves and what stays is the pure
 * `planNoteGoalMigration` (shared/src/components/briefing/goalNoteMigration.ts);
 * this file owns the I/O, the "once" guard and the toast.
 *
 * Once is held at three levels, cheapest first:
 *   1. One run per DataService and day in this tab (`runs` below). StrictMode's
 *      second effect and a second paper mounted at the same time join the run
 *      already in flight instead of starting their own.
 *   2. Across reloads, the plan skips every line whose `legacy_key` is
 *      already on a live goal, and plans only the lines still missing.
 *   3. Across devices and trashed goals, the DB keeps `legacy_key` unique
 *      (0034), so the losing create fails and is counted as already moved.
 *
 * The toast belongs to the run, not to the mount that started it: the run
 * calls it once when it settles, through the global ToastProvider, so leaving
 * Briefing before the creates finish still tells the user what stayed behind.
 *
 * Nothing here writes to the note. A trashed or password-locked note is left
 * alone, the same guard useGoalsDoc's read has: a trashed note was deleted on
 * purpose, and a locked one comes back without its body.
 */

export interface NoteGoalsMigrationResult {
  /** Goals created by this run. */
  created: number;
  /** Lines left in the note because their period was full. */
  leftInNote: number;
  /**
   * Set when a create failed for a reason other than "already moved". The
   * period it failed in stopped there and reports nothing; the other periods
   * still ran. The host drops the run so the next open finishes the period.
   */
  error?: unknown;
}

const NOTHING: NoteGoalsMigrationResult = { created: 0, leftInNote: 0 };

/** The 0034 partial UNIQUE that makes a second copy of a moved line fail. */
const LEGACY_KEY_UNIQUE = "uq_goals_payload_legacy_key";

function isAlreadyMoved(err: unknown): boolean {
  return err instanceof Error && err.message.includes(LEGACY_KEY_UNIQUE);
}

/** One full run: read the note and the period's goals, create what is missing. */
export async function migrateNoteGoals(
  ds: DataService,
  todayKey: string,
): Promise<NoteGoalsMigrationResult> {
  const note = await ds.getNoteUnified(GOALS_NOTE_ID);
  if (note === null || note.isDeleted === true || note.hasPassword) {
    return NOTHING;
  }
  const lines = currentNoteGoalLines(note.content, todayKey);
  // Most opens end here: no current-period text means no goal read at all.
  if (Object.values(lines).every((l) => l.length === 0)) return NOTHING;

  const existing = await ds.fetchGoalsForDate(todayKey);
  const result: NoteGoalsMigrationResult = { created: 0, leftInNote: 0 };
  for (const plan of planNoteGoalMigration(note.content, todayKey, existing)) {
    let createdHere = 0;
    let failed = false;
    // One at a time and in order, so sort_order follows the note's lines.
    for (const create of plan.creates) {
      try {
        await ds.createGoal({ id: generateId("goal"), ...create });
        createdHere += 1;
      } catch (err) {
        if (isAlreadyMoved(err)) continue;
        // Stop this period here so its lines keep their order; the next
        // open plans the lines still missing.
        result.error ??= err;
        failed = true;
        break;
      }
    }
    result.created += createdHere;
    // Only a period that really moved, and finished, reports what it left
    // behind: a later open that finds everything already moved stays quiet,
    // and a period cut short says it once the retry completes it.
    if (createdHere > 0 && !failed) result.leftInNote += plan.leftInNote;
  }
  return result;
}

type Announce = (leftInNote: number) => void;

/*
 * Keyed by the DataService (a sign-out swaps it) and then the day (a paper
 * left open past midnight stands in a new period). A failed run is dropped so
 * the next open retries; a finished one stays, so coming back to Briefing in
 * the same session costs nothing.
 */
const runs = new WeakMap<DataService, Map<string, Promise<void>>>();

function runOnce(ds: DataService, todayKey: string, announce: Announce): void {
  let byDay = runs.get(ds);
  if (byDay === undefined) {
    byDay = new Map();
    runs.set(ds, byDay);
  }
  if (byDay.has(todayKey)) return;
  const days = byDay;
  const drop = (err: unknown): void => {
    if (days.get(todayKey) === run) days.delete(todayKey);
    // No error toast: nothing the user wrote is at risk (the note is
    // untouched), and the next open tries again — the same call useGoalsDoc
    // makes for a failed read.
    console.error("[BriefingScreen] goals note migration failed", err);
  };
  const run: Promise<void> = migrateNoteGoals(ds, todayKey).then((result) => {
    if (result.error !== undefined) drop(result.error);
    if (result.leftInNote > 0) announce(result.leftInNote);
  }, drop);
  days.set(todayKey, run);
}

export function useNoteGoalsMigration(ds: DataService, todayKey: string): void {
  const { t } = useTranslation();
  const showToast = useToastOptional()?.showToast;

  useEffect(() => {
    // Only the first mount of a run is heard; StrictMode's second effect and
    // a second paper join it without a callback of their own.
    runOnce(ds, todayKey, (count) => {
      showToast?.("warning", t("briefing.goals.migrationOverflow", { count }), {
        durationMs: 8000,
      });
    });
  }, [ds, todayKey, showToast, t]);
}
