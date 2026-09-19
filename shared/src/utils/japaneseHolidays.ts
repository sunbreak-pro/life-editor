/*
 * Japanese public holidays (#1626), COMPUTED rather than fetched or stored.
 *
 * The calendar draws them as items, so the list has to exist the moment a range
 * is drawn. Three cheaper-looking options were rejected for reasons that are
 * not about taste:
 *
 *   - a network call: the rules are fixed by law, so a request buys no accuracy
 *     — only a cost (the $0 constraint), a permission, and an offline calendar
 *     that silently loses its holidays.
 *   - rows in the database: a holiday is not the user's data. Writing one would
 *     put it through Sync, Trash, the MCP tools and the undo stack, each of
 *     which would then have to special-case a row nobody may edit.
 *   - a static table: it would need extending by hand every year, and the year
 *     it is forgotten the calendar states a wrong fact rather than none.
 *
 * What the law gives, and this implements:
 *   - fixed dates (元日, 建国記念の日, …)
 *   - Happy-Monday days (成人の日 = 2nd Monday of January, and three more)
 *   - the two equinoxes, which are ASTRONOMICAL. The date is announced each
 *     February for the following year, so every implementation is an
 *     approximation; the usual polynomial (good for 1980–2099) is used, and
 *     `holidaysInRange` refuses years outside that span.
 *   - 振替休日: a holiday on a Sunday moves to the next day that is not itself
 *     a holiday
 *   - 国民の休日: a plain day caught between two holidays becomes one
 *
 * Dates are LOCAL keys (YYYY-MM-DD) throughout — the same "no UTC" rule the
 * rest of the schedule follows (scheduleGridLayout). Names stay Japanese
 * because they are proper nouns: the Settings card's copy is translated, the
 * holiday's own name is not.
 *
 * Out of scope on purpose: years before 1949 (the law's shape differs), the
 * one-off holidays of an imperial succession, and any country but Japan.
 */

export interface Holiday {
  /** YYYY-MM-DD (local). */
  date: string;
  /** The holiday's own name, e.g. "敬老の日". */
  name: string;
}

const SUBSTITUTE = "振替休日";
const CITIZENS = "国民の休日";

function key(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Day of week for a local date key, 0 = Sunday. */
function weekday(y: number, m: number, d: number): number {
  return new Date(y, m - 1, d).getDay();
}

/** The `nth` `wanted` weekday of a month (1-based nth, 0 = Sunday). */
function nthWeekday(y: number, m: number, wanted: number, nth: number): number {
  const first = weekday(y, m, 1);
  return 1 + ((wanted - first + 7) % 7) + (nth - 1) * 7;
}

/**
 * 春分の日 / 秋分の日, by the polynomial the Japanese almanac community uses
 * for 1980–2099. Accurate to the day across that span; outside it the result
 * is not trustworthy, which is why `holidaysInRange` drops those years.
 */
function equinoxDay(y: number, spring: boolean): number {
  const base = spring ? 20.8431 : 23.2488;
  return Math.floor(base + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
}

/** Every holiday in one calendar year, BEFORE the two follow-on rules. */
function baseHolidays(y: number): Holiday[] {
  return [
    { date: key(y, 1, 1), name: "元日" },
    { date: key(y, 1, nthWeekday(y, 1, 1, 2)), name: "成人の日" },
    { date: key(y, 2, 11), name: "建国記念の日" },
    { date: key(y, 2, 23), name: "天皇誕生日" },
    { date: key(y, 3, equinoxDay(y, true)), name: "春分の日" },
    { date: key(y, 4, 29), name: "昭和の日" },
    { date: key(y, 5, 3), name: "憲法記念日" },
    { date: key(y, 5, 4), name: "みどりの日" },
    { date: key(y, 5, 5), name: "こどもの日" },
    { date: key(y, 7, nthWeekday(y, 7, 1, 3)), name: "海の日" },
    { date: key(y, 8, 11), name: "山の日" },
    { date: key(y, 9, nthWeekday(y, 9, 1, 3)), name: "敬老の日" },
    { date: key(y, 9, equinoxDay(y, false)), name: "秋分の日" },
    { date: key(y, 10, nthWeekday(y, 10, 1, 2)), name: "スポーツの日" },
    { date: key(y, 11, 3), name: "文化の日" },
    { date: key(y, 11, 23), name: "勤労感謝の日" },
  ].sort((a, b) => a.date.localeCompare(b.date));
}

function addDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const next = new Date(y, m - 1, d + delta);
  return key(next.getFullYear(), next.getMonth() + 1, next.getDate());
}

/**
 * One year's holidays with both follow-on rules applied.
 *
 * 振替休日 first, and it LOOPS rather than adding a single day: 5/3 falling on
 * a Sunday has to walk past 5/4 and 5/5 to land on 5/6, which is exactly what
 * happens in 2026.
 *
 * 国民の休日 second, over the result — a day is only "caught between" once the
 * substitutes are in place. It fires on a plain day with a holiday on either
 * side, which is the 9/21–9/23 shape this Issue names.
 */
export function holidaysInYear(y: number): Holiday[] {
  const base = baseHolidays(y);
  const byDate = new Map(base.map((h) => [h.date, h]));

  for (const h of base) {
    const [hy, hm, hd] = h.date.split("-").map(Number);
    if (weekday(hy, hm, hd) !== 0) continue;
    let moved = addDays(h.date, 1);
    while (byDate.has(moved)) moved = addDays(moved, 1);
    byDate.set(moved, { date: moved, name: SUBSTITUTE });
  }

  for (const h of [...byDate.values()]) {
    const gap = addDays(h.date, 1);
    if (byDate.has(gap)) continue;
    if (!byDate.has(addDays(gap, 1))) continue;
    const [gy, gm, gd] = gap.split("-").map(Number);
    // A Sunday is already a day off, and the holiday beside it would take the
    // substitute instead — naming it here would count the same day twice.
    if (weekday(gy, gm, gd) === 0) continue;
    byDate.set(gap, { date: gap, name: CITIZENS });
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/*
 * Synthetic grid ids, the same device the todo chips use (todoCalendarChips).
 *
 * A holiday is merged into grids whose other ids are ScheduleItem ids, and it
 * has no row of its own to be addressed by. The prefix both rules out a
 * collision and gives the surfaces a cheap "this one is not editable" test —
 * a holiday's title and date are the law's, not the user's.
 */
export const HOLIDAY_ITEM_PREFIX = "holiday-";

/** Synthetic grid id for the holiday on `dateKey`. */
export function holidayItemId(dateKey: string): string {
  return HOLIDAY_ITEM_PREFIX + dateKey;
}

/** True when a grid/agenda id denotes a holiday. */
export function isHolidayItem(id: string): boolean {
  return id.startsWith(HOLIDAY_ITEM_PREFIX);
}

/** Lowest / highest year the equinox polynomial is trusted for. */
export const HOLIDAY_MIN_YEAR = 1980;
export const HOLIDAY_MAX_YEAR = 2099;

/**
 * Holidays between two local date keys, inclusive.
 *
 * Years outside the trusted span contribute NOTHING rather than a wrong date: a
 * calendar with no holiday on it reads as "not covered here", while one with
 * the wrong day on it reads as a fact.
 */
export function holidaysInRange(startKey: string, endKey: string): Holiday[] {
  if (endKey < startKey) return [];
  const from = Number(startKey.slice(0, 4));
  const to = Number(endKey.slice(0, 4));
  if (!Number.isFinite(from) || !Number.isFinite(to)) return [];
  const out: Holiday[] = [];
  for (let y = from; y <= to; y += 1) {
    if (y < HOLIDAY_MIN_YEAR || y > HOLIDAY_MAX_YEAR) continue;
    for (const h of holidaysInYear(y)) {
      if (h.date >= startKey && h.date <= endKey) out.push(h);
    }
  }
  return out;
}
