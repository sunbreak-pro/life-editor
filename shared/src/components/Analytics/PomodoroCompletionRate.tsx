import { useMemo } from "react";
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
import type { TimerSession } from "../../types/timer";
import { aggregatePomodoroRate } from "../../utils/analyticsAggregation";

export interface PomodoroCompletionRateLabels {
  title: string;
  actual: string;
  target: string;
}

interface PomodoroCompletionRateProps {
  sessions: TimerSession[];
  days: number;
  /**
   * Target completed WORK sessions per day. In frontend this came from
   * getDataService().fetchTimerSettings(); per §6.4 the host now fetches it and
   * injects it (defaults to 4 at the host).
   */
  targetPerDay: number;
  labels: PomodoroCompletionRateLabels;
}

export function PomodoroCompletionRate({
  sessions,
  days,
  targetPerDay,
  labels,
}: PomodoroCompletionRateProps): React.JSX.Element {
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
      <h3 className="text-sm font-semibold text-lumen-text mb-3">
        {labels.title}
      </h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart
            data={data}
            margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-lumen-border, #e5e5e5)"
            />
            <XAxis
              dataKey="date"
              tick={{
                fontSize: 10,
                fill: "var(--color-lumen-text-secondary, #999)",
              }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{
                fontSize: 10,
                fill: "var(--color-lumen-text-secondary, #999)",
              }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-lumen-bg, #fff)",
                border: "1px solid var(--color-lumen-border, #e5e5e5)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(
                value: number | undefined,
                name: string | undefined,
              ) => {
                const label = name === "actual" ? labels.actual : labels.target;
                return [value ?? 0, label];
              }}
            />
            <ReferenceLine
              y={targetPerDay}
              stroke="var(--color-lumen-text-secondary, #999)"
              strokeDasharray="5 5"
              label={{
                value: labels.target,
                fontSize: 10,
                fill: "var(--color-lumen-text-secondary, #999)",
              }}
            />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="var(--color-lumen-accent, #1d4ed8)"
              fill="var(--color-lumen-accent, #1d4ed8)"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
