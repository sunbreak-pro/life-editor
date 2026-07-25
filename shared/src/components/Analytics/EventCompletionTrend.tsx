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
import { aggregateEventCompletionByDay } from "../../utils/analyticsAggregation";
import { ChartCard } from "./ChartCard";
import { CHART_GRID, CHART_TICK, CHART_TOOLTIP_STYLE } from "./chartTheme";

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
  const data = useMemo(
    () =>
      aggregateEventCompletionByDay(items, days).map((d) => ({
        date: d.date.substring(5),
        completed: d.completedCount,
      })),
    [items, days],
  );

  return (
    <ChartCard title={labels.title}>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid {...CHART_GRID} />
            <XAxis
              dataKey="date"
              tick={CHART_TICK}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={CHART_TICK}
              allowDecimals={false}
            />
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
      </div>
    </ChartCard>
  );
}
