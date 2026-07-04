import { useMemo } from "react";
import {
  BarChart3,
  CalendarCheck2,
  Clock,
  RefreshCw,
  Tag,
  FileText,
} from "lucide-react";
import type { TimerSession } from "../../types/timer";
import type { TaskNode } from "../../types/taskTree";
import type { ScheduleItem } from "../../types/schedule";
import type { NoteNode } from "../../types/note";
import type { RoutineNode } from "../../types/routine";
import { formatDateKey } from "../../utils/dateKey";
import {
  computeSummary,
  getWorkSessions,
} from "../../utils/analyticsAggregation";
import { AnalyticsStatCard } from "./AnalyticsStatCard";
import { TodayDashboard, type TodayDashboardLabels } from "./TodayDashboard";
import { WeeklySummary, type WeeklySummaryLabels } from "./WeeklySummary";
import { StreakDisplay, type StreakDisplayLabels } from "./StreakDisplay";

export interface OverviewTabLabels {
  /** Stat-card titles. */
  tasks: string;
  events: string;
  notes: string;
  work: string;
  routines: string;
  tags: string;
  /** Stat-card subtitle words. */
  completed: string;
  today: string;
  rate: string;
  thisWeek: string;
  assigned: string;
  formatHours: (minutes: number) => string;
  todayCard: TodayDashboardLabels;
  weekly: WeeklySummaryLabels;
  streak: StreakDisplayLabels;
}

interface OverviewTabProps {
  sessions: TimerSession[];
  nodes: TaskNode[];
  /** Schedule items for today (host: fetchScheduleItemsByDateRange today,today). */
  todayItems: ScheduleItem[];
  notes: NoteNode[];
  routines: RoutineNode[];
  tagCount: number;
  assignmentCount: number;
  labels: OverviewTabLabels;
}

export function OverviewTab({
  sessions,
  nodes,
  todayItems,
  notes,
  routines,
  tagCount,
  assignmentCount,
  labels,
}: OverviewTabProps): React.JSX.Element {
  const stats = useMemo(() => {
    // Tasks
    const tasks = nodes.filter((n) => n.type === "task");
    const completedTasks = tasks.filter((n) => n.status === "DONE");
    const taskRate =
      tasks.length > 0
        ? Math.round((completedTasks.length / tasks.length) * 100)
        : 0;

    // Events (today)
    const todayCompleted = todayItems.filter((i) => i.completed);

    // Notes
    const activeNotes = notes.filter((n) => !n.isDeleted && n.type === "note");
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = formatDateKey(weekAgo);
    const notesThisWeek = activeNotes.filter(
      (n) => n.createdAt.substring(0, 10) >= weekAgoStr,
    );

    // Work
    const summary = computeSummary(sessions);
    const todayStr = formatDateKey(now);
    const todayWork = getWorkSessions(sessions).filter(
      (s) => formatDateKey(new Date(s.startedAt)) === todayStr,
    );
    const todayMinutes = todayWork.reduce(
      (sum, s) => sum + (s.duration ?? 0) / 60,
      0,
    );

    // Routines
    const activeRoutines = routines.filter(
      (r) => !r.isArchived && !r.isDeleted,
    );
    const routineItems = todayItems.filter((i) => i.routineId);
    const routineCompleted = routineItems.filter((i) => i.completed);
    const routineRate =
      routineItems.length > 0
        ? Math.round((routineCompleted.length / routineItems.length) * 100)
        : 0;

    return {
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      taskRate,
      todayEvents: todayItems.length,
      todayEventsCompleted: todayCompleted.length,
      totalNotes: activeNotes.length,
      notesThisWeek: notesThisWeek.length,
      totalWorkTime: labels.formatHours(summary.totalMinutes),
      todayWorkTime: labels.formatHours(todayMinutes),
      activeRoutines: activeRoutines.length,
      routineRate,
      totalTags: tagCount,
      totalAssignments: assignmentCount,
    };
  }, [
    nodes,
    todayItems,
    notes,
    sessions,
    routines,
    tagCount,
    assignmentCount,
    labels,
  ]);

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      {/* Multi-domain stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <AnalyticsStatCard
          icon={<BarChart3 size={20} />}
          label={labels.tasks}
          value={stats.totalTasks}
          color="text-lumen-accent"
          subtitle={`${stats.completedTasks} ${labels.completed} (${stats.taskRate}%)`}
        />
        <AnalyticsStatCard
          icon={<CalendarCheck2 size={20} />}
          label={labels.events}
          value={stats.todayEvents}
          color="text-lumen-accent"
          subtitle={`${stats.todayEventsCompleted} ${labels.completed} ${labels.today}`}
        />
        <AnalyticsStatCard
          icon={<FileText size={20} />}
          label={labels.notes}
          value={stats.totalNotes}
          color="text-purple-500"
          subtitle={`+${stats.notesThisWeek} ${labels.thisWeek}`}
        />
        <AnalyticsStatCard
          icon={<Clock size={20} />}
          label={labels.work}
          value={stats.totalWorkTime}
          color="text-orange-500"
          subtitle={`${stats.todayWorkTime} ${labels.today}`}
        />
        <AnalyticsStatCard
          icon={<RefreshCw size={20} />}
          label={labels.routines}
          value={stats.activeRoutines}
          color="text-lumen-success"
          subtitle={`${stats.routineRate}% ${labels.rate}`}
        />
        <AnalyticsStatCard
          icon={<Tag size={20} />}
          label={labels.tags}
          value={stats.totalTags}
          color="text-yellow-500"
          subtitle={`${stats.totalAssignments} ${labels.assigned}`}
        />
      </div>

      {/* Today Dashboard */}
      <TodayDashboard
        sessions={sessions}
        nodes={nodes}
        labels={labels.todayCard}
      />

      {/* Weekly Summary */}
      <WeeklySummary sessions={sessions} nodes={nodes} labels={labels.weekly} />

      {/* Streak Display */}
      <StreakDisplay sessions={sessions} labels={labels.streak} />
    </div>
  );
}
