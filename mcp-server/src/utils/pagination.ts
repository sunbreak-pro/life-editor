/*
 * PostgREST pagination helpers for the MCP server (#360) — the Node-side
 * twin of shared/src/services/postgrestFetchAll.ts.
 *
 * PostgREST silently caps EVERY SELECT at the server's `max-rows`
 * (Supabase default: 1000) and drops the tail with no error. A collection
 * read that grows past the cap would quietly return partial data, so
 * unbounded list reads page through with `.range()` until a short page.
 *
 * `.in(col, ids)` has a second limit: the ids ride in the query string, so
 * a long list can blow past proxy URL caps. Those reads chunk instead.
 */

/**
 * Rows per page. MUST be ≤ the server's max-rows cap: the "short page =
 * last page" stop condition assumes a full page whenever more rows exist.
 */
export const PAGE_SIZE = 1000;

/** Ids per `.in()` request — small enough for any URL-length limit. */
export const IN_CHUNK_SIZE = 200;

/** Minimal result surface shared by PostgREST builder thenables. */
export interface PostgrestListResult {
  data: unknown;
  error: { message: string } | null;
}

/**
 * Pull every row of a filtered SELECT one page at a time. `buildPage` must
 * construct a FRESH query per call (PostgREST builders are single-use) and
 * apply a deterministic `.order()` ending in a unique column — page
 * boundaries are otherwise unspecified and rows could repeat or vanish.
 */
export async function fetchAllPages<Row>(
  buildPage: (from: number, to: number) => PromiseLike<PostgrestListResult>,
  label: string,
): Promise<Row[]> {
  const out: Row[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await buildPage(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    const rows = (data as Row[] | null) ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) return out;
  }
}

/** Split an id list into IN_CHUNK_SIZE-sized slices. */
export function chunkIds(ids: readonly string[]): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + IN_CHUNK_SIZE));
  }
  return chunks;
}

/**
 * Chunked `.in()` read: run `fetchChunk` per id slice and concatenate.
 * `fetchChunk` owns its own error wrapping. Result order follows chunk
 * order — callers that need a specific order sort or Map-join afterwards.
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
