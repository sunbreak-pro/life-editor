import { useMemo, useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { TimerSession } from "../../types/timer";
import type { TimerSettings } from "../../types/timer";
import { aggregatePomodoroRate } from "../../utils/analyticsAggregation";
import { getDataService } from "../../services";

interface PomodoroCompletionRateProps {
  sessions: TimerSession[];
  days: number;
}

export function PomodoroCompletionRate({
  sessions,
  days,
}: PomodoroCompletionRateProps) {
  const { t } = useTranslation();
  const [timerSettings, setTimerSettings] = useState<TimerSettings | null>(
    null,
  );

  useEffect(() => {
    getDataService().fetchTimerSettings().then(setTimerSettings);
  }, []);

  const targetPerDay = timerSettings?.targetSessions ?? 4;

  const data = useMemo(
    () =>
      aggregatePomodoroRate(sessions, targetPerDay, days).map((d) => ({
        ...d,
        date: d.date.substring(5), // MM-DD
      })),
    [sessions, targetPerDay, days],
  );

  return (
    <div>
      <h3 className="text-sm font-semibold text-notion-text mb-3">
        {t("analytics.pomodoroRate.title")}
      </h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
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
              formatter={(value: number, name: string) => {
                const label =
                  name === "actual"
                    ? t("analytics.pomodoroRate.actual")
                    : t("analytics.pomodoroRate.target");
                return [value, label];
              }}
            />
            <ReferenceLine
              y={targetPerDay}
              stroke="var(--color-notion-text-secondary, #999)"
              strokeDasharray="5 5"
              label={{
                value: t("analytics.pomodoroRate.target"),
                fontSize: 10,
                fill: "var(--color-notion-text-secondary, #999)",
              }}
            />
            <Area
              type="monotone"
              dataKey="actual"
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
