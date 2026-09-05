import { useCallback, useMemo, useState } from "react";
import {
  AnalyticsView,
  useTranslation,
  type DataService,
  type AnalyticsLabels,
  type AnalyticsTab,
  type DateRange,
  type TimerSession,
  type TodoNode,
  type ScheduleItem,
  type NoteNode,
  type RoutineNode,
  type WikiTagUnified,
  type WikiTagAssignmentUnified,
  formatDateKey,
  todayCalendarKey,
  useDomainLoad,
  useSyncDomains,
} from "@life-editor/shared";

/*
 * Analytics host shell (W4 · lean). Mirrors the Work/Trash host pattern: the
 * host owns data fetching (it calls the injected DataService — §6.4 allows
 * hosts) and i18n `t` resolution, then injects both into the pure shared
 * <AnalyticsView>. The shared tree never calls useTranslation / getDataService.
 *
 * Data surface (only what the 4 kept tabs need): timer sessions, todo tree,
 * today's schedule items (Overview), every live event (`fetchEvents()` — the
 * Overview tag usage card's range-independent totals, #1379), routines, notes,
 * tags + tag assignments (unified API — Overview counts and the Todos tab's tag
 * work-time ring, #334), and the pomodoro daily target from timer settings. The
 * Schedule tab's items are fetched separately, per selected date range (see the
 * scheduleRange effect + AnalyticsView.onScheduleRangeChange), so we no longer
 * load all history up front.
 *
 * Both loads run through `useDomainLoad` (#1157). Before that they were two
 * hand-written effects keyed on `[ds]` / `[ds, scheduleRange]`, which had two
 * consequences: the dashboard skeleton came back on every return to the
 * section (#1038 §3.1), and nothing here declared a Sync domain, so the
 * numbers never moved until the screen was remounted (#1136). The mount load
 * now replays its last result from the `analyticsSummary` slot before paint
 * and re-reads behind it, and both loads follow `useSyncDomains`.
 *
 * v2 §1 adoption (#208): the Overview/Todos/Work/Schedule tab band is lifted
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
  nodes: TodoNode[];
  todayItems: ScheduleItem[];
  /**
   * Every live event (`fetchEvents()`), for the Overview tag usage card
   * (#1379). Deliberately NOT the `scheduleItems` window below: that one is
   * refetched per date-range preset, and the card's right-hand column means
   * "carrying this tag right now" — a number that must not move when the user
   * changes the range. Its left column slices on the item's `createdAt`, which
   * a fetch keyed on the event's scheduled DATE cannot answer either.
   */
  events: ScheduleItem[];
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
  events: [],
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
  // Everything this screen reads, declared (rules/frontend.md §Sync). Missing
  // declarations are a silent stale, and this screen had none at all — a
  // finished pomodoro or a ticked todo left the dashboard showing yesterday
  // until the section was remounted (#1136). `sessions` and `timer` are
  // separate domains since #993: the session LOG and the pomodoro target.
  const syncVersion = useSyncDomains(
    "sessions",
    "todos",
    "schedule",
    "notes",
    "tags",
    "timer",
  );
  const [data, setData] = useState<AnalyticsData>(EMPTY);

  // Schedule tab data — fetched per selected range, not up front.
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [scheduleRange, setScheduleRange] = useState<DateRange | null>(null);

  // Wall calendar day (#356): the Overview's today stats come from schedule
  // items, and the Schedule domain keys its grids on the calendar — a 2 AM
  // edit belongs to the new date. The day-start-hour "today" (todayDateKey)
  // is Daily / routine sync's boundary and stays out of Analytics.
  const today = todayCalendarKey();

  // First-load flag: drives AnalyticsView's skeleton so the dashboard lays out
  // its frame instead of flashing zeros before the mount fetch resolves.
  const { isLoading: initialLoading } = useDomainLoad<AnalyticsData>({
    domain: "Analytics",
    dataService: ds,
    version: syncVersion,
    anchor: today,
    snapshotKey: "analyticsSummary",
    // Six domains feed this screen, so a bump lands often — and Realtime
    // echoes this tab's own writes back. Swapping the dashboard for its
    // skeleton on each one would make the numbers flicker while working.
    refetchReportsLoading: false,
    load: async (service) => {
      const [
        sessions,
        nodes,
        todayItems,
        events,
        routines,
        notes,
        tags,
        assignments,
        timerSettings,
      ] = await Promise.all([
        service.fetchTimerSessions(),
        service.fetchTodoTree(),
        service.fetchScheduleItemsByDateRange(today, today),
        service.fetchEvents(),
        service.fetchAllRoutines(),
        service.listNotesUnified(),
        service.listAllWikiTagsUnified(),
        service.listAllTagAssignments(),
        service.fetchTimerSettings(),
      ]);
      return {
        sessions,
        nodes,
        todayItems,
        events,
        routines,
        notes,
        tags,
        assignments,
        targetPerDay: timerSettings.targetSessions ?? 4,
      };
    },
    apply: setData,
    fallbackMessage: "Failed to load analytics",
  });

  const rangeFrom = scheduleRange ? formatDateKey(scheduleRange.start) : null;
  const rangeTo = scheduleRange ? formatDateKey(scheduleRange.end) : null;

  /*
   * Fetch schedule items for exactly the selected range. AnalyticsView reports
   * the range (incl. its initial default) via onScheduleRangeChange below, so
   * this runs once on mount and again whenever the user changes the range.
   *
   * The anchor is the range itself, so changing it reports loading again with
   * nothing to write by hand — which is what the old
   * `handleScheduleRangeChange` had to do to stay off
   * react-hooks/set-state-in-effect.
   *
   * NO snapshotKey, and it is not an oversight. `useDomainLoad` looks a
   * snapshot up ONCE, in a mount-render useState initializer, and on the mount
   * render `scheduleRange` is still null — the range arrives afterwards, from a
   * passive effect inside AnalyticsFilterProvider, which is a CHILD of this
   * screen. There is therefore no render at which a lookup for the real window
   * could happen, so a key here would only ever be written and never read.
   * Making it work would mean duplicating that Provider's preset default up
   * here, which is the one place the default is allowed to live.
   *
   * Its OWN counter, not the six-domain one above. `isLoading` is derived from
   * `version`, so sharing the summary's counter made a finished pomodoro (a
   * `sessions` bump this read does not care about) put the Schedule tab's
   * skeleton back mid-session. This read touches one method, so it follows one
   * domain — the "over-declare if in doubt" rule in rules/frontend.md §Sync
   * prices an extra fetch, not an extra skeleton.
   */
  const scheduleSyncVersion = useSyncDomains("schedule");
  const { isLoading: rangeLoading } = useDomainLoad<ScheduleItem[]>({
    domain: "Analytics schedule range",
    dataService: ds,
    version: scheduleSyncVersion,
    anchor: rangeFrom === null ? undefined : `${rangeFrom}:${rangeTo}`,
    load: (service) =>
      rangeFrom === null || rangeTo === null
        ? Promise.resolve<ScheduleItem[]>([])
        : service.fetchScheduleItemsByDateRange(rangeFrom, rangeTo),
    apply: setScheduleItems,
    fallbackMessage: "Failed to load the schedule range",
  });
  // No range yet means AnalyticsView has not reported its preset, which is a
  // load that has not started — not one that finished empty.
  const scheduleLoading = rangeLoading || scheduleRange === null;

  // The range anchor drives `rangeLoading` on its own now, so this only has to
  // record what the user picked.
  const handleScheduleRangeChange = useCallback((range: DateRange) => {
    setScheduleRange(range);
  }, []);

  const todoNameMap = useMemo(() => {
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
        todos: t("analytics.tabs.todos"),
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
      emptyTagUsage: {
        title: t("analytics.empty.tagUsage.title"),
        description: t("analytics.empty.tagUsage.description"),
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
      todoWorkTime: t("analytics.todoWorkTime"),
      noTodo: t("analytics.noTodo"),
      totalWorkTime: t("analytics.totalWorkTime"),
      sessions: t("analytics.sessions"),
      avgPerDay: t("analytics.avgPerDay"),
      overview: {
        todos: t("analytics.overview.todos"),
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
        completedTodos: t("analytics.today.completedTodos"),
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
      todoTrend: {
        title: t("analytics.todoTrend.title"),
        completedCount: t("analytics.todoTrend.completedCount"),
      },
      stagnation: {
        title: t("analytics.stagnation.title"),
        todos: t("analytics.stagnation.todos"),
        buckets: {
          under1Week: t("analytics.stagnation.buckets.under1Week"),
          "1to2Weeks": t("analytics.stagnation.buckets.1to2Weeks"),
          "2to4Weeks": t("analytics.stagnation.buckets.2to4Weeks"),
          "1to3Months": t("analytics.stagnation.buckets.1to3Months"),
          over3Months: t("analytics.stagnation.buckets.over3Months"),
        },
      },
      tagTime: {
        title: t("analytics.tagTime.title"),
        noData: t("analytics.tagTime.noData"),
        untagged: t("analytics.tagTime.untagged"),
        other: t("analytics.tagTime.other"),
      },
      tagUsage: {
        title: t("analytics.tagUsage.title"),
        tag: t("analytics.tagUsage.tag"),
        inRange: t("analytics.tagUsage.inRange"),
        liveTotal: t("analytics.tagUsage.liveTotal"),
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
      liveEvents={data.events}
      onScheduleRangeChange={handleScheduleRangeChange}
      scheduleLoading={scheduleLoading}
      initialLoading={initialLoading}
      notes={data.notes}
      routines={data.routines}
      todoNameMap={todoNameMap}
      tags={data.tags}
      assignments={data.assignments}
      targetPerDay={data.targetPerDay}
      activeTab={tab}
      onTabChange={onTabChange}
      labels={labels}
    />
  );
}
