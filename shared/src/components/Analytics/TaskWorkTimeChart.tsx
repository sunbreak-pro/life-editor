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
import { ChartCard } from "./ChartCard";
import { CHART_GRID, CHART_TICK_11, CHART_TOOLTIP_STYLE } from "./chartTheme";

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
    <ChartCard title={labels.title}>
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
          >
            <CartesianGrid {...CHART_GRID} horizontal={false} />
            <XAxis
              type="number"
              tick={CHART_TICK_11}
              tickLine={false}
              axisLine={false}
              unit="h"
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={CHART_TICK_11}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--color-lumen-hover)" }}
              contentStyle={CHART_TOOLTIP_STYLE}
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
              fill="var(--color-lumen-accent)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
