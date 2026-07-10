import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Repeat } from "lucide-react";
import { cn } from "../cn";
import {
  dayOfWeek,
  layoutDayItems,
  weekDayKeys,
  minutesFromMidnight,
  pxToMinutes,
  minutesToPx,
  snapMinutes,
  minutesToTime,
  DEFAULT_SNAP_MINUTES,
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
 * Interaction (W8 salvage): when the host injects the optional callbacks, the
 * grid becomes editable WITHOUT breaking its purity contract:
 *   - clicking an empty slot calls `onCreateAt(dateISO, snappedMinutes)`;
 *   - dragging an event body calls `onMoveItem(id, newStartISO, newEndISO)`
 *     (vertical = time, horizontal = day) on pointer-up;
 *   - dragging an event's bottom handle calls `onResizeItem(id, newEndISO)`.
 * All snapping/geometry is done with the pure helpers in scheduleGridLayout;
 * native pointer listeners are attached to `window` only while a drag is live
 * and ALWAYS removed on cleanup. The live drag re-layouts optimistically via
 * local `dragPreview` state; persistence is the host's job.
 *
 * Pure presentation (CLAUDE.md §3.1 / §6.4): no DataService, no
 * useTranslation. All copy (weekday labels, "all-day", hour/date formatting)
 * is injected by the host already translated. lumen-* tokens only; the grid
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
  /**
   * Provenance color code (W8 target-IA): "routine" = 藍 face + left band +
   * Repeat glyph, "event" (default) = 紫 face + border. Distinguishes
   * Routine-generated items from single events without relying on color alone.
   */
  variant?: "routine" | "event";
}

export interface WeekTimeGridProps {
  /** First (left-most) day column, YYYY-MM-DD. */
  weekStart: string;
  /** Number of day columns; 7 = week, 1 = single day. Default 7. */
  days?: number;
  items: WeekTimeGridItem[];
  selectedId?: string | null;
  onSelectItem?: (id: string) => void;
  /**
   * Empty-slot click → create. `dateISO` is the column's YYYY-MM-DD; `minutes`
   * is the snapped minutes-from-midnight of the click. When omitted the grid is
   * read-only (no click catcher rendered).
   */
  onCreateAt?: (dateISO: string, minutes: number) => void;
  /**
   * Event body drag (move) committed on pointer-up. New start/end are HH:MM and
   * `dateISO` may differ from the original (horizontal drag = day change). When
   * omitted, event bodies are not draggable.
   */
  onMoveItem?: (
    id: string,
    dateISO: string,
    startISO: string,
    endISO: string,
  ) => void;
  /**
   * Event bottom-handle drag (resize) committed on pointer-up. Only the end
   * time changes. When omitted, no resize handle is rendered.
   */
  onResizeItem?: (id: string, endISO: string) => void;
  /** Snap granularity in minutes for create/move/resize. Default 30. */
  snapMinutesStep?: number;
  /** Default duration (minutes) of an event created via empty-slot click. Default 60. */
  defaultCreateDuration?: number;
  /** Visible [startHour, endHour] window, 0–24. Default [0, 24]. */
  hourRange?: HourRange;
  /** Pixel height of one hour row in the scrollable body. Default 48. */
  hourHeight?: number;
  /** Already-translated weekday labels indexed 0 (Sun) – 6 (Sat) (§6.4). */
  weekdayLabels: string[];
  /** Already-translated label for the all-day lane (§6.4). */
  allDayLabel: string;
  /** Already-translated accessible label for an empty-slot create target (§6.4). */
  createSlotLabel?: string;
  /** Date key (YYYY-MM-DD) to highlight as "today", or null. */
  todayKey?: string | null;
  /**
   * Current time as minutes-from-midnight. When set and inside the visible
   * hourRange, a now-line (2px accent rule + left dot + gutter time label) is
   * drawn in the `todayKey` column, and the body auto-scrolls near it on mount.
   * null / out-of-range → no now-line. Also seeds the mount auto-scroll target
   * (falls back to 08:00 when null).
   */
  nowMinutes?: number | null;
  /** Host-supplied formatter for the now-line gutter label. Default `HH:MM`. */
  formatNowLabel?: (minutes: number) => string;
  /**
   * When true the scrollable time body follows the parent's height
   * (`flex-1 min-h-0`) instead of the default `max-h-[60vh]`, so the grid can
   * fill a full-height Calendar tab. Default false (legacy behavior).
   */
  fillHeight?: boolean;
  /** Host-supplied hour-axis formatter. Default zero-padded `HH:00`. */
  formatHour?: (hour: number) => string;
  /** Host-supplied day-heading date formatter. Default `M/D`. */
  formatDayDate?: (dateKey: string) => string;
  className?: string;
}

const GUTTER = "3.25rem"; // hour-axis column width
const DRAG_THRESHOLD_PX = 4; // pointer travel below this counts as a click

function defaultFormatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function defaultFormatDayDate(dateKey: string): string {
  const [, m, d] = dateKey.split("-").map(Number);
  return `${m}/${d}`;
}

function defaultFormatNowLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Face classes for a timed block by provenance (W8). Routine = 藍 face (an
 * inner left band is rendered separately); event (default) = 紫 face + border.
 * Color-coded AND badge/border-differentiated so it never relies on hue alone.
 */
function variantBlockClasses(variant: "routine" | "event"): string {
  return variant === "routine"
    ? "bg-lumen-schedule-routine-bg text-lumen-chip-routine-fg"
    : "border border-lumen-schedule-event-border bg-lumen-schedule-event-bg text-lumen-chip-event-fg";
}

/** Live drag state held in a ref so the window listeners read fresh values. */
interface DragState {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  /** Width of one day column in px (move = horizontal day mapping). */
  colWidth: number;
  /** Index of the dragged item's day within `dayKeys`. */
  origDayIdx: number;
  origStartMin: number;
  durationMin: number;
  moved: boolean;
  /** Latest snapped result, persisted on pointer-up. */
  final: { dateISO: string; startMin: number; endMin: number } | null;
}

/** Optimistic preview applied to one item during a live drag. */
interface DragPreview {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

export function WeekTimeGrid({
  weekStart,
  days = 7,
  items,
  selectedId,
  onSelectItem,
  onCreateAt,
  onMoveItem,
  onResizeItem,
  snapMinutesStep = DEFAULT_SNAP_MINUTES,
  defaultCreateDuration = 60,
  hourRange = [0, 24],
  hourHeight = 48,
  weekdayLabels,
  allDayLabel,
  createSlotLabel,
  todayKey,
  nowMinutes,
  formatNowLabel = defaultFormatNowLabel,
  fillHeight = false,
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

  // Now-line geometry. Only drawn when nowMinutes is inside the visible window.
  const nowVisible =
    nowMinutes != null &&
    nowMinutes >= startHour * 60 &&
    nowMinutes <= endHour * 60;
  const nowPx = nowVisible
    ? minutesToPx(nowMinutes as number, hourHeight, hourRange)
    : 0;

  // Mount auto-scroll: bring the now-line (or 08:00 when absent) into view.
  // scrollIntoView would also nudge horizontal scroll, so we set scrollTop
  // directly on the body ref (once, on mount).
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollBodyRef.current;
    if (!el) return;
    const target = nowMinutes ?? 8 * 60;
    const clampedTarget = Math.min(
      Math.max(target, startHour * 60),
      endHour * 60,
    );
    const px = minutesToPx(clampedTarget, hourHeight, hourRange);
    // Center-ish: pull the target up by one hour so context above stays visible.
    el.scrollTop = Math.max(0, px - hourHeight);
    // Mount-only (initial focus); later nowMinutes ticks must not yank scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Drag-to-move / resize (native pointer events) ─────────────────────────
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const dragInteractive = !!(onMoveItem || onResizeItem);

  // Merge any live drag preview onto the source items so both the bucketing and
  // the absolute layout reflect the optimistic position during a drag.
  const effectiveItems = useMemo(() => {
    if (!dragPreview) return items;
    return items.map((it) =>
      it.id === dragPreview.id
        ? {
            ...it,
            date: dragPreview.date,
            startTime: dragPreview.startTime,
            endTime: dragPreview.endTime,
          }
        : it,
    );
  }, [items, dragPreview]);

  // Bucket items per day key once.
  const byDay = useMemo(() => {
    const map = new Map<string, WeekTimeGridItem[]>();
    for (const key of dayKeys) map.set(key, []);
    for (const it of effectiveItems) {
      const bucket = map.get(it.date);
      if (bucket) bucket.push(it);
    }
    return map;
  }, [effectiveItems, dayKeys]);

  const beginDrag = (
    e: React.PointerEvent,
    item: WeekTimeGridItem,
    mode: "move" | "resize",
  ) => {
    if (e.button !== 0 || item.isAllDay) return;
    if (mode === "move" && !onMoveItem) return;
    if (mode === "resize" && !onResizeItem) return;
    e.stopPropagation();
    // The event button's offsetParent is its day column; its width maps a
    // horizontal drag to a whole-day offset. Resize ignores width.
    const col = (e.currentTarget as HTMLElement)
      .offsetParent as HTMLElement | null;
    const startMin = minutesFromMidnight(item.startTime);
    const rawEnd = minutesFromMidnight(item.endTime);
    const endMin = Math.max(rawEnd, startMin + snapMinutesStep);
    dragRef.current = {
      id: item.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      colWidth: col ? col.getBoundingClientRect().width : 0,
      origDayIdx: dayKeys.indexOf(item.date),
      origStartMin: startMin,
      durationMin: endMin - startMin,
      moved: false,
      final: null,
    };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD_PX) return;
      d.moved = true;
      const deltaMin = (dy / hourHeight) * 60;
      let dayIdx = d.origDayIdx;
      let startMin = d.origStartMin;
      let endMin: number;
      if (d.mode === "move") {
        startMin = snapMinutes(d.origStartMin + deltaMin, snapMinutesStep);
        endMin = startMin + d.durationMin;
        if (d.colWidth > 0 && dayKeys.length > 1) {
          const offset = Math.round(dx / d.colWidth);
          dayIdx = Math.min(
            dayKeys.length - 1,
            Math.max(0, d.origDayIdx + offset),
          );
        }
      } else {
        endMin = Math.max(
          snapMinutes(
            d.origStartMin + d.durationMin + deltaMin,
            snapMinutesStep,
          ),
          d.origStartMin + snapMinutesStep,
        );
      }
      const dateISO = dayKeys[dayIdx] ?? dayKeys[d.origDayIdx];
      d.final = { dateISO, startMin, endMin };
      setDragPreview({
        id: d.id,
        date: dateISO,
        startTime: minutesToTime(startMin),
        endTime: minutesToTime(endMin),
      });
    };
    const onUp = () => {
      const d = dragRef.current;
      if (d) {
        if (d.moved && d.final) {
          if (d.mode === "move") {
            onMoveItem?.(
              d.id,
              d.final.dateISO,
              minutesToTime(d.final.startMin),
              minutesToTime(d.final.endMin),
            );
          } else {
            onResizeItem?.(d.id, minutesToTime(d.final.endMin));
          }
        } else {
          onSelectItem?.(d.id);
        }
      }
      dragRef.current = null;
      setDragPreview(null);
      setDragging(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [
    dragging,
    dayKeys,
    hourHeight,
    snapMinutesStep,
    onMoveItem,
    onResizeItem,
    onSelectItem,
  ]);

  const handleSlotClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    dateKey: string,
  ) => {
    if (!onCreateAt) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = snapMinutes(
      pxToMinutes(y, hourHeight, hourRange),
      snapMinutesStep,
    );
    // Keep the created event inside the visible window even after snapping.
    const maxStart = endHour * 60 - defaultCreateDuration;
    onCreateAt(dateKey, Math.min(minutes, Math.max(startHour * 60, maxStart)));
  };

  const columnsTemplate: CSSProperties = {
    gridTemplateColumns: `${GUTTER} repeat(${days}, minmax(0, 1fr))`,
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-lumen-border bg-lumen-bg",
        fillHeight && "flex h-full min-h-0 flex-col",
        dragging && "select-none",
        className,
      )}
    >
      {/* Day-of-week header */}
      <div
        className="grid border-b border-lumen-border bg-lumen-bg"
        style={columnsTemplate}
      >
        <div aria-hidden className="border-r border-lumen-border" />
        {dayKeys.map((key) => {
          const isToday = !!todayKey && key === todayKey;
          return (
            <div
              key={key}
              className={cn(
                "border-r border-lumen-border px-1 py-1.5 text-center last:border-r-0",
                isToday && "bg-lumen-hover",
              )}
            >
              <div
                className={cn(
                  "text-[11px] font-medium uppercase tracking-wide",
                  isToday ? "text-lumen-accent" : "text-lumen-text-secondary",
                )}
              >
                {weekdayLabels[dayOfWeek(key)] ?? ""}
              </div>
              <div
                className={cn(
                  "text-xs",
                  isToday
                    ? "font-semibold text-lumen-accent"
                    : "text-lumen-text",
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
        className="grid border-b border-lumen-border bg-lumen-bg"
        style={columnsTemplate}
      >
        <div className="flex items-center justify-end border-r border-lumen-border px-1 py-1 text-[10px] text-lumen-text-secondary">
          {allDayLabel}
        </div>
        {dayKeys.map((key) => {
          const allDay = (byDay.get(key) ?? []).filter((i) => i.isAllDay);
          return (
            <div
              key={key}
              className="min-h-[1.75rem] space-y-1 border-r border-lumen-border p-1 last:border-r-0"
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
                      "block w-full truncate rounded border-l-2 border-lumen-accent bg-lumen-bg-secondary px-1 py-0.5 text-left text-[11px] text-lumen-text hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                      selected && "ring-2 ring-lumen-accent",
                      it.completed && "text-lumen-text-secondary line-through",
                    )}
                  >
                    {it.title || " "}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Scrollable time body */}
      <div
        ref={scrollBodyRef}
        className={cn(
          "overflow-y-auto",
          fillHeight ? "min-h-0 flex-1" : "max-h-[60vh]",
        )}
      >
        <div className="grid" style={columnsTemplate}>
          {/* Hour axis */}
          <div className="relative border-r border-lumen-border">
            {hours.map((h) => (
              <div key={h} style={{ height: hourHeight }} className="relative">
                <span className="absolute -top-1.5 right-1 text-[10px] tabular-nums text-lumen-text-secondary">
                  {formatHour(h)}
                </span>
              </div>
            ))}
            {/* Now-line time label, aligned to the accent rule in the today column */}
            {nowVisible && (
              <span
                aria-hidden
                className="absolute right-1 z-20 -translate-y-1/2 rounded-sm bg-lumen-bg px-0.5 text-[10px] font-bold tabular-nums text-lumen-accent"
                style={{ top: nowPx }}
              >
                {formatNowLabel(nowMinutes as number)}
              </span>
            )}
          </div>

          {/* Day columns */}
          {dayKeys.map((key) => {
            const dayItems = byDay.get(key) ?? [];
            const positioned = layoutDayItems(dayItems, hourRange);
            const posById = new Map(positioned.map((p) => [p.id, p]));
            const isToday = !!todayKey && key === todayKey;
            return (
              <div
                key={key}
                className={cn(
                  "relative border-r border-lumen-border last:border-r-0",
                  isToday && "bg-lumen-accent-subtle",
                )}
                style={{ height: bodyHeight }}
              >
                {/* Hour gridlines */}
                {hours.map((h, i) => (
                  <div
                    key={h}
                    aria-hidden
                    className="absolute inset-x-0 border-t border-lumen-border"
                    style={{ top: i * hourHeight }}
                  />
                ))}
                {/* Empty-slot click catcher (create) — only when host opts in.
                    Hover paints a faint accent ghost + dashed accent border so
                    the click-to-create affordance reads. Accent (not the grey
                    hover) so it stays distinct from the grid lines AND remains
                    visible over the accent-subtle "today" column. */}
                {onCreateAt && (
                  <button
                    type="button"
                    aria-label={createSlotLabel ?? `Create on ${key}`}
                    onClick={(e) => handleSlotClick(e, key)}
                    className="absolute inset-0 z-0 cursor-pointer rounded-sm border border-transparent transition-colors hover:border-dashed hover:border-lumen-accent hover:bg-lumen-accent-subtle"
                  />
                )}
                {/* Timed events */}
                {dayItems.map((it) => {
                  const p = posById.get(it.id);
                  if (!p) return null; // all-day handled above
                  const selected = it.id === selectedId;
                  const widthPct = 100 / p.columns;
                  const movable = !!onMoveItem;
                  const variant = it.variant ?? "event";
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => {
                        // When move drag is wired, pointer-up already handles
                        // selection (and is suppressed after a real drag). Keep
                        // the click handler for the read-only / non-movable case.
                        if (!movable) onSelectItem?.(it.id);
                      }}
                      onPointerDown={
                        movable ? (e) => beginDrag(e, it, "move") : undefined
                      }
                      title={`${it.startTime}–${it.endTime} ${it.title}`}
                      className={cn(
                        "absolute overflow-hidden rounded px-1 py-0.5 text-left text-[11px] leading-tight hover:z-10 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                        variantBlockClasses(variant),
                        variant === "routine" && "pl-1.5",
                        movable && "z-10 cursor-move",
                        selected && "z-10 ring-2 ring-lumen-accent",
                        it.completed && "line-through opacity-55",
                      )}
                      style={{
                        top: `${p.topPct}%`,
                        height: `${p.heightPct}%`,
                        left: `calc(${p.column * widthPct}% + 1px)`,
                        width: `calc(${widthPct}% - 2px)`,
                        touchAction: dragInteractive ? "none" : undefined,
                      }}
                    >
                      {/* Routine provenance: inner left band (藍) */}
                      {variant === "routine" && (
                        <span
                          aria-hidden
                          className="absolute inset-y-0 left-0 w-[3px] bg-lumen-chip-routine-dot"
                        />
                      )}
                      <span className="flex items-center gap-1 font-medium">
                        {variant === "routine" && (
                          <Repeat
                            aria-hidden
                            className="size-3 shrink-0"
                            strokeWidth={2.5}
                          />
                        )}
                        <span className="block truncate">
                          {it.title || " "}
                        </span>
                      </span>
                      <span className="block truncate text-[10px] opacity-80">
                        {it.startTime}
                      </span>
                      {/* Resize handle (bottom edge) — only when host opts in */}
                      {onResizeItem && (
                        <span
                          aria-hidden
                          onPointerDown={(e) => beginDrag(e, it, "resize")}
                          className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
                          style={{ touchAction: "none" }}
                        />
                      )}
                    </button>
                  );
                })}
                {/* Now-line: accent rule + left dot in the today column */}
                {isToday && nowVisible && (
                  <>
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 z-30 border-t-2 border-lumen-accent"
                      style={{ top: nowPx }}
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute z-30 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lumen-accent"
                      style={{ top: nowPx, left: 0 }}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
