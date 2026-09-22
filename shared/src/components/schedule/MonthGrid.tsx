import { memo, useMemo } from "react";
import { cn } from "../cn";
import { type ScheduleItemVariant } from "./scheduleVariantVisuals";
import {
  CELL_FOCUS,
  MonthCellCreateButton,
  MonthCompactTitles,
  MonthFullChips,
  monthCellFold,
  useMonthCellDrop,
} from "./MonthGridParts";
import type { TodoCalendarDrop } from "./todoCalendarDrag";
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
 * The compact cell has a FIXED FLOOR and clips: a phone's cell is ~1/7th of
 * the screen wide, and a title that does not fit is cut at the cell edge with
 * no ellipsis (the Issue is explicit about that) and never pushes a grid line.
 * The host lets the column scroll if the six rows do not fit.
 *
 * #1835: a floor rather than a fixed height. Six 88px rows are shorter than a
 * 390x844 phone's main area by about 123px, so the month stopped a bar's
 * height above the bottom bar and the empty strip read as a rendering fault.
 * The rows now share whatever is left over — `min-h` keeps #1401's floor, so
 * they can still only GROW, and the container they grow into is the viewport,
 * which is what stops the towering #1401 was filed about (that was
 * `auto-rows-fr` with no floor at all, on a grid free to exceed the screen).
 *
 * Pure presentation (CLAUDE.md §3.1 / §6.4): no DataService, no
 * useTranslation. Weekday labels + the "他 N 件" formatter arrive already
 * translated. All date math is the "no UTC" local-part helpers in
 * scheduleGridLayout (unit-tested separately). lumen-* tokens only; cells are
 * opaque (§5).
 *
 * WHAT A CELL DOES depends on which callback the host supplies, and the two
 * hosts supply different ones (#1584):
 *   - onSelectDay  → a full-face button that hands back the day. Narrow's
 *                    "show me this day", and the only focusable thing in the
 *                    cell.
 *   - onCreateDay  → a + button in the cell's top-right that hands back the
 *                    day. Desktop's "add something here", and Desktop-only:
 *                    the compact density has no room for it and its cell means
 *                    something else.
 * A tap on a chip fires onSelectItem and stops whichever of those is under it.
 */

export interface MonthGridItem {
  id: string;
  date: string; // YYYY-MM-DD (local)
  title: string;
  variant?: ScheduleItemVariant;
  completed?: boolean;
  isAllDay?: boolean;
  /**
   * The colour of the tag that speaks for this item (#1580), or undefined to
   * keep the variant colours. A hex, because it is the user's own value off
   * `wiki_tags.color` — the host resolves WHICH tag (buildItemTagColors) and
   * this is only the answer.
   */
  tagColor?: string | null;
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
  /**
   * A day was picked — the whole cell face is the target. Narrow's gesture
   * (#878 / #1148: move the anchor and open the drawer).
   *
   * Optional since #1584: Desktop used to wire this to "open the creation
   * panel", which put the only affordance on an invisible full-cell button —
   * nothing said the cell was pressable, and a press meant for a chip opened
   * the panel instead. Desktop passes `onCreateDay` now and no face button is
   * drawn at all.
   */
  onSelectDay?: (dateKey: string) => void;
  /**
   * Desktop's create gesture (#1584): renders a + in each cell's top-right
   * corner that hands back that cell's day.
   *
   * Ignored in `compact` — a phone cell is ~51px wide and its day already means
   * "show me this day", so a second target in it would be neither hittable nor
   * unambiguous.
   *
   * When this is the cell's only callback the + IS the cell's keyboard stop,
   * which is why `formatCreateLabel` has to name the day rather than the act.
   */
  onCreateDay?: (dateKey: string) => void;
  /**
   * A cell's "他 N 件" was pressed (#1829) — the host shows that day in full.
   *
   * Desktop only in practice: `compact` draws its remainder as one of four
   * title lines and the cell face is already the tap target there, so a
   * second control in a 51px cell would be neither hittable nor unambiguous.
   * Omitted, the line stays static text.
   */
  onShowMore?: (dateKey: string) => void;
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
   * A todo dragged in from outside the grid (the Schedule sidebar's "その他"
   * list — #1627) was dropped on a cell: the host gives it that day with no
   * time (`startTime` / `endTime` null). When omitted no cell takes a drop.
   */
  onDropTodo?: (drop: TodoCalendarDrop) => void;
  /**
   * Already-translated "他 N 件" formatter (§6.4). Both densities call it —
   * the count differs (chips cut at 2, dots at 3) but the phrase must not.
   */
  formatMoreCount: (n: number) => string;
  /** Accessible name for a day cell. Default = the raw date key. */
  formatDayLabel?: (dateKey: string) => string;
  /**
   * Already-translated accessible name for the "他 N 件" button (§6.4). Like
   * the + button's, it has to carry the DAY — the visible text is "+1" on
   * every cell that has one. Default = the raw date key.
   */
  formatShowMoreLabel?: (dateKey: string) => string;
  /**
   * Already-translated accessible name for a cell's + button (§6.4). It has to
   * carry the DAY: 42 buttons all called "Add" are 42 indistinguishable stops
   * in the tab order. Default = the raw date key, which at least says which.
   */
  formatCreateLabel?: (dateKey: string) => string;
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

function MonthGridImpl({
  monthKey,
  items,
  todayKey,
  selectedKey,
  weekdayLabels,
  onSelectDay,
  onCreateDay,
  onShowMore,
  onSelectItem,
  onItemActivate,
  onItemDoubleClick,
  onItemContextMenu,
  onDropTodo,
  formatMoreCount,
  formatDayLabel = (k) => k,
  formatCreateLabel = (k) => k,
  formatShowMoreLabel = (k) => k,
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

  const { dropDay, cellDrop } = useMonthCellDrop(onDropTodo);

  return (
    <div
      role="grid"
      aria-label={ariaLabel}
      className={cn(
        "flex flex-col overflow-hidden bg-lumen-bg",
        // #1835: at least as tall as the scroll box, so the six rows can take
        // the space left over. `min-h` and not `h`: a window too short for the
        // floor lets this grow past the box and the host scrolls to it, where
        // a fixed height would clip the last week against `overflow-hidden`.
        compact && "min-h-full",
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
          // Each density counts its own remainder (#1045 — monthCellFold).
          const { shown, overflow } = monthCellFold(dayItems.length, compact);
          return (
            <div
              key={dateKey}
              role="gridcell"
              // Only once a host actually picks a day: a grid whose every cell
              // says aria-selected="false" tells a screen reader there is a
              // selection to make, and the overview (#692) has none.
              aria-selected={selectedKey ? isSelected : undefined}
              data-month-cell={dateKey}
              // #1627: the cell owns its day, so a drop needs no coordinates.
              {...cellDrop(dateKey)}
              className={cn(
                // `group/cell` is the #1584 + button's hover reveal — the
                // button hides until this cell is pointed at.
                "group/cell relative border-b border-r border-lumen-border last:border-r-0",
                /*
                 * #1401: a fixed height that clips, so no title can move a
                 * grid line — versus Desktop's floor, which lets a cell grow.
                 *
                 * 88px since #1581 (70px before). 70 was exactly three title
                 * lines under the badge with nothing to spare, which is what
                 * made the cell read as packed. 88 is four lines plus ~6px of
                 * slack, on a badge that is smaller by the same change.
                 *
                 * A FLOOR since #1835, not a fixed height: the row track is
                 * `auto-rows-fr`, so once the grid is `min-h-full` the six
                 * rows divide whatever the viewport has left instead of
                 * stopping 123px short of the bottom bar. They can only grow —
                 * #1401's floor is exactly this number — and they grow into a
                 * box the size of the screen, which is the difference from the
                 * stretch that made the rows tower (a grid free to exceed the
                 * viewport). Six at the floor are taller than most phone
                 * viewports, so the host's wrapper still scrolls
                 * (CalendarNarrowLayout) rather than a week going out of
                 * sight.
                 */
                compact ? "min-h-[5.5rem] overflow-hidden" : "min-h-14",
                isSelected &&
                  "bg-lumen-bg-secondary ring-2 ring-inset ring-lumen-accent",
                dropDay === dateKey && "bg-lumen-hover",
              )}
            >
              {/* Full-cell day-select target (keyboard reachable). Chips sit
                  above it with pointer-events re-enabled. */}
              {onSelectDay && (
                <button
                  type="button"
                  aria-label={formatDayLabel(dateKey)}
                  onClick={() => onSelectDay(dateKey)}
                  className={cn(
                    "absolute inset-0 z-0 cursor-pointer transition-colors hover:bg-lumen-hover",
                    CELL_FOCUS,
                  )}
                />
              )}
              {!compact && onCreateDay && (
                <MonthCellCreateButton
                  label={formatCreateLabel(dateKey)}
                  onCreate={() => onCreateDay(dateKey)}
                />
              )}
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
                  <MonthCompactTitles
                    items={dayItems}
                    shown={shown}
                    overflow={overflow}
                    formatMoreCount={formatMoreCount}
                  />
                ) : (
                  <MonthFullChips
                    items={dayItems}
                    shown={shown}
                    overflow={overflow}
                    formatMoreCount={formatMoreCount}
                    onShowMore={
                      onShowMore ? () => onShowMore(dateKey) : undefined
                    }
                    // Named only when there IS a button to name (#1829). The
                    // formatter is the host's and usually wraps the same day
                    // formatter the cell's own label uses, so calling it on
                    // all 42 cells would double that work for one line.
                    showMoreLabel={
                      onShowMore && overflow > 0
                        ? formatShowMoreLabel(dateKey)
                        : undefined
                    }
                    onSelectItem={onSelectItem}
                    onItemActivate={onItemActivate}
                    onItemDoubleClick={onItemDoubleClick}
                    onItemContextMenu={onItemContextMenu}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/*
 * Memoised (#1582). Opening the Desktop creation panel is a state change in
 * CalendarTab, which re-renders the whole host — and this grid, whose 42 cells
 * and ~90 chips did not change, was 7-8 of the ~11ms that click cost (measured
 * in web/tests/monthCreatePanelPerf.test.tsx). Nothing about the grid's own
 * work was slow; it was simply being redone for a panel that opens above it.
 *
 * The comparison only pays off while every prop the hosts pass keeps its
 * identity across such a render: `items` is a memo (useScheduleGridFilters),
 * the item handlers are useCallbacks (useScheduleSelection), and the two
 * formatters are useCallbacks in the layouts (`formatMoreCount` was an inline
 * arrow until this issue — it alone defeated the memo). An inline arrow added
 * to either call site puts the 7ms straight back, which is what the render
 * -count assertions in that suite are there to catch.
 */
export const MonthGrid = memo(MonthGridImpl);
