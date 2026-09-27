import { useCallback, useState, type ReactElement } from "react";
import { TodoAddDialog, useTranslation } from "@life-editor/shared";
import { todoAddCandidateWrite } from "./todoChipUndoWiring";
import type { UseScheduleCreateFlowArgs } from "./useScheduleCreateFlow";

/*
 * The Schedule's todo create dialog (#1153 → #1640), extracted from
 * CalendarTab by #1642 P2 — its state, its one write and the element itself.
 *
 * Todos have no day when they are made — that is what the tray's unscheduled
 * group IS — so this deliberately does NOT go through the calendar's creation
 * panel, which exists to place something on a slot. The panel's own todo tab
 * (useScheduleCreateFlow's `handleCreateTodoSubmit`) is the other todo create
 * on this screen and stays separate for that reason: it schedules the new
 * node into the slot it was opened on, and it attaches a note.
 *
 * The element is returned rather than rendered by a component of its own
 * because the openers live elsewhere (the tray's two heading pills and the
 * shell's global:new-task intent) and all three have to reach the same state.
 * It is mounted for BOTH layouts, like the overlay set beside it: the two
 * returns used to hand-list their own overlays and drifted (see the
 * ScheduleOverlays header), and a create dialog that existed on one width only
 * would be the same mistake with a new name.
 */

/** Which list the dialog is making a todo for. */
export type TodoAddTarget = "today" | "other";

export interface UseTodoAddDialogArgs {
  /** global:new-task from the shell — opens the dialog for the "other" list. */
  pendingNewTodo: boolean;
  addNode: (type: "task", parentId: null, title: string) => { id: string };
  updateNode: UseScheduleCreateFlowArgs["updateNode"];
  today: string;
  /** Opens the new todo's detail straight after it is made. */
  setTodoDetailId: (id: string | null) => void;
  /** The tour's create step (useTodoTourReporting). */
  onCreated: () => void;
}

export interface TodoAddDialogApi {
  openTodoAdd: (target: TodoAddTarget) => void;
  todoAddDialog: ReactElement;
}

export function useTodoAddDialog({
  pendingNewTodo,
  addNode,
  updateNode,
  today,
  setTodoDetailId,
  onCreated,
}: UseTodoAddDialogArgs): TodoAddDialogApi {
  const { t } = useTranslation();

  /*
   * #1640: WHICH list the dialog is making a todo for — "today" from the
   * today heading's pill, "other" from the one over "その他" (and from the
   * shell intent, which has no list in mind). null = closed.
   *
   * A target rather than a second flag so the two can never be open at once,
   * and so the dialog itself stays one mounted surface.
   */
  const [todoAddTarget, setTodoAddTarget] = useState<TodoAddTarget | null>(
    null,
  );

  /*
   * The dialog opens from the shell intent by ADJUSTING STATE WHILE RENDERING
   * rather than from an effect — React's own pattern for a prop that has to
   * move local state. A synchronous setState inside an effect cascades an
   * extra render pass, which is what react-hooks/set-state-in-effect objects
   * to. The parts that are not local state (the tab, the drawer, the consume)
   * stay in useScheduleShellIntents' effect.
   */
  const [prevPendingNewTodo, setPrevPendingNewTodo] = useState(pendingNewTodo);
  if (pendingNewTodo !== prevPendingNewTodo) {
    setPrevPendingNewTodo(pendingNewTodo);
    if (pendingNewTodo) setTodoAddTarget("other");
  }

  const handleCreateTodo = useCallback(
    (input: { title: string }) => {
      const node = addNode("task", null, input.title);
      // #1640: the pill that opened the dialog decides the day. "Today" reuses
      // the tray's own "add to today" write (all-day on today), so a todo made
      // here and a todo dragged up into the list are the same row.
      if (todoAddTarget === "today") {
        const { patch, options } = todoAddCandidateWrite(today);
        updateNode(node.id, patch, options);
      }
      setTodoAddTarget(null);
      // Straight into the detail: a title alone is rarely the whole thought,
      // and this is the surface that can take the rest of it.
      setTodoDetailId(node.id);
      onCreated();
    },
    [addNode, onCreated, setTodoDetailId, todoAddTarget, today, updateNode],
  );

  const todoAddDialog = (
    <TodoAddDialog
      open={todoAddTarget != null}
      onClose={() => setTodoAddTarget(null)}
      onSubmit={handleCreateTodo}
      labels={{
        title: t("scheduleScreen.todoAddDialogTitle"),
        titleLabel: t("scheduleScreen.todoAddTitleLabel"),
        titlePlaceholder: t("scheduleScreen.todoAddTitlePlaceholder"),
        submit: t("scheduleScreen.todoAddSubmit"),
        cancel: t("scheduleScreen.todoAddCancel"),
      }}
    />
  );

  return { openTodoAdd: setTodoAddTarget, todoAddDialog };
}
