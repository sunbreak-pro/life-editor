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
import { useTranslation } from "react-i18next";
import type { TaskNode } from "../../types/taskTree";
import { aggregateTaskStagnation } from "../../utils/analyticsAggregation";

interface TaskStagnationChartProps {
  nodes: TaskNode[];
}

export function TaskStagnationChart({ nodes }: TaskStagnationChartProps) {
  const { t } = useTranslation();

  const data = useMemo(() => aggregateTaskStagnation(nodes), [nodes]);

  const hasData = data.some((d) => d.count > 0);
  if (!hasData) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-notion-text mb-3">
        {t("analytics.stagnation.title")}
      </h3>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 10, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-notion-border, #e5e5e5)"
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{
                fontSize: 10,
                fill: "var(--color-notion-text-secondary, #999)",
              }}
              allowDecimals={false}
            />
            <YAxis
              dataKey="label"
              type="category"
              tick={{
                fontSize: 10,
                fill: "var(--color-notion-text-secondary, #999)",
              }}
              width={80}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-notion-bg, #fff)",
                border: "1px solid var(--color-notion-border, #e5e5e5)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number) => [
                `${value} ${t("analytics.stagnation.tasks")}`,
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
