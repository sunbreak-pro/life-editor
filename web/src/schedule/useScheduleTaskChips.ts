import { useCallback, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  isTaskChip,
  pickAddableTasks,
  tasksToCalendarChips,
  unwrapTaskChipId,
  type AddableTask,
  type ConfirmRequest,
  type TaskCalendarChip,
  type TaskNode,
  type TaskStatus,
  type TodayTodoRow,
  type UpdateNodeOptions,
} from "@life-editor/shared";
import {
  taskChipAllDayWrite,
  taskChipMoveWrite,
  taskChipResizeWrite,
  todoAddCandidateWrite,
} from "./taskChipUndoWiring";
import {
  confirmTodoDetailDelete,
  todoDeleteCascade,
  type TodoDetailDeleteCopy,
} from "../shared/todoTrayDeleteGuard";

/*
 * The Calendar host's TASK half (#675, extracted from CalendarTab).
 *
 * Schedule draws two kinds of row from two different stores. Events come from
 * the ScheduleItems provider through the visible-range store; scheduled
 * TaskNodes come from the TaskTree provider and are turned into blue chips at
 * a derived layer that never touches `rangeItems` (A-1). Everything in this
 * file belongs to the second kind — the chips, the "本日の Todo" tray they
 * back, and every gesture that writes a TaskNode — and none of it reads the
 * range store, the repeat machinery or the mutation layer. That is the whole
 * reason it comes out as one piece: the two halves shared a file, not a
 * thought.
 *
 * Everything is injected (§3.1 / §6.4): provider callbacks, the visible
 * window, the confirm-dialog `ask`, and already-resolved copy. The hook owns
 * one piece of state — `taskDetailId` — because it is the id of a TASK behind
 * the detail overlay, which the host's `selectedId` cannot hold (that one
 * resolves schedule_items and a chip has none, #626).
 *
 * What was untestable here before: CalendarTab needs the whole Provider stack
 * plus real layout to render, and jsdom has neither, so a swapped group or a
 * dropped confirm went green through all seven gates. As a hook these are
 * ordinary calls — see web/tests/useScheduleTaskChips.test.tsx. The individual
 * WRITES stay pure in taskChipUndoWiring.ts; this file is the wiring around
 * them.
 */

export interface UseScheduleTaskChipsArgs {
  /** The live tree (soft-deleted rows already excluded by useTaskTreeAPI). */
  taskNodes: TaskNode[];
  updateNode: (
    id: string,
    updates: Partial<TaskNode>,
    options?: UpdateNodeOptions,
  ) => void;
  setTaskStatus: (id: string, status: TaskStatus) => void;
  softDeleteTask: (id: string) => void;
  /** Today's calendar key — the tray's day, independent of the grid's. */
  today: string;
  /** The grid's visible window (useCalendarNav). */
  rangeStart: string;
  rangeEnd: string;
  askConfirm: (request: ConfirmRequest) => Promise<boolean>;
  copy: TodoDetailDeleteCopy;
}

export interface ScheduleTaskChipsApi {
  /** The visible range's chips, before the #468 calendar lens. */
  rangeTaskChips: TaskCalendarChip[];
  /** Today's chips — the "今日の流れ" agenda and the tray, outside the lens. */
  todayTaskChips: TaskCalendarChip[];
  todoPlaced: TodayTodoRow[];
  todoUnplaced: TodayTodoRow[];
  todoAddable: AddableTask[];
  /** Resolve a chip id (as the grid spells it) to the chip behind it. */
  findTaskChip: (chipId: string) => TaskCalendarChip | null;
  /** #626: the TaskNode id behind an open task detail, or null. */
  taskDetailId: string | null;
  setTaskDetailId: Dispatch<SetStateAction<string | null>>;
  handleTaskChipMove: (
    chipId: string,
    dateISO: string,
    startISO: string,
    endISO: string,
  ) => void;
  handleTaskChipResize: (chipId: string, endISO: string) => void;
  handleTaskChipDropAllDay: (chipId: string, dateISO: string) => void;
  handleTodoToggleComplete: (taskId: string) => void;
  handleTodoAddCandidate: (taskId: string) => void;
  /** Tray / bubble delete — asks only for a row with children (#573). */
  handleTodoDelete: (id: string) => void;
  /** Detail-panel delete — always asks, and closes the panel (#775). */
  handleTodoDetailDelete: (id: string) => void;
}

export function useScheduleTaskChips({
  taskNodes,
  updateNode,
  setTaskStatus,
  softDeleteTask,
  today,
  rangeStart,
  rangeEnd,
  askConfirm,
  copy,
}: UseScheduleTaskChipsArgs): ScheduleTaskChipsApi {
  // #626: task-chip detail overlay — the UNWRAPPED TaskNode id behind an open
  // task detail, or null. Separate from the host's selectedId/overlayOpen
  // because those resolve schedule_items and a chip has none.
  const [taskDetailId, setTaskDetailId] = useState<string | null>(null);

  // Scheduled-task chips (schedule redesign A-1). `rangeTaskChips` is the
  // unfiltered visible range — the grid + month draw its post-lens narrowing
  // (#468). `todayTaskChips` backs the "今日の流れ" flow, which always shows
  // today regardless of the grid's visible range AND stays outside the lens:
  // the sidebar is where a hidden row is still reachable. Task chips are
  // merged only at this derived (map) layer — never into `rangeItems` (the
  // optimistic ScheduleItem mutation store).
  const scheduledTasks = useMemo(
    () => taskNodes.filter((n) => n.scheduledAt != null),
    [taskNodes],
  );
  const rangeTaskChips = useMemo(
    () => tasksToCalendarChips(scheduledTasks, rangeStart, rangeEnd),
    [scheduledTasks, rangeStart, rangeEnd],
  );
  const todayTaskChips = useMemo(
    () => tasksToCalendarChips(scheduledTasks, today, today),
    [scheduledTasks, today],
  );

  // A-3 (#298) Today's Todo tray groups. Reuse today's chips: a time = placed,
  // all-day = an unplaced candidate (案 c staging). "Add from tasks" offers the
  // incomplete, unscheduled leaves (pickAddableTasks).
  const todoPlaced = useMemo<TodayTodoRow[]>(
    () =>
      todayTaskChips
        .filter((c) => !c.isAllDay)
        .map((c) => ({
          id: c.id,
          title: c.title,
          timeLabel: c.startTime,
          completed: c.completed,
        })),
    [todayTaskChips],
  );
  const todoUnplaced = useMemo<TodayTodoRow[]>(
    () =>
      todayTaskChips
        .filter((c) => c.isAllDay)
        .map((c) => ({ id: c.id, title: c.title, completed: c.completed })),
    [todayTaskChips],
  );
  const todoAddable = useMemo(() => pickAddableTasks(taskNodes), [taskNodes]);

  /*
   * #564: the chip behind a bubble. Both lists are searched, in this order,
   * for the same reason `selected` reads rangeItems ?? contextItems: the
   * "今日の流れ" agenda always lists TODAY, so with the grid parked on another
   * week its task rows are in no range chip at all — and looking only at the
   * range would leave that surface with a silently dead click.
   *
   * A non-chip id answers null rather than searching: schedule_item ids and
   * chip ids share one popover, and an event has no chip to find.
   */
  const findTaskChip = useCallback(
    (chipId: string): TaskCalendarChip | null => {
      if (!isTaskChip(chipId)) return null;
      const taskId = unwrapTaskChipId(chipId);
      return (
        rangeTaskChips.find((c) => c.id === taskId) ??
        todayTaskChips.find((c) => c.id === taskId) ??
        null
      );
    },
    [rangeTaskChips, todayTaskChips],
  );

  /*
   * A-2 (#297) / #562 / #569: the task-chip writes.
   *
   * What each gesture writes — the patch AND whether it lands on the undo stack
   * — lives in taskChipUndoWiring.ts, not here. These handlers keep what is
   * actually the host's: unwrapping the synthetic chip id, finding the task,
   * and calling updateNode (which is optimistic — the chip re-derives at its
   * new position with no manual patch, closing Schedule AC10).
   */
  const handleTaskChipMove = useCallback(
    (chipId: string, dateISO: string, startISO: string, endISO: string) => {
      const taskId = unwrapTaskChipId(chipId);
      const { patch, options } = taskChipMoveWrite(
        taskNodes.find((n) => n.id === taskId),
        dateISO,
        startISO,
        endISO,
      );
      updateNode(taskId, patch, options);
    },
    [taskNodes, updateNode],
  );

  const handleTaskChipResize = useCallback(
    (chipId: string, endISO: string) => {
      const taskId = unwrapTaskChipId(chipId);
      // null = the task has no usable start, so there is no day to anchor the
      // new end to (see taskChipResizeWrite).
      const write = taskChipResizeWrite(
        taskNodes.find((n) => n.id === taskId),
        endISO,
      );
      if (!write) return;
      updateNode(taskId, write.patch, write.options);
    },
    [taskNodes, updateNode],
  );

  const handleTaskChipDropAllDay = useCallback(
    (chipId: string, dateISO: string) => {
      const { patch, options } = taskChipAllDayWrite(dateISO);
      updateNode(unwrapTaskChipId(chipId), patch, options);
    },
    [updateNode],
  );

  // A-3 (#298) Today's Todo tray. Completion routes to the TaskTree status API
  // (the tray owns no completion state of its own); a plain binary toggle, not
  // the 3-state cycle (NOT_STARTED ↔ DONE).
  const handleTodoToggleComplete = useCallback(
    (taskId: string) => {
      const task = taskNodes.find((n) => n.id === taskId);
      setTaskStatus(taskId, task?.status === "DONE" ? "NOT_STARTED" : "DONE");
    },
    [taskNodes, setTaskStatus],
  );

  // "Add to today" (案 c staging — the write itself is in
  // taskChipUndoWiring.ts). #569 made it undoable: it is a single button press
  // with no gesture to reverse it, and the tray's "add from tasks" list drops
  // the task the moment it is added, so a mis-tap left the user hunting for the
  // row in the unplaced group to put it back by hand.
  const handleTodoAddCandidate = useCallback(
    (taskId: string) => {
      const { patch, options } = todoAddCandidateWrite(today);
      updateNode(taskId, patch, options);
    },
    [today, updateNode],
  );

  // #573 (#555 follow-up): softDelete cascades through the subtree and both
  // recovery routes are weak (undo clears on section unmount; Trash restores
  // one row at a time), so a row with children confirms first. Leaves keep
  // the one-click delete. Guards the tray AND the task-chip bubble (same
  // write); #707 moved the question in-app.
  const handleTodoDelete = useCallback(
    (id: string) => {
      const cascade = todoDeleteCascade(taskNodes, id);
      if (!cascade) {
        softDeleteTask(id);
        return;
      }
      void askConfirm({
        message: copy.cascadeConfirm(cascade.title, cascade.childCount),
        confirmLabel: copy.confirmLabel,
        cancelLabel: copy.cancelLabel,
        danger: true,
      }).then((ok) => {
        if (ok) softDeleteTask(id);
      });
    },
    [taskNodes, softDeleteTask, askConfirm, copy],
  );

  /*
   * #775: the todo DETAIL panel's delete — the Mobile sheet's, above all. Until
   * now a todo created on a phone could not be removed from one: the sheet
   * offered close / status / tags / save / convert and nothing else, while the
   * event beside it in the same day list had a delete all along.
   *
   * A separate handler from handleTodoDelete because the QUESTION differs, not
   * the write. The tray's trash icon is a one-tap row control and stays
   * frictionless for a leaf (#573); this one always asks, because a phone has
   * no hover to reveal what a control does, no keyboard undo, and the sheet is
   * where a mis-tap is most likely to be a fat finger rather than a decision.
   * A parent row still gets the cascade sentence — the count is what the user
   * cannot see from here.
   *
   * The panel is closed FIRST, without the unsaved-draft guard: a pending title
   * on a row that is being deleted is not something to rescue, and asking twice
   * for one act reads as a bug. Undo is the same one the tray's delete raises
   * (softDelete → persistWithHistory), so the header's undo still takes it back
   * while the section stays mounted; Trash is the route that survives longer.
   */
  const handleTodoDetailDelete = useCallback(
    (id: string) => {
      void confirmTodoDetailDelete(taskNodes, id, askConfirm, copy).then(
        (ok) => {
          if (!ok) return;
          setTaskDetailId(null);
          softDeleteTask(id);
        },
      );
    },
    [taskNodes, softDeleteTask, askConfirm, copy],
  );

  return {
    rangeTaskChips,
    todayTaskChips,
    todoPlaced,
    todoUnplaced,
    todoAddable,
    findTaskChip,
    taskDetailId,
    setTaskDetailId,
    handleTaskChipMove,
    handleTaskChipResize,
    handleTaskChipDropAllDay,
    handleTodoToggleComplete,
    handleTodoAddCandidate,
    handleTodoDelete,
    handleTodoDetailDelete,
  };
}
