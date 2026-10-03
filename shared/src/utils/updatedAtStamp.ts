/*
 * updatedAtStamp — compare two `items_meta.updated_at` values as instants.
 *
 * Since #2057 the column is also the VERSION a note body is saved against:
 * a save names the stamp it read, and the server refuses it when the row has
 * moved on. The client therefore has to answer "is this the same version I
 * already have" for stamps that reach it by different routes, and the routes
 * do not agree on the spelling:
 *
 *   - a value this client wrote:      2026-10-01T09:12:00.123Z
 *   - the same value read back:       2026-10-01T09:12:00.123+00:00
 *   - a server-side `now()` stamp:    2026-10-01T09:12:00.123456+00:00
 *
 * String equality calls the first two different, and `Date.parse` calls two
 * server stamps a few microseconds apart the same (it keeps milliseconds).
 * Either mistake is a wrong answer about whose write this was, so the
 * comparison keeps all six fractional digits.
 */

const FRACTION = /\.(\d+)/;

/** Microseconds since the epoch, or null for a string that is not a date. */
export function stampMicros(stamp: string): number | null {
  const match = FRACTION.exec(stamp);
  const digits = (match?.[1] ?? "").padEnd(6, "0").slice(0, 6);
  // Date.parse is only trusted with the millisecond part; the rest is added
  // back by hand below.
  const millisOnly = match
    ? stamp.replace(FRACTION, `.${digits.slice(0, 3)}`)
    : stamp;
  const millis = Date.parse(millisOnly);
  if (Number.isNaN(millis)) return null;
  return millis * 1000 + Number(digits.slice(3));
}

/**
 * Do two stamps name the same instant? Null on either side is "unknown",
 * which never equals anything — a caller holding no version has not read one.
 */
export function stampsEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (a == null || b == null) return false;
  if (a === b) return true;
  const ma = stampMicros(a);
  const mb = stampMicros(b);
  return ma !== null && ma === mb;
}
