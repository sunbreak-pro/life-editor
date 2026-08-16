import { getSupabase } from "../supabase.js";
import {
  contentPlainText,
  contentPreview,
  PREVIEW_LENGTH,
} from "../utils/content.js";
import { META_COLUMNS, type ItemsMetaRow } from "../utils/items.js";
import {
  fetchAllPages,
  fetchByIdChunks,
  resolveListLimit,
  resolveListOffset,
} from "../utils/pagination.js";
import { fetchLiveNotes } from "./noteHandlers.js";
import { fetchLiveDailies } from "./dailyHandlers.js";
import { isLegacyFolder } from "./todoHandlers.js";
import { escapeLikePattern } from "../utils/like.js";

/*
 * search_all — Supabase edition (#360).
 *
 * Two matching strategies, picked per domain by what the column type
 * allows:
 *   - todos: `items_meta.title` and `tasks_payload.content` are TEXT, so
 *     both sides filter server-side with `ilike` and the union is merged
 *     in-app (PostgREST cannot OR across two tables in one request).
 *   - notes / dailies: bodies live in `content_json` (jsonb), which has no
 *     `ilike`. Those domains pull the live collection and match the
 *     extracted plain text — more accurate than the legacy LIKE over raw
 *     TipTap JSON, which also matched node names like "paragraph".
 *
 * Every domain answers with the same `{ results, total, hasMore }` page
 * (#782 ②). A bare array told the caller nothing about what it did not get:
 * `limit` hits looked identical whether they were all the matches or the
 * first of hundreds, so the only way to find out was to raise `limit` and
 * search again.
 */

const VALID_DOMAINS = ["todos", "dailies", "notes"] as const;
type Domain = (typeof VALID_DOMAINS)[number];

/** Items a domain returns when the caller does not say. */
const DEFAULT_SEARCH_LIMIT = 10;

/** One domain's answer: the caller's slice, plus what it does not hold. */
interface DomainPage<Result> {
  results: Result[];
  total: number;
  hasMore: boolean;
}

/** Cut a domain's full match list down to the caller's page. */
function toPage<Result>(
  matches: Result[],
  offset: number,
  limit: number,
): DomainPage<Result> {
  return {
    results: matches.slice(offset, offset + limit),
    total: matches.length,
    hasMore: offset + limit < matches.length,
  };
}

interface TasksPayloadRow {
  item_id: string;
  task_type: "folder" | "task" | null;
  status: string | null;
  scheduled_at: string | null;
  content: string | null;
}

const TODO_PAYLOAD_COLUMNS =
  "item_id, task_type, status, scheduled_at, content";

/** Todos whose title OR content matches, newest first, as one page. */
async function searchTodos(pattern: string, offset: number, limit: number) {
  const { client } = await getSupabase();

  /*
   * Both halves are read in full rather than capped server-side. A
   * `.limit(limit)` on each query cuts rows before the union is merged, so
   * the merged `total` could only ever be a lower bound and `hasMore` a
   * guess — and a page past the first would be cut from the wrong set. The
   * whole-collection read matches what notes / dailies already do, and this
   * is a single-user database (CLAUDE.md §1).
   */
  const [titleRows, contentRows] = await Promise.all([
    fetchAllPages<ItemsMetaRow>(
      (from, to) =>
        client
          .from("items_meta")
          .select(META_COLUMNS)
          .eq("role", "task")
          .eq("is_deleted", false)
          .ilike("title", pattern)
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to),
      "search todo items_meta",
    ),
    /*
     * No query-side `task_type` filter. `.eq('task_type','task')` also drops
     * NULL rows, and a NULL task_type IS a plain todo (pre-#225 rows) — the
     * same hole #702 ② closed in `list_todos`, left open here. The retired
     * folder type is excluded in-app below instead, by the one predicate both
     * halves of this merge now share.
     */
    fetchAllPages<TasksPayloadRow>(
      (from, to) =>
        client
          .from("tasks_payload")
          .select(TODO_PAYLOAD_COLUMNS)
          .ilike("content", pattern)
          .order("item_id", { ascending: true })
          .range(from, to),
      "search tasks_payload",
    ),
  ]);

  const metaById = new Map<string, ItemsMetaRow>();
  for (const m of titleRows) metaById.set(m.id, m);

  const payloadById = new Map<string, TasksPayloadRow>();
  for (const p of contentRows) payloadById.set(p.item_id, p);

  // Fill in each half's missing side: payloads for title-only hits, live
  // metas for content-only hits (a content hit on a trashed todo drops out).
  const missingPayloadIds = [...metaById.keys()].filter(
    (id) => !payloadById.has(id),
  );
  const missingMetaIds = [...payloadById.keys()].filter(
    (id) => !metaById.has(id),
  );

  const [extraPayloads, extraMetas] = await Promise.all([
    fetchByIdChunks<TasksPayloadRow>(missingPayloadIds, async (chunk) => {
      const { data, error } = await client
        .from("tasks_payload")
        .select(TODO_PAYLOAD_COLUMNS)
        .in("item_id", chunk);
      if (error) throw new Error(`search tasks_payload: ${error.message}`);
      return (data ?? []) as unknown as TasksPayloadRow[];
    }),
    fetchByIdChunks<ItemsMetaRow>(missingMetaIds, async (chunk) => {
      const { data, error } = await client
        .from("items_meta")
        .select(META_COLUMNS)
        .eq("role", "task")
        .eq("is_deleted", false)
        .in("id", chunk);
      if (error) throw new Error(`search todo items_meta: ${error.message}`);
      return (data ?? []) as unknown as ItemsMetaRow[];
    }),
  ]);
  for (const p of extraPayloads) payloadById.set(p.item_id, p);
  for (const m of extraMetas) metaById.set(m.id, m);

  const merged = [];
  for (const [id, meta] of metaById) {
    const payload = payloadById.get(id);
    if (!payload) continue;
    // A title hit can land on a retired folder row (task_type lives on the
    // payload, so the items_meta query cannot exclude it) — S3 #225. Content
    // hits reach here unfiltered too now, so this is the only folder guard.
    if (isLegacyFolder(payload)) continue;
    merged.push({
      id,
      title: meta.title,
      status: payload.status === null ? null : payload.status.toLowerCase(),
      scheduledAt: payload.scheduled_at,
      contentPreview: contentPreview(payload.content),
      createdAt: meta.created_at,
    });
  }
  // Tie-break on id: created_at is `default now()`, so bulk-inserted rows
  // share a timestamp, and without a total order the offset paging above
  // could repeat or drop rows across pages.
  merged.sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
  );

  return toPage(
    merged.map(({ createdAt: _createdAt, ...rest }) => rest),
    offset,
    limit,
  );
}

export async function searchAll(args: {
  query: string;
  domains?: string[];
  limit?: number;
  offset?: number;
}) {
  const limit = resolveListLimit(args.limit, DEFAULT_SEARCH_LIMIT);
  const offset = resolveListOffset(args.offset);
  const domains: Domain[] = args.domains
    ? (args.domains.filter((d) =>
        VALID_DOMAINS.includes(d as Domain),
      ) as Domain[])
    : [...VALID_DOMAINS];

  const needle = args.query.toLowerCase();
  /*
   * Keyed by Domain rather than by `string`, which is what lets a caller
   * write `.todos` (#1003 / #1010).
   *
   * With an index signature, `return { ...result, totalHits }` types as
   * `{ totalHits: number }` and NOTHING else: `number` is not assignable to
   * `DomainPage<unknown>`, so TypeScript drops the index signature from the
   * spread rather than widening it. Every domain key disappeared from the
   * return type, and callers had been casting their way past it
   * (`as Record<string, unknown>` in searchPaging.test.ts) instead of the
   * signature being fixed. The domains are a closed set — VALID_DOMAINS —
   * so naming them costs nothing and each is optional for the real reason:
   * a domain answers only when it was asked for.
   */
  const result: Partial<Record<Domain, DomainPage<unknown>>> = {};
  let totalHits = 0;

  if (domains.includes("todos")) {
    const todos = await searchTodos(
      `%${escapeLikePattern(args.query)}%`,
      offset,
      limit,
    );
    result.todos = todos;
    totalHits += todos.total;
  }

  if (domains.includes("dailies")) {
    const matches = (await fetchLiveDailies())
      .map((d) => ({
        // The date is a daily's identity, but the id is what every other
        // tool (tag_entity, get_entity_tags) takes — a hit used to be a
        // dead end for want of it.
        id: d.payload.item_id,
        date: d.payload.date,
        text: contentPlainText(d.payload.content_json),
      }))
      .filter((d) => d.text.toLowerCase().includes(needle))
      .map((d) => ({
        id: d.id,
        date: d.date,
        contentPreview: d.text.slice(0, PREVIEW_LENGTH),
      }));
    const dailies = toPage(matches, offset, limit);
    result.dailies = dailies;
    totalHits += dailies.total;
  }

  if (domains.includes("notes")) {
    const matches = (await fetchLiveNotes())
      .map((n) => ({
        id: n.meta.id,
        title: n.meta.title,
        updatedAt: n.meta.updated_at,
        text: contentPlainText(n.payload.content_json),
      }))
      .filter(
        (n) =>
          n.title.toLowerCase().includes(needle) ||
          n.text.toLowerCase().includes(needle),
      )
      .map((n) => ({
        id: n.id,
        title: n.title,
        contentPreview: n.text.slice(0, PREVIEW_LENGTH),
        updatedAt: n.updatedAt,
      }));
    const notes = toPage(matches, offset, limit);
    result.notes = notes;
    totalHits += notes.total;
  }

  // Still the sum across domains, now counting every match rather than the
  // ones that fit on the page.
  return { ...result, totalHits };
}
