import type { ScheduleItem } from "../types/schedule";

/*
 * Pure ScheduleItem <-> `public.schedule_items` row mappers
 * (Phase 2 S4-1). NO `@supabase/supabase-js` dependency.
 *
 * SYNC CLASS: VERSIONED + soft-delete + a LOGICAL uniqueness invariant
 * (at most one live row per (routine_id, date) — the Issue 011 core,
 * enforced by the 0006 partial unique index, NOT by this mapper).
 *
 * DATE/TIME CONTRACT: `date` ("YYYY-MM-DD"), `start_time` / `end_time`
 * ("HH:MM") are `text` columns (NOT date/timestamptz): PostgREST would
 * TZ-shift real date/time types across the JST boundary. The mapper
 * passes them through verbatim as strings.
 *
 * OPTIONAL-FIELD CONTRACT: ScheduleItem types isDeleted / deletedAt /
 * isDismissed / isAllDay / reminderEnabled / reminderOffset as OPTIONAL.
 * The 0006 columns are NOT NULL-with-default (booleans) or nullable
 * (reminder_offset / deleted_at), so rowToScheduleItem always
 * materialises the boolean flags (default false) and only sets the
 * nullable optionals when the column is non-null — so
 * `scheduleItemToRow ∘ rowToScheduleItem` round-trips without
 * manufacturing undefined-vs-absent diffs.
 *
 * PARTIAL-SAFETY (Issue 020): scheduleItemUpdatesToPatch emits ONLY keys
 * present on the update object. A `date`-only move must never re-emit
 * title/time/etc., or a PATCH would clobber untouched columns and a
 * read-then-write race could resurrect stale values. The DataService
 * layer (S4-2) additionally folds update into a single UPSERT-on-id LWW.
 */

/**
 * SELECTED row shape of `public.schedule_items`
 * (0006_schedule_full_schema.sql). `user_id` is server-derived (RLS
 * default `auth.uid()`). `date`/`start_time`/`end_time` are text.
 * `version` is bumped by the data layer on every mutation (LWW input).
 */
export interface ScheduleItemRow {
  id: string;
  user_id: string;
  date: string;
  title: string;
  start_time: string;
  end_time: string;
  completed: boolean;
  completed_at: string | null;
  routine_id: string | null;
  template_id: string | null;
  memo: string | null;
  is_dismissed: boolean;
  note_id: string | null;
  is_all_day: boolean;
  content: string | null;
  reminder_enabled: boolean;
  reminder_offset: number | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

/**
 * Writable subset of a row. Excludes `user_id` only (RLS-derived). Used
 * for INSERT/UPSERT payloads.
 */
export type ScheduleItemWriteRow = Omit<ScheduleItemRow, "user_id">;

/**
 * Column list for SELECTs — plain real column names only (no SQL
 * expression; the S2 recurrence-prevention rule). Any schedule_items
 * read path MUST use this exact list.
 */
export const SCHEDULE_ITEM_SELECT_COLUMNS =
  "id, user_id, date, title, start_time, end_time, completed, " +
  "completed_at, routine_id, template_id, memo, is_dismissed, note_id, " +
  "is_all_day, content, reminder_enabled, reminder_offset, is_deleted, " +
  "deleted_at, created_at, updated_at, version";

/**
 * DB row -> domain ScheduleItem. NOT-NULL columns
 * (date/title/times/completed/timestamps/version) are always
 * materialised. The boolean flag optionals (isDeleted / isDismissed /
 * isAllDay / reminderEnabled) are NOT NULL-with-default columns so they
 * are always materialised too. The nullable optionals (deletedAt /
 * reminderOffset) are only set when the column is non-null so the
 * round-trip does not manufacture undefined-vs-absent diffs.
 */
export function rowToScheduleItem(row: ScheduleItemRow): ScheduleItem {
  const item: ScheduleItem = {
    id: row.id,
    date: row.date,
    title: row.title,
    startTime: row.start_time,
    endTime: row.end_time,
    completed: row.completed,
    completedAt: row.completed_at,
    routineId: row.routine_id,
    templateId: row.template_id,
    memo: row.memo,
    noteId: row.note_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  item.isDeleted = row.is_deleted;
  item.isDismissed = row.is_dismissed;
  item.isAllDay = row.is_all_day;
  item.reminderEnabled = row.reminder_enabled;
  if (row.deleted_at !== null) item.deletedAt = row.deleted_at;
  if (row.reminder_offset !== null) item.reminderOffset = row.reminder_offset;

  return item;
}

/**
 * Domain ScheduleItem -> full writable DB row (minus server-derived
 * user_id). Absent optional fields map to their column null/default so
 * an UPSERT fully specifies the row. `version` defaults to 1; callers
 * that bump it pass it through `scheduleItemUpdatesToPatch` or set it
 * explicitly.
 */
export function scheduleItemToRow(item: ScheduleItem): ScheduleItemWriteRow {
  return {
    id: item.id,
    date: item.date,
    title: item.title,
    start_time: item.startTime,
    end_time: item.endTime,
    completed: item.completed,
    completed_at: item.completedAt,
    routine_id: item.routineId,
    template_id: item.templateId,
    memo: item.memo,
    is_dismissed: item.isDismissed ?? false,
    note_id: item.noteId,
    is_all_day: item.isAllDay ?? false,
    content: item.content,
    reminder_enabled: item.reminderEnabled ?? false,
    reminder_offset: item.reminderOffset ?? null,
    is_deleted: item.isDeleted ?? false,
    deleted_at: item.deletedAt ?? null,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    version: 1,
  };
}

/**
 * Build a snake_case patch from a partial ScheduleItem update. Mirrors
 * the frontend `ScheduleItemUpdate` mutable surface
 * (title/startTime/endTime/completed/completedAt/memo/content/date/
 * isAllDay) PLUS the soft-delete + dismiss flips the schedule context
 * uses. ONLY keys present on `updates` are emitted — a `date`-only move
 * never re-emits title/time, so a PATCH built from it cannot clobber
 * untouched columns (Issue 020 partial-payload safety). `id` / `routine_id`
 * / `created_at` / `version` are NOT mutable through this path
 * (routine_id is the logical-uniqueness key; the generator owns it).
 */
export function scheduleItemUpdatesToPatch(
  updates: Partial<
    Pick<
      ScheduleItem,
      | "title"
      | "startTime"
      | "endTime"
      | "completed"
      | "completedAt"
      | "memo"
      | "content"
      | "date"
      | "isAllDay"
      | "isDismissed"
      | "isDeleted"
      | "deletedAt"
      | "noteId"
      | "templateId"
      | "reminderEnabled"
      | "reminderOffset"
    >
  >,
): Partial<ScheduleItemWriteRow> {
  const patch: Partial<ScheduleItemWriteRow> = {};
  if ("title" in updates && updates.title !== undefined)
    patch.title = updates.title;
  if ("startTime" in updates && updates.startTime !== undefined)
    patch.start_time = updates.startTime;
  if ("endTime" in updates && updates.endTime !== undefined)
    patch.end_time = updates.endTime;
  if ("completed" in updates && updates.completed !== undefined)
    patch.completed = updates.completed;
  if ("completedAt" in updates)
    patch.completed_at = updates.completedAt ?? null;
  if ("memo" in updates) patch.memo = updates.memo ?? null;
  if ("content" in updates) patch.content = updates.content ?? null;
  if ("date" in updates && updates.date !== undefined)
    patch.date = updates.date;
  if ("isAllDay" in updates && updates.isAllDay !== undefined)
    patch.is_all_day = updates.isAllDay;
  if ("isDismissed" in updates && updates.isDismissed !== undefined)
    patch.is_dismissed = updates.isDismissed;
  if ("isDeleted" in updates && updates.isDeleted !== undefined)
    patch.is_deleted = updates.isDeleted;
  if ("deletedAt" in updates) patch.deleted_at = updates.deletedAt ?? null;
  if ("noteId" in updates) patch.note_id = updates.noteId ?? null;
  if ("templateId" in updates) patch.template_id = updates.templateId ?? null;
  if ("reminderEnabled" in updates && updates.reminderEnabled !== undefined)
    patch.reminder_enabled = updates.reminderEnabled;
  if ("reminderOffset" in updates)
    patch.reminder_offset = updates.reminderOffset ?? null;
  return patch;
}
