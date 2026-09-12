import { useMemo } from "react";
import { CheckSquare } from "lucide-react";
import { cn } from "../cn";
import { type ScheduleItemVariant } from "./scheduleVariantVisuals";
import {
  WEEK_STARTS_ON,
  monthGridKeys,
  parseDateKey,
  startOfMonthKey,
} from "../../utils/scheduleGridLayout";

/*
 * MonthGrid (W8 target-IA) — pure, presentational month calendar. Desktop
 * renders a 7-column grid of cells (day-number badge + up to 2 provenance
 * chips + "他 N 件"); Mobile (`compact`) renders a day badge over a short
 * vertical list of item TITLES (#1401 — it was a dot row until then), cut at
 * four lines with the same "他 N 件" remainder (#1045) taking the last one
 * (#1581 — three lines and a taller badge until then).
 *
 * The compact cell is a FIXED height and clips: a phone's cell is ~1/7th of
 * the screen wide, and a title that does not fit is cut at the cell edge with
 * no ellipsis (the Issue is explicit about that) and never pushes a grid line.
 * The grid therefore does not stretch to fill the column either — that was
 * what made the rows tower on a tall phone — and the host lets the column
 * scroll if the six rows do not fit.
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
  /**
   * Mobile density (#1401): fixed-height cells, a title list instead of chips
   * (up to 4 lines, the last one the remainder when there are more), a smaller
   * day badge, and no side borders or corner radius, so the grid can run edge
   * to edge.
   */
  compact?: boolean;
  /** Already-translated accessible name for the grid (§6.4). */
  ariaLabel?: string;
  className?: string;
}

const CELL_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-inset";

/*
 * How a compact cell's title ENDS when it is wider than the cell (#1516).
 *
 * The audit filed this as "no ellipsis", but an ellipsis is exactly what #1401
 * ruled out ("「…」のような省略記号は付けない", ユーザー指定 point 4), and that
 * ruling still stands. What it did not ask for is the OTHER half of what the
 * audit saw: `overflow: hidden` alone cuts a glyph in half at an arbitrary
 * pixel, which reads as a rendering fault rather than as "there is more here".
 *
 * A fade answers both. The last few pixels of the line ramp to transparent, so
 * the cut is visibly deliberate, and — unlike an ellipsis, which would eat
 * roughly three of the ~7 characters a 51px cell can hold — it costs the title
 * no width at all.
 *
 * It rides on an INNER span so the mask reaches the text only: the outer span
 * carries the chip's background, and masking that would fade every chip's
 * right edge whether its title overflowed or not. On a title that fits, the
 * faded strip holds no glyphs and nothing changes.
 */
const TITLE_FADE =
  "[mask-image:linear-gradient(to_right,black_calc(100%_-_0.5rem),transparent)]";

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
  /*
   * Compact: FOUR lines per cell since #1581 (three until then). A day with
   * more than four items shows three titles and spends the fourth line on
   * "+N", so the count is never hidden behind a clipped list (#1045's
   * argument, carried over from the dots).
   *
   * The number and the cell height below move together — the height is exactly
   * what these lines need plus a little slack, so raising one without the other
   * either clips a line or leaves a band of empty cell.
   */
  const maxTitleLines = 4;

  return (
    <div
      role="grid"
      aria-label={ariaLabel}
      className={cn(
        "flex flex-col overflow-hidden bg-lumen-bg",
        // #1401: edge to edge on a phone — a radius and side borders would
        // draw a card sitting inside the screen, which is the margin the
        // Issue asks to remove.
        compact
          ? "border-y border-lumen-border"
          : "rounded-md border border-lumen-border",
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
          // chip figure under a list that cut at a different place.
          const shownCompact =
            dayItems.length > maxTitleLines
              ? maxTitleLines - 1
              : dayItems.length;
          const overflow = compact
            ? dayItems.length - shownCompact
            : Math.max(0, dayItems.length - maxChips);
          return (
            <div
              key={dateKey}
              role="gridcell"
              // Only once a host actually picks a day: a grid whose every cell
              // says aria-selected="false" tells a screen reader there is a
              // selection to make, and the overview (#692) has none.
              aria-selected={selectedKey ? isSelected : undefined}
              className={cn(
                "relative border-b border-r border-lumen-border last:border-r-0",
                /*
                 * #1401: a fixed height that clips, so no title can move a
                 * grid line — versus Desktop's floor, which lets a cell grow.
                 *
                 * 88px since #1581 (70px before). 70 was exactly three title
                 * lines under the badge with nothing to spare, which is what
                 * made the cell read as packed. 88 is four lines plus ~6px of
                 * slack, on a badge that is smaller by the same change.
                 *
                 * Still a fixed value and NOT `auto-rows-fr`: stretching to
                 * fill the column is what made the rows tower on a tall phone,
                 * and #1401 is the issue that stopped it. Six of these are
                 * taller than most phone viewports, so the host's wrapper
                 * scrolls (CalendarNarrowLayout) rather than the grid shrinking
                 * a week out of sight.
                 */
                compact ? "h-[5.5rem] overflow-hidden" : "min-h-14",
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
                  "pointer-events-none relative z-10 flex h-full flex-col gap-0.5",
                  // Compact keeps the column stretched so each title line can
                  // use the cell's full width; only the day badge centres.
                  compact ? "px-0.5 pb-0.5 pt-1" : "p-1",
                  !inMonth && "opacity-40",
                )}
              >
                <span
                  className={cn(
                    /*
                     * No `self-*` here: `cn` is a plain string join, so two
                     * utilities for one property are settled by Tailwind's
                     * emit order rather than by call order (#830). The two
                     * branches below are mutually exclusive instead.
                     */
                    "flex items-center justify-center rounded-full px-1 font-semibold tabular-nums",
                    /*
                     * #1581: the phone's date was the loudest thing in a cell
                     * it shares with four titles. 16px box / 10px digits here
                     * against Desktop's 20 / 13 — the digits land level with
                     * the titles below them, and what still separates them is
                     * the weight, the pill and (for today) the accent fill.
                     *
                     * The digits are not shrunk the 5px the request names:
                     * `--text-xs` is 13px in this project, so that would be
                     * 8px and unreadable at arm's length.
                     */
                    compact
                      ? "h-4 min-w-4 self-center text-[0.625rem]"
                      : "h-5 min-w-5 self-start text-xs",
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
                    {/*
                     * The titles (#1401). One line each, in the item's chip
                     * colours so an event, a routine and a todo still tell
                     * apart at this size. A title wider than the cell is cut
                     * at the cell's edge — still no `truncate`, whose ellipsis
                     * the Issue rules out, but the last few pixels now fade
                     * (#1516 / TITLE_FADE) so the cut reads as deliberate
                     * rather than as a half-drawn glyph. The cell's fixed
                     * height means a long title can never move a grid line.
                     * What a title IS is still answered by the drawer the cell
                     * opens; these are plain spans, not the Desktop chip
                     * buttons, because the day stays the tap target on a
                     * phone.
                     */}
                    {dayItems.slice(0, shownCompact).map((it) => (
                      <span
                        key={it.id}
                        className={cn(
                          "block w-full overflow-hidden rounded-sm px-0.5 text-[0.625rem] font-medium leading-[0.8125rem]",
                          chipFaceClasses(it.variant ?? "event"),
                          // Same #1373 gate as the Desktop chip: only a todo
                          // can be complete.
                          it.variant === "task" &&
                            it.completed &&
                            "line-through opacity-55",
                        )}
                      >
                        {/* The text layer, and the only thing the fade
                            touches — see TITLE_FADE. `nowrap` moved down
                            here with it, so the mask and the line it fades
                            are the same box. */}
                        <span
                          className={cn("block whitespace-nowrap", TITLE_FADE)}
                        >
                          {it.title || " "}
                        </span>
                      </span>
                    ))}
                    {/*
                     * The remainder, spelled out (#1045): a day with eight
                     * items must not look like a day with two. It takes the
                     * last line instead of a fourth title, so it is never the
                     * thing that gets clipped. Same `formatMoreCount` the
                     * Desktop overflow line uses, so the two densities agree
                     * on the wording ("+N more" / "他 N 件").
                     */}
                    {overflow > 0 && (
                      <span className="whitespace-nowrap px-0.5 text-[0.625rem] leading-[0.8125rem] text-lumen-text-tertiary tabular-nums">
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
