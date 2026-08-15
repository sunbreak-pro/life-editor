import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { RoutineNode, FrequencyType } from "../types/routine";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";
import { createNoopUndoRedo, type UndoRedoLike } from "./useTodoTreeHistory";
import { useDomainLoad } from "./useDomainLoad";
import { useSyncDomains } from "./useSyncDomains";

/**
 * Port of the Tauri routine hooks consolidated into one shared API hook
 * — same shape as the other shared API hooks. Host dependencies are
 * injected, not imported (CLAUDE.md §6.4):
 * - `getDataService()` singleton → `options.dataService`
 * - host UndoRedo Context        → `options.undoRedo` (no-op default;
 *   real UndoRedo lands in S6, same as todos/daily/notes)
 *
 * Must sit inside a Sync Provider (reads `useSyncContext`) — CLAUDE.md
 * §6.2 places Routine after Sync and as the first of the Schedule trio
 * (… → Routine → ScheduleItems → …).
 *
 * Scope (S4-3): routines CRUD only. The Routine→schedule_items
 * generator lives in `useScheduleItemsRoutineSync` (S4-5) and is NOT
 * wired here. RoutineGroups were removed in #352 (§5 決定3).
 */

export interface UseRoutinesAPIOptions {
  dataService: DataService;
  undoRedo?: UndoRedoLike;
}

export function useRoutinesAPI(options: UseRoutinesAPIOptions) {
  const ds = options.dataService;
  const { push } = options.undoRedo ?? createNoopUndoRedo();
  const syncVersion = useSyncDomains("schedule");

  const [routines, setRoutines] = useState<RoutineNode[]>([]);
  const [deletedRoutines, setDeletedRoutines] = useState<RoutineNode[]>([]);

  const routinesRef = useRef(routines);
  useEffect(() => {
    routinesRef.current = routines;
  }, [routines]);

  // Initial load + every syncVersion bump (mirrors notes/daily), through the
  // shared load effect (#672) — which also brings #296's error un-latch, so a
  // transient failure no longer keeps the error latched for the session.
  const { isLoading, error } = useDomainLoad({
    domain: "Routines",
    dataService: ds,
    version: syncVersion,
    load: (service) => service.fetchAllRoutines(),
    apply: setRoutines,
    fallbackMessage: "Failed to load routines",
  });

  // Trash, read on the same cursor but deliberately on its own: a failure here
  // must not block the active list (nor gate `isLoading` / set `error` — the
  // trash view has its own empty state and the active list is what the screen
  // is waiting for).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const deleted = await ds.fetchDeletedRoutines();
        if (!cancelled) setDeletedRoutines(deleted);
      } catch (e) {
        logServiceError("Routines", "fetchDeleted", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ds, syncVersion]);

  // ── Routines ──────────────────────────────────────────────────────

  const createRoutine = useCallback(
    (
      title: string,
      startTime?: string,
      endTime?: string,
      frequencyType?: FrequencyType,
      frequencyDays?: number[],
      frequencyInterval?: number | null,
      frequencyStartDate?: string | null,
      reminderEnabled?: boolean,
      reminderOffset?: number,
    ) => {
      const id = generateId("routine");
      const now = new Date().toISOString();
      const optimistic: RoutineNode = {
        id,
        title,
        startTime: startTime ?? null,
        endTime: endTime ?? null,
        isArchived: false,
        isVisible: true,
        isDeleted: false,
        deletedAt: null,
        order: routinesRef.current.length,
        frequencyType: frequencyType ?? "daily",
        frequencyDays: frequencyDays ?? [],
        frequencyInterval: frequencyInterval ?? null,
        frequencyStartDate: frequencyStartDate ?? null,
        reminderEnabled,
        reminderOffset,
        createdAt: now,
        updatedAt: now,
      };
      setRoutines((prev) => [...prev, optimistic]);
      ds.createRoutine(
        id,
        title,
        startTime,
        endTime,
        frequencyType,
        frequencyDays,
        frequencyInterval,
        frequencyStartDate,
        reminderEnabled,
        reminderOffset,
      ).catch((e) => logServiceError("Routines", "create", e));

      push("routine", {
        label: "createRoutine",
        undo: () => {
          setRoutines((prev) => prev.filter((r) => r.id !== id));
          ds.softDeleteRoutine(id).catch((e) =>
            logServiceError("Routines", "undoCreate", e),
          );
        },
        redo: () => {
          setRoutines((prev) => [...prev, optimistic]);
          ds.restoreRoutine(id).catch((e) =>
            logServiceError("Routines", "redoCreate", e),
          );
        },
      });

      return id;
    },
    [ds, push],
  );

  const updateRoutine = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<
          RoutineNode,
          | "title"
          | "startTime"
          | "endTime"
          | "isArchived"
          | "isVisible"
          | "order"
          | "frequencyType"
          | "frequencyDays"
          | "frequencyInterval"
          | "frequencyStartDate"
          | "reminderEnabled"
          | "reminderOffset"
        >
      >,
      opts?: { skipUndo?: boolean },
    ): Promise<boolean> => {
      const prev = routinesRef.current.find((r) => r.id === id);
      setRoutines((p) =>
        p.map((r) =>
          r.id === id
            ? { ...r, ...updates, updatedAt: new Date().toISOString() }
            : r,
        ),
      );
      // Resolves false instead of rejecting (the error is still logged), so
      // the fire-and-forget callers stay unchanged while a caller that
      // SEQUENCES work behind the template write — the #352 frequency
      // reconcile — can abort. Rewriting occurrences to a shape the routine
      // itself never took would leave template and series contradicting each
      // other, with the two generators then fighting over every day.
      const landed = ds.updateRoutine(id, updates).then(
        () => true,
        (e) => {
          logServiceError("Routines", "update", e);
          return false;
        },
      );

      if (prev && !opts?.skipUndo) {
        const prevValues: typeof updates = {};
        for (const key of Object.keys(updates) as Array<keyof typeof updates>) {
          (prevValues as Record<string, unknown>)[key] = prev[key];
        }
        push("routine", {
          label: "updateRoutine",
          undo: () => {
            setRoutines((p) =>
              p.map((r) =>
                r.id === id
                  ? { ...r, ...prevValues, updatedAt: new Date().toISOString() }
                  : r,
              ),
            );
            ds.updateRoutine(id, prevValues).catch((e) =>
              logServiceError("Routines", "undoUpdate", e),
            );
          },
          redo: () => {
            setRoutines((p) =>
              p.map((r) =>
                r.id === id
                  ? { ...r, ...updates, updatedAt: new Date().toISOString() }
                  : r,
              ),
            );
            ds.updateRoutine(id, updates).catch((e) =>
              logServiceError("Routines", "redoUpdate", e),
            );
          },
        });
      }

      return landed;
    },
    [ds, push],
  );

  const deleteRoutine = useCallback(
    async (
      id: string,
      opts?: {
        skipUndo?: boolean;
        /**
         * Fired after an undo or redo has finished moving the cascaded
         * occurrences (#708). The routine list lives here, but the rows those
         * ids name live in the host's visible-range store — only the host can
         * put them back on the grid, and it has no other signal that an undo
         * touched them.
         */
        onCascadeChanged?: () => void;
      },
      // `landed` (#408): the optimistic drop below happens either way, so a
      // caller that also shows the routine's occurrences needs to know the
      // write failed — otherwise the list loses the row while the calendar
      // keeps every occurrence, and nothing says why.
    ): Promise<{ deletedScheduleItemIds: string[]; landed: boolean }> => {
      const target = routinesRef.current.find((r) => r.id === id);
      if (target) {
        const deleted: RoutineNode = {
          ...target,
          isDeleted: true,
          deletedAt: new Date().toISOString(),
        };
        setDeletedRoutines((d) => [deleted, ...d]);
      }
      setRoutines((prev) => prev.filter((r) => r.id !== id));

      let result: { deletedScheduleItemIds: string[]; landed: boolean } = {
        deletedScheduleItemIds: [],
        landed: false,
      };
      try {
        result = { ...(await ds.softDeleteRoutine(id)), landed: true };
      } catch (e) {
        logServiceError("Routines", "softDelete", e);
      }

      if (target && !opts?.skipUndo) {
        // The cascade softDeleteRoutine just trashed: every live occurrence
        // plus the hand-made event the repeat was grown from (#296 attaches
        // the seed in place, so it is one of these rows). Undo has to bring
        // these exact ids back — see below.
        const cascade = result.deletedScheduleItemIds;
        const onCascadeChanged = opts?.onCascadeChanged;
        push("routine", {
          label: "deleteRoutine",
          // The one place in this hook that writes BEFORE it paints. Putting
          // the routine back in the live list is what wakes the generator, and
          // the generator skips a day only where it can SEE an occurrence —
          // its reads filter is_deleted, so a still-trashed row is invisible
          // and it mints a fresh id for today instead (#708). The user is then
          // left with a repeat that looks restored but whose rows are not the
          // ones they deleted, and with their hand-made seed event still in
          // the trash. So: rows back, then routine, then paint.
          undo: () => {
            void (async () => {
              try {
                await ds.bulkRestoreScheduleItems(cascade);
              } catch (e) {
                logServiceError("Routines", "undoDeleteCascade", e);
              }
              try {
                await ds.restoreRoutine(id);
              } catch (e) {
                logServiceError("Routines", "undoDelete", e);
              }
              setDeletedRoutines((prev) => prev.filter((r) => r.id !== id));
              setRoutines((prev) =>
                prev.some((r) => r.id === id) ? prev : [...prev, target],
              );
              onCascadeChanged?.();
            })();
          },
          redo: () => {
            setRoutines((prev) => prev.filter((r) => r.id !== id));
            setDeletedRoutines((prev) => {
              const redoDeleted: RoutineNode = {
                ...target,
                isDeleted: true,
                deletedAt: new Date().toISOString(),
              };
              return [redoDeleted, ...prev];
            });
            void (async () => {
              // softDeleteRoutine re-runs the whole cascade, so redo does not
              // replay the id list — it re-reads whatever is live now.
              try {
                await ds.softDeleteRoutine(id);
              } catch (e) {
                logServiceError("Routines", "redoDelete", e);
              }
              onCascadeChanged?.();
            })();
          },
        });
      }

      return result;
    },
    [ds, push],
  );

  // "Turn the repeat off" (#185 Step 3). Optimistically drop the routine
  // from the live list (so the generator stops materialising it and the UI
  // updates at once), then let the service soft-delete future/incomplete
  // occurrences + detach the survivors + soft-delete the routine. No undo
  // entry: detach is a deliberate, calendar-app "delete this and following
  // events" action, and the survivors (past + completed occurrences) are
  // intentionally kept.
  //
  // On failure the optimistic removal is rolled back AND the error is
  // re-thrown (not swallowed) so the caller can distinguish success from
  // failure and reconcile its own view (the Schedule host re-reads the
  // visible range instead of trusting an optimistic delete that never
  // landed server-side).
  const detachRoutine = useCallback(
    async (
      id: string,
      fromDate?: string,
      opts?: { keepItemIds?: string[] },
    ): Promise<{ deletedScheduleItemIds: string[] }> => {
      const target = routinesRef.current.find((r) => r.id === id);
      setRoutines((prev) => prev.filter((r) => r.id !== id));
      try {
        return await ds.detachRoutine(id, fromDate, opts);
      } catch (e) {
        logServiceError("Routines", "detach", e);
        if (target) {
          setRoutines((prev) =>
            prev.some((r) => r.id === id) ? prev : [...prev, target],
          );
        }
        throw e;
      }
    },
    [ds],
  );

  // Event→Repeats conversion (#296). AWAITED, unlike createRoutine: the
  // seed event is attached to the routine inside the same service call, so
  // the caller must know whether the conversion actually landed before it
  // materialises further occurrences.
  //
  // The new routine is added to the live list ONLY after the service
  // resolves — deliberately NOT optimistically. An optimistic pre-await add
  // would enter `routines`, wake RoutineScheduleSync's generator (dep:
  // routines) mid-conversion, and let it INSERT an occurrence for the
  // anchor day while the seed attach is still in flight. If that generated
  // row landed first, the attach would hit the (routine, source_date)
  // partial UNIQUE, roll back — and the rollback's routine hard-delete
  // would then be blocked by the generated row's 0011 composite FK,
  // stranding an orphan routine. Adding post-resolve means the generator
  // only ever runs once the attach has committed (the seed already owns the
  // slot), so it cannot race. The seed itself stays on the calendar
  // throughout (it is a live event the whole time — #296), and the host
  // paints the routine band optimistically via patchRange. No undo entry:
  // the inverse of a conversion is detachRoutine with the seed pinned, and
  // the repeat editor offers exactly that ("なし") as a first-class action.
  const convertEventToRoutine = useCallback(
    async (
      eventId: string,
      init: {
        title: string;
        startTime?: string;
        endTime?: string;
        frequencyType?: FrequencyType;
        frequencyDays?: number[];
        frequencyInterval?: number | null;
        frequencyStartDate?: string | null;
        sourceDate: string;
      },
    ): Promise<string> => {
      const id = generateId("routine");
      try {
        const routine = await ds.convertEventToRoutine(eventId, id, {
          title: init.title,
          startTime: init.startTime,
          endTime: init.endTime,
          frequencyType: init.frequencyType,
          frequencyDays: init.frequencyDays,
          frequencyInterval: init.frequencyInterval,
          frequencyStartDate: init.frequencyStartDate,
          sourceDate: init.sourceDate,
        });
        setRoutines((prev) =>
          prev.some((r) => r.id === id) ? prev : [...prev, routine],
        );
        return id;
      } catch (e) {
        logServiceError("Routines", "convertEventToRoutine", e);
        throw e;
      }
    },
    [ds],
  );

  // Series edit propagation (#279 scope dialog). Thin pass-through — the
  // conflict-rule filtering (skip done / dismissed / manually-edited) lives in
  // the DataService implementation. No undo entry: the bulk patch has no
  // single-row inverse; the caller re-reads the range after it lands.
  const updateFutureOccurrences = useCallback(
    async (
      routineId: string,
      updates: { title?: string; startTime?: string; endTime?: string },
      fromDate: string,
      template?: {
        title: string;
        startTime: string | null;
        endTime: string | null;
      },
    ): Promise<number> => {
      try {
        return await ds.updateFutureScheduleItemsByRoutine(
          routineId,
          updates,
          fromDate,
          template,
        );
      } catch (e) {
        logServiceError("Routines", "updateFutureOccurrences", e);
        throw e;
      }
    },
    [ds],
  );

  const loadDeletedRoutines = useCallback(async () => {
    try {
      const data = await ds.fetchDeletedRoutines();
      setDeletedRoutines(data);
    } catch (e) {
      logServiceError("Routines", "fetchDeleted", e);
    }
  }, [ds]);

  const restoreRoutine = useCallback(
    (id: string) => {
      // DU-C 2026-05-24 hotfix: React 19 StrictMode は dev で setState
      // updater を double-invoke する。元の実装は
      //   setDeletedRoutines((prev) => { ...; setRoutines((r) => [...r, restored]); return filter() })
      // という入れ子 setState で、StrictMode で内側の setRoutines が
      // 2 回発火し routines に同じ id が 2 件入る → ScheduleView の
      // `key={r.id}` で duplicate-key warning + UI 上で routine が
      // 2 つに見える事象を起こす。
      //
      // 修正: setRoutines / setDeletedRoutines を独立 setState に分離
      // し、追加側は `some(id)` ガードで冪等にする。dedup guard は
      // StrictMode double-invoke だけでなく、UI の連打や非同期競合に
      // よる重複追加にも保険として効く。
      setRoutines((r) => {
        if (r.some((x) => x.id === id)) return r;
        const target = deletedRoutines.find((d) => d.id === id);
        if (!target) return r;
        const restored: RoutineNode = {
          ...target,
          isDeleted: false,
          deletedAt: null,
        };
        return [...r, restored];
      });
      setDeletedRoutines((prev) => prev.filter((r) => r.id !== id));
      ds.restoreRoutine(id).catch((e) =>
        logServiceError("Routines", "restore", e),
      );
    },
    [ds, deletedRoutines],
  );

  const permanentDeleteRoutine = useCallback(
    (id: string) => {
      setDeletedRoutines((prev) => prev.filter((r) => r.id !== id));
      ds.permanentDeleteRoutine(id).catch((e) =>
        logServiceError("Routines", "permanentDelete", e),
      );
    },
    [ds],
  );

  return useMemo(
    () => ({
      routines,
      deletedRoutines,
      isLoading,
      error,
      createRoutine,
      convertEventToRoutine,
      updateRoutine,
      deleteRoutine,
      detachRoutine,
      updateFutureOccurrences,
      loadDeletedRoutines,
      restoreRoutine,
      permanentDeleteRoutine,
    }),
    [
      routines,
      deletedRoutines,
      isLoading,
      error,
      createRoutine,
      convertEventToRoutine,
      updateRoutine,
      deleteRoutine,
      detachRoutine,
      updateFutureOccurrences,
      loadDeletedRoutines,
      restoreRoutine,
      permanentDeleteRoutine,
    ],
  );
}
