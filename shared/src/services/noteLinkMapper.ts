import type { NoteLink, NoteLinkType } from "../types/noteLink";

/*
 * Pure NoteLink <-> `public.note_links` row mappers (Phase 2 S3-2).
 * Carries NO `@supabase/supabase-js` dependency (same rationale as the
 * task / daily / note mappers).
 *
 * SYNC CLASS: VERSIONED. note_links has `version` + `is_deleted` +
 * `deleted_at`; the data layer bumps `version` and uses soft-delete
 * (mirrors the Tauri `src-tauri/src/db/note_link_repository.rs`
 * `version = version + 1` + `is_deleted = 1` semantics).
 *
 * COLUMN-NAME NOTE: 0005_notes_full_schema.sql is the canonical column
 * source and names the daily/memo source column `source_memo_date`
 * (NOT the legacy SQLite `source_daily_date`). The domain type
 * noteLink.ts is the type SoT and exposes it as `sourceMemoDate`, so the
 * mapper bridges `source_memo_date` <-> `sourceMemoDate`. `isDeleted` is
 * typed `number` (legacy SQLite 0/1) on NoteLink but the Postgres column
 * is real `boolean`; the mapper coerces boolean -> 0/1 on read and
 * 0/1/boolean -> boolean on write (same coercion shape as 0004 dailies).
 */

/**
 * SELECTED row shape of `public.note_links` (0005_notes_full_schema.sql).
 * snake_case, nullable where the column is nullable. `user_id` is
 * server-derived (RLS default `auth.uid()`) — clients never write it.
 */
export interface NoteLinkRow {
  id: string;
  user_id: string;
  source_note_id: string | null;
  source_memo_date: string | null;
  target_note_id: string;
  target_heading: string | null;
  target_block_id: string | null;
  alias: string | null;
  link_type: string;
  created_at: string;
  updated_at: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  version: number;
}

/**
 * Writable subset of a row. Excludes `user_id` only (RLS-derived). Used
 * for INSERT/UPSERT payloads.
 */
export type NoteLinkWriteRow = Omit<NoteLinkRow, "user_id">;

/**
 * Column list for SELECTs — plain real column names only (no SQL
 * expression; the S2 recurrence-prevention rule). Any note_links read
 * path MUST use this exact list.
 */
export const NOTE_LINK_SELECT_COLUMNS =
  "id, user_id, source_note_id, source_memo_date, target_note_id, " +
  "target_heading, target_block_id, alias, link_type, created_at, " +
  "updated_at, is_deleted, deleted_at, version";

const LINK_TYPES: ReadonlySet<string> = new Set(["inline", "embed"]);

/**
 * Narrow the DB `link_type` to the `NoteLinkType` union. The 0005 CHECK
 * constraint (`link_type in ('inline','embed')`) enforces this at the DB
 * layer; defence-in-depth so a corrupt row surfaces a clear error
 * instead of a silent type lie.
 */
export function toNoteLinkType(value: string): NoteLinkType {
  if (LINK_TYPES.has(value)) return value as NoteLinkType;
  throw new Error(
    `note_links: invalid link_type "${value}" (expected inline|embed)`,
  );
}

/**
 * DB row -> domain NoteLink. `is_deleted` boolean -> 0/1 number (the
 * NoteLink contract types it as `number`). All NoteLink fields are
 * required by the type (nullable ones are `T | null`), so every field is
 * always materialised — no optional-vs-absent ambiguity here.
 */
export function rowToNoteLink(row: NoteLinkRow): NoteLink {
  return {
    id: row.id,
    sourceNoteId: row.source_note_id,
    sourceMemoDate: row.source_memo_date,
    targetNoteId: row.target_note_id,
    targetHeading: row.target_heading,
    targetBlockId: row.target_block_id,
    alias: row.alias,
    linkType: toNoteLinkType(row.link_type),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    isDeleted: row.is_deleted ? 1 : 0,
    deletedAt: row.deleted_at,
  };
}

/**
 * Domain NoteLink -> full writable DB row. `isDeleted` (0/1 number, but
 * defensively also accepts a boolean) -> Postgres boolean. Used for
 * INSERT/UPSERT (the data layer sets `version` explicitly when bumping).
 */
export function noteLinkToRow(link: NoteLink): NoteLinkWriteRow {
  return {
    id: link.id,
    source_note_id: link.sourceNoteId,
    source_memo_date: link.sourceMemoDate,
    target_note_id: link.targetNoteId,
    target_heading: link.targetHeading,
    target_block_id: link.targetBlockId,
    alias: link.alias,
    link_type: link.linkType,
    created_at: link.createdAt,
    updated_at: link.updatedAt,
    is_deleted: Boolean(link.isDeleted),
    deleted_at: link.deletedAt,
    version: link.version,
  };
}
