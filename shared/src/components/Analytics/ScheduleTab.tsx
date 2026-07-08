import { useMemo } from "react";
import {
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  Percent,
  RefreshCw,
  Activity,
} from "lucide-react";
import type { ScheduleItem } from "../../types/schedule";
import type { RoutineNode } from "../../types/routine";
import { useAnalyticsFilter } from "./AnalyticsFilterContext";
import { formatDateKey } from "../../utils/dateKey";
import { AnalyticsStatCard } from "./AnalyticsStatCard";
import { EmptyState } from "./EmptyState";
import {
  EventCompletionTrend,
  type EventCompletionTrendLabels,
} from "./EventCompletionTrend";
import {
  EventTimeDistribution,
  type EventTimeDistributionLabels,
} from "./EventTimeDistribution";
import {
  RoutineCompletionChart,
  type RoutineCompletionChartLabels,
} from "./RoutineCompletionChart";

export interface ScheduleTabLabels {
  totalEvents: string;
  completedEvents: string;
  completionRate: string;
  activeRoutines: string;
  routineRate: string;
  /** Designed empty-state copy (no events in range). */
  empty: { title: string; description: string };
  eventTrend: EventCompletionTrendLabels;
  timeDistribution: EventTimeDistributionLabels;
  routineCompletion: RoutineCompletionChartLabels;
}

interface ScheduleTabProps {
  /**
   * Schedule items for the active date-range preset. The host fetches exactly
   * this window (fetchScheduleItemsByDateRange for the selected range — see
   * AnalyticsView.onScheduleRangeChange), so data fetching stays in the host
   * (§6.4). The tab still filters by the same range in-memory as a safety net,
   * which keeps AnalyticsFilterContext the single source of truth for the range.
   */
  scheduleItems: ScheduleItem[];
  routines: RoutineNode[];
  /** True while the host is (re)fetching items for the selected range. */
  loading?: boolean;
  labels: ScheduleTabLabels;
}

export function ScheduleTab({
  scheduleItems,
  routines,
  loading = false,
  labels,
}: ScheduleTabProps): React.JSX.Element {
  const { dateRange } = useAnalyticsFilter();

  const items = useMemo(() => {
    const start = formatDateKey(dateRange.start);
    const end = formatDateKey(dateRange.end);
    return scheduleItems.filter(
      (i) => !i.isDeleted && i.date >= start && i.date <= end,
    );
  }, [scheduleItems, dateRange]);

  const stats = useMemo(() => {
    const completed = items.filter((i) => i.completed);
    const routineItems = items.filter((i) => i.routineId);
    const routineCompleted = routineItems.filter((i) => i.completed);
    const activeRoutines = routines.filter(
      (r) => !r.isArchived && !r.isDeleted,
    );

    return {
      totalEvents: items.length,
      completedEvents: completed.length,
      completionRate:
        items.length > 0
          ? Math.round((completed.length / items.length) * 100)
          : 0,
      activeRoutines: activeRoutines.length,
      routineRate:
        routineItems.length > 0
          ? Math.round((routineCompleted.length / routineItems.length) * 100)
          : 0,
    };
  }, [items, routines]);

  // Initial (or empty) fetch in flight: show a skeleton instead of flashing the
  // "no events" copy (design 1k). No text → no new i18n key needed.
  if (loading && items.length === 0) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[68px] animate-pulse rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary"
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary"
            />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock size={26} />}
        title={labels.empty.title}
        description={labels.empty.description}
      />
    );
  }

  const days = Math.max(
    1,
    Math.ceil(
      (dateRange.end.getTime() - dateRange.start.getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );

  return (
    <div className="space-y-4" aria-busy={loading}>
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-5">
        <AnalyticsStatCard
          icon={<CalendarCheck2 size={16} />}
          label={labels.totalEvents}
          value={stats.totalEvents}
          tone="accent"
        />
        <AnalyticsStatCard
          icon={<CheckCircle2 size={16} />}
          label={labels.completedEvents}
          value={stats.completedEvents}
          tone="mint"
        />
        <AnalyticsStatCard
          icon={<Percent size={16} />}
          label={labels.completionRate}
          value={`${stats.completionRate}%`}
          tone="mint"
        />
        <AnalyticsStatCard
          icon={<RefreshCw size={16} />}
          label={labels.activeRoutines}
          value={stats.activeRoutines}
          tone="accent"
        />
        <AnalyticsStatCard
          icon={<Activity size={16} />}
          label={labels.routineRate}
          value={`${stats.routineRate}%`}
          tone="mint"
        />
      </div>

      <EventCompletionTrend
        items={items}
        days={days}
        labels={labels.eventTrend}
      />
      <div className="grid grid-cols-2 gap-3">
        <EventTimeDistribution items={items} labels={labels.timeDistribution} />
        <RoutineCompletionChart
          items={items}
          routines={routines}
          labels={labels.routineCompletion}
        />
      </div>
    </div>
  );
}
