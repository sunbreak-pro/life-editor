import { useMemo } from "react";
import { CheckSquare } from "lucide-react";
import { cn } from "../cn";
import {
  dotColorClasses,
  type ScheduleItemVariant,
} from "./scheduleVariantVisuals";
import {
  WEEK_STARTS_ON,
  monthGridKeys,
  parseDateKey,
  startOfMonthKey,
} from "../../utils/scheduleGridLayout";

/*
 * MonthGrid (W8 target-IA) — pure, presentational month calendar. Desktop
 * renders a 7-column grid of cells (day-number badge + up to 2 provenance
 * chips + "他 N 件"); Mobile (`compact`) renders a day badge + a dot row, capped
 * at 3 dots and followed by the same "他 N 件" remainder (#1045).
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
  variant?: ScheduleItemVariant;
  completed?: boolean;
  isAllDay?: boolean;
}

export interface MonthGridProps {
  /** Any date within the month to render (YYYY-MM-DD). */
  monthKey: string;
  items: MonthGridItem[];
  /** Date key to mark as "today", or null. */
  todayKey?: string | null;
  /**
   * Date key the host is currently SHOWING elsewhere, or null (#878). Marks
   * the cell rather than the day badge, so a day that is both today and picked
   * still reads as today.
   *
   * Needed once the grid stopped being an overview and became a picker: on
   * Mobile the list under it shows this day, and without the mark the grid
   * cannot say which of its 42 cells the list belongs to. Omit it entirely and
   * the cells render exactly as before, `aria-selected` included.
   */
  selectedKey?: string | null;
  /** Already-translated weekday labels indexed 0 (Sun) – 6 (Sat) (§6.4). */
  weekdayLabels: string[];
  onSelectDay: (dateKey: string) => void;
  onSelectItem?: (id: string) => void;
  /**
   * Single-click on a chip → host opens a bubble popover anchored at the
   * click's viewport coords (#299). Preferred over `onSelectItem` when both
   * are supplied; falls back to `onSelectItem` when omitted.
   */
  onItemActivate?: (id: string, pos: { x: number; y: number }) => void;
  /** Double-click on a chip → host opens the detail overlay (#299). */
  onItemDoubleClick?: (id: string) => void;
  /**
   * Right-click (contextmenu) on an item chip → host opens a context menu at
   * the given viewport coordinates. When omitted, the native menu is left
   * untouched. Desktop-only (#223).
   */
  onItemContextMenu?: (id: string, pos: { x: number; y: number }) => void;
  /**
   * Already-translated "他 N 件" formatter (§6.4). Both densities call it —
   * the count differs (chips cut at 2, dots at 3) but the phrase must not.
   */
  formatMoreCount: (n: number) => string;
  /** Accessible name for a day cell. Default = the raw date key. */
  formatDayLabel?: (dateKey: string) => string;
  /** Mobile density: up to 3 dots + the remainder, instead of chips. */
  compact?: boolean;
  /** Already-translated accessible name for the grid (§6.4). */
  ariaLabel?: string;
  className?: string;
}

const CELL_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-inset";

function chipFaceClasses(variant: ScheduleItemVariant): string {
  switch (variant) {
    case "routine":
      return "bg-lumen-chip-routine-bg text-lumen-chip-routine-fg";
    case "task":
      return "bg-lumen-chip-task-bg text-lumen-chip-task-fg";
    default:
      return "bg-lumen-chip-event-bg text-lumen-chip-event-fg";
  }
}

export function MonthGrid({
  monthKey,
  items,
  todayKey,
  selectedKey,
  weekdayLabels,
  onSelectDay,
  onSelectItem,
  onItemActivate,
  onItemDoubleClick,
  onItemContextMenu,
  formatMoreCount,
  formatDayLabel = (k) => k,
  compact = false,
  ariaLabel,
  className,
}: MonthGridProps) {
  const rows = useMemo(
    () => monthGridKeys(monthKey, WEEK_STARTS_ON),
    [monthKey],
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

  // Column 0 = Sunday (#1102) — the order `weekdayLabels` already arrives in,
  // so the re-ordering the switchable week start needed is gone.
  const headerLabels = Array.from(
    { length: 7 },
    (_, i) => weekdayLabels[i] ?? "",
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
            className="py-1 text-center text-xs font-medium text-lumen-text-secondary"
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
          const isSelected = !!selectedKey && dateKey === selectedKey;
          const dayItems = byDay.get(dateKey) ?? [];
          // Each density hides a different number of items, so each counts its
          // own remainder (#1045). One shared `overflow` would have printed the
          // chip figure under a dot row that cut at a different place.
          const overflow = Math.max(
            0,
            dayItems.length - (compact ? maxDots : maxChips),
          );
          return (
            <div
              key={dateKey}
              role="gridcell"
              // Only once a host actually picks a day: a grid whose every cell
              // says aria-selected="false" tells a screen reader there is a
              // selection to make, and the overview (#692) has none.
              aria-selected={selectedKey ? isSelected : undefined}
              className={cn(
                "relative min-h-14 border-b border-r border-lumen-border last:border-r-0",
                isSelected &&
                  "bg-lumen-bg-secondary ring-2 ring-inset ring-lumen-accent",
              )}
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
                    "flex h-5 min-w-5 items-center justify-center self-start rounded-full px-1 text-xs font-semibold tabular-nums",
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
                  <>
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
                    {/*
                     * The remainder, spelled out (#1045). The dot row cuts at
                     * three and used to just stop, so a day with eight items
                     * looked exactly like a day with three — and the dots are a
                     * DENSITY cue, which is the one thing that reading makes
                     * wrong. The day underneath is still where "what are they"
                     * gets answered; this only says how many are missing.
                     *
                     * Same `formatMoreCount` the Desktop overflow line uses, so
                     * the two densities agree on the wording ("+N more" / "他 N
                     * 件") rather than inventing a second phrase for the same
                     * fact. `nowrap` keeps it on one line: a cell is ~1/7th of a
                     * phone, and wrapping it would push the row taller than the
                     * others and break the grid's even rows.
                     */}
                    {overflow > 0 && (
                      <span className="whitespace-nowrap text-[0.625rem] leading-none text-lumen-text-tertiary tabular-nums">
                        {formatMoreCount(overflow)}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    {dayItems.slice(0, maxChips).map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onItemActivate)
                            onItemActivate(it.id, {
                              x: e.clientX,
                              y: e.clientY,
                            });
                          else onSelectItem?.(it.id);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          onItemDoubleClick?.(it.id);
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
                          "pointer-events-auto rounded px-1 py-0.5 text-left text-xs font-medium",
                          // #593: todo chips carry the CheckSquare todo mark,
                          // matching the week grid, so the cue does not vanish
                          // when the same item is viewed by month.
                          it.variant === "task"
                            ? "flex items-center gap-1"
                            : "block truncate",
                          CELL_FOCUS,
                          chipFaceClasses(it.variant ?? "event"),
                          // Gated on the variant (#1373): the MCP tool still
                          // writes `completed` for events, and an event struck
                          // through with no control to clear it would be worse
                          // than the toggle that went.
                          it.variant === "task" &&
                            it.completed &&
                            "line-through opacity-55",
                        )}
                      >
                        {it.variant === "task" ? (
                          <>
                            <CheckSquare
                              aria-hidden
                              className="size-3 shrink-0"
                              strokeWidth={2.5}
                            />
                            <span className="truncate">{it.title || " "}</span>
                          </>
                        ) : (
                          it.title || " "
                        )}
                      </button>
                    ))}
                    {overflow > 0 && (
                      <span className="px-1 text-xs text-lumen-text-tertiary">
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
