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
import type { TimerSession } from "../../types/timer";
import type { Period } from "./PeriodSelector";
import {
  aggregateByDay,
  aggregateByWeek,
  aggregateByMonth,
  type DayBucket,
} from "../../utils/analyticsAggregation";

export interface WorkTimeChartLabels {
  /** Chart heading + tooltip series name. */
  workTime: string;
}

interface WorkTimeChartProps {
  sessions: TimerSession[];
  period: Period;
  labels: WorkTimeChartLabels;
}

function formatDateLabel(dateStr: string, period: Period): string {
  const d = new Date(dateStr + "T00:00:00");
  if (period === "day") {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  if (period === "week") {
    return `${d.getMonth() + 1}/${d.getDate()}~`;
  }
  return `${d.getFullYear()}/${d.getMonth() + 1}`;
}

export function WorkTimeChart({
  sessions,
  period,
  labels,
}: WorkTimeChartProps): React.JSX.Element {
  const data = useMemo(() => {
    let buckets: DayBucket[];
    switch (period) {
      case "day":
        buckets = aggregateByDay(sessions, 14);
        break;
      case "week":
        buckets = aggregateByWeek(sessions, 8);
        break;
      case "month":
        buckets = aggregateByMonth(sessions, 6);
        break;
    }
    return buckets.map((b) => ({
      ...b,
      label: formatDateLabel(b.date, period),
      hours: Math.round((b.totalMinutes / 60) * 10) / 10,
    }));
  }, [sessions, period]);

  return (
    <div className="bg-lumen-bg-secondary rounded-lg p-4 border border-lumen-border">
      <h3 className="text-sm font-semibold text-lumen-text mb-3">
        {labels.workTime}
      </h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={data}
            margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-lumen-text-secondary, #e5e5e5)"
            />
            <XAxis
              dataKey="label"
              tick={{
                fontSize: 11,
                fill: "var(--color-lumen-text-secondary, #999)",
              }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{
                fontSize: 11,
                fill: "var(--color-lumen-text-secondary, #999)",
              }}
              tickLine={false}
              axisLine={false}
              unit="h"
            />
            <Tooltip
              cursor={{ fill: "var(--color-lumen-hover)" }}
              contentStyle={{
                background: "var(--color-lumen-bg, #fff)",
                border: "1px solid var(--color-lumen-border, #e5e5e5)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number | undefined) => [
                `${value ?? 0}h`,
                labels.workTime,
              ]}
            />
            <Bar
              dataKey="hours"
              fill="var(--color-lumen-accent, #1d4ed8)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
