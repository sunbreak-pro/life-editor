import { useCallback, useEffect, useMemo, useRef } from "react";
import type { RoutineNode } from "../types/routine";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import { todayDateKey } from "../utils/dateKey";
import {
  diffRoutineScheduleItems,
  shouldCreateRoutineItem,
  collectRoutineItemsForDates,
  DEFAULT_ROUTINE_START_TIME,
  DEFAULT_ROUTINE_END_TIME,
} from "../utils/routineScheduleSync";

/**
 * Behaviour-preserving port of
 * frontend/src/hooks/useScheduleItemsRoutineSync.ts — the
 * Routine→schedule_items generator (S4-5). The diff/collect/should
 * decisions delegate to the verbatim-ported pure functions in
 * `../utils/routineScheduleSync` + `routineFrequency`.
 *
 * DI (CLAUDE.md §6.4 — the shared hook never reaches a module
 * singleton, mirroring useScheduleItemsAPI / useRoutinesAPI):
 * - `getDataService()` singleton → `options.dataService` (call-through
 *   only — the schedule_items by-date/by-range/by-routine reads are
 *   already `.eq('is_deleted', false)` in the S4-2
 *   SupabaseScheduleItemsService, and `updateScheduleItem` is the S4-2
 *   single-whitelist-patch (Issue 020). This hook adds NO second
 *   read-then-write and NO duplicate (routine_id,date) guard — a second
 *   guard would diverge from the DataService contract.)
 * - frontend's local `setScheduleItems` / `setMonthlyScheduleItems` /
 *   `scheduleItemsRef` / `bumpVersion()` → `options.onChanged()`. Schedule
 *   rows persist as role='event' into items_meta + events_payload, both of
 *   which ARE in S8 REALTIME_TABLES — so a generation pass also propagates
 *   via Realtime (after the ~300ms debounce + round-trip). The host still
 *   wires `onChanged` to `useScheduleItemsContext().loadDate` to reflect
 *   the write immediately without waiting for that Realtime latency (a
 *   local same-domain optimisation, not a missing-subscription fallback).
 *   The persistence path (the QA-critical Issue 017/011/020 surface) is
 *   identical to the Tauri original; only the UI-refresh signal is injected.
 *
 * Issue 017 four-system guard map (SSOT 軸 3):
 *   (a) is_deleted filter on schedule_items/tasks reads → enforced in
 *       S4-2 DataService (this hook calls through correctly).
 *   (b) routine soft-delete cascades child schedule_items → S4-2
 *       softDeleteRoutine; the generator never resurrects them because
 *       `shouldCreateRoutineItem` returns false for `routine.isDeleted`
 *       (and a deleted routine is absent from the live `routines` list
 *       the host passes in).
 *   (c) (routine_id,date) partial UNIQUE → migration 0006 + S4-2
 *       createScheduleItem live guard (the idempotency防波堤 under
 *       rapid month-flip; QA observes generation count).
 *   (d) collect/diff cannot infinite-loop on corrupt data → the pure
 *       functions' termination is documented in routineScheduleSync.ts
 *       (one local day per cursor step, finite range; reject-order
 *       short-circuits deleted/archived/invisible routines).
 *
 * Scope (S4-5): generator only. CalendarTags (S4-6) is NOT wired here.
 *
 * 2026-07-25 (#352 Step 4): the three never-wired members
 * (`ensureRoutineItemsForWeek` / `backfillMissedRoutineItems` /
 * `syncScheduleItemsWithRoutines`) are deleted and
 * `reconcileRoutineScheduleItems` is now wired to the frequency editor.
 * The RoutineGroup ("group" frequency) parameter is gone with the type.
 */

export interface UseScheduleItemsRoutineSyncOptions {
  dataService: DataService;
  /**
   * Replaces the Tauri hook's `bumpVersion()`. Fired once per
   * generation pass that wrote/deleted at least one row, so the host can
   * re-read the affected dates immediately rather than waiting for the
   * Realtime round-trip (the writes land in items_meta + events_payload,
   * which DO auto-bump `syncVersion` via S8, but with ~300ms debounce +
   * latency). Safe to omit (no-op) — persistence still happens.
   */
  onChanged?: () => void;
}

export function useScheduleItemsRoutineSync(
  options: UseScheduleItemsRoutineSyncOptions,
) {
  const ds = options.dataService;
  const onChanged = options.onChanged;

  // M4 (perf): stabilise the change signal so every returned callback keeps
  // a CONSTANT identity across renders even when the host passes a fresh
  // `onChanged` closure on each render. The live web host does exactly that
  // — RoutineScheduleSync mounts us with `onChanged: () => { if (date) void
  // loadDate(date); }`, an inline arrow that is a new function every render.
  //
  // Before this ref indirection `notifyChanged` had dep `[onChanged]`, so it
  // changed every render → each returned useCallback (dep `[ds,
  // notifyChanged]`) changed every render → the host effect
  // `[date, routines, ensure]` re-fired on EVERY render →
  // one `fetchScheduleItemsByDate` per render (a re-fetch on every unrelated
  // re-render, e.g. hover/typing/sync ticks). The ref holds the latest
  // `onChanged` without feeding it into any dep array, so `notifyChanged`
  // (empty deps) and every generator become referentially stable and the
  // host effect only re-fires on a genuine `date`/`routines`/`groups` change.
  const onChangedRef = useRef(onChanged);
  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  const notifyChanged = useCallback(() => {
    onChangedRef.current?.();
  }, []);

  const ensureRoutineItemsForDate = useCallback(
    async (date: string, routines: RoutineNode[]) => {
      const existing = await ds.fetchScheduleItemsByDate(date);
      const { toCreate } = diffRoutineScheduleItems(existing, routines, date);

      // #279 conflict-rule gate (tier-1 §Schedule rules 1-2): this pass is
      // creation-only. Series edits propagate explicitly — title/time via
      // updateFutureScheduleItemsByRoutine (scope dialog), frequency via
      // reconcileRoutineScheduleItems below. See the removed toUpdate
      // bucket's rationale in routineScheduleSync.ts.

      // DU-C-6 hardening (chat-main HISTORY 2026-05-23 landmine fix):
      // notifyChanged() must NOT fire when bulkCreate threw. Pre-DU-C-6
      // the call lived OUTSIDE the try/catch — on a stub-throw path
      // (loadDate → fetchScheduleItemsByDateAll returning a fresh []
      // each call → context value new ref → re-render → effect re-fires)
      // this rearmed the bulkCreate and produced an infinite render
      // loop. Now we only signal on at-least-one successful write.
      let bulkCreateOk = true;
      if (toCreate.length > 0) {
        try {
          await ds.bulkCreateScheduleItems(toCreate);
        } catch (e) {
          logServiceError("ScheduleItems", "bulkCreate", e);
          bulkCreateOk = false;
        }
      }
      if (bulkCreateOk && toCreate.length > 0) {
        notifyChanged();
      }
    },
    [ds, notifyChanged],
  );

  /**
   * Returns true when the pass fully applied, false when any write/read
   * failed (#296): callers that SEQUENCE destructive work behind this fill
   * (the scope dialog's fillUpToAnchor → detach) must abort on false — the
   * old void-swallow let a failed fill silently feed rows to the deleter.
   */
  const ensureRoutineItemsForDateRange = useCallback(
    async (
      startDate: string,
      endDate: string,
      routines: RoutineNode[],
    ): Promise<boolean> => {
      try {
        const existing = await ds.fetchScheduleItemsByDateRange(
          startDate,
          endDate,
        );

        const routineMap = new Map(routines.map((r) => [r.id, r]));

        // Cleanup: soft-delete routine items that no longer match frequency
        // (#296: soft, NOT the hard bulkDelete — auto-cleanup must stay
        // Trash-recoverable). "today" honors the day-start-hour pref (#218)
        // so the still-running late-night day is treated as editable, not
        // past. Hand-moved rows (date drifted from the generator's
        // source_date) are user edits — they never match the frequency for
        // their new day, and deleting them was #296's unrecoverable-loss
        // path. Skip them.
        const today = todayDateKey();
        const toDeleteIds = new Set<string>();
        for (const item of existing) {
          if (!item.routineId) continue;
          if (item.completed || item.date < today) continue;
          if (item.sourceDate != null && item.sourceDate !== item.date)
            continue;
          const routine = routineMap.get(item.routineId);
          if (!routine) continue;
          if (!shouldCreateRoutineItem(routine, item.date)) {
            toDeleteIds.add(item.id);
          }
        }
        if (toDeleteIds.size > 0) {
          await ds.bulkSoftDeleteScheduleItems([...toDeleteIds]);
        }

        // Build existingSet excluding deleted items. Keyed on the CALENDAR
        // date (mirrors collectRoutineItemsForDates, which iterates by
        // calendar date and mints source_date = that date). A hand-moved
        // row's own (routine, source_date) slot is still protected from a
        // duplicate INSERT by the service-layer pre-check in
        // bulkCreateScheduleItems, so keying here on source_date instead
        // would leave the vacated calendar day free to regenerate — a
        // spurious extra occurrence.
        const existingSet = new Set<string>();
        for (const item of existing) {
          if (item.routineId && !toDeleteIds.has(item.id)) {
            existingSet.add(`${item.routineId}:${item.date}`);
          }
        }

        // Create missing items for matching dates
        const toCreate = collectRoutineItemsForDates(
          new Date(startDate + "T00:00:00"),
          new Date(endDate + "T00:00:00"),
          routines,
          existingSet,
        );

        if (toCreate.length > 0) {
          await ds.bulkCreateScheduleItems(toCreate);
        }
        if (toDeleteIds.size > 0 || toCreate.length > 0) {
          notifyChanged();
        }
        return true;
      } catch (e) {
        logServiceError("ScheduleItems", "ensureRoutineItemsForDateRange", e);
        return false;
      }
    },
    [ds, notifyChanged],
  );

  /**
   * Propagate a FREQUENCY change onto already-materialised occurrences
   * of one routine (#352 Step 4 — tier-1 §Schedule 競合解決ルール):
   * days that dropped out of the schedule are cleaned up, days that
   * newly fire are materialised across `dateRange`.
   *
   * Title / time propagation is NOT this function's job — that runs
   * through the scope dialog (`updateFutureScheduleItemsByRoutine`,
   * #279), which asks the user this/future/all first.
   *
   * Conflict rules, in the order the delete filter applies them:
   *   1. 実績は不可侵 — done rows are skipped here, and dismissed rows
   *      never even arrive (`fetchScheduleItemsByRoutineId` filters
   *      `is_dismissed = false`); the `isDismissed` check is kept as
   *      defence-in-depth against a future contract change.
   *      Past-dated rows are skipped wholesale ("today" honours the
   *      day-start-hour pref, #218, so the still-running late-night day
   *      counts as editable, not past).
   *   2. 手動編集は Routine 変更に勝つ — with `template` (the routine's
   *      values BEFORE this edit) supplied, only rows still matching it
   *      are touched. A row the user retitled or re-timed individually
   *      is theirs. A null template time is NOT a wildcard: a time-less
   *      routine materialises with the generator defaults, so compare
   *      against those effective values (same rule as #279's
   *      updateFutureScheduleItemsByRoutine). Hand-MOVED rows (date
   *      drifted from source_date) are user edits too — #296.
   *   3. 発火日から外れた未来行 — soft-delete (Trash-recoverable), never
   *      the hard bulkDelete.
   *
   * Regeneration is delegated to `collectRoutineItemsForDates`, so a
   * deleted / archived / hidden routine cannot spawn rows here either.
   * Dismissed days are absent from `existingDates` (see rule 1) and so
   * are candidates for re-creation — the (routine_id, source_date)
   * partial UNIQUE + the bulkCreate upsert's ignoreDuplicates absorb
   * that write, exactly as they do for the always-on day generator.
   */
  const reconcileRoutineScheduleItems = useCallback(
    async (
      routine: RoutineNode,
      dateRange?: { startDate: string; endDate: string },
      template?: {
        title: string;
        startTime: string | null;
        endTime: string | null;
      },
    ) => {
      try {
        const allItems = await ds.fetchScheduleItemsByRoutineId(routine.id);
        const today = todayDateKey();

        const templateStart = template?.startTime ?? DEFAULT_ROUTINE_START_TIME;
        const templateEnd = template?.endTime ?? DEFAULT_ROUTINE_END_TIME;

        const toDeleteIds = allItems
          .filter((item) => {
            // rule 1: the life record is untouchable.
            if (item.completed || item.isDismissed) return false;
            if (item.date < today) return false;
            // rule 2: manual edits win over the series.
            if (item.sourceDate != null && item.sourceDate !== item.date)
              return false;
            if (
              template &&
              (item.title !== template.title ||
                item.startTime !== templateStart ||
                item.endTime !== templateEnd)
            )
              return false;
            // rule 3: only rows the new frequency no longer fires on.
            return !shouldCreateRoutineItem(routine, item.date);
          })
          .map((item) => item.id);

        if (toDeleteIds.length > 0) {
          await ds.bulkSoftDeleteScheduleItems(toDeleteIds);
        }

        let created = 0;
        if (dateRange) {
          const deleteSet = new Set(toDeleteIds);
          const existingSet = new Set(
            allItems
              .filter((i) => !deleteSet.has(i.id))
              .map((i) => `${routine.id}:${i.date}`),
          );

          // Never materialise into the past: fabricating not-done rows
          // into past days would pollute the life record (rule 1 spirit).
          const startDate =
            dateRange.startDate < today ? today : dateRange.startDate;
          if (startDate <= dateRange.endDate) {
            const toCreate = collectRoutineItemsForDates(
              new Date(startDate + "T00:00:00"),
              new Date(dateRange.endDate + "T00:00:00"),
              [routine],
              existingSet,
            );
            if (toCreate.length > 0) {
              await ds.bulkCreateScheduleItems(toCreate);
              created = toCreate.length;
            }
          }
        }

        if (toDeleteIds.length > 0 || created > 0) {
          notifyChanged();
        }
      } catch (e) {
        logServiceError("ScheduleItems", "reconcileRoutine", e);
      }
    },
    [ds, notifyChanged],
  );

  // M4 (perf): memoise the returned container so the object identity is also
  // stable across renders (all three members are referentially stable —
  // deps are `[ds, notifyChanged]`, both constant). A consumer that depends
  // on the whole object (rather than a destructured member) therefore does
  // not re-fire its effects every render either.
  return useMemo(
    () =>
      ({
        ensureRoutineItemsForDate,
        ensureRoutineItemsForDateRange,
        reconcileRoutineScheduleItems,
      }) as const,
    [
      ensureRoutineItemsForDate,
      ensureRoutineItemsForDateRange,
      reconcileRoutineScheduleItems,
    ],
  );
}
