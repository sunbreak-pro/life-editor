import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { TimerSession } from "../../types/timer";
import { aggregateWorkBreakBalance } from "../../utils/analyticsAggregation";

interface WorkBreakBalanceProps {
  sessions: TimerSession[];
  days: number;
}

export function WorkBreakBalance({ sessions, days }: WorkBreakBalanceProps) {
  const { t } = useTranslation();

  const data = useMemo(
    () =>
      aggregateWorkBreakBalance(sessions, days).map((d) => ({
        date: d.date.substring(5), // MM-DD
        [t("analytics.workBreak.work")]: Math.round(d.workMinutes),
        [t("analytics.workBreak.break")]: Math.round(d.breakMinutes),
        [t("analytics.workBreak.longBreak")]: Math.round(d.longBreakMinutes),
      })),
    [sessions, days, t],
  );

  return (
    <div>
      <h3 className="text-sm font-semibold text-notion-text mb-3">
        {t("analytics.workBreak.title")}
      </h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
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
              unit="m"
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-notion-bg, #fff)",
                border: "1px solid var(--color-notion-border, #e5e5e5)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number | undefined) => [`${value ?? 0}m`]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              dataKey={t("analytics.workBreak.work")}
              stackId="a"
              fill="var(--color-notion-accent, #2563eb)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey={t("analytics.workBreak.break")}
              stackId="a"
              fill="var(--color-notion-success, #22c55e)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey={t("analytics.workBreak.longBreak")}
              stackId="a"
              fill="#f59e0b"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
