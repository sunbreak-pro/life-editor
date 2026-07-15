import { useMemo } from "react";
import { cn } from "../cn";
import {
  monthGridKeys,
  parseDateKey,
  startOfMonthKey,
} from "../../utils/scheduleGridLayout";

/*
 * MonthGrid (W8 target-IA) — pure, presentational month calendar. Desktop
 * renders a 7-column grid of cells (day-number badge + up to 2 provenance
 * chips + "他 N 件"); Mobile (`compact`) renders a day badge + a dot row.
 *
 * Pure presentation (CLAUDE.md §3.1 / §6.4): no DataService, no
 * useTranslation. Weekday labels + the "他 N 件" formatter arrive already
 * translated. All date math is the "no UTC" local-part helpers in
 * scheduleGridLayout (unit-tested separately). lumen-* tokens only; cells are
 * opaque (§5). A tap on a cell fires onSelectDay; a tap on a chip fires
 * onSelectItem (and stops the cell's day-select).
 */

export interface MonthGridItem {
  id: string;
  date: string; // YYYY-MM-DD (local)
  title: string;
  variant?: "routine" | "event" | "task";
  completed?: boolean;
  isAllDay?: boolean;
}

export interface MonthGridProps {
  /** Any date within the month to render (YYYY-MM-DD). */
  monthKey: string;
  items: MonthGridItem[];
  /** Date key to mark as "today", or null. */
  todayKey?: string | null;
  /** Week start: 0 = Sunday (default), 1 = Monday. */
  weekStartsOn?: 0 | 1;
  /** Already-translated weekday labels indexed 0 (Sun) – 6 (Sat) (§6.4). */
  weekdayLabels: string[];
  onSelectDay: (dateKey: string) => void;
  onSelectItem?: (id: string) => void;
  /**
   * Right-click (contextmenu) on an item chip → host opens a context menu at
   * the given viewport coordinates. When omitted, the native menu is left
   * untouched. Desktop-only (#223).
   */
  onItemContextMenu?: (id: string, pos: { x: number; y: number }) => void;
  /** Already-translated "他 N 件" formatter (§6.4). */
  formatMoreCount: (n: number) => string;
  /** Accessible name for a day cell. Default = the raw date key. */
  formatDayLabel?: (dateKey: string) => string;
  /** Mobile density: day badge + dot row instead of chips. */
  compact?: boolean;
  /** Already-translated accessible name for the grid (§6.4). */
  ariaLabel?: string;
  className?: string;
}

const CELL_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-inset";

function chipFaceClasses(variant: "routine" | "event" | "task"): string {
  switch (variant) {
    case "routine":
      return "bg-lumen-chip-routine-bg text-lumen-chip-routine-fg";
    case "task":
      return "bg-lumen-chip-task-bg text-lumen-chip-task-fg";
    default:
      return "bg-lumen-chip-event-bg text-lumen-chip-event-fg";
  }
}

function dotColorClasses(variant: "routine" | "event" | "task"): string {
  switch (variant) {
    case "routine":
      return "bg-lumen-chip-routine-dot";
    case "task":
      return "bg-lumen-chip-task-dot";
    default:
      return "bg-lumen-chip-event-dot";
  }
}

export function MonthGrid({
  monthKey,
  items,
  todayKey,
  weekStartsOn = 0,
  weekdayLabels,
  onSelectDay,
  onSelectItem,
  onItemContextMenu,
  formatMoreCount,
  formatDayLabel = (k) => k,
  compact = false,
  ariaLabel,
  className,
}: MonthGridProps) {
  const rows = useMemo(
    () => monthGridKeys(monthKey, weekStartsOn),
    [monthKey, weekStartsOn],
  );
  const monthNum = parseDateKey(startOfMonthKey(monthKey)).m;

  // Bucket items by their date key once (render order preserved — the host
  // is responsible for chronological sorting).
  const byDay = useMemo(() => {
    const map = new Map<string, MonthGridItem[]>();
    for (const it of items) {
      const bucket = map.get(it.date);
      if (bucket) bucket.push(it);
      else map.set(it.date, [it]);
    }
    return map;
  }, [items]);

  // Header labels re-ordered so column 0 = weekStartsOn.
  const headerLabels = Array.from(
    { length: 7 },
    (_, i) => weekdayLabels[(weekStartsOn + i) % 7] ?? "",
  );

  const maxChips = 2;
  const maxDots = 3;

  return (
    <div
      role="grid"
      aria-label={ariaLabel}
      className={cn(
        "flex flex-col overflow-hidden rounded-md border border-lumen-border bg-lumen-bg",
        className,
      )}
    >
      {/* Weekday header */}
      <div role="row" className="grid grid-cols-7 border-b border-lumen-border">
        {headerLabels.map((label, i) => (
          <div
            key={i}
            role="columnheader"
            className="py-1 text-center text-[11px] font-medium text-lumen-text-secondary"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid flex-1 auto-rows-fr grid-cols-7">
        {rows.flat().map((dateKey) => {
          const { m, d } = parseDateKey(dateKey);
          const inMonth = m === monthNum;
          const isToday = !!todayKey && dateKey === todayKey;
          const dayItems = byDay.get(dateKey) ?? [];
          const overflow = Math.max(0, dayItems.length - maxChips);
          return (
            <div
              key={dateKey}
              role="gridcell"
              className="relative min-h-14 border-b border-r border-lumen-border last:border-r-0"
            >
              {/* Full-cell day-select target (keyboard reachable). Chips sit
                  above it with pointer-events re-enabled. */}
              <button
                type="button"
                aria-label={formatDayLabel(dateKey)}
                onClick={() => onSelectDay(dateKey)}
                className={cn(
                  "absolute inset-0 z-0 cursor-pointer transition-colors hover:bg-lumen-hover",
                  CELL_FOCUS,
                )}
              />
              <div
                className={cn(
                  "pointer-events-none relative z-10 flex h-full flex-col gap-0.5 p-1",
                  compact && "items-center",
                  !inMonth && "opacity-40",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 min-w-5 items-center justify-center self-start rounded-full px-1 text-[11px] font-semibold tabular-nums",
                    compact && "self-center",
                    isToday
                      ? "bg-lumen-accent text-lumen-on-accent"
                      : inMonth
                        ? "text-lumen-text"
                        : "text-lumen-text-tertiary",
                  )}
                >
                  {d}
                </span>

                {compact ? (
                  <div className="flex gap-0.5">
                    {dayItems.slice(0, maxDots).map((it) => (
                      <span
                        key={it.id}
                        className={cn(
                          "size-1.5 rounded-full",
                          dotColorClasses(it.variant ?? "event"),
                        )}
                      />
                    ))}
                  </div>
                ) : (
                  <>
                    {dayItems.slice(0, maxChips).map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectItem?.(it.id);
                        }}
                        onContextMenu={
                          onItemContextMenu
                            ? (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onItemContextMenu(it.id, {
                                  x: e.clientX,
                                  y: e.clientY,
                                });
                              }
                            : undefined
                        }
                        title={it.title}
                        className={cn(
                          "pointer-events-auto block truncate rounded px-1 py-0.5 text-left text-[10px] font-medium",
                          CELL_FOCUS,
                          chipFaceClasses(it.variant ?? "event"),
                          it.completed && "line-through opacity-55",
                        )}
                      >
                        {it.title || " "}
                      </button>
                    ))}
                    {overflow > 0 && (
                      <span className="px-1 text-[10px] text-lumen-text-tertiary">
                        {formatMoreCount(overflow)}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
