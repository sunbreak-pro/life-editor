import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TodoNode } from "../../types/todoTree";
import { ChartCard } from "./ChartCard";
import {
  CHART_GRID,
  CHART_HEIGHT_MD,
  CHART_TICK,
  CHART_TOOLTIP_STYLE,
  evenDateTicks,
  MAX_DATE_TICKS,
} from "./chartTheme";
import {
  aggregateTodoCompletionTrend,
  trendDateLabels,
} from "./todoCompletionTrendData";

/*
 * recharts centres the last date label on the plot's right edge, so half of it
 * overhangs into the margin and the svg clips whatever does not fit (#2782).
 * A glyph at CHART_TICK's 10px is at most 6px wide (the monospace setting), so
 * half a label needs 3px per character. Derived from the label rather than
 * fixed because the week that crosses New Year prints the year as well.
 */
const DATE_TICK_OVERHANG_PER_CHAR_PX = 3;

export interface TodoCompletionTrendLabels {
  title: string;
  completedCount: string;
}

interface TodoCompletionTrendProps {
  nodes: TodoNode[];
  days: number;
  labels: TodoCompletionTrendLabels;
  /**
   * Most date labels the X axis may print (#2505). The panel passes
   * NARROW_MAX_DATE_TICKS on a phone, where seven labels do not fit.
   */
  maxDateTicks?: number;
}

export function TodoCompletionTrend({
  nodes,
  days,
  labels,
  maxDateTicks = MAX_DATE_TICKS,
}: TodoCompletionTrendProps): React.JSX.Element {
  const data = useMemo(() => {
    const buckets = aggregateTodoCompletionTrend(nodes, days);
    const dates = trendDateLabels(buckets);
    return buckets.map((b, i) => ({
      date: dates[i],
      completed: b.completedCount,
    }));
  }, [nodes, days]);

  const rightMargin =
    (data[data.length - 1]?.date.length ?? 0) * DATE_TICK_OVERHANG_PER_CHAR_PX +
    1;

  // Even stride counted back from today (#1866) — see `evenDateTicks`.
  const dateTicks = useMemo(
    () =>
      evenDateTicks(
        data.map((d) => d.date),
        maxDateTicks,
      ),
    [data, maxDateTicks],
  );

  return (
    <ChartCard title={labels.title}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT_MD} minWidth={0}>
        <AreaChart
          data={data}
          margin={{ top: 5, right: rightMargin, left: -10, bottom: 0 }}
        >
          <CartesianGrid {...CHART_GRID} />
          <XAxis
            dataKey="date"
            tick={CHART_TICK}
            ticks={dateTicks}
            interval={0}
          />
          <YAxis tick={CHART_TICK} allowDecimals={false} />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value: number | undefined) => [
              value ?? 0,
              labels.completedCount,
            ]}
          />
          <Area
            type="monotone"
            dataKey="completed"
            stroke="var(--color-lumen-accent-secondary)"
            fill="var(--color-lumen-accent-secondary)"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
