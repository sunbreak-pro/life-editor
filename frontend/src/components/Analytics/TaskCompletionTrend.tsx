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
import { useTranslation } from "react-i18next";
import type { TaskNode } from "../../types/taskTree";
import { aggregateTaskCompletionTrend } from "../../utils/analyticsAggregation";

interface TaskCompletionTrendProps {
  nodes: TaskNode[];
  days: number;
}

export function TaskCompletionTrend({ nodes, days }: TaskCompletionTrendProps) {
  const { t } = useTranslation();

  const data = useMemo(
    () =>
      aggregateTaskCompletionTrend(nodes, days).map((d) => ({
        date: d.date.substring(5), // MM-DD
        completed: d.completedCount,
      })),
    [nodes, days],
  );

  return (
    <div>
      <h3 className="text-sm font-semibold text-notion-text mb-3">
        {t("analytics.taskTrend.title")}
      </h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart
            data={data}
            margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-notion-border, #e5e5e5)"
            />
            <XAxis
              dataKey="date"
              tick={{
                fontSize: 10,
                fill: "var(--color-notion-text-secondary, #999)",
              }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{
                fontSize: 10,
                fill: "var(--color-notion-text-secondary, #999)",
              }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-notion-bg, #fff)",
                border: "1px solid var(--color-notion-border, #e5e5e5)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number | undefined) => [
                value ?? 0,
                t("analytics.taskTrend.completedCount"),
              ]}
            />
            <Area
              type="monotone"
              dataKey="completed"
              stroke="var(--color-notion-success, #22c55e)"
              fill="var(--color-notion-success, #22c55e)"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
