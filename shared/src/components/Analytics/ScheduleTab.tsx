import { useMemo } from "react";
import {
  CalendarCheck2,
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
  noEvents: string;
  eventTrend: EventCompletionTrendLabels;
  timeDistribution: EventTimeDistributionLabels;
  routineCompletion: RoutineCompletionChartLabels;
}

interface ScheduleTabProps {
  /**
   * All schedule items the host loaded for the analytics window (host:
   * fetchScheduleItemsByDateRange over a wide range). The tab filters to the
   * active date-range preset from AnalyticsFilterContext in-memory so data
   * fetching stays in the host (§6.4) while the range UI stays in shared.
   */
  scheduleItems: ScheduleItem[];
  routines: RoutineNode[];
  labels: ScheduleTabLabels;
}

export function ScheduleTab({
  scheduleItems,
  routines,
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

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto w-full">
        <p className="text-sm text-ink-text-secondary mt-4 text-center">
          {labels.noEvents}
        </p>
      </div>
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
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <AnalyticsStatCard
          icon={<CalendarCheck2 size={20} />}
          label={labels.totalEvents}
          value={stats.totalEvents}
          color="text-ink-accent"
        />
        <AnalyticsStatCard
          icon={<CheckCircle2 size={20} />}
          label={labels.completedEvents}
          value={stats.completedEvents}
          color="text-ink-success"
        />
        <AnalyticsStatCard
          icon={<Percent size={20} />}
          label={labels.completionRate}
          value={`${stats.completionRate}%`}
          color="text-orange-500"
        />
        <AnalyticsStatCard
          icon={<RefreshCw size={20} />}
          label={labels.activeRoutines}
          value={stats.activeRoutines}
          color="text-purple-500"
        />
        <AnalyticsStatCard
          icon={<Activity size={20} />}
          label={labels.routineRate}
          value={`${stats.routineRate}%`}
          color="text-ink-accent"
        />
      </div>

      <EventCompletionTrend
        items={items}
        days={days}
        labels={labels.eventTrend}
      />
      <EventTimeDistribution items={items} labels={labels.timeDistribution} />
      <RoutineCompletionChart
        items={items}
        routines={routines}
        labels={labels.routineCompletion}
      />
    </div>
  );
}
