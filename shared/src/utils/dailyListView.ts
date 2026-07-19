/**
 * Sort direction for a date-keyed list: "asc" = oldest first (date ascending),
 * "desc" = newest first. Kept UI-framework-free so the Daily view (and any
 * other date-keyed sidebar list) can reuse it.
 */
export type DailyListDirection = "asc" | "desc";

/**
 * Minimal shape the helper needs: a sortable `date` key ("YYYY-MM-DD", which
 * sorts correctly as a string) and a `searchText` blob the caller builds
 * (e.g. dayLabel + excerpt concatenated) for substring filtering.
 */
export interface DailyListEntry {
  date: string;
  searchText: string;
}

export interface DailyListViewOptions {
  direction: DailyListDirection;
  /** Case-insensitive substring query; blank/whitespace-only returns all. */
  query: string;
}

/**
 * Filter by a case-insensitive substring of `searchText`, then sort by `date`.
 * Generic over the entry type so callers get their own richer objects back
 * (the constraint only requires `date` + `searchText`). Non-mutating.
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
  return [...filtered].sort((a, b) => a.date.localeCompare(b.date) * dir);
}
