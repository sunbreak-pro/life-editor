import { useMemo, useState } from "react";
import type { TimerSession } from "../../types/timer";
import { WIDE_QUERY } from "../../constants/breakpoints";
import type { TodoNode } from "../../types/todoTree";
import type { ScheduleItem } from "../../types/schedule";
import type { NoteNode } from "../../types/note";
import type { RoutineNode } from "../../types/routine";
import type { WikiTag, WikiTagAssignment } from "../../types/wikiTagUnified";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { HeaderTabs, type HeaderTab } from "../HeaderTabs";
import {
  AnalyticsFilterProvider,
  useAnalyticsFilter,
  type DateRange,
} from "./AnalyticsFilterContext";
import { DateRangePresetSelector } from "./DateRangePresetSelector";
import { OverviewTab } from "./OverviewTab";
import { TodosTab } from "./TodosTab";
import { TimeTab } from "./TimeTab";
import { ScheduleTab } from "./ScheduleTab";
import { MobileAnalyticsView } from "./MobileAnalyticsView";
import { ANALYTICS_TAB_ORDER, type AnalyticsTab } from "./tabs";
import type { AnalyticsLabels } from "./labels";

/*
 * W4 Analytics — shared presentational dashboard root (design-analytics-v2).
 * PURE PRESENTATION: every string arrives via the typed `labels` object and
 * every dataset arrives as props (CLAUDE.md §6.4 — no useTranslation /
 * getDataService here). Desktop (≥768px) = the 4-tab dashboard; the tab band
 * lifts into the shell's standard SectionHeader when the host drives `activeTab`
 * (v2 §1 — controlled), leaving just the date-range preset in-body. Omit the
 * controlled props and the in-body HeaderTabs owns tab state, exactly as before
 * (backward-compatible). Mobile (<768px) = a single Consumption scroll
 * (MobileAnalyticsView). The former accent-filled tab pills and the per-chart
 * visibility sidebar are dropped.
 */

export interface AnalyticsViewProps {
  sessions: TimerSession[];
  nodes: TodoNode[];
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
   * EVERY live event (host: `fetchEvents()`) — the third event list here, and
   * the only range-INDEPENDENT one. `todayItems` is one day, `scheduleItems`
   * is the selected preset's window; the tag usage card (#1379) needs neither,
   * because its right-hand total is defined as "carrying this tag right now"
   * and its left column slices on the item's `createdAt`, which a fetch keyed
   * on the event's scheduled date cannot answer.
   */
  liveEvents: ScheduleItem[];
  /**
   * True while the host's initial (mount) fetch is in flight. Drives the
   * first-load skeleton so the dashboard lays out its frame instead of
   * flashing zeros before the data lands.
   */
  initialLoading?: boolean;
  notes: NoteNode[];
  routines: RoutineNode[];
  /** Pre-built todoId → display name map (Work tab todo chart). */
  todoNameMap: Map<string, string>;
  /**
   * Active life-tags. Feeds the Overview tag count, the Overview tag usage
   * card (#1379) and the Todos tab's tag work-time ring. Passed as the list,
   * never as a pre-counted number, so every surface counts the same rows
   * (数値の非複製原則).
   */
  tags: WikiTag[];
  /** Active tag assignments (Overview counts + tag work-time attribution). */
  assignments: WikiTagAssignment[];
  /** Pomodoro daily target (Work tab; host: fetchTimerSettings().targetSessions). */
  targetPerDay: number;
  /**
   * Controlled active tab (v2 §1 adoption hook): when layout-standard lifts the
   * tab band into the shell SectionHeader (materials-style), the shell owns tab
   * state and drives it here. Omit both `activeTab` and `onTabChange` to keep
   * the in-body HeaderTabs' own state — the current default, fully
   * backward-compatible.
   */
  activeTab?: AnalyticsTab;
  /**
   * Fires on tab select from the in-body HeaderTabs — i.e. only in UNCONTROLLED
   * mode. When controlled (shell-lifted band), the shell owns tab selection
   * directly and drives `activeTab`, so this never fires; it stays for API
   * symmetry and the uncontrolled fallback. Pair with `activeTab` for
   * controlled (shell-driven) mode.
   */
  onTabChange?: (tab: AnalyticsTab) => void;
  labels: AnalyticsLabels;
}

export function AnalyticsView(props: AnalyticsViewProps): React.JSX.Element {
  const isWide = useMediaQuery(WIDE_QUERY);

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
  liveEvents,
  initialLoading,
  notes,
  routines,
  todoNameMap,
  tags,
  assignments,
  targetPerDay,
  activeTab: controlledTab,
  onTabChange,
  labels,
}: AnalyticsViewProps): React.JSX.Element {
  const { dateRange, preset, applyPreset } = useAnalyticsFilter();
  // Controlled when the shell supplies `activeTab` (v2 §1: tab band lifts into
  // the standard SectionHeader); otherwise the in-body HeaderTabs owns its
  // state, exactly as before. Backward-compatible.
  const [internalTab, setInternalTab] = useState<AnalyticsTab>("overview");
  const activeTab = controlledTab ?? internalTab;
  const selectTab = (tab: AnalyticsTab): void => {
    if (controlledTab === undefined) setInternalTab(tab);
    onTabChange?.(tab);
  };

  const tabs = useMemo<HeaderTab[]>(
    () =>
      ANALYTICS_TAB_ORDER.map((tab) => ({ id: tab, label: labels.tabs[tab] })),
    [labels.tabs],
  );

  // Shared between the two header-band branches (controlled ↔ uncontrolled) so
  // the preset's props stay defined in one place.
  const presetSelector = (
    <DateRangePresetSelector
      value={preset}
      onChange={applyPreset}
      label={labels.datePreset.label}
      options={labels.datePreset.options}
    />
  );

  return (
    <div className="flex h-full flex-col">
      {/* v2 §1 adoption — the tab band doubles as the section title. When the
          shell lifts it into the standard SectionHeader (controlled: MainScreen
          owns `activeTab`), only the date-range preset stays in-body, right-
          aligned to the data column. When uncontrolled (tests / any non-lifted
          host), the in-body HeaderTabs owns tab switching with the preset in
          its trailing slot — the prior behavior, fully backward-compatible. */}
      {controlledTab === undefined ? (
        <div className="flex-shrink-0 px-lumen-gutter pt-3 md:px-lumen-gutter-wide md:pt-4">
          <HeaderTabs
            tabs={tabs}
            activeTab={activeTab}
            onSelect={(id) => selectTab(id as AnalyticsTab)}
            label={labels.tabsLabel}
            trailing={presetSelector}
          />
        </div>
      ) : (
        <div className="flex-shrink-0 px-lumen-gutter pt-3 md:px-lumen-gutter-wide md:pt-4">
          <div className="mx-auto flex w-full max-w-lumen-data justify-end">
            {presetSelector}
          </div>
        </div>
      )}

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
                  events={liveEvents}
                  notes={notes}
                  routines={routines}
                  tags={tags}
                  assignments={assignments}
                  dateRange={dateRange}
                  labels={{
                    todos: labels.overview.todos,
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
                      completedTodos: labels.todayCard.completedTodos,
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
                    tagUsage: {
                      ...labels.tagUsage,
                      // The preset's own name, resolved where the preset
                      // lives — the card only has to render it beside the
                      // column it qualifies.
                      rangeLabel: labels.datePreset.options[preset],
                      empty: labels.emptyTagUsage,
                    },
                  }}
                />
              )}

              {activeTab === "todos" && (
                <TodosTab
                  sessions={sessions}
                  nodes={nodes}
                  events={liveEvents}
                  assignments={assignments}
                  tags={tags}
                  labels={{
                    todoTrend: labels.todoTrend,
                    stagnation: labels.stagnation,
                    tagTime: {
                      title: labels.tagTime.title,
                      noData: labels.tagTime.noData,
                      untagged: labels.tagTime.untagged,
                      other: labels.tagTime.other,
                      formatHours: labels.formatHours,
                    },
                  }}
                />
              )}

              {activeTab === "work" && (
                <TimeTab
                  sessions={sessions}
                  todoNameMap={todoNameMap}
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
                    todoWorkTime: {
                      title: labels.todoWorkTime,
                      sessions: labels.sessions,
                      noTodo: labels.noTodo,
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
