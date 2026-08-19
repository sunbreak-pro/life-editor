import { useCallback } from "react";
import {
  useInFlightGuard,
  eventToTodoBlock,
  todoToEventBlock,
  todoToEventPlacement,
  eventRestore,
  todoRestorePatch,
  ItemConversionError,
  logServiceError,
  useTranslation,
  type DataService,
  type EventPlacement,
  type ScheduleItem,
  type TodoNode,
  type UndoRedoLike,
} from "@life-editor/shared";

/*
 * #625: Event <-> Todo conversion, lifted out of CalendarTab (#889).
 *
 * The write keeps the item's id, so both surfaces stay pointed at the same
 * row and its tags/links survive — but the row changes ROLE, which means the
 * list it was in stops holding it and another list starts. Neither store
 * finds that out on its own here: the schedule range reloads and the todo
 * tree refetches, and the item is simply gone from one surface and present
 * on the other. No navigation (per the Issue) — jumping the user to the
 * other section after a one-line action reads as losing their place.
 *
 * The guard is per-id and claimed synchronously (#434): the confirm dialog
 * plus an async write is exactly the window in which a second click lands,
 * and a second conversion of the same id would hit a row whose role has
 * already moved — recoverable, but it would report a failure for something
 * that actually worked.
 *
 * #739 (D-20260811-sched-1): Event→Todo now KEEPS the day and the time span
 * — they land in the Todo's own chip slot — so the row does not leave the
 * calendar, it changes what it IS. The only loss left is the repeat, which
 * is what the dialog says and all it says.
 *
 * The copy is resolved here rather than injected: the two paths pick between
 * five sentences by inspecting what the write would cost (a blocked routine,
 * a blocked parent, a child losing its parent, the item's own title), so
 * pre-resolving them would mean handing the whole branch over as data. This
 * is a web host hook, which is allowed to translate — §6.4 bars
 * `useTranslation` inside shared components, and `scheduleCopy.ts` next door
 * does the same.
 */

/*
 * #997: the two undo labels. Not in TODO_HISTORY_LABELS — that closed union is
 * for tree writes routed through `updateNode({ undoLabel })`; a conversion
 * pushes directly, the way the schedule / routine / note commands do.
 */
const UNDO_LABEL_TO_TODO = "convertEventToTodo";
const UNDO_LABEL_TO_EVENT = "convertTodoToEvent";

/** The slot a converted Todo lands in: the top of the root group. */
const CONVERT_TODO_ORDER = 0;

export interface UseItemConversionArgs {
  dataService: DataService;
  /** Both stores the lookup walks — visible range first, then today's. */
  rangeItems: ScheduleItem[];
  contextItems: ScheduleItem[];
  todoNodes: TodoNode[];
  /** The day a converted todo lands on when it has no slot of its own. */
  listDate: string;
  /** Re-read the schedule range after the role moved. */
  reload: () => void;
  /** Re-read the todo tree after the role moved. */
  refetchTodos: () => Promise<unknown> | void;
  showToast: (variant: "success" | "danger", message: string) => void;
  askConfirm: (request: {
    message: string;
    confirmLabel: string;
    cancelLabel?: string;
  }) => Promise<boolean>;
  /** Close the surfaces the action was invoked from. */
  closePopover: () => void;
  closeTodoDetail: () => void;
  /**
   * #997: the global undo stack's push. Optional so a host with no
   * UndoRedoProvider (a standalone render, a test) simply records no history —
   * the same shape every other Schedule consumer uses via
   * `useUndoRedoOptional`. The `domain` argument exists for UndoRedoLike
   * compatibility and is IGNORED by the provider: one stack, app-wide.
   */
  push?: UndoRedoLike["push"];
  /**
   * #998: the event-edit surface, which is about to be showing a row that has
   * stopped being an event. Called only on a confirmed Event → Todo — a
   * declined confirm or a refused routine leaves the sheet exactly as it was.
   */
  closeEditor: () => void;
}

export function useItemConversion({
  dataService,
  rangeItems,
  contextItems,
  todoNodes,
  listDate,
  reload,
  refetchTodos,
  showToast,
  askConfirm,
  closePopover,
  closeTodoDetail,
  push,
  closeEditor,
}: UseItemConversionArgs) {
  const { t } = useTranslation();
  const { begin: beginConvert, end: endConvert } = useInFlightGuard();

  /*
   * #997: both directions push one command, and both commands are "run the
   * INVERSE conversion, then patch back what the inverse cannot carry".
   *
   * Why a patch is needed at all: each direction builds the new payload row
   * from the old one and UPSERTs a row that fully specifies itself, so every
   * column the builder does not mention comes back NULL or false. The inverse
   * alone would land the user on a row of the right KIND and the wrong SHAPE —
   * the parent link gone, the priority cleared, a dismissed occurrence
   * un-dismissed. `eventRestore` / `todoRestorePatch` are the field-level spec
   * of that difference (shared/src/utils/itemConversion.ts).
   *
   * Both closures re-claim the per-id in-flight guard (#434). Undo is a
   * keyboard gesture and repeats readily, and a second inverse against a row
   * whose role has already moved would report a failure for something that
   * worked.
   *
   * The bodies are async and the manager awaits them, so the "Undid: ..." toast
   * lands after the writes settle rather than in front of them.
   */
  const pushEventToTodoUndo = useCallback(
    (before: ScheduleItem) => {
      if (!push) return;
      const id = before.id;
      const { placement, dismissed } = eventRestore(before);
      push("itemConversion", {
        label: UNDO_LABEL_TO_TODO,
        undo: async () => {
          if (!beginConvert(id)) return;
          try {
            await dataService.convertTodoToEvent(id, placement);
            // convertTodoToEvent always writes is_dismissed = false, so a
            // dismissed occurrence would come back un-dismissed without this.
            if (dismissed) await dataService.dismissScheduleItem(id);
            reload();
            await refetchTodos();
          } catch (err) {
            logServiceError(
              "ItemConversion",
              `undo convertEventToTodo (${id})`,
              err,
            );
            showToast("danger", t("itemConvert.failed"));
          } finally {
            endConvert(id);
          }
        },
        redo: async () => {
          if (!beginConvert(id)) return;
          try {
            await dataService.convertEventToTodo(id, {
              order: CONVERT_TODO_ORDER,
            });
            reload();
            await refetchTodos();
          } catch (err) {
            logServiceError(
              "ItemConversion",
              `redo convertEventToTodo (${id})`,
              err,
            );
            showToast("danger", t("itemConvert.failed"));
          } finally {
            endConvert(id);
          }
        },
      });
    },
    [
      push,
      dataService,
      reload,
      refetchTodos,
      showToast,
      t,
      beginConvert,
      endConvert,
    ],
  );

  const pushTodoToEventUndo = useCallback(
    (before: TodoNode, placement: EventPlacement) => {
      if (!push) return;
      const id = before.id;
      const patch = todoRestorePatch(before);
      push("itemConversion", {
        label: UNDO_LABEL_TO_EVENT,
        undo: async () => {
          if (!beginConvert(id)) return;
          try {
            // Role first: tasks_payload does not exist until this lands, so
            // the field patch would have nothing to write onto.
            await dataService.convertEventToTodo(id, { order: before.order });
            await dataService.updateTodo(id, patch);
            reload();
            await refetchTodos();
          } catch (err) {
            logServiceError(
              "ItemConversion",
              `undo convertTodoToEvent (${id})`,
              err,
            );
            showToast("danger", t("itemConvert.failed"));
          } finally {
            endConvert(id);
          }
        },
        redo: async () => {
          if (!beginConvert(id)) return;
          try {
            await dataService.convertTodoToEvent(id, placement);
            reload();
            await refetchTodos();
          } catch (err) {
            logServiceError(
              "ItemConversion",
              `redo convertTodoToEvent (${id})`,
              err,
            );
            showToast("danger", t("itemConvert.failed"));
          } finally {
            endConvert(id);
          }
        },
      });
    },
    [
      push,
      dataService,
      reload,
      refetchTodos,
      showToast,
      t,
      beginConvert,
      endConvert,
    ],
  );

  const handleConvertToTodo = useCallback(
    (id: string) => {
      const item =
        rangeItems.find((i) => i.id === id) ??
        contextItems.find((i) => i.id === id);
      if (!item) return;
      // D-20260810-sched-5, and the user asked for it in exactly this shape:
      // the action stays enabled and ANSWERS with the reason. A greyed-out row
      // teaches nothing.
      if (eventToTodoBlock(item)) {
        // Acknowledge-only: there is nothing to decide, so the dialog carries
        // one button. The wording is the user's own (D-20260810-sched-5).
        void askConfirm({
          message: t("itemConvert.routineBlocked"),
          confirmLabel: t("common.ok"),
        });
        return;
      }
      void askConfirm({
        message: t("itemConvert.toTodoConfirm", {
          title: item.title || t("scheduleCalendar.newEvent"),
        }),
        confirmLabel: t("itemConvert.toTodo"),
        cancelLabel: t("common.cancel"),
      }).then((ok) => {
        if (!ok) return;
        // Still claimed synchronously on the way out of the dialog (#434): the
        // answer arrives in an event handler, so nothing runs between this and
        // the write that could let a second click through.
        if (!beginConvert(id)) return;
        closePopover();
        closeEditor();
        // order 0 = the top of the root group, the slot addNode aims a new
        // todo at. It does NOT shift the existing siblings down the way
        // addNode does: that would be a second, unrelated write over every
        // root row, and a tie in sort_order only costs an arbitrary order
        // between two rows.
        void dataService
          .convertEventToTodo(id, { order: CONVERT_TODO_ORDER })
          .then(() => {
            reload();
            void refetchTodos();
            // Pushed inside the success branch: a failed write or a declined
            // confirm must leave nothing on the stack to "undo".
            pushEventToTodoUndo(item);
          })
          .then(() => showToast("success", t("itemConvert.toTodoDone")))
          .catch((err) => {
            logServiceError(
              "ItemConversion",
              `convertEventToTodo (${id})`,
              err,
            );
            showToast("danger", t("itemConvert.failed"));
          })
          .finally(() => endConvert(id));
      });
    },
    [
      rangeItems,
      contextItems,
      dataService,
      reload,
      refetchTodos,
      showToast,
      askConfirm,
      closePopover,
      pushEventToTodoUndo,
      closeEditor,
      beginConvert,
      endConvert,
      t,
    ],
  );

  const handleConvertToEvent = useCallback(
    (id: string) => {
      const todo = todoNodes.find((n) => n.id === id);
      if (!todo) return;
      // D-20260810-sched-4. The service repeats this check against the DB
      // (soft-deleted children are invisible here but still hold the FK); this
      // one exists so the common case gets a sentence instead of a red toast.
      const blocked = todoToEventBlock(todoNodes, id);
      if (blocked) {
        void askConfirm({
          message: t("itemConvert.childrenBlocked", {
            title: blocked.title,
            count: blocked.childCount,
          }),
          confirmLabel: t("common.ok"),
        });
        return;
      }
      void askConfirm({
        // A child Todo loses its parent link (events have no hierarchy), and
        // the dialog is the only place that can say so before it happens.
        message: t(
          todo.parentId != null
            ? "itemConvert.toEventConfirmChild"
            : "itemConvert.toEventConfirm",
          { title: todo.title || t("common.untitled") },
        ),
        confirmLabel: t("itemConvert.toEvent"),
        cancelLabel: t("common.cancel"),
      }).then((ok) => {
        if (!ok) return;
        if (!beginConvert(id)) return;
        closePopover();
        closeTodoDetail();
        // Computed once and reused by the redo, so the two can never disagree
        // about where the event landed.
        const placement = todoToEventPlacement(todo, listDate);
        void dataService
          .convertTodoToEvent(id, placement)
          .then(() => {
            reload();
            void refetchTodos();
            pushTodoToEventUndo(todo, placement);
          })
          .catch((err) => {
            logServiceError(
              "ItemConversion",
              `convertTodoToEvent (${id})`,
              err,
            );
            // The DB sees children the live tree cannot (trashed ones still
            // hold the 0009 FK), so that refusal gets its own sentence —
            // "conversion failed" would send the user looking for a network
            // problem.
            showToast(
              "danger",
              err instanceof ItemConversionError && err.reason === "children"
                ? t("itemConvert.childrenBlockedServer")
                : t("itemConvert.failed"),
            );
          })
          .finally(() => endConvert(id));
      });
    },
    [
      todoNodes,
      dataService,
      listDate,
      reload,
      refetchTodos,
      showToast,
      askConfirm,
      closePopover,
      closeTodoDetail,
      pushTodoToEventUndo,
      beginConvert,
      endConvert,
      t,
    ],
  );

  return { handleConvertToTodo, handleConvertToEvent };
}
