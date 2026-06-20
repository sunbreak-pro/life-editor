import { useEffect, useMemo, useRef, useState } from "react";
import {
  useScheduleItemsContext,
  layoutDayEvents,
  weekDates,
  addDays,
  todayLocal,
  type ScheduleItem,
} from "@life-editor/shared";

/*
 * W8-1 — week-view time grid (read-only render + week navigation).
 *
 * Renders the 7 days of the anchored week as a time grid: a left hour gutter
 * plus 7 day columns, with timed events positioned by start/end time and
 * overlap-split into columns (geometry from shared/utils/weekGridLayout, which
 * is unit-tested). All-day events sit in a strip above the grid.
 *
 * Scope (W8-1): read + navigate only. Click-to-create / inline edit (W8-2) and
 * drag-to-move / resize (W8-3) land next. The grid keeps its own week-range
 * cache via loadDateRange (the ScheduleItemsProvider `items` are anchored to a
 * single day); a Refresh button re-pulls after edits made in the list below.
 *
 * English-only, matching the established web Schedule convention (i18n arrives
 * with the Settings i18n pass, like ScheduleItemsView / CalendarView).
 */

const SLOT_HEIGHT = 44; // px per hour
const GRID_HOURS = 24;
const GUTTER_PX = 52;
const SCROLL_TO_HOUR = 7; // open scrolled near the start of the day

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function rangeLabel(days: string[]): string {
  const [a] = days;
  const b = days[days.length - 1];
  return `${a} – ${b}`;
}

function fmtDayNum(dateStr: string): string {
  return String(Number(dateStr.split("-")[2]));
}

export function WeekGrid() {
  const { loadDateRange } = useScheduleItemsContext();

  const [anchor, setAnchor] = useState<string>(() => todayLocal());
  const [weekItems, setWeekItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const days = useMemo(() => weekDates(anchor), [anchor]);
  const today = todayLocal();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Pull the visible week whenever the anchor (or manual reload) changes.
  // The fetch lives in an async function so the loading/result setState calls
  // happen in callbacks, not synchronously in the effect body.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const rows = await loadDateRange(days[0], days[6]);
        if (!cancelled) setWeekItems(rows);
      } catch {
        if (!cancelled) setWeekItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [days, loadDateRange, reloadKey]);

  // Open scrolled to the working part of the day instead of midnight.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = SCROLL_TO_HOUR * SLOT_HEIGHT;
    }
  }, []);

  // Group items by day for both the all-day strip and the timed grid.
  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const d of days) map.set(d, []);
    for (const it of weekItems) {
      if (it.isDismissed) continue;
      const bucket = map.get(it.date);
      if (bucket) bucket.push(it);
    }
    return map;
  }, [weekItems, days]);

  const hasAllDay = useMemo(
    () => weekItems.some((i) => i.isAllDay && !i.isDismissed),
    [weekItems],
  );

  return (
    <section className="rounded-lg border border-notion-border bg-notion-bg">
      {/* Header: navigation + week range */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-notion-border px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAnchor((a) => addDays(a, -7))}
            className="rounded-md border border-notion-border px-2 py-1 text-sm text-notion-text hover:bg-notion-bg-hover"
            aria-label="Previous week"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setAnchor(todayLocal())}
            className="rounded-md border border-notion-border px-2 py-1 text-sm text-notion-text hover:bg-notion-bg-hover"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setAnchor((a) => addDays(a, 7))}
            className="rounded-md border border-notion-border px-2 py-1 text-sm text-notion-text hover:bg-notion-bg-hover"
            aria-label="Next week"
          >
            ›
          </button>
        </div>
        <div className="text-sm font-medium text-notion-text">
          {rangeLabel(days)}
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="rounded-md border border-notion-border px-2 py-1 text-sm text-notion-text-secondary hover:bg-notion-bg-hover"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Day headers */}
      <div className="flex border-b border-notion-border">
        <div style={{ width: GUTTER_PX }} className="shrink-0" />
        {days.map((d, i) => {
          const isToday = d === today;
          return (
            <div
              key={d}
              className={`flex-1 px-1 py-1 text-center text-xs ${
                isToday
                  ? "bg-notion-accent-subtle font-semibold text-notion-text"
                  : "text-notion-text-secondary"
              }`}
            >
              <span>{WEEKDAY_LABELS[i]}</span>{" "}
              <span className="text-notion-text">{fmtDayNum(d)}</span>
            </div>
          );
        })}
      </div>

      {/* All-day strip (only when present) */}
      {hasAllDay && (
        <div className="flex border-b border-notion-border bg-notion-bg-secondary">
          <div
            style={{ width: GUTTER_PX }}
            className="shrink-0 px-1 py-1 text-right text-[10px] text-notion-text-secondary"
          >
            all-day
          </div>
          {days.map((d) => (
            <div key={d} className="flex-1 space-y-0.5 px-1 py-1">
              {(byDay.get(d) ?? [])
                .filter((i) => i.isAllDay)
                .map((i) => (
                  <div
                    key={i.id}
                    title={i.title}
                    className="truncate rounded bg-notion-accent px-1 text-[11px] text-notion-on-accent"
                  >
                    {i.title || "(untitled)"}
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} className="max-h-[560px] overflow-y-auto">
        <div className="flex" style={{ height: GRID_HOURS * SLOT_HEIGHT }}>
          {/* Hour gutter */}
          <div style={{ width: GUTTER_PX }} className="relative shrink-0">
            {Array.from({ length: GRID_HOURS }, (_, h) => (
              <div
                key={h}
                style={{ height: SLOT_HEIGHT }}
                className="relative border-b border-notion-border"
              >
                <span className="absolute -top-1.5 right-1 text-[10px] text-notion-text-secondary">
                  {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d) => {
            const positioned = layoutDayEvents(byDay.get(d) ?? [], {
              slotHeight: SLOT_HEIGHT,
            });
            return (
              <div
                key={d}
                className={`relative flex-1 border-l border-notion-border ${
                  d === today ? "bg-notion-accent-subtle" : ""
                }`}
              >
                {/* Hour lines */}
                {Array.from({ length: GRID_HOURS }, (_, h) => (
                  <div
                    key={h}
                    style={{ height: SLOT_HEIGHT }}
                    className="border-b border-notion-border"
                  />
                ))}
                {/* Positioned events */}
                {positioned.map((p) => {
                  const widthPct = 100 / p.columnCount;
                  const done = p.item.completed;
                  return (
                    <div
                      key={p.item.id}
                      title={`${p.item.startTime}–${p.item.endTime} ${p.item.title}`}
                      style={{
                        position: "absolute",
                        top: p.top,
                        height: p.height,
                        left: `calc(${p.column * widthPct}% + 1px)`,
                        width: `calc(${widthPct}% - 2px)`,
                      }}
                      className={`overflow-hidden rounded px-1 text-[11px] leading-tight ${
                        done
                          ? "bg-notion-bg-secondary text-notion-text-secondary line-through"
                          : "bg-notion-accent text-notion-on-accent"
                      }`}
                    >
                      <div className="truncate font-medium">
                        {p.item.title || "(untitled)"}
                      </div>
                      <div className="truncate opacity-90">
                        {p.item.startTime}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
