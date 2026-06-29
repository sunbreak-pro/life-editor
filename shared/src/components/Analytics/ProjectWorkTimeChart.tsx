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
  "var(--color-chart-cat-1, #2563eb)",
  "var(--color-chart-cat-2, #22c55e)",
  "var(--color-chart-cat-3, #f59e0b)",
  "var(--color-chart-cat-4, #ef4444)",
  "var(--color-chart-cat-5, #8b5cf6)",
  "var(--color-chart-cat-6, #ec4899)",
  "var(--color-chart-cat-7, #06b6d4)",
  "var(--color-chart-cat-8, #84cc16)",
  "var(--color-chart-cat-9, #f97316)",
  "var(--color-chart-cat-10, #6366f1)",
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
      <div>
        <h3 className="text-sm font-semibold text-ink-text mb-3">
          {labels.title}
        </h3>
        <p className="text-xs text-ink-text-secondary text-center py-4">
          {labels.noData}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-ink-text mb-3">
        {labels.title}
      </h3>
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
                background: "var(--color-ink-bg, #fff)",
                border: "1px solid var(--color-ink-border, #e5e5e5)",
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
    </div>
  );
}
