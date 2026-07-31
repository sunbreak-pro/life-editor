/*
 * Cross-item title search for the command palette (#503).
 *
 * The header field has promised "検索・コマンド実行" since #306 while the palette
 * only ever offered navigation commands — typing a note's title returned "no
 * results" with the note sitting right there. This is the matching half: a pure
 * function over an already-fetched pool, so it can be pinned by tests and the
 * host keeps the fetching (and the DataService boundary) to itself.
 */

/** The roles the palette can both find AND open. */
export type SearchableItemRole = "note" | "daily" | "task" | "event";

export interface SearchableItem {
  /** `items_meta.id` — what the item-nav routing opens. */
  id: string;
  role: SearchableItemRole;
  title: string;
  /** Secondary line (a date, typically). Matched as well as displayed. */
  detail?: string;
}

export interface ItemSearchOptions {
  /**
   * Cap per role, so one crowded surface cannot push the others off the list.
   * Per role rather than overall: 200 notes would otherwise bury the one task
   * the query also matched, and the user has no way to ask for the rest.
   */
  perRoleLimit?: number;
}

const DEFAULT_PER_ROLE_LIMIT = 5;

/** Role order in the results — the order the sections read in the nav. */
const ROLE_ORDER: readonly SearchableItemRole[] = [
  "note",
  "task",
  "event",
  "daily",
];

/**
 * Case-insensitive substring match over title + detail.
 *
 * Ranking is prefix-before-substring and nothing more. Fuzzy/subsequence
 * matching is deliberately out: with a 5-row cap per role, a scorer that lets
 * "tes" reach "The Sunday Estimate" spends those rows on matches the user
 * cannot see the logic of, and the miss is invisible — the row that SHOULD be
 * there simply is not.
 *
 * An empty (or whitespace-only) query returns nothing rather than everything:
 * the palette opens on an empty field, and dumping the whole pool underneath
 * the navigation commands would bury them at the moment they are most used.
 */
export function searchItemPool(
  pool: readonly SearchableItem[],
  query: string,
  options: ItemSearchOptions = {},
): SearchableItem[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];
  const limit = options.perRoleLimit ?? DEFAULT_PER_ROLE_LIMIT;
  if (limit <= 0) return [];

  // rank 0 = the query starts the title, 1 = anywhere in title, 2 = detail only.
  const ranked: { item: SearchableItem; rank: number; order: number }[] = [];
  pool.forEach((item, order) => {
    const title = item.title.toLowerCase();
    if (title.startsWith(q)) ranked.push({ item, rank: 0, order });
    else if (title.includes(q)) ranked.push({ item, rank: 1, order });
    else if (item.detail?.toLowerCase().includes(q))
      ranked.push({ item, rank: 2, order });
  });

  const out: SearchableItem[] = [];
  for (const role of ROLE_ORDER) {
    const forRole = ranked
      .filter((r) => r.item.role === role)
      // Ties keep pool order, so a stable pool gives a stable list — the row
      // under the cursor does not move between two identical queries.
      .sort((a, b) => a.rank - b.rank || a.order - b.order)
      .slice(0, limit);
    for (const r of forRole) out.push(r.item);
  }
  return out;
}
