import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AnalyticsView,
  useTranslation,
  type DataService,
  type AnalyticsLabels,
  type AnalyticsTab,
  type DateRange,
  type TimerSession,
  type TaskNode,
  type ScheduleItem,
  type NoteNode,
  type RoutineNode,
  type WikiTagUnified,
  type WikiTagAssignmentUnified,
  formatDateKey,
  todayCalendarKey,
} from "@life-editor/shared";

/*
 * Analytics host shell (W4 · lean). Mirrors the Work/Trash host pattern: the
 * host owns data fetching (it calls the injected DataService — §6.4 allows
 * hosts) and i18n `t` resolution, then injects both into the pure shared
 * <AnalyticsView>. The shared tree never calls useTranslation / getDataService.
 *
 * Data surface (only what the 4 kept tabs need): timer sessions, task tree,
 * today's schedule items (Overview), routines, notes, tags + tag assignments
 * (unified API — Overview counts and the Tasks tab's tag work-time ring, #334),
 * and the pomodoro daily target from timer settings. The
 * Schedule tab's items are fetched separately, per selected date range (see the
 * scheduleRange effect + AnalyticsView.onScheduleRangeChange), so we no longer
 * load all history up front.
 *
 * v2 §1 adoption (#208): the Overview/Tasks/Work/Schedule tab band is lifted
 * into the shell's standard SectionHeader (MainScreen owns `analyticsTab`, same
 * as Materials / Schedule). This host just forwards that tab state down to the
 * pure <AnalyticsView>; the shared view then drops its in-body tab band and
 * keeps only the date-range preset.
 */

interface AnalyticsScreenProps {
  dataService: DataService;
  /** Active tab, owned by the shell SectionHeader (v2 §1 lift). */
  tab: AnalyticsTab;
  /** Fires on tab select from the shell band. */
  onTabChange: (tab: AnalyticsTab) => void;
}

// Data fetched once on mount (independent of the selected analytics range).
interface AnalyticsData {
  sessions: TimerSession[];
  nodes: TaskNode[];
  todayItems: ScheduleItem[];
  notes: NoteNode[];
  routines: RoutineNode[];
  tags: WikiTagUnified[];
  assignments: WikiTagAssignmentUnified[];
  targetPerDay: number;
}

const EMPTY: AnalyticsData = {
  sessions: [],
  nodes: [],
  todayItems: [],
  notes: [],
  routines: [],
  tags: [],
  assignments: [],
  targetPerDay: 4,
};

export function AnalyticsScreen({
  dataService: ds,
  tab,
  onTabChange,
}: AnalyticsScreenProps): React.JSX.Element {
  const { t } = useTranslation();
  const [data, setData] = useState<AnalyticsData>(EMPTY);
  // First-load flag: drives AnalyticsView's skeleton so the dashboard lays out
  // its frame instead of flashing zeros before the mount fetch resolves.
  const [initialLoading, setInitialLoading] = useState(true);

  // Schedule tab data — fetched per selected range, not up front.
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [scheduleRange, setScheduleRange] = useState<DateRange | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Wall calendar day (#356): the Overview's today stats come from schedule
    // items, and the Schedule domain keys its grids on the calendar — a 2 AM
    // edit belongs to the new date. The day-start-hour "today" (todayDateKey)
    // is Daily / routine sync's boundary and stays out of Analytics.
    const today = todayCalendarKey();

    void Promise.all([
      ds.fetchTimerSessions(),
      ds.fetchTaskTree(),
      ds.fetchScheduleItemsByDateRange(today, today),
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
            routines,
            notes,
            tags,
            assignments,
            targetPerDay: timerSettings.targetSessions ?? 4,
          });
          setInitialLoading(false);
        },
      )
      .catch(() => {
        if (cancelled) return;
        setData(EMPTY);
        setInitialLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ds]);

  // Fetch schedule items for exactly the selected range. AnalyticsView reports
  // the range (incl. its initial default) via onScheduleRangeChange below, so
  // this runs once on mount and again whenever the user changes the range.
  useEffect(() => {
    if (!scheduleRange) return;
    let cancelled = false;

    const from = formatDateKey(scheduleRange.start);
    const to = formatDateKey(scheduleRange.end);

    void ds
      .fetchScheduleItemsByDateRange(from, to)
      .then((items) => {
        if (cancelled) return;
        setScheduleItems(items);
        setScheduleLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setScheduleItems([]);
        setScheduleLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ds, scheduleRange]);

  const handleScheduleRangeChange = useCallback((range: DateRange) => {
    // Flip the loading flag here (a callback), not synchronously inside the
    // fetch effect — the effect body would trip react-hooks/set-state-in-effect
    // and cost an extra render. AnalyticsView calls this on mount and on every
    // range change, i.e. exactly when a new fetch is about to run.
    setScheduleLoading(true);
    setScheduleRange(range);
  }, []);

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
      formatHours: (minutes: number) => {
        // Round once, then split — rounding the remainder on its own renders
        // 119.7 as "1h 60m". Charts pass raw minutes (the tag ring splits
        // multi-tag sessions into fractions), so this is the only guard.
        const total = Math.round(minutes);
        return t("analytics.hours", {
          hours: Math.floor(total / 60),
          minutes: total % 60,
        });
      },
      tabsLabel: t("analytics.tabsLabel"),
      tabs: {
        overview: t("analytics.tabs.overview"),
        tasks: t("analytics.tabs.tasks"),
        schedule: t("analytics.tabs.schedule"),
        work: t("analytics.tabs.work"),
      },
      datePreset: {
        label: t("analytics.datePreset.label"),
        options: {
          "7d": t("analytics.datePreset.7d"),
          "30d": t("analytics.datePreset.30d"),
          thisMonth: t("analytics.datePreset.thisMonth"),
          "3m": t("analytics.datePreset.3m"),
          all: t("analytics.datePreset.all"),
        },
      },
      emptyWork: {
        title: t("analytics.empty.work.title"),
        description: t("analytics.empty.work.description"),
      },
      emptySchedule: {
        title: t("analytics.empty.schedule.title"),
        description: t("analytics.empty.schedule.description"),
      },
      emptyMobile: {
        title: t("analytics.empty.mobile.title"),
        description: t("analytics.empty.mobile.description"),
      },
      mobile: {
        weekTitle: t("analytics.mobile.weekTitle"),
        routineTitle: t("analytics.mobile.routineTitle"),
        top3: t("analytics.mobile.top3"),
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
        meta: t("analytics.heatmap.meta"),
        less: t("analytics.heatmap.less"),
        more: t("analytics.heatmap.more"),
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
      tagTime: {
        title: t("analytics.tagTime.title"),
        noData: t("analytics.tagTime.noData"),
        untagged: t("analytics.tagTime.untagged"),
        other: t("analytics.tagTime.other"),
      },
      schedule: {
        totalEvents: t("analytics.schedule.totalEvents"),
        completedEvents: t("analytics.schedule.completedEvents"),
        completionRate: t("analytics.schedule.completionRate"),
        activeRoutines: t("analytics.schedule.activeRoutines"),
        routineRate: t("analytics.schedule.routineRate"),
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
      scheduleItems={scheduleItems}
      onScheduleRangeChange={handleScheduleRangeChange}
      scheduleLoading={scheduleLoading}
      initialLoading={initialLoading}
      notes={data.notes}
      routines={data.routines}
      taskNameMap={taskNameMap}
      tags={data.tags}
      assignments={data.assignments}
      targetPerDay={data.targetPerDay}
      activeTab={tab}
      onTabChange={onTabChange}
      labels={labels}
    />
  );
}
