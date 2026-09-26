/*
 * The "take all of my data with me" file (#1988) — its shape, its table list
 * and its name. Pure: the I/O is SupabaseExportService, the download is the
 * web host.
 *
 * WHY RAW ROWS, NOT DOMAIN OBJECTS. The domain reads (`fetchTodoTree`,
 * `listNotesUnified`, ...) each answer one screen's question — live rows only,
 * no body on a list, trash in a separate call — so stitching them together
 * would drop exactly what an export is for: the deleted-but-restorable items,
 * the note bodies, the columns no screen shows yet. A row per table is also
 * what a later import (separate Issue) can write back without a mapper
 * guessing at fields it never saw.
 *
 * WHY THIS TABLE LIST. It is the delete list of `delete_my_account()`
 * (supabase/migrations/0025) minus what later migrations dropped: "every row
 * that belongs to me" is the same set whether it is being erased or carried
 * out. `shared/tests/userDataExport.test.ts` reads both migrations and fails
 * the moment the two lists disagree, so a new user table cannot be forgotten
 * here the way it could not be forgotten there.
 *
 * Attachments are NOT in the file. Their bytes live in Storage, and their
 * paths are already inside the note / daily bodies (`content` in the payload
 * rows) — which is the one place a path means anything.
 */

/**
 * Bumped when the file's shape changes in a way an importer must know about
 * (a table renamed, a key moved). Adding a table does not bump it: an importer
 * reads the tables it knows and can ignore the rest.
 */
export const USER_DATA_EXPORT_SCHEMA_VERSION = 1;

/**
 * Every table that holds a row owned by the user, with the column that makes
 * its order stable across pages (fetchAllPages needs a unique tiebreaker).
 * Order is parents before children, so a reader walking the file top to
 * bottom meets an id before anything that points at it.
 */
export const USER_DATA_EXPORT_TABLES = [
  { table: "items_meta", orderBy: "id" },
  { table: "tasks_payload", orderBy: "item_id" },
  { table: "events_payload", orderBy: "item_id" },
  { table: "routines_payload", orderBy: "item_id" },
  { table: "notes_payload", orderBy: "item_id" },
  { table: "dailies_payload", orderBy: "item_id" },
  { table: "wiki_tags", orderBy: "id" },
  { table: "wiki_tag_assignments", orderBy: "id" },
  { table: "wiki_tag_connections", orderBy: "id" },
  { table: "wiki_tag_groups", orderBy: "id" },
  { table: "wiki_tag_group_assignments", orderBy: "id" },
  { table: "routine_groups", orderBy: "id" },
  { table: "routine_group_assignments", orderBy: "id" },
  { table: "timer_settings", orderBy: "id" },
  { table: "timer_sessions", orderBy: "id" },
  { table: "pomodoro_presets", orderBy: "id" },
  { table: "sound_settings", orderBy: "id" },
  { table: "playlists", orderBy: "id" },
  { table: "playlist_items", orderBy: "id" },
  { table: "life_tags_migration_log", orderBy: "id" },
] as const;

export type UserDataExportTable =
  (typeof USER_DATA_EXPORT_TABLES)[number]["table"];

/** The file as it is written: version and time first, then one key per table. */
export interface UserDataExport {
  schemaVersion: number;
  /** ISO 8601, UTC. */
  exportedAt: string;
  tables: Record<UserDataExportTable, Record<string, unknown>[]>;
}

/** `life-editor-export-YYYY-MM-DD.json`, dated in the user's own time zone. */
export function userDataExportFileName(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `life-editor-export-${y}-${m}-${d}.json`;
}

/** Total rows across every table — the number the card reports back. */
export function countUserDataExportRows(data: UserDataExport): number {
  return Object.values(data.tables).reduce((sum, rows) => sum + rows.length, 0);
}
