import { useMemo, type ReactNode } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TimerSession } from "../../types/timer";
import type { Period } from "./PeriodSelector";
import {
  aggregateByDay,
  aggregateByWeek,
  aggregateByMonth,
  type DayBucket,
} from "../../utils/analyticsAggregation";
import { WEEK_STARTS_ON } from "../../utils/scheduleGridLayout";
import { ChartCard } from "./ChartCard";
import {
  CHART_GRID,
  CHART_HEIGHT_MD,
  CHART_TICK_11,
  CHART_TOOLTIP_STYLE,
  DURATION_AXIS_WIDTH,
  type ChartAxisFormat,
} from "./chartTheme";

export interface WorkTimeChartLabels {
  /** Chart heading + tooltip series name. */
  workTime: string;
}

interface WorkTimeChartProps {
  sessions: TimerSession[];
  period: Period;
  labels: WorkTimeChartLabels;
  /** Date / duration vocabulary shared by every chart on the tab (#1864). */
  axis: ChartAxisFormat;
  /** Optional right-aligned control slot (the day/week/month period pills). */
  control?: ReactNode;
}

export function WorkTimeChart({
  sessions,
  period,
  labels,
  axis,
  control,
}: WorkTimeChartProps): React.JSX.Element {
  // The weekly buckets start on the app's week-start day (#860 / #1102). They
  // used to start on a hardcoded Monday of their own, so this chart cut the
  // same sessions along a different boundary than the "this week" cards.
  const data = useMemo(() => {
    let buckets: DayBucket[];
    switch (period) {
      case "day":
        // Deliberately a rolling 14 days, not two calendar weeks — this view
        // is "recently", and #860 left it alone.
        buckets = aggregateByDay(sessions, 14);
        break;
      case "week":
        buckets = aggregateByWeek(sessions, 8, WEEK_STARTS_ON);
        break;
      case "month":
        buckets = aggregateByMonth(sessions, 6);
        break;
    }
    return buckets.map((b) => ({
      ...b,
      // `period` doubles as the bucket unit: a "week" bucket's key is the
      // week's first day, a "month" bucket's the 1st of the month.
      label: axis.date(b.date, period),
      // Whole minutes, not decimal hours (#1864): the axis used to read
      // "0.15h" under a tile that read "1時間2分". The host's formatter turns
      // minutes into the same words the tiles use.
      minutes: Math.round(b.totalMinutes),
    }));
  }, [sessions, period, axis]);

  return (
    <ChartCard title={labels.workTime} control={control}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT_MD} minWidth={0}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid {...CHART_GRID} />
          <XAxis
            dataKey="label"
            tick={CHART_TICK_11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={CHART_TICK_11}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={DURATION_AXIS_WIDTH}
            tickFormatter={(v: number) => axis.duration(v)}
          />
          <Tooltip
            cursor={{ fill: "var(--color-lumen-hover)" }}
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value: number | undefined) => [
              axis.duration(value ?? 0),
              labels.workTime,
            ]}
          />
          <Bar
            dataKey="minutes"
            fill="var(--color-lumen-accent)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
