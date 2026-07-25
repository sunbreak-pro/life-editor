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
import type { TaskNode } from "../../types/taskTree";
import { aggregateTaskStagnation } from "../../utils/analyticsAggregation";
import { ChartCard } from "./ChartCard";
import { CHART_GRID, CHART_TICK, CHART_TOOLTIP_STYLE } from "./chartTheme";

export interface TaskStagnationChartLabels {
  title: string;
  tasks: string;
}

interface TaskStagnationChartProps {
  nodes: TaskNode[];
  labels: TaskStagnationChartLabels;
}

export function TaskStagnationChart({
  nodes,
  labels,
}: TaskStagnationChartProps): React.JSX.Element | null {
  const data = useMemo(() => aggregateTaskStagnation(nodes), [nodes]);

  const hasData = data.some((d) => d.count > 0);
  if (!hasData) return null;

  return (
    <ChartCard title={labels.title}>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 10, bottom: 0 }}
          >
            <CartesianGrid {...CHART_GRID} horizontal={false} />
            <XAxis
              type="number"
              tick={CHART_TICK}
              allowDecimals={false}
            />
            <YAxis
              dataKey="label"
              type="category"
              tick={CHART_TICK}
              width={80}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number | undefined) => [
                `${value ?? 0} ${labels.tasks}`,
              ]}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
