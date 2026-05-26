import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ITEMS_META_DAILY_COLUMNS,
  DAILIES_PAYLOAD_COLUMNS,
  assertDailyDate,
  assertDailyId,
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

  // -------------------------------------------------------------------------
  // Trash (DU-G G2)
  // -------------------------------------------------------------------------

  /**
   * List soft-deleted dailies (role='daily' AND is_deleted=true). Same 2-query
   * meta+payload in-memory join as listDailiesUnified — but with the deleted
   * filter flipped so the Trash view can populate. Ordered by deleted_at DESC
   * at the items_meta layer ("most-recently trashed first" — parity with the
   * Notes G1 ordering policy and the legacy `dailies` query).
   *
   * Daily has no hierarchy so descendants / cycle-guard are unneeded (unlike
   * Notes G1 — see SupabaseNotesUnifiedService.permanentDeleteNoteUnified).
   */
  async fetchDeletedDailiesUnified(): Promise<DailyNode[]> {
    const { data: metas, error: metaErr } = await this.client
      .from("items_meta")
      .select(ITEMS_META_DAILY_COLUMNS)
      .eq("role", "daily")
      .eq("is_deleted", true)
      .order("deleted_at", { ascending: false });
    if (metaErr)
      throw new Error(
        `fetchDeletedDailiesUnified meta failed: ${metaErr.message}`,
      );

    const ids = (metas ?? []).map(
      (m) => (m as unknown as ItemsMetaDailyRow).id,
    );
    if (ids.length === 0) return [];

    const { data: payloads, error: payErr } = await this.client
      .from("dailies_payload")
      .select(DAILIES_PAYLOAD_COLUMNS)
      .in("item_id", ids);
    if (payErr)
      throw new Error(
        `fetchDeletedDailiesUnified payload failed: ${payErr.message}`,
      );

    const payloadById = new Map<string, DailiesPayloadRow>();
    for (const p of payloads ?? []) {
      const row = p as unknown as DailiesPayloadRow;
      payloadById.set(row.item_id, row);
    }

    const out: DailyNode[] = [];
    for (const m of metas ?? []) {
      const meta = m as unknown as ItemsMetaDailyRow;
      const payload = payloadById.get(meta.id);
      if (!payload) continue; // orphan meta — skip rather than throw
      out.push(rowsToDailyNode(meta, payload));
    }
    return out;
  }

  /**
   * Reverse a soft-delete. Clears items_meta.is_deleted / deleted_at and
   * bumps updated_at + version so Sync LWW propagates the restore. Mirrors
   * Notes G1 restoreNoteUnified (single-row); Daily has no descendants so
   * no subtree consideration.
   */
  async restoreDailyUnified(id: string): Promise<void> {
    assertDailyId(id);
    const now = new Date().toISOString();
    const nextVersion = await this.nextVersion(id, "restoreDailyUnified");
    const { error } = await this.client
      .from("items_meta")
      .update({
        is_deleted: false,
        deleted_at: null,
        updated_at: now,
        version: nextVersion,
      })
      .eq("id", id)
      .eq("role", "daily");
    if (error) throw new Error(`restoreDailyUnified failed: ${error.message}`);
  }

  /**
   * Hard-delete from items_meta. dailies_payload is cleaned up automatically
   * by the 0008 `ON DELETE CASCADE` FK (`dailies_payload.item_id ->
   * items_meta(id)`). Daily has no children (1 row per date, no parent
   * column), so the descendants/cycle-guard loop used by
   * permanentDeleteNoteUnified is intentionally absent here.
   */
  async permanentDeleteDailyUnified(id: string): Promise<void> {
    assertDailyId(id);
    const { error } = await this.client
      .from("items_meta")
      .delete()
      .eq("id", id)
      .eq("role", "daily");
    if (error)
      throw new Error(`permanentDeleteDailyUnified failed: ${error.message}`);
  }

  // -------------------------------------------------------------------------
  // Password gate (DU-G G2)
  //
  // SECURITY DEBT (carried from legacy / Notes G1 parity): the
  // `password_hash` column stores PLAINTEXT (bcrypt / argon2 not applied).
  // The DAILIES_PAYLOAD_COLUMNS SELECT list deliberately omits
  // `password_hash`, so the raw value never crosses the public SELECT path;
  // only verifyDailyPasswordUnified projects the single column. RLS scopes
  // every read to auth.uid()'s rows. `has_password` is the generated stored
  // boolean projected back to the client.
  //
  // Tracking: docs/known-issues/027 (Notes/Daily password plaintext debt).
  // Must be replaced with a real hash before the N>1 Cloud Sync expansion.
  // -------------------------------------------------------------------------

  /**
   * Write password_hash into dailies_payload. DailyNode round-trip done via
   * id-based re-read so the GENERATED `has_password` column reflects on the
   * returned domain object. Bumps items_meta.updated_at + version so Sync
   * LWW propagates.
   *
   * SECURITY DEBT: plaintext storage. See known-issues 027.
   */
  async setDailyPasswordUnified(
    id: string,
    password: string,
  ): Promise<DailyNode> {
    assertDailyId(id);
    const now = new Date().toISOString();
    const nextVersion = await this.nextVersion(id, "setDailyPasswordUnified");

    const { error: metaErr } = await this.client
      .from("items_meta")
      .update({ updated_at: now, version: nextVersion })
      .eq("id", id)
      .eq("role", "daily");
    if (metaErr)
      throw new Error(
        `setDailyPasswordUnified meta failed: ${metaErr.message}`,
      );

    const { error: payErr } = await this.client
      .from("dailies_payload")
      .update({ password_hash: password })
      .eq("item_id", id);
    if (payErr)
      throw new Error(
        `setDailyPasswordUnified payload failed: ${payErr.message}`,
      );

    return this.readBackById(id, "setDailyPasswordUnified");
  }

  /**
   * Verify-then-clear. A wrong currentPassword must NOT mutate the row, so
   * verify is the first step and rejects on mismatch (Notes G1 parity).
   *
   * SECURITY DEBT: plaintext eq. See known-issues 027.
   */
  async removeDailyPasswordUnified(
    id: string,
    currentPassword: string,
  ): Promise<DailyNode> {
    assertDailyId(id);
    const valid = await this.verifyDailyPasswordUnified(id, currentPassword);
    if (!valid) throw new Error("Invalid password");

    const now = new Date().toISOString();
    const nextVersion = await this.nextVersion(
      id,
      "removeDailyPasswordUnified",
    );

    const { error: metaErr } = await this.client
      .from("items_meta")
      .update({ updated_at: now, version: nextVersion })
      .eq("id", id)
      .eq("role", "daily");
    if (metaErr)
      throw new Error(
        `removeDailyPasswordUnified meta failed: ${metaErr.message}`,
      );

    const { error: payErr } = await this.client
      .from("dailies_payload")
      .update({ password_hash: null })
      .eq("item_id", id);
    if (payErr)
      throw new Error(
        `removeDailyPasswordUnified payload failed: ${payErr.message}`,
      );

    return this.readBackById(id, "removeDailyPasswordUnified");
  }

  /**
   * Plaintext equality. SELECTs password_hash from dailies_payload (RLS
   * scopes to auth.uid()'s rows). Returns `false` when no hash is set OR
   * the row does not exist (maybeSingle -> null).
   *
   * SECURITY DEBT: plaintext eq. See known-issues 027.
   */
  async verifyDailyPasswordUnified(
    id: string,
    password: string,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from("dailies_payload")
      .select("password_hash")
      .eq("item_id", id)
      .maybeSingle();
    if (error)
      throw new Error(`verifyDailyPasswordUnified failed: ${error.message}`);
    const hash = (data as { password_hash: string | null } | null)
      ?.password_hash;
    return hash != null && hash === password;
  }

  // -------------------------------------------------------------------------
  // Edit lock (DU-G G2)
  // -------------------------------------------------------------------------

  /**
   * Flip dailies_payload.is_edit_locked. Read-modify-write because PostgREST
   * cannot express the SQLite `CASE WHEN ... END` in one statement. Bumps
   * items_meta.updated_at + version so Sync LWW propagates.
   */
  async toggleDailyEditLockUnified(id: string): Promise<DailyNode> {
    assertDailyId(id);
    const { data: cur, error: readErr } = await this.client
      .from("dailies_payload")
      .select("is_edit_locked")
      .eq("item_id", id)
      .single();
    if (readErr)
      throw new Error(
        `toggleDailyEditLockUnified read failed: ${readErr.message}`,
      );
    const next = !(cur as { is_edit_locked: boolean }).is_edit_locked;

    const now = new Date().toISOString();
    const nextVersion = await this.nextVersion(
      id,
      "toggleDailyEditLockUnified",
    );

    const { error: metaErr } = await this.client
      .from("items_meta")
      .update({ updated_at: now, version: nextVersion })
      .eq("id", id)
      .eq("role", "daily");
    if (metaErr)
      throw new Error(
        `toggleDailyEditLockUnified meta failed: ${metaErr.message}`,
      );

    const { error: payErr } = await this.client
      .from("dailies_payload")
      .update({ is_edit_locked: next })
      .eq("item_id", id);
    if (payErr)
      throw new Error(
        `toggleDailyEditLockUnified payload failed: ${payErr.message}`,
      );

    return this.readBackById(id, "toggleDailyEditLockUnified");
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Read items_meta + dailies_payload by id and stitch into DailyNode. Used
   * by the password / lock paths so the returned domain object reflects the
   * latest GENERATED `has_password` + flipped flags. getDailyByDateUnified
   * keys by date — these mutators key by id, so we cannot reuse it directly.
   */
  private async readBackById(id: string, label: string): Promise<DailyNode> {
    const { data: meta, error: metaErr } = await this.client
      .from("items_meta")
      .select(ITEMS_META_DAILY_COLUMNS)
      .eq("id", id)
      .eq("role", "daily")
      .maybeSingle();
    if (metaErr)
      throw new Error(`${label} re-read meta failed: ${metaErr.message}`);
    if (!meta)
      throw new Error(`${label}: row vanished after update (id="${id}")`);

    const { data: payload, error: payErr } = await this.client
      .from("dailies_payload")
      .select(DAILIES_PAYLOAD_COLUMNS)
      .eq("item_id", id)
      .maybeSingle();
    if (payErr)
      throw new Error(`${label} re-read payload failed: ${payErr.message}`);
    if (!payload)
      throw new Error(`${label}: payload vanished (id="${id}")`);

    return rowsToDailyNode(
      meta as unknown as ItemsMetaDailyRow,
      payload as unknown as DailiesPayloadRow,
    );
  }

  /**
   * Read current items_meta.version and return version + 1. Mirrors the
   * Notes G1 `nextVersion` helper. A missing row throws (caller invariant:
   * the row exists; this helper only runs from password/lock/restore paths
   * where the caller has already located the daily by id).
   */
  private async nextVersion(id: string, label: string): Promise<number> {
    const { data, error } = await this.client
      .from("items_meta")
      .select("version")
      .eq("id", id)
      .eq("role", "daily")
      .single();
    if (error) throw new Error(`${label} version read: ${error.message}`);
    const row = data as { version: number | null };
    return (row?.version ?? 0) + 1;
  }
}

export const PHASE2_DAILIES_UNIFIED_METHODS: ReadonlySet<string> = new Set([
  "listDailiesUnified",
  "getDailyByDateUnified",
  "upsertDailyByDateUnified",
  "createDailyUnified",
  "updateDailyUnified",
  "softDeleteDailyUnified",
  // DU-G G2
  "fetchDeletedDailiesUnified",
  "restoreDailyUnified",
  "permanentDeleteDailyUnified",
  "setDailyPasswordUnified",
  "removeDailyPasswordUnified",
  "verifyDailyPasswordUnified",
  "toggleDailyEditLockUnified",
]);
