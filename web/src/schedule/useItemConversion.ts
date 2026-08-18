import { useCallback } from "react";
import {
  useInFlightGuard,
  eventToTodoBlock,
  todoToEventBlock,
  todoToEventPlacement,
  ItemConversionError,
  logServiceError,
  useTranslation,
  type DataService,
  type ScheduleItem,
  type TodoNode,
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
  closeEditor,
}: UseItemConversionArgs) {
  const { t } = useTranslation();
  const { begin: beginConvert, end: endConvert } = useInFlightGuard();

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
          .convertEventToTodo(id, { order: 0 })
          .then(() => {
            reload();
            void refetchTodos();
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
        void dataService
          .convertTodoToEvent(id, todoToEventPlacement(todo, listDate))
          .then(() => {
            reload();
            void refetchTodos();
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
      beginConvert,
      endConvert,
      t,
    ],
  );

  return { handleConvertToTodo, handleConvertToEvent };
}
