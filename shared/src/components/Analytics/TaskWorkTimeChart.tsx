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
import { aggregateByTask } from "../../utils/analyticsAggregation";

export interface TaskWorkTimeChartLabels {
  title: string;
  /** Lower-cased "sessions" word for the tooltip suffix. */
  sessions: string;
}

interface TaskWorkTimeChartProps {
  sessions: TimerSession[];
  taskNameMap: Map<string, string>;
  labels: TaskWorkTimeChartLabels;
}

export function TaskWorkTimeChart({
  sessions,
  taskNameMap,
  labels,
}: TaskWorkTimeChartProps): React.JSX.Element | null {
  const data = useMemo(() => {
    return aggregateByTask(sessions, taskNameMap).map((b) => ({
      name:
        b.taskName.length > 20 ? b.taskName.slice(0, 18) + "..." : b.taskName,
      fullName: b.taskName,
      hours: Math.round((b.totalMinutes / 60) * 10) / 10,
      sessions: b.sessionCount,
    }));
  }, [sessions, taskNameMap]);

  if (data.length === 0) return null;

  const barHeight = 32;
  const chartHeight = Math.max(120, data.length * barHeight + 40);

  return (
    <div className="bg-ink-bg-secondary rounded-lg p-4 border border-ink-border">
      <h3 className="text-sm font-semibold text-ink-text mb-3">
        {labels.title}
      </h3>
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-ink-text, #e5e5e5)"
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{
                fontSize: 11,
                fill: "var(--color-ink-text-secondary, #999)",
              }}
              tickLine={false}
              axisLine={false}
              unit="h"
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{
                fontSize: 11,
                fill: "var(--color-ink-text-secondary, #999)",
              }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--color-ink-hover)" }}
              contentStyle={{
                background: "var(--color-ink-bg, #fff)",
                border: "1px solid var(--color-ink-border, #e5e5e5)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(
                value: number | undefined,
                _name: string | undefined,
                props: { payload?: { fullName: string; sessions: number } },
              ) => [
                `${value ?? 0}h (${props.payload?.sessions ?? 0} ${labels.sessions.toLowerCase()})`,
                props.payload?.fullName ?? "",
              ]}
            />
            <Bar
              dataKey="hours"
              fill="var(--color-ink-success, #22c55e)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
