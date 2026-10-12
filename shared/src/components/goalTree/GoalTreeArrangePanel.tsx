import { useId } from "react";
import { SegmentedControl } from "../SegmentedControl";
import type { GoalPeriodKind } from "../../types/goal";
import {
  type GoalTreeArrangement,
  type GoalTreeFilter,
  type GoalTreeSort,
  type GoalTreeStatus,
} from "./buildGoalTreeModel";

/*
 * Sort and filter for the goal tree (#2225). On a wide screen the host puts
 * this at the top of the right panel, above the picked goal's details; on a
 * phone, in a bottom sheet behind the "Sort & filter" button. The choice
 * lives in the host because the tree and this panel render apart.
 *
 * Pure presentation (§6.4): the arrangement and every label come from the
 * host (web/src/connect/GoalsTodosScreen.tsx).
 */

export interface GoalTreeArrangeLabels {
  heading: string;
  sortLabel: string;
  sorts: Record<GoalTreeSort, string>;
  periodLabel: string;
  /** "All" — the period and status filters' "no filter" choice. */
  all: string;
  /** "Year" / "Month" / "Week". */
  kinds: Record<GoalPeriodKind, string>;
  statusLabel: string;
  statuses: Record<GoalTreeStatus, string>;
  hideDoneTodos: string;
}

export interface GoalTreeArrangePanelProps {
  arrangement: GoalTreeArrangement;
  onChange: (next: GoalTreeArrangement) => void;
  labels: GoalTreeArrangeLabels;
}

const SORTS: readonly GoalTreeSort[] = ["standard", "progress", "name"];
const PERIODS: readonly (GoalPeriodKind | "all")[] = [
  "all",
  "year",
  "month",
  "week",
];
const STATUSES: readonly (GoalTreeStatus | "all")[] = [
  "all",
  "inProgress",
  "achieved",
  "unconnected",
];

const FIELD_LABEL = "text-xs font-medium text-lumen-text-tertiary";

/**
 * The active filter as short phrases — "Week", "Achieved", "Done todos
 * hidden" — for the line the tree shows over itself while filtered. Empty
 * when nothing is filtered.
 */
export function describeGoalTreeFilter(
  filter: GoalTreeFilter,
  labels: GoalTreeArrangeLabels,
): string[] {
  const parts: string[] = [];
  if (filter.period !== "all") parts.push(labels.kinds[filter.period]);
  if (filter.status !== "all") parts.push(labels.statuses[filter.status]);
  if (filter.hideDoneTodos) parts.push(labels.hideDoneTodos);
  return parts;
}

export function GoalTreeArrangePanel({
  arrangement,
  onChange,
  labels,
}: GoalTreeArrangePanelProps): React.JSX.Element {
  const { sort, filter } = arrangement;
  const hideId = useId();
  const setFilter = (patch: Partial<GoalTreeFilter>): void =>
    onChange({
      sort,
      filter: { ...filter, ...patch },
    });

  return (
    <section aria-label={labels.heading} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>{labels.sortLabel}</span>
        <SegmentedControl
          options={SORTS.map((id) => ({ id, label: labels.sorts[id] }))}
          value={sort}
          onChange={(id) => onChange({ sort: id as GoalTreeSort, filter })}
          label={labels.sortLabel}
          singleLineLabels
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>{labels.periodLabel}</span>
        <SegmentedControl
          options={PERIODS.map((id) => ({
            id,
            label: id === "all" ? labels.all : labels.kinds[id],
          }))}
          value={filter.period}
          onChange={(id) =>
            setFilter({ period: id as GoalTreeFilter["period"] })
          }
          label={labels.periodLabel}
          singleLineLabels
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>{labels.statusLabel}</span>
        <SegmentedControl
          options={STATUSES.map((id) => ({
            id,
            label: id === "all" ? labels.all : labels.statuses[id],
          }))}
          value={filter.status}
          onChange={(id) =>
            setFilter({ status: id as GoalTreeFilter["status"] })
          }
          label={labels.statusLabel}
          singleLineLabels
        />
      </div>
      <label
        htmlFor={hideId}
        className="flex items-center gap-2 text-[13px] text-lumen-text max-md:min-h-11"
      >
        <input
          id={hideId}
          type="checkbox"
          checked={filter.hideDoneTodos}
          onChange={(e) => setFilter({ hideDoneTodos: e.target.checked })}
          className="size-4 accent-lumen-accent"
        />
        {labels.hideDoneTodos}
      </label>
    </section>
  );
}
