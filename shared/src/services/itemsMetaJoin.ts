import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages, fetchByIdChunks } from "./postgrestFetchAll";

/*
 * The items_meta + `<role>_payload` two-step in-app join (#674 / C7).
 *
 * Every list read in the services layer is the same three moves:
 *
 *   1. page through items_meta filtered by `role` + `is_deleted`, ordered by
 *      a unique tiebreaker (`id`) so the pages cannot overlap or skip;
 *   2. fetch the matching payload rows in id chunks (`.in("item_id", chunk)`,
 *      each chunk paged too);
 *   3. join in memory through a Map, skipping metas whose payload is missing.
 *
 * That last skip is the R2 orphan tolerance: a meta row whose payload INSERT
 * failed is invisible rather than fatal, and the `livePayloadInnerJoin` badge
 * counts drop the same rows with an `!inner` join so the number keeps matching
 * the list.
 *
 * Why the query is not built from a single string: PostgREST builders are
 * single-use, so `fetchAllPages` needs a factory, and the two ordering shapes
 * (plain `id` vs Trash's `deleted_at DESC, id`) differ per call site. Both are
 * expressed as data here rather than as two copies of the body.
 *
 * NOT folded in on purpose:
 *   - `SupabaseScheduleItemsService.fetchByPayloadFilter` runs the same join
 *     PAYLOAD-first (its filters — start_at ranges, routine_item_id — live on
 *     the payload), so the id set is only known after step 1. Different data
 *     flow, same idea; folding both directions into one signature would take
 *     more knobs than it saves.
 *   - `searchNotesUnified` merges a meta-first pass (title hits) with a
 *     payload-first pass (content hits) and sorts afterwards.
 *   - `updateFutureScheduleItemsByRoutine`'s title lookup builds a
 *     `Map<id, title>` used as a filter predicate, not domain objects.
 */

/** Minimal row shapes the join needs: the two sides' key columns. */
interface MetaLike {
  id: string;
}
interface PayloadLike {
  item_id: string;
}

/** One `.order()` applied before the `id` tiebreaker (Trash: deleted_at DESC). */
export interface MetaOrdering {
  column: string;
  ascending: boolean;
}

export interface MetaFirstJoinOptions<
  TMeta extends MetaLike,
  TPayload extends PayloadLike,
  TOut,
> {
  client: SupabaseClient;
  /** items_meta.role owning this domain (`"task"` / `"note"` / …). */
  role: string;
  /** items_meta.is_deleted bucket: `false` = live list, `true` = Trash. */
  isDeleted: boolean;
  metaColumns: string;
  /** Error label for the items_meta page fetch — kept per call site verbatim. */
  metaLabel: string;
  /**
   * Extra ordering applied BEFORE the mandatory `id` tiebreaker. Trash reads
   * pass `deleted_at DESC` for "most recently trashed first".
   */
  metaOrderBy?: readonly MetaOrdering[];
  payloadTable: string;
  payloadColumns: string;
  /** Error label for the payload chunk fetch — kept per call site verbatim. */
  payloadLabel: string;
  /**
   * Post-join predicate: return `false` to drop the pair before mapping.
   * Used for the legacy folder rows (#225 S3 tasks / #375 notes), which are
   * filtered in-app rather than with a PostgREST `.neq` — an inequality would
   * also drop NULL `*_type` rows and silently hide plain legacy items.
   */
  keep?: (payload: TPayload, meta: TMeta) => boolean;
  toDomain: (meta: TMeta, payload: TPayload) => TOut;
}

/**
 * Run the meta-first items_meta + payload join and map the survivors.
 *
 * Returns `[]` without touching the payload table when no meta matches, so an
 * empty domain costs exactly one round-trip.
 */
export async function fetchMetaFirstJoin<
  TMeta extends MetaLike,
  TPayload extends PayloadLike,
  TOut,
>(options: MetaFirstJoinOptions<TMeta, TPayload, TOut>): Promise<TOut[]> {
  const {
    client,
    role,
    isDeleted,
    metaColumns,
    metaLabel,
    metaOrderBy,
    payloadTable,
    payloadColumns,
    payloadLabel,
    keep,
    toDomain,
  } = options;

  const metaRows = await fetchAllPages<TMeta>((from, to) => {
    // Typed loosely for the same reason as SupabaseScheduleItemsService's
    // payload filter: the @supabase/supabase-js generic surface changes shape
    // between .eq() (filter builder) and .order() (transform builder), so the
    // optional extra ordering cannot be applied in a loop without widening.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = client
      .from("items_meta")
      .select(metaColumns)
      .eq("role", role)
      .eq("is_deleted", isDeleted);
    for (const ordering of metaOrderBy ?? []) {
      query = query.order(ordering.column, { ascending: ordering.ascending });
    }
    return query.order("id").range(from, to);
  }, metaLabel);
  if (metaRows.length === 0) return [];

  const ids = metaRows.map((m) => m.id);
  const payloadRows = await fetchByIdChunks<TPayload>(ids, (chunk) =>
    fetchAllPages(
      (from, to) =>
        client
          .from(payloadTable)
          .select(payloadColumns)
          .in("item_id", chunk)
          .order("item_id")
          .range(from, to),
      payloadLabel,
    ),
  );

  const payloadById = new Map<string, TPayload>();
  for (const row of payloadRows) payloadById.set(row.item_id, row);

  const out: TOut[] = [];
  for (const meta of metaRows) {
    const payload = payloadById.get(meta.id);
    if (!payload) continue; // R2 orphan: meta without payload — skip
    if (keep && !keep(payload, meta)) continue;
    out.push(toDomain(meta, payload));
  }
  return out;
}
