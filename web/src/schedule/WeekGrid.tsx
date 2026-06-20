import { useEffect, useMemo, useRef, useState } from "react";
import {
  useScheduleItemsContext,
  layoutDayEvents,
  weekDates,
  addDays,
  todayLocal,
  minutesToTime,
  snapMinutes,
  type ScheduleItem,
} from "@life-editor/shared";

/*
 * W8 — week-view time grid.
 *
 * W8-1 (render + navigate): the 7 days of the anchored week as a time grid —
 * a left hour gutter plus 7 day columns, timed events positioned by start/end
 * time and overlap-split into columns (geometry from shared/utils/
 * weekGridLayout, which is unit-tested). All-day events sit in a strip above.
 *
 * W8-2 (create + edit): click an empty slot to create a 1-hour event at the
 * snapped time; click an event to open the editor panel below the grid (title
 * / start / end / all-day / done / delete-or-dismiss). Mutations update the
 * grid optimistically and call through the ScheduleItems DataService surface;
 * Refresh reconciles with the server. Drag-to-move / resize is W8-3.
 *
 * English-only, matching the established web Schedule convention (i18n arrives
 * with the Settings i18n pass, like ScheduleItemsView / CalendarView).
 */

const SLOT_HEIGHT = 44; // px per hour
const GRID_HOURS = 24;
const GUTTER_PX = 52;
const SCROLL_TO_HOUR = 7; // open scrolled near the start of the day
const SNAP_MIN = 30; // create snaps to the half hour
const DEFAULT_DURATION_MIN = 60;

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
  const {
    loadDateRange,
    createScheduleItem,
    updateScheduleItem,
    toggleComplete,
    deleteScheduleItem,
    dismiss,
  } = useScheduleItemsContext();

  const [anchor, setAnchor] = useState<string>(() => todayLocal());
  const [weekItems, setWeekItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  // ── Optimistic local mutations (keep the grid live without refetch races) ──
  const patchLocal = (id: string, updates: Partial<ScheduleItem>) =>
    setWeekItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...updates } : it)),
    );
  const removeLocal = (id: string) =>
    setWeekItems((prev) => prev.filter((it) => it.id !== id));

  const handleCreateAt = (date: string, minutes: number) => {
    const startMin = snapMinutes(minutes, SNAP_MIN);
    const startTime = minutesToTime(startMin);
    const endTime = minutesToTime(startMin + DEFAULT_DURATION_MIN);
    const title = "New event";
    const id = createScheduleItem(date, title, startTime, endTime);
    const nowIso = new Date().toISOString();
    const optimistic: ScheduleItem = {
      id,
      date,
      title,
      startTime,
      endTime,
      completed: false,
      completedAt: null,
      routineId: null,
      templateId: null,
      memo: null,
      noteId: null,
      content: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setWeekItems((prev) => [...prev, optimistic]);
    setSelectedId(id);
  };

  const commitField = (id: string, updates: Partial<ScheduleItem>) => {
    patchLocal(id, updates);
    updateScheduleItem(id, updates);
  };

  const handleToggleDone = (item: ScheduleItem) => {
    patchLocal(item.id, { completed: !item.completed });
    toggleComplete(item.id);
  };

  const handleRemove = (item: ScheduleItem) => {
    removeLocal(item.id);
    if (item.routineId) dismiss(item.id);
    else deleteScheduleItem(item.id);
    setSelectedId(null);
  };

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

  const selected = useMemo(
    () => (selectedId ? weekItems.find((i) => i.id === selectedId) ?? null : null),
    [selectedId, weekItems],
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
                  <button
                    key={i.id}
                    type="button"
                    title={i.title}
                    onClick={() => setSelectedId(i.id)}
                    className={`block w-full truncate rounded px-1 text-left text-[11px] text-notion-on-accent ${
                      i.id === selectedId
                        ? "bg-notion-primary ring-1 ring-notion-text"
                        : "bg-notion-accent"
                    }`}
                  >
                    {i.title || "(untitled)"}
                  </button>
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
                {/* Click catcher: empty-slot click → create at that time */}
                <button
                  type="button"
                  aria-label={`Create event on ${d}`}
                  className="absolute inset-0 z-0 cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    handleCreateAt(d, (y / SLOT_HEIGHT) * 60);
                  }}
                />
                {/* Positioned events (above the catcher) */}
                {positioned.map((p) => {
                  const widthPct = 100 / p.columnCount;
                  const done = p.item.completed;
                  const isSel = p.item.id === selectedId;
                  return (
                    <button
                      key={p.item.id}
                      type="button"
                      title={`${p.item.startTime}–${p.item.endTime} ${p.item.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(p.item.id);
                      }}
                      style={{
                        position: "absolute",
                        top: p.top,
                        height: p.height,
                        left: `calc(${p.column * widthPct}% + 1px)`,
                        width: `calc(${widthPct}% - 2px)`,
                      }}
                      className={`z-10 overflow-hidden rounded px-1 text-left text-[11px] leading-tight ${
                        done
                          ? "bg-notion-bg-secondary text-notion-text-secondary line-through"
                          : "bg-notion-accent text-notion-on-accent"
                      } ${isSel ? "ring-2 ring-notion-text" : ""}`}
                    >
                      <div className="truncate font-medium">
                        {p.item.title || "(untitled)"}
                      </div>
                      <div className="truncate opacity-90">
                        {p.item.startTime}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Editor panel (W8-2) */}
      {selected && (
        <div className="flex flex-wrap items-center gap-2 border-t border-notion-border px-3 py-2">
          <input
            type="text"
            value={selected.title}
            placeholder="Event title"
            onChange={(e) => patchLocal(selected.id, { title: e.target.value })}
            onBlur={(e) =>
              updateScheduleItem(selected.id, { title: e.target.value })
            }
            className="min-w-[12rem] flex-1 rounded-md border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text"
          />
          {!selected.isAllDay && (
            <>
              <input
                type="time"
                value={selected.startTime}
                onChange={(e) =>
                  commitField(selected.id, { startTime: e.target.value })
                }
                className="rounded-md border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text"
              />
              <span className="text-notion-text-secondary">–</span>
              <input
                type="time"
                value={selected.endTime}
                onChange={(e) =>
                  commitField(selected.id, { endTime: e.target.value })
                }
                className="rounded-md border border-notion-border bg-notion-bg px-2 py-1 text-sm text-notion-text"
              />
            </>
          )}
          <label className="flex items-center gap-1 text-sm text-notion-text">
            <input
              type="checkbox"
              checked={!!selected.isAllDay}
              onChange={(e) =>
                commitField(selected.id, { isAllDay: e.target.checked })
              }
            />
            All-day
          </label>
          <label className="flex items-center gap-1 text-sm text-notion-text">
            <input
              type="checkbox"
              checked={selected.completed}
              onChange={() => handleToggleDone(selected)}
            />
            Done
          </label>
          {selected.routineId && (
            <span className="rounded bg-notion-bg-secondary px-1.5 py-0.5 text-[11px] text-notion-text-secondary">
              routine
            </span>
          )}
          <button
            type="button"
            onClick={() => handleRemove(selected)}
            className="rounded-md border border-notion-border px-2 py-1 text-sm text-notion-danger hover:bg-notion-bg-hover"
          >
            {selected.routineId ? "Dismiss" : "Delete"}
          </button>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="rounded-md border border-notion-border px-2 py-1 text-sm text-notion-text-secondary hover:bg-notion-bg-hover"
          >
            Close
          </button>
        </div>
      )}
    </section>
  );
}
