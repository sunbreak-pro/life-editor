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
import type { ScheduleItem } from "../../types/schedule";
import { aggregateEventCompletionByDay } from "../../utils/analyticsAggregation";

interface EventCompletionTrendProps {
  items: ScheduleItem[];
  days: number;
}

export function EventCompletionTrend({
  items,
  days,
}: EventCompletionTrendProps) {
  const { t } = useTranslation();

  const data = useMemo(
    () =>
      aggregateEventCompletionByDay(items, days).map((d) => ({
        date: d.date.substring(5),
        completed: d.completedCount,
      })),
    [items, days],
  );

  return (
    <div>
      <h3 className="text-sm font-semibold text-notion-text mb-3">
        {t("analytics.schedule.eventTrend.title")}
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
                t("analytics.schedule.eventTrend.completed"),
              ]}
            />
            <Area
              type="monotone"
              dataKey="completed"
              stroke="var(--color-notion-accent, #2563eb)"
              fill="var(--color-notion-accent, #2563eb)"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
