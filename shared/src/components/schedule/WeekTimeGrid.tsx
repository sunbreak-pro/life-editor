import { useMemo, type CSSProperties } from "react";
import { cn } from "../cn";
import {
  dayOfWeek,
  layoutDayItems,
  weekDayKeys,
  type HourRange,
} from "../../utils/scheduleGridLayout";

/*
 * WeekTimeGrid (W8) — pure, presentational week/day time grid.
 *
 * Renders a left hour axis, a day-of-week header, an all-day lane, and a
 * scrollable time body where each schedule_item is absolutely positioned from
 * its `HH:MM` start/end (geometry comes from the pure `layoutDayItems` —
 * unit-tested separately). It is the 2-layer-model "complex screen" primitive:
 * the host renders it on WIDE and a plain agenda on NARROW.
 *
 * Pure presentation (CLAUDE.md §3.1 / §6.4): no DataService, no
 * useTranslation. All copy (weekday labels, "all-day", hour/date formatting)
 * is injected by the host already translated. notion-* tokens only; the grid
 * surfaces and event blocks use opaque backgrounds (§5). `days={1}` collapses
 * it to a single-day column so the same primitive can back a day view.
 */

export interface WeekTimeGridItem {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  isAllDay?: boolean;
  completed?: boolean;
}

export interface WeekTimeGridProps {
  /** First (left-most) day column, YYYY-MM-DD. */
  weekStart: string;
  /** Number of day columns; 7 = week, 1 = single day. Default 7. */
  days?: number;
  items: WeekTimeGridItem[];
  selectedId?: string | null;
  onSelectItem?: (id: string) => void;
  /** Visible [startHour, endHour] window, 0–24. Default [0, 24]. */
  hourRange?: HourRange;
  /** Pixel height of one hour row in the scrollable body. Default 48. */
  hourHeight?: number;
  /** Already-translated weekday labels indexed 0 (Sun) – 6 (Sat) (§6.4). */
  weekdayLabels: string[];
  /** Already-translated label for the all-day lane (§6.4). */
  allDayLabel: string;
  /** Date key (YYYY-MM-DD) to highlight as "today", or null. */
  todayKey?: string | null;
  /** Host-supplied hour-axis formatter. Default zero-padded `HH:00`. */
  formatHour?: (hour: number) => string;
  /** Host-supplied day-heading date formatter. Default `M/D`. */
  formatDayDate?: (dateKey: string) => string;
  className?: string;
}

const GUTTER = "3.25rem"; // hour-axis column width

function defaultFormatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function defaultFormatDayDate(dateKey: string): string {
  const [, m, d] = dateKey.split("-").map(Number);
  return `${m}/${d}`;
}

export function WeekTimeGrid({
  weekStart,
  days = 7,
  items,
  selectedId,
  onSelectItem,
  hourRange = [0, 24],
  hourHeight = 48,
  weekdayLabels,
  allDayLabel,
  todayKey,
  formatHour = defaultFormatHour,
  formatDayDate = defaultFormatDayDate,
  className,
}: WeekTimeGridProps) {
  const [startHour, endHour] = hourRange;
  const dayKeys = useMemo(
    () => weekDayKeys(weekStart, days),
    [weekStart, days],
  );
  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = startHour; h < endHour; h++) out.push(h);
    return out;
  }, [startHour, endHour]);
  const bodyHeight = (endHour - startHour) * hourHeight;

  // Bucket items per day key once.
  const byDay = useMemo(() => {
    const map = new Map<string, WeekTimeGridItem[]>();
    for (const key of dayKeys) map.set(key, []);
    for (const it of items) {
      const bucket = map.get(it.date);
      if (bucket) bucket.push(it);
    }
    return map;
  }, [items, dayKeys]);

  const columnsTemplate: CSSProperties = {
    gridTemplateColumns: `${GUTTER} repeat(${days}, minmax(0, 1fr))`,
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-notion-border bg-notion-bg",
        className,
      )}
    >
      {/* Day-of-week header */}
      <div
        className="grid border-b border-notion-border bg-notion-bg"
        style={columnsTemplate}
      >
        <div aria-hidden className="border-r border-notion-border" />
        {dayKeys.map((key) => {
          const isToday = !!todayKey && key === todayKey;
          return (
            <div
              key={key}
              className={cn(
                "border-r border-notion-border px-1 py-1.5 text-center last:border-r-0",
                isToday && "bg-notion-hover",
              )}
            >
              <div
                className={cn(
                  "text-[11px] font-medium uppercase tracking-wide",
                  isToday ? "text-notion-accent" : "text-notion-text-secondary",
                )}
              >
                {weekdayLabels[dayOfWeek(key)] ?? ""}
              </div>
              <div
                className={cn(
                  "text-xs",
                  isToday
                    ? "font-semibold text-notion-accent"
                    : "text-notion-text",
                )}
              >
                {formatDayDate(key)}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day lane */}
      <div
        className="grid border-b border-notion-border bg-notion-bg"
        style={columnsTemplate}
      >
        <div className="flex items-center justify-end border-r border-notion-border px-1 py-1 text-[10px] text-notion-text-secondary">
          {allDayLabel}
        </div>
        {dayKeys.map((key) => {
          const allDay = (byDay.get(key) ?? []).filter((i) => i.isAllDay);
          return (
            <div
              key={key}
              className="min-h-[1.75rem] space-y-1 border-r border-notion-border p-1 last:border-r-0"
            >
              {allDay.map((it) => {
                const selected = it.id === selectedId;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => onSelectItem?.(it.id)}
                    title={it.title}
                    className={cn(
                      "block w-full truncate rounded border-l-2 border-notion-accent bg-notion-bg-secondary px-1 py-0.5 text-left text-[11px] text-notion-text hover:bg-notion-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-notion-accent",
                      selected && "ring-2 ring-notion-accent",
                      it.completed && "text-notion-text-secondary line-through",
                    )}
                  >
                    {it.title || " "}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Scrollable time body */}
      <div className="max-h-[60vh] overflow-y-auto">
        <div className="grid" style={columnsTemplate}>
          {/* Hour axis */}
          <div className="border-r border-notion-border">
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: hourHeight }}
                className="relative"
              >
                <span className="absolute -top-1.5 right-1 text-[10px] tabular-nums text-notion-text-secondary">
                  {formatHour(h)}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {dayKeys.map((key) => {
            const dayItems = byDay.get(key) ?? [];
            const positioned = layoutDayItems(dayItems, hourRange);
            const posById = new Map(positioned.map((p) => [p.id, p]));
            return (
              <div
                key={key}
                className="relative border-r border-notion-border last:border-r-0"
                style={{ height: bodyHeight }}
              >
                {/* Hour gridlines */}
                {hours.map((h, i) => (
                  <div
                    key={h}
                    aria-hidden
                    className="absolute inset-x-0 border-t border-notion-border"
                    style={{ top: i * hourHeight }}
                  />
                ))}
                {/* Timed events */}
                {dayItems.map((it) => {
                  const p = posById.get(it.id);
                  if (!p) return null; // all-day handled above
                  const selected = it.id === selectedId;
                  const widthPct = 100 / p.columns;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => onSelectItem?.(it.id)}
                      title={`${it.startTime}–${it.endTime} ${it.title}`}
                      className={cn(
                        "absolute overflow-hidden rounded border-l-2 border-notion-accent bg-notion-bg-secondary px-1 py-0.5 text-left text-[11px] leading-tight text-notion-text hover:z-10 hover:bg-notion-hover focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-notion-accent",
                        selected && "z-10 ring-2 ring-notion-accent",
                        it.completed &&
                          "text-notion-text-secondary line-through",
                      )}
                      style={{
                        top: `${p.topPct}%`,
                        height: `${p.heightPct}%`,
                        left: `calc(${p.column * widthPct}% + 1px)`,
                        width: `calc(${widthPct}% - 2px)`,
                      }}
                    >
                      <span className="block truncate font-medium">
                        {it.title || " "}
                      </span>
                      <span className="block truncate text-[10px] text-notion-text-secondary">
                        {it.startTime}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
