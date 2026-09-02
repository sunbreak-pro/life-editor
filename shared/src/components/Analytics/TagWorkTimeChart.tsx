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
import type { ScheduleItem } from "../../types/schedule";
import type { WikiTag, WikiTagAssignment } from "../../types/wikiTagUnified";
import { aggregateWorkTimeByTag } from "../../utils/analyticsAggregation";
import { ChartCard } from "./ChartCard";
import { CHART_HEIGHT_LG, CHART_TOOLTIP_STYLE } from "./chartTheme";

export interface TagWorkTimeChartLabels {
  title: string;
  noData: string;
  /** Slice label for work on items that carry no tag. */
  untagged: string;
  /** Slice label for the tags folded together past the top-N cap. */
  other: string;
  formatHours: (minutes: number) => string;
}

interface TagWorkTimeChartProps {
  sessions: TimerSession[];
  /** Live todo tree (`fetchTodoTree` — trashed todos are already absent). */
  nodes: TodoNode[];
  /**
   * Live events (#1375). A session can be measured against an Event since
   * 0029, and an event MISSING from this list reads as work on a trashed item
   * and is dropped from the ring — so this is required, not optional: a host
   * that forgot it would silently lose event work rather than fail to compile.
   */
  events: ScheduleItem[];
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
 * multi-tag items split their minutes evenly, tags past the top-N cap fold into
 * "other" and untagged work keeps its own slice, so the ring always adds up to
 * the time actually logged.
 *
 * Todos AND Events since #1375: the timer can be started against a calendar
 * entry, and a ring that read only `task_id` would report the same day as
 * emptier than it was. The two lists are concatenated rather than aggregated
 * separately — a tag lives above the role split (a "study" tag is the same tag
 * whether it sits on a todo or on the class in the calendar), so splitting the
 * ring by role would split each tag's slice in two.
 */
export function TagWorkTimeChart({
  sessions,
  nodes,
  events,
  assignments,
  tags,
  labels,
}: TagWorkTimeChartProps): React.JSX.Element {
  const liveItems = useMemo(() => [...nodes, ...events], [nodes, events]);
  const data = useMemo(
    () =>
      aggregateWorkTimeByTag(sessions, assignments, tags, liveItems).map((d) => {
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
    [sessions, liveItems, assignments, tags, labels.untagged, labels.other],
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
      <ResponsiveContainer width="100%" height={CHART_HEIGHT_LG} minWidth={0}>
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
    </ChartCard>
  );
}
