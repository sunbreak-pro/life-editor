/*
 * The `public.items_meta` row shape — shared by all 5 roles.
 *
 * DU-A (migration 0008) made items_meta the authority row for every item
 * (task / event / routine / note / daily) with one `<role>_payload` row
 * beside it. The shape below is therefore role-independent, and every role
 * mapper aliases it rather than keeping a byte-identical copy.
 *
 * It used to live in `todoMapper.ts` because Tasks was the first domain
 * ported, which left the other four mappers importing a *shared* type from
 * the *Tasks* module — a dependency that reads as "Notes depend on Tasks"
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
  version: number;
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
  "id, user_id, role, title, is_deleted, deleted_at, " +
  "created_at, updated_at, version";
