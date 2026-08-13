import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailiesUnifiedDataService } from "./DataService";
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
import { fetchMetaFirstJoin } from "./itemsMetaJoin";
import { livePayloadInnerJoin } from "./supabaseServiceHelpers";
import { ItemLockGate, nextItemVersion } from "./itemLockGate";
import { fetchMaybeSingleRow } from "./postgrestSingle";

/*
 * SupabaseDailiesUnifiedService (DU-D Step 2).
 *
 * Daily has no parent/hierarchy concept (1 row per date), so no `move*`
 * method exists. Upsert is keyed by `date` (UNIQUE on dailies_payload —
 * 0008 DD-Q6) rather than `id`: the domain id is `daily-YYYY-MM-DD` which
 * is a function of date, but the DB UNIQUE constraint is on `date` alone
 * (N=1 / no-multitenancy Non-goal).
 */
export class SupabaseDailiesUnifiedService implements DailiesUnifiedDataService {
  /**
   * Password gate + edit lock (#674 / C7). The six methods used to be a
   * line-for-line clone of SupabaseNotesUnifiedLock; both now bind the shared
   * `ItemLockGate` and differ only in the values passed here.
   */
  private readonly lock: ItemLockGate<DailyNode>;

  constructor(private readonly client: SupabaseClient) {
    this.lock = new ItemLockGate<DailyNode>({
      client,
      role: "daily",
      payloadTable: "dailies_payload",
      readBack: (id, label) => this.readBackById(id, label),
      assertId: assertDailyId,
      labels: {
        setPassword: "setDailyPasswordUnified",
        removePassword: "removeDailyPasswordUnified",
        verifyPassword: "verifyDailyPasswordUnified",
        lazyRehash: "lazyRehashDailyPassword",
        toggleEditLock: "toggleDailyEditLockUnified",
      },
    });
  }

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  async listDailiesUnified(): Promise<DailyNode[]> {
    return this.listByDeletedBucket(false, "listDailiesUnified");
  }

  /**
   * Count live dailies without pulling a single row (#511). Same shape and
   * rationale as SupabaseTodosService.countUnfinishedTodos — see that
   * method for why `head: true` and the `!inner` join are used.
   *
   * No legacy-folder clause here: Daily is flat (1 row per date), so
   * dailies_payload has no note_type/task_type column to exclude. The
   * payload join alone matches listDailiesUnified's `if (!payload)
   * continue`.
   */
  async countLiveDailies(): Promise<number> {
    const { count, error } = await this.client
      .from("items_meta")
      .select(
        `id, ${livePayloadInnerJoin(
          "dailies_payload",
          "dailies_payload_item_id_fkey",
        )}`,
        { count: "exact", head: true },
      )
      .eq("role", "daily")
      .eq("is_deleted", false);
    if (error) throw new Error(`countLiveDailies failed: ${error.message}`);
    return count ?? 0;
  }

  async getDailyByDateUnified(date: string): Promise<DailyNode | null> {
    assertDailyDate(date);
    // dailies_payload.date is UNIQUE — lookup payload first, then meta.
    const payloadRow = await fetchMaybeSingleRow<DailiesPayloadRow>(
      this.client
        .from("dailies_payload")
        .select(DAILIES_PAYLOAD_COLUMNS)
        .eq("date", date)
        .maybeSingle(),
      "getDailyByDateUnified payload failed",
    );
    if (!payloadRow) return null;

    const meta = await fetchMaybeSingleRow<ItemsMetaDailyRow>(
      this.client
        .from("items_meta")
        .select(ITEMS_META_DAILY_COLUMNS)
        .eq("id", payloadRow.item_id)
        .eq("role", "daily")
        .maybeSingle(),
      "getDailyByDateUnified meta failed",
    );
    if (!meta) return null;

    return rowsToDailyNode(meta, payloadRow);
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
    const meta = await fetchMaybeSingleRow<ItemsMetaDailyRow>(
      this.client
        .from("items_meta")
        .select(ITEMS_META_DAILY_COLUMNS)
        .eq("id", id)
        .eq("role", "daily")
        .maybeSingle(),
      "updateDailyUnified re-read meta failed",
    );
    if (!meta)
      throw new Error(
        `updateDailyUnified: row vanished after update (id="${id}")`,
      );

    const payload = await fetchMaybeSingleRow<DailiesPayloadRow>(
      this.client
        .from("dailies_payload")
        .select(DAILIES_PAYLOAD_COLUMNS)
        .eq("item_id", id)
        .maybeSingle(),
      "updateDailyUnified re-read payload failed",
    );
    if (!payload)
      throw new Error(`updateDailyUnified: payload vanished (id="${id}")`);

    return rowsToDailyNode(meta, payload);
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
    // Trailing .order("id") (added by the shared join) = unique tiebreaker for
    // deterministic pages, after the deleted_at DESC ordering asked for here.
    return this.listByDeletedBucket(true, "fetchDeletedDailiesUnified");
  }

  /**
   * Shared body of the two list reads (#674 / C7): the items_meta +
   * dailies_payload join for one `is_deleted` bucket. `label` reproduces each
   * caller's own error strings verbatim.
   */
  private listByDeletedBucket(
    isDeleted: boolean,
    label: string,
  ): Promise<DailyNode[]> {
    return fetchMetaFirstJoin<ItemsMetaDailyRow, DailiesPayloadRow, DailyNode>({
      client: this.client,
      role: "daily",
      isDeleted,
      metaColumns: ITEMS_META_DAILY_COLUMNS,
      metaLabel: `${label} meta failed`,
      // Trash orders by deleted_at DESC ("most recently trashed first").
      metaOrderBy: isDeleted
        ? [{ column: "deleted_at", ascending: false }]
        : undefined,
      payloadTable: "dailies_payload",
      payloadColumns: DAILIES_PAYLOAD_COLUMNS,
      payloadLabel: `${label} payload failed`,
      toDomain: rowsToDailyNode,
    });
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
  // Password gate (DU-G G2 / hardened for Issue #118)
  //
  // password_hash now stores a PBKDF2-HMAC-SHA256 derivation
  // (`pbkdf2$v1$...`, see utils/passwordHash.ts), NOT plaintext. Legacy
  // plaintext rows (pre-#118, old known-issues 027) are still accepted by
  // verify and lazily rehashed into PBKDF2 form on the next successful
  // unlock. The DAILIES_PAYLOAD_COLUMNS SELECT list still omits
  // `password_hash`, so the raw value never crosses the public SELECT path;
  // only verifyDailyPasswordUnified projects the single column. RLS scopes
  // every read to auth.uid()'s rows. `has_password` is the generated stored
  // boolean projected back to the client (true for a hash string as well).
  // -------------------------------------------------------------------------

  /**
   * Hash `password` (PBKDF2, Issue #118) and write it into dailies_payload.
   * DailyNode round-trip done via id-based re-read so the GENERATED
   * `has_password` column reflects on the returned domain object. Bumps
   * items_meta.updated_at + version so Sync LWW propagates.
   */
  setDailyPasswordUnified(id: string, password: string): Promise<DailyNode> {
    return this.lock.setPassword(id, password);
  }

  /**
   * Verify-then-clear. A wrong currentPassword must NOT mutate the row, so
   * verify is the first step and rejects on mismatch (Notes G1 parity).
   * Verify hashes via PBKDF2 (Issue #118); a legacy plaintext match is
   * lazily rehashed inside verify before the row is cleared here.
   */
  removeDailyPasswordUnified(
    id: string,
    currentPassword: string,
  ): Promise<DailyNode> {
    return this.lock.removePassword(id, currentPassword);
  }

  /**
   * Verify `password` against the stored PBKDF2 hash (Issue #118). SELECTs
   * password_hash from dailies_payload (RLS scopes to auth.uid()'s rows).
   * Returns `false` when no hash is set OR the row does not exist
   * (maybeSingle -> null). A legacy plaintext row that matches is lazily
   * rehashed into PBKDF2 form (best-effort — see itemLockGate's lazyRehash).
   */
  verifyDailyPasswordUnified(id: string, password: string): Promise<boolean> {
    return this.lock.verifyPassword(id, password);
  }

  // -------------------------------------------------------------------------
  // Edit lock (DU-G G2)
  // -------------------------------------------------------------------------

  /**
   * Flip dailies_payload.is_edit_locked. Read-modify-write because PostgREST
   * cannot express the SQLite `CASE WHEN ... END` in one statement. Bumps
   * items_meta.updated_at + version so Sync LWW propagates.
   */
  toggleDailyEditLockUnified(id: string): Promise<DailyNode> {
    return this.lock.toggleEditLock(id);
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
    const meta = await fetchMaybeSingleRow<ItemsMetaDailyRow>(
      this.client
        .from("items_meta")
        .select(ITEMS_META_DAILY_COLUMNS)
        .eq("id", id)
        .eq("role", "daily")
        .maybeSingle(),
      `${label} re-read meta failed`,
    );
    if (!meta)
      throw new Error(`${label}: row vanished after update (id="${id}")`);

    const payload = await fetchMaybeSingleRow<DailiesPayloadRow>(
      this.client
        .from("dailies_payload")
        .select(DAILIES_PAYLOAD_COLUMNS)
        .eq("item_id", id)
        .maybeSingle(),
      `${label} re-read payload failed`,
    );
    if (!payload) throw new Error(`${label}: payload vanished (id="${id}")`);

    return rowsToDailyNode(meta, payload);
  }

  /**
   * Read current items_meta.version and return version + 1. Thin binding of
   * the shared `nextItemVersion` (#674 / C7) — kept as a method because
   * `restoreDailyUnified` bumps the version outside the lock gate.
   */
  private nextVersion(id: string, label: string): Promise<number> {
    return nextItemVersion(this.client, "daily", id, label);
  }
}

export const PHASE2_DAILIES_UNIFIED_METHOD_NAMES = [
  "listDailiesUnified",
  "countLiveDailies",
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
] as const;

export type DailiesUnifiedMethodName =
  (typeof PHASE2_DAILIES_UNIFIED_METHOD_NAMES)[number];

export const PHASE2_DAILIES_UNIFIED_METHODS: ReadonlySet<string> = new Set(
  PHASE2_DAILIES_UNIFIED_METHOD_NAMES,
);
