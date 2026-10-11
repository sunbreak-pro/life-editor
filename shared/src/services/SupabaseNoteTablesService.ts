import type { SupabaseClient } from "@supabase/supabase-js";
import type { NoteTablesDataService } from "./DataService";
import type { NoteTable, NoteTableSyncResult } from "../types/table";
import { generateId } from "../utils/generateId";
import {
  ITEMS_META_TABLE_COLUMNS,
  TABLES_PAYLOAD_COLUMNS,
  collectBodyTables,
  noteTableCreateToRows,
  planNoteTableSync,
  rowsToNoteTable,
  type ItemsMetaTableRow,
  type TablesPayloadRow,
} from "./noteTableMapper";
import { fetchAllPages, fetchByIdChunks } from "./postgrestFetchAll";
import { requireSingleRow } from "./postgrestSingle";
import { fetchMetaFirstJoin } from "./itemsMetaJoin";
import { getAuthedUserId } from "./supabaseServiceHelpers";

/*
 * Note tables (#2094, plan Step 3) over items_meta (role `table`) +
 * tables_payload (migration 0040).
 *
 * The note body is the source and these rows follow it. A table becomes an
 * item when it is first tagged (`createNoteTable`); after every note save
 * `syncNoteTables` reads the body and soft-deletes, restores and renames the
 * note's items to match. The DB holds none of that (0040 header: "DB で守らない
 * こと"), which is why it is all here.
 *
 * Every items_meta write is filtered by `role = 'table'` (the #1098 / #1099
 * rule) and moves items_meta.updated_at (DB-Q2 — tables_payload has no cursor).
 *
 * The Trash never lists a table on its own (plan §データの流れ): a table
 * whose note is trashed stays live here and is dropped by the read instead,
 * so restoring the note brings the table back with nothing to undo.
 */
export class SupabaseNoteTablesService implements NoteTablesDataService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * Every live table whose note is live too — what Connect lists. A table in
   * a trashed note is not shown, because opening it would land on a note the
   * user cannot see.
   */
  async fetchNoteTables(): Promise<NoteTable[]> {
    const tables = await fetchMetaFirstJoin<
      ItemsMetaTableRow,
      TablesPayloadRow,
      NoteTable
    >({
      client: this.client,
      role: "table",
      isDeleted: false,
      metaColumns: ITEMS_META_TABLE_COLUMNS,
      metaLabel: "fetchNoteTables items_meta",
      payloadTable: "tables_payload",
      payloadColumns: TABLES_PAYLOAD_COLUMNS,
      payloadLabel: "fetchNoteTables tables_payload",
      toDomain: rowsToNoteTable,
    });
    if (tables.length === 0) return [];

    const parentIds = [...new Set(tables.map((t) => t.parentNoteId))];
    const liveParents = await fetchByIdChunks<{ id: string }>(
      parentIds,
      (chunk) =>
        fetchAllPages(
          (from, to) =>
            this.client
              .from("items_meta")
              .select("id")
              .in("id", chunk)
              .eq("role", "note")
              .eq("is_deleted", false)
              .order("id")
              .range(from, to),
          "fetchNoteTables parent notes",
        ),
    );
    const live = new Set(liveParents.map((p) => p.id));
    return tables.filter((t) => live.has(t.parentNoteId));
  }

  /** Every table item of one note, soft-deleted ones included. */
  async fetchNoteTablesForNote(noteId: string): Promise<NoteTable[]> {
    const payloads = await fetchAllPages<TablesPayloadRow>(
      (from, to) =>
        this.client
          .from("tables_payload")
          .select(TABLES_PAYLOAD_COLUMNS)
          .eq("parent_note_id", noteId)
          .order("item_id")
          .range(from, to),
      "fetchNoteTablesForNote tables_payload",
    );
    if (payloads.length === 0) return [];

    const metas = await fetchByIdChunks<ItemsMetaTableRow>(
      payloads.map((p) => p.item_id),
      (chunk) =>
        fetchAllPages(
          (from, to) =>
            this.client
              .from("items_meta")
              .select(ITEMS_META_TABLE_COLUMNS)
              .in("id", chunk)
              .eq("role", "table")
              .order("id")
              .range(from, to),
          "fetchNoteTablesForNote items_meta",
        ),
    );
    const metaById = new Map(metas.map((m) => [m.id, m]));
    const out: NoteTable[] = [];
    for (const payload of payloads) {
      const meta = metaById.get(payload.item_id);
      if (meta) out.push(rowsToNoteTable(meta, payload));
    }
    return out;
  }

  /**
   * Make a table an item: INSERT items_meta + tables_payload, with R2
   * recovery (the meta row is hard-deleted if the payload INSERT fails), same
   * as createGoal. The caller writes the returned id into the body's
   * `tableId` next; until that save lands, the item is pointed at by nothing
   * and the next `syncNoteTables` of the note soft-deletes it.
   */
  async createNoteTable(input: {
    parentNoteId: string;
    title: string;
  }): Promise<NoteTable> {
    const userId = await getAuthedUserId(this.client);
    const { meta, payload } = noteTableCreateToRows(
      { id: generateId("table"), ...input },
      userId,
    );

    const metaRow = await requireSingleRow<ItemsMetaTableRow>(
      this.client
        .from("items_meta")
        .insert(meta)
        .select(ITEMS_META_TABLE_COLUMNS)
        .single(),
      "createNoteTable items_meta",
    );
    try {
      const payloadRow = await requireSingleRow<TablesPayloadRow>(
        this.client
          .from("tables_payload")
          .insert(payload)
          .select(TABLES_PAYLOAD_COLUMNS)
          .single(),
        "createNoteTable tables_payload",
      );
      return rowsToNoteTable(metaRow, payloadRow);
    } catch (err) {
      await this.client
        .from("items_meta")
        .delete()
        .eq("id", meta.id)
        .eq("role", "table");
      throw err;
    }
  }

  /**
   * Bring one note's table items in line with its just-saved body
   * (`planNoteTableSync` decides; this applies). Run after every save, beside
   * the inline-link sync — a failure leaves the items one save behind, and
   * the next save retries from the body again.
   */
  async syncNoteTables(
    noteId: string,
    content: string,
  ): Promise<NoteTableSyncResult> {
    const items = await this.fetchNoteTablesForNote(noteId);
    const result: NoteTableSyncResult = {
      softDeleted: [],
      restored: [],
      renamed: [],
    };
    if (items.length === 0) return result;

    const plan = planNoteTableSync(collectBodyTables(content), items);
    const now = new Date().toISOString();

    if (plan.softDelete.length > 0) {
      await this.patchTables(
        plan.softDelete,
        { is_deleted: true, deleted_at: now, updated_at: now },
        "syncNoteTables soft delete",
      );
      result.softDeleted = plan.softDelete;
    }
    if (plan.restore.length > 0) {
      await this.patchTables(
        plan.restore,
        { is_deleted: false, deleted_at: null, updated_at: now },
        "syncNoteTables restore",
      );
      result.restored = plan.restore;
    }
    for (const { id, title } of plan.rename) {
      await this.patchTables(
        [id],
        { title, updated_at: now },
        "syncNoteTables rename",
      );
      result.renamed.push(id);
    }
    return result;
  }

  private async patchTables(
    ids: readonly string[],
    patch: Record<string, unknown>,
    label: string,
  ): Promise<void> {
    const { error } = await this.client
      .from("items_meta")
      .update(patch)
      .in("id", [...ids])
      .eq("role", "table");
    if (error) throw new Error(`${label}: ${error.message}`);
  }
}

/**
 * Hard-delete the table items of the given notes. The 0040 parent FK is NO
 * ACTION, so a note with a table item cannot be purged until its tables are
 * (DB-Q3 descendants-first) — `permanentDeleteNoteUnified` calls this before
 * it deletes the notes. tables_payload and the tables' tag assignments go with
 * the items_meta rows (both ON DELETE CASCADE).
 */
export async function purgeNoteTablesOf(
  client: SupabaseClient,
  noteIds: readonly string[],
): Promise<void> {
  if (noteIds.length === 0) return;
  const payloads = await fetchByIdChunks<Pick<TablesPayloadRow, "item_id">>(
    noteIds,
    (chunk) =>
      fetchAllPages(
        (from, to) =>
          client
            .from("tables_payload")
            .select("item_id")
            .in("parent_note_id", chunk)
            .order("item_id")
            .range(from, to),
        "purgeNoteTablesOf tables_payload",
      ),
  );
  if (payloads.length === 0) return;
  const { error } = await client
    .from("items_meta")
    .delete()
    .in(
      "id",
      payloads.map((p) => p.item_id),
    )
    .eq("role", "table");
  if (error) throw new Error(`purgeNoteTablesOf: ${error.message}`);
}

export const PHASE2_NOTE_TABLES_METHOD_NAMES = [
  "fetchNoteTables",
  "fetchNoteTablesForNote",
  "createNoteTable",
  "syncNoteTables",
] as const;

export type NoteTablesMethodName =
  (typeof PHASE2_NOTE_TABLES_METHOD_NAMES)[number];

export const PHASE2_NOTE_TABLES_METHODS: ReadonlySet<string> = new Set(
  PHASE2_NOTE_TABLES_METHOD_NAMES,
);
