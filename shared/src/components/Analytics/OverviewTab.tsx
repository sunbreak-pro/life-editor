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
import type { TodoNode } from "../../types/todoTree";
import type { ScheduleItem } from "../../types/schedule";
import type { NoteNode } from "../../types/note";
import type { RoutineNode } from "../../types/routine";
import type { WikiTag, WikiTagAssignment } from "../../types/wikiTagUnified";
import { formatDateKey, todayCalendarKey } from "../../utils/dateKey";
import {
  calendarWeekRange,
  computeSummary,
  createdWithinRange,
  getWorkSessions,
} from "../../utils/analyticsAggregation";
import { WEEK_STARTS_ON } from "../../utils/scheduleGridLayout";
import { AnalyticsStatCard } from "./AnalyticsStatCard";
import type { DateRange } from "./AnalyticsFilterContext";
import { TagUsageCard, type TagUsageCardLabels } from "./TagUsageCard";
import { TodayDashboard, type TodayDashboardLabels } from "./TodayDashboard";
import { WeeklySummary, type WeeklySummaryLabels } from "./WeeklySummary";
import { StreakDisplay, type StreakDisplayLabels } from "./StreakDisplay";

export interface OverviewTabLabels {
  /** Stat-card titles. */
  todos: string;
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
  tagUsage: TagUsageCardLabels;
}

interface OverviewTabProps {
  sessions: TimerSession[];
  nodes: TodoNode[];
  /** Schedule items for today (host: fetchScheduleItemsByDateRange today,today). */
  todayItems: ScheduleItem[];
  /**
   * EVERY live event (host: `fetchEvents()`), not the Schedule tab's date-range
   * window — the tag usage card's right-hand total must not move with the
   * preset. Unused by the stat cards, which read `todayItems`.
   */
  events: ScheduleItem[];
  notes: NoteNode[];
  routines: RoutineNode[];
  /**
   * Active life-tags and their assignments. Passed as the LISTS, not as
   * pre-counted numbers: the stat card's counts are derived from them right
   * here, so the "N tags / M assigned" headline and the per-tag breakdown
   * below it read the same data (数値の非複製原則).
   */
  tags: WikiTag[];
  assignments: WikiTagAssignment[];
  /** Selected analytics range — drives the tag card's left column only. */
  dateRange: DateRange;
  labels: OverviewTabLabels;
}

export function OverviewTab({
  sessions,
  nodes,
  todayItems,
  events,
  notes,
  routines,
  tags,
  assignments,
  dateRange,
  labels,
}: OverviewTabProps): React.JSX.Element {
  const stats = useMemo(() => {
    // Todos
    const todos = nodes.filter((n) => n.type === "task");
    const completedTodos = todos.filter((n) => n.status === "DONE");
    const todoRate =
      todos.length > 0
        ? Math.round((completedTodos.length / todos.length) * 100)
        : 0;

    // Events (today)
    const todayCompleted = todayItems.filter((i) => i.completed);

    // Notes
    // #375: the `type === "note"` half of this filter went away with the
    // folder type (every NoteNode is a note now).
    const activeNotes = notes.filter((n) => !n.isDeleted);
    const now = new Date();
    // The calendar week (#780) — this card used to run on a rolling 7 days
    // while every other "this week" number ran on the week, so the two
    // disagreed. Unified per D-20260811-refactor-1 = A.
    const week = calendarWeekRange(now, WEEK_STARTS_ON);
    const notesThisWeek = createdWithinRange(
      activeNotes,
      week.startKey,
      week.endKey,
    );

    // Work
    const summary = computeSummary(sessions);
    // Calendar day (#356) — same boundary as TodayDashboard.
    const todayStr = todayCalendarKey(now);
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
      totalTodos: todos.length,
      completedTodos: completedTodos.length,
      todoRate,
      todayEvents: todayItems.length,
      todayEventsCompleted: todayCompleted.length,
      totalNotes: activeNotes.length,
      notesThisWeek: notesThisWeek.length,
      totalWorkTime: labels.formatHours(summary.totalMinutes),
      todayWorkTime: labels.formatHours(todayMinutes),
      activeRoutines: activeRoutines.length,
      routineRate,
      totalTags: tags.length,
      totalAssignments: assignments.length,
    };
  }, [
    nodes,
    todayItems,
    notes,
    sessions,
    routines,
    tags,
    assignments,
    labels,
  ]);

  return (
    <div className="space-y-4">
      {/* Multi-domain stat cards. Three across only once the DATA COLUMN is
          wide enough (#1480) — with the detail panel open it is ~612px, where
          a third of it leaves 「0時間33分」 nowhere to go. */}
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-3">
        <AnalyticsStatCard
          icon={<BarChart3 size={16} />}
          label={labels.todos}
          value={stats.totalTodos}
          tone="mint"
          subtitle={`${stats.completedTodos} ${labels.completed} (${stats.todoRate}%)`}
        />
        <AnalyticsStatCard
          icon={<CalendarCheck2 size={16} />}
          label={labels.events}
          value={stats.todayEvents}
          tone="accent"
          subtitle={`${stats.todayEventsCompleted} ${labels.completed} ${labels.today}`}
        />
        <AnalyticsStatCard
          icon={<FileText size={16} />}
          label={labels.notes}
          value={stats.totalNotes}
          tone="accent"
          subtitle={`+${stats.notesThisWeek} ${labels.thisWeek}`}
        />
        <AnalyticsStatCard
          icon={<Clock size={16} />}
          label={labels.work}
          value={stats.totalWorkTime}
          tone="accent"
          subtitle={`${stats.todayWorkTime} ${labels.today}`}
        />
        <AnalyticsStatCard
          icon={<RefreshCw size={16} />}
          label={labels.routines}
          value={stats.activeRoutines}
          tone="mint"
          subtitle={`${stats.routineRate}% ${labels.rate}`}
        />
        <AnalyticsStatCard
          icon={<Tag size={16} />}
          label={labels.tags}
          value={stats.totalTags}
          tone="accent"
          subtitle={`${stats.totalAssignments} ${labels.assigned}`}
        />
      </div>

      {/* Today / Weekly / Streak — 3-col ChartCard row */}
      <div className="grid grid-cols-3 gap-3">
        <TodayDashboard
          sessions={sessions}
          nodes={nodes}
          labels={labels.todayCard}
        />
        <WeeklySummary
          sessions={sessions}
          nodes={nodes}
          labels={labels.weekly}
        />
        <StreakDisplay sessions={sessions} labels={labels.streak} />
      </div>

      {/* Tag usage (#1379) — full width because each row carries two numbers
          plus a bar, and the 3-col track above squeezes the column headers
          that say WHICH window each number belongs to. */}
      <TagUsageCard
        todos={nodes}
        events={events}
        notes={notes}
        assignments={assignments}
        tags={tags}
        dateRange={dateRange}
        labels={labels.tagUsage}
      />
    </div>
  );
}
