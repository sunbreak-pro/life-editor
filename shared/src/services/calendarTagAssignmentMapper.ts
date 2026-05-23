/*
 * Pure CalendarTagAssignment <-> `public.calendar_tag_assignments` row
 * mappers (Phase 2 S4-1). NO `@supabase/supabase-js` dependency.
 *
 * SYNC CLASS: RELATION, physical-delete, NO version / NO soft-delete.
 * The V65 cta junction is paged by `updated_at` for delta sync
 * (note_connections-adjacent). UNIQUE(entity_type, entity_id) = a single
 * tag per entity (1:1) — a DB constraint enforced by 0006, not modelled
 * here.
 *
 * POLYMORPHIC: `entity_type` is 'task' | 'schedule_item' and `entity_id`
 * points at EITHER tasks.id OR schedule_items.id (no FK — a column
 * cannot reference two tables; the 0006 CHECK + this mapper's narrowing
 * are the guard). `tag_id` is the integer identity of
 * calendar_tag_definitions (a `number`, matching CalendarTag.id).
 *
 * NO SHARED DOMAIN TYPE EXISTS for the cta junction (the frontend Tauri
 * service exposes only an anonymous `{ entityType, entityId, tagId }`
 * tuple plus a hard set/clear API). This module therefore owns the
 * wire-faithful domain interface — `id` + `createdAt` + `updatedAt` are
 * carried so the delta-sync layer (S4-2/S4-6) can page by updated_at and
 * upsert by id, exactly like the D1 RELATION_TABLES_WITH_UPDATED_AT
 * shape (cloud/db/migrations 0004/0006).
 */

export type CalendarTagAssignmentEntityType = "task" | "schedule_item";

/**
 * Wire-faithful domain shape of a calendar_tag_assignments row. The
 * frontend service only surfaces { entityType, entityId, tagId }; the
 * sync columns (id/createdAt/updatedAt) are kept here so the relation
 * can be delta-synced and upserted by id.
 */
export interface CalendarTagAssignment {
  id: string;
  entityType: CalendarTagAssignmentEntityType;
  entityId: string;
  tagId: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * SELECTED row shape of `public.calendar_tag_assignments`
 * (0006_schedule_full_schema.sql). `user_id` is server-derived (RLS
 * default `auth.uid()`). No `version` column (relation table).
 */
export interface CalendarTagAssignmentRow {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  tag_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * Writable subset of a row. Excludes `user_id` only (RLS-derived).
 */
export type CalendarTagAssignmentWriteRow = Omit<
  CalendarTagAssignmentRow,
  "user_id"
>;

/**
 * Column list for SELECTs — plain real column names only (no SQL
 * expression; the S2 recurrence-prevention rule).
 */
export const CALENDAR_TAG_ASSIGNMENT_SELECT_COLUMNS =
  "id, user_id, entity_type, entity_id, tag_id, created_at, updated_at";

const CTA_ENTITY_TYPES: ReadonlySet<string> = new Set([
  "task",
  "schedule_item",
]);

/**
 * Narrow the DB `entity_type` to the union. The 0006 CHECK constraint
 * enforces this at the DB layer; defence-in-depth so a corrupt row
 * surfaces a clear error instead of a silent type lie.
 */
export function toCtaEntityType(
  value: string,
): CalendarTagAssignmentEntityType {
  if (CTA_ENTITY_TYPES.has(value))
    return value as CalendarTagAssignmentEntityType;
  throw new Error(
    `calendar_tag_assignments: invalid entity_type "${value}" ` +
      `(expected task|schedule_item)`,
  );
}

/**
 * DB row -> domain CalendarTagAssignment. Straight bijection (every
 * field required; the only narrowing is entity_type -> the union).
 */
export function rowToCalendarTagAssignment(
  row: CalendarTagAssignmentRow,
): CalendarTagAssignment {
  return {
    id: row.id,
    entityType: toCtaEntityType(row.entity_type),
    entityId: row.entity_id,
    tagId: row.tag_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Domain CalendarTagAssignment -> full writable DB row (minus
 * server-derived user_id). Used for INSERT/UPSERT.
 */
export function calendarTagAssignmentToRow(
  a: CalendarTagAssignment,
): CalendarTagAssignmentWriteRow {
  return {
    id: a.id,
    entity_type: a.entityType,
    entity_id: a.entityId,
    tag_id: a.tagId,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  };
}

/**
 * Build a snake_case patch from a partial CalendarTagAssignment update.
 * Only keys PRESENT on `updates` are emitted (Issue 020 partial-payload
 * safety). The only mutable surface is `tagId` (re-tag the same entity —
 * the (entity_type, entity_id) pair is the 1:1 logical identity and is
 * immutable through this path; `id` / `created_at` are immutable too).
 */
export function calendarTagAssignmentUpdatesToPatch(
  updates: Partial<Pick<CalendarTagAssignment, "tagId">>,
): Partial<CalendarTagAssignmentWriteRow> {
  const patch: Partial<CalendarTagAssignmentWriteRow> = {};
  if ("tagId" in updates && updates.tagId !== undefined)
    patch.tag_id = updates.tagId;
  return patch;
}
