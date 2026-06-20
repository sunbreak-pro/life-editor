import { useEffect, useMemo, useState } from "react";
import {
  AnalyticsView,
  useTranslation,
  formatDateKey,
  type DataService,
  type AnalyticsLabels,
  type TimerSession,
  type TaskNode,
  type ScheduleItem,
  type NoteNode,
  type RoutineNode,
} from "@life-editor/shared";

/*
 * Analytics host shell (W4 · lean). Mirrors the Work/Trash host pattern: the
 * host owns data fetching (it calls the injected DataService — §6.4 allows
 * hosts) and i18n `t` resolution, then injects both into the pure shared
 * <AnalyticsView>. The shared tree never calls useTranslation / getDataService.
 *
 * Data surface (only what the 4 kept tabs need): timer sessions, task tree,
 * schedule items (today + full window), routines, notes, tag/assignment counts
 * (unified API), and the pomodoro daily target from timer settings.
 *
 * Keep the call site `<AnalyticsScreen dataService={ds} />` stable (MainScreen
 * depends on it).
 */

interface AnalyticsScreenProps {
  dataService: DataService;
}

interface AnalyticsData {
  sessions: TimerSession[];
  nodes: TaskNode[];
  todayItems: ScheduleItem[];
  scheduleItems: ScheduleItem[];
  notes: NoteNode[];
  routines: RoutineNode[];
  tagCount: number;
  assignmentCount: number;
  targetPerDay: number;
}

const EMPTY: AnalyticsData = {
  sessions: [],
  nodes: [],
  todayItems: [],
  scheduleItems: [],
  notes: [],
  routines: [],
  tagCount: 0,
  assignmentCount: 0,
  targetPerDay: 4,
};

// Lower bound for the schedule window. Matches the AnalyticsFilterContext "all"
// preset (start = 2020-01-01); the Schedule tab filters this window in-memory
// by the active date-range preset.
const SCHEDULE_WINDOW_START = "2020-01-01";

function todayKey(): string {
  const d = new Date();
  return formatDateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function AnalyticsScreen({
  dataService: ds,
}: AnalyticsScreenProps): React.JSX.Element {
  const { t } = useTranslation();
  const [data, setData] = useState<AnalyticsData>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    const today = todayKey();

    void Promise.all([
      ds.fetchTimerSessions(),
      ds.fetchTaskTree(),
      ds.fetchScheduleItemsByDateRange(today, today),
      ds.fetchScheduleItemsByDateRange(SCHEDULE_WINDOW_START, today),
      ds.fetchAllRoutines(),
      ds.listNotesUnified(),
      ds.listAllWikiTagsUnified(),
      ds.listAllTagAssignments(),
      ds.fetchTimerSettings(),
    ])
      .then(
        ([
          sessions,
          nodes,
          todayItems,
          scheduleItems,
          routines,
          notes,
          tags,
          assignments,
          timerSettings,
        ]) => {
          if (cancelled) return;
          setData({
            sessions,
            nodes,
            todayItems,
            scheduleItems,
            routines,
            notes,
            tagCount: tags.length,
            assignmentCount: assignments.length,
            targetPerDay: timerSettings.targetSessions ?? 4,
          });
        },
      )
      .catch(() => {
        if (!cancelled) setData(EMPTY);
      });

    return () => {
      cancelled = true;
    };
  }, [ds]);

  const taskNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of data.nodes) {
      map.set(n.id, n.title || n.id);
    }
    return map;
  }, [data.nodes]);

  const labels = useMemo<AnalyticsLabels>(
    () => ({
      title: t("analytics.title"),
      formatHours: (minutes: number) =>
        t("analytics.hours", {
          hours: Math.floor(minutes / 60),
          minutes: Math.round(minutes % 60),
        }),
      noSessions: t("analytics.noSessions"),
      tabs: {
        overview: t("analytics.tabs.overview"),
        tasks: t("analytics.tabs.tasks"),
        schedule: t("analytics.tabs.schedule"),
        work: t("analytics.tabs.work"),
      },
      period: {
        day: t("analytics.period.day"),
        week: t("analytics.period.week"),
        month: t("analytics.period.month"),
      },
      workTime: t("analytics.workTime"),
      taskWorkTime: t("analytics.taskWorkTime"),
      totalWorkTime: t("analytics.totalWorkTime"),
      sessions: t("analytics.sessions"),
      avgPerDay: t("analytics.avgPerDay"),
      overview: {
        tasks: t("analytics.overview.tasks"),
        events: t("analytics.overview.events"),
        notes: t("analytics.overview.notes"),
        work: t("analytics.overview.work"),
        routines: t("analytics.overview.routines"),
        tags: t("analytics.overview.tags"),
        completed: t("analytics.overview.completed"),
        today: t("analytics.overview.today"),
        rate: t("analytics.overview.rate"),
        thisWeek: t("analytics.overview.thisWeek"),
        assigned: t("analytics.overview.assigned"),
      },
      todayCard: {
        title: t("analytics.today.title"),
        workTime: t("analytics.today.workTime"),
        completedTasks: t("analytics.today.completedTasks"),
        pomodoroCount: t("analytics.today.pomodoroCount"),
      },
      weekly: {
        title: t("analytics.weekly.title"),
        workTimeLabel: t("analytics.weekly.workTimeLabel"),
        sessionsLabel: t("analytics.weekly.sessionsLabel"),
        completedLabel: t("analytics.weekly.completedLabel"),
      },
      streak: {
        title: t("analytics.streak.title"),
        current: t("analytics.streak.current"),
        longest: t("analytics.streak.longest"),
        days: t("analytics.streak.days"),
        noStreak: t("analytics.streak.noStreak"),
      },
      heatmap: {
        title: t("analytics.heatmap.title"),
        days: {
          mon: t("analytics.heatmap.mon"),
          tue: t("analytics.heatmap.tue"),
          wed: t("analytics.heatmap.wed"),
          thu: t("analytics.heatmap.thu"),
          fri: t("analytics.heatmap.fri"),
          sat: t("analytics.heatmap.sat"),
          sun: t("analytics.heatmap.sun"),
        },
        tooltip: (minutes: number) =>
          t("analytics.heatmap.tooltip", { minutes }),
      },
      pomodoroRate: {
        title: t("analytics.pomodoroRate.title"),
        actual: t("analytics.pomodoroRate.actual"),
        target: t("analytics.pomodoroRate.target"),
      },
      workBreak: {
        title: t("analytics.workBreak.title"),
        work: t("analytics.workBreak.work"),
        break: t("analytics.workBreak.break"),
        longBreak: t("analytics.workBreak.longBreak"),
      },
      timeline: {
        title: t("analytics.timeline.title"),
        noSessions: t("analytics.timeline.noSessions"),
      },
      taskTrend: {
        title: t("analytics.taskTrend.title"),
        completedCount: t("analytics.taskTrend.completedCount"),
      },
      stagnation: {
        title: t("analytics.stagnation.title"),
        tasks: t("analytics.stagnation.tasks"),
      },
      projectTime: {
        title: t("analytics.projectTime.title"),
        noData: t("analytics.projectTime.noData"),
      },
      schedule: {
        totalEvents: t("analytics.schedule.totalEvents"),
        completedEvents: t("analytics.schedule.completedEvents"),
        completionRate: t("analytics.schedule.completionRate"),
        activeRoutines: t("analytics.schedule.activeRoutines"),
        routineRate: t("analytics.schedule.routineRate"),
        noEvents: t("analytics.schedule.noEvents"),
        eventTrend: {
          title: t("analytics.schedule.eventTrend.title"),
          completed: t("analytics.schedule.eventTrend.completed"),
        },
        timeDistribution: {
          title: t("analytics.schedule.timeDistribution.title"),
          count: t("analytics.schedule.timeDistribution.count"),
        },
        routineCompletion: {
          title: t("analytics.schedule.routineCompletion.title"),
          rate: t("analytics.schedule.routineCompletion.rate"),
        },
      },
    }),
    [t],
  );

  return (
    <AnalyticsView
      sessions={data.sessions}
      nodes={data.nodes}
      todayItems={data.todayItems}
      scheduleItems={data.scheduleItems}
      notes={data.notes}
      routines={data.routines}
      taskNameMap={taskNameMap}
      tagCount={data.tagCount}
      assignmentCount={data.assignmentCount}
      targetPerDay={data.targetPerDay}
      labels={labels}
    />
  );
}
