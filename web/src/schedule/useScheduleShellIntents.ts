import { useEffect } from "react";

/*
 * The shell's four intents into the Schedule (#503 / #1153), extracted from
 * CalendarTab by #1642 P2: "open this event", "show the todo tray", "make a
 * new todo" and "open this todo". Each arrives as a pending PROP and is
 * consumed once, so coming back to the section later never re-fires it.
 *
 * All four are setStates in an effect — the shape the cascading-render rule
 * (react-hooks/set-state-in-effect) exists to catch. They are deliberate: they
 * fire once per arrival (a user navigating from the palette or the shell, not
 * a render loop), and the intent exists only as a prop, so there is no event
 * handler to move them into. The rule only sees LOCAL useState setters, and
 * every setter here arrives from another hook, so there is nothing for it to
 * report and no directive to suppress it.
 *
 * The one piece of local state an intent moves — the create dialog opening on
 * global:new-task — is not here: useTodoAddDialog adjusts it while rendering.
 */

export interface ScheduleShellIntents {
  /**
   * "Open this event" from the command palette (#503) — plus the date: the
   * grid shows one window at a time, so an id alone would select a row that
   * is not on screen.
   */
  pendingSelectEvent?: { id: string; date: string } | null;
  onConsumePendingEvent?: () => void;
  /** global:new-task — open the tray (the dialog is useTodoAddDialog's). */
  pendingNewTodo: boolean;
  onConsumeNewTodo?: () => void;
  /** A todo to open, from a "[[" link click or the palette (#370 / #507). */
  pendingSelectTodoId: string | null;
  onConsumePendingSelect?: () => void;
  /** nav:tasks — just show the tray. */
  pendingTodoTray: boolean;
  onConsumeTodoTray?: () => void;
}

export interface ScheduleShellIntentTargets {
  /** #520: clears whatever is filtering the grid. */
  revealOnGrid: () => void;
  setAnchorDate: (key: string) => void;
  setSelectedId: (id: string | null) => void;
  setSidebarTab: (tab: "flow" | "todo" | "repeats") => void;
  /** Undefined outside the shell's RightSidebar Provider. */
  openSidebar: (() => void) | undefined;
  setTodoDetailId: (id: string | null) => void;
}

export function useScheduleShellIntents(
  {
    pendingSelectEvent,
    onConsumePendingEvent,
    pendingNewTodo,
    onConsumeNewTodo,
    pendingSelectTodoId,
    onConsumePendingSelect,
    pendingTodoTray,
    onConsumeTodoTray,
  }: ScheduleShellIntents,
  {
    revealOnGrid,
    setAnchorDate,
    setSelectedId,
    setSidebarTab,
    openSidebar,
    setTodoDetailId,
  }: ScheduleShellIntentTargets,
): void {
  /*
   * Palette "open this event" intent (#503). Three moves, in this order: clear
   * whatever is filtering the grid (#520), put the event's day in the window,
   * then select it. The row itself may not be in the range for another moment
   * — the anchor change triggers the fetch and nothing pre-loads outside the
   * window — but selection is by id, so it simply starts showing once the
   * range lands.
   *
   * #467 retired the Mobile month agenda and the separate `mobileSelectedDay`
   * it read, so the anchor is now the only day either layout draws from —
   * moving it is the whole job.
   *
   * `setSelectedId` is in the deps and is inert: it is React's own useState
   * dispatch, handed straight out of a hook, so it never changes identity —
   * exhaustive-deps simply cannot prove that through a custom hook.
   */
  useEffect(() => {
    if (!pendingSelectEvent) return;
    revealOnGrid();
    setAnchorDate(pendingSelectEvent.date);
    setSelectedId(pendingSelectEvent.id);
    onConsumePendingEvent?.();
  }, [
    pendingSelectEvent,
    setAnchorDate,
    onConsumePendingEvent,
    revealOnGrid,
    setSelectedId,
  ]);

  /*
   * #1153: the todo intents. The two tray ones open the tray rather than only
   * switching state, because on narrow the sidebar is a drawer: setting the
   * tab of a panel nobody can see would make them read as doing nothing.
   */
  useEffect(() => {
    if (!pendingTodoTray) return;
    setSidebarTab("todo");
    openSidebar?.();
    onConsumeTodoTray?.();
  }, [onConsumeTodoTray, openSidebar, pendingTodoTray, setSidebarTab]);

  useEffect(() => {
    if (!pendingNewTodo) return;
    setSidebarTab("todo");
    openSidebar?.();
    onConsumeNewTodo?.();
  }, [onConsumeNewTodo, openSidebar, pendingNewTodo, setSidebarTab]);

  useEffect(() => {
    if (!pendingSelectTodoId) return;
    // The detail is an overlay, not a tab, so this one does not touch the
    // sidebar: a "[[" click asks for one todo, not for the list.
    setTodoDetailId(pendingSelectTodoId);
    onConsumePendingSelect?.();
  }, [onConsumePendingSelect, pendingSelectTodoId, setTodoDetailId]);
}
