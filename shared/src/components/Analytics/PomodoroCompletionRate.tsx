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
import { ChartCard } from "./ChartCard";
import {
  CHART_GRID,
  CHART_HEIGHT_MD,
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
} from "./chartTheme";

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
    <ChartCard title={labels.title}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT_MD} minWidth={0}>
        <AreaChart
          data={data}
          margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
        >
          <CartesianGrid {...CHART_GRID} />
          <XAxis dataKey="date" tick={CHART_TICK} interval="preserveStartEnd" />
          <YAxis tick={CHART_TICK} allowDecimals={false} />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
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
            stroke="var(--color-lumen-text-secondary)"
            strokeDasharray="5 5"
            label={{
              value: labels.target,
              fontSize: 10,
              fill: "var(--color-lumen-text-secondary)",
            }}
          />
          <Area
            type="monotone"
            dataKey="actual"
            stroke="var(--color-lumen-accent)"
            fill="var(--color-lumen-accent)"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
