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
import {
  CHART_GRID,
  CHART_HEIGHT_MD,
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
} from "./chartTheme";

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
      <ResponsiveContainer width="100%" height={CHART_HEIGHT_MD} minWidth={0}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
        >
          <CartesianGrid {...CHART_GRID} />
          <XAxis dataKey="date" tick={CHART_TICK} interval="preserveStartEnd" />
          {/* Whole minutes only (#944) — the bars are Math.round()ed above, so
              a 0.25m tick subdivides a value that can never land there. */}
          <YAxis tick={CHART_TICK} unit="m" allowDecimals={false} />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            /* recharts destructures a returned array as [value, name] (#943).
               Returning the value alone dropped the name, which on this
               3-series stack left every tooltip row as a bare "0m". */
            formatter={(value: number | undefined, name) => [
              `${value ?? 0}m`,
              name,
            ]}
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
    </ChartCard>
  );
}
