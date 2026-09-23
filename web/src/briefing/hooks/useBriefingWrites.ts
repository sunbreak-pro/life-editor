import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  afterSettled,
  applyCreateReminder,
  fillRangeUpToAnchor,
  generateId,
  generateTodoId,
  localDateTimeToISO,
  planRepeatScopeChoice,
  resolveCreateReminderOffset,
  useScheduleItemsRoutineSync,
  useToastOptional,
  useTranslation,
  useUndoRedoOptional,
  type DataService,
  type ItemCreateNoteDraft,
  type ItemCreateSlot,
  type RepeatScope,
  type RepeatScopePlan,
  type RoutineNode,
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
 * What must NOT be spelled out here is a DECISION the Schedule side already
 * makes. #1768 was exactly that: a private copy of the this/future/all
 * branching, which had quietly lost the pre-anchor fill, next to creates that
 * filed no undo command at all. The branching now comes from
 * `planRepeatScopeChoice` — the same function Schedule's scope dialog reads —
 * and every schedule write the paper makes files the command its Schedule
 * twin files.
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

  /*
   * A deleted row says it is gone, and says how to bring it back (#1825).
   *
   * The delete itself was already reversible — both handlers below file an
   * undo command — but nothing on screen said so: the row vanished with no
   * dialog and no toast, while the same data deleted from Materials asks
   * first. The paper keeps its one-press delete (it is a row on a page, not a
   * record in a form) and pays for it with a receipt that names the item and
   * the way back.
   *
   * Optional Toast, like the undo stack above, so the hook still runs in tests
   * and outside ToastProvider. Copy is resolved here and passed already
   * translated (§6.4).
   */
  const { t } = useTranslation();
  const toast = useToastOptional();
  const showToast = toast?.showToast;
  const reportDeleted = useCallback(
    (title: string) => {
      showToast?.("info", t("briefing.rowDeleted", { title }));
    },
    [showToast, t],
  );

  // The Routine→occurrence generator (#1768). Only one of its three members
  // is used here — the pre-anchor fill a "this and future" delete has to run
  // before it detaches — and it takes nothing but the DataService, so the
  // paper can mount it without any of Schedule's range state.
  const { ensureRoutineItemsForDateRange } = useScheduleItemsRoutineSync({
    dataService: ds,
  });

  /*
   * #1373 removed `handleToggleScheduleItem`. The paper's schedule rows used
   * to carry a completion mark, and an event has no completion any more. The
   * DataService method it called (`toggleScheduleItemComplete`) stays — the
   * `completed` column and the MCP tool that writes it both remain.
   */

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
      // #1950: the Settings default, resolved by the same rule Schedule's own
      // create uses. Calling the DataService directly used to skip it, so an
      // event booked from the paper was the one event that never reminded.
      const reminderOffset = resolveCreateReminderOffset(slot.isAllDay);
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
        // The row exists once the create resolves; the reminder patch never
        // rejects, so a failed patch still leaves an event (without a
        // reminder) on the paper and on the undo stack.
        .then((created) => applyCreateReminder(ds, created, reminderOffset))
        .then((saved) => {
          if (saved.date === todayKey) {
            setScheduleItems((prev) => [...prev, saved]);
          }
          attachNote(saved.id, note);
          /*
           * #1768: the history entry is owed only once the row EXISTS, and it
           * names the saved row rather than the optimistic one — the same two
           * faults Schedule's create had to fix (#1638 W4). Filed beside the
           * write instead, a create that never landed still left an entry
           * whose undo soft-deleted an id the database never had.
           *
           * Both closures are awaited so a refused reversal reaches the
           * manager rather than becoming a false「元に戻しました」(#1682). No
           * `afterSettled` guard is needed: the write this reverses has
           * already settled by the time the command is on the stack.
           */
          push?.("scheduleItem", {
            label: "createScheduleItem",
            undo: async () => {
              setScheduleItems((prev) => prev.filter((s) => s.id !== saved.id));
              await ds.softDeleteScheduleItem(saved.id);
            },
            redo: async () => {
              if (saved.date === todayKey) {
                setScheduleItems((prev) =>
                  prev.some((s) => s.id === saved.id) ? prev : [...prev, saved],
                );
              }
              await ds.restoreScheduleItem(saved.id);
            },
          });
        })
        .catch((err) => {
          console.error("[BriefingScreen] event create failed", err);
        });
    },
    [ds, todayKey, attachNote, push, setScheduleItems],
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
      const landed = ds.softDeleteScheduleItem(id);
      void landed.catch((err) => {
        console.error("[BriefingScreen] schedule delete failed", err);
      });
      reportDeleted(target.title);
      push?.("scheduleItem", {
        label: "deleteScheduleItem",
        // #1682: wait for the delete this reverses, then report our own
        // write. A restore that lands before the delete is undone by it.
        undo: async () => {
          setScheduleItems((prev) =>
            prev.some((s) => s.id === id) ? prev : [...prev, target],
          );
          await afterSettled(landed);
          await ds.restoreScheduleItem(id);
        },
        redo: () => {
          setScheduleItems((prev) => prev.filter((s) => s.id !== id));
          return ds.softDeleteScheduleItem(id).then(() => {});
        },
      });
    },
    [ds, scheduleItems, push, setScheduleItems, reportDeleted],
  );

  /*
   * Apply the this/future/all answer.
   *
   * The DECISION is `planRepeatScopeChoice` (#1642 W7) — the same pure
   * planner Schedule's scope dialog reads — so the paper cannot drift from
   * Schedule's contract:
   *   this   — Dismiss the single day (a plain delete would be regenerated)
   *   future — materialise the days between today and the anchor, THEN detach
   *   all    — soft-delete the routine with its cascade (Trash-restorable)
   *
   * #1768 replaced a private copy of that branching. The copy had no fill at
   * all, on the reasoning that the paper's anchor is always the day it shows.
   * That was true of the screen, not of this hook: nothing in the write path
   * said so, and a future-dated anchor reaching it would have let the detach
   * erase days the user never selected (#296).
   *
   * Undo: "this" is a Dismiss and reverses exactly, so it files the command
   * Schedule's own dismiss files. The two series-wide scopes file nothing —
   * a cascade is not undone by re-inserting one row, and Trash is the
   * recovery path for「すべて」. Schedule leaves them off the stack too.
   */

  /**
   * The routine behind an occurrence, or undefined when it cannot be read.
   *
   * Read here rather than held on the paper: the briefing loads no routines,
   * and the only thing that needs one is the fill, which has to GENERATE the
   * missing days from the template.
   */
  const loadRoutine = useCallback(
    async (routineId: string): Promise<RoutineNode | undefined> => {
      try {
        return (await ds.fetchAllRoutines()).find((r) => r.id === routineId);
      } catch (err) {
        console.error("[BriefingScreen] reading the routine failed", err);
        return undefined;
      }
    },
    [ds],
  );

  const dismissOccurrence = useCallback(
    (target: ScheduleItem) => {
      const id = target.id;
      setScheduleItems((prev) => prev.filter((s) => s.id !== id));
      const landed = ds.dismissScheduleItem(id);
      void landed.catch((err) => {
        console.error("[BriefingScreen] routine dismiss failed", err);
      });
      push?.("scheduleItem", {
        label: "dismissScheduleItem",
        // #1682: wait for the dismiss this reverses, then report our own
        // write — an undismiss that lands first is re-dismissed by it.
        undo: async () => {
          setScheduleItems((prev) =>
            prev.some((s) => s.id === id) ? prev : [...prev, target],
          );
          await afterSettled(landed);
          await ds.undismissScheduleItem(id);
        },
        redo: () => {
          setScheduleItems((prev) => prev.filter((s) => s.id !== id));
          return ds.dismissScheduleItem(id).then(() => {});
        },
      });
    },
    [ds, push, setScheduleItems],
  );

  const runSeriesDetach = useCallback(
    async (
      plan: Extract<RepeatScopePlan, { kind: "detach-series" }>,
      routine: RoutineNode | undefined,
    ) => {
      try {
        if (plan.fill && routine) {
          const filled = await ensureRoutineItemsForDateRange(
            plan.fill.startDate,
            plan.fill.endDate,
            [routine],
          );
          // #296: a fill that did not fully land must not be followed by the
          // detach — the days it failed to write are exactly the ones the
          // detach would then erase for good.
          if (!filled) return;
        }
        const { deletedScheduleItemIds } = await ds.detachRoutine(
          plan.routineId,
          plan.anchor,
        );
        const split = (ids: string[]) => {
          const removed = new Set(ids);
          setScheduleItems((prev) =>
            prev
              .filter((s) => !removed.has(s.id))
              // Survivors keep their row but lose the routine origin,
              // mirroring the server NULLing routine_item_id (so the badge
              // goes away).
              .map((s) =>
                s.routineId === plan.routineId
                  ? { ...s, routineId: null, sourceDate: null }
                  : s,
              ),
          );
        };
        split(deletedScheduleItemIds);

        /*
         * #1974 (D-20260919-sched-2 = B): the split is undoable from the paper
         * too. Schedule's own dialog put it on the stack in #1801, and the
         * paper called the service directly — so the same press was
         * reversible from one screen and silently not from the other.
         *
         * The inverse is the one useRoutinesAPI.detachRoutine files, in the
         * same order: the trashed rows first, then the routine. Putting the
         * routine back wakes the generator, which skips a day only where it
         * can SEE a live occurrence — a still-trashed row is invisible to it,
         * so it would mint a fresh id for that day (#708).
         *
         * What does NOT come back is the tags. The split handed them to the
         * survivors it unlinked and soft-deleted the series' own rows, and no
         * write here puts those back. The scope dialog says so before the
         * press (BriefingScreen passes the same note Schedule does).
         *
         * The paper has no range reload to lean on, so the undo paints the
         * rows it knows it took — today's share of the cascade — itself.
         */
        const cascade = deletedScheduleItemIds;
        const taken = scheduleItems.filter((s) => cascade.includes(s.id));
        push?.("routine", {
          label: "detachRoutine",
          // The same question Schedule asks before undoing it: it reaches the
          // whole series, not one row.
          confirm: { kind: "repeat", scope: "all" },
          // Failures are thrown, not swallowed (#1668): the manager then keeps
          // the command and says nothing was undone.
          undo: async () => {
            const { conflictedIds } =
              await ds.bulkRestoreScheduleItems(cascade);
            await ds.restoreRoutine(plan.routineId);
            // A conflicted row stayed in the trash: the generator already
            // re-made that day while the routine was away (#932), and the
            // Realtime bump brings the live one in. Painting the old one too
            // would draw the day twice.
            const stayed = new Set(conflictedIds);
            setScheduleItems((prev) => [
              ...prev,
              ...taken.filter(
                (s) => !stayed.has(s.id) && !prev.some((p) => p.id === s.id),
              ),
            ]);
          },
          // Re-runs the split against whatever is live now rather than
          // replaying the id list, as Schedule's redo does.
          redo: async () => {
            const again = await ds.detachRoutine(plan.routineId, plan.anchor);
            split(again.deletedScheduleItemIds);
          },
        });
        // Schedule reloads here when the fill wrote inside the visible range
        // (`plan.reloadAfterFill`). The paper has no reload handle of its own
        // and does not need one: the fill's rows land in items_meta +
        // events_payload, so the Realtime bump brings today's share of them
        // back through the fetch half.
      } catch (err) {
        console.error("[BriefingScreen] routine detach failed", err);
      }
    },
    [ds, ensureRoutineItemsForDateRange, push, scheduleItems, setScheduleItems],
  );

  const runSeriesDelete = useCallback(
    async (plan: Extract<RepeatScopePlan, { kind: "delete-series" }>) => {
      try {
        const { deletedScheduleItemIds } = await ds.softDeleteRoutine(
          plan.routineId,
        );
        const removed = new Set(deletedScheduleItemIds);
        setScheduleItems((prev) => prev.filter((s) => !removed.has(s.id)));
      } catch (err) {
        console.error("[BriefingScreen] routine delete failed", err);
      }
    },
    [ds, setScheduleItems],
  );

  const handleDeleteScopeChoose = useCallback(
    (scope: RepeatScope) => {
      const target = deleteScopeItem;
      setDeleteScopeItem(null);
      if (target === null) return;
      void (async () => {
        // The routine is read only when the plan will actually use it, and
        // `fillRangeUpToAnchor` is the same arithmetic the planner runs — so
        // the condition here cannot disagree with the plan it feeds.
        const routine =
          scope === "future" &&
          target.routineId != null &&
          fillRangeUpToAnchor(target.date, todayKey) !== null
            ? await loadRoutine(target.routineId)
            : undefined;
        const plan = planRepeatScopeChoice({
          request: { mode: "delete", item: target },
          scope,
          routine,
          today: todayKey,
        });
        switch (plan.kind) {
          case "dismiss-occurrence":
            dismissOccurrence(target);
            return;
          case "detach-series":
            await runSeriesDetach(plan, routine);
            return;
          case "delete-series":
            await runSeriesDelete(plan);
            return;
          default:
            // "none" — the row lost its routine between the question and the
            // answer. The two edit plans cannot arrive: this dialog only ever
            // asks in "delete" mode.
            return;
        }
      })();
    },
    [
      deleteScopeItem,
      todayKey,
      loadRoutine,
      dismissOccurrence,
      runSeriesDetach,
      runSeriesDelete,
    ],
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
      const landed = ds.softDeleteTodo(id);
      void landed.catch((err) => {
        console.error("[BriefingScreen] todo delete failed", err);
      });
      reportDeleted(target.title);
      push?.("todoTree", {
        label: "deleteTodo",
        undo: async () => {
          markDeleted(false);
          await afterSettled(landed);
          await ds.restoreTodo(id);
        },
        redo: () => {
          markDeleted(true);
          return ds.softDeleteTodo(id).then(() => {});
        },
      });
    },
    [ds, todoNodes, push, setTodoNodes, reportDeleted],
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
