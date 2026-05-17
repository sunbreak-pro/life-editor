import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { ScheduleItem } from "../types/schedule";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";
import { createNoopUndoRedo, type UndoRedoLike } from "./useTaskTreeHistory";
import { useSyncContext } from "./useSyncContext";

/**
 * Behaviour-preserving port of the Tauri schedule_items hooks
 * (frontend/src/hooks/useScheduleItems.ts) into one shared API hook —
 * same shape as useRoutinesAPI / useNotesAPI / useDailyAPI. Host
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

export interface UseScheduleItemsAPIOptions {
  dataService: DataService;
  undoRedo?: UndoRedoLike;
  /**
   * The date the view is anchored on (`YYYY-MM-DD`). The initial load +
   * every `syncVersion` bump refetches the live items for this date.
   * Defaults to today (local — `new Date()` then slice, matching the
   * frontend's local-date convention; S4-0: no UTC conversion).
   */
  date?: string;
}

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function useScheduleItemsAPI(options: UseScheduleItemsAPIOptions) {
  const ds = options.dataService;
  const { push } = options.undoRedo ?? createNoopUndoRedo();
  const { syncVersion } = useSyncContext();

  const date = options.date ?? todayLocal();

  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [deletedItems, setDeletedItems] = useState<ScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

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
        if (target === (options.date ?? date)) setItems(list);
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

  const loadDateRange = useCallback(
    async (startDate: string, endDate: string) => {
      try {
        return await ds.fetchScheduleItemsByDateRange(startDate, endDate);
      } catch (e) {
        logServiceError("ScheduleItems", "fetchRange", e);
        return [];
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
      opts?: { isAllDay?: boolean; content?: string; noteId?: string },
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
        memo: null,
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
      )
        .then((saved) => {
          if (isSameDate(saved, date)) {
            setItems((prev) => prev.map((i) => (i.id === id ? saved : i)));
          }
        })
        .catch((e) => logServiceError("ScheduleItems", "create", e));

      push("scheduleItem", {
        label: "createScheduleItem",
        undo: () => {
          setItems((prev) => prev.filter((i) => i.id !== id));
          ds.softDeleteScheduleItem(id).catch((e) =>
            logServiceError("ScheduleItems", "undoCreate", e),
          );
        },
        redo: () => {
          setItems((prev) =>
            isSameDate(optimistic, date) ? [...prev, optimistic] : prev,
          );
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
      const prev = itemsRef.current.find((i) => i.id === id);
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
            ds.updateScheduleItem(id, updates).catch((e) =>
              logServiceError("ScheduleItems", "redoUpdate", e),
            );
          },
        });
      }
    },
    [ds, push],
  );

  // ── Complete toggle ─────────────────────────────────────────────────

  const toggleComplete = useCallback(
    (id: string) => {
      const prev = itemsRef.current.find((i) => i.id === id);
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
            ds.toggleScheduleItemComplete(id).catch((e) =>
              logServiceError("ScheduleItems", "undoToggleComplete", e),
            );
          },
          redo: () => {
            ds.toggleScheduleItemComplete(id)
              .then((saved) =>
                setItems((p) => p.map((i) => (i.id === id ? saved : i))),
              )
              .catch((e) =>
                logServiceError("ScheduleItems", "redoToggleComplete", e),
              );
          },
        });
      }
    },
    [ds, push],
  );

  // ── Dismiss / undismiss ─────────────────────────────────────────────

  const dismiss = useCallback(
    (id: string) => {
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
          ds.dismissScheduleItem(id).catch((e) =>
            logServiceError("ScheduleItems", "redoDismiss", e),
          );
        },
      });
    },
    [ds, push],
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
      const target = itemsRef.current.find((i) => i.id === id);
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
              isSameDate(target, date) ? [...prev, target] : prev,
            );
            setDeletedItems((prev) => prev.filter((i) => i.id !== id));
            ds.restoreScheduleItem(id).catch((e) =>
              logServiceError("ScheduleItems", "undoDelete", e),
            );
          },
          redo: () => {
            setItems((prev) => prev.filter((i) => i.id !== id));
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
    [ds, push, date],
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
