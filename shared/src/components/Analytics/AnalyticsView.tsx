import { useMemo, useState } from "react";
import type { TimerSession } from "../../types/timer";
import type { TaskNode } from "../../types/taskTree";
import type { ScheduleItem } from "../../types/schedule";
import type { NoteNode } from "../../types/note";
import type { RoutineNode } from "../../types/routine";
import { AnalyticsFilterProvider } from "./AnalyticsFilterContext";
import { OverviewTab } from "./OverviewTab";
import { TasksTab } from "./TasksTab";
import { TimeTab } from "./TimeTab";
import { ScheduleTab } from "./ScheduleTab";
import type { AnalyticsLabels } from "./labels";

/*
 * W4 Analytics — shared presentational dashboard root (lean: Overview / Tasks /
 * Work / Schedule). PURE PRESENTATION: every string arrives via the typed
 * `labels` object and every dataset arrives as props (CLAUDE.md §6.4 — no
 * useTranslation / getDataService here). The host (web AnalyticsScreen) fetches
 * the data and resolves the labels. The Materials / Connect tabs and the
 * per-chart visibility sidebar are intentionally dropped; the period selector +
 * date-range presets live in the internal AnalyticsFilterContext.
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
  /** Schedule items across the analytics window (Schedule tab filters in-memory). */
  scheduleItems: ScheduleItem[];
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
  const {
    sessions,
    nodes,
    todayItems,
    scheduleItems,
    notes,
    routines,
    taskNameMap,
    tagCount,
    assignmentCount,
    targetPerDay,
    labels,
  } = props;

  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");

  const tabLabel = useMemo<Record<AnalyticsTab, string>>(
    () => ({
      overview: labels.tabs.overview,
      tasks: labels.tabs.tasks,
      work: labels.tabs.work,
      schedule: labels.tabs.schedule,
    }),
    [labels.tabs],
  );

  return (
    <AnalyticsFilterProvider>
      <div className="flex h-full flex-col gap-4 px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-lumen-text">
            {labels.title}
          </h2>
          <div className="flex gap-1 rounded-lg border border-lumen-border bg-lumen-bg-secondary p-1">
            {TAB_ORDER.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-lumen-accent text-lumen-on-accent shadow-sm"
                    : "text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text"
                }`}
              >
                {tabLabel[tab]}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
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
                noSessions: labels.noSessions,
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
              labels={labels.schedule}
            />
          )}
        </div>
      </div>
    </AnalyticsFilterProvider>
  );
}
