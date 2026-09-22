import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  ResponsiveContainer,
} from "recharts";
import type { ScheduleItem } from "../../types/schedule";
import type { RoutineNode } from "../../types/routine";
import { aggregateRoutineCompletion } from "../../utils/analyticsAggregation";
import { ChartCard } from "./ChartCard";
import {
  CHART_GRID,
  CHART_HEIGHT_SM,
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
  fitAxisLabel,
} from "./chartTheme";

export interface RoutineCompletionChartLabels {
  title: string;
  rate: string;
}

/*
 * The Y gutter, in px. recharts right-aligns a tick against the axis line with
 * a 6px tick mark and a 2px gap, so the text itself gets GUTTER - 8; the label
 * budget keeps a little more clear of the edge than that (#1862).
 */
const LABEL_GUTTER_PX = 100;
const LABEL_MAX_PX = LABEL_GUTTER_PX - 12;

interface RoutineCompletionChartProps {
  items: ScheduleItem[];
  routines: RoutineNode[];
  labels: RoutineCompletionChartLabels;
}

export function RoutineCompletionChart({
  items,
  routines,
  labels,
}: RoutineCompletionChartProps): React.JSX.Element | null {
  const data = useMemo(
    () =>
      aggregateRoutineCompletion(items, routines).map((d) => ({
        // Cut by estimated WIDTH, not by character count: twelve full-width
        // characters are ~105px and ran out of the 100px gutter (#1862).
        name: fitAxisLabel(d.routineTitle, LABEL_MAX_PX, CHART_TICK.fontSize),
        rate: d.rate,
        completed: d.completedCount,
        total: d.totalCount,
      })),
    [items, routines],
  );

  if (data.length === 0) return null;

  return (
    <ChartCard title={labels.title}>
      <ResponsiveContainer
        width="100%"
        height={Math.max(CHART_HEIGHT_SM, data.length * 32 + 40)}
        minWidth={0}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
        >
          <CartesianGrid {...CHART_GRID} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={CHART_TICK}
            allowDecimals={false}
            tickFormatter={(v) => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={CHART_TICK}
            width={LABEL_GUTTER_PX}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value: number | undefined) => [
              `${value ?? 0}%`,
              labels.rate,
            ]}
          />
          <Bar
            dataKey="rate"
            fill="var(--color-lumen-accent-secondary)"
            radius={[0, 4, 4, 0]}
            // A 0% bar has no length, so a chart of all-zero routines was
            // labels over an empty grid and read as broken (#1862). The stub
            // marks where the bar starts and the number says what it is — the
            // mobile view already prints "0%" for the same data.
            minPointSize={2}
          >
            <LabelList
              dataKey="rate"
              position="right"
              formatter={(value: unknown) => `${Number(value ?? 0)}%`}
              style={CHART_TICK}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
