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
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-lumen-border)"
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "var(--color-lumen-text-secondary)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--color-lumen-text-secondary)" }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-lumen-bg)",
                border: "1px solid var(--color-lumen-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
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
