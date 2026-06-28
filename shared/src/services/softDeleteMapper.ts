/*
 * Shared soft-delete patch builder for RELATION tables.
 *
 * wiki_tag_assignments / wiki_tag_connections / wiki_tag_group_assignments
 * are RELATION tables (no version): delta sync is keyed on `updated_at` +
 * `is_deleted` (Issue 008 pattern). Their `*UpdatesToPatch` mappers were
 * byte-for-byte identical, so the patch body lives here once and cannot
 * drift apart per table.
 */

/** Soft-delete fields read off any relation-table domain object. */
export interface SoftDeletableDomain {
  isDeleted?: boolean;
  deletedAt?: string | null;
}

/** The `updated_at` + soft-delete columns common to every relation patch. */
export interface RelationSoftDeletePatch {
  updated_at?: string;
  is_deleted?: boolean;
  deleted_at?: string | null;
}

/**
 * Build the `updated_at` + soft-delete patch shared by every relation
 * table. Only keys actually present on `updates` are written, so a caller
 * can flip `is_deleted` / `deleted_at` independently without clobbering the
 * other column.
 */
export function relationSoftDeleteUpdatesToPatch(
  updates: SoftDeletableDomain,
  now: string,
): RelationSoftDeletePatch {
  const patch: RelationSoftDeletePatch = { updated_at: now };
  if ("isDeleted" in updates) patch.is_deleted = updates.isDeleted ?? false;
  if ("deletedAt" in updates) patch.deleted_at = updates.deletedAt ?? null;
  return patch;
}
