import { Check } from "lucide-react";
import { cn } from "../cn";
import { SegmentedControl } from "../SegmentedControl";
import { FOCUS_RING_TIGHT } from "../styleTokens";
import type { GoalPeriodKind } from "../../types/goal";
import {
  DEFAULT_GOAL_TREE_ARRANGEMENT,
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
 * The form follows the Claude Design proposal (#2410, #2610): the period is
 * three chips, each on or off on its own and all on at first; the status is
 * three choices, since a goal with nothing connected has its own group under
 * the tree; hiding done todos is a switch. "Reset all" shows only while
 * something differs from the start, and takes the sort back too.
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
  /** Joins the periods left on in the filter line: "This year, This month". */
  periodSeparator: string;
  statusLabel: string;
  statuses: Record<GoalTreeStatus, string>;
  hideDoneTodos: string;
  /** "Reset all" — under the panel while anything is set (#2610). */
  resetAll: string;
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

const FIELD_LABEL = "text-xs font-bold text-lumen-text-tertiary";

/**
 * The active filter as short phrases — "This year, This month", "Achieved",
 * "Hide done todos" — for the line the tree shows over itself while filtered.
 * Empty when nothing is filtered, so the host also reads it as "is filtered".
 */
export function describeGoalTreeFilter(
  filter: GoalTreeFilter,
  labels: GoalTreeArrangeLabels,
): string[] {
  const parts: string[] = [];
  // Chip order, whatever order they were switched in.
  const on = GOAL_PERIOD_KINDS.filter((kind) => filter.periods.includes(kind));
  if (on.length < GOAL_PERIOD_KINDS.length) {
    parts.push(
      on.map((kind) => labels.periods[kind]).join(labels.periodSeparator),
    );
  }
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
  const togglePeriod = (kind: GoalPeriodKind): void => {
    const isOn = filter.periods.includes(kind);
    // With none on the tree would be empty and the filter line would have
    // nothing to name, so the last chip on stays on.
    if (isOn && filter.periods.length === 1) return;
    setFilter({
      periods: GOAL_PERIOD_KINDS.filter((k) =>
        k === kind ? !isOn : filter.periods.includes(k),
      ),
    });
  };
  const isSet =
    sort !== DEFAULT_GOAL_TREE_ARRANGEMENT.sort ||
    describeGoalTreeFilter(filter, labels).length > 0;

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
        {/* StatusFilterChips' look, but each chip toggles on its own: that
            component keeps one chip at most. */}
        <div
          role="group"
          aria-label={labels.periodLabel}
          className="flex flex-wrap gap-2 max-md:[&>button]:min-h-11"
        >
          {GOAL_PERIOD_KINDS.map((kind) => {
            const isOn = filter.periods.includes(kind);
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={isOn}
                onClick={() => togglePeriod(kind)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lumen-full border px-3 py-1 text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                  isOn
                    ? "border-lumen-accent bg-lumen-accent-subtle font-semibold text-lumen-accent"
                    : "border-lumen-border bg-lumen-bg text-lumen-text-secondary hover:bg-lumen-hover",
                )}
              >
                {isOn && <Check size={14} aria-hidden />}
                <span>{labels.periods[kind]}</span>
              </button>
            );
          })}
        </div>
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
      {isSet && (
        <button
          type="button"
          onClick={() => onChange(DEFAULT_GOAL_TREE_ARRANGEMENT)}
          className={cn(
            "self-start rounded-lumen-sm text-xs text-lumen-accent underline-offset-2 hover:underline max-md:min-h-11",
            FOCUS_RING_TIGHT,
          )}
        >
          {labels.resetAll}
        </button>
      )}
    </section>
  );
}
