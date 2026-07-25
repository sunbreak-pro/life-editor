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
import type { TimerSession } from "../../types/timer";
import { aggregateWorkBreakBalance } from "../../utils/analyticsAggregation";
import { ChartCard } from "./ChartCard";
import { CHART_GRID, CHART_TICK, CHART_TOOLTIP_STYLE } from "./chartTheme";

export interface WorkBreakBalanceLabels {
  title: string;
  work: string;
  break: string;
  longBreak: string;
}

interface WorkBreakBalanceProps {
  sessions: TimerSession[];
  days: number;
  labels: WorkBreakBalanceLabels;
}

export function WorkBreakBalance({
  sessions,
  days,
  labels,
}: WorkBreakBalanceProps): React.JSX.Element {
  const data = useMemo(
    () =>
      aggregateWorkBreakBalance(sessions, days).map((d) => ({
        date: d.date.substring(5), // MM-DD
        [labels.work]: Math.round(d.workMinutes),
        [labels.break]: Math.round(d.breakMinutes),
        [labels.longBreak]: Math.round(d.longBreakMinutes),
      })),
    [sessions, days, labels.work, labels.break, labels.longBreak],
  );

  return (
    <ChartCard title={labels.title}>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid {...CHART_GRID} />
            <XAxis
              dataKey="date"
              tick={CHART_TICK}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={CHART_TICK}
              unit="m"
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number | undefined) => [`${value ?? 0}m`]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              dataKey={labels.work}
              stackId="a"
              fill="var(--color-lumen-accent)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey={labels.break}
              stackId="a"
              fill="var(--color-lumen-accent-secondary)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey={labels.longBreak}
              stackId="a"
              fill="var(--color-chart-cat-7)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
