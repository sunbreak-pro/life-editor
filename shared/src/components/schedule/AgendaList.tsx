import { Fragment, useMemo } from "react";
import { Repeat } from "lucide-react";
import { cn } from "../cn";
import { minutesFromMidnight } from "../../utils/scheduleGridLayout";
import { ScheduleStatusTag } from "./ScheduleStatusTag";
import type { ScheduleStatus } from "../../utils/scheduleStatus";

/*
 * AgendaList (W8 target-IA) — pure, presentational day agenda. Backs the
 * Desktop rightSidebar "今日の流れ" and the Mobile day list. Renders all-day
 * chips first, then the timed rows in the order given (the host sorts). When
 * `nowMinutes` is supplied, a now-line divider splits past (above) from
 * upcoming (below).
 *
 * Pure presentation (CLAUDE.md §3.1 / §6.4): no DataService, no
 * useTranslation. Copy (all-day / empty / now labels) is injected already
 * translated; mutations are injected callbacks. lumen-* tokens only (§5).
 */

export interface AgendaItem {
  id: string;
  title: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  isAllDay?: boolean;
  completed?: boolean;
  /** Derived status (#222) — drives the row-end status tag. */
  status?: ScheduleStatus;
  variant?: "routine" | "event";
}

export interface AgendaListLabels {
  /** Leading badge for all-day rows. */
  allDay: string;
  /** Shown when there are no items. */
  empty: string;
  /** Time label rendered on the now-line divider. */
  nowLabel?: string;
  /** Accessible name for the per-row completion toggle. */
  complete?: string;
  /** Already-translated status-tag labels (#222). */
  statusLabels?: Record<ScheduleStatus, string>;
}

export interface AgendaListProps {
  items: AgendaItem[];
  /** Current time (minutes-from-midnight). When set, a now-line divider is
   *  drawn between the last past and first upcoming timed row. */
  nowMinutes?: number | null;
  onToggleComplete?: (id: string) => void;
  onSelectItem?: (id: string) => void;
  selectedId?: string | null;
  labels: AgendaListLabels;
  className?: string;
}

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-inset";

function dotColorClasses(variant: "routine" | "event"): string {
  return variant === "routine"
    ? "bg-lumen-chip-routine-dot"
    : "bg-lumen-chip-event-dot";
}

export function AgendaList({
  items,
  nowMinutes,
  onToggleComplete,
  onSelectItem,
  selectedId,
  labels,
  className,
}: AgendaListProps) {
  const { allDay, timed } = useMemo(() => {
    const a: AgendaItem[] = [];
    const t: AgendaItem[] = [];
    for (const it of items) (it.isAllDay ? a : t).push(it);
    return { allDay: a, timed: t };
  }, [items]);

  // Split point for the now-line: index of the first upcoming timed row.
  const splitIndex = useMemo(() => {
    if (nowMinutes == null) return -1;
    const idx = timed.findIndex(
      (it) => minutesFromMidnight(it.startTime) >= nowMinutes,
    );
    return idx; // -1 = all past (line goes at the very end)
  }, [timed, nowMinutes]);

  const isEmpty = items.length === 0;

  const renderRow = (it: AgendaItem) => {
    const selected = it.id === selectedId;
    const variant = it.variant ?? "event";
    return (
      <li
        key={it.id}
        className={cn(
          "flex items-center gap-2 border-b border-lumen-border",
          selected && "bg-lumen-hover",
        )}
      >
        <button
          type="button"
          onClick={() => onSelectItem?.(it.id)}
          className={cn(
            "flex min-h-[42px] flex-1 items-center gap-2 rounded-sm py-1 pl-1 text-left",
            FOCUS,
          )}
        >
          {it.isAllDay ? (
            <span className="rounded border border-lumen-border-strong bg-lumen-bg px-1.5 py-0.5 text-[10px] font-semibold text-lumen-text-tertiary">
              {labels.allDay}
            </span>
          ) : (
            <span className="w-11 shrink-0 text-[11px] tabular-nums text-lumen-text-secondary">
              {it.startTime}
            </span>
          )}
          <span
            aria-hidden
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              dotColorClasses(variant),
            )}
          />
          <span
            className={cn(
              "min-w-0 flex-1 items-center gap-1 truncate text-sm",
              it.completed
                ? "text-lumen-text-secondary line-through"
                : "text-lumen-text",
            )}
          >
            {it.title}
          </span>
          {variant === "routine" && (
            <Repeat
              aria-hidden
              className="size-3 shrink-0 text-lumen-chip-routine-fg"
              strokeWidth={2.5}
            />
          )}
        </button>
        {it.status && labels.statusLabels && (
          <span className="shrink-0 pr-1">
            {/* Timed rows: the tag toggles completion (replaces the old round
                check). All-day rows keep the tag informational (they had no
                toggle before), so pass onClick only when timed. */}
            <ScheduleStatusTag
              status={it.status}
              label={labels.statusLabels[it.status]}
              ariaLabel={labels.complete}
              pressed={it.completed}
              onClick={
                onToggleComplete && !it.isAllDay
                  ? () => onToggleComplete(it.id)
                  : undefined
              }
            />
          </span>
        )}
      </li>
    );
  };

  const nowDivider = (
    <li aria-hidden className="flex items-center gap-2 py-1.5">
      {labels.nowLabel && (
        <span className="text-[10px] font-bold tabular-nums text-lumen-accent">
          {labels.nowLabel}
        </span>
      )}
      <span className="flex-1 border-t-2 border-lumen-accent" />
    </li>
  );

  return (
    <ul role="list" className={cn("flex flex-col", className)}>
      {allDay.map(renderRow)}
      {isEmpty ? (
        <li className="py-6 text-center text-sm text-lumen-text-secondary">
          {labels.empty}
        </li>
      ) : (
        timed.map((it, i) => (
          <Fragment key={it.id}>
            {nowMinutes != null && i === splitIndex && nowDivider}
            {renderRow(it)}
            {/* All rows are past → divider trails the list */}
            {nowMinutes != null &&
              splitIndex === -1 &&
              i === timed.length - 1 &&
              nowDivider}
          </Fragment>
        ))
      )}
    </ul>
  );
}
