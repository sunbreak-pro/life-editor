import type { ScheduleItem } from "../types/schedule";

/*
 * W8 week-view time-grid layout — pure geometry helpers.
 *
 * Keeps all time→pixel math and overlap-column assignment out of the React
 * layer so it can be unit-tested without a DOM (the web `WeekGrid` consumes
 * these; a future Mobile day-view can reuse them too). No timezone math: dates
 * are local "YYYY-MM-DD" and times are "HH:MM", matching the ScheduleItem
 * storage convention (shared/types/schedule.ts).
 */

export interface WeekGridLayoutOptions {
  /** Pixels per hour. */
  slotHeight?: number;
  /** Hour the grid starts at (rows above are clipped). */
  startHour?: number;
  /** Minimum rendered height so very short events stay clickable. */
  minHeight?: number;
}

export interface PositionedEvent {
  item: ScheduleItem;
  /** px from the top of the grid (relative to startHour). */
  top: number;
  /** px height of the block. */
  height: number;
  /** 0-based column within its overlap cluster. */
  column: number;
  /** number of columns the cluster was split into (block width = 1/columnCount). */
  columnCount: number;
}

const DEFAULTS: Required<WeekGridLayoutOptions> = {
  slotHeight: 48,
  startHour: 0,
  minHeight: 22,
};

/** "HH:MM" → minutes since midnight. Tolerant of malformed input (→ 0). */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":");
  const hours = Number(h);
  const mins = Number(m);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(mins) ? mins : 0);
}

/** Minutes since midnight → "HH:MM" (clamped to 00:00–23:59). */
export function minutesToTime(min: number): string {
  const clamped = Math.max(0, Math.min(Math.round(min), 23 * 60 + 59));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Round minutes to the nearest `step` (default 30), clamped to the last
 * step-aligned slot of the day so the result always lands on the grid.
 */
export function snapMinutes(min: number, step = 30): number {
  const lastSlot = Math.floor((23 * 60 + 59) / step) * step;
  const snapped = Math.round(min / step) * step;
  return Math.max(0, Math.min(snapped, lastSlot));
}

interface Timed {
  item: ScheduleItem;
  start: number;
  end: number;
}

/**
 * Lay out the timed (non all-day) events of a SINGLE day into non-overlapping
 * columns. Uses interval-partitioning: events are grouped into clusters of
 * chained overlaps, and every event in a cluster shares the cluster's column
 * count so block widths line up. Returns one PositionedEvent per timed item.
 */
export function layoutDayEvents(
  items: ScheduleItem[],
  options: WeekGridLayoutOptions = {},
): PositionedEvent[] {
  const { slotHeight, startHour, minHeight } = { ...DEFAULTS, ...options };

  const timed: Timed[] = items
    .filter((i) => !i.isAllDay)
    .map((i) => {
      const start = timeToMinutes(i.startTime);
      let end = timeToMinutes(i.endTime);
      // Zero/negative-length events get a default 30-minute block so they are
      // visible and clickable instead of collapsing to a hairline.
      if (!(end > start)) end = start + 30;
      return { item: i, start, end };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const out: PositionedEvent[] = [];
  let cluster: { t: Timed; column: number }[] = [];
  let columnEnds: number[] = []; // running end-minute per column in the cluster
  let clusterEnd = -1;

  const flush = () => {
    const columnCount = columnEnds.length || 1;
    for (const { t, column } of cluster) {
      const top = (t.start / 60 - startHour) * slotHeight;
      const height = Math.max(((t.end - t.start) / 60) * slotHeight, minHeight);
      out.push({ item: t.item, top, height, column, columnCount });
    }
    cluster = [];
    columnEnds = [];
    clusterEnd = -1;
  };

  for (const t of timed) {
    // A gap with no active overlap closes the current cluster.
    if (cluster.length > 0 && t.start >= clusterEnd) flush();

    // Reuse the first column whose previous event has already ended.
    let column = columnEnds.findIndex((end) => end <= t.start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(t.end);
    } else {
      columnEnds[column] = t.end;
    }
    cluster.push({ t, column });
    clusterEnd = Math.max(clusterEnd, t.end);
  }
  if (cluster.length > 0) flush();

  return out;
}

// ---------------------------------------------------------------------------
// Week date helpers. All operate on local "YYYY-MM-DD" strings and never touch
// UTC (constructing Date with y, m-1, d keeps it in the local calendar day).
// ---------------------------------------------------------------------------

function parse(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function format(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Add (or subtract) whole days to a "YYYY-MM-DD" string. */
export function addDays(dateStr: string, days: number): string {
  const date = parse(dateStr);
  date.setDate(date.getDate() + days);
  return format(date);
}

/**
 * First day of the week containing `dateStr`. `weekStartsOn` 1 = Monday
 * (default), 0 = Sunday.
 */
export function startOfWeek(dateStr: string, weekStartsOn: 0 | 1 = 1): string {
  const date = parse(dateStr);
  const day = date.getDay(); // 0=Sun..6=Sat
  const diff = (day - weekStartsOn + 7) % 7;
  date.setDate(date.getDate() - diff);
  return format(date);
}

/** The 7 "YYYY-MM-DD" dates of the week containing `dateStr`. */
export function weekDates(dateStr: string, weekStartsOn: 0 | 1 = 1): string[] {
  const start = startOfWeek(dateStr, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Today's local date as "YYYY-MM-DD". */
export function todayLocal(): string {
  return format(new Date());
}
