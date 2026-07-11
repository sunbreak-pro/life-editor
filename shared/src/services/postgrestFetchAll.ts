/*
 * Pagination / chunking helpers for PostgREST list reads (#172).
 *
 * PostgREST silently caps EVERY SELECT at the server's `max-rows`
 * (Supabase default: 1000). Rows past the cap are dropped with no error
 * — the same failure shape as known-issue 012 ("LIMIT + hasMore の半実装
 * は静かに壊れる"), re-embodied in the web stack's full-refetch pull
 * (SyncContext bumps syncVersion → every domain hook refetches its whole
 * collection). A >1000-row table would silently lose its tail on every
 * refetch, which the LWW write paths could then propagate as data loss.
 *
 * Two failure axes, two helpers:
 *
 *   - fetchAllPages: unbounded collection reads (`select … eq(user-scoped
 *     filters)`) pull `.range()` pages until a short page. The builder
 *     MUST apply a deterministic `.order()` ending in a unique column
 *     (usually `id`) — PostgREST row order is otherwise unspecified and
 *     pages could overlap or skip. A concurrent write can still shift
 *     offsets mid-pull; that transient skew is acceptable because the
 *     same write fires a Realtime event and SyncContext schedules another
 *     full refetch ~300 ms later (self-healing).
 *
 *   - fetchByIdChunks / forEachIdChunk: `.in(col, ids)` with an unbounded
 *     id list risks BOTH the max-rows cap on the result and URL-length
 *     limits (ids ride in the GET/PATCH/DELETE query string; ~25 chars
 *     per id × 1000 ids ≫ common 16 KB proxy caps). Chunking to
 *     POSTGREST_IN_CHUNK_SIZE keeps each request small; for the 1:1
 *     payload joins a chunk's result is ≤ the chunk size, so no nested
 *     pagination is needed.
 *
 * Reads that are structurally bounded by their input (single-item
 * lookups, one routine's group joins, an insert batch's dedup pre-check)
 * intentionally stay un-paginated.
 */

/**
 * Rows requested per page. MUST be ≤ the server's max-rows cap (Supabase
 * default 1000, this project uses the default): the "short page = last
 * page" stop condition assumes a full page is always returned when more
 * rows exist, which breaks if the server caps below the page size.
 */
export const POSTGREST_PAGE_SIZE = 1000;

/** Ids per `.in()` request — small enough for any URL-length limit. */
export const POSTGREST_IN_CHUNK_SIZE = 200;

/** Minimal result surface shared by PostgREST builder thenables. */
export interface PostgrestListResult {
  data: unknown;
  error: { message: string } | null;
}

/**
 * Pull every row of a filtered SELECT, one `.range(from, to)` page at a
 * time. `buildPage` must construct a FRESH query per call (PostgREST
 * builders are single-use) and apply a deterministic `.order()` (unique
 * tiebreaker) before `.range()`. Throws `<label>: <message>` on the
 * first page error, matching the existing call-site error format.
 */
export async function fetchAllPages<Row>(
  buildPage: (from: number, to: number) => PromiseLike<PostgrestListResult>,
  label: string,
): Promise<Row[]> {
  const out: Row[] = [];
  for (let offset = 0; ; offset += POSTGREST_PAGE_SIZE) {
    const { data, error } = await buildPage(
      offset,
      offset + POSTGREST_PAGE_SIZE - 1,
    );
    if (error) throw new Error(`${label}: ${error.message}`);
    const rows = (data as Row[] | null) ?? [];
    out.push(...rows);
    if (rows.length < POSTGREST_PAGE_SIZE) return out;
  }
}

/** Split an id list into POSTGREST_IN_CHUNK_SIZE-sized slices. */
export function chunkIds(ids: readonly string[]): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += POSTGREST_IN_CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + POSTGREST_IN_CHUNK_SIZE));
  }
  return chunks;
}

/**
 * Chunked `.in()` READ: run `fetchChunk` per id slice and concatenate.
 * `fetchChunk` owns error handling (call sites keep their existing
 * per-query error wrapping). Result order follows chunk order — callers
 * that need a specific order already sort or Map-join afterwards.
 */
export async function fetchByIdChunks<Row>(
  ids: readonly string[],
  fetchChunk: (chunk: string[]) => Promise<Row[]>,
): Promise<Row[]> {
  const out: Row[] = [];
  for (const chunk of chunkIds(ids)) {
    out.push(...(await fetchChunk(chunk)));
  }
  return out;
}

/**
 * Chunked `.in()` WRITE (UPDATE / DELETE): run the mutation per id slice.
 * Sequential on purpose — a mid-way failure leaves earlier chunks
 * applied, which is safe for the idempotent soft-delete / bump patches
 * these call sites issue (a retry re-applies the same patch). NOTE: the
 * Realtime self-heal described in the header covers READ offset skew
 * only — a partially-applied WRITE is not auto-retried; recovery relies
 * on the caller (or the user) re-issuing the operation. Throws
 * `<label>: <message>` on the first failing chunk.
 */
export async function forEachIdChunk(
  ids: readonly string[],
  runChunk: (chunk: string[]) => PromiseLike<{
    error: { message: string } | null;
  }>,
  label: string,
): Promise<void> {
  for (const chunk of chunkIds(ids)) {
    const { error } = await runChunk(chunk);
    if (error) throw new Error(`${label}: ${error.message}`);
  }
}
