import { useCallback } from "react";
import {
  TOUR_ACTIONS,
  useTourAction,
  type TodoNode,
  type TodoStatus,
} from "@life-editor/shared";
import type { useScheduleMutations } from "./useScheduleMutations";

/*
 * Tutorial tour reporting (#1124), extracted from CalendarTab by #1642 P2.
 *
 * Four of the Schedule steps advance on a real write, so the host tells the
 * tour when one lands. Each writer is wrapped at the SOURCE, before anything
 * is handed it, and the wrapped one is what every part receives — wrapping
 * the call sites instead would mean one copy of the "did this actually do the
 * step?" test per route, and the routes keep multiplying (completion alone has
 * three: the tray's checkbox, the detail's toggle, the detail's status row).
 *
 * Why here rather than inside useScheduleMutations / useScheduleCreateFlow /
 * useScheduleTodoChips: those are deliberately context-free so they render
 * under `renderHook` with no Provider at all (see their headers), and reaching
 * into the tour's Context from inside them would take that away.
 *
 * Two hooks, not one, because the two halves are handed over at different
 * points of the host's hook order: the todo writers go INTO
 * useScheduleTodoChips, which the mutation layer depends on, and the event
 * writers come OUT of that mutation layer. One hook could not sit on both
 * sides of it. `useTourAction` returns a reporter that is stable for the
 * component's lifetime, so neither half adds a dependency that changes as the
 * tour walks.
 */

type ScheduleMutations = ReturnType<typeof useScheduleMutations>;

export interface TodoTourReporting {
  setTodoStatusReported: (id: string, status: TodoStatus) => void;
  toggleTodoStatusReported: (id: string) => void;
  /**
   * The create step. Only the todo create dialog MAKES a todo, so it is the
   * only route that calls this — the tray's "add to today" moves an existing
   * one onto a day, which is not what the step teaches.
   */
  reportTodoCreated: () => void;
}

export function useTodoTourReporting({
  todoNodes,
  setTodoStatus,
  toggleTodoStatus,
}: {
  todoNodes: TodoNode[];
  setTodoStatus: (id: string, status: TodoStatus) => void;
  toggleTodoStatus: (id: string) => void;
}): TodoTourReporting {
  const reportTourAction = useTourAction();

  const setTodoStatusReported = useCallback(
    (id: string, status: TodoStatus) => {
      setTodoStatus(id, status);
      if (status === "DONE") {
        reportTourAction(TOUR_ACTIONS.scheduleTodoCompleted);
      }
    },
    [reportTourAction, setTodoStatus],
  );

  const toggleTodoStatusReported = useCallback(
    (id: string) => {
      // Read the status BEFORE the flip: only finishing a todo advances the
      // step, and re-opening one must not. Two values since #873, so "not
      // DONE" is the whole test.
      const completes =
        (todoNodes.find((n) => n.id === id)?.status ?? "NOT_STARTED") !==
        "DONE";
      toggleTodoStatus(id);
      if (completes) {
        reportTourAction(TOUR_ACTIONS.scheduleTodoCompleted);
      }
    },
    [reportTourAction, todoNodes, toggleTodoStatus],
  );

  const reportTodoCreated = useCallback(
    () => reportTourAction(TOUR_ACTIONS.scheduleTodoCreated),
    [reportTourAction],
  );

  return { setTodoStatusReported, toggleTodoStatusReported, reportTodoCreated };
}

export interface EventTourReporting {
  handleCreateReported: ScheduleMutations["handleCreate"];
  handleUpdateReported: ScheduleMutations["handleUpdate"];
}

export function useEventTourReporting({
  handleCreate,
  handleUpdate,
}: Pick<
  ScheduleMutations,
  "handleCreate" | "handleUpdate"
>): EventTourReporting {
  const reportTourAction = useTourAction();

  const handleCreateReported = useCallback<ScheduleMutations["handleCreate"]>(
    (slot, title, onSaved) => {
      const id = handleCreate(slot, title, onSaved);
      reportTourAction(TOUR_ACTIONS.scheduleEventCreated);
      return id;
    },
    [handleCreate, reportTourAction],
  );

  const handleUpdateReported = useCallback<ScheduleMutations["handleUpdate"]>(
    (id, patch) => {
      handleUpdate(id, patch);
      // Only a TIME edit advances the step, because that is what the step
      // asks for — renaming the event teaches nothing about the calendar.
      // Read off the patch rather than the item: the pane sends only the
      // fields the user actually changed.
      if (patch.startTime !== undefined || patch.endTime !== undefined) {
        reportTourAction(TOUR_ACTIONS.scheduleEventTimeChanged);
      }
    },
    [handleUpdate, reportTourAction],
  );

  return { handleCreateReported, handleUpdateReported };
}
