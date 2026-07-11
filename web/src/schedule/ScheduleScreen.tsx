import { useState } from "react";
import {
  useTranslation,
  useMediaQuery,
  HeaderTabs,
  RightSidebarToggle,
  type DataService,
} from "@life-editor/shared";
import { RoutineScheduleSync } from "./RoutineScheduleSync";
import { CalendarTab } from "./CalendarTab";
import { RoutinesTab } from "./RoutinesTab";

/*
 * Schedule section host (target IA). Owns the section chrome: a Calendar /
 * Routines tab row (Desktop) with the rightSidebar toggle pinned to its right
 * (the same "screen owns the tab row" pattern MainScreen uses for Materials),
 * and the Mobile single-screen Calendar (Routines is Desktop-only — brief §3).
 *
 * The headless RoutineScheduleSync stays mounted here (verbatim from the old
 * MainScreen schedule block) so the Routine→schedule_items generator keeps
 * running while the user moves between tabs. DataService is injected (§6.4) and
 * only reaches the shared hooks through the domain Providers MainScreen wraps
 * around this screen.
 */
type ScheduleTab = "calendar" | "routines";

export function ScheduleScreen({ dataService }: { dataService: DataService }) {
  const { t } = useTranslation();
  const isWide = useMediaQuery("(min-width: 768px)", true);
  const [activeTab, setActiveTab] = useState<ScheduleTab>("calendar");

  // Routines is a Desktop-only tab (brief §3); narrow always shows Calendar.
  const tab: ScheduleTab = isWide ? activeTab : "calendar";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Headless generator — mount continuity (Issue: infinite-loop history in
          RoutineScheduleSync.tsx). Renders nothing. */}
      <RoutineScheduleSync dataService={dataService} />

      {/* Standard page gutter tokens (#180) — px-based, so the tab band's
          left offset matches PageContainer's header slot even when the root
          font-size scales (rem-based px-4/px-6 drifts at non-16px roots). */}
      {isWide && (
        <div className="shrink-0 px-lumen-gutter pt-3 md:px-lumen-gutter-wide">
          <HeaderTabs
            tabs={[
              { id: "calendar", label: t("scheduleScreen.calendar") },
              { id: "routines", label: t("scheduleScreen.routines") },
            ]}
            activeTab={activeTab}
            onSelect={(id) => setActiveTab(id as ScheduleTab)}
            label={t("section.schedule", { defaultValue: "Schedule" })}
            trailing={
              <RightSidebarToggle
                variant="panel"
                openLabel={t("scheduleScreen.openPanel")}
                closeLabel={t("scheduleScreen.closePanel")}
              />
            }
          />
        </div>
      )}

      {tab === "calendar" ? (
        <CalendarTab onOpenRoutines={() => setActiveTab("routines")} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3 md:px-6">
          <RoutinesTab />
        </div>
      )}
    </div>
  );
}
