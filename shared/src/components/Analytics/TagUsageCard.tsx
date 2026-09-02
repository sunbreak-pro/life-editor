import { useMemo } from "react";
import { Tag } from "lucide-react";
import type { TodoNode } from "../../types/todoTree";
import type { ScheduleItem } from "../../types/schedule";
import type { NoteNode } from "../../types/note";
import type { WikiTag, WikiTagAssignment } from "../../types/wikiTagUnified";
import { formatDateKey } from "../../utils/dateKey";
import {
  aggregateTagUsage,
  type TagUsageItem,
} from "../../utils/analyticsAggregation";
import { ChartCard } from "./ChartCard";
import { AnalyticsEmptyState } from "./AnalyticsEmptyState";
import type { DateRange } from "./AnalyticsFilterContext";

export interface TagUsageCardLabels {
  title: string;
  /** Column header for the tag name. */
  tag: string;
  /** Column header for the RANGE-scoped count. */
  inRange: string;
  /** Column header for the range-INDEPENDENT live count. */
  liveTotal: string;
  /**
   * Human name of the active date-range preset ("Last 30 days"). Shown in the
   * card's meta slot so the range column's window is named, not implied.
   */
  rangeLabel: string;
  /** Designed empty-state copy (no tags, or nothing tagged in the range). */
  empty: { title: string; description: string };
}

interface TagUsageCardProps {
  /** Live todo tree (`fetchTodoTree` — trashed todos are already absent). */
  todos: TodoNode[];
  /**
   * EVERY live event (host: `fetchEvents()`), NOT the date-range window the
   * Schedule tab reads. The right-hand total is defined as range-independent,
   * so a windowed list would make it move with the date preset; and the range
   * column slices on `createdAt`, which a fetch keyed on the event's scheduled
   * DATE cannot answer. Dismissed events are outside `fetchEvents()` and so
   * outside these counts — the same gap `useTaggedItemIndex` documents.
   */
  events: ScheduleItem[];
  notes: NoteNode[];
  assignments: WikiTagAssignment[];
  tags: WikiTag[];
  /** The selected analytics range — drives the left number only. */
  dateRange: DateRange;
  labels: TagUsageCardLabels;
}

// Fallback tint for tags with no colour of their own, matching the tag ring's
// palette so one tag reads the same on both cards.
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

/*
 * Tag usage across Todo / Event / Note (#1379, split out of #1375).
 *
 * Two numbers per tag, and they answer different questions on purpose: how many
 * items created IN THE SELECTED RANGE carry the tag, and how many carry it
 * RIGHT NOW. Both get a column header naming their window, and the range
 * column additionally carries the preset name in the card meta — the file
 * header of analyticsAggregation.ts records what happened (#780 / #860) the
 * last time two differently-defined numbers sat under one label.
 *
 * A table, not a chart: the bar is decoration on the range column, and the
 * numbers themselves are the content. `scope="col"` headers mean a screen
 * reader announces which window a cell belongs to, which is the same guarantee
 * the sighted reader gets from the header row.
 */
export function TagUsageCard({
  todos,
  events,
  notes,
  assignments,
  tags,
  dateRange,
  labels,
}: TagUsageCardProps): React.JSX.Element {
  const rows = useMemo(() => {
    // Item ids are unique across roles, so the three lists concatenate into one
    // universe without a discriminator (see TagUsageItem).
    const items: TagUsageItem[] = [...todos, ...events, ...notes];
    return aggregateTagUsage(
      items,
      assignments,
      tags,
      formatDateKey(dateRange.start),
      formatDateKey(dateRange.end),
    );
  }, [todos, events, notes, assignments, tags, dateRange]);

  if (rows.length === 0) {
    return (
      <ChartCard title={labels.title} meta={labels.rangeLabel}>
        <AnalyticsEmptyState
          icon={<Tag size={22} />}
          title={labels.empty.title}
          description={labels.empty.description}
        />
      </ChartCard>
    );
  }

  // Bars are relative to the top row, so the leader always fills the track —
  // a share of the grand total would leave every bar a sliver once a handful
  // of tags are in play.
  const max = rows[0].rangeCount;

  return (
    <ChartCard title={labels.title} meta={labels.rangeLabel}>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="text-lumen-text-tertiary">
            <th scope="col" className="pb-2 text-left font-medium">
              {labels.tag}
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              {labels.inRange}
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              {labels.liveTotal}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const color = row.tagColor ?? COLORS[index % COLORS.length];
            return (
              <tr key={row.tagId} className="align-middle">
                <td className="py-1.5 pr-3">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 flex-shrink-0 rounded-lumen-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate text-lumen-text">
                      {row.tagName}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="mt-1 block h-1.5 rounded-lumen-full bg-lumen-surface-sunken"
                  >
                    <span
                      className="block h-full rounded-lumen-full"
                      style={{
                        backgroundColor: color,
                        width: `${max > 0 ? (row.rangeCount / max) * 100 : 0}%`,
                      }}
                    />
                  </span>
                </td>
                <td className="py-1.5 text-right tabular-nums text-lumen-text">
                  {row.rangeCount}
                </td>
                <td className="py-1.5 text-right tabular-nums text-lumen-text-secondary">
                  {row.totalCount}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ChartCard>
  );
}
