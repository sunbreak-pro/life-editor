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
    <div>
      <h3 className="text-sm font-semibold text-ink-text mb-3">
        {labels.title}
      </h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={data}
            margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-ink-border, #e5e5e5)"
            />
            <XAxis
              dataKey="hour"
              tick={{
                fontSize: 10,
                fill: "var(--color-ink-text-secondary, #999)",
              }}
              interval={2}
            />
            <YAxis
              tick={{
                fontSize: 10,
                fill: "var(--color-ink-text-secondary, #999)",
              }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-ink-bg, #fff)",
                border: "1px solid var(--color-ink-border, #e5e5e5)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number | undefined) => [
                value ?? 0,
                labels.count,
              ]}
              labelFormatter={(label) => `${label}:00`}
            />
            <Bar
              dataKey="count"
              fill="var(--color-ink-accent, #2563eb)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
