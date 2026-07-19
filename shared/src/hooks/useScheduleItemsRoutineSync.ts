import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ScheduleItem } from "../types/schedule";
import type { RoutineNode } from "../types/routine";
import type { RoutineGroup } from "../types/routineGroup";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";
import { formatDateKey, todayDateKey } from "../utils/dateKey";
import {
  diffRoutineScheduleItems,
  shouldCreateRoutineItem,
  collectRoutineItemsForDates,
} from "../utils/routineScheduleSync";
import { shouldRoutineRunOnDate } from "../utils/routineFrequency";

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
 *       short-circuits deleted/archived/invisible/group-less routines).
 *
 * Scope (S4-5): generator only. CalendarTags (S4-6) is NOT wired here.
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

export interface RoutineSyncResolved {
  routines: RoutineNode[];
  groupForRoutine?: Map<string, RoutineGroup[]>;
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
  // `[date, routines, groupForRoutine, ensure]` re-fired on EVERY render →
  // one `fetchScheduleItemsByDate` per render (a re-fetch on every unrelated
  // re-render, e.g. hover/typing/sync ticks). The ref holds the latest
  // `onChanged` without feeding it into any dep array, so `notifyChanged`
  // (empty deps) and all six generators become referentially stable and the
  // host effect only re-fires on a genuine `date`/`routines`/`groups` change.
  const onChangedRef = useRef(onChanged);
  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  const notifyChanged = useCallback(() => {
    onChangedRef.current?.();
  }, []);

  const ensureRoutineItemsForDate = useCallback(
    async (
      date: string,
      routines: RoutineNode[],
      groupForRoutine?: Map<string, RoutineGroup[]>,
    ) => {
      const existing = await ds.fetchScheduleItemsByDate(date);
      const { toCreate } = diffRoutineScheduleItems(
        existing,
        routines,
        date,
        groupForRoutine,
      );

      // #279 conflict-rule gate (tier-1 §Schedule rules 1-2): the diff's
      // toUpdate bucket is NOT applied here anymore. It cannot tell a manual
      // per-occurrence edit (which must WIN over the template, rule 2) from
      // template drift, and its input includes completed rows (rule 1) —
      // applying it reverted 「この予定のみ」 scope edits and rewrote done
      // records whenever a routines refetch re-fired this generator.
      // Creation-only until the Step 4 reconcile lands with a real
      // manual-edit discriminator. Series edits propagate explicitly via
      // updateFutureScheduleItemsByRoutine (scope dialog).

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

  const ensureRoutineItemsForWeek = useCallback(
    async (
      routines: RoutineNode[],
      groupForRoutine?: Map<string, RoutineGroup[]>,
    ) => {
      try {
        // Week window starts on the day-start-hour aware "today" (#218),
        // consistent with the cleanup / backfill / reconcile boundaries.
        const startDate = todayDateKey();
        const today = new Date(startDate + "T00:00:00");
        const endDay = new Date(today);
        endDay.setDate(endDay.getDate() + 7);

        const endDate = formatDateKey(endDay);

        const existing = await ds.fetchScheduleItemsByDateRange(
          startDate,
          endDate,
        );

        const existingSet = new Set<string>();
        for (const item of existing) {
          if (item.routineId) {
            existingSet.add(`${item.routineId}:${item.date}`);
          }
        }

        const toCreate = collectRoutineItemsForDates(
          today,
          endDay,
          routines,
          groupForRoutine,
          existingSet,
        );

        if (toCreate.length > 0) {
          await ds.bulkCreateScheduleItems(toCreate);
          notifyChanged();
        }
      } catch (e) {
        logServiceError("ScheduleItems", "ensureRoutineItemsForWeek", e);
      }
    },
    [ds, notifyChanged],
  );

  const ensureRoutineItemsForDateRange = useCallback(
    async (
      startDate: string,
      endDate: string,
      routines: RoutineNode[],
      groupForRoutine?: Map<string, RoutineGroup[]>,
    ) => {
      try {
        const existing = await ds.fetchScheduleItemsByDateRange(
          startDate,
          endDate,
        );

        const routineMap = new Map(routines.map((r) => [r.id, r]));

        // Cleanup: delete routine items that no longer match frequency.
        // "today" honors the day-start-hour pref (#218) so the still-running
        // late-night day is treated as editable, not past.
        const today = todayDateKey();
        const toDeleteIds = new Set<string>();
        for (const item of existing) {
          if (!item.routineId) continue;
          if (item.completed || item.date < today) continue;
          const routine = routineMap.get(item.routineId);
          if (!routine) continue;
          if (!shouldCreateRoutineItem(routine, item.date, groupForRoutine)) {
            toDeleteIds.add(item.id);
          }
        }
        if (toDeleteIds.size > 0) {
          await ds.bulkDeleteScheduleItems([...toDeleteIds]);
        }

        // Build existingSet excluding deleted items
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
          groupForRoutine,
          existingSet,
        );

        if (toCreate.length > 0) {
          await ds.bulkCreateScheduleItems(toCreate);
        }
        if (toDeleteIds.size > 0 || toCreate.length > 0) {
          notifyChanged();
        }
      } catch (e) {
        logServiceError("ScheduleItems", "ensureRoutineItemsForDateRange", e);
      }
    },
    [ds, notifyChanged],
  );

  const backfillMissedRoutineItems = useCallback(
    async (
      routines: RoutineNode[],
      groupForRoutine?: Map<string, RoutineGroup[]>,
    ) => {
      try {
        const lastDate = await ds.fetchLastRoutineDate();
        const today = todayDateKey();
        if (!lastDate || lastDate >= today) return;

        const start = new Date(lastDate + "T00:00:00");
        start.setDate(start.getDate() + 1);
        const end = new Date(today + "T00:00:00");

        // Cap at 90 days
        const maxMs = 90 * 24 * 60 * 60 * 1000;
        if (end.getTime() - start.getTime() > maxMs) {
          start.setTime(end.getTime() - maxMs);
        }

        // Build existingSet so we skip (routine_id, date) pairs that
        // already exist. Without this, short-window multi-invocation
        // (app relaunch, StrictMode double-effect) could push new rows
        // with fresh ids for the same logical slot and accumulate
        // duplicates on Cloud.
        const rangeStartKey = formatDateKey(start);
        const rangeEndKey = formatDateKey(end);
        const existing = await ds.fetchScheduleItemsByDateRange(
          rangeStartKey,
          rangeEndKey,
        );
        const existingSet = new Set<string>();
        for (const item of existing) {
          if (item.routineId) {
            existingSet.add(`${item.routineId}:${item.date}`);
          }
        }

        const toCreate = collectRoutineItemsForDates(
          start,
          end,
          routines,
          groupForRoutine,
          existingSet,
        );

        if (toCreate.length > 0) {
          await ds.bulkCreateScheduleItems(toCreate);
          notifyChanged();
        }
      } catch (e) {
        logServiceError("ScheduleItems", "backfillMissedRoutineItems", e);
      }
    },
    [ds, notifyChanged],
  );

  /**
   * Propagate routine title/time edits onto already-materialised
   * schedule_items. The Tauri hook mutated two local state lists in
   * place; the shared port computes the same `updateScheduleItem`
   * write set (single-patch via S4-2 — Issue 020) and signals
   * `onChanged` so the host re-reads. Returns the resolved updates so a
   * caller that holds the live list can apply them optimistically.
   */
  const syncScheduleItemsWithRoutines = useCallback(
    (routines: RoutineNode[], currentItems: ScheduleItem[]) => {
      const routineMap = new Map(routines.map((r) => [r.id, r]));
      const applied: RoutineNode[] = [];
      let changed = false;
      for (const item of currentItems) {
        if (!item.routineId) continue;
        const routine = routineMap.get(item.routineId);
        if (!routine || routine.isDeleted) continue;
        const newTitle = routine.title;
        const newStart = routine.startTime ?? "09:00";
        const newEnd = routine.endTime ?? "09:30";
        if (
          item.title === newTitle &&
          item.startTime === newStart &&
          item.endTime === newEnd
        )
          continue;
        changed = true;
        applied.push(routine);
        ds.updateScheduleItem(item.id, {
          title: newTitle,
          startTime: newStart,
          endTime: newEnd,
        }).catch((e) => logServiceError("ScheduleItems", "syncRoutine", e));
      }
      if (changed) {
        notifyChanged();
      }
      return { changed, affectedRoutines: applied };
    },
    [ds, notifyChanged],
  );

  const reconcileRoutineScheduleItems = useCallback(
    async (
      routine: RoutineNode,
      group?: RoutineGroup,
      dateRange?: { startDate: string; endDate: string },
    ) => {
      try {
        const allItems = await ds.fetchScheduleItemsByRoutineId(routine.id);
        const today = todayDateKey();

        // Delete non-matching items (today onward only)
        const toDeleteIds = allItems
          .filter((item) => {
            if (item.completed) return false;
            if (item.date < today) return false;
            const match = group
              ? shouldRoutineRunOnDate(
                  group.frequencyType,
                  group.frequencyDays,
                  group.frequencyInterval,
                  group.frequencyStartDate,
                  item.date,
                )
              : shouldRoutineRunOnDate(
                  routine.frequencyType,
                  routine.frequencyDays,
                  routine.frequencyInterval,
                  routine.frequencyStartDate,
                  item.date,
                );
            return !match;
          })
          .map((item) => item.id);

        if (toDeleteIds.length > 0) {
          await ds.bulkDeleteScheduleItems(toDeleteIds);
        }

        // Create missing items for matching dates in range
        if (dateRange) {
          const deleteSet = new Set(toDeleteIds);
          const existingDates = new Set(
            allItems.filter((i) => !deleteSet.has(i.id)).map((i) => i.date),
          );

          const toCreate: Array<{
            id: string;
            date: string;
            title: string;
            startTime: string;
            endTime: string;
            routineId: string;
          }> = [];

          const rangeStart = new Date(dateRange.startDate + "T00:00:00");
          const todayDate = new Date(today + "T00:00:00");
          const cursorDate =
            rangeStart < todayDate ? new Date(todayDate) : rangeStart;
          const end = new Date(dateRange.endDate + "T00:00:00");
          while (cursorDate <= end) {
            const dateKey = formatDateKey(cursorDate);
            if (!existingDates.has(dateKey)) {
              const match = group
                ? shouldRoutineRunOnDate(
                    group.frequencyType,
                    group.frequencyDays,
                    group.frequencyInterval,
                    group.frequencyStartDate,
                    dateKey,
                  )
                : shouldRoutineRunOnDate(
                    routine.frequencyType,
                    routine.frequencyDays,
                    routine.frequencyInterval,
                    routine.frequencyStartDate,
                    dateKey,
                  );
              if (match) {
                toCreate.push({
                  id: generateId("si"),
                  date: dateKey,
                  title: routine.title,
                  startTime: routine.startTime ?? "09:00",
                  endTime: routine.endTime ?? "09:30",
                  routineId: routine.id,
                });
              }
            }
            cursorDate.setDate(cursorDate.getDate() + 1);
          }

          if (toCreate.length > 0) {
            await ds.bulkCreateScheduleItems(toCreate);
          }
        }

        notifyChanged();
      } catch (e) {
        logServiceError("ScheduleItems", "reconcileRoutine", e);
      }
    },
    [ds, notifyChanged],
  );

  // M4 (perf): memoise the returned container so the object identity is also
  // stable across renders (all six members are now referentially stable —
  // deps are `[ds, notifyChanged]`, both constant). A consumer that depends
  // on the whole object (rather than a destructured member) therefore does
  // not re-fire its effects every render either.
  return useMemo(
    () =>
      ({
        ensureRoutineItemsForDate,
        ensureRoutineItemsForWeek,
        ensureRoutineItemsForDateRange,
        backfillMissedRoutineItems,
        syncScheduleItemsWithRoutines,
        reconcileRoutineScheduleItems,
      }) as const,
    [
      ensureRoutineItemsForDate,
      ensureRoutineItemsForWeek,
      ensureRoutineItemsForDateRange,
      backfillMissedRoutineItems,
      syncScheduleItemsWithRoutines,
      reconcileRoutineScheduleItems,
    ],
  );
}
