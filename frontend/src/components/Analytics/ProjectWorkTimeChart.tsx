import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { TimerSession } from "../../types/timer";
import type { TaskNode } from "../../types/taskTree";
import { aggregateByFolder } from "../../utils/analyticsAggregation";

interface ProjectWorkTimeChartProps {
  sessions: TimerSession[];
  nodes: TaskNode[];
}

const COLORS = [
  "#2563eb",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
];

export function ProjectWorkTimeChart({
  sessions,
  nodes,
}: ProjectWorkTimeChartProps) {
  const { t } = useTranslation();

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
        <h3 className="text-sm font-semibold text-notion-text mb-3">
          {t("analytics.projectTime.title")}
        </h3>
        <p className="text-xs text-notion-text-secondary text-center py-4">
          {t("analytics.projectTime.noData")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-notion-text mb-3">
        {t("analytics.projectTime.title")}
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
                background: "var(--color-notion-bg, #fff)",
                border: "1px solid var(--color-notion-border, #e5e5e5)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number | undefined) => {
                const v = value ?? 0;
                const h = Math.floor(v / 60);
                const m = v % 60;
                return [t("analytics.hours", { hours: h, minutes: m })];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
