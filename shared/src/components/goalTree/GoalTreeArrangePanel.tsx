import { Check } from "lucide-react";
import { cn } from "../cn";
import { StatusFilterChips } from "../materials/StatusFilterChips";
import { SegmentedControl } from "../SegmentedControl";
import { FOCUS_RING_TIGHT } from "../styleTokens";
import type { GoalPeriodKind } from "../../types/goal";
import {
  GOAL_PERIOD_KINDS,
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
 * The form follows the Claude Design proposal (#2410): the period is three
 * chips, pressed again to clear; the status is three choices, since a goal with
 * nothing connected has its own group under the tree; hiding done todos is a
 * switch.
 *
 * Pure presentation (§6.4): the arrangement and every label come from the
 * host (web/src/connect/GoalsTodosScreen.tsx).
 */

export interface GoalTreeArrangeLabels {
  heading: string;
  sortLabel: string;
  sorts: Record<GoalTreeSort, string>;
  periodLabel: string;
  /** "All" — the status filter's "no filter" choice. */
  all: string;
  /** "This year" / "This month" / "This week" — the period chips. */
  periods: Record<GoalPeriodKind, string>;
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
const STATUSES: readonly (GoalTreeStatus | "all")[] = [
  "all",
  "inProgress",
  "achieved",
];

const FIELD_LABEL = "text-xs font-medium text-lumen-text-tertiary";

/**
 * The active filter as short phrases — "This week", "Achieved", "Done todos
 * hidden" — for the line the tree shows over itself while filtered. Empty
 * when nothing is filtered.
 */
export function describeGoalTreeFilter(
  filter: GoalTreeFilter,
  labels: GoalTreeArrangeLabels,
): string[] {
  const parts: string[] = [];
  if (filter.period !== "all") parts.push(labels.periods[filter.period]);
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
        <StatusFilterChips
          chips={GOAL_PERIOD_KINDS.map((id) => ({
            id,
            label: labels.periods[id],
            icon:
              filter.period === id ? <Check size={14} aria-hidden /> : undefined,
          }))}
          value={filter.period === "all" ? null : filter.period}
          onChange={(id) =>
            setFilter({ period: (id ?? "all") as GoalTreeFilter["period"] })
          }
          label={labels.periodLabel}
          className="max-md:[&>button]:min-h-11"
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
      {/* The whole row is the switch, so the target is the row. */}
      <button
        type="button"
        role="switch"
        aria-checked={filter.hideDoneTodos}
        onClick={() => setFilter({ hideDoneTodos: !filter.hideDoneTodos })}
        className={cn(
          "flex items-center justify-between gap-2 rounded-lumen-sm text-left text-[13px] text-lumen-text max-md:min-h-11",
          FOCUS_RING_TIGHT,
        )}
      >
        <span className="min-w-0">{labels.hideDoneTodos}</span>
        <span
          aria-hidden
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full transition-colors",
            filter.hideDoneTodos ? "bg-lumen-accent" : "bg-lumen-border-strong",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-lumen-on-accent transition-all",
              filter.hideDoneTodos ? "right-0.5" : "left-0.5",
            )}
          />
        </span>
      </button>
    </section>
  );
}
