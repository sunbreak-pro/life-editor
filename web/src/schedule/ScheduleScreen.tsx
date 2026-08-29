import type { DataService } from "@life-editor/shared";
import { RoutineScheduleSync } from "./RoutineScheduleSync";
import { CalendarTab } from "./CalendarTab";

/*
 * Schedule section host.
 *
 * ONE surface again since #1153. #408 retired the Routines header tab (repeat
 * settings moved into the item editor, with the rightSidebar "繰り返し" tab as
 * the route to routines whose occurrences are off screen) and #411 put a band
 * back for Calendar / Todo — the Kanban having come over from Materials so the
 * list and the calendar it gets scheduled onto sat in one section (Epic #290).
 *
 * #1153 finished that move rather than reversing it: the board is retired and
 * what the daily loop actually used — "which of these am I doing today" — is
 * the rightSidebar tray, which was already there. So the section has no band,
 * and this file is the mount point for the two things that must not be tied to
 * a tab: the calendar and the generator.
 *
 * The headless RoutineScheduleSync stays mounted here (verbatim from the old
 * MainScreen schedule block) so the Routine→schedule_items generator keeps
 * running. DataService is injected (§6.4) and only reaches the shared hooks
 * through the domain Providers MainScreen wraps around this screen — including
 * the TodoTree + WikiTags pair, which the calendar was already using for its
 * todo chips and which the tray and the todo detail now read too.
 *
 * The four pending-intent props are the shell's todo entries (#1153). They used
 * to be consumed by the Kanban; they pass straight through to CalendarTab,
 * which owns the sidebar and the detail overlay they address.
 */
export function ScheduleScreen({
  dataService,
  pendingNewTodo,
  onConsumeNewTodo,
  pendingTodoTray,
  onConsumeTodoTray,
  pendingSelectTodoId,
  onConsumePendingSelect,
  pendingSelectEvent,
  onConsumePendingEvent,
  onNavigateToItem,
}: {
  dataService: DataService;
  /** Shell "new todo" intent (global:new-task). */
  pendingNewTodo?: boolean;
  onConsumeNewTodo?: () => void;
  /** Shell "show me my todos" intent (nav:tasks). */
  pendingTodoTray?: boolean;
  onConsumeTodoTray?: () => void;
  /** A todo to open, arrived from a "[[" link click (#370). */
  pendingSelectTodoId?: string | null;
  onConsumePendingSelect?: () => void;
  /** An event to open, arrived from a palette search hit (#503). */
  pendingSelectEvent?: { id: string; date: string } | null;
  onConsumePendingEvent?: () => void;
  /**
   * Navigate to a "[[" link target from a todo body (#507) — the detail needs
   * it for the same reason Notes and Daily do: only MainScreen knows how to
   * switch sections.
   */
  onNavigateToItem?: (target: { id: string; role: string }) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Headless generator — mount continuity (Issue: infinite-loop history in
          RoutineScheduleSync.tsx). Renders nothing. */}
      <RoutineScheduleSync dataService={dataService} />
      <CalendarTab
        dataService={dataService}
        pendingNewTodo={pendingNewTodo}
        onConsumeNewTodo={onConsumeNewTodo}
        pendingTodoTray={pendingTodoTray}
        onConsumeTodoTray={onConsumeTodoTray}
        pendingSelectTodoId={pendingSelectTodoId}
        onConsumePendingSelect={onConsumePendingSelect}
        pendingSelectEvent={pendingSelectEvent}
        onConsumePendingEvent={onConsumePendingEvent}
        onNavigateToItem={onNavigateToItem}
      />
    </div>
  );
}
