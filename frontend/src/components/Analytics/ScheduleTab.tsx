import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarCheck2,
  CheckCircle2,
  Percent,
  RefreshCw,
  Activity,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ScheduleItem } from "../../types/schedule";
import { useRoutineContext } from "../../hooks/useRoutineContext";
import { useAnalyticsFilter } from "../../context/AnalyticsFilterContext";
import { getDataService } from "../../services";
import { formatDateKey } from "../../utils/dateKey";
import { AnalyticsStatCard } from "./AnalyticsStatCard";
import { EventCompletionTrend } from "./EventCompletionTrend";
import { EventTimeDistribution } from "./EventTimeDistribution";
import { RoutineCompletionChart } from "./RoutineCompletionChart";

export function ScheduleTab() {
  const { t } = useTranslation();
  const { dateRange, visibleCharts } = useAnalyticsFilter();
  const { routines } = useRoutineContext();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  // Defer chart rendering by 1 frame after data arrives so containers are laid out
  const [chartsReady, setChartsReady] = useState(false);
  const rafRef = useRef(0);

  useEffect(() => {
    setChartsReady(false);
    const start = formatDateKey(dateRange.start);
    const end = formatDateKey(dateRange.end);
    getDataService()
      .fetchScheduleItemsByDateRange(start, end)
      .then((data) => {
        setItems(data);
        rafRef.current = requestAnimationFrame(() => setChartsReady(true));
      });
    return () => cancelAnimationFrame(rafRef.current);
  }, [dateRange]);

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
        <p className="text-sm text-notion-text-secondary mt-4 text-center">
          {t("analytics.schedule.noEvents")}
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
          label={t("analytics.schedule.totalEvents")}
          value={stats.totalEvents}
          color="text-blue-500"
        />
        <AnalyticsStatCard
          icon={<CheckCircle2 size={20} />}
          label={t("analytics.schedule.completedEvents")}
          value={stats.completedEvents}
          color="text-notion-success"
        />
        <AnalyticsStatCard
          icon={<Percent size={20} />}
          label={t("analytics.schedule.completionRate")}
          value={`${stats.completionRate}%`}
          color="text-orange-500"
        />
        <AnalyticsStatCard
          icon={<RefreshCw size={20} />}
          label={t("analytics.schedule.activeRoutines")}
          value={stats.activeRoutines}
          color="text-purple-500"
        />
        <AnalyticsStatCard
          icon={<Activity size={20} />}
          label={t("analytics.schedule.routineRate")}
          value={`${stats.routineRate}%`}
          color="text-notion-accent"
        />
      </div>

      {chartsReady && visibleCharts.has("eventCompletionTrend") && (
        <EventCompletionTrend items={items} days={days} />
      )}

      {chartsReady && visibleCharts.has("eventTimeDistribution") && (
        <EventTimeDistribution items={items} />
      )}

      {chartsReady && visibleCharts.has("routineCompletionChart") && (
        <RoutineCompletionChart items={items} routines={routines} />
      )}
    </div>
  );
}
