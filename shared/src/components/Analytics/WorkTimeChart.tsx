import { useMemo, type ReactNode } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TimerSession } from "../../types/timer";
import type { Period } from "./PeriodSelector";
import {
  aggregateByDay,
  aggregateByWeek,
  aggregateByMonth,
  type DayBucket,
} from "../../utils/analyticsAggregation";
import { useWeekStartPref } from "../../hooks/useWeekStart";
import { ChartCard } from "./ChartCard";
import { CHART_GRID, CHART_TICK_11, CHART_TOOLTIP_STYLE } from "./chartTheme";

export interface WorkTimeChartLabels {
  /** Chart heading + tooltip series name. */
  workTime: string;
}

interface WorkTimeChartProps {
  sessions: TimerSession[];
  period: Period;
  labels: WorkTimeChartLabels;
  /** Optional right-aligned control slot (the day/week/month period pills). */
  control?: ReactNode;
}

function formatDateLabel(dateStr: string, period: Period): string {
  const d = new Date(dateStr + "T00:00:00");
  if (period === "day") {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  if (period === "week") {
    return `${d.getMonth() + 1}/${d.getDate()}~`;
  }
  return `${d.getFullYear()}/${d.getMonth() + 1}`;
}

export function WorkTimeChart({
  sessions,
  period,
  labels,
  control,
}: WorkTimeChartProps): React.JSX.Element {
  // The weekly buckets start on the user's week-start day (#860). They used to
  // start on a hardcoded Monday, so with the pref set to Sunday this chart cut
  // the same sessions along a different boundary than the "this week" cards.
  const { weekStartsOn } = useWeekStartPref();

  const data = useMemo(() => {
    let buckets: DayBucket[];
    switch (period) {
      case "day":
        // Deliberately a rolling 14 days, not two calendar weeks — this view
        // is "recently", and #860 left it alone.
        buckets = aggregateByDay(sessions, 14);
        break;
      case "week":
        buckets = aggregateByWeek(sessions, 8, weekStartsOn);
        break;
      case "month":
        buckets = aggregateByMonth(sessions, 6);
        break;
    }
    return buckets.map((b) => ({
      ...b,
      label: formatDateLabel(b.date, period),
      hours: Math.round((b.totalMinutes / 60) * 10) / 10,
    }));
  }, [sessions, period, weekStartsOn]);

  return (
    <ChartCard title={labels.workTime} control={control}>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={data}
            margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
          >
            <CartesianGrid {...CHART_GRID} />
            <XAxis
              dataKey="label"
              tick={CHART_TICK_11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={CHART_TICK_11}
              tickLine={false}
              axisLine={false}
              unit="h"
            />
            <Tooltip
              cursor={{ fill: "var(--color-lumen-hover)" }}
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number | undefined) => [
                `${value ?? 0}h`,
                labels.workTime,
              ]}
            />
            <Bar
              dataKey="hours"
              fill="var(--color-lumen-accent)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
