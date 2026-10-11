import { formatDateKey } from "@life-editor/shared";

/*
 * The window the Analytics host reads `app_records` for (#2164).
 *
 * `listAppRecords` takes ISO instants, `from` inclusive and `to` exclusive. The
 * selected date range is a pair of LOCAL day keys, so both ends are local
 * midnights turned into instants — a record at 01:00 JST then belongs to its
 * own day, as it does in every other Analytics chart.
 *
 * The window is at least the last seven days whatever the preset is: the
 * narrow records block reads "last 7 days" out of this same read, and the
 * "this month" preset on the 3rd covers only three of them.
 */

/** Days the narrow block looks back, today included. */
export const RECORDS_BLOCK_DAYS = 7;

function localMidnight(key: string, addDays = 0): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d + addDays);
}

export interface RecordsWindow {
  from: string;
  to: string;
}

/** `rangeFrom` / `rangeTo`: local `YYYY-MM-DD` keys, `rangeTo` inclusive. */
export function recordsWindow(
  rangeFrom: string,
  rangeTo: string,
  today: Date = new Date(),
): RecordsWindow {
  const blockFrom = formatDateKey(
    localMidnight(formatDateKey(today), -(RECORDS_BLOCK_DAYS - 1)),
  );
  const fromKey = rangeFrom < blockFrom ? rangeFrom : blockFrom;
  const toKey = rangeTo > formatDateKey(today) ? rangeTo : formatDateKey(today);
  return {
    from: localMidnight(fromKey).toISOString(),
    // Exclusive: the midnight after the last day.
    to: localMidnight(toKey, 1).toISOString(),
  };
}
