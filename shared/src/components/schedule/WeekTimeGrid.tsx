import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { CheckSquare, Repeat } from "lucide-react";
import { cn } from "../cn";
import {
  dayOfWeek,
  parseDateKey,
  layoutDayItems,
  weekDayKeys,
  pxToMinutes,
  minutesToPx,
  snapMinutes,
  DEFAULT_SNAP_MINUTES,
  type HourRange,
} from "../../utils/scheduleGridLayout";
import { useWeekTimeGridDrag } from "./useWeekTimeGridDrag";
import type { ScheduleItemVariant } from "./scheduleVariantVisuals";

/*
 * WeekTimeGrid (W8) — pure, presentational week/day time grid.
 *
 * Renders a left hour axis, a day-of-week header, an all-day lane, and a
 * scrollable time body where each schedule_item is absolutely positioned from
 * its `HH:MM` start/end (geometry comes from the pure `layoutDayItems` —
 * unit-tested separately). It is the 2-layer-model "complex screen" primitive:
 * the host renders it on WIDE and a plain agenda on NARROW.
 *
 * Layout invariant (#563): the three column bands — header, all-day lane, time
 * grid — live inside ONE scroll box and share ONE `gridTemplateColumns`, so the
 * vertical scrollbar subtracts its width from all of them at once and their
 * column rules line up. The header/lane band stays visible via `sticky top-0`.
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
 * surfaces and event blocks use opaque backgrounds (§5). `data.days = 1`
 * collapses it to a single-day column so the same primitive can back a day
 * view.
 *
 * Props are grouped rather than flat (#893): `data` (what to draw) / `labels`
 * (fixed copy) / `handlers` (the interaction surface) / `display` (geometry
 * knobs) / `format` (computed copy). The grouping also states the read-only
 * contract in one place — omit `handlers` entirely and no click catcher, drag
 * or resize handle is rendered at all.
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
   * Repeat glyph, "event" (default) = 紫 face + border, "task" = blue face +
   * CheckSquare glyph (scheduled TodoNode — the same mark the nav uses for
   * the Todos section, #593). Distinguishes provenance without relying on
   * color alone.
   */
  variant?: ScheduleItemVariant;
}

/**
 * What the grid draws. One bundle rather than six flat props (#893) — every
 * member is "the state of the view right now", and they change together when
 * the host navigates.
 */
export interface WeekTimeGridData {
  /** First (left-most) day column, YYYY-MM-DD. */
  weekStart: string;
  /** Number of day columns; 7 = week, 1 = single day. Default 7. */
  days?: number;
  items: WeekTimeGridItem[];
  selectedId?: string | null;
  /** Date key (YYYY-MM-DD) to highlight as "today", or null. */
  todayKey?: string | null;
  /**
   * Current time as minutes-from-midnight. When set and inside the visible
   * hourRange, a now-line (2px accent rule + left dot) is drawn in the
   * `todayKey` column, and the body auto-scrolls near it on mount. null /
   * out-of-range → no now-line. Also seeds the mount auto-scroll target
   * (falls back to 08:00 when null).
   *
   * No time caption rides the rule (#1362). It sat in the hour axis at the
   * same y as a tick, so the two overprinted each other and neither could be
   * read; the rule's own position against the axis already says what time it
   * is. It also drew on `nowVisible` alone while the rule draws on
   * `isToday && nowVisible`, so a grid with no today column used to show a
   * floating caption attached to no line at all.
   */
  nowMinutes?: number | null;
}

/**
 * The grid's interaction surface. Every member is optional and every one of
 * them is a capability switch, not just a notification: omitting `onCreateAt`
 * renders no click catcher, omitting `onMoveItem` makes blocks undraggable.
 * Omit the whole bundle for a read-only grid.
 */
export interface WeekTimeGridHandlers {
  onSelectItem?: (id: string) => void;
  /**
   * Single-click on an item block/chip → host opens a bubble popover anchored
   * at the click's viewport coords (#299). Preferred over `onSelectItem` when
   * both are supplied (the pointer-up "click" of a movable block also routes
   * here — it fires only when the pointer did NOT drag, §297 guard). Falls back
   * to `onSelectItem` when omitted.
   */
  onItemActivate?: (id: string, pos: { x: number; y: number }) => void;
  /** Double-click on an item block/chip → host opens the detail overlay (#299). */
  onItemDoubleClick?: (id: string) => void;
  /**
   * Right-click (contextmenu) on an item block → host opens a context menu at
   * the given viewport coordinates. When omitted, the browser's native menu is
   * left untouched. Desktop-only (#223).
   */
  onItemContextMenu?: (id: string, pos: { x: number; y: number }) => void;
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
  /**
   * A timed block dragged UP out of the time body and released over the
   * all-day lane / header turns back into an all-day item (#562 — the reverse
   * of "place"). The host writes isAllDay:true (dateISO may differ from the
   * original: a horizontal drag still remaps the day). When omitted, the drop
   * keeps the pre-#562 semantics: the time is clamped inside the visible
   * window instead of ever writing an inverted 00:00/00:00 span.
   */
  onDropAllDay?: (id: string, dateISO: string) => void;
}

/** Geometry and interaction knobs. Every member has a working default. */
export interface WeekTimeGridDisplay {
  /**
   * When true, `variant: "task"` blocks are draggable/resizable like events
   * (schedule redesign A-2 / #297 — drag-to-write `scheduledAt`). Default
   * false keeps the A-1 read-only semantics; the callbacks still decide
   * whether any block moves at all.
   */
  todoInteractive?: boolean;
  /** Snap granularity in minutes for create/move/resize. Default 30. */
  snapMinutesStep?: number;
  /** Default duration (minutes) of an event created via empty-slot click. Default 60. */
  defaultCreateDuration?: number;
  /** Visible [startHour, endHour] window, 0–24. Default [0, 24]. */
  hourRange?: HourRange;
  /** Pixel height of one hour row in the scrollable body. Default 48. */
  hourHeight?: number;
  /**
   * When true the scroll box follows the parent's height (`flex-1 min-h-0`)
   * instead of the default `max-h-[60vh]`, so the grid can fill a full-height
   * Calendar tab. Default false (legacy behavior). Note that since #563 the
   * header and all-day lane sit INSIDE that scroll box, so `max-h-[60vh]`
   * caps the grid as a whole (bands + time body) rather than the time body
   * alone — the default view is ~2 band-heights shorter than it used to be.
   */
  fillHeight?: boolean;
}

/**
 * Fixed copy, injected already translated (§6.4 — the grid never calls
 * useTranslation). The variable copy lives in `format` below.
 */
export interface WeekTimeGridLabels {
  /** Weekday labels indexed 0 (Sun) – 6 (Sat). */
  weekdays: string[];
  /** Label for the all-day lane. */
  allDay: string;
  /** Accessible label for an empty-slot create target. */
  createSlot?: string;
}

/**
 * Copy the host has to COMPUTE rather than hand over — locale-dependent
 * formatting of a value the grid owns. Each has a working default; a host that
 * cares about locale supplies its own.
 */
export interface WeekTimeGridFormat {
  /** Hour-axis formatter. Default zero-padded `HH:00`. */
  hour?: (hour: number) => string;
  /** Day-heading date formatter. Default `M/D`. */
  dayDate?: (dateKey: string) => string;
}

export interface WeekTimeGridProps {
  data: WeekTimeGridData;
  labels: WeekTimeGridLabels;
  handlers?: WeekTimeGridHandlers;
  display?: WeekTimeGridDisplay;
  format?: WeekTimeGridFormat;
  className?: string;
}

const GUTTER = "3.25rem"; // hour-axis column width

function defaultFormatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function defaultFormatDayDate(dateKey: string): string {
  const { m, d } = parseDateKey(dateKey);
  return `${m}/${d}`;
}

/**
 * Face classes for a timed block by provenance (W8). Routine = 藍 face (an
 * inner left band is rendered separately); event (default) = 紫 face + border;
 * todo = blue face (a CheckSquare glyph is rendered separately, #593). Every
 * variant carries a non-hue cue — band / border / glyph — so provenance never
 * relies on hue alone.
 */
function variantBlockClasses(variant: ScheduleItemVariant): string {
  switch (variant) {
    case "routine":
      return "bg-lumen-schedule-routine-bg text-lumen-chip-routine-fg";
    case "task":
      return "bg-lumen-schedule-task-bg text-lumen-chip-task-fg";
    default:
      return "border border-lumen-schedule-event-border bg-lumen-schedule-event-bg text-lumen-chip-event-fg";
  }
}

export function WeekTimeGrid({
  data,
  labels,
  handlers,
  display,
  format,
  className,
}: WeekTimeGridProps) {
  // Unpacked back into the flat names the body has always used, so the #893
  // bundles stay a wire-format change and nothing below has to know about
  // them. Defaults live here, exactly where they used to.
  const { weekStart, days = 7, items, selectedId, todayKey, nowMinutes } = data;
  const {
    onSelectItem,
    onItemActivate,
    onItemDoubleClick,
    onItemContextMenu,
    onCreateAt,
    onMoveItem,
    onResizeItem,
    onDropAllDay,
  } = handlers ?? {};
  const {
    todoInteractive = false,
    snapMinutesStep = DEFAULT_SNAP_MINUTES,
    defaultCreateDuration = 60,
    hourRange = [0, 24],
    hourHeight = 48,
    fillHeight = false,
  } = display ?? {};
  const {
    weekdays: weekdayLabels,
    allDay: allDayLabel,
    createSlot: createSlotLabel,
  } = labels;
  const {
    hour: formatHour = defaultFormatHour,
    dayDate: formatDayDate = defaultFormatDayDate,
  } = format ?? {};
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
    // The sticky header/all-day band sits at the top of the same scroll content
    // (#563), and its height cancels out here: the target lands exactly one
    // hour below the band, which is where it landed when the band was a sibling
    // outside the scroll box.
    el.scrollTop = Math.max(0, px - hourHeight);
    // Mount-only (initial focus); later nowMinutes ticks must not yank scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Drag-to-move / resize (native pointer events → useWeekTimeGridDrag) ───
  // The two refs come back out because they are DOM measurements the hook needs
  // and elements this component renders: the lane's bottom edge is the "dropped
  // on the lane" boundary (#563), and the time grid is the 00:00 origin for a
  // "place" drag's absolute pointer→minutes mapping.
  const {
    dragging,
    dragInteractive,
    effectiveItems,
    beginDrag,
    allDayLaneRef,
    timeGridRef,
  } = useWeekTimeGridDrag({
    items,
    dayKeys,
    hourHeight,
    hourRange,
    snapMinutesStep,
    defaultCreateDuration,
    onMoveItem,
    onResizeItem,
    onDropAllDay,
    onSelectItem,
    onItemActivate,
  });

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

  // 1-click activation (#299): prefer the coord-carrying onItemActivate so the
  // host can anchor a bubble popover at the cursor; fall back to onSelectItem.
  const activateItem = (id: string, clientX: number, clientY: number) => {
    if (onItemActivate) onItemActivate(id, { x: clientX, y: clientY });
    else onSelectItem?.(id);
  };

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
      {/*
       * One scroll box for all three bands (#563). The header, the all-day lane
       * and the time grid each apply the SAME `columnsTemplate` inside the SAME
       * scroll container, so `repeat(days, minmax(0,1fr))` divides one width:
       * when the vertical scrollbar takes its slice it narrows all three at
       * once and the column rules stay flush. While the bands lived outside the
       * scroll box only the time grid lost the scrollbar's width, and the 1fr
       * columns drifted a fraction of it further left on every column.
       * The header/all-day band keeps its old "always visible" behaviour via
       * `sticky top-0` (z above the blocks and the now-line, opaque face — §5).
       */}
      <div
        ref={scrollBodyRef}
        data-week-grid="scroll"
        className={cn(
          "overflow-y-auto",
          fillHeight ? "min-h-0 flex-1" : "max-h-[60vh]",
        )}
      >
        <div className="sticky top-0 z-40 bg-lumen-bg">
          {/* Day-of-week header */}
          <div
            data-week-grid="header"
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
                      "text-xs font-medium uppercase tracking-wide",
                      isToday
                        ? "text-lumen-accent"
                        : "text-lumen-text-secondary",
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
            ref={allDayLaneRef}
            data-week-grid="allday"
            className="grid border-b border-lumen-border bg-lumen-bg"
            style={columnsTemplate}
          >
            <div className="flex items-center justify-end border-r border-lumen-border px-1 py-1 text-xs text-lumen-text-secondary">
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
                    // A-3 (#298): an all-day todo chip can be dragged down into
                    // the time body to gain a start time (only todo chips, only
                    // when the host opts in via todoInteractive + onMoveItem).
                    // Events/routines in the lane have no drag at all.
                    const placeable =
                      it.variant === "task" && todoInteractive && !!onMoveItem;
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onPointerDown={
                          placeable
                            ? (e) => beginDrag(e, it, "place")
                            : undefined
                        }
                        // A placeable chip activates from the drag's pointer-up
                        // instead (the #297 no-movement guard), so wiring
                        // onClick here as well would fire twice.
                        onClick={
                          placeable
                            ? undefined
                            : (e) => activateItem(it.id, e.clientX, e.clientY)
                        }
                        // Double-click stays wired for EVERY chip (#564). It
                        // used to be dropped for placeable ones alongside
                        // onClick, but a drag never produces a dblclick, so all
                        // that suppressed was the keyboard-free route to the
                        // detail surface — the all-day todo chip's only one.
                        onDoubleClick={() => onItemDoubleClick?.(it.id)}
                        onContextMenu={
                          onItemContextMenu
                            ? (e) => {
                                e.preventDefault();
                                onItemContextMenu(it.id, {
                                  x: e.clientX,
                                  y: e.clientY,
                                });
                              }
                            : undefined
                        }
                        title={it.title}
                        className={cn(
                          "w-full rounded border-l-2 border-lumen-accent bg-lumen-bg-secondary px-1 py-0.5 text-left text-xs text-lumen-text hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                          // #593: the todo mark rides the lane chip too, so an
                          // all-day todo keeps its cue outside the time body.
                          it.variant === "task"
                            ? "flex items-center gap-1"
                            : "block truncate",
                          selected && "ring-2 ring-lumen-accent",
                          placeable && "cursor-grab",
                          it.variant === "task" &&
                            it.completed &&
                            "text-lumen-text-secondary line-through",
                        )}
                        style={placeable ? { touchAction: "none" } : undefined}
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
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Time body — same columnsTemplate, same scroll box (#563) */}
        <div
          ref={timeGridRef}
          data-week-grid="time"
          className="grid"
          style={columnsTemplate}
        >
          {/* Hour axis */}
          <div className="relative border-r border-lumen-border">
            {hours.map((h) => (
              <div key={h} style={{ height: hourHeight }} className="relative">
                <span className="absolute -top-1.5 right-1 text-xs tabular-nums text-lumen-text-secondary">
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
            const isToday = !!todayKey && key === todayKey;
            return (
              <div
                key={key}
                className={cn(
                  "relative border-r border-lumen-border last:border-r-0",
                  // Today tint only makes sense when there are sibling columns
                  // to contrast with; with days={1} it would wash the whole
                  // day view in accent-subtle (#281).
                  isToday && dayKeys.length > 1 && "bg-lumen-accent-subtle",
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
                    No hover paint: the catcher spans the whole day column, so
                    any hover background/border would tint the full column and
                    drown the hour gridlines (#281). */}
                {onCreateAt && (
                  <button
                    type="button"
                    aria-label={createSlotLabel ?? `Create on ${key}`}
                    onClick={(e) => handleSlotClick(e, key)}
                    className="absolute inset-0 z-0 cursor-pointer"
                  />
                )}
                {/* Timed events */}
                {dayItems.map((it) => {
                  const p = posById.get(it.id);
                  if (!p) return null; // all-day handled above
                  const selected = it.id === selectedId;
                  const widthPct = 100 / p.columns;
                  const variant = it.variant ?? "event";
                  // A-1 made todo chips read-only; A-2 (#297) opts them back in
                  // via `todoInteractive` so a drag writes scheduledAt. Events/
                  // routines are always movable when the callback is present.
                  const interactiveVariant =
                    variant !== "task" || todoInteractive;
                  const movable = !!onMoveItem && interactiveVariant;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={(e) => {
                        // When move drag is wired, pointer-up already handles
                        // activation (and is suppressed after a real drag). Keep
                        // the click handler for the read-only / non-movable case.
                        if (!movable) activateItem(it.id, e.clientX, e.clientY);
                      }}
                      onDoubleClick={() => onItemDoubleClick?.(it.id)}
                      onPointerDown={
                        movable ? (e) => beginDrag(e, it, "move") : undefined
                      }
                      onContextMenu={
                        onItemContextMenu
                          ? (e) => {
                              e.preventDefault();
                              onItemContextMenu(it.id, {
                                x: e.clientX,
                                y: e.clientY,
                              });
                            }
                          : undefined
                      }
                      title={`${it.startTime}–${it.endTime} ${it.title}`}
                      className={cn(
                        "absolute overflow-hidden rounded px-1 py-0.5 text-left text-xs leading-tight hover:z-10 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                        variantBlockClasses(variant),
                        variant === "routine" && "pl-1.5",
                        movable && "z-10 cursor-move",
                        selected && "z-10 ring-2 ring-lumen-accent",
                        // Gated on the variant (#1373): the MCP tool still
                        // writes `completed` for events, and an event struck
                        // through with no control to clear it would be worse
                        // than the toggle that went.
                        variant === "task" &&
                          it.completed &&
                          "line-through opacity-55",
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
                        {/* Todo provenance (#593): CheckSquare — the nav's
                            Todos mark — as the todo counterpart of the
                            routine's Repeat. Static (not a completion state:
                            done already reads via line-through). */}
                        {variant === "task" && (
                          <CheckSquare
                            aria-hidden
                            className="size-3 shrink-0"
                            strokeWidth={2.5}
                          />
                        )}
                        <span className="block truncate">
                          {it.title || " "}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 overflow-hidden">
                        <span className="truncate text-xs opacity-80">
                          {it.startTime}
                        </span>
                      </span>
                      {/* Resize handle (bottom edge) — only when host opts in.
                          Todo chips resize only when todoInteractive (A-2). */}
                      {onResizeItem && interactiveVariant && (
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
                {/* Now-line: accent rule + left dot in the today column. No
                    time caption rides it (#1362) — see the nowMinutes doc.
                    Both halves are aria-hidden and carry no text, so the
                    data-week-grid hooks are the only handle a test has. */}
                {isToday && nowVisible && (
                  <>
                    <div
                      aria-hidden
                      data-week-grid="now-line"
                      className="pointer-events-none absolute inset-x-0 z-30 border-t-2 border-lumen-accent"
                      style={{ top: nowPx }}
                    />
                    <div
                      aria-hidden
                      data-week-grid="now-dot"
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
