import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { TodoNode } from "../../types/todoTree";
import { aggregateTodoStagnation } from "../../utils/analyticsAggregation";
import { ChartCard } from "./ChartCard";
import {
  CHART_GRID,
  CHART_HEIGHT_SM,
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
} from "./chartTheme";

export interface TodoStagnationChartLabels {
  title: string;
  todos: string;
}

interface TodoStagnationChartProps {
  nodes: TodoNode[];
  labels: TodoStagnationChartLabels;
}

export function TodoStagnationChart({
  nodes,
  labels,
}: TodoStagnationChartProps): React.JSX.Element | null {
  const data = useMemo(() => aggregateTodoStagnation(nodes), [nodes]);

  const hasData = data.some((d) => d.count > 0);
  if (!hasData) return null;

  return (
    <ChartCard title={labels.title}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT_SM} minWidth={0}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 10, bottom: 0 }}
        >
          <CartesianGrid {...CHART_GRID} horizontal={false} />
          <XAxis type="number" tick={CHART_TICK} allowDecimals={false} />
          <YAxis dataKey="label" type="category" tick={CHART_TICK} width={80} />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            /* [value, name] — the second element is the series name (#943).
               The bar's dataKey is "count", so the label has to be supplied
               here or the tooltip row reads as a bare number. */
            formatter={(value: number | undefined) => [
              value ?? 0,
              labels.todos,
            ]}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
