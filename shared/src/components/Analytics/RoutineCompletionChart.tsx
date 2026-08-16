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
import {
  CHART_GRID,
  CHART_HEIGHT_SM,
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
} from "./chartTheme";

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
      <ResponsiveContainer
        width="100%"
        height={Math.max(CHART_HEIGHT_SM, data.length * 32 + 40)}
        minWidth={0}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
        >
          <CartesianGrid {...CHART_GRID} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={CHART_TICK}
            allowDecimals={false}
            tickFormatter={(v) => `${v}%`}
          />
          <YAxis type="category" dataKey="name" tick={CHART_TICK} width={100} />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
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
    </ChartCard>
  );
}
