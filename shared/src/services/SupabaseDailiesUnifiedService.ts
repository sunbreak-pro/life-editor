import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ITEMS_META_DAILY_COLUMNS,
  DAILIES_PAYLOAD_COLUMNS,
  assertDailyDate,
  dailyNodeToRows,
  dailyUpdatesToPatches,
  rowsToDailyNode,
  type ItemsMetaDailyRow,
  type DailiesPayloadRow,
} from "./dailiesUnifiedMapper";
import type { DailyNode } from "../types/daily";

/*
 * SupabaseDailiesUnifiedService (DU-D Step 2).
 *
 * Daily has no parent/hierarchy concept (1 row per date), so no `move*`
 * method exists. Upsert is keyed by `date` (UNIQUE on dailies_payload —
 * 0008 DD-Q6) rather than `id`: the domain id is `daily-YYYY-MM-DD` which
 * is a function of date, but the DB UNIQUE constraint is on `date` alone
 * (N=1 / no-multitenancy Non-goal).
 */
export class SupabaseDailiesUnifiedService {
  constructor(private readonly client: SupabaseClient) {}

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  async listDailiesUnified(): Promise<DailyNode[]> {
    const { data: metas, error: metaErr } = await this.client
      .from("items_meta")
      .select(ITEMS_META_DAILY_COLUMNS)
      .eq("role", "daily")
      .eq("is_deleted", false);
    if (metaErr)
      throw new Error(`listDailiesUnified meta failed: ${metaErr.message}`);

    const ids = (metas ?? []).map(
      (m) => (m as unknown as ItemsMetaDailyRow).id,
    );
    if (ids.length === 0) return [];

    const { data: payloads, error: payErr } = await this.client
      .from("dailies_payload")
      .select(DAILIES_PAYLOAD_COLUMNS)
      .in("item_id", ids);
    if (payErr)
      throw new Error(`listDailiesUnified payload failed: ${payErr.message}`);

    const payloadById = new Map<string, DailiesPayloadRow>();
    for (const p of payloads ?? []) {
      const row = p as unknown as DailiesPayloadRow;
      payloadById.set(row.item_id, row);
    }

    const out: DailyNode[] = [];
    for (const m of metas ?? []) {
      const meta = m as unknown as ItemsMetaDailyRow;
      const payload = payloadById.get(meta.id);
      if (!payload) continue;
      out.push(rowsToDailyNode(meta, payload));
    }
    return out;
  }

  async getDailyByDateUnified(date: string): Promise<DailyNode | null> {
    assertDailyDate(date);
    // dailies_payload.date is UNIQUE — lookup payload first, then meta.
    const { data: payload, error: payErr } = await this.client
      .from("dailies_payload")
      .select(DAILIES_PAYLOAD_COLUMNS)
      .eq("date", date)
      .maybeSingle();
    if (payErr)
      throw new Error(
        `getDailyByDateUnified payload failed: ${payErr.message}`,
      );
    if (!payload) return null;

    const payloadRow = payload as unknown as DailiesPayloadRow;
    const { data: meta, error: metaErr } = await this.client
      .from("items_meta")
      .select(ITEMS_META_DAILY_COLUMNS)
      .eq("id", payloadRow.item_id)
      .eq("role", "daily")
      .maybeSingle();
    if (metaErr)
      throw new Error(`getDailyByDateUnified meta failed: ${metaErr.message}`);
    if (!meta) return null;

    return rowsToDailyNode(meta as unknown as ItemsMetaDailyRow, payloadRow);
  }

  // -------------------------------------------------------------------------
  // Upsert (the primary write path for Daily)
  // -------------------------------------------------------------------------

  /**
   * Upsert a Daily by date. If a row exists, update content; otherwise
   * insert items_meta + dailies_payload. The id follows the
   * `daily-YYYY-MM-DD` convention (CLAUDE.md §4.3) so multiple clients
   * generate the same id for the same date — no UNIQUE collision risk on
   * items_meta(id) PK.
   */
  async upsertDailyByDateUnified(
    date: string,
    content: string,
  ): Promise<DailyNode> {
    assertDailyDate(date);
    const existing = await this.getDailyByDateUnified(date);
    if (existing) {
      return this.updateDailyUnified(existing.id, { content });
    }
    const now = new Date().toISOString();
    const node: DailyNode = {
      id: `daily-${date}`,
      date,
      content,
      createdAt: now,
      updatedAt: now,
    };
    return this.createDailyUnified(node);
  }

  // -------------------------------------------------------------------------
  // Create (internal; upsertDailyByDateUnified is the public path)
  // -------------------------------------------------------------------------

  async createDailyUnified(node: DailyNode): Promise<DailyNode> {
    const userPlaceholder = "00000000-0000-0000-0000-000000000000";
    const { meta, payload } = dailyNodeToRows(node, userPlaceholder);

    const metaInsert: Record<string, unknown> = { ...meta };
    delete metaInsert.user_id;
    const payloadInsert: Record<string, unknown> = { ...payload };
    delete payloadInsert.user_id;

    const { error: metaErr } = await this.client
      .from("items_meta")
      .insert(metaInsert);
    if (metaErr)
      throw new Error(`createDailyUnified meta failed: ${metaErr.message}`);

    const { error: payErr } = await this.client
      .from("dailies_payload")
      .insert(payloadInsert);
    if (payErr) {
      await this.client.from("items_meta").delete().eq("id", node.id);
      throw new Error(`createDailyUnified payload failed: ${payErr.message}`);
    }

    const created = await this.getDailyByDateUnified(node.date);
    if (!created)
      throw new Error(
        `createDailyUnified: row vanished after insert (date="${node.date}")`,
      );
    return created;
  }

  async updateDailyUnified(
    id: string,
    updates: Partial<DailyNode>,
  ): Promise<DailyNode> {
    const now = new Date().toISOString();
    const userPlaceholder = "00000000-0000-0000-0000-000000000000";
    const { metaPatch, payloadPatch } = dailyUpdatesToPatches(
      updates,
      userPlaceholder,
      now,
    );

    const { error: metaErr } = await this.client
      .from("items_meta")
      .update(metaPatch)
      .eq("id", id)
      .eq("role", "daily");
    if (metaErr)
      throw new Error(`updateDailyUnified meta failed: ${metaErr.message}`);

    if (Object.keys(payloadPatch).length > 0) {
      const { error: payErr } = await this.client
        .from("dailies_payload")
        .update(payloadPatch)
        .eq("item_id", id);
      if (payErr)
        throw new Error(`updateDailyUnified payload failed: ${payErr.message}`);
    }

    // Lookup by id (not date) so the caller doesn't need to thread date.
    const { data: meta, error: lookupMetaErr } = await this.client
      .from("items_meta")
      .select(ITEMS_META_DAILY_COLUMNS)
      .eq("id", id)
      .eq("role", "daily")
      .maybeSingle();
    if (lookupMetaErr)
      throw new Error(
        `updateDailyUnified re-read meta failed: ${lookupMetaErr.message}`,
      );
    if (!meta)
      throw new Error(
        `updateDailyUnified: row vanished after update (id="${id}")`,
      );

    const { data: payload, error: lookupPayErr } = await this.client
      .from("dailies_payload")
      .select(DAILIES_PAYLOAD_COLUMNS)
      .eq("item_id", id)
      .maybeSingle();
    if (lookupPayErr)
      throw new Error(
        `updateDailyUnified re-read payload failed: ${lookupPayErr.message}`,
      );
    if (!payload)
      throw new Error(`updateDailyUnified: payload vanished (id="${id}")`);

    return rowsToDailyNode(
      meta as unknown as ItemsMetaDailyRow,
      payload as unknown as DailiesPayloadRow,
    );
  }

  // -------------------------------------------------------------------------
  // Delete (soft)
  // -------------------------------------------------------------------------

  async softDeleteDailyUnified(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("items_meta")
      .update({ is_deleted: true, deleted_at: now, updated_at: now })
      .eq("id", id)
      .eq("role", "daily");
    if (error)
      throw new Error(`softDeleteDailyUnified failed: ${error.message}`);
  }
}

export const PHASE2_DAILIES_UNIFIED_METHODS: ReadonlySet<string> = new Set([
  "listDailiesUnified",
  "getDailyByDateUnified",
  "upsertDailyByDateUnified",
  "createDailyUnified",
  "updateDailyUnified",
  "softDeleteDailyUnified",
]);
