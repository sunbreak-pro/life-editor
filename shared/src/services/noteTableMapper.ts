import type { NoteBodyTable, NoteTable } from "../types/table";
import {
  ITEMS_META_COLUMNS,
  assertItemsMetaPair,
  toItemsMetaInsertRow,
  toItemsMetaPatch,
  type ItemsMetaInsertRow,
  type ItemsMetaPatchInput,
  type ItemsMetaRow,
  type ItemsMetaUpdatePatch,
} from "./itemsMeta";

/*
 * Note tables (#2094, plan Step 3) — pure mapping between the domain
 * `NoteTable` and the 2-row split of migration 0040: `items_meta` (role
 * `table`: the name, soft delete, the LWW cursor) + `tables_payload` (the
 * parent note only). SupabaseNoteTablesService is the I/O layer.
 *
 * The other half lives here too: reading a note body for the tables that
 * point at items (`collectBodyTables`) and deciding what a save changed
 * (`planNoteTableSync`). Both are pure so the rule "the body is the source,
 * the items follow it" is tested without a client.
 *
 * Plan (SSOT): .claude/docs/vision/plans/2026-10-10-note-table-items.md
 */

export type ItemsMetaTableRow = ItemsMetaRow<"table">;
export type ItemsMetaTableInsertRow = ItemsMetaInsertRow<"table">;

export interface TablesPayloadRow {
  item_id: string;
  user_id: string;
  parent_note_id: string;
  /** Generated `'note'` (0040) — read back, never written. */
  parent_note_role: "note";
}

/** db-conventions §10.3: a generated column is not part of any write. */
export type TablesPayloadInsertRow = Omit<TablesPayloadRow, "parent_note_role">;

export const ITEMS_META_TABLE_COLUMNS = ITEMS_META_COLUMNS;

export const TABLES_PAYLOAD_COLUMNS =
  "item_id, user_id, parent_note_id, parent_note_role";

// ---------------------------------------------------------------------------
// SELECT: 2 rows -> NoteTable
// ---------------------------------------------------------------------------

export function rowsToNoteTable(
  meta: ItemsMetaTableRow,
  payload: TablesPayloadRow,
): NoteTable {
  assertItemsMetaPair("noteTableMapper", "table", meta, payload);
  return {
    id: meta.id,
    title: meta.title,
    parentNoteId: payload.parent_note_id,
    isDeleted: meta.is_deleted,
    deletedAt: meta.deleted_at,
    createdAt: meta.created_at,
    updatedAt: meta.updated_at,
  };
}

// ---------------------------------------------------------------------------
// INSERT: create input -> { meta, payload }
// ---------------------------------------------------------------------------

export interface NoteTableCreateInput {
  id: string;
  parentNoteId: string;
  /** The table's name; `''` for an unnamed one (`items_meta.title` is NOT NULL). */
  title: string;
}

export function noteTableCreateToRows(
  input: NoteTableCreateInput,
  userId: string,
): { meta: ItemsMetaTableInsertRow; payload: TablesPayloadInsertRow } {
  return {
    meta: toItemsMetaInsertRow({
      id: input.id,
      userId,
      role: "table",
      title: input.title,
    }),
    payload: {
      item_id: input.id,
      user_id: userId,
      parent_note_id: input.parentNoteId,
    },
  };
}

// ---------------------------------------------------------------------------
// The body side: which tables a saved note body points at
// ---------------------------------------------------------------------------

/**
 * The tables in a note body (TipTap JSON) that carry a `tableId`, in document
 * order. A table without one is not an item yet and is skipped.
 *
 * The first occurrence of an id wins. Two tables should never share one — the
 * editor strips `tableId` from pasted tables — but if a body still carries a
 * pair, keeping one stops the second from renaming the item back and forth.
 *
 * An empty body has no tables. A body that is not JSON answers `null`, not
 * `[]`: "no tables" would make the sync soft-delete every table item of the
 * note, and a body the sync cannot read is no evidence that they are gone.
 */
export function collectBodyTables(content: string): NoteBodyTable[] | null {
  if (content.trim() === "") return [];
  let doc: unknown;
  try {
    doc = JSON.parse(content);
  } catch {
    return null;
  }
  const out: NoteBodyTable[] = [];
  const seen = new Set<string>();
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const {
      type,
      attrs,
      content: children,
    } = node as {
      type?: unknown;
      attrs?: Record<string, unknown> | null;
      content?: unknown;
    };
    if (type === "table" && attrs) {
      const id = attrs.tableId;
      if (typeof id === "string" && id !== "" && !seen.has(id)) {
        seen.add(id);
        const name = attrs.name;
        out.push({
          id,
          name: typeof name === "string" && name.trim() !== "" ? name : "",
        });
      }
    }
    if (Array.isArray(children)) for (const child of children) walk(child);
  };
  walk(doc);
  return out;
}

// ---------------------------------------------------------------------------
// UPDATE: the items_meta patches the sync writes
// ---------------------------------------------------------------------------

export type NoteTableUpdate =
  | { kind: "softDelete" }
  | { kind: "restore" }
  | { kind: "rename"; title: string };

/**
 * The items_meta patch for one sync write. Through `toItemsMetaPatch`, the
 * single implementation of DB-Q2, so every write moves `updated_at` —
 * tables_payload has no cursor of its own.
 */
export function noteTableUpdateToPatch(
  update: NoteTableUpdate,
  now: string,
): ItemsMetaUpdatePatch {
  const fields: ItemsMetaPatchInput =
    update.kind === "softDelete"
      ? { isDeleted: true, deletedAt: now }
      : update.kind === "restore"
        ? { isDeleted: false, deletedAt: null }
        : { title: update.title };
  return toItemsMetaPatch(fields, now);
}

/** What a save asks of one note's table items. */
export interface NoteTableSyncPlan {
  softDelete: string[];
  restore: string[];
  rename: Array<{ id: string; title: string }>;
}

/**
 * Compare a saved body with the note's table items (live and soft-deleted).
 *
 * - An item the body no longer points at is soft-deleted: the table was
 *   deleted or cut away. Its tags stay on the row, so an Undo that puts the
 *   table back restores the item with its tags.
 * - A soft-deleted item the body points at again is restored.
 * - An item whose name differs from the body's is renamed to the body's.
 *
 * A `tableId` the note has no item for is left alone: it belongs to another
 * note's item, or to an item whose create has not landed yet. Adopting it
 * here could move a table item between notes behind the user's back.
 */
export function planNoteTableSync(
  bodyTables: readonly NoteBodyTable[],
  items: readonly NoteTable[],
): NoteTableSyncPlan {
  const inBody = new Map(bodyTables.map((t) => [t.id, t]));
  const plan: NoteTableSyncPlan = { softDelete: [], restore: [], rename: [] };
  for (const item of items) {
    const table = inBody.get(item.id);
    if (!table) {
      if (!item.isDeleted) plan.softDelete.push(item.id);
      continue;
    }
    if (item.isDeleted) plan.restore.push(item.id);
    if (item.title !== table.name) {
      plan.rename.push({ id: item.id, title: table.name });
    }
  }
  return plan;
}
