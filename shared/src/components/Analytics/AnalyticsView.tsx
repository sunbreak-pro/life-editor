import { useMemo, useState } from "react";
import type { TimerSession } from "../../types/timer";
import type { TaskNode } from "../../types/taskTree";
import type { ScheduleItem } from "../../types/schedule";
import type { NoteNode } from "../../types/note";
import type { RoutineNode } from "../../types/routine";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { HeaderTabs, type HeaderTab } from "../HeaderTabs";
import {
  AnalyticsFilterProvider,
  useAnalyticsFilter,
  type DateRange,
} from "./AnalyticsFilterContext";
import { DateRangePresetSelector } from "./DateRangePresetSelector";
import { OverviewTab } from "./OverviewTab";
import { TasksTab } from "./TasksTab";
import { TimeTab } from "./TimeTab";
import { ScheduleTab } from "./ScheduleTab";
import { MobileAnalyticsView } from "./MobileAnalyticsView";
import type { AnalyticsLabels } from "./labels";

/*
 * W4 Analytics — shared presentational dashboard root (design-analytics-v2).
 * PURE PRESENTATION: every string arrives via the typed `labels` object and
 * every dataset arrives as props (CLAUDE.md §6.4 — no useTranslation /
 * getDataService here). Desktop (≥768px) = the 4-tab dashboard with the header
 * date-range preset pills + shell-standard underline HeaderTabs; Mobile
 * (<768px) = a single Consumption scroll (MobileAnalyticsView). The former
 * accent-filled tab pills and the per-chart visibility sidebar are dropped.
 */

export type AnalyticsTab = "overview" | "tasks" | "work" | "schedule";

const TAB_ORDER: readonly AnalyticsTab[] = [
  "overview",
  "tasks",
  "work",
  "schedule",
];

export interface AnalyticsViewProps {
  sessions: TimerSession[];
  nodes: TaskNode[];
  /** Schedule items for today only (Overview stat cards). */
  todayItems: ScheduleItem[];
  /**
   * Schedule items for the currently selected date range. The host fetches
   * exactly this window (see `onScheduleRangeChange`); the Schedule tab still
   * filters in-memory as a safety net so the selected range stays the single
   * source of truth.
   */
  scheduleItems: ScheduleItem[];
  /**
   * Called whenever the selected analytics date range changes (incl. initial
   * mount). Hosts use it to (re)fetch schedule items for exactly that window
   * (per-range fetch). Optional so hosts that pre-load a wide window keep
   * compiling and working unchanged.
   */
  onScheduleRangeChange?: (range: DateRange) => void;
  /** True while the host is (re)fetching schedule items for the range. */
  scheduleLoading?: boolean;
  /**
   * True while the host's initial (mount) fetch is in flight. Drives the
   * first-load skeleton so the dashboard lays out its frame instead of
   * flashing zeros before the data lands.
   */
  initialLoading?: boolean;
  notes: NoteNode[];
  routines: RoutineNode[];
  /** Pre-built taskId → display name map (Work tab task chart). */
  taskNameMap: Map<string, string>;
  /** Total active tag count (Overview). */
  tagCount: number;
  /** Total active tag-assignment count (Overview). */
  assignmentCount: number;
  /** Pomodoro daily target (Work tab; host: fetchTimerSettings().targetSessions). */
  targetPerDay: number;
  labels: AnalyticsLabels;
}

export function AnalyticsView(props: AnalyticsViewProps): React.JSX.Element {
  const isWide = useMediaQuery("(min-width: 768px)");

  return (
    <AnalyticsFilterProvider onDateRangeChange={props.onScheduleRangeChange}>
      {isWide ? (
        <DesktopAnalytics {...props} />
      ) : (
        <MobileAnalyticsView
          sessions={props.sessions}
          nodes={props.nodes}
          todayItems={props.todayItems}
          scheduleItems={props.scheduleItems}
          notes={props.notes}
          routines={props.routines}
          loading={props.initialLoading ?? false}
          labels={props.labels}
        />
      )}
    </AnalyticsFilterProvider>
  );
}

function DesktopAnalytics({
  sessions,
  nodes,
  todayItems,
  scheduleItems,
  scheduleLoading,
  initialLoading,
  notes,
  routines,
  taskNameMap,
  tagCount,
  assignmentCount,
  targetPerDay,
  labels,
}: AnalyticsViewProps): React.JSX.Element {
  const { preset, applyPreset } = useAnalyticsFilter();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");

  const tabs = useMemo<HeaderTab[]>(
    () => TAB_ORDER.map((tab) => ({ id: tab, label: labels.tabs[tab] })),
    [labels.tabs],
  );

  return (
    <div className="flex h-full flex-col">
      {/* In-body chrome (v2 §1 adoption): the shell SectionHeader owns the
          section title, so the old h2 row is gone — the date-range presets
          ride the tab band's trailing slot. Moving the tab band itself into
          the header row needs a shell tabs slot for analytics
          (layout-standard lane). */}
      <div className="flex-shrink-0 px-lumen-gutter pt-3 md:px-lumen-gutter-wide md:pt-4">
        <HeaderTabs
          tabs={tabs}
          activeTab={activeTab}
          onSelect={(id) => setActiveTab(id as AnalyticsTab)}
          label={labels.tabsLabel}
          trailing={
            <DateRangePresetSelector
              value={preset}
              onChange={applyPreset}
              label={labels.datePreset.label}
              options={labels.datePreset.options}
            />
          }
        />
      </div>

      {/* Content: centered max-w-lumen-data column */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-lumen-gutter py-4 md:px-lumen-gutter-wide md:py-6">
        <div className="mx-auto w-full max-w-lumen-data">
          {initialLoading ? (
            <DesktopSkeleton />
          ) : (
            <>
              {activeTab === "overview" && (
                <OverviewTab
                  sessions={sessions}
                  nodes={nodes}
                  todayItems={todayItems}
                  notes={notes}
                  routines={routines}
                  tagCount={tagCount}
                  assignmentCount={assignmentCount}
                  labels={{
                    tasks: labels.overview.tasks,
                    events: labels.overview.events,
                    notes: labels.overview.notes,
                    work: labels.overview.work,
                    routines: labels.overview.routines,
                    tags: labels.overview.tags,
                    completed: labels.overview.completed,
                    today: labels.overview.today,
                    rate: labels.overview.rate,
                    thisWeek: labels.overview.thisWeek,
                    assigned: labels.overview.assigned,
                    formatHours: labels.formatHours,
                    todayCard: {
                      title: labels.todayCard.title,
                      workTime: labels.todayCard.workTime,
                      completedTasks: labels.todayCard.completedTasks,
                      pomodoroCount: labels.todayCard.pomodoroCount,
                      formatHours: labels.formatHours,
                    },
                    weekly: {
                      title: labels.weekly.title,
                      workTimeLabel: labels.weekly.workTimeLabel,
                      sessionsLabel: labels.weekly.sessionsLabel,
                      completedLabel: labels.weekly.completedLabel,
                      formatHours: labels.formatHours,
                    },
                    streak: labels.streak,
                  }}
                />
              )}

              {activeTab === "tasks" && (
                <TasksTab
                  sessions={sessions}
                  nodes={nodes}
                  labels={{
                    taskTrend: labels.taskTrend,
                    stagnation: labels.stagnation,
                    projectTime: {
                      title: labels.projectTime.title,
                      noData: labels.projectTime.noData,
                      formatHours: labels.formatHours,
                    },
                  }}
                />
              )}

              {activeTab === "work" && (
                <TimeTab
                  sessions={sessions}
                  taskNameMap={taskNameMap}
                  targetPerDay={targetPerDay}
                  labels={{
                    totalWorkTime: labels.totalWorkTime,
                    sessions: labels.sessions,
                    avgPerDay: labels.avgPerDay,
                    workTime: labels.workTime,
                    empty: labels.emptyWork,
                    formatHours: labels.formatHours,
                    period: labels.period,
                    workTimeChart: { workTime: labels.workTime },
                    heatmap: labels.heatmap,
                    pomodoroRate: labels.pomodoroRate,
                    workBreak: labels.workBreak,
                    timeline: {
                      title: labels.timeline.title,
                      noSessions: labels.timeline.noSessions,
                      work: labels.workBreak.work,
                      break: labels.workBreak.break,
                      longBreak: labels.workBreak.longBreak,
                    },
                    taskWorkTime: {
                      title: labels.taskWorkTime,
                      sessions: labels.sessions,
                    },
                  }}
                />
              )}

              {activeTab === "schedule" && (
                <ScheduleTab
                  scheduleItems={scheduleItems}
                  routines={routines}
                  loading={scheduleLoading}
                  labels={{
                    totalEvents: labels.schedule.totalEvents,
                    completedEvents: labels.schedule.completedEvents,
                    completionRate: labels.schedule.completionRate,
                    activeRoutines: labels.schedule.activeRoutines,
                    routineRate: labels.schedule.routineRate,
                    empty: labels.emptySchedule,
                    eventTrend: labels.schedule.eventTrend,
                    timeDistribution: labels.schedule.timeDistribution,
                    routineCompletion: labels.schedule.routineCompletion,
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* First-load skeleton (design 1j): stat frame + chart frame, no zero flash. */
function DesktopSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[86px] animate-pulse rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary"
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary"
          />
        ))}
      </div>
    </div>
  );
}
