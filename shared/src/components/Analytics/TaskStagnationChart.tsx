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
    <div>
      <h3 className="text-sm font-semibold text-ink-text mb-3">
        {labels.title}
      </h3>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 10, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-ink-border, #e5e5e5)"
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{
                fontSize: 10,
                fill: "var(--color-ink-text-secondary, #999)",
              }}
              allowDecimals={false}
            />
            <YAxis
              dataKey="label"
              type="category"
              tick={{
                fontSize: 10,
                fill: "var(--color-ink-text-secondary, #999)",
              }}
              width={80}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-ink-bg, #fff)",
                border: "1px solid var(--color-ink-border, #e5e5e5)",
                borderRadius: 8,
                fontSize: 12,
              }}
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
    </div>
  );
}
