/*
 * The `public.items_meta` row shape — shared by all 5 roles.
 *
 * DU-A (migration 0008) made items_meta the authority row for every item
 * (todo / event / routine / note / daily) with one `<role>_payload` row
 * beside it. The shape below is therefore role-independent, and every role
 * mapper aliases it rather than keeping a byte-identical copy.
 *
 * It used to live in `todoMapper.ts` because Todos was the first domain
 * ported, which left the other four mappers importing a *shared* type from
 * the *Todos* module — a dependency that reads as "Notes depend on Todos"
 * and is not true (#670 C3 PR 2). Role-scoped aliases
 * (`ITEMS_META_TASK_COLUMNS` and friends) stay in their own mappers, so
 * query call sites keep their role-scoped names.
 *
 * Carries NO `@supabase/supabase-js` dependency: types + one string.
 * The 0008 migration is the SSOT for column types and nullability.
 */

/**
 * Row shape of `public.items_meta`. `role` is a CHECK column with 5
 * allowed values; each role mapper narrows `R` to its own literal
 * (default `'task'` for the historical call sites). `user_id` is
 * server-derived (RLS default `auth.uid()`) and clients never write it.
 */
export interface ItemsMetaRow<R extends string = "task"> {
  id: string;
  user_id: string;
  role: R;
  title: string;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Writable subset for INSERT. `user_id` is the only items_meta column
 * the client must supply (RLS default would fill it, but explicit is
 * safer for cross-device parity); `created_at` / `updated_at` are left
 * to the column DEFAULT `now()` on first INSERT.
 */
export type ItemsMetaInsertRow<R extends string = "task"> = Omit<
  ItemsMetaRow<R>,
  "created_at" | "updated_at"
>;

/**
 * UPDATE patch for items_meta. `id` / `user_id` / `role` / `created_at`
 * are never patched, so this shape is role-independent (all 5 role
 * mappers alias it). `updated_at` is ALWAYS present (bump responsibility
 * — see each mapper's `*UpdatesToPatches`).
 */
export type ItemsMetaUpdatePatch = Partial<
  Omit<ItemsMetaRow, "id" | "user_id" | "role" | "created_at">
>;

/**
 * SELECT column list for `items_meta` rows (identical for all 5 roles —
 * the role filter is the caller's responsibility, e.g.
 * `.eq('role', 'task')`). The per-role constants in the mappers are thin
 * aliases so query call sites keep their role-scoped names.
 */
export const ITEMS_META_COLUMNS =
  "id, user_id, role, title, is_deleted, deleted_at, created_at, updated_at";

/* ==========================================================================
 * The items_meta half of the five role mappers (#890).
 *
 * Each of todo / note / daily / event / routine carried its own copy of the
 * three steps below. The volume was never the problem — `updated_at` was.
 * `items_meta.updated_at` is Sync's LWW cursor and `<role>_payload` has no
 * `updated_at` of its own (db-conventions §10 DB-Q2), so a patch that misses
 * the bump does not fail: the write lands, and the change simply never
 * reaches the other devices. Five copies of that line meant five chances to
 * write the sixth one without it.
 *
 * What is NOT here, and why: the payload half, and the READ direction
 * (`rowsTo<T>`'s field-by-field build). The read side looks similar across
 * the five but is not — todo emits `deletedAt` only when non-null while daily
 * always emits it, notes surfaces a lite variant, and so on. Folding those
 * would mean picking one role's rule and silently changing four.
 * ======================================================================== */

/**
 * Guard the pair a `rowsTo<T>` mapper was handed: the two rows must be the
 * same item, and the meta row must actually be the role the mapper decodes.
 * A mismatch means a query joined the wrong rows, which would otherwise
 * surface as a node with one item's title and another's body.
 *
 * `mapper` is the module name, so the thrown message names the caller rather
 * than this helper (the five messages were byte-identical apart from it).
 */
export function assertItemsMetaPair(
  mapper: string,
  role: string,
  meta: Pick<ItemsMetaRow<string>, "id" | "role">,
  payload: { item_id: string },
): void {
  if (meta.id !== payload.item_id) {
    throw new Error(
      `${mapper}: row mismatch — meta.id="${meta.id}" but payload.item_id="${payload.item_id}"`,
    );
  }
  if (meta.role !== role) {
    throw new Error(
      `${mapper}: items_meta.role expected "${role}" but got "${meta.role}"`,
    );
  }
}

/** Domain-side fields a `<role>NodeToRows` projects onto items_meta. */
export interface ItemsMetaInsertInput<R extends string> {
  id: string;
  userId: string;
  role: R;
  /**
   * `items_meta.title` is NOT NULL. Roles without a title of their own pass
   * whatever carries the identity instead (Daily passes its date).
   */
  title: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
}

/**
 * Build the items_meta INSERT row. `created_at` / `updated_at` are
 * deliberately absent — the column DEFAULT `now()` owns the first write, and
 * DB-Q2's bump rule only applies to UPDATE.
 */
export function toItemsMetaInsertRow<R extends string>(
  input: ItemsMetaInsertInput<R>,
): ItemsMetaInsertRow<R> {
  return {
    id: input.id,
    user_id: input.userId,
    role: input.role,
    title: input.title,
    is_deleted: input.isDeleted ?? false,
    deleted_at: input.deletedAt ?? null,
  };
}

/**
 * The items_meta columns a `<role>UpdatesToPatches` may patch, in domain
 * spelling. A key being PRESENT is what decides whether its column is
 * emitted — assign only the keys the domain update actually carried, and
 * never pre-fill the rest, or a partial UPDATE will clobber columns the
 * caller never mentioned.
 */
export interface ItemsMetaPatchInput {
  title?: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
}

/**
 * Build the items_meta half of an UPDATE.
 *
 * DB-Q2 — `updated_at` is ALWAYS set, whatever else the caller is patching.
 * This is the single implementation of that rule; the five role mappers each
 * had their own before #890. `now` is injected rather than read from the
 * clock so the mappers stay pure and a batch can share one timestamp.
 */
export function toItemsMetaPatch(
  fields: ItemsMetaPatchInput,
  now: string,
): ItemsMetaUpdatePatch {
  const patch: ItemsMetaUpdatePatch = { updated_at: now };
  if ("title" in fields && fields.title !== undefined)
    patch.title = fields.title;
  // `?? false` / `?? null` normalise a present-but-undefined value, matching
  // what todo / note / daily did. The two roles that instead SKIPPED an
  // undefined `isDeleted` (event / routine) keep that by not assigning the
  // key at all, which leaves the coalesce unreachable for them.
  if ("isDeleted" in fields) patch.is_deleted = fields.isDeleted ?? false;
  if ("deletedAt" in fields) patch.deleted_at = fields.deletedAt ?? null;
  return patch;
}
