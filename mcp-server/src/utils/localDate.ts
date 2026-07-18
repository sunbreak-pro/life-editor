/*
 * Local-date helpers. `toISOString().slice(0, 10)` is a UTC date — before
 * 09:00 JST it yields YESTERDAY, which is fatal for a morning briefing
 * (headless-claude prototype QA finding #5). Everything here works in the
 * process's local timezone.
 */

/** Today's local date as "YYYY-MM-DD" (sv-SE locale formats exactly so). */
export function localToday(): string {
  return new Date().toLocaleDateString("sv-SE");
}

/** date ± n days, in local time ("YYYY-MM-DD" in, "YYYY-MM-DD" out). */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("sv-SE");
}

/**
 * UTC instant range [start, end) covering one local calendar day — for
 * filtering timestamptz columns (e.g. tasks_payload.scheduled_at) by a
 * local "YYYY-MM-DD" day.
 */
export function localDayUtcRange(date: string): {
  startIso: string;
  endIso: string;
} {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}
