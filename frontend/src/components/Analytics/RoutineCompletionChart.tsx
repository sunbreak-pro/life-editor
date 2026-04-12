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
import { useTranslation } from "react-i18next";
import type { ScheduleItem } from "../../types/schedule";
import type { RoutineNode } from "../../types/routine";
import { aggregateRoutineCompletion } from "../../utils/analyticsAggregation";

interface RoutineCompletionChartProps {
  items: ScheduleItem[];
  routines: RoutineNode[];
}

export function RoutineCompletionChart({
  items,
  routines,
}: RoutineCompletionChartProps) {
  const { t } = useTranslation();

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
    <div>
      <h3 className="text-sm font-semibold text-notion-text mb-3">
        {t("analytics.schedule.routineCompletion.title")}
      </h3>
      <div style={{ height: Math.max(160, data.length * 32 + 40) }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-notion-border, #e5e5e5)"
            />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{
                fontSize: 10,
                fill: "var(--color-notion-text-secondary, #999)",
              }}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{
                fontSize: 10,
                fill: "var(--color-notion-text-secondary, #999)",
              }}
              width={100}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-notion-bg, #fff)",
                border: "1px solid var(--color-notion-border, #e5e5e5)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number | undefined) => [
                `${value ?? 0}%`,
                t("analytics.schedule.routineCompletion.rate"),
              ]}
            />
            <Bar
              dataKey="rate"
              fill="var(--color-notion-success, #22c55e)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
