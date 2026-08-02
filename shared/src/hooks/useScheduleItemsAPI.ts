import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { ScheduleItem } from "../types/schedule";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";
import { todayCalendarKey } from "../utils/dateKey";
import { createNoopUndoRedo, type UndoRedoLike } from "./useTaskTreeHistory";
import { useSyncDomains } from "./useSyncDomains";

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
 * Issue 011 ((routine_id, date) live-row idempotency) and Issue 020
 * (single whitelist patch on update) are enforced in the DataService
 * layer (S4-2, SupabaseScheduleItemsService). This hook only calls
 * through — it does NOT re-add a duplicate guard (a second guard here
 * would diverge from the Tauri repository contract).
 */

const isSameDate = (item: ScheduleItem, date: string): boolean =>
  item.date === date;

/**
 * The host's own copy of the rows currently on screen (#568).
 *
 * This hook is anchored on ONE day (see `date` below), so `items` only ever
 * holds that day's rows — but the calendar grid renders a whole week/month
 * out of its own visible-range store. Two things broke because of that gap:
 * a mutation on any other day found no `prev` here and pushed NO undo command
 * at all, and the commands that did get pushed wrote their rollback into
 * `items`, which the grid does not read (so "元に戻しました" appeared while the
 * event stayed put until a Realtime refetch).
 *
 * The host registers this mirror once (`registerViewMirror`) and the undo /
 * redo closures then read and write BOTH lists. Forward writes stay where they
 * are — the host's mutation layer already patches its own store on the way in
 * (and owns extras like selection), so mirroring them here would just do the
 * same work twice.
 *
 * All four methods must be no-op-safe for ids the mirror does not hold: an
 * undo may run long after the view navigated away from that row.
 *
 * ORDER CONTRACT: the host calls the mutation here FIRST and patches its own
 * store after. The undo command snapshots the row through `find`, and this
 * interface deliberately says NOTHING about when a patch becomes visible to
 * `find` — a mirror backed by an effect-updated ref lags a commit behind, one
 * answering from live state does not. Calling in this order is what makes the
 * snapshot the pre-edit row under either implementation; a host that patches
 * first is correct only by accident of its own timing, and the accident ends
 * the day the mirror is reimplemented.
 */
export interface ScheduleItemsViewMirror {
  /** Row lookup for ids outside the anchored day. */
  find: (id: string) => ScheduleItem | undefined;
  /** Insert (or replace) a row — undo of a delete / dismiss / redo of create. */
  upsert: (item: ScheduleItem) => void;
  /** Patch fields of a row the mirror already holds; no-op otherwise. */
  patch: (id: string, patch: Partial<ScheduleItem>) => void;
  /** Drop a row — undo of a create / redo of a delete / dismiss. */
  remove: (id: string) => void;
}

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // #568: the host's on-screen store (the calendar's visible range). Held in a
  // ref, not state, because its only readers are the undo/redo closures, which
  // run long after the commit — and because re-rendering every consumer when a
  // host attaches its store would buy nothing.
  const viewMirrorRef = useRef<ScheduleItemsViewMirror | null>(null);
  /**
   * Attach the host's on-screen store; returns the detach function (call it
   * from the effect's cleanup). Only one mirror at a time — the calendar host
   * is the single surface that keeps a range copy.
   */
  const registerViewMirror = useCallback((mirror: ScheduleItemsViewMirror) => {
    viewMirrorRef.current = mirror;
    return () => {
      // Guarded: a later host may have replaced it already (StrictMode
      // double-effects re-register before the first cleanup runs).
      if (viewMirrorRef.current === mirror) viewMirrorRef.current = null;
    };
  }, []);

  // The row as it is RIGHT NOW, from either list. This is what an undo command
  // captures as its "prev" — before #568 it only looked at the anchored day, so
  // every edit outside today pushed nothing and Ctrl+Z sat disabled.
  const findItem = useCallback(
    (id: string): ScheduleItem | undefined =>
      itemsRef.current.find((i) => i.id === id) ??
      viewMirrorRef.current?.find(id),
    [],
  );

  // Put a row back on screen: replace it wholesale when we still hold the
  // pre-mutation snapshot, otherwise patch whatever the mirror has.
  const mirrorRestore = useCallback(
    (
      id: string,
      snapshot: ScheduleItem | undefined,
      patch: Partial<ScheduleItem>,
    ) => {
      const mirror = viewMirrorRef.current;
      if (!mirror) return;
      if (snapshot) mirror.upsert({ ...snapshot, ...patch });
      else mirror.patch(id, patch);
    },
    [],
  );

  // Initial load + every syncVersion bump (mirrors routines/notes). The
  // active-date read and the trash read run independently so a failure
  // in one does not block the other. fetch_by_date_all keeps dismissed
  // items visible so the UI can offer "undismiss".
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const list = await ds.fetchScheduleItemsByDateAll(date);
        if (cancelled) return;
        setItems(list);
        // #296: clear a previously latched error — without this, one
        // transient fetch failure kept the section's error card up forever
        // (no code path ever reset `error` back to null).
        setError(null);
      } catch (e) {
        logServiceError("ScheduleItems", "fetch", e);
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load schedule items",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    (async () => {
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
  }, [ds, syncVersion, date]);

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
    [ds, options.date, date],
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

  // ── Create (manual item: routineId stays null — generator is S4-5) ──

  const createScheduleItem = useCallback(
    (
      itemDate: string,
      title: string,
      startTime: string,
      endTime: string,
      opts?: {
        isAllDay?: boolean;
        content?: string;
        noteId?: string;
        memo?: string;
        /**
         * Called once the write has settled: the saved row, or `null` when it
         * failed (#376). The returned id is the OPTIMISTIC one — it names the
         * row that is about to exist, not one that does. A caller writing
         * something with an FK to `items_meta` (an item link) must wait for
         * this, or its insert races ahead of the row it points at.
         */
        onSaved?: (saved: ScheduleItem | null) => void;
      },
    ): string => {
      const id = generateId("schedule");
      const now = new Date().toISOString();
      const optimistic: ScheduleItem = {
        id,
        date: itemDate,
        title,
        startTime,
        endTime,
        completed: false,
        completedAt: null,
        routineId: null,
        templateId: null,
        memo: opts?.memo ?? null,
        noteId: opts?.noteId ?? null,
        content: opts?.content ?? null,
        isDeleted: false,
        deletedAt: null,
        isDismissed: false,
        isAllDay: opts?.isAllDay ?? false,
        reminderEnabled: false,
        reminderOffset: undefined,
        createdAt: now,
        updatedAt: now,
      };
      // Only reflect the optimistic row if it belongs to the anchored
      // date (a create for another day still persists, just off-screen).
      if (isSameDate(optimistic, date)) {
        setItems((prev) => [...prev, optimistic]);
      }
      ds.createScheduleItem(
        id,
        itemDate,
        title,
        startTime,
        endTime,
        undefined,
        undefined,
        opts?.noteId,
        opts?.isAllDay,
        opts?.content,
        opts?.memo,
      )
        .then((saved) => {
          if (isSameDate(saved, date)) {
            setItems((prev) => prev.map((i) => (i.id === id ? saved : i)));
          }
          opts?.onSaved?.(saved);
        })
        .catch((e) => {
          logServiceError("ScheduleItems", "create", e);
          opts?.onSaved?.(null);
        });

      push("scheduleItem", {
        label: "createScheduleItem",
        undo: () => {
          setItems((prev) => prev.filter((i) => i.id !== id));
          // #568: the grid reads the host's range store, so without this the
          // row stayed on the calendar after the undo removed it from the DB.
          viewMirrorRef.current?.remove(id);
          ds.softDeleteScheduleItem(id).catch((e) =>
            logServiceError("ScheduleItems", "undoCreate", e),
          );
        },
        redo: () => {
          setItems((prev) =>
            isSameDate(optimistic, dateRef.current)
              ? [...prev, optimistic]
              : prev,
          );
          viewMirrorRef.current?.upsert(optimistic);
          ds.restoreScheduleItem(id).catch((e) =>
            logServiceError("ScheduleItems", "redoCreate", e),
          );
        },
      });

      return id;
    },
    [ds, push, date],
  );

  // ── Update (Issue 020 single-patch is enforced in DataService) ──────

  const updateScheduleItem = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<
          ScheduleItem,
          | "title"
          | "startTime"
          | "endTime"
          | "completed"
          | "completedAt"
          | "memo"
          | "isAllDay"
          | "content"
          | "date"
        >
      >,
      opts?: { skipUndo?: boolean },
    ) => {
      // #568: reads the host's range store too — an edit on any day other than
      // the anchored one used to find nothing here and push no undo command.
      const prev = findItem(id);
      setItems((p) =>
        p.map((i) =>
          i.id === id
            ? { ...i, ...updates, updatedAt: new Date().toISOString() }
            : i,
        ),
      );
      ds.updateScheduleItem(id, updates).catch((e) =>
        logServiceError("ScheduleItems", "update", e),
      );

      if (prev && !opts?.skipUndo) {
        const prevValues: typeof updates = {};
        for (const key of Object.keys(updates) as Array<keyof typeof updates>) {
          (prevValues as Record<string, unknown>)[key] = prev[key];
        }
        push("scheduleItem", {
          label: "updateScheduleItem",
          undo: () => {
            setItems((p) =>
              p.map((i) =>
                i.id === id
                  ? { ...i, ...prevValues, updatedAt: new Date().toISOString() }
                  : i,
              ),
            );
            // #568: same patch into the grid's own copy, so the move/resize
            // visibly snaps back instead of waiting for a Realtime refetch.
            viewMirrorRef.current?.patch(id, prevValues);
            ds.updateScheduleItem(id, prevValues).catch((e) =>
              logServiceError("ScheduleItems", "undoUpdate", e),
            );
          },
          redo: () => {
            setItems((p) =>
              p.map((i) =>
                i.id === id
                  ? { ...i, ...updates, updatedAt: new Date().toISOString() }
                  : i,
              ),
            );
            viewMirrorRef.current?.patch(id, updates);
            ds.updateScheduleItem(id, updates).catch((e) =>
              logServiceError("ScheduleItems", "redoUpdate", e),
            );
          },
        });
      }
    },
    [ds, push, findItem],
  );

  // ── Complete toggle ─────────────────────────────────────────────────

  const toggleComplete = useCallback(
    (id: string) => {
      // #568: range store included — see updateScheduleItem.
      const prev = findItem(id);
      setItems((p) =>
        p.map((i) =>
          i.id === id
            ? {
                ...i,
                completed: !i.completed,
                completedAt: !i.completed ? new Date().toISOString() : null,
                updatedAt: new Date().toISOString(),
              }
            : i,
        ),
      );
      ds.toggleScheduleItemComplete(id)
        .then((saved) =>
          setItems((p) => p.map((i) => (i.id === id ? saved : i))),
        )
        .catch((e) => logServiceError("ScheduleItems", "toggleComplete", e));

      if (prev) {
        push("scheduleItem", {
          label: "toggleScheduleItemComplete",
          undo: () => {
            setItems((p) => p.map((i) => (i.id === id ? prev : i)));
            // #568: restore the exact pre-toggle pair in the grid's copy —
            // patching only `completed` would leave a checkmark timestamp on a
            // row that is no longer done.
            viewMirrorRef.current?.patch(id, {
              completed: prev.completed,
              completedAt: prev.completedAt,
            });
            ds.toggleScheduleItemComplete(id).catch((e) =>
              logServiceError("ScheduleItems", "undoToggleComplete", e),
            );
          },
          redo: () => {
            viewMirrorRef.current?.patch(id, {
              completed: !prev.completed,
              completedAt: !prev.completed ? new Date().toISOString() : null,
            });
            ds.toggleScheduleItemComplete(id)
              .then((saved) => {
                setItems((p) => p.map((i) => (i.id === id ? saved : i)));
                // The server row is the truth for completedAt; the optimistic
                // patch above only covers the gap until it lands.
                viewMirrorRef.current?.patch(id, {
                  completed: saved.completed,
                  completedAt: saved.completedAt,
                });
              })
              .catch((e) =>
                logServiceError("ScheduleItems", "redoToggleComplete", e),
              );
          },
        });
      }
    },
    [ds, push, findItem],
  );

  // ── Dismiss / undismiss ─────────────────────────────────────────────

  const dismiss = useCallback(
    (id: string) => {
      // #568: the snapshot the undo needs to put the row back on the grid —
      // the host drops dismissed rows from its range store entirely, so a
      // field patch would have nothing to patch.
      const prev = findItem(id);
      setItems((p) =>
        p.map((i) =>
          i.id === id
            ? { ...i, isDismissed: true, updatedAt: new Date().toISOString() }
            : i,
        ),
      );
      ds.dismissScheduleItem(id).catch((e) =>
        logServiceError("ScheduleItems", "dismiss", e),
      );
      push("scheduleItem", {
        label: "dismissScheduleItem",
        undo: () => {
          setItems((p) =>
            p.map((i) =>
              i.id === id
                ? {
                    ...i,
                    isDismissed: false,
                    updatedAt: new Date().toISOString(),
                  }
                : i,
            ),
          );
          mirrorRestore(id, prev, { isDismissed: false });
          ds.undismissScheduleItem(id).catch((e) =>
            logServiceError("ScheduleItems", "undoDismiss", e),
          );
        },
        redo: () => {
          setItems((p) =>
            p.map((i) =>
              i.id === id
                ? {
                    ...i,
                    isDismissed: true,
                    updatedAt: new Date().toISOString(),
                  }
                : i,
            ),
          );
          viewMirrorRef.current?.remove(id);
          ds.dismissScheduleItem(id).catch((e) =>
            logServiceError("ScheduleItems", "redoDismiss", e),
          );
        },
      });
    },
    [ds, push, findItem, mirrorRestore],
  );

  const undismiss = useCallback(
    (id: string) => {
      setItems((p) =>
        p.map((i) =>
          i.id === id
            ? { ...i, isDismissed: false, updatedAt: new Date().toISOString() }
            : i,
        ),
      );
      ds.undismissScheduleItem(id).catch((e) =>
        logServiceError("ScheduleItems", "undismiss", e),
      );
    },
    [ds],
  );

  // ── Soft delete / restore / purge ───────────────────────────────────

  const deleteScheduleItem = useCallback(
    (id: string, opts?: { skipUndo?: boolean }) => {
      // #568: range store included — a delete on any other day used to push
      // nothing at all (and Trash never learned about the row either).
      const target = findItem(id);
      if (target) {
        const deleted: ScheduleItem = {
          ...target,
          isDeleted: true,
          deletedAt: new Date().toISOString(),
        };
        setDeletedItems((d) => [deleted, ...d]);
      }
      setItems((prev) => prev.filter((i) => i.id !== id));
      ds.softDeleteScheduleItem(id).catch((e) =>
        logServiceError("ScheduleItems", "softDelete", e),
      );

      if (target && !opts?.skipUndo) {
        push("scheduleItem", {
          label: "deleteScheduleItem",
          undo: () => {
            setItems((prev) =>
              isSameDate(target, dateRef.current) ? [...prev, target] : prev,
            );
            // #568: back onto the grid as well, with the delete flags cleared
            // (the snapshot was taken before the soft delete, so they are
            // already false — spelled out so a future snapshot source cannot
            // reinstate a row that renders as trashed).
            viewMirrorRef.current?.upsert({
              ...target,
              isDeleted: false,
              deletedAt: null,
            });
            setDeletedItems((prev) => prev.filter((i) => i.id !== id));
            ds.restoreScheduleItem(id).catch((e) =>
              logServiceError("ScheduleItems", "undoDelete", e),
            );
          },
          redo: () => {
            setItems((prev) => prev.filter((i) => i.id !== id));
            viewMirrorRef.current?.remove(id);
            setDeletedItems((prev) => {
              const redoDeleted: ScheduleItem = {
                ...target,
                isDeleted: true,
                deletedAt: new Date().toISOString(),
              };
              return [redoDeleted, ...prev];
            });
            ds.softDeleteScheduleItem(id).catch((e) =>
              logServiceError("ScheduleItems", "redoDelete", e),
            );
          },
        });
      }
    },
    [ds, push, findItem],
  );

  const loadDeletedScheduleItems = useCallback(async () => {
    try {
      const data = await ds.fetchDeletedScheduleItems();
      setDeletedItems(data);
    } catch (e) {
      logServiceError("ScheduleItems", "fetchDeleted", e);
    }
  }, [ds]);

  const restoreScheduleItem = useCallback(
    (id: string) => {
      setDeletedItems((prev) => {
        const target = prev.find((i) => i.id === id);
        if (target) {
          const restored: ScheduleItem = {
            ...target,
            isDeleted: false,
            deletedAt: null,
          };
          if (isSameDate(restored, date)) {
            setItems((i) => [...i, restored]);
          }
        }
        return prev.filter((i) => i.id !== id);
      });
      ds.restoreScheduleItem(id).catch((e) =>
        logServiceError("ScheduleItems", "restore", e),
      );
    },
    [ds, date],
  );

  const permanentDeleteScheduleItem = useCallback(
    (id: string) => {
      setDeletedItems((prev) => prev.filter((i) => i.id !== id));
      ds.permanentDeleteScheduleItem(id).catch((e) =>
        logServiceError("ScheduleItems", "permanentDelete", e),
      );
    },
    [ds],
  );

  const bulkDeleteScheduleItems = useCallback(
    async (ids: string[]): Promise<number> => {
      const idSet = new Set(ids);
      setItems((prev) => prev.filter((i) => !idSet.has(i.id)));
      try {
        return await ds.bulkDeleteScheduleItems(ids);
      } catch (e) {
        logServiceError("ScheduleItems", "bulkDelete", e);
        return 0;
      }
    },
    [ds],
  );

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
