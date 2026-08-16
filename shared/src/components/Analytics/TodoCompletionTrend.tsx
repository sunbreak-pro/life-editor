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
import type { TodoNode } from "../../types/todoTree";
import { aggregateTodoCompletionTrend } from "../../utils/analyticsAggregation";
import { ChartCard } from "./ChartCard";
import {
  CHART_GRID,
  CHART_HEIGHT_MD,
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
} from "./chartTheme";

export interface TodoCompletionTrendLabels {
  title: string;
  completedCount: string;
}

interface TodoCompletionTrendProps {
  nodes: TodoNode[];
  days: number;
  labels: TodoCompletionTrendLabels;
}

export function TodoCompletionTrend({
  nodes,
  days,
  labels,
}: TodoCompletionTrendProps): React.JSX.Element {
  const data = useMemo(
    () =>
      aggregateTodoCompletionTrend(nodes, days).map((d) => ({
        date: d.date.substring(5), // MM-DD
        completed: d.completedCount,
      })),
    [nodes, days],
  );

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
    </ChartCard>
  );
}
