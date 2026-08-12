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

/** Guard a tool-supplied date before it reaches Date()/toISOString(). */
export function assertDateKey(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date "${date}" (expected YYYY-MM-DD)`);
  }
  return date;
}

/**
 * Guard a tool-supplied clock time (HH:MM) before it reaches the DB (#702 ②).
 *
 * `events_payload.start_time` / `end_time` are `time` columns, so an
 * ill-formed value came back as a raw Postgres parse error naming a type the
 * caller never saw. The schema says HH:MM; this is the schema enforced.
 */
export function assertTimeOfDay(value: string, field: string): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error(
      `Invalid ${field} "${value}" (expected HH:MM, 00:00-23:59)`,
    );
  }
  return value;
}

/** date ± n days, in local time ("YYYY-MM-DD" in, "YYYY-MM-DD" out). */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("sv-SE");
}

/**
 * The Monday of the local week containing `date` (#782 ③). A week runs
 * Mon→Sun here, but `getDay()` counts from Sunday (0), so the index is
 * shifted before it is subtracted.
 */
export function localWeekStart(date: string): string {
  const weekday = new Date(`${date}T00:00:00`).getDay();
  return addDays(date, -((weekday + 6) % 7));
}

/**
 * A timestamptz instant → the local calendar day it falls on. The inverse of
 * `localDayUtcRange`: rows fetched by that range are bucketed back onto a
 * "YYYY-MM-DD" with this.
 */
export function localDateKey(instant: string): string {
  return new Date(instant).toLocaleDateString("sv-SE");
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
