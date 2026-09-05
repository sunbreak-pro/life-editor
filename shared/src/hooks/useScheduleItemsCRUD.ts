import {
  useCallback,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { ScheduleItem } from "../types/schedule";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";
import type { UndoRedoLike } from "./useTodoTreeHistory";
import { isSameDate } from "./scheduleItemsHelpers";
import { resolveDefaultReminderMinutes } from "./useReminderPrefs";
import type { ScheduleItemsMirrorAccess } from "./useScheduleItemsViewMirror";

/**
 * Write surface of useScheduleItemsAPI (#675 split): create / update / the two
 * status flips / soft delete / bulk delete, each paired with the undo command
 * it pushes.
 *
 * Every write here is optimistic-then-persist, and every undo command writes
 * its rollback into BOTH the anchored day's list and the host's on-screen
 * store (`mirror`) — see useScheduleItemsViewMirror for why the second one
 * exists. Reads and the Trash list live in their own modules; what makes this
 * one a unit is that all of it has to keep those two stores agreeing.
 *
 * Issue 011 ((routine_id, date) live-row idempotency) and Issue 020 (single
 * whitelist patch on update) are enforced in the DataService layer (S4-2,
 * SupabaseScheduleItemsService). This module only calls through — it does NOT
 * re-add a duplicate guard (a second guard here would diverge from the Tauri
 * repository contract).
 */
export interface UseScheduleItemsCRUDParams {
  ds: DataService;
  push: UndoRedoLike["push"];
  /** The day the view is anchored on, at render time. */
  date: string;
  /**
   * The same date, live (#304 child-2): a command pushed on day A may run
   * after the view moved to day B, and comparing against the CAPTURED `date`
   * would splice day-A rows into day-B's list (display-only, but wrong until
   * the next refetch).
   */
  dateRef: RefObject<string>;
  setItems: Dispatch<SetStateAction<ScheduleItem[]>>;
  setDeletedItems: Dispatch<SetStateAction<ScheduleItem[]>>;
  mirror: ScheduleItemsMirrorAccess;
}

export function useScheduleItemsCRUD(params: UseScheduleItemsCRUDParams) {
  const { ds, push, date, dateRef, setItems, setDeletedItems, mirror } = params;
  const { findItem } = mirror;

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
         * Minutes before the start to notify (#1374), or null for none.
         * Defaults to the Settings pref, resolved here rather than by each
         * caller so every create path picks it up. Written ONTO the row —
         * see useReminderPrefs for why the default is not inherited at read
         * time.
         */
        reminderOffset?: number | null;
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
      /*
       * #1374: an all-day row has no clock time to lead, so it never gets a
       * reminder however the pref is set. Otherwise the caller's value wins
       * and the Settings default fills in — resolved once, here, so the
       * optimistic row and the follow-up write cannot disagree.
       */
      const reminderOffset =
        (opts?.isAllDay ?? false)
          ? null
          : opts?.reminderOffset !== undefined
            ? opts.reminderOffset
            : resolveDefaultReminderMinutes();
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
        reminderEnabled: reminderOffset !== null,
        reminderOffset,
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
          /*
           * #1374: a follow-up patch rather than a 12th positional argument
           * on a create signature four call sites and the whole Supabase
           * service share. Skipped when there is no reminder, so the common
           * path is still one write.
           */
          if (reminderOffset === null) {
            if (isSameDate(saved, date)) {
              setItems((prev) => prev.map((i) => (i.id === id ? saved : i)));
            }
            opts?.onSaved?.(saved);
            return;
          }
          return (
            ds
              .updateScheduleItem(saved.id, { reminderOffset })
              /*
               * The row already exists at this point, so a failed reminder
               * patch is "saved without a reminder" and not "create failed".
               * Letting it fall through to the outer catch would hand the
               * caller `onSaved(null)` for an event that is on the calendar —
               * the editor would stay open over a row it just wrote.
               */
              .catch((e) => {
                logServiceError("ScheduleItems", "createReminder", e);
                return saved;
              })
              .then((withReminder) => {
                if (isSameDate(withReminder, date)) {
                  setItems((prev) =>
                    prev.map((i) => (i.id === id ? withReminder : i)),
                  );
                }
                opts?.onSaved?.(withReminder);
              })
          );
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
          mirror.remove(id);
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
          mirror.upsert(optimistic);
          ds.restoreScheduleItem(id).catch((e) =>
            logServiceError("ScheduleItems", "redoCreate", e),
          );
        },
      });

      return id;
    },
    [ds, push, date, dateRef, setItems, mirror],
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
          | "reminderOffset"
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
            mirror.patch(id, prevValues);
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
            mirror.patch(id, updates);
            ds.updateScheduleItem(id, updates).catch((e) =>
              logServiceError("ScheduleItems", "redoUpdate", e),
            );
          },
        });
      }
    },
    [ds, push, findItem, setItems, mirror],
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
            mirror.patch(id, {
              completed: prev.completed,
              completedAt: prev.completedAt,
            });
            ds.toggleScheduleItemComplete(id).catch((e) =>
              logServiceError("ScheduleItems", "undoToggleComplete", e),
            );
          },
          redo: () => {
            mirror.patch(id, {
              completed: !prev.completed,
              completedAt: !prev.completed ? new Date().toISOString() : null,
            });
            ds.toggleScheduleItemComplete(id)
              .then((saved) => {
                setItems((p) => p.map((i) => (i.id === id ? saved : i)));
                // The server row is the truth for completedAt; the optimistic
                // patch above only covers the gap until it lands.
                mirror.patch(id, {
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
    [ds, push, findItem, setItems, mirror],
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
          mirror.restore(id, prev, { isDismissed: false });
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
          mirror.remove(id);
          ds.dismissScheduleItem(id).catch((e) =>
            logServiceError("ScheduleItems", "redoDismiss", e),
          );
        },
      });
    },
    [ds, push, findItem, setItems, mirror],
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
    [ds, setItems],
  );

  // ── Soft delete ─────────────────────────────────────────────────────

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
            mirror.upsert({
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
            mirror.remove(id);
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
    [ds, push, findItem, dateRef, setItems, setDeletedItems, mirror],
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
    [ds, setItems],
  );

  return {
    createScheduleItem,
    updateScheduleItem,
    toggleComplete,
    dismiss,
    undismiss,
    deleteScheduleItem,
    bulkDeleteScheduleItems,
  };
}
