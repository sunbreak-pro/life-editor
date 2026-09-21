import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ScheduleItem } from "../../types/schedule";
import {
  aggregateEventCompletionByDay,
  rollUpTrendBuckets,
  trendBucketLabel,
  trendGranularity,
  trendSpansYears,
} from "../../utils/analyticsAggregation";
import { WEEK_STARTS_ON } from "../../utils/scheduleGridLayout";
import { ChartCard } from "./ChartCard";
import {
  CHART_GRID,
  CHART_HEIGHT_MD,
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
} from "./chartTheme";

export interface EventCompletionTrendLabels {
  title: string;
  completed: string;
}

interface EventCompletionTrendProps {
  items: ScheduleItem[];
  days: number;
  labels: EventCompletionTrendLabels;
}

export function EventCompletionTrend({
  items,
  days,
  labels,
}: EventCompletionTrendProps): React.JSX.Element {
  // #1861: one point per day stops being readable once the span is long (the
  // "All time" preset), so long spans fold into week / month buckets and the
  // label grows a year as soon as the series crosses one.
  const data = useMemo(() => {
    const granularity = trendGranularity(days);
    const buckets = rollUpTrendBuckets(
      aggregateEventCompletionByDay(items, days),
      granularity,
      WEEK_STARTS_ON,
      (into, day) => {
        into.completedCount += day.completedCount;
        into.totalCount += day.totalCount;
      },
    );
    const spansYears = trendSpansYears(buckets);
    return buckets.map((d) => ({
      date: trendBucketLabel(d.date, granularity, spansYears),
      completed: d.completedCount,
    }));
  }, [items, days]);

  return (
    <ChartCard title={labels.title}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT_MD} minWidth={0}>
        <AreaChart
          data={data}
          margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
        >
          <CartesianGrid {...CHART_GRID} />
          <XAxis dataKey="date" tick={CHART_TICK} interval="preserveStartEnd" />
          <YAxis tick={CHART_TICK} allowDecimals={false} />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value: number | undefined) => [
              value ?? 0,
              labels.completed,
            ]}
          />
          <Area
            type="monotone"
            dataKey="completed"
            stroke="var(--color-lumen-accent)"
            fill="var(--color-lumen-accent)"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
