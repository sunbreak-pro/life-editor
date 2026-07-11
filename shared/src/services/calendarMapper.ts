import type { CalendarNode } from "../types/calendar";

/*
 * Pure CalendarNode <-> `public.calendars` row mappers (Phase 2 S4-1).
 * NO `@supabase/supabase-js` dependency.
 *
 * SYNC CLASS: VERSIONED but PHYSICAL-delete. calendars has `version`
 * (sync LWW input) but NO is_deleted/deleted_at — the frontend never
 * soft-deletes a calendar; 0006 omits those columns to keep the schema
 * aligned with the canonical contract. CalendarNode has no soft-delete
 * field, so this is a straight bijection (no coercion).
 */

/**
 * SELECTED row shape of `public.calendars`
 * (0006_schedule_full_schema.sql; `folder_id` rebound to `tag_id` ->
 * wiki_tags(id) in 0021, life-tags S2). `user_id` is server-derived (RLS
 * default `auth.uid()`). `version` is bumped by the data layer (LWW).
 */
export interface CalendarRow {
  id: string;
  user_id: string;
  title: string;
  tag_id: string;
  order: number;
  created_at: string;
  updated_at: string;
  version: number;
}

/**
 * Writable subset of a row. Excludes `user_id` only (RLS-derived).
 */
export type CalendarWriteRow = Omit<CalendarRow, "user_id">;

/**
 * Column list for SELECTs — plain real column names only (no SQL
 * expression; the S2 recurrence-prevention rule). `"order"` is quoted.
 */
export const CALENDAR_SELECT_COLUMNS =
  'id, user_id, title, tag_id, "order", created_at, updated_at, version';

/**
 * DB row -> domain CalendarNode. Straight bijection (every field
 * required by the type, no coercion).
 */
export function rowToCalendar(row: CalendarRow): CalendarNode {
  return {
    id: row.id,
    title: row.title,
    tagId: row.tag_id,
    order: row.order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Domain CalendarNode -> full writable DB row (minus server-derived
 * user_id). `version` defaults to 1; callers that bump it set it
 * explicitly / via the patch builder.
 */
export function calendarToRow(node: CalendarNode): CalendarWriteRow {
  return {
    id: node.id,
    title: node.title,
    tag_id: node.tagId,
    order: node.order,
    created_at: node.createdAt,
    updated_at: node.updatedAt,
    version: 1,
  };
}

/**
 * Build a snake_case patch from a partial CalendarNode update. Only keys
 * PRESENT on `updates` are emitted (Issue 020 partial-payload safety).
 * `id` / `tag_id` / `created_at` / `version` are NOT mutable through
 * this path (a calendar is rebound to a new life-tag by recreation, not
 * by mutating tag_id in place).
 */
export function calendarUpdatesToPatch(
  updates: Partial<Pick<CalendarNode, "title" | "order">>,
): Partial<CalendarWriteRow> {
  const patch: Partial<CalendarWriteRow> = {};
  if ("title" in updates && updates.title !== undefined)
    patch.title = updates.title;
  if ("order" in updates && updates.order !== undefined)
    patch.order = updates.order;
  return patch;
}
