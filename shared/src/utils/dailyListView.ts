/**
 * Sort direction for a date-keyed list: "asc" = oldest first, "desc" = newest
 * first. Kept UI-framework-free so the Daily view (and any other date-keyed
 * sidebar list) can reuse it.
 */
export type DailyListDirection = "asc" | "desc";

/**
 * Which key the list sorts on (#369). "date" is the entry's own calendar day
 * (the original and default behaviour); the other two are the edit timestamps,
 * matching the Notes sidebar's mode set minus "title" (a daily has no title).
 */
export type DailyListSortMode = "date" | "updatedAt" | "createdAt";

/**
 * Minimal shape the helper needs: a sortable `date` key ("YYYY-MM-DD", which
 * sorts correctly as a string), the two ISO edit timestamps, and a `searchText`
 * blob the caller builds (e.g. dayLabel + excerpt concatenated) for substring
 * filtering.
 *
 * The timestamps are REQUIRED even though only two of the three modes read
 * them: making them optional would let a caller pass entries that silently
 * degrade to date order under a timestamp mode. Same reasoning as #428's
 * required `liveTasks`.
 */
export interface DailyListEntry {
  date: string;
  searchText: string;
  /** ISO datetime — sort key for mode "createdAt". */
  createdAt: string;
  /** ISO datetime — sort key for mode "updatedAt". */
  updatedAt: string;
}

export interface DailyListViewOptions {
  mode: DailyListSortMode;
  direction: DailyListDirection;
  /** Case-insensitive substring query; blank/whitespace-only returns all. */
  query: string;
}

/**
 * The sortable string for one entry under `mode`. All three keys are
 * lexicographically ordered (a "YYYY-MM-DD" day and a `toISOString()` datetime
 * both sort as plain strings), so one comparator covers every mode.
 */
function sortKeyOf(entry: DailyListEntry, mode: DailyListSortMode): string {
  switch (mode) {
    case "updatedAt":
      return entry.updatedAt;
    case "createdAt":
      return entry.createdAt;
    default:
      return entry.date;
  }
}

/**
 * Filter by a case-insensitive substring of `searchText`, then sort by the key
 * `options.mode` selects. Generic over the entry type so callers get their own
 * richer objects back (the constraint only requires the four fields above).
 * Non-mutating.
 *
 * Ties fall back to `date` so the order stays deterministic when two entries
 * share a timestamp (e.g. a bulk import writing the same `createdAt`).
 */
export function filterAndSortDailyEntries<T extends DailyListEntry>(
  entries: T[],
  options: DailyListViewOptions,
): T[] {
  const q = options.query.trim().toLowerCase();
  const filtered = q
    ? entries.filter((e) => e.searchText.toLowerCase().includes(q))
    : entries;
  const dir = options.direction === "desc" ? -1 : 1;
  return [...filtered].sort((a, b) => {
    const byKey = sortKeyOf(a, options.mode).localeCompare(
      sortKeyOf(b, options.mode),
    );
    return (byKey !== 0 ? byKey : a.date.localeCompare(b.date)) * dir;
  });
}
