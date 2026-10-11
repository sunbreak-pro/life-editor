/*
 * Note tables as tag-able items (#2094) — the domain shape of one table item.
 *
 * Storage is the 2-row split of migration 0040: `items_meta` (role `table`)
 * holds the name (`title`), the soft delete and the LWW cursor;
 * `tables_payload` holds only the note the table sits in. The cells are NOT
 * here: the note body (TipTap JSON) stays their only source, and the body's
 * table node points at this item through its `tableId` attribute.
 *
 * A table becomes an item only when it is first tagged (plan Q2), so most
 * tables in most notes have no row here at all.
 *
 * Plan (SSOT): .claude/docs/vision/plans/2026-10-10-note-table-items.md
 */

export interface NoteTable {
  id: string;
  /** The table's name. `''` = unnamed; screens and MCP word that themselves. */
  title: string;
  /** The note whose body holds the table. Always a note (0040 composite FK). */
  parentNoteId: string;
  /**
   * Set when the table left its note's body (deleted, or cut away) and the
   * post-save sync noticed. Undo brings it back on the next sync.
   */
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A table as a note body carries it: the item it points at and its name. */
export interface NoteBodyTable {
  id: string;
  /** `''` when the table has no name. */
  name: string;
}

/** What one `syncNoteTables` call changed, by table id. */
export interface NoteTableSyncResult {
  softDeleted: string[];
  restored: string[];
  renamed: string[];
}
