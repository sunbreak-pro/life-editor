import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { TimerSession } from "../../types/timer";
import type { TaskNode } from "../../types/taskTree";
import { aggregateByFolder } from "../../utils/analyticsAggregation";
import { ChartCard } from "./ChartCard";

export interface ProjectWorkTimeChartLabels {
  title: string;
  noData: string;
  formatHours: (minutes: number) => string;
}

interface ProjectWorkTimeChartProps {
  sessions: TimerSession[];
  nodes: TaskNode[];
  labels: ProjectWorkTimeChartLabels;
}

// Categorical palette for the pie slices (one tint per project). Data-series
// colours for distinct categories, not themeable container chrome — sourced
// from the centralized --color-chart-cat-* tokens (tokens.css).
const COLORS = [
  "var(--color-chart-cat-1)",
  "var(--color-chart-cat-2)",
  "var(--color-chart-cat-3)",
  "var(--color-chart-cat-4)",
  "var(--color-chart-cat-5)",
  "var(--color-chart-cat-6)",
  "var(--color-chart-cat-7)",
  "var(--color-chart-cat-8)",
  "var(--color-chart-cat-9)",
  "var(--color-chart-cat-10)",
];

export function ProjectWorkTimeChart({
  sessions,
  nodes,
  labels,
}: ProjectWorkTimeChartProps): React.JSX.Element {
  const data = useMemo(
    () =>
      aggregateByFolder(sessions, nodes).map((d) => ({
        name: d.folderName,
        value: Math.round(d.totalMinutes),
        taskCount: d.taskCount,
      })),
    [sessions, nodes],
  );

  if (data.length === 0) {
    return (
      <ChartCard title={labels.title}>
        <p className="py-4 text-center text-xs text-lumen-text-secondary">
          {labels.noData}
        </p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title={labels.title}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={40}
              paddingAngle={2}
              label={({ name, percent }) =>
                `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
              }
              labelLine={{ strokeWidth: 1 }}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--color-lumen-bg)",
                border: "1px solid var(--color-lumen-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number | undefined) =>
                labels.formatHours(value ?? 0)
              }
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
