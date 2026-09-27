import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { RoutineNode, FrequencyType } from "../types/routine";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import type { UndoConfirmSpec } from "../utils/undoRedo/UndoRedoManager";
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

/**
 * Every write in this module is the SERIES (#1638): a routine holds the rhythm
 * every occurrence is generated from, so reversing one touches every day it
 * fires on. The host asks before running these.
 */
const SERIES_CONFIRM: UndoConfirmSpec = { kind: "repeat", scope: "all" };

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
    snapshotKey: "routines",
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
      /*
       * The pre-patch value of every field this call touches. Read twice: to
       * roll the optimistic patch back when the write does not land (#1769),
       * and as the undo command's payload further down.
       */
      const prevValues: typeof updates = {};
      if (prev) {
        for (const key of Object.keys(updates) as Array<keyof typeof updates>) {
          (prevValues as Record<string, unknown>)[key] = prev[key];
        }
      }
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

      /*
       * #1769: the patch above is optimistic, and a failed write used to leave
       * it standing for ever. The editor went on showing the frequency the DB
       * had refused, and no reload took it off: `reload()` on the Schedule
       * side refetches schedule ITEMS, and routines live in this hook's state.
       * Only the fields this call touched are put back, so a write that landed
       * in between is left alone.
       */
      void landed.then((ok) => {
        if (ok || !prev) return;
        setRoutines((p) =>
          p.map((r) =>
            r.id === id
              ? { ...r, ...prevValues, updatedAt: prev.updatedAt }
              : r,
          ),
        );
      });

      if (prev && !opts?.skipUndo) {
        /*
         * #1638 W4 (B-06): pushed only once the template write LANDED. It used
         * to be pushed beside the optimistic patch, so a failed write still
         * left an "undo the repeat edit" entry for an edit the DB never took —
         * and running it wrote the old values over values that had never
         * changed.
         */
        const paint = (values: typeof updates) =>
          setRoutines((p) =>
            p.map((r) =>
              r.id === id
                ? { ...r, ...values, updatedAt: new Date().toISOString() }
                : r,
            ),
          );
        /*
         * #1642 P4 (B-10): each body paints, awaits its write, and on a lost
         * write paints the other side back and re-throws. The manager reads
         * the throw as "did not happen" and keeps the command where it was
         * (#1668); the host raises the one `undoFailed` toast.
         */
        const run = async (
          to: typeof updates,
          back: typeof updates,
          op: string,
        ) => {
          paint(to);
          try {
            await ds.updateRoutine(id, to);
          } catch (e) {
            logServiceError("Routines", op, e);
            paint(back);
            throw e;
          }
        };
        void landed.then((ok) => {
          if (!ok) return;
          push("routine", {
            label: "updateRoutine",
            confirm: SERIES_CONFIRM,
            undo: () => run(prevValues, updates, "undoUpdate"),
            redo: () => run(updates, prevValues, "redoUpdate"),
          });
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
          confirm: SERIES_CONFIRM,
          // The one place in this hook that writes BEFORE it paints. Putting
          // the routine back in the live list is what wakes the generator, and
          // the generator skips a day only where it can SEE an occurrence —
          // its reads filter is_deleted, so a still-trashed row is invisible
          // and it mints a fresh id for today instead (#708). The user is then
          // left with a repeat that looks restored but whose rows are not the
          // ones they deleted, and with their hand-made seed event still in
          // the trash. So: rows back, then routine, then paint.
          //
          // #1642 P4 (B-10 / N-06): a lost write re-throws, so the manager
          // keeps the command where it was and the host says "couldn't undo"
          // once. The cascade restore alone stays forgiven, as before: the
          // repeat coming back matters more than the rows, which Trash still
          // holds.
          undo: async () => {
            try {
              const { conflictedIds } =
                await ds.bulkRestoreScheduleItems(cascade);
              // Not a failure: the generator already re-made those days
              // while the repeat was in the trash, so the calendar shows
              // an occurrence either way — only the id differs (#932).
              // Everything else, seed event included, is back. Before the
              // partial restore landed, ONE such day failed the whole
              // batch and nothing came back at all.
              if (conflictedIds.length > 0) {
                logServiceError(
                  "Routines",
                  "undoDeleteCascade",
                  new Error(
                    `${conflictedIds.length} occurrence(s) stayed in the trash: a live row already holds their (routine, date) pair`,
                  ),
                );
              }
            } catch (e) {
              logServiceError("Routines", "undoDeleteCascade", e);
            }
            try {
              await ds.restoreRoutine(id);
            } catch (e) {
              logServiceError("Routines", "undoDelete", e);
              // The rows above may be back while the repeat is not; the
              // host's re-read shows the grid what actually landed.
              onCascadeChanged?.();
              throw e;
            }
            setDeletedRoutines((prev) => prev.filter((r) => r.id !== id));
            setRoutines((prev) =>
              prev.some((r) => r.id === id) ? prev : [...prev, target],
            );
            onCascadeChanged?.();
          },
          redo: async () => {
            setRoutines((prev) => prev.filter((r) => r.id !== id));
            setDeletedRoutines((prev) => {
              const redoDeleted: RoutineNode = {
                ...target,
                isDeleted: true,
                deletedAt: new Date().toISOString(),
              };
              return [redoDeleted, ...prev];
            });
            // softDeleteRoutine re-runs the whole cascade, so redo does not
            // replay the id list — it re-reads whatever is live now.
            try {
              await ds.softDeleteRoutine(id);
            } catch (e) {
              logServiceError("Routines", "redoDelete", e);
              setDeletedRoutines((prev) => prev.filter((r) => r.id !== id));
              setRoutines((prev) =>
                prev.some((r) => r.id === id) ? prev : [...prev, target],
              );
              throw e;
            } finally {
              onCascadeChanged?.();
            }
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
  // occurrences + detach the survivors + soft-delete the routine.
  //
  // On failure the optimistic removal is rolled back AND the error is
  // re-thrown (not swallowed) so the caller can distinguish success from
  // failure and reconcile its own view (the Schedule host re-reads the
  // visible range instead of trusting an optimistic delete that never
  // landed server-side).
  //
  // Undo is OPT-IN (#1801 / D-20260919-sched-2 = B), because the two callers
  // want different inverses. The editor's "Repeat = None" pins the open
  // occurrence and pushes its own command — a fresh conversion of that pinned
  // survivor, which is the action the editor itself offers. The scope
  // dialog's "this and following" pins nothing, so the only inverse within
  // reach is the one below: put the trashed occurrences back, then the
  // routine. Defaulting this ON would make the editor path push twice.
  const detachRoutine = useCallback(
    async (
      id: string,
      fromDate?: string,
      opts?: {
        keepItemIds?: string[];
        /**
         * Push the reversal onto the global stack. `onRestored` fires after an
         * undo or redo has moved the occurrences (#708's `onCascadeChanged` by
         * another name): the rows those ids name live in the host's
         * visible-range store, and only the host can put them back on the grid.
         */
        undo?: { onRestored?: () => void };
      },
    ): Promise<{ deletedScheduleItemIds: string[] }> => {
      const target = routinesRef.current.find((r) => r.id === id);
      setRoutines((prev) => prev.filter((r) => r.id !== id));
      let result: { deletedScheduleItemIds: string[] };
      try {
        result = await ds.detachRoutine(id, fromDate, {
          keepItemIds: opts?.keepItemIds,
        });
      } catch (e) {
        logServiceError("Routines", "detach", e);
        if (target) {
          setRoutines((prev) =>
            prev.some((r) => r.id === id) ? prev : [...prev, target],
          );
        }
        throw e;
      }

      if (target && opts?.undo) {
        // The occurrences the detach trashed. The survivors it merely unlinked
        // are NOT here, and the undo below does not re-link them: nothing in
        // the service puts a `routine_item_id` back, and the tags the detach
        // handed them keep their new home (the source rows were soft-deleted
        // by handOverTagAssignments). So an undo restores the repeat WITHOUT
        // its tags — the scope dialog says so before the press (#1801).
        const cascade = result.deletedScheduleItemIds;
        const onRestored = opts.undo.onRestored;
        push("routine", {
          label: "detachRoutine",
          confirm: SERIES_CONFIRM,
          // Rows first, then the routine, then paint — the same order
          // deleteRoutine's undo takes, and for the same reason: putting the
          // routine back is what wakes the generator, and the generator skips
          // a day only where it can SEE a live occurrence. A still-trashed row
          // is invisible to it, so it would mint a fresh id for that day
          // (#708) and the user would get a repeat whose rows are not the ones
          // they split off.
          undo: async () => {
            const { conflictedIds } =
              await ds.bulkRestoreScheduleItems(cascade);
            // Not a failure (#932): the generator already re-made that day
            // while the routine was trashed, so the calendar shows an
            // occurrence either way — only the id differs.
            if (conflictedIds.length > 0) {
              logServiceError(
                "Routines",
                "undoDetachCascade",
                new Error(
                  `${conflictedIds.length} occurrence(s) stayed in the trash: a live row already holds their (routine, date) pair`,
                ),
              );
            }
            await ds.restoreRoutine(id);
            setRoutines((prev) =>
              prev.some((r) => r.id === id) ? prev : [...prev, target],
            );
            onRestored?.();
          },
          redo: async () => {
            setRoutines((prev) => prev.filter((r) => r.id !== id));
            // Re-runs the split against whatever is live now rather than
            // replaying the id list, exactly as redoDelete does.
            await ds.detachRoutine(id, fromDate, {
              keepItemIds: opts.keepItemIds,
            });
            onRestored?.();
          },
        });
      }

      return result;
    },
    [ds, push],
  );

  // Event→Repeats conversion (#296). AWAITED: the
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

  return useMemo(
    () => ({
      routines,
      deletedRoutines,
      isLoading,
      error,
      convertEventToRoutine,
      updateRoutine,
      deleteRoutine,
      detachRoutine,
      updateFutureOccurrences,
      loadDeletedRoutines,
    }),
    [
      routines,
      deletedRoutines,
      isLoading,
      error,
      convertEventToRoutine,
      updateRoutine,
      deleteRoutine,
      detachRoutine,
      updateFutureOccurrences,
      loadDeletedRoutines,
    ],
  );
}
