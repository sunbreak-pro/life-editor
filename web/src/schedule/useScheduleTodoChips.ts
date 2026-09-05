import { useCallback, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  isTodoChip,
  pickOtherTodos,
  todosToCalendarChips,
  unwrapTodoChipId,
  useTranslation,
  type ConfirmRequest,
  type TodoCalendarChip,
  type TodoNode,
  type TodoStatus,
  type TodayTodoAddableRow,
  type TodayTodoRow,
  type UpdateNodeOptions,
} from "@life-editor/shared";
import {
  todoChipAllDayWrite,
  todoChipMoveWrite,
  todoChipResizeWrite,
  todoMoveOutWrite,
  todoMoveToTodayWrite,
} from "./todoChipUndoWiring";
import {
  confirmTodoDetailDelete,
  todoDeleteCascade,
  type TodoDetailDeleteCopy,
} from "../shared/todoTrayDeleteGuard";

/*
 * The Calendar host's TODO half (#675, extracted from CalendarTab).
 *
 * Schedule draws two kinds of row from two different stores. Events come from
 * the ScheduleItems provider through the visible-range store; scheduled
 * TodoNodes come from the TodoTree provider and are turned into blue chips at
 * a derived layer that never touches `rangeItems` (A-1). Everything in this
 * file belongs to the second kind — the chips, the "本日の Todo" tray they
 * back, and every gesture that writes a TodoNode — and none of it reads the
 * range store, the repeat machinery or the mutation layer. That is the whole
 * reason it comes out as one piece: the two halves shared a file, not a
 * thought.
 *
 * The DATA is injected (§3.1): provider callbacks, the visible window and the
 * confirm-dialog `ask`. The COPY is not — this is a web host hook, so it
 * resolves its own `t` (§6.4 allows the host side to; the "no useTranslation in
 * parts" rule is about `shared/src/components/`), the same line
 * `useScheduleCopy` and `useEditorCloseGuard` already draw. It arrived that way
 * with #1000: the bundle was built in CalendarTab and read by nothing else
 * there, so the host was carrying a memo purely to hand it straight back.
 *
 * The hook owns one piece of state — `todoDetailId` — because it is the id of a
 * TODO behind the detail overlay, which the host's `selectedId` cannot hold
 * (that one resolves schedule_items and a chip has none, #626).
 *
 * What was untestable here before: CalendarTab needs the whole Provider stack
 * plus real layout to render, and jsdom has neither, so a swapped group or a
 * dropped confirm went green through all seven gates. As a hook these are
 * ordinary calls — see web/tests/useScheduleTodoChips.test.tsx. The individual
 * WRITES stay pure in todoChipUndoWiring.ts; this file is the wiring around
 * them.
 */

export interface UseScheduleTodoChipsArgs {
  /** The live tree (soft-deleted rows already excluded by useTodoTreeAPI). */
  todoNodes: TodoNode[];
  updateNode: (
    id: string,
    updates: Partial<TodoNode>,
    options?: UpdateNodeOptions,
  ) => void;
  setTodoStatus: (id: string, status: TodoStatus) => void;
  softDeleteTodo: (id: string) => void;
  /** Today's calendar key — the tray's day, independent of the grid's. */
  today: string;
  /** The grid's visible window (useCalendarNav). */
  rangeStart: string;
  rangeEnd: string;
  askConfirm: (request: ConfirmRequest) => Promise<boolean>;
}

export interface ScheduleTodoChipsApi {
  /** The visible range's chips, before the #468 calendar lens. */
  rangeTodoChips: TodoCalendarChip[];
  /** Today's chips — the "今日の流れ" agenda and the tray, outside the lens. */
  todayTodoChips: TodoCalendarChip[];
  todoPlaced: TodayTodoRow[];
  todoUnplaced: TodayTodoRow[];
  /** The "その他の Todo" list (#1406): every open leaf not on today. */
  todoAddable: TodayTodoAddableRow[];
  /** Resolve a chip id (as the grid spells it) to the chip behind it. */
  findTodoChip: (chipId: string) => TodoCalendarChip | null;
  /** #626: the TodoNode id behind an open todo detail, or null. */
  todoDetailId: string | null;
  setTodoDetailId: Dispatch<SetStateAction<string | null>>;
  handleTodoChipMove: (
    chipId: string,
    dateISO: string,
    startISO: string,
    endISO: string,
  ) => void;
  handleTodoChipResize: (chipId: string, endISO: string) => void;
  handleTodoChipDropAllDay: (chipId: string, dateISO: string) => void;
  handleTodoToggleComplete: (todoId: string) => void;
  /** Tray, "move to today" — a date change that keeps the row's time (#1406). */
  handleTodoAddCandidate: (todoId: string) => void;
  /** Tray, "take off today" — the row goes back to having no day (#1406). */
  handleTodoMoveOut: (todoId: string) => void;
  /** Tray / bubble delete — asks only for a row with children (#573). */
  handleTodoDelete: (id: string) => void;
  /** Detail-panel delete — always asks, and closes the panel (#775). */
  handleTodoDetailDelete: (id: string) => void;
}

export function useScheduleTodoChips({
  todoNodes,
  updateNode,
  setTodoStatus,
  softDeleteTodo,
  today,
  rangeStart,
  rangeEnd,
  askConfirm,
}: UseScheduleTodoChipsArgs): ScheduleTodoChipsApi {
  const { t } = useTranslation();

  // The words for this hook's own two delete dialogs (#1000 moved them in from
  // CalendarTab, which had no other reader for them). Memoised because both
  // delete handlers below keep it in their deps, and a fresh object per render
  // would rebuild the pair on every keystroke anywhere in the calendar.
  const copy = useMemo<TodoDetailDeleteCopy>(
    () => ({
      confirm: (name: string) => t("todoDetail.todoDeleteConfirm", { name }),
      cascadeConfirm: (name: string, count: number) =>
        t("todoDetail.todoDeleteCascadeConfirm", { name, count }),
      untitled: t("common.untitled"),
      confirmLabel: t("todoDetail.delete"),
      cancelLabel: t("common.cancel"),
    }),
    [t],
  );

  // #626: todo-chip detail overlay — the UNWRAPPED TodoNode id behind an open
  // todo detail, or null. Separate from the host's selectedId/overlayOpen
  // because those resolve schedule_items and a chip has none.
  const [todoDetailId, setTodoDetailId] = useState<string | null>(null);

  // Scheduled-todo chips (schedule redesign A-1). `rangeTodoChips` is the
  // unfiltered visible range — the grid + month draw its post-lens narrowing
  // (#468). `todayTodoChips` backs the "今日の流れ" flow, which always shows
  // today regardless of the grid's visible range AND stays outside the lens:
  // the sidebar is where a hidden row is still reachable. Todo chips are
  // merged only at this derived (map) layer — never into `rangeItems` (the
  // optimistic ScheduleItem mutation store).
  const scheduledTodos = useMemo(
    () => todoNodes.filter((n) => n.scheduledAt != null),
    [todoNodes],
  );
  const rangeTodoChips = useMemo(
    () => todosToCalendarChips(scheduledTodos, rangeStart, rangeEnd),
    [scheduledTodos, rangeStart, rangeEnd],
  );
  const todayTodoChips = useMemo(
    () => todosToCalendarChips(scheduledTodos, today, today),
    [scheduledTodos, today],
  );

  // A-3 (#298) Today's Todo tray groups. Reuse today's chips: a time = placed,
  // all-day = an unplaced candidate (案 c staging). Since #1406 the tray shows
  // the two as ONE "today" list (singleList) and, under it, "その他の Todo" —
  // every open leaf that is not on today (pickOtherTodos), day-less or parked
  // on another day, the latter saying where it is.
  const todoPlaced = useMemo<TodayTodoRow[]>(
    () =>
      todayTodoChips
        .filter((c) => !c.isAllDay)
        .map((c) => ({
          id: c.id,
          title: c.title,
          timeLabel: c.startTime,
          completed: c.completed,
        })),
    [todayTodoChips],
  );
  const todoUnplaced = useMemo<TodayTodoRow[]>(
    () =>
      todayTodoChips
        .filter((c) => c.isAllDay)
        .map((c) => ({ id: c.id, title: c.title, completed: c.completed })),
    [todayTodoChips],
  );
  const todoAddable = useMemo<TodayTodoAddableRow[]>(
    () =>
      pickOtherTodos(todoNodes, today).map((o) => ({
        id: o.id,
        title: o.title,
        meta: o.scheduledDate
          ? `${shortDate(o.scheduledDate)}${o.startTime ? ` ${o.startTime}` : ""}`
          : undefined,
      })),
    [todoNodes, today],
  );

  /*
   * #564: the chip behind a bubble. Both lists are searched, in this order,
   * for the same reason `selected` reads rangeItems ?? contextItems: the
   * "今日の流れ" agenda always lists TODAY, so with the grid parked on another
   * week its todo rows are in no range chip at all — and looking only at the
   * range would leave that surface with a silently dead click.
   *
   * A non-chip id answers null rather than searching: schedule_item ids and
   * chip ids share one popover, and an event has no chip to find.
   */
  const findTodoChip = useCallback(
    (chipId: string): TodoCalendarChip | null => {
      if (!isTodoChip(chipId)) return null;
      const todoId = unwrapTodoChipId(chipId);
      return (
        rangeTodoChips.find((c) => c.id === todoId) ??
        todayTodoChips.find((c) => c.id === todoId) ??
        null
      );
    },
    [rangeTodoChips, todayTodoChips],
  );

  /*
   * A-2 (#297) / #562 / #569: the todo-chip writes.
   *
   * What each gesture writes — the patch AND whether it lands on the undo stack
   * — lives in todoChipUndoWiring.ts, not here. These handlers keep what is
   * actually the host's: unwrapping the synthetic chip id, finding the todo,
   * and calling updateNode (which is optimistic — the chip re-derives at its
   * new position with no manual patch, closing Schedule AC10).
   */
  const handleTodoChipMove = useCallback(
    (chipId: string, dateISO: string, startISO: string, endISO: string) => {
      const todoId = unwrapTodoChipId(chipId);
      const { patch, options } = todoChipMoveWrite(
        todoNodes.find((n) => n.id === todoId),
        dateISO,
        startISO,
        endISO,
      );
      updateNode(todoId, patch, options);
    },
    [todoNodes, updateNode],
  );

  const handleTodoChipResize = useCallback(
    (chipId: string, endISO: string) => {
      const todoId = unwrapTodoChipId(chipId);
      // null = the todo has no usable start, so there is no day to anchor the
      // new end to (see todoChipResizeWrite).
      const write = todoChipResizeWrite(
        todoNodes.find((n) => n.id === todoId),
        endISO,
      );
      if (!write) return;
      updateNode(todoId, write.patch, write.options);
    },
    [todoNodes, updateNode],
  );

  const handleTodoChipDropAllDay = useCallback(
    (chipId: string, dateISO: string) => {
      const { patch, options } = todoChipAllDayWrite(dateISO);
      updateNode(unwrapTodoChipId(chipId), patch, options);
    },
    [updateNode],
  );

  // A-3 (#298) Today's Todo tray. Completion routes to the TodoTree status API
  // (the tray owns no completion state of its own); a plain binary toggle, not
  // the 3-state cycle (NOT_STARTED ↔ DONE).
  const handleTodoToggleComplete = useCallback(
    (todoId: string) => {
      const todo = todoNodes.find((n) => n.id === todoId);
      setTodoStatus(todoId, todo?.status === "DONE" ? "NOT_STARTED" : "DONE");
    },
    [todoNodes, setTodoStatus],
  );

  // "Move to today" (the write itself is in todoChipUndoWiring.ts). #569 made
  // it undoable: it is a single button press with no gesture to reverse it,
  // and the "other" list drops the todo the moment it moves, so a mis-tap left
  // the user hunting for the row to put it back by hand. #1406: a row that
  // already has a time on another day keeps that time — only the day changes.
  const handleTodoAddCandidate = useCallback(
    (todoId: string) => {
      const { patch, options } = todoMoveToTodayWrite(
        todoNodes.find((n) => n.id === todoId),
        today,
      );
      updateNode(todoId, patch, options);
    },
    [todoNodes, today, updateNode],
  );

  // "Take off today" (#1406) — the reverse press on a today row. The write
  // clears the day (see todoMoveOutWrite for why it cannot keep the time).
  const handleTodoMoveOut = useCallback(
    (todoId: string) => {
      const { patch, options } = todoMoveOutWrite();
      updateNode(todoId, patch, options);
    },
    [updateNode],
  );

  // #573 (#555 follow-up): softDelete cascades through the subtree and both
  // recovery routes are weak (undo clears on section unmount; Trash restores
  // one row at a time), so a row with children confirms first. Leaves keep
  // the one-click delete. Guards the tray AND the todo-chip bubble (same
  // write); #707 moved the question in-app.
  const handleTodoDelete = useCallback(
    (id: string) => {
      const cascade = todoDeleteCascade(todoNodes, id);
      if (!cascade) {
        softDeleteTodo(id);
        return;
      }
      void askConfirm({
        message: copy.cascadeConfirm(cascade.title, cascade.childCount),
        confirmLabel: copy.confirmLabel,
        cancelLabel: copy.cancelLabel,
        danger: true,
      }).then((ok) => {
        if (ok) softDeleteTodo(id);
      });
    },
    [todoNodes, softDeleteTodo, askConfirm, copy],
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
      void confirmTodoDetailDelete(todoNodes, id, askConfirm, copy).then(
        (ok) => {
          if (!ok) return;
          setTodoDetailId(null);
          softDeleteTodo(id);
        },
      );
    },
    [todoNodes, softDeleteTodo, askConfirm, copy],
  );

  return {
    rangeTodoChips,
    todayTodoChips,
    todoPlaced,
    todoUnplaced,
    todoAddable,
    findTodoChip,
    todoDetailId,
    setTodoDetailId,
    handleTodoChipMove,
    handleTodoChipResize,
    handleTodoChipDropAllDay,
    handleTodoToggleComplete,
    handleTodoAddCandidate,
    handleTodoMoveOut,
    handleTodoDelete,
    handleTodoDetailDelete,
  };
}

/** "2026-09-05" → "9/5": the day a row is parked on, as the tray prints it. */
function shortDate(dateKey: string): string {
  const [, m, d] = dateKey.split("-");
  return `${Number(m)}/${Number(d)}`;
}
