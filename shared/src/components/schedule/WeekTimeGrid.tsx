import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { CheckSquare, Repeat } from "lucide-react";
import { cn } from "../cn";
import {
  blockTitleFit,
  DEFAULT_BLOCK_TITLE_METRICS,
  dayOfWeek,
  minutesFromMidnight,
  parseDateKey,
  revealScrollTop,
  layoutDayItems,
  weekDayKeys,
  pxToMinutes,
  minutesToPx,
  minutesToTime,
  snapMinutes,
  DEFAULT_SNAP_MINUTES,
  type BlockTitleMetrics,
  type HourRange,
} from "../../utils/scheduleGridLayout";
import { useWeekTimeGridDrag } from "./useWeekTimeGridDrag";
import { MonthMorePanel } from "./MonthMorePanel";
import {
  SCHEDULE_SELECTED_RING,
  chipFace,
  holidayFace,
  scheduleLine,
} from "./MonthGridParts";
import {
  hasTodoDragData,
  readTodoDragData,
  type TodoCalendarDrop,
} from "./todoCalendarDrag";
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
  /**
   * The colour of the tag that speaks for this item (#1580), drawn as the
   * left line since #2623, or undefined to draw that line in the kind's
   * colour (a holiday: the Settings colour, #1626). A hex, because it is the
   * user's own value off `wiki_tags.color` — the host resolves WHICH tag
   * (buildItemTagColors) and this is only the answer.
   */
  tagColor?: string | null;
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
  /**
   * The block a link is pointing at (#2393): an accent frame and a ring that
   * spreads three times (`.le-focus-mark`), and the grid scrolls it into view.
   * The host decides how long it stays. Apart from the selection on purpose: a
   * todo chip can be marked, and selecting one would open its surfaces.
   */
  markedId?: string | null;
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
  /**
   * A todo dragged in from OUTSIDE the grid (the Schedule sidebar's "その他"
   * list — #1627, todoCalendarDrag.ts) was dropped. A day column hands over
   * its day plus a snapped start and `defaultCreateDuration` of length; the
   * all-day lane hands over the day with both times null. When omitted the
   * grid takes no drops at all.
   */
  onDropTodo?: (drop: TodoCalendarDrop) => void;
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
  /**
   * #2563: bump to scroll the now-line back to its opening position — the
   * host's「今日」button. The opening scroll runs once, at mount; without this
   * a press that lands on the week already mounted moves nothing. Any change
   * of value re-runs it, so a counter is enough.
   */
  scrollToNowSignal?: number;
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
  /** Accessible name of the close button on the folded all-day list. */
  close?: string;
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
  /**
   * The all-day lane's fold line for `count` hidden items (#2221) — the month
   * grid's "他 N 件". A capability switch like the handlers: without it the
   * lane never folds and lists every item, as it did before #2221, because the
   * grid has no words of its own to put on the line (§6.4).
   */
  allDayMore?: (count: number) => string;
  /** Heading of the list the fold line opens, naming the day. Default the key. */
  allDayMoreTitle?: (dateKey: string) => string;
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

/**
 * The all-day lane folds a day at this many items (#2221). Three still fit as
 * three rows; from four on, the lane keeps {@link ALL_DAY_FOLDED_SHOWN} and
 * spends the third row on "他 N 件", so a busy day never pushes the time body
 * further down than three rows do.
 */
export const ALL_DAY_FOLD_AT = 4;
export const ALL_DAY_FOLDED_SHOWN = 2;

function defaultFormatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * The opening scroll leaves this much above the now-line (#2563, the
 * prototype's 1.5 hours; it was one hour).
 */
export const NOW_SCROLL_LEAD_HOURS = 1.5;

function defaultFormatDayDate(dateKey: string): string {
  const { m, d } = parseDateKey(dateKey);
  return `${m}/${d}`;
}

/**
 * Light face and ink for a timed block by provenance (W8): routine = 藍,
 * event (default) = 紫, todo = blue. Since #2623 every block wears it, tagged
 * or not, and the left line (`scheduleLine`) carries the tag colour. The
 * glyphs (Repeat, CheckSquare #593) stay the non-hue cue, so provenance never
 * relies on hue alone.
 */
function variantBlockClasses(variant: ScheduleItemVariant): string {
  switch (variant) {
    case "routine":
      return "bg-lumen-schedule-routine-bg text-lumen-chip-routine-fg";
    case "task":
      return "bg-lumen-schedule-task-bg text-lumen-chip-task-fg";
    default:
      return "bg-lumen-schedule-event-bg text-lumen-chip-event-fg";
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
  const {
    weekStart,
    days = 7,
    items,
    selectedId,
    markedId,
    todayKey,
    nowMinutes,
  } = data;
  const {
    onSelectItem,
    onItemActivate,
    onItemDoubleClick,
    onItemContextMenu,
    onCreateAt,
    onMoveItem,
    onResizeItem,
    onDropAllDay,
    onDropTodo,
  } = handlers ?? {};
  const {
    todoInteractive = false,
    snapMinutesStep = DEFAULT_SNAP_MINUTES,
    defaultCreateDuration = 60,
    hourRange = [0, 24],
    hourHeight = 48,
    fillHeight = false,
    scrollToNowSignal = 0,
  } = display ?? {};
  const {
    weekdays: weekdayLabels,
    allDay: allDayLabel,
    createSlot: createSlotLabel,
    close: closeLabel = "Close",
  } = labels;
  const {
    hour: formatHour = defaultFormatHour,
    dayDate: formatDayDate = defaultFormatDayDate,
    allDayMore: formatAllDayMore,
    allDayMoreTitle: formatAllDayMoreTitle = (dateKey: string) => dateKey,
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

  // Opening auto-scroll: bring the now-line (or 08:00 when absent) into view.
  // scrollIntoView would also nudge horizontal scroll, so we set scrollTop
  // directly on the body ref.
  //
  // It runs at mount and again on every `scrollToNowSignal` (#2563,「今日」),
  // reading the clock of the render that changed the signal. Later
  // `nowMinutes` ticks must not re-run it: they would yank the scroll from
  // wherever the user has since taken it.
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
    // Pull the target down the box by NOW_SCROLL_LEAD_HOURS so the context
    // above it stays visible. The sticky header/all-day band sits at the top
    // of the same scroll content (#563), and its height cancels out here: the
    // target lands exactly that far below the band, which is where it landed
    // when the band was a sibling outside the scroll box.
    el.scrollTop = Math.max(0, px - hourHeight * NOW_SCROLL_LEAD_HOURS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToNowSignal]);

  /*
   * #1830 — a block that BECOMES the selection is brought into view.
   *
   * The repeat panel's "show the next one" moves the week and selects the
   * occurrence; before this, that was all it did, so a morning occurrence
   * stayed above a body scrolled to the afternoon and the button looked
   * inert. Putting the scroll here rather than in the host is what keeps it
   * true for every route that selects a row from off-screen — the palette,
   * the briefing's jump — instead of only the one that filed the bug.
   *
   * `revealScrollTop` is the decision and it returns null for a block that is
   * already visible, so clicking a block you can see never moves the grid.
   * All-day rows are skipped: their lane is pinned above the body and has no
   * scroll position of its own.
   *
   * Keyed on the SELECTION alone. A re-render that keeps the same selection
   * must not pull the scroll back from wherever the user has since taken it.
   */
  const revealStart = (startTime: string) => {
    const el = scrollBodyRef.current;
    if (!el) return;
    const minutes = Math.min(
      Math.max(minutesFromMidnight(startTime), startHour * 60),
      endHour * 60,
    );
    const next = revealScrollTop({
      targetPx: minutesToPx(minutes, hourHeight, hourRange),
      scrollTop: el.scrollTop,
      viewportPx: el.clientHeight,
      hourHeight,
    });
    if (next != null) el.scrollTop = next;
  };
  useEffect(() => {
    if (!selectedId) return;
    const target = items.find((i) => i.id === selectedId);
    if (!target || target.isAllDay) return;
    revealStart(target.startTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  /*
   * #2393 — the same reveal for the mark. Keyed on the marked block's start as
   * well as its id, because a block can turn up a render after the mark was set
   * (the week view mounts, the rows land), and it still has to come into view.
   */
  const markedStart =
    items.find((i) => i.id === markedId && !i.isAllDay)?.startTime ?? null;
  useEffect(() => {
    if (markedStart != null) revealStart(markedStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markedId, markedStart]);

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

  /*
   * #2478: the px width of one day column, which decides (with the block's
   * height) how many lines a block title may use. A narrow column would
   * otherwise wrap a tall block's title a character per line. The columns are
   * equal `1fr` shares of the time grid, so watching the grid is enough; null
   * until measured (and in jsdom), which keeps the height-only rule (#1835).
   *
   * The width is judged against the real type: one title character measured
   * from a hidden probe in the title's own classes, and the root font size
   * the rem paddings follow. Both move with the Settings font-size step, and
   * the probe is observed too, so a step change re-measures without a resize.
   * A probe that reads 0 (jsdom) keeps the default metrics.
   */
  const [colWidthPx, setColWidthPx] = useState<number | null>(null);
  const [titleMetrics, setTitleMetrics] = useState<BlockTitleMetrics>(
    DEFAULT_BLOCK_TITLE_METRICS,
  );
  const charProbeRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const grid = timeGridRef.current;
    if (!grid || typeof ResizeObserver === "undefined") return;
    const measure = (): void => {
      const col = grid.querySelector<HTMLElement>("[data-week-grid-day]");
      const w = col ? col.getBoundingClientRect().width : 0;
      setColWidthPx(w > 0 ? w : null);
      const charPx = charProbeRef.current?.getBoundingClientRect().width ?? 0;
      const remPx = parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      const next: BlockTitleMetrics =
        charPx > 0
          ? {
              charPx,
              remPx:
                Number.isFinite(remPx) && remPx > 0
                  ? remPx
                  : DEFAULT_BLOCK_TITLE_METRICS.remPx,
            }
          : DEFAULT_BLOCK_TITLE_METRICS;
      setTitleMetrics((prev) =>
        prev.charPx === next.charPx && prev.remPx === next.remPx ? prev : next,
      );
    };
    const ro = new ResizeObserver(measure);
    ro.observe(grid);
    if (charProbeRef.current) ro.observe(charProbeRef.current);
    measure();
    return () => ro.disconnect();
  }, [timeGridRef, days]);

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

  /*
   * #2221: the day whose folded all-day items are listed, and the "他 N 件"
   * button that opened the list (the panel places itself from that button's
   * cell). The items are read from `byDay` on every render rather than copied
   * here, so a chip that moves away while the list is open leaves it.
   */
  const [more, setMore] = useState<{
    dateKey: string;
    anchor: HTMLElement;
  } | null>(null);
  // A marked chip goes first (#2393): behind "他 N 件" nobody would see the mark.
  const allDayOf = (dateKey: string): WeekTimeGridItem[] => {
    const allDay = (byDay.get(dateKey) ?? []).filter((i) => i.isAllDay);
    return allDay.some((i) => i.id === markedId)
      ? [
          ...allDay.filter((i) => i.id === markedId),
          ...allDay.filter((i) => i.id !== markedId),
        ]
      : allDay;
  };
  const moreAllDay = more ? allDayOf(more.dateKey) : [];
  const foldsAllDay = (count: number): boolean =>
    !!formatAllDayMore && count >= ALL_DAY_FOLD_AT;
  const moreItems = foldsAllDay(moreAllDay.length)
    ? moreAllDay.slice(ALL_DAY_FOLDED_SHOWN)
    : [];
  // Stable, because the panel's document listeners re-bind on a new onClose.
  const closeMore = useCallback(() => setMore(null), []);

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

  /*
   * #1627: drops from outside the grid. Which cell the pointer is over comes
   * from the element the drop lands on (each cell owns its day), never from a
   * coordinate lookup; the one coordinate read is the same one an empty-slot
   * click reads — the height inside a day column — to pick the start time.
   *
   * `dropKey` tints the cell under a live drag ("allday:<day>" / "time:<day>").
   */
  const [dropKey, setDropKey] = useState<string | null>(null);
  const dropTargetProps = (key: string, dateKey: string, timed: boolean) =>
    onDropTodo
      ? {
          onDragOver: (e: React.DragEvent<HTMLDivElement>) => {
            if (!hasTodoDragData(e.dataTransfer)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (dropKey !== key) setDropKey(key);
          },
          onDragLeave: (e: React.DragEvent<HTMLDivElement>) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null))
              setDropKey((k) => (k === key ? null : k));
          },
          onDrop: (e: React.DragEvent<HTMLDivElement>) => {
            const todoId = readTodoDragData(e.dataTransfer);
            setDropKey(null);
            if (!todoId) return;
            e.preventDefault();
            if (!timed) {
              onDropTodo({
                todoId,
                dateISO: dateKey,
                startTime: null,
                endTime: null,
              });
              return;
            }
            const rect = e.currentTarget.getBoundingClientRect();
            const snapped = snapMinutes(
              pxToMinutes(e.clientY - rect.top, hourHeight, hourRange),
              snapMinutesStep,
            );
            // Same in-window clamp as handleSlotClick, so the block never
            // runs past the bottom of the visible hours.
            const maxStart = endHour * 60 - defaultCreateDuration;
            const start = Math.min(snapped, Math.max(startHour * 60, maxStart));
            onDropTodo({
              todoId,
              dateISO: dateKey,
              startTime: minutesToTime(start),
              endTime: minutesToTime(start + defaultCreateDuration),
            });
          },
        }
      : {};

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
            {dayKeys.map((key, column) => {
              const allDay = allDayOf(key);
              const folded = foldsAllDay(allDay.length);
              const shown = folded
                ? allDay.slice(0, ALL_DAY_FOLDED_SHOWN)
                : allDay;
              const moreOpen = more?.dateKey === key;
              return (
                <div
                  key={key}
                  data-week-grid-allday={key}
                  // Read by MonthMorePanel to place itself beside this cell.
                  data-more-cell={key}
                  data-more-column={column}
                  {...dropTargetProps(`allday:${key}`, key, false)}
                  className={cn(
                    "min-h-[1.75rem] space-y-1 border-r border-lumen-border p-1 last:border-r-0",
                    dropKey === `allday:${key}` && "bg-lumen-hover",
                  )}
                >
                  {shown.map((it) => {
                    const selected = it.id === selectedId;
                    /*
                     * #1626: a holiday is drawn, not operated. It has no row
                     * behind it — its name and its date come from the law
                     * (japaneseHolidays) — so there is nothing for a click,
                     * a double-click or a long press to open. A control that
                     * answers no gesture reads as broken, so it is a span,
                     * wearing the one colour Settings chose for all of them.
                     */
                    if (it.variant === "holiday") {
                      // #2623: the Settings colour as a light face and a
                      // line, the same form as the month's holiday chip.
                      const face = holidayFace(it.tagColor);
                      return (
                        <span
                          key={it.id}
                          title={it.title}
                          data-holiday-chip={it.date}
                          style={face.style}
                          className={cn(
                            "block h-5 w-full truncate rounded px-1 py-0.5 text-left text-xs font-medium",
                            face.className,
                          )}
                        >
                          {it.title}
                        </span>
                      );
                    }
                    // A-3 (#298): an all-day todo chip can be dragged down into
                    // the time body to gain a start time (only todo chips, only
                    // when the host opts in via todoInteractive + onMoveItem).
                    // Events/routines in the lane have no drag at all.
                    const placeable =
                      it.variant === "task" && todoInteractive && !!onMoveItem;
                    // #2563: the month chip's colouring (#2623) — the kind's
                    // light face and ink, the 3px left line in the tag's
                    // colour when one speaks for the item.
                    const face = chipFace(it.variant ?? "event", it.tagColor);
                    return (
                      <button
                        key={it.id}
                        type="button"
                        data-focus-mark={it.id === markedId || undefined}
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
                          // h-5 = the month chip's 1.25rem (#2563).
                          "flex h-5 w-full items-center gap-1 rounded px-1 text-left text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                          face.className,
                          selected && SCHEDULE_SELECTED_RING,
                          it.id === markedId && "le-focus-mark",
                          placeable && "cursor-grab",
                          // Gated on the variant (#1373), and the month
                          // chip's form of it.
                          it.variant === "task" &&
                            it.completed &&
                            "line-through opacity-55",
                        )}
                        style={
                          placeable
                            ? { ...face.style, touchAction: "none" }
                            : face.style
                        }
                      >
                        {/* #593: the todo mark rides the lane chip too, so an
                            all-day todo keeps its cue outside the time body.
                            The other kinds stay title-only, as the
                            prototype's lane draws them (#2563). */}
                        {it.variant === "task" && (
                          <CheckSquare
                            aria-hidden
                            className="size-3 shrink-0"
                            strokeWidth={2.5}
                          />
                        )}
                        <span className="truncate">{it.title || " "}</span>
                      </button>
                    );
                  })}
                  {folded && formatAllDayMore && (
                    <button
                      type="button"
                      data-week-grid-allday-more={key}
                      aria-haspopup="dialog"
                      aria-expanded={moreOpen}
                      onClick={(e) => {
                        const anchor = e.currentTarget;
                        // Same button again = close. A button from another
                        // week is a different element, so it opens afresh.
                        setMore((m) =>
                          m?.anchor === anchor
                            ? null
                            : { dateKey: key, anchor },
                        );
                      }}
                      className={cn(
                        "block w-full truncate rounded px-1 py-0.5 text-left text-xs font-medium text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                        moreOpen && "bg-lumen-hover text-lumen-text",
                      )}
                    >
                      {formatAllDayMore(allDay.length - shown.length)}
                    </button>
                  )}
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
            {/* #2478: one title character in the block title's own type,
                measured to judge whether a title can wrap. Never seen. */}
            <span
              ref={charProbeRef}
              aria-hidden
              data-week-grid-char-probe
              className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap text-xs font-medium"
            >
              あ
            </span>
            {hours.map((h) => (
              <div key={h} style={{ height: hourHeight }} className="relative">
                <span className="absolute -top-1.5 right-1 text-xs tabular-nums text-lumen-text-secondary">
                  {/* #2563: no label at 0 時 — it sits on the grid's top edge,
                      where the prototype leaves the axis blank. */}
                  {h === 0 ? null : formatHour(h)}
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
                data-week-grid-day={key}
                {...dropTargetProps(`time:${key}`, key, true)}
                className={cn(
                  "relative border-r border-lumen-border last:border-r-0",
                  // Today tint only makes sense when there are sibling columns
                  // to contrast with; with days={1} it would wash the whole
                  // day view in accent-subtle (#281).
                  isToday && dayKeys.length > 1 && "bg-lumen-accent-subtle",
                  dropKey === `time:${key}` && "bg-lumen-hover",
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
                  const variant = it.variant ?? "event";
                  // #2221: a later block is painted over the one it overlaps.
                  // Capped below the now-line (z-30) and the focus lift (z-20).
                  // #2393: a marked block goes on top of its stack, at that cap:
                  // a mark under another block would point at nothing.
                  const marked = it.id === markedId;
                  const blockZ = marked ? 19 : 1 + Math.min(p.stackOrder, 18);
                  // #2623: every block draws the 3px left line, in the tag's
                  // colour or else the kind's.
                  const line = scheduleLine(variant, it.tagColor);
                  // #1835: the block's height in px, which is what decides how
                  // many lines its title may use. `heightPct` is a share of
                  // the day body, and the body's px height is known here.
                  // #2478: and its width, so a narrow column truncates one
                  // line (dropping the glyph first) instead of wrapping a
                  // character per line.
                  const { lines: titleLines, showGlyph } = blockTitleFit(
                    (p.heightPct / 100) * bodyHeight,
                    colWidthPx == null
                      ? null
                      : (colWidthPx * p.widthPct) / 100 - 2,
                    {
                      glyph: variant === "routine" || variant === "task",
                      // #2623: the 3px left line on every block. band (2px)
                      // plus border (2px) over-counts it by a pixel, which
                      // keeps the fit on the safe side of a wrap. A single
                      // 3px option in blockTitleFit would say it exactly.
                      band: true,
                      border: true,
                    },
                    titleMetrics,
                  );
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
                        // #2221: no hover lift. Blocks overlap now, and
                        // raising the one under the pointer would cover the
                        // block above it until the pointer left the stack.
                        "absolute z-(--block-z) overflow-hidden rounded px-1 py-0.5 text-left text-xs leading-tight focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                        // #2623: the kind's light face always, and the tag's
                        // colour (#1580) only on the left line — a filled tag
                        // face turned a busy week into one saturated block.
                        variantBlockClasses(variant),
                        line.className,
                        // #2221: a block laid over another gets an edge in the
                        // grid's own colour and a light shadow, so the line
                        // between the two reads even when they share a tag.
                        p.depth > 0 &&
                          "shadow-lumen-sm outline outline-1 outline-lumen-bg",
                        movable && "cursor-move",
                        // The selection keeps its place in the stack: lifting
                        // it would bury a shorter block that starts inside it.
                        selected && SCHEDULE_SELECTED_RING,
                        marked && "le-focus-mark",
                        // Gated on the variant (#1373): the MCP tool still
                        // writes `completed` for events, and an event struck
                        // through with no control to clear it would be worse
                        // than the toggle that went.
                        variant === "task" &&
                          it.completed &&
                          "line-through opacity-55",
                      )}
                      style={
                        {
                          ...line.style,
                          top: `${p.topPct}%`,
                          height: `${p.heightPct}%`,
                          left: `calc(${p.offsetPct}% + 1px)`,
                          width: `calc(${p.widthPct}% - 2px)`,
                          touchAction: dragInteractive ? "none" : undefined,
                          "--block-z": blockZ,
                        } as CSSProperties
                      }
                      data-week-grid-depth={p.depth}
                      data-focus-mark={marked || undefined}
                    >
                      <span
                        className={cn(
                          "flex gap-1 font-medium",
                          // The glyph sits on the first line once the title
                          // can take more than one.
                          titleLines === 1 ? "items-center" : "items-start",
                        )}
                      >
                        {showGlyph && variant === "routine" && (
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
                        {showGlyph && variant === "task" && (
                          <CheckSquare
                            aria-hidden
                            className="size-3 shrink-0"
                            strokeWidth={2.5}
                          />
                        )}
                        {/* #1835: one line truncates as it always did; a
                            block with room wraps instead of spending its
                            height on empty fill. `-webkit-box` is how a
                            multi-line clamp is spelled — every target is a
                            WebKit or Blink engine (macOS / iOS / the Electron
                            shell). */}
                        <span
                          className={cn(
                            "block min-w-0",
                            titleLines === 1 ? "truncate" : "break-words",
                          )}
                          style={
                            titleLines === 1
                              ? undefined
                              : {
                                  display: "-webkit-box",
                                  WebkitBoxOrient: "vertical",
                                  WebkitLineClamp: titleLines,
                                  overflow: "hidden",
                                }
                          }
                        >
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
      {more && moreItems.length > 0 && more.anchor.isConnected && (
        <MonthMorePanel
          anchor={more.anchor}
          items={moreItems}
          title={formatAllDayMoreTitle(more.dateKey)}
          closeLabel={closeLabel}
          onItemActivate={(id, pos) => activateItem(id, pos.x, pos.y)}
          onClose={closeMore}
        />
      )}
    </div>
  );
}
