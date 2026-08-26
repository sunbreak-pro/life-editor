import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  generateId,
  generateTodoId,
  localDateTimeToISO,
  useUndoRedoOptional,
  type DataService,
  type ItemCreateNoteDraft,
  type ItemCreateSlot,
  type RepeatScope,
  type ScheduleItem,
  type TodoNode,
  type TodoStatus,
  type WikiTagConnectionUnified,
} from "@life-editor/shared";

/*
 * Briefing's WRITE half (#892 — split out of useBriefingData, zero behavior
 * change): every mutation the paper can make, plus the optimistic list update
 * that keeps the screen honest while it is in flight.
 *
 * The writes go through `ds` because Briefing mounts none of the Schedule /
 * TodoTree providers (§3.1 — the boundary, not the providers, is what the rule
 * is about), so the optimistic update and the undo command are spelled out
 * here instead of coming free from useScheduleItemsAPI / useTodoTreeHistory.
 * The DataService calls themselves are the EXISTING paths — same soft delete,
 * same Trash, same restore — so a row deleted from the paper behaves like one
 * deleted from its own section.
 *
 * Results are folded straight into the fetched state (the setters this hook is
 * handed) so the paper updates without waiting for the Realtime bump;
 * `useSyncDomains` in the fetch half is what makes the OTHER direction work.
 */

export interface BriefingWritesInput {
  ds: DataService;
  todayKey: string;
  scheduleItems: ScheduleItem[];
  setScheduleItems: Dispatch<SetStateAction<ScheduleItem[]>>;
  todoNodes: TodoNode[];
  setTodoNodes: Dispatch<SetStateAction<TodoNode[]>>;
  setConnections: Dispatch<SetStateAction<WikiTagConnectionUnified[]>>;
}

export function useBriefingWrites({
  ds,
  todayKey,
  scheduleItems,
  setScheduleItems,
  todoNodes,
  setTodoNodes,
  setConnections,
}: BriefingWritesInput) {
  // #585: the routine-derived row waiting on a this/future/all answer. Holds
  // the whole ScheduleItem (not just the id) because the answer is applied
  // after the row has already left `scheduleItems`.
  const [deleteScopeItem, setDeleteScopeItem] = useState<ScheduleItem | null>(
    null,
  );

  // Global undo stack (#304). Optional so the hook still runs in tests and
  // outside UndoRedoProvider; when it IS there, a delete from the paper is
  // reversible exactly like the same delete made in Schedule or Todos.
  const undoRedo = useUndoRedoOptional();
  const push = undoRedo?.push;

  const handleToggleScheduleItem = useCallback(
    (id: string) => {
      void ds.toggleScheduleItemComplete(id).then((updated) => {
        setScheduleItems((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s)),
        );
      });
    },
    [ds, setScheduleItems],
  );

  /**
   * Write a Todo's status (#796). `completedAt` follows it — DONE stamps the
   * moment, anything else clears it — because that stamp is what decides
   * whether a closed todo still belongs on today's paper.
   *
   * The new status is painted BEFORE the write resolves and rolled back if it
   * fails. `updateTodo` is several sequential requests, and a status control
   * that does not move until they all return reads as broken.
   */
  const handleSetTodoStatus = useCallback(
    (id: string, status: TodoStatus) => {
      const target = todoNodes.find((n) => n.id === id);
      if (target === undefined || target.status === status) return;
      const patch = {
        status,
        completedAt: status === "DONE" ? new Date().toISOString() : undefined,
      };

      setTodoNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      );
      void ds
        .updateTodo(id, patch)
        .then((updated) => {
          setTodoNodes((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n)),
          );
        })
        // The row renders on the paper and in the rightSidebar tray (#413), so
        // a failed write puts the ORIGINAL node back — an optimistic status
        // that survives its own failure is a lie about what is stored.
        .catch((err) => {
          console.error("[BriefingScreen] todo status write failed", err);
          setTodoNodes((prev) => prev.map((n) => (n.id === id ? target : n)));
        });
    },
    [ds, todoNodes, setTodoNodes],
  );

  /** Binary completion, still what the morning paper's rows speak (#796 gave
   *  the three statuses to the evening rows and the tray only). */
  const handleToggleTodo = useCallback(
    (id: string) => {
      const target = todoNodes.find((n) => n.id === id);
      if (target === undefined) return;
      handleSetTodoStatus(
        id,
        target.status === "DONE" ? "NOT_STARTED" : "DONE",
      );
    },
    [todoNodes, handleSetTodoStatus],
  );

  // ── Creating into today (#623) ───────────────────────────────────────
  /*
   * The paper's「+」opens Schedule's shared <ItemCreatePanel>, so the same
   * three creates it offers there have to work here: a new event, a new todo,
   * and placing an existing todo — each landing on the day the paper is
   * showing.
   */

  /*
   * Attach the note the panel staged to the item just created.
   *
   * CALL ONLY ONCE THE ITEM'S ROW EXISTS — `wiki_tag_connections.from_item_id`
   * is an FK to `items_meta` and the RLS insert policy re-checks it, so the
   * link has to follow the awaited create rather than race it (#371, and the
   * ORDERING note in Schedule's useCreatePanelNotes). Fire and forget: a lost
   * attachment must not roll the event back.
   */
  const attachNote = useCallback(
    (itemId: string, draft: ItemCreateNoteDraft | null) => {
      if (draft === null) return;
      void (async () => {
        try {
          let noteId = draft.kind === "existing" ? draft.id : null;
          if (draft.kind === "new") {
            const now = new Date().toISOString();
            const id = generateId("note");
            await ds.createNoteUnified({
              id,
              type: "note",
              title: draft.title,
              content: "",
              parentId: null,
              order: 0,
              isPinned: false,
              isDeleted: false,
              createdAt: now,
              updatedAt: now,
            });
            noteId = id;
          }
          // Direction is item → note, matching DailyView and Schedule's own
          // attachment: the thing with the date owns the link, and the note
          // sees it as a backlink. The created row is folded into the link
          // state so a todo's「その目的」chip appears with it.
          if (noteId !== null) {
            const link = await ds.createItemLink(
              generateId("link"),
              itemId,
              noteId,
            );
            setConnections((prev) => [...prev, link]);
          }
        } catch (err) {
          console.error("[BriefingScreen] attaching the note failed", err);
        }
      })();
    },
    [ds, setConnections],
  );

  // The day and the all-day flag come off the slot the panel submitted (#940),
  // not off `todayKey`. The paper is always about today, but the panel it
  // opens is the Schedule one, and it can now book any day — so the write has
  // to follow what the user picked, and the paper only shows back the rows
  // that really do belong to today.
  const handleCreateEvent = useCallback(
    (title: string, slot: ItemCreateSlot, note: ItemCreateNoteDraft | null) => {
      void ds
        .createScheduleItem(
          generateId("event"),
          slot.date,
          title,
          slot.start,
          slot.end,
          undefined,
          undefined,
          undefined,
          slot.isAllDay,
        )
        .then((saved) => {
          if (saved.date === todayKey) {
            setScheduleItems((prev) => [...prev, saved]);
          }
          attachNote(saved.id, note);
        })
        .catch((err) => {
          console.error("[BriefingScreen] event create failed", err);
        });
    },
    [ds, todayKey, attachNote, setScheduleItems],
  );

  const handleCreateTodo = useCallback(
    (title: string, slot: ItemCreateSlot, note: ItemCreateNoteDraft | null) => {
      const now = new Date().toISOString();
      // Root-level (parentId null), like every other quick-create entry: the
      // panel carries no place-in-the-tree control and re-parenting belongs to
      // the Todos section.
      void ds
        .createTodo({
          // `generateId("task")` would mint `task-<uuid>` and break the
          // CLAUDE.md §4 id invariant — every other Todo is `task-<ts+counter>`
          // (#1116).
          id: generateTodoId("task"),
          type: "task",
          title,
          status: "NOT_STARTED",
          parentId: null,
          order: 0,
          scheduledAt: localDateTimeToISO(slot.date, slot.start),
          scheduledEndAt: localDateTimeToISO(slot.date, slot.end),
          isAllDay: false,
          createdAt: now,
          updatedAt: now,
        })
        .then((saved) => {
          if (slot.date === todayKey) {
            setTodoNodes((prev) => [...prev, saved]);
          }
          attachNote(saved.id, note);
        })
        .catch((err) => {
          console.error("[BriefingScreen] todo create failed", err);
        });
    },
    [ds, todayKey, attachNote, setTodoNodes],
  );

  const handlePlaceTodo = useCallback(
    (
      todoId: string,
      slot: ItemCreateSlot,
      note: ItemCreateNoteDraft | null,
    ) => {
      // `isAllDay: false` rides along because a todo given a concrete window
      // is by definition not an all-day candidate — leaving the flag alone is
      // what kept placed chips rendering in the all-day lane (timedPlacement).
      void ds
        .updateTodo(todoId, {
          scheduledAt: localDateTimeToISO(slot.date, slot.start),
          scheduledEndAt: localDateTimeToISO(slot.date, slot.end),
          isAllDay: false,
        })
        .then((updated) => {
          // Placed onto another day, so it leaves today's paper rather than
          // sitting there with a time that belongs elsewhere.
          setTodoNodes((prev) =>
            slot.date === todayKey
              ? prev.map((n) => (n.id === updated.id ? updated : n))
              : prev.filter((n) => n.id !== updated.id),
          );
          attachNote(updated.id, note);
        })
        .catch((err) => {
          console.error("[BriefingScreen] todo placement failed", err);
        });
    },
    [ds, todayKey, attachNote, setTodoNodes],
  );

  // ── Row deletes (#585) ───────────────────────────────────────────────
  const handleDeleteScheduleItem = useCallback(
    (id: string) => {
      const target = scheduleItems.find((s) => s.id === id);
      if (target === undefined) return;
      // A routine occurrence must not be plain-deleted: the generator would
      // simply put it back (known-issue 017). Ask which occurrences first —
      // Schedule's own dialog, mounted by BriefingScreen.
      if (target.routineId !== null) {
        setDeleteScopeItem(target);
        return;
      }
      setScheduleItems((prev) => prev.filter((s) => s.id !== id));
      ds.softDeleteScheduleItem(id).catch((err) => {
        console.error("[BriefingScreen] schedule delete failed", err);
      });
      push?.("scheduleItem", {
        label: "deleteScheduleItem",
        undo: () => {
          setScheduleItems((prev) =>
            prev.some((s) => s.id === id) ? prev : [...prev, target],
          );
          void ds.restoreScheduleItem(id).catch((err) => {
            console.error("[BriefingScreen] schedule delete undo failed", err);
          });
        },
        redo: () => {
          setScheduleItems((prev) => prev.filter((s) => s.id !== id));
          void ds.softDeleteScheduleItem(id).catch((err) => {
            console.error("[BriefingScreen] schedule delete redo failed", err);
          });
        },
      });
    },
    [ds, scheduleItems, push, setScheduleItems],
  );

  /*
   * Apply the this/future/all answer. Semantics are Schedule's contract
   * (useScheduleMutations #279), reproduced against the DataService:
   *   this   — Dismiss the single day (a delete would be regenerated)
   *   future — detach the series from this occurrence's date
   *   all    — soft-delete the routine with its cascade (Trash-restorable)
   *
   * Schedule additionally materialises the days between today and a FUTURE
   * anchor before detaching. The paper has no such case: its anchor is always
   * the day it is showing, so that fill is a no-op by construction.
   *
   * No undo command: the routine paths are exactly the ones Schedule leaves
   * off the stack too (a cascade is not reversible by re-inserting one row) —
   * Trash is the recovery path for「すべて」.
   */
  const handleDeleteScopeChoose = useCallback(
    (scope: RepeatScope) => {
      const target = deleteScopeItem;
      setDeleteScopeItem(null);
      const routineId = target?.routineId;
      if (target === null || routineId === undefined || routineId === null) {
        return;
      }
      if (scope === "this") {
        setScheduleItems((prev) => prev.filter((s) => s.id !== target.id));
        void ds.dismissScheduleItem(target.id).catch((err) => {
          console.error("[BriefingScreen] routine dismiss failed", err);
        });
        return;
      }
      const applyRemoval = (deletedIds: string[]) => {
        const removed = new Set(deletedIds);
        setScheduleItems((prev) => prev.filter((s) => !removed.has(s.id)));
      };
      if (scope === "future") {
        void ds
          .detachRoutine(routineId, target.date)
          .then(({ deletedScheduleItemIds }) => {
            applyRemoval(deletedScheduleItemIds);
            // Survivors keep their row but lose the routine origin, mirroring
            // the server NULLing routine_item_id (so the badge goes away).
            setScheduleItems((prev) =>
              prev.map((s) =>
                s.routineId === routineId
                  ? { ...s, routineId: null, sourceDate: null }
                  : s,
              ),
            );
          })
          .catch((err) => {
            console.error("[BriefingScreen] routine detach failed", err);
          });
        return;
      }
      void ds
        .softDeleteRoutine(routineId)
        .then(({ deletedScheduleItemIds }) => {
          applyRemoval(deletedScheduleItemIds);
        })
        .catch((err) => {
          console.error("[BriefingScreen] routine delete failed", err);
        });
    },
    [ds, deleteScopeItem, setScheduleItems],
  );

  const closeDeleteScope = useCallback(() => setDeleteScopeItem(null), []);

  const handleDeleteTodo = useCallback(
    (id: string) => {
      const target = todoNodes.find((n) => n.id === id);
      if (target === undefined) return;
      const markDeleted = (deleted: boolean) => {
        setTodoNodes((prev) =>
          prev.map((n) =>
            n.id === id
              ? {
                  ...n,
                  isDeleted: deleted,
                  deletedAt: deleted ? new Date().toISOString() : undefined,
                }
              : n,
          ),
        );
      };
      markDeleted(true);
      ds.softDeleteTodo(id).catch((err) => {
        console.error("[BriefingScreen] todo delete failed", err);
      });
      push?.("todoTree", {
        label: "deleteTodo",
        undo: () => {
          markDeleted(false);
          void ds.restoreTodo(id).catch((err) => {
            console.error("[BriefingScreen] todo delete undo failed", err);
          });
        },
        redo: () => {
          markDeleted(true);
          void ds.softDeleteTodo(id).catch((err) => {
            console.error("[BriefingScreen] todo delete redo failed", err);
          });
        },
      });
    },
    [ds, todoNodes, push, setTodoNodes],
  );

  // "Add to today" (案 c staging — the same write Schedule's tray makes):
  // scheduledAt = today's local midnight + all-day, so the todo lands in the
  // unplaced group; giving it a time (a Schedule drag) promotes it to placed.
  const handleAddTodoCandidate = useCallback(
    (todoId: string) => {
      void ds
        .updateTodo(todoId, {
          scheduledAt: localDateTimeToISO(todayKey, "00:00"),
          isAllDay: true,
        })
        .then((updated) => {
          setTodoNodes((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n)),
          );
        })
        .catch((err) => {
          console.error("[BriefingScreen] add-to-today failed", err);
        });
    },
    [ds, todayKey, setTodoNodes],
  );

  return {
    handleToggleScheduleItem,
    handleToggleTodo,
    handleSetTodoStatus,
    handleDeleteScheduleItem,
    handleDeleteTodo,
    deleteScopeItem,
    handleDeleteScopeChoose,
    closeDeleteScope,
    handleCreateEvent,
    handleCreateTodo,
    handlePlaceTodo,
    handleAddTodoCandidate,
  };
}
