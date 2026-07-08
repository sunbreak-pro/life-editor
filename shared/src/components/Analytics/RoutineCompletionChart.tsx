import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ScheduleItem } from "../../types/schedule";
import type { RoutineNode } from "../../types/routine";
import { aggregateRoutineCompletion } from "../../utils/analyticsAggregation";
import { ChartCard } from "./ChartCard";

export interface RoutineCompletionChartLabels {
  title: string;
  rate: string;
}

interface RoutineCompletionChartProps {
  items: ScheduleItem[];
  routines: RoutineNode[];
  labels: RoutineCompletionChartLabels;
}

export function RoutineCompletionChart({
  items,
  routines,
  labels,
}: RoutineCompletionChartProps): React.JSX.Element | null {
  const data = useMemo(
    () =>
      aggregateRoutineCompletion(items, routines).map((d) => ({
        name:
          d.routineTitle.length > 12
            ? d.routineTitle.substring(0, 12) + "..."
            : d.routineTitle,
        rate: d.rate,
        completed: d.completedCount,
        total: d.totalCount,
      })),
    [items, routines],
  );

  if (data.length === 0) return null;

  return (
    <ChartCard title={labels.title}>
      <div style={{ height: Math.max(160, data.length * 32 + 40) }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-lumen-border)"
            />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "var(--color-lumen-text-secondary)" }}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 10, fill: "var(--color-lumen-text-secondary)" }}
              width={100}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-lumen-bg)",
                border: "1px solid var(--color-lumen-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number | undefined) => [
                `${value ?? 0}%`,
                labels.rate,
              ]}
            />
            <Bar
              dataKey="rate"
              fill="var(--color-lumen-accent-secondary)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
