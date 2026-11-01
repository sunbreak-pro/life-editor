import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  STATUS_TEXT_KEY,
  contentExcerpt,
  logServiceError,
  todoChipId,
  todoScheduleSlot,
  useTranslation,
  type DataService,
  type ScheduleItem,
  type TodoNode,
  type ToastVariant,
} from "@life-editor/shared";
import type { ScheduleLinkTarget } from "../hooks/useShellNavigation";
import type { ScheduleSidebarTodoFocus } from "./ScheduleSidebar";
import { formatTodoSchedule } from "./scheduleCopy";

/*
 * Where a LINK lands in the Schedule (#2393, Claude Design's B4): the week the
 * item's day is in, a mark on the item for about six seconds, the grid scrolled
 * to it (WeekTimeGrid's reveal, #1830), and a toast that says so. A todo also
 * appears in the right panel's Todo tab, and a todo with no day appears only
 * there.
 *
 * A separate path from useScheduleShellIntents, and it stays separate: that one
 * is "open this todo in its overlay", which Connect's side trip (#2143) is built
 * around and which the Briefing and the palette still ask for.
 *
 * The DAY is resolved here, because the inline "[[" click only knows an id and a
 * role.
 *   - A todo reads its own row, as ItemPanelHost does. That beats a day the
 *     caller passed: the chip is drawn from the row, so it is the row's day that
 *     has something to mark.
 *   - An event takes the caller's day, and otherwise looks itself up. Its rows
 *     are loaded a window at a time, so there is nothing in memory to read.
 *
 * NARROW has no week grid (#878), so there is no block to frame. The day still
 * moves, which is the month's selected cell. A todo opens the drawer on its tab,
 * and an event opens its sheet through the selection, as a tap would.
 */

/** How long the mark stays. The ring is over well before it comes off. */
export const LINK_FOCUS_MARK_MS = 6000;

export interface UseScheduleLinkFocusArgs {
  target: ScheduleLinkTarget | null;
  onConsume?: () => void;
  isWide: boolean;
  /** The live tree (soft-deleted rows already excluded). */
  todoNodes: TodoNode[];
  todosLoading: boolean;
  /** The grid's visible range: an event's mark waits for its row to land. */
  rangeItems: readonly ScheduleItem[];
  /** Reads the day of an event the caller gave no date for. */
  dataService: Pick<DataService, "fetchEvents">;
  showToast: (variant: ToastVariant, message: string) => void;
  revealOnGrid: () => void;
  setAnchorDate: (key: string) => void;
  setView: (view: string) => void;
  setSelectedId: (id: string | null) => void;
  setSidebarTab: (tab: "flow" | "todo" | "repeats") => void;
  /** Undefined outside the shell's RightSidebar Provider. */
  openSidebar: (() => void) | undefined;
  setPopover: (popover: null) => void;
  setOverlayOpen: (open: boolean) => void;
  setTodoDetailId: (id: string | null) => void;
}

export interface ScheduleLinkFocusApi {
  /** The grid id to mark (a chip id for a todo), or null. */
  markedId: string | null;
  /** The todo for the Todo tab's card, or null. */
  todoFocus: ScheduleSidebarTodoFocus | null;
}

/*
 * The state, in its own hook: the effects below set it from an intent that only
 * exists as a prop, the same deliberate shape useScheduleShellIntents' header
 * describes.
 */
function useLinkFocusState() {
  const [markedId, setMarkedId] = useState<string | null>(null);
  const [focusedTodoId, setFocusedTodoId] = useState<string | null>(null);
  // An event that has been moved to, whose row has not landed yet.
  const [arrivingEventId, setArrivingEventId] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  // A second link restarts the clock, so the new mark gets its whole six seconds.
  const mark = useCallback(
    (id: string) => {
      clearTimer();
      setMarkedId(id);
      timer.current = setTimeout(() => setMarkedId(null), LINK_FOCUS_MARK_MS);
    },
    [clearTimer],
  );
  const unmark = useCallback(() => {
    clearTimer();
    setMarkedId(null);
  }, [clearTimer]);
  useEffect(() => clearTimer, [clearTimer]);

  return {
    markedId,
    mark,
    unmark,
    focusedTodoId,
    setFocusedTodoId,
    arrivingEventId,
    setArrivingEventId,
  };
}

export function useScheduleLinkFocus({
  target,
  onConsume,
  isWide,
  todoNodes,
  todosLoading,
  rangeItems,
  dataService,
  showToast,
  revealOnGrid,
  setAnchorDate,
  setView,
  setSelectedId,
  setSidebarTab,
  openSidebar,
  setPopover,
  setOverlayOpen,
  setTodoDetailId,
}: UseScheduleLinkFocusArgs): ScheduleLinkFocusApi {
  const { t, i18n } = useTranslation();
  const {
    markedId,
    mark,
    unmark,
    focusedTodoId,
    setFocusedTodoId,
    arrivingEventId,
    setArrivingEventId,
  } = useLinkFocusState();

  const titled = useCallback(
    (title: string) => title || t("common.untitled"),
    [t],
  );

  // Whatever is on screen is about to stop being the point. A "[[" pressed
  // inside a todo's own detail arrives here with that detail still open.
  const clearSurfaces = useCallback(() => {
    setPopover(null);
    setOverlayOpen(false);
    setTodoDetailId(null);
    setSelectedId(null);
    setArrivingEventId(null);
    unmark();
  }, [
    setArrivingEventId,
    setOverlayOpen,
    setPopover,
    setSelectedId,
    setTodoDetailId,
    unmark,
  ]);

  const moveToDay = useCallback(
    (date: string) => {
      revealOnGrid();
      setAnchorDate(date);
      if (isWide) setView("week");
    },
    [isWide, revealOnGrid, setAnchorDate, setView],
  );

  const showTodo = useCallback(
    (node: TodoNode) => {
      clearSurfaces();
      setFocusedTodoId(node.id);
      setSidebarTab("todo");
      openSidebar?.();
      const title = titled(node.title);
      const slot = todoScheduleSlot(node);
      if (slot) moveToDay(slot.date);
      if (slot && isWide) {
        mark(todoChipId(node.id));
        showToast("info", t("scheduleScreen.linkFocusTodoMarked", { title }));
        return;
      }
      showToast("info", t("scheduleScreen.linkFocusTodoInPanel", { title }));
    },
    [
      clearSurfaces,
      isWide,
      mark,
      moveToDay,
      openSidebar,
      setFocusedTodoId,
      setSidebarTab,
      showToast,
      t,
      titled,
    ],
  );

  const showEvent = useCallback(
    (id: string, date: string) => {
      moveToDay(date);
      // A ring on Desktop. On narrow, the selection is what opens the sheet.
      setSelectedId(id);
      if (isWide) setArrivingEventId(id);
    },
    [isWide, moveToDay, setArrivingEventId, setSelectedId],
  );

  /*
   * The newest link's lookup is the only one allowed to land: a slow read must
   * not drag the calendar away from wherever a later link has gone.
   */
  const lookup = useRef(0);

  useEffect(() => {
    if (!target) return;
    if (target.role === "task") {
      // The tree is still arriving. An empty tree that is not "loading" can be a
      // snapshot about to be replayed (#2328), so it waits too. A tree with rows
      // has answered, and a missing todo lands on the section with nothing to show.
      if (todosLoading || todoNodes.length === 0) return;
      lookup.current += 1;
      const node = todoNodes.find((n) => n.id === target.id);
      onConsume?.();
      if (node) showTodo(node);
      return;
    }
    const seq = ++lookup.current;
    const { id, date } = target;
    onConsume?.();
    clearSurfaces();
    if (date) {
      showEvent(id, date);
      return;
    }
    dataService.fetchEvents().then(
      (events) => {
        if (seq !== lookup.current) return;
        const row = events.find((e) => e.id === id);
        if (row) showEvent(id, row.date);
      },
      (e: unknown) => {
        logServiceError("Schedule", "find the linked event's day", e);
      },
    );
  }, [
    clearSurfaces,
    dataService,
    onConsume,
    showEvent,
    showTodo,
    target,
    todoNodes,
    todosLoading,
  ]);

  // An event's mark and toast wait for its row, so the six seconds count from
  // when there is a block to look at, and the toast has a title to name.
  useEffect(() => {
    if (!arrivingEventId) return;
    const row = rangeItems.find((i) => i.id === arrivingEventId);
    if (!row) return;
    setArrivingEventId(null);
    mark(row.id);
    showToast(
      "info",
      t("scheduleScreen.linkFocusEventMarked", { title: titled(row.title) }),
    );
  }, [
    arrivingEventId,
    mark,
    rangeItems,
    setArrivingEventId,
    showToast,
    t,
    titled,
  ]);

  const focusedTodo = useMemo(
    () =>
      focusedTodoId === null
        ? null
        : (todoNodes.find((n) => n.id === focusedTodoId) ?? null),
    [focusedTodoId, todoNodes],
  );
  const todoFocus = useMemo<ScheduleSidebarTodoFocus | null>(() => {
    if (!focusedTodo) return null;
    const excerpt = contentExcerpt(focusedTodo.content ?? undefined);
    return {
      todo: {
        title: titled(focusedTodo.title),
        statusText: t(STATUS_TEXT_KEY[focusedTodo.status ?? "NOT_STARTED"]),
        scheduleText: formatTodoSchedule(
          i18n.language,
          todoScheduleSlot(focusedTodo),
          {
            allDay: t("scheduleScreen.allDay"),
            unscheduled: t("todoDetail.scheduleNone"),
          },
        ),
        ...(excerpt ? { excerpt } : {}),
      },
      onOpen: () => setTodoDetailId(focusedTodo.id),
      onDismiss: () => setFocusedTodoId(null),
    };
  }, [
    focusedTodo,
    i18n.language,
    setFocusedTodoId,
    setTodoDetailId,
    t,
    titled,
  ]);

  return { markedId, todoFocus };
}
