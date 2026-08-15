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
import type { TodoNode } from "../../types/todoTree";
import type { WikiTag, WikiTagAssignment } from "../../types/wikiTagUnified";
import { aggregateWorkTimeByTag } from "../../utils/analyticsAggregation";
import { ChartCard } from "./ChartCard";
import { CHART_TOOLTIP_STYLE } from "./chartTheme";

export interface TagWorkTimeChartLabels {
  title: string;
  noData: string;
  /** Slice label for work on todos that carry no tag. */
  untagged: string;
  /** Slice label for the tags folded together past the top-N cap. */
  other: string;
  formatHours: (minutes: number) => string;
}

interface TagWorkTimeChartProps {
  sessions: TimerSession[];
  /** Live todo tree (`fetchTodoTree` — trashed todos are already absent). */
  nodes: TodoNode[];
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

// The two synthetic slices stay deliberately muted so named tags read first.
const UNTAGGED_COLOR = "var(--color-lumen-text-tertiary)";
const OTHER_COLOR = "var(--color-lumen-text-secondary)";

/*
 * Work time split by life-tag (#334). Replaces the folder-based "Project work
 * time" chart: folders are gone since #225, so that chart could only ever
 * render empty. A tag's slice is its share of real work time — sessions on
 * multi-tag todos split their minutes evenly, tags past the top-N cap fold into
 * "other" and untagged work keeps its own slice, so the ring always adds up to
 * the time actually logged.
 */
export function TagWorkTimeChart({
  sessions,
  nodes,
  assignments,
  tags,
  labels,
}: TagWorkTimeChartProps): React.JSX.Element {
  const data = useMemo(
    () =>
      aggregateWorkTimeByTag(sessions, assignments, tags, nodes).map((d) => {
        if (d.kind === "untagged") {
          return {
            name: labels.untagged,
            value: d.totalMinutes,
            color: UNTAGGED_COLOR,
          };
        }
        if (d.kind === "other") {
          return {
            name: labels.other,
            value: d.totalMinutes,
            color: OTHER_COLOR,
          };
        }
        // Raw (unrounded) minutes: recharts derives each share from these, and
        // rounding per slice would drift the ring off the real total. The
        // tooltip formats them for display.
        return {
          name: d.tagName,
          value: d.totalMinutes,
          color: d.tagColor,
        };
      }),
    [sessions, nodes, assignments, tags, labels.untagged, labels.other],
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
