import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarCheck2,
  Clock,
  RefreshCw,
  Tag,
  FileText,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TimerSession } from "../../types/timer";
import type { TaskNode } from "../../types/taskTree";
import type { ScheduleItem } from "../../types/schedule";
import { useNoteContext } from "../../hooks/useNoteContext";
import { useRoutineContext } from "../../hooks/useRoutineContext";
import { useWikiTags } from "../../hooks/useWikiTags";
import { getDataService } from "../../services";
import { formatDateKey } from "../../utils/dateKey";
import {
  computeSummary,
  getWorkSessions,
} from "../../utils/analyticsAggregation";
import { AnalyticsStatCard } from "./AnalyticsStatCard";
import { TodayDashboard } from "./TodayDashboard";
import { WeeklySummary } from "./WeeklySummary";
import { StreakDisplay } from "./StreakDisplay";

interface OverviewTabProps {
  sessions: TimerSession[];
  nodes: TaskNode[];
}

export function OverviewTab({ sessions, nodes }: OverviewTabProps) {
  const { t } = useTranslation();
  const { notes } = useNoteContext();
  const { routines } = useRoutineContext();
  const { tags, assignments } = useWikiTags();
  const [todayItems, setTodayItems] = useState<ScheduleItem[]>([]);

  useEffect(() => {
    const today = formatDateKey(new Date());
    getDataService()
      .fetchScheduleItemsByDateRange(today, today)
      .then(setTodayItems);
  }, []);

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

    // Tags
    const totalAssignments = assignments.length;

    const formatHours = (minutes: number) => {
      const h = Math.floor(minutes / 60);
      const m = Math.round(minutes % 60);
      return t("analytics.hours", { hours: h, minutes: m });
    };

    return {
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      taskRate,
      todayEvents: todayItems.length,
      todayEventsCompleted: todayCompleted.length,
      totalNotes: activeNotes.length,
      notesThisWeek: notesThisWeek.length,
      totalWorkTime: formatHours(summary.totalMinutes),
      todayWorkTime: formatHours(todayMinutes),
      activeRoutines: activeRoutines.length,
      routineRate,
      totalTags: tags.length,
      totalAssignments,
    };
  }, [nodes, todayItems, notes, sessions, routines, tags, assignments, t]);

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      {/* Multi-domain stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <AnalyticsStatCard
          icon={<BarChart3 size={20} />}
          label={t("analytics.overview.tasks")}
          value={stats.totalTasks}
          color="text-notion-accent"
          subtitle={`${stats.completedTasks} ${t("analytics.overview.completed")} (${stats.taskRate}%)`}
        />
        <AnalyticsStatCard
          icon={<CalendarCheck2 size={20} />}
          label={t("analytics.overview.events")}
          value={stats.todayEvents}
          color="text-blue-500"
          subtitle={`${stats.todayEventsCompleted} ${t("analytics.overview.completed")} ${t("analytics.overview.today")}`}
        />
        <AnalyticsStatCard
          icon={<FileText size={20} />}
          label={t("analytics.overview.notes")}
          value={stats.totalNotes}
          color="text-purple-500"
          subtitle={`+${stats.notesThisWeek} ${t("analytics.overview.thisWeek")}`}
        />
        <AnalyticsStatCard
          icon={<Clock size={20} />}
          label={t("analytics.overview.work")}
          value={stats.totalWorkTime}
          color="text-orange-500"
          subtitle={`${stats.todayWorkTime} ${t("analytics.overview.today")}`}
        />
        <AnalyticsStatCard
          icon={<RefreshCw size={20} />}
          label={t("analytics.overview.routines")}
          value={stats.activeRoutines}
          color="text-notion-success"
          subtitle={`${stats.routineRate}% ${t("analytics.overview.rate")}`}
        />
        <AnalyticsStatCard
          icon={<Tag size={20} />}
          label={t("analytics.overview.tags")}
          value={stats.totalTags}
          color="text-yellow-500"
          subtitle={`${stats.totalAssignments} ${t("analytics.overview.assigned")}`}
        />
      </div>

      {/* Today Dashboard */}
      <TodayDashboard sessions={sessions} nodes={nodes} />

      {/* Weekly Summary */}
      <WeeklySummary sessions={sessions} nodes={nodes} />

      {/* Streak Display */}
      <StreakDisplay sessions={sessions} />
    </div>
  );
}
