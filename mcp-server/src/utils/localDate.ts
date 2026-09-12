/*
 * Local-date helpers. `toISOString().slice(0, 10)` is a UTC date — before
 * 09:00 JST it yields YESTERDAY, which is fatal for a morning briefing
 * (headless-claude prototype QA finding #5). Everything here works in the
 * process's local timezone.
 *
 * WHICH LOCAL TIMEZONE (Remote MCP work — plan:
 * .claude/docs/vision/plans/2026-09-09-remote-mcp-mobile.md). "The process's
 * local timezone" is the right answer for the stdio server: it runs on the
 * owner's own machine, which is set to the zone the owner lives in. It is the
 * WRONG answer on Cloudflare Workers, whose isolates are always UTC and cannot
 * be moved — the exact 09:00 bug above, permanently, for every request the
 * phone makes before 09:00 JST.
 *
 * So the zone became configurable: `configureTimeZone("Asia/Tokyo")` makes
 * every helper below work in that IANA zone regardless of where the code runs,
 * and the Worker calls it from a committed `vars` entry (mcp-server/
 * wrangler.jsonc) so it can never be forgotten. Left unconfigured — the stdio
 * default — the behaviour is byte-for-byte what it always was.
 */

/**
 * The zone every helper here works in, or null for "whatever the process is
 * set to" (the stdio default — see the note at the top of the file).
 */
let timeZone: string | null = null;

/** Intl formatters are expensive to build and are reused per zone. */
const partsFormatters = new Map<string, Intl.DateTimeFormat>();
const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Pin the zone (an IANA name like "Asia/Tokyo"), or pass null to go back to
 * the process's own. Throws on a name Intl does not know, because the
 * alternative is answering every date question off by hours without saying so.
 */
export function configureTimeZone(zone: string | null): void {
  if (zone === null) {
    timeZone = null;
    return;
  }

  const trimmed = zone.trim();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed });
  } catch {
    throw new Error(
      `Unknown time zone "${zone}" — expected an IANA name such as Asia/Tokyo.`,
    );
  }
  timeZone = trimmed;
}

/** The pinned zone, or null when dates follow the process. */
export function currentTimeZone(): string | null {
  return timeZone;
}

function dayFormatter(zone: string): Intl.DateTimeFormat {
  let fmt = dayFormatters.get(zone);
  if (!fmt) {
    // sv-SE formats as YYYY-MM-DD, the same trick the unpinned path uses.
    fmt = new Intl.DateTimeFormat("sv-SE", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormatters.set(zone, fmt);
  }
  return fmt;
}

function partsFormatter(zone: string): Intl.DateTimeFormat {
  let fmt = partsFormatters.get(zone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(zone, fmt);
  }
  return fmt;
}

/** `zone`'s offset from UTC, in ms, at a given instant (DST included). */
function zoneOffsetMs(zone: string, instant: Date): number {
  const parts = partsFormatter(zone).formatToParts(instant);
  const at = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  const wallClockAsUtc = Date.UTC(
    at("year"),
    at("month") - 1,
    at("day"),
    at("hour"),
    at("minute"),
    at("second"),
  );
  // Milliseconds are not in the parts list and both sides are whole seconds
  // apart, so rounding the instant to its second keeps the difference exact.
  return wallClockAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Midnight starting `date` in `zone`, as a UTC instant.
 *
 * Two passes: the first uses the offset in force at the naive instant, the
 * second re-reads it at the answer, so a day that begins on the far side of a
 * DST change lands on the real local midnight rather than an hour off. Japan
 * has no DST, but a friend's build in a zone that does would otherwise carry a
 * silent one-hour error into every day range.
 */
function zonedMidnightUtc(date: string, zone: string): Date {
  const naive = Date.parse(`${date}T00:00:00Z`);
  const first = zoneOffsetMs(zone, new Date(naive));
  const candidate = naive - first;
  const second = zoneOffsetMs(zone, new Date(candidate));
  return new Date(second === first ? candidate : naive - second);
}

/** Today's local date as "YYYY-MM-DD" (sv-SE locale formats exactly so). */
export function localToday(): string {
  const now = new Date();
  return timeZone
    ? dayFormatter(timeZone).format(now)
    : now.toLocaleDateString("sv-SE");
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

/** date ± n days on the calendar ("YYYY-MM-DD" in, "YYYY-MM-DD" out). */
export function addDays(date: string, n: number): string {
  // Calendar arithmetic, done in UTC so it means the same thing in every zone.
  // (It always did in JST; a zone whose DST change falls AT midnight would
  // have made local midnight ambiguous or non-existent.)
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The Sunday of the local week containing `date` (#782 ③ / #1138).
 *
 * A week runs Sun→Sat, matching the app: `WEEK_STARTS_ON` in
 * shared/src/utils/scheduleGridLayout.ts is 0 and nothing switches it (#1102).
 * This used to start on Monday, which put the MCP window one day off the app's
 * — and the week-goal period key IS the week's start date (#872 / #957), so
 * the briefing Claude writes and the week the app shows were pointing at
 * different weeks (D-20260824-shared-fix-1 = A).
 *
 * `getDay()` already counts from Sunday, so the index IS the offset and no
 * shift is needed. Equivalent to shared's `startOfWeekKey(key, 0)`, whose
 * `(dow - 0 + 7) % 7` collapses to `dow`.
 */
export function localWeekStart(date: string): string {
  // Which weekday a calendar date falls on is the same everywhere, so this
  // reads it in UTC — same reason as addDays.
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -weekday);
}

/**
 * A timestamptz instant → the local calendar day it falls on. The inverse of
 * `localDayUtcRange`: rows fetched by that range are bucketed back onto a
 * "YYYY-MM-DD" with this.
 */
export function localDateKey(instant: string): string {
  const at = new Date(instant);
  return timeZone
    ? dayFormatter(timeZone).format(at)
    : at.toLocaleDateString("sv-SE");
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
  if (timeZone) {
    const start = zonedMidnightUtc(date, timeZone);
    const end = zonedMidnightUtc(addDays(date, 1), timeZone);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }

  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}
