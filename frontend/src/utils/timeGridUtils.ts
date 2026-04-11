import { TIME_GRID } from "../constants/timeGrid";

/** Format hour and minute into "HH:MM" string. */
export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function minutesToTimeString(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes);
  const clamped = Math.max(0, Math.min(rounded, 24 * 60));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function topToMinutes(top: number): number {
  return (top / TIME_GRID.SLOT_HEIGHT) * 60 + TIME_GRID.START_HOUR * 60;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** When startTime changes, adjust endTime to maintain the same duration. */
export function adjustEndTimeForStartChange(
  oldStart: string,
  newStart: string,
  currentEnd: string,
): string {
  const oldStartMin = timeToMinutes(oldStart);
  const newStartMin = timeToMinutes(newStart);
  const currentEndMin = timeToMinutes(currentEnd);
  const duration = Math.max(currentEndMin - oldStartMin, 15);
  const newEndMin = Math.min(newStartMin + duration, 23 * 60 + 59);
  return minutesToTimeString(newEndMin);
}

/** Clamp endTime so it is always after startTime by at least minDuration. */
export function clampEndTimeAfterStart(
  start: string,
  end: string,
  minDuration = 15,
): string {
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  if (endMin <= startMin) {
    return minutesToTimeString(Math.min(startMin + minDuration, 23 * 60 + 59));
  }
  return end;
}

/** Format hour number into 12-hour display string (e.g. "9 AM", "12 PM"). */
export function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

/**
 * Convert a Y pixel position on a time grid to snapped hour/minute.
 * @param y - Pixel offset from the top of the grid
 * @param slotHeight - Height of one hour slot
 * @param startHour - The hour at which the grid begins
 * @param snapMinutes - Snap resolution in minutes (default 15)
 */
export function snapTimeFromPosition(
  y: number,
  slotHeight: number,
  startHour: number,
  snapMinutes = 15,
): { hour: number; minute: number } {
  const rawHour = y / slotHeight + startHour;
  const baseHour = Math.floor(rawHour);
  const snappedMinute =
    Math.round(((rawHour % 1) * 60) / snapMinutes) * snapMinutes;
  const minute = snappedMinute >= 60 ? 0 : snappedMinute;
  const hour = Math.min(snappedMinute >= 60 ? baseHour + 1 : baseHour, 23);
  return { hour, minute };
}

/** Default end time = start + 1 hour. */
export function defaultEndTimeForStart(start: string): string {
  const startMin = timeToMinutes(start);
  return minutesToTimeString(Math.min(startMin + 60, 23 * 60 + 59));
}
