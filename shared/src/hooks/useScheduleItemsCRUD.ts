import {
  useCallback,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { ScheduleItem } from "../types/schedule";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import type { UndoConfirmSpec } from "../utils/undoRedo/UndoRedoManager";
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

/**
 * The question an undo of this write has to pass, or undefined (#1638).
 *
 * A row generated from a routine is one face of a series, so reversing an edit
 * to it is worth spelling out before it happens. The scope is always "this":
 * every write in this module touches ONE occurrence — the series-wide writes
 * live in the repeat layer, which tags its own commands.
 */
function repeatConfirm(
  item: ScheduleItem | undefined,
): UndoConfirmSpec | undefined {
  return item?.routineId ? { kind: "repeat", scope: "this" } : undefined;
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
      /*
       * #1638 W4 (B-02 / B-03): the undo command is pushed HERE, once the row
       * exists, rather than beside the optimistic insert. Two faults came out
       * of the old order: a create that never landed still left an entry on
       * the stack (its "undo" soft-deleted an id the DB never had), and the
       * redo re-inserted the OPTIMISTIC row, dropping whatever the server
       * filled in (the reminder patch, the real timestamps).
       */
      const pushCreated = (saved: ScheduleItem) => {
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
              isSameDate(saved, dateRef.current) ? [...prev, saved] : prev,
            );
            mirror.upsert(saved);
            ds.restoreScheduleItem(id).catch((e) =>
              logServiceError("ScheduleItems", "redoCreate", e),
            );
          },
        });
      };

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
          // The row exists from here on, so the history entry is owed whatever
          // the reminder follow-up below does (#1638 W4).
          pushCreated(saved);
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
          confirm: repeatConfirm(prev),
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
          confirm: repeatConfirm(prev),
          undo: () => {
            setItems((p) => p.map((i) => (i.id === id ? prev : i)));
            // #568: restore the exact pre-toggle pair in the grid's copy —
            // patching only `completed` would leave a checkmark timestamp on a
            // row that is no longer done.
            mirror.patch(id, {
              completed: prev.completed,
              completedAt: prev.completedAt,
            });
            /*
             * #1638 W4 (B-09): SET the recorded value back rather than toggle
             * again. A second toggle assumes the row is still where this
             * command left it — flip it on another device (or through the MCP
             * tool) in between and the undo turns "done" back ON.
             */
            ds.updateScheduleItem(id, {
              completed: prev.completed,
              completedAt: prev.completedAt,
            }).catch((e) =>
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
        confirm: repeatConfirm(prev),
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
      const prev = findItem(id);
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
      /*
       * #1638 (A-02): "bring the skipped day back" is the mirror image of the
       * skip beside it, and the skip has been undoable since #568. Without
       * this, the pair read as one reversible act and one final one.
       *
       * The row is put back on the grid the same way the dismiss undo does it
       * (mirror.restore with the snapshot, because the host drops dismissed
       * rows from its range store entirely).
       */
      push("scheduleItem", {
        label: "undismissScheduleItem",
        confirm: repeatConfirm(prev),
        undo: () => {
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
            logServiceError("ScheduleItems", "undoUndismiss", e),
          );
        },
        redo: () => {
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
            logServiceError("ScheduleItems", "redoUndismiss", e),
          );
        },
      });
    },
    [ds, push, findItem, setItems, mirror],
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
          confirm: repeatConfirm(target),
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
      // Snapshots BEFORE the removal, so the undo can put the rows back on the
      // grid rather than only in the DB (#568's rule, applied to a batch).
      const targets = ids
        .map((id) => findItem(id))
        .filter((i): i is ScheduleItem => i != null);
      setItems((prev) => prev.filter((i) => !idSet.has(i.id)));
      let count: number;
      try {
        count = await ds.bulkDeleteScheduleItems(ids);
      } catch (e) {
        logServiceError("ScheduleItems", "bulkDelete", e);
        return 0;
      }
      /*
       * #1638 (A-10): pushed after the batch lands, and only if it did —
       * the same rule the single delete follows. One command for the whole
       * batch: it was one action, so one Ctrl+Z reverses it.
       */
      if (count > 0) {
        push("scheduleItem", {
          label: "deleteScheduleItem",
          undo: () => {
            setItems((prev) => [
              ...prev,
              ...targets.filter((t) => isSameDate(t, dateRef.current)),
            ]);
            for (const target of targets) {
              mirror.upsert({ ...target, isDeleted: false, deletedAt: null });
              ds.restoreScheduleItem(target.id).catch((e) =>
                logServiceError("ScheduleItems", "undoBulkDelete", e),
              );
            }
          },
          redo: () => {
            setItems((prev) => prev.filter((i) => !idSet.has(i.id)));
            for (const target of targets) mirror.remove(target.id);
            ds.bulkDeleteScheduleItems(ids).catch((e) =>
              logServiceError("ScheduleItems", "redoBulkDelete", e),
            );
          },
        });
      }
      return count;
    },
    [ds, push, findItem, dateRef, setItems, mirror],
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
