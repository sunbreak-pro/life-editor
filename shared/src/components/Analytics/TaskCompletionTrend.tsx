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
import type { TaskNode } from "../../types/taskTree";
import { aggregateTaskCompletionTrend } from "../../utils/analyticsAggregation";
import { ChartCard } from "./ChartCard";

export interface TaskCompletionTrendLabels {
  title: string;
  completedCount: string;
}

interface TaskCompletionTrendProps {
  nodes: TaskNode[];
  days: number;
  labels: TaskCompletionTrendLabels;
}

export function TaskCompletionTrend({
  nodes,
  days,
  labels,
}: TaskCompletionTrendProps): React.JSX.Element {
  const data = useMemo(
    () =>
      aggregateTaskCompletionTrend(nodes, days).map((d) => ({
        date: d.date.substring(5), // MM-DD
        completed: d.completedCount,
      })),
    [nodes, days],
  );

  return (
    <ChartCard title={labels.title}>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart
            data={data}
            margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
          >
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
                labels.completedCount,
              ]}
            />
            <Area
              type="monotone"
              dataKey="completed"
              stroke="var(--color-lumen-accent-secondary)"
              fill="var(--color-lumen-accent-secondary)"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
