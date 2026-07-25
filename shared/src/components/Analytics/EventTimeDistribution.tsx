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
import type { ScheduleItem } from "../../types/schedule";
import { aggregateEventsByHour } from "../../utils/analyticsAggregation";
import { ChartCard } from "./ChartCard";
import { CHART_GRID, CHART_TICK, CHART_TOOLTIP_STYLE } from "./chartTheme";

export interface EventTimeDistributionLabels {
  title: string;
  count: string;
}

interface EventTimeDistributionProps {
  items: ScheduleItem[];
  labels: EventTimeDistributionLabels;
}

export function EventTimeDistribution({
  items,
  labels,
}: EventTimeDistributionProps): React.JSX.Element {
  const data = useMemo(
    () =>
      aggregateEventsByHour(items).map((d) => ({
        hour: `${d.hour}`,
        count: d.count,
      })),
    [items],
  );

  return (
    <ChartCard title={labels.title}>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid {...CHART_GRID} />
            <XAxis
              dataKey="hour"
              tick={CHART_TICK}
              interval={2}
            />
            <YAxis
              tick={CHART_TICK}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number | undefined) => [
                value ?? 0,
                labels.count,
              ]}
              labelFormatter={(label) => `${label}:00`}
            />
            <Bar
              dataKey="count"
              fill="var(--color-lumen-accent)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
