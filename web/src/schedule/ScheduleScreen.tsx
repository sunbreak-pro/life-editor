import { useMediaQuery, type DataService } from "@life-editor/shared";
import { RoutineScheduleSync } from "./RoutineScheduleSync";
import { CalendarTab } from "./CalendarTab";
import { RoutinesTab } from "./RoutinesTab";

/*
 * Schedule section host (target IA). Since the v2 adoption pass the section
 * chrome lives in the standard SectionHeader (AppShell header slot): MainScreen
 * owns the Calendar / Routines tab state and renders the tab band + the
 * rightSidebar toggle there (the same pattern Materials uses — the band
 * doubles as the section title, Layout Standard v2 §1). This host only renders
 * the active tab body; on the narrow layout the header slot doesn't exist and
 * Routines is Desktop-only (brief §3), so narrow always shows Calendar.
 *
 * The headless RoutineScheduleSync stays mounted here (verbatim from the old
 * MainScreen schedule block) so the Routine→schedule_items generator keeps
 * running while the user moves between tabs. DataService is injected (§6.4) and
 * only reaches the shared hooks through the domain Providers MainScreen wraps
 * around this screen.
 */
export type ScheduleTab = "calendar" | "routines";

export function ScheduleScreen({
  dataService,
  tab,
  onTabChange,
}: {
  dataService: DataService;
  tab: ScheduleTab;
  onTabChange: (tab: ScheduleTab) => void;
}) {
  const isWide = useMediaQuery("(min-width: 768px)", true);

  // Routines is a Desktop-only tab (brief §3); narrow always shows Calendar.
  const effTab: ScheduleTab = isWide ? tab : "calendar";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Headless generator — mount continuity (Issue: infinite-loop history in
          RoutineScheduleSync.tsx). Renders nothing. */}
      <RoutineScheduleSync dataService={dataService} />

      {effTab === "calendar" ? (
        <CalendarTab
          dataService={dataService}
          onOpenRoutines={() => onTabChange("routines")}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-lumen-gutter pb-4 pt-3 md:px-lumen-gutter-wide">
          <RoutinesTab />
        </div>
      )}
    </div>
  );
}
