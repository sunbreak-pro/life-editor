import type { DataService } from "@life-editor/shared";
import { RoutineScheduleSync } from "./RoutineScheduleSync";
import { CalendarTab } from "./CalendarTab";

/*
 * Schedule section host (target IA). Since #408 the section has a single body:
 * the Routines header tab is retired and repeat settings live in the Calendar
 * item editor, with the rightSidebar "繰り返し" tab as the route to routines
 * whose occurrences are not on screen. The section chrome is the standard
 * SectionHeader in AppShell's header slot, owned by MainScreen.
 *
 * The headless RoutineScheduleSync stays mounted here (verbatim from the old
 * MainScreen schedule block) so the Routine→schedule_items generator keeps
 * running. DataService is injected (§6.4) and only reaches the shared hooks
 * through the domain Providers MainScreen wraps around this screen.
 */
export function ScheduleScreen({
  dataService,
  onOpenTasks,
}: {
  dataService: DataService;
  /** Jump to the Tasks section (A-3 tray title click → deep edit in the tree). */
  onOpenTasks: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Headless generator — mount continuity (Issue: infinite-loop history in
          RoutineScheduleSync.tsx). Renders nothing. */}
      <RoutineScheduleSync dataService={dataService} />
      <CalendarTab dataService={dataService} onOpenTasks={onOpenTasks} />
    </div>
  );
}
