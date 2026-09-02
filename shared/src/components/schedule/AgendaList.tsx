import { Fragment, useMemo } from "react";
import { CheckSquare, Repeat } from "lucide-react";
import { cn } from "../cn";
import {
  dotColorClasses,
  type ScheduleItemVariant,
} from "./scheduleVariantVisuals";
import { minutesFromMidnight } from "../../utils/scheduleGridLayout";
import { TodoStatusCheckbox } from "../TodoStatusCheckbox";
import type { StatusLabelSet } from "../todoStatusVisuals";

/*
 * AgendaList (W8 target-IA) — pure, presentational day agenda. Backs the
 * Desktop rightSidebar "今日の流れ" and the Mobile day list. Renders all-day
 * chips first, then the timed rows in the order given (the host sorts). When
 * `nowMinutes` is supplied, a now-line divider splits past (above) from
 * upcoming (below).
 *
 * `dayflow` (#691) turns the same list into Mobile's replacement for the week
 * grid: the row carries its end time, its height follows how long it runs
 * (capped), and free stretches between rows are called out. Without it — the
 * Desktop sidebar column — rows stay one line tall, as before.
 *
 * Completion belongs to TODO rows only. A todo row's row-end is a
 * <TodoStatusCheckbox> — the control the 朝刊 gives the same todo, over the
 * same two values, with the same words (#1367). An EVENT row has no
 * completion at all since #1373: no pill, no toggle, and no strikethrough
 * either, so an event a Claude tool marked done cannot show as struck with
 * nothing here to clear it. Its row-end is simply empty.
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
  variant?: ScheduleItemVariant;
}

export interface AgendaListLabels {
  /** Leading badge for all-day rows. */
  allDay: string;
  /** Shown when there are no items. */
  empty: string;
  /** Time label rendered on the now-line divider. */
  nowLabel?: string;
  /**
   * Already-translated name of what a TODO row's checkbox sets, e.g. "Status"
   * (#1367). Composed with the current status into the accessible name, the
   * same way the 朝刊 does — see TodoStatusCheckbox.
   *
   * Required, unlike the two above: a todo row with no words for its control
   * would silently fall back to something, and "the todo rows quietly kept
   * the event pill" is exactly the regression this is about. The type is the
   * machine guard.
   */
  todoStatus: string;
  /** Already-translated per-status copy for that checkbox (#1367). */
  todoStatusLabels: StatusLabelSet;
}

export interface AgendaListProps {
  items: AgendaItem[];
  /** Current time (minutes-from-midnight). When set, a now-line divider is
   *  drawn between the last past and first upcoming timed row. */
  nowMinutes?: number | null;
  onToggleComplete?: (id: string) => void;
  onSelectItem?: (id: string) => void;
  /**
   * Single-click on a row → host opens a bubble popover anchored at the click's
   * viewport coords (#299). Preferred over `onSelectItem` when both are set;
   * falls back to `onSelectItem` when omitted.
   */
  onItemActivate?: (id: string, pos: { x: number; y: number }) => void;
  /** Double-click on a row → host opens the detail overlay (#299). */
  onItemDoubleClick?: (id: string) => void;
  selectedId?: string | null;
  /**
   * Dayflow density (#691) — Mobile's stand-in for the week grid. Timed rows
   * show their end time under the start time and grow with their duration
   * (capped), so a 3-hour block no longer looks like a 15-minute one.
   */
  dayflow?: boolean;
  /**
   * Already-formatted free-gap copy, e.g. "空き 1時間" (§6.4). When supplied,
   * a marker is drawn between two timed rows more than `MIN_GAP_MINUTES`
   * apart. Omit to keep the list gap-free (Desktop sidebar).
   */
  formatGapLabel?: (minutes: number) => string;
  labels: AgendaListLabels;
  className?: string;
}

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-inset";

/** Shorter holes than this are the seams between back-to-back rows, not time
 *  you could put something in — marking them would be noise. */
const MIN_GAP_MINUTES = 30;

/** Row height per minute, and the ceiling it stops at. A whole afternoon
 *  block would otherwise push everything after it off the screen, so the
 *  scale is honest up to 3 hours and flat beyond it. */
const PX_PER_MINUTE = 0.4;
const MIN_ROW_PX = 42;
const MAX_ROW_PX = 84;

/** Height a timed row claims for `minutes` of duration. */
export function agendaRowHeightPx(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return MIN_ROW_PX;
  return Math.min(MAX_ROW_PX, Math.max(MIN_ROW_PX, minutes * PX_PER_MINUTE));
}

export function AgendaList({
  items,
  nowMinutes,
  onToggleComplete,
  onSelectItem,
  onItemActivate,
  onItemDoubleClick,
  selectedId,
  dayflow = false,
  formatGapLabel,
  labels,
  className,
}: AgendaListProps) {
  const { allDay, timed } = useMemo(() => {
    const a: AgendaItem[] = [];
    const t: AgendaItem[] = [];
    for (const it of items) (it.isAllDay ? a : t).push(it);
    return { allDay: a, timed: t };
  }, [items]);

  // Minute bounds per timed row. An end at or before the start (missing or
  // past-midnight) collapses to a zero-length row rather than a negative one.
  const bounds = useMemo(
    () =>
      timed.map((it) => {
        const start = minutesFromMidnight(it.startTime);
        const end = minutesFromMidnight(it.endTime);
        return { start, end: end > start ? end : start };
      }),
    [timed],
  );

  // Split point for the now-line: index of the first row that has not finished
  // yet. Splitting on the START time (pre-#691) filed an in-progress meeting
  // under "past" while it was still running.
  const splitIndex = useMemo(() => {
    if (nowMinutes == null) return -1;
    return bounds.findIndex((b) => b.end > nowMinutes);
    // -1 = everything has finished (line goes at the very end)
  }, [bounds, nowMinutes]);

  // Free stretches (#691): distance from the latest end seen so far to the
  // next start, so an overlapping pair does not read as a hole. Index i holds
  // the gap that precedes timed row i.
  const gapBefore = useMemo(() => {
    if (!formatGapLabel) return [];
    const out: number[] = [];
    let maxEnd = -1;
    for (let i = 0; i < bounds.length; i++) {
      out.push(maxEnd < 0 ? 0 : bounds[i].start - maxEnd);
      maxEnd = Math.max(maxEnd, bounds[i].end);
    }
    return out;
  }, [bounds, formatGapLabel]);

  const isEmpty = items.length === 0;

  const renderRow = (it: AgendaItem, index = -1) => {
    const selected = it.id === selectedId;
    const variant = it.variant ?? "event";
    const b = index >= 0 ? bounds[index] : undefined;
    const rowHeight =
      dayflow && b ? agendaRowHeightPx(b.end - b.start) : undefined;
    const showEnd =
      dayflow && !it.isAllDay && !!it.endTime && b && b.end > b.start;
    return (
      <li
        key={it.id}
        className={cn(
          "flex items-stretch gap-2 border-b border-lumen-border",
          selected && "bg-lumen-hover",
        )}
      >
        <button
          type="button"
          onClick={(e) => {
            if (onItemActivate)
              onItemActivate(it.id, { x: e.clientX, y: e.clientY });
            else onSelectItem?.(it.id);
          }}
          onDoubleClick={() => onItemDoubleClick?.(it.id)}
          style={rowHeight ? { minHeight: `${rowHeight}px` } : undefined}
          className={cn(
            "flex min-h-[42px] flex-1 items-center gap-2 rounded-sm py-1 pl-1 text-left",
            FOCUS,
          )}
        >
          {it.isAllDay ? (
            <span className="rounded border border-lumen-border-strong bg-lumen-bg px-1.5 py-0.5 text-xs font-semibold text-lumen-text-tertiary">
              {labels.allDay}
            </span>
          ) : (
            <span className="flex w-11 shrink-0 flex-col text-xs leading-tight tabular-nums text-lumen-text-secondary">
              <span>{it.startTime}</span>
              {showEnd && (
                <span className="text-lumen-text-tertiary">{it.endTime}</span>
              )}
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
              // Gated on the variant (#1373): `completed` is still written for
              // events by the MCP tool, and an event struck through with no
              // control to clear it would be worse than the toggle that went.
              variant === "task" && it.completed
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
          {/* Todo provenance (#593): CheckSquare in the same slot as the
              routine's Repeat, so the row's variant cue is a shape, not just
              the dot's hue. */}
          {variant === "task" && (
            <CheckSquare
              aria-hidden
              className="size-3 shrink-0 text-lumen-chip-task-fg"
              strokeWidth={2.5}
            />
          )}
        </button>
        {variant === "task" && onToggleComplete && (
          /*
           * #1367: the same control the 朝刊 gives a todo row (role="checkbox"
           * + aria-checked), over the same two values, with the same words.
           * Rendered only with a handler: the checkbox has no read-only mode,
           * and a box that answers nothing is worse than no box.
           *
           * The press goes through `onToggleComplete`, which the host answers
           * by reading the TodoNode's real status and writing the flip (#761's
           * handleTodoToggleComplete). The next value the checkbox computes is
           * therefore the same one, and is deliberately not forwarded.
           *
           * #1373 removed the other arm. An event has no completion any more,
           * so a non-task row's row-end is empty — there is nothing here that
           * an all-day event or a routine occurrence still shows.
           */
          <span className="shrink-0 self-center pr-1">
            <TodoStatusCheckbox
              status={it.completed ? "DONE" : "NOT_STARTED"}
              onChange={() => onToggleComplete(it.id)}
              labels={labels.todoStatusLabels}
              label={labels.todoStatus}
            />
          </span>
        )}
      </li>
    );
  };

  const nowDivider = (
    <li aria-hidden className="flex items-center gap-2 py-1.5">
      {labels.nowLabel && (
        <span className="text-xs font-bold tabular-nums text-lumen-accent">
          {labels.nowLabel}
        </span>
      )}
      <span className="flex-1 border-t-2 border-lumen-accent" />
    </li>
  );

  return (
    <ul role="list" className={cn("flex flex-col", className)}>
      {allDay.map((it) => renderRow(it))}
      {timed.length === 0 ? (
        <>
          {/* #691: the line used to live inside the timed map, so a day with
              nothing on it (or all-day rows only) lost its "you are here" —
              exactly the day where the clock is the only thing to read. */}
          {nowMinutes != null && nowDivider}
          {isEmpty && (
            <li className="py-6 text-center text-sm text-lumen-text-secondary">
              {labels.empty}
            </li>
          )}
        </>
      ) : (
        timed.map((it, i) => (
          <Fragment key={it.id}>
            {formatGapLabel && gapBefore[i] >= MIN_GAP_MINUTES && (
              <li className="flex items-center gap-2 py-1 pl-1">
                <span className="w-11 shrink-0" aria-hidden />
                <span className="text-xs text-lumen-text-tertiary">
                  {formatGapLabel(gapBefore[i])}
                </span>
                <span
                  aria-hidden
                  className="flex-1 border-t border-dashed border-lumen-border-strong"
                />
              </li>
            )}
            {nowMinutes != null && i === splitIndex && nowDivider}
            {renderRow(it, i)}
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
