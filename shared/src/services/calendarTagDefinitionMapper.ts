import type { CalendarTag } from "../types/calendarTag";

/*
 * Pure CalendarTag <-> `public.calendar_tag_definitions` row mappers
 * (Phase 2 S4-1). NO `@supabase/supabase-js` dependency.
 *
 * SYNC CLASS: VERSIONED (V65 added sync columns). PHYSICAL-delete (0006
 * omits is_deleted — the frontend never soft-deletes a tag).
 *
 * ID CONTRACT (the load-bearing decision here): CalendarTag.id is a
 * `number` (frontend/src/types/calendarTag.ts) and the 0006 pk is
 * `integer generated always as identity` — NOT a client text id and NOT
 * UUID-ified. The mapper passes the number through verbatim. Because the
 * id is server-generated on INSERT, the WRITE row makes `id` OPTIONAL:
 * a create omits it (Postgres assigns the identity) and only an UPSERT
 * of an existing tag carries it. `version`/`created_at`/`updated_at`/
 * `user_id` are likewise server-managed and excluded from the write row.
 *
 * CalendarTag carries only id/name/color/textColor?/order — the sync
 * columns (created_at/updated_at/version) are NOT exposed on the domain
 * type, so rowToCalendarTag drops them (round-trip re-attaches them as
 * the SELECT/DB would).
 */

/**
 * SELECTED row shape of `public.calendar_tag_definitions`
 * (0006_schedule_full_schema.sql). `id` is the integer identity pk.
 * `user_id` is server-derived (RLS default `auth.uid()`).
 */
export interface CalendarTagDefinitionRow {
  id: number;
  user_id: string;
  name: string;
  color: string;
  text_color: string | null;
  order: number;
  created_at: string;
  updated_at: string;
  version: number;
}

/**
 * Writable subset of a row. Excludes the server-managed columns:
 *   - `user_id`    — RLS-derived.
 *   - `id`         — `generated always as identity`; Postgres assigns it
 *                    on INSERT. Optional on the write row so a create can
 *                    omit it (an UPSERT of an existing tag still carries
 *                    it for the conflict target).
 *   - `created_at` / `updated_at` / `version` — server / sync managed
 *                    (the domain CalendarTag does not even expose them).
 */
export type CalendarTagDefinitionWriteRow = {
  id?: number;
  name: string;
  color: string;
  text_color: string | null;
  order: number;
};

/**
 * Column list for SELECTs — plain real column names only (no SQL
 * expression; the S2 recurrence-prevention rule). `"order"` is quoted.
 */
export const CALENDAR_TAG_DEFINITION_SELECT_COLUMNS =
  'id, user_id, name, color, text_color, "order", created_at, ' +
  "updated_at, version";

/**
 * DB row -> domain CalendarTag. `id` integer passes through as a
 * `number`. `textColor` is only set when the column is non-null so
 * `calendarTagDefinitionToRow ∘ rowToCalendarTag` does not manufacture
 * an undefined-vs-absent diff (textColor is optional on the type). The
 * sync columns are intentionally dropped (not on the domain type).
 */
export function rowToCalendarTag(row: CalendarTagDefinitionRow): CalendarTag {
  const tag: CalendarTag = {
    id: row.id,
    name: row.name,
    color: row.color,
    order: row.order,
  };
  if (row.text_color !== null) tag.textColor = row.text_color;
  return tag;
}

/**
 * Domain CalendarTag -> writable DB row (minus server-managed columns).
 * `id` is included ONLY when the tag already has one (an UPSERT of an
 * existing row); a create passes `withId=false` so Postgres assigns the
 * identity. `textColor` absent -> column null.
 */
export function calendarTagToRow(
  tag: CalendarTag,
  withId = true,
): CalendarTagDefinitionWriteRow {
  const row: CalendarTagDefinitionWriteRow = {
    name: tag.name,
    color: tag.color,
    text_color: tag.textColor ?? null,
    order: tag.order,
  };
  if (withId) row.id = tag.id;
  return row;
}

/**
 * Build a snake_case patch from a partial CalendarTag update. Only keys
 * PRESENT on `updates` are emitted (Issue 020 partial-payload safety).
 * `id` (identity) / `created_at` / `version` are NOT mutable through
 * this path.
 */
export function calendarTagUpdatesToPatch(
  updates: Partial<Pick<CalendarTag, "name" | "color" | "textColor" | "order">>,
): Partial<CalendarTagDefinitionWriteRow> {
  const patch: Partial<CalendarTagDefinitionWriteRow> = {};
  if ("name" in updates && updates.name !== undefined)
    patch.name = updates.name;
  if ("color" in updates && updates.color !== undefined)
    patch.color = updates.color;
  if ("textColor" in updates) patch.text_color = updates.textColor ?? null;
  if ("order" in updates && updates.order !== undefined)
    patch.order = updates.order;
  return patch;
}
