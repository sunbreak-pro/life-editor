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
import { aggregateByTodo } from "../../utils/analyticsAggregation";
import { ChartCard } from "./ChartCard";
import { CHART_GRID, CHART_TICK_11, CHART_TOOLTIP_STYLE } from "./chartTheme";

export interface TodoWorkTimeChartLabels {
  title: string;
  /** Lower-cased "sessions" word for the tooltip suffix. */
  sessions: string;
  /** Row name for work that was measured against no todo at all (#1478). */
  noTodo: string;
}

interface TodoWorkTimeChartProps {
  sessions: TimerSession[];
  todoNameMap: Map<string, string>;
  labels: TodoWorkTimeChartLabels;
}

export function TodoWorkTimeChart({
  sessions,
  todoNameMap,
  labels,
}: TodoWorkTimeChartProps): React.JSX.Element | null {
  const data = useMemo(() => {
    return aggregateByTodo(sessions, todoNameMap).map((b) => {
      /* The bucket for sessions with no todo id is named HERE, not in the
         aggregation (#1478). `aggregateByTodo` keeps an English default for
         non-UI callers, but that string was reaching the ja axis as
         "No Todo" while the ring beside it said 「タグなし」. Labels arrive
         through props in this codebase, so the chart owns the wording. */
      const fullName = b.todoId === "__none__" ? labels.noTodo : b.todoName;
      return {
        name: fullName.length > 20 ? fullName.slice(0, 18) + "..." : fullName,
        fullName,
        hours: Math.round((b.totalMinutes / 60) * 10) / 10,
        sessions: b.sessionCount,
      };
    });
  }, [sessions, todoNameMap, labels.noTodo]);

  if (data.length === 0) return null;

  const barHeight = 32;
  const chartHeight = Math.max(120, data.length * barHeight + 40);

  return (
    <ChartCard title={labels.title}>
      <ResponsiveContainer width="100%" height={chartHeight} minWidth={0}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
        >
          <CartesianGrid {...CHART_GRID} horizontal={false} />
          {/* Decimal ticks are intentional here (#944) — `hours` keeps one
              decimal, so integer-only ticks would drop real resolution. */}
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
    </ChartCard>
  );
}
