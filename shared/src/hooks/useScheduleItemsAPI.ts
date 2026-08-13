import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { ScheduleItem } from "../types/schedule";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import { todayCalendarKey } from "../utils/dateKey";
import { createNoopUndoRedo } from "./useTaskTreeHistory";
import type { UndoRedoLike } from "./useTaskTreeHistory";
import { useDomainLoad } from "./useDomainLoad";
import { useSyncDomains } from "./useSyncDomains";
import { useScheduleItemsViewMirror } from "./useScheduleItemsViewMirror";
import { useScheduleItemsCRUD } from "./useScheduleItemsCRUD";
import { useScheduleItemsTrash } from "./useScheduleItemsTrash";

/**
 * Behaviour-preserving port of the Tauri schedule_items hooks
 * (frontend/src/hooks/useScheduleItems.ts) into one shared API hook —
 * same shape as useRoutinesAPI and the other shared API hooks. Host
 * dependencies are injected, not imported (CLAUDE.md §6.4):
 * - `getDataService()` singleton → `options.dataService`
 * - host UndoRedo Context        → `options.undoRedo` (no-op default;
 *   real UndoRedo lands in S6, same as tasks/daily/notes/routines)
 *
 * Must sit inside a Sync Provider (reads `useSyncContext`) — CLAUDE.md
 * §6.2 places ScheduleItems as the SECOND of the Schedule trio, inside
 * Routine (… → Routine → ScheduleItems → CalendarTags → …).
 *
 * Scope (S4-4): schedule_items CRUD only (by-date / by-range / create /
 * update / soft-delete / restore / purge / fetch-deleted / toggle-
 * complete / dismiss / undismiss / bulk-delete). The
 * Routine→schedule_items generator (`ensureRoutineItemsForDate(Range)`)
 * is S4-5 and is NOT implemented or called here. Manually created items
 * carry `routineId = null` (generator-derived rows are out of scope).
 *
 * #675 split — this file now owns the state, the two reads and the
 * composition; the three responsibilities that used to sit inline are:
 * - `useScheduleItemsViewMirror` — the host's on-screen store bridge (#568)
 * - `useScheduleItemsCRUD`       — the writes and the undo commands they push
 * - `useScheduleItemsTrash`      — the Trash list
 * The returned object is unchanged (`ScheduleItemsContextValue` is its
 * `ReturnType`, so a drift would not compile).
 */

/**
 * #568: the host's on-screen row store, registered so undo/redo can write its
 * rollback where the grid actually reads from. Re-exported from its own module
 * so importers — including `shared/src/index.ts` — keep working.
 */
export type { ScheduleItemsViewMirror } from "./useScheduleItemsViewMirror";

export interface UseScheduleItemsAPIOptions {
  dataService: DataService;
  undoRedo?: UndoRedoLike;
  /**
   * The date the view is anchored on (`YYYY-MM-DD`). The initial load +
   * every `syncVersion` bump refetches the live items for this date.
   * Defaults to today (local calendar day via `todayCalendarKey` — the
   * plain-midnight boundary, no day-start-hour shift; S4-0: no UTC
   * conversion).
   */
  date?: string;
}

export function useScheduleItemsAPI(options: UseScheduleItemsAPIOptions) {
  const ds = options.dataService;
  const { push } = options.undoRedo ?? createNoopUndoRedo();
  const syncVersion = useSyncDomains("schedule");

  const date = options.date ?? todayCalendarKey();

  // Live anchored date for the undo/redo closures (#304 child-2): a command
  // pushed on day A may run after the view moved to day B, and comparing
  // against the CAPTURED `date` would splice day-A rows into day-B's list
  // (display-only, but wrong until the next refetch). Same render-time-ref
  // idiom as UndoRedoContext's appliedRef.
  const dateRef = useRef(date);
  // Mirrored in an effect (#505), matching itemsRef just below — the two
  // used to disagree in this very file. Its readers are undo/redo closures,
  // which run long after the commit.
  useEffect(() => {
    dateRef.current = date;
  });

  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [deletedItems, setDeletedItems] = useState<ScheduleItem[]>([]);

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const mirror = useScheduleItemsViewMirror(itemsRef);
  const { registerViewMirror } = mirror;

  // Initial load + every syncVersion bump (mirrors routines/calendars),
  // through the shared load effect (#672) — loading is DERIVED from whether
  // the read for the current (service, version, date) has settled, so the
  // effect no longer opens by synchronously flipping a loading flag (this file
  // was the last entry in shared's eslint baseline). The anchored date rides
  // along as `anchor`: switching days restarts the load exactly like a
  // Realtime bump. fetch_by_date_all keeps dismissed items visible so the UI
  // can offer "undismiss".
  const { isLoading, error, setError } = useDomainLoad({
    domain: "ScheduleItems",
    dataService: ds,
    version: syncVersion,
    anchor: date,
    load: (service) => service.fetchScheduleItemsByDateAll(date),
    apply: setItems,
    fallbackMessage: "Failed to load schedule items",
  });

  // Trash, read on the same cursor but deliberately on its own: a failure here
  // must not block the active list (nor gate `isLoading` / set `error` — the
  // trash view has its own empty state and the active list is what the screen
  // is waiting for). Unlike the read above it is NOT keyed on `date` — the
  // trash list is not date-anchored, and TrashView refreshes imperatively
  // through `loadDeletedScheduleItems` when it opens.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const deleted = await ds.fetchDeletedScheduleItems();
        if (!cancelled) setDeletedItems(deleted);
      } catch (e) {
        logServiceError("ScheduleItems", "fetchDeleted", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ds, syncVersion]);

  const loadDate = useCallback(
    async (target: string) => {
      try {
        const list = await ds.fetchScheduleItemsByDateAll(target);
        if (target === (options.date ?? date)) {
          setItems(list);
          setError(null); // #296: un-latch (see the fetch effect)
        }
        return list;
      } catch (e) {
        logServiceError("ScheduleItems", "fetch", e);
        setError(
          e instanceof Error ? e.message : "Failed to load schedule items",
        );
        return [];
      }
    },
    [ds, options.date, date, setError],
  );

  // #296: re-throws on failure instead of returning []. The old
  // swallow-into-empty made a transient fetch failure indistinguishable
  // from a genuinely empty week — the visible-range store then rendered
  // the whole calendar blank and marked that emptiness as settled truth.
  // Sole consumer is useVisibleRangeItems, which catches and keeps the
  // previous list on screen.
  const loadDateRange = useCallback(
    async (startDate: string, endDate: string) => {
      try {
        return await ds.fetchScheduleItemsByDateRange(startDate, endDate);
      } catch (e) {
        logServiceError("ScheduleItems", "fetchRange", e);
        throw e instanceof Error
          ? e
          : new Error("Failed to load schedule items range");
      }
    },
    [ds],
  );

  const {
    createScheduleItem,
    updateScheduleItem,
    toggleComplete,
    dismiss,
    undismiss,
    deleteScheduleItem,
    bulkDeleteScheduleItems,
  } = useScheduleItemsCRUD({
    ds,
    push,
    date,
    dateRef,
    setItems,
    setDeletedItems,
    mirror,
  });

  const {
    loadDeletedScheduleItems,
    restoreScheduleItem,
    permanentDeleteScheduleItem,
  } = useScheduleItemsTrash({ ds, date, setItems, setDeletedItems });

  return useMemo(
    () => ({
      date,
      items,
      deletedItems,
      isLoading,
      error,
      registerViewMirror,
      loadDate,
      loadDateRange,
      createScheduleItem,
      updateScheduleItem,
      toggleComplete,
      dismiss,
      undismiss,
      deleteScheduleItem,
      loadDeletedScheduleItems,
      restoreScheduleItem,
      permanentDeleteScheduleItem,
      bulkDeleteScheduleItems,
    }),
    [
      date,
      items,
      deletedItems,
      isLoading,
      error,
      registerViewMirror,
      loadDate,
      loadDateRange,
      createScheduleItem,
      updateScheduleItem,
      toggleComplete,
      dismiss,
      undismiss,
      deleteScheduleItem,
      loadDeletedScheduleItems,
      restoreScheduleItem,
      permanentDeleteScheduleItem,
      bulkDeleteScheduleItems,
    ],
  );
}
