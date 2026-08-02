import type { DataService } from "@life-editor/shared";
import { RoutineScheduleSync } from "./RoutineScheduleSync";
import { CalendarTab } from "./CalendarTab";
import { KanbanView } from "../tasks/KanbanView";

/*
 * Schedule section host (target IA). #408 retired the Routines header tab —
 * repeat settings live in the Calendar item editor, with the rightSidebar
 * "繰り返し" tab as the route to routines whose occurrences are not on screen
 * — and #411 put a tab band back for a different pair: Calendar / Todo. The
 * Todo board came from Materials so that the list and the calendar it gets
 * scheduled onto sit in one section (Epic #290). The section chrome is the
 * standard SectionHeader in AppShell's header slot, owned by MainScreen.
 *
 * The headless RoutineScheduleSync stays mounted here (verbatim from the old
 * MainScreen schedule block) so the Routine→schedule_items generator keeps
 * running while the user moves between tabs. DataService is injected (§6.4)
 * and only reaches the shared hooks through the domain Providers MainScreen
 * wraps around this screen — including the TaskTree + WikiTags pair the Kanban
 * needs, which the calendar was already using for its task chips.
 */
export type ScheduleTab = "calendar" | "todo";

export function ScheduleScreen({
  dataService,
  tab,
  onOpenTasks,
  pendingNewTask,
  onConsumeNewTask,
  pendingSelectTaskId,
  onConsumePendingSelect,
  pendingSelectEvent,
  onConsumePendingEvent,
  onNavigateToItem,
}: {
  dataService: DataService;
  tab: ScheduleTab;
  /** Open the Todo tab (A-3 tray title click → the full board). */
  onOpenTasks: () => void;
  /** Shell "new task" intent, forwarded to the board (see KanbanViewProps). */
  pendingNewTask?: boolean;
  onConsumeNewTask?: () => void;
  /** A task to open, arrived from a "[[" link click (#370). */
  pendingSelectTaskId?: string | null;
  onConsumePendingSelect?: () => void;
  /** An event to open, arrived from a palette search hit (#503). */
  pendingSelectEvent?: { id: string; date: string } | null;
  onConsumePendingEvent?: () => void;
  /**
   * Navigate to a "[[" link target from the task body (#507) — the board needs
   * it for the same reason Notes and Daily do: only MainScreen knows how to
   * switch section + tab.
   */
  onNavigateToItem?: (target: { id: string; role: string }) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Headless generator — mount continuity (Issue: infinite-loop history in
          RoutineScheduleSync.tsx). Renders nothing. */}
      <RoutineScheduleSync dataService={dataService} />
      {tab === "calendar" ? (
        <CalendarTab
          dataService={dataService}
          onOpenTasks={onOpenTasks}
          pendingSelectEvent={pendingSelectEvent}
          onConsumePendingEvent={onConsumePendingEvent}
        />
      ) : (
        // Bare flex box, no padding: PageContainer is on "fluid" for this
        // section and the board already owns its own gutter + h-full layout
        // (KanbanView.tsx:450) exactly as it did under Materials. All this adds
        // is the flex-1 slot, since here it has the RoutineScheduleSync sibling.
        <div className="flex min-h-0 flex-1 flex-col">
          <KanbanView
            pendingNewTask={pendingNewTask}
            onConsumeNewTask={onConsumeNewTask}
            pendingSelectTaskId={pendingSelectTaskId}
            onConsumePendingSelect={onConsumePendingSelect}
            dataService={dataService}
            onNavigateToItem={onNavigateToItem}
          />
        </div>
      )}
    </div>
  );
}
