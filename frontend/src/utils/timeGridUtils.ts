import { TIME_GRID } from "../constants/timeGrid";

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
