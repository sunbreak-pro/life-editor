import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { TimerSession } from "../../types/timer";
import type { WikiTag, WikiTagAssignment } from "../../types/wikiTagUnified";
import { aggregateWorkTimeByTag } from "../../utils/analyticsAggregation";
import { ChartCard } from "./ChartCard";
import { CHART_TOOLTIP_STYLE } from "./chartTheme";

export interface TagWorkTimeChartLabels {
  title: string;
  noData: string;
  /** Slice label for work on tasks that carry no tag. */
  untagged: string;
  formatHours: (minutes: number) => string;
}

interface TagWorkTimeChartProps {
  sessions: TimerSession[];
  assignments: WikiTagAssignment[];
  tags: WikiTag[];
  labels: TagWorkTimeChartLabels;
}

// Fallback palette for tags with no colour of their own. Data-series colours
// for distinct categories, not themeable container chrome — sourced from the
// centralized --color-chart-cat-* tokens (tokens.css).
const COLORS = [
  "var(--color-chart-cat-1)",
  "var(--color-chart-cat-2)",
  "var(--color-chart-cat-3)",
  "var(--color-chart-cat-4)",
  "var(--color-chart-cat-5)",
  "var(--color-chart-cat-6)",
  "var(--color-chart-cat-7)",
  "var(--color-chart-cat-8)",
  "var(--color-chart-cat-9)",
  "var(--color-chart-cat-10)",
];

// The untagged slice stays deliberately muted so tagged work reads first.
const UNTAGGED_COLOR = "var(--color-lumen-text-tertiary)";

/*
 * Work time split by life-tag (#334). Replaces the folder-based "Project work
 * time" chart: folders are gone since #225, so that chart could only ever
 * render empty. A tag's slice is its share of real work time — sessions on
 * multi-tag tasks are split evenly and untagged work keeps its own slice, so
 * the ring always adds up to the time actually logged.
 */
export function TagWorkTimeChart({
  sessions,
  assignments,
  tags,
  labels,
}: TagWorkTimeChartProps): React.JSX.Element {
  const data = useMemo(
    () =>
      aggregateWorkTimeByTag(sessions, assignments, tags).map((d) => ({
        name: d.tagName ?? labels.untagged,
        value: Math.round(d.totalMinutes),
        color: d.tagId === null ? UNTAGGED_COLOR : d.tagColor,
      })),
    [sessions, assignments, tags, labels.untagged],
  );

  if (data.length === 0) {
    return (
      <ChartCard title={labels.title}>
        <p className="py-4 text-center text-xs text-lumen-text-secondary">
          {labels.noData}
        </p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title={labels.title}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={40}
              paddingAngle={2}
              label={({ name, percent }) =>
                `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
              }
              labelLine={{ strokeWidth: 1 }}
            >
              {data.map((d, index) => (
                <Cell
                  key={index}
                  fill={d.color ?? COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number | undefined) =>
                labels.formatHours(value ?? 0)
              }
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
