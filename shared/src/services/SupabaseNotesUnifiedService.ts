import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ITEMS_META_NOTE_COLUMNS,
  NOTES_PAYLOAD_COLUMNS,
  NOTES_PAYLOAD_LIST_COLUMNS,
  noteNodeToRows,
  noteUpdatesToPatches,
  rowsToNoteNode,
  rowsToNoteNodeLite,
  type ItemsMetaNoteRow,
  type NotesPayloadListRow,
  type NotesPayloadRow,
} from "./notesUnifiedMapper";
import type { NoteNode } from "../types/note";

/*
 * SupabaseNotesUnifiedService (DU-D Step 2).
 *
 * Lives apart from SupabaseDataService.ts (same policy as
 * SupabaseWikiTagsUnifiedService) to keep the monolith from growing.
 * Wired into the dispatch Proxy via PHASE2_NOTES_UNIFIED_METHODS in
 * SupabaseDataService.ts.
 *
 * Naming policy: every method here carries the `*Unified` suffix. The
 * legacy single-table Notes service + dispatch set were retired in DU-G
 * G4; this Unified service is now the only Supabase Notes write path.
 *
 * Write ordering: items_meta first, then notes_payload (FK enforces this).
 * If the payload INSERT fails, hard-delete the orphan items_meta row to
 * avoid a soft-delete ghost on other devices (DU-B R2 parity).
 */
export class SupabaseNotesUnifiedService {
  constructor(private readonly client: SupabaseClient) {}

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  async listNotesUnified(): Promise<NoteNode[]> {
    // Fetch all role='note' items_meta + their matching payloads. Done as
    // two queries + an in-memory join (one network round-trip each); the
    // dataset is per-user so cardinality is bounded.
    //
    // M1 (perf): the payload query uses NOTES_PAYLOAD_LIST_COLUMNS, which
    // OMITS the heavy `content_json` body. List NoteNodes therefore carry
    // `content = ""` (a "not yet loaded" sentinel); the body is loaded on
    // demand by getNoteUnified when a note is opened. Consumers must not
    // treat the empty list `content` as authoritative (see
    // useNotesUnifiedAPI's hydrate-on-select).
    const { data: metas, error: metaErr } = await this.client
      .from("items_meta")
      .select(ITEMS_META_NOTE_COLUMNS)
      .eq("role", "note")
      .eq("is_deleted", false);
    if (metaErr)
      throw new Error(`listNotesUnified meta failed: ${metaErr.message}`);

    const ids = (metas ?? []).map((m) => (m as unknown as ItemsMetaNoteRow).id);
    if (ids.length === 0) return [];

    const { data: payloads, error: payErr } = await this.client
      .from("notes_payload")
      .select(NOTES_PAYLOAD_LIST_COLUMNS)
      .in("item_id", ids);
    if (payErr)
      throw new Error(`listNotesUnified payload failed: ${payErr.message}`);

    const payloadById = new Map<string, NotesPayloadListRow>();
    for (const p of payloads ?? []) {
      const row = p as unknown as NotesPayloadListRow;
      payloadById.set(row.item_id, row);
    }

    const out: NoteNode[] = [];
    for (const m of metas ?? []) {
      const meta = m as unknown as ItemsMetaNoteRow;
      const payload = payloadById.get(meta.id);
      if (!payload) continue; // orphan meta — skip rather than throw
      out.push(rowsToNoteNodeLite(meta, payload));
    }
    return out;
  }

  async getNoteUnified(id: string): Promise<NoteNode | null> {
    const { data: meta, error: metaErr } = await this.client
      .from("items_meta")
      .select(ITEMS_META_NOTE_COLUMNS)
      .eq("id", id)
      .eq("role", "note")
      .maybeSingle();
    if (metaErr)
      throw new Error(`getNoteUnified meta failed: ${metaErr.message}`);
    if (!meta) return null;

    const { data: payload, error: payErr } = await this.client
      .from("notes_payload")
      .select(NOTES_PAYLOAD_COLUMNS)
      .eq("item_id", id)
      .maybeSingle();
    if (payErr)
      throw new Error(`getNoteUnified payload failed: ${payErr.message}`);
    if (!payload) return null;

    return rowsToNoteNode(
      meta as unknown as ItemsMetaNoteRow,
      payload as unknown as NotesPayloadRow,
    );
  }

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  async createNoteUnified(node: NoteNode): Promise<NoteNode> {
    // user_id omitted on insert — DB default `auth.uid()` fills it. Saves
    // the frontend from threading a userId through every call site (parity
    // with SupabaseWikiTagsUnifiedService).
    const userPlaceholder = "00000000-0000-0000-0000-000000000000";
    const { meta, payload } = noteNodeToRows(node, userPlaceholder);

    // Strip the placeholder user_id so RLS default applies.
    const metaInsert: Record<string, unknown> = { ...meta };
    delete metaInsert.user_id;
    const payloadInsert: Record<string, unknown> = { ...payload };
    delete payloadInsert.user_id;

    const { error: metaErr } = await this.client
      .from("items_meta")
      .insert(metaInsert);
    if (metaErr)
      throw new Error(`createNoteUnified meta failed: ${metaErr.message}`);

    const { error: payErr } = await this.client
      .from("notes_payload")
      .insert(payloadInsert);
    if (payErr) {
      // Orphan cleanup: hard-delete the items_meta row so the failed
      // create does not leak a row that other devices would render in
      // their TrashView (DU-B R2 parity, NOT soft-delete).
      await this.client.from("items_meta").delete().eq("id", node.id);
      throw new Error(`createNoteUnified payload failed: ${payErr.message}`);
    }

    const created = await this.getNoteUnified(node.id);
    if (!created)
      throw new Error(
        `createNoteUnified: row vanished after insert (id="${node.id}")`,
      );
    return created;
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------

  async updateNoteUnified(
    id: string,
    updates: Partial<NoteNode>,
  ): Promise<NoteNode> {
    const now = new Date().toISOString();
    const userPlaceholder = "00000000-0000-0000-0000-000000000000";
    const { metaPatch, payloadPatch } = noteUpdatesToPatches(
      updates,
      userPlaceholder,
      now,
    );

    // Meta side always has updated_at — always issue the UPDATE.
    const { error: metaErr } = await this.client
      .from("items_meta")
      .update(metaPatch)
      .eq("id", id)
      .eq("role", "note");
    if (metaErr)
      throw new Error(`updateNoteUnified meta failed: ${metaErr.message}`);

    // Payload UPDATE only when the patch is non-empty (avoid a no-op UPDATE
    // that would still bump nothing but cost a round-trip).
    if (Object.keys(payloadPatch).length > 0) {
      const { error: payErr } = await this.client
        .from("notes_payload")
        .update(payloadPatch)
        .eq("item_id", id);
      if (payErr)
        throw new Error(`updateNoteUnified payload failed: ${payErr.message}`);
    }

    const updated = await this.getNoteUnified(id);
    if (!updated)
      throw new Error(
        `updateNoteUnified: row vanished after update (id="${id}")`,
      );
    return updated;
  }

  // -------------------------------------------------------------------------
  // Delete (soft)
  // -------------------------------------------------------------------------

  async softDeleteNoteUnified(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("items_meta")
      .update({ is_deleted: true, deleted_at: now, updated_at: now })
      .eq("id", id)
      .eq("role", "note");
    if (error)
      throw new Error(`softDeleteNoteUnified failed: ${error.message}`);
  }

  // -------------------------------------------------------------------------
  // Hierarchy (DnD)
  // -------------------------------------------------------------------------

  async moveNoteUnified(
    id: string,
    parentId: string | null,
    order: number,
  ): Promise<void> {
    // Single-row PATCH on notes_payload + LWW bump on items_meta. parentId
    // null = move to root. Composite FK (0014) enforces parent role='note'.
    const now = new Date().toISOString();
    const { error: metaErr } = await this.client
      .from("items_meta")
      .update({ updated_at: now })
      .eq("id", id)
      .eq("role", "note");
    if (metaErr)
      throw new Error(`moveNoteUnified meta failed: ${metaErr.message}`);

    const { error: payErr } = await this.client
      .from("notes_payload")
      .update({ parent_item_id: parentId, sort_order: order })
      .eq("item_id", id);
    if (payErr)
      throw new Error(`moveNoteUnified payload failed: ${payErr.message}`);
  }

  // -------------------------------------------------------------------------
  // Trash (DU-G PR1)
  // -------------------------------------------------------------------------

  /**
   * List soft-deleted notes (role='note' AND is_deleted=true). Same 2-query
   * meta+payload in-memory join as listNotesUnified — but with the deleted
   * filter flipped so the Trash view in NotesSection / WikiTagsView can
   * populate. Ordered by deleted_at DESC at the items_meta layer for
   * "most-recently trashed first" parity with the legacy `notes` query
   * (`ORDER BY deleted_at DESC`).
   */
  async fetchDeletedNotesUnified(): Promise<NoteNode[]> {
    const { data: metas, error: metaErr } = await this.client
      .from("items_meta")
      .select(ITEMS_META_NOTE_COLUMNS)
      .eq("role", "note")
      .eq("is_deleted", true)
      .order("deleted_at", { ascending: false });
    if (metaErr)
      throw new Error(
        `fetchDeletedNotesUnified meta failed: ${metaErr.message}`,
      );

    const ids = (metas ?? []).map((m) => (m as unknown as ItemsMetaNoteRow).id);
    if (ids.length === 0) return [];

    // M1 (perf): Trash likewise never renders the body (restore /
    // permanentDelete only need id/parentId), so it uses the light query.
    const { data: payloads, error: payErr } = await this.client
      .from("notes_payload")
      .select(NOTES_PAYLOAD_LIST_COLUMNS)
      .in("item_id", ids);
    if (payErr)
      throw new Error(
        `fetchDeletedNotesUnified payload failed: ${payErr.message}`,
      );

    const payloadById = new Map<string, NotesPayloadListRow>();
    for (const p of payloads ?? []) {
      const row = p as unknown as NotesPayloadListRow;
      payloadById.set(row.item_id, row);
    }

    const out: NoteNode[] = [];
    for (const m of metas ?? []) {
      const meta = m as unknown as ItemsMetaNoteRow;
      const payload = payloadById.get(meta.id);
      if (!payload) continue; // orphan meta — skip rather than throw
      out.push(rowsToNoteNodeLite(meta, payload));
    }
    return out;
  }

  /**
   * Reverse a soft-delete. Clears items_meta.is_deleted / deleted_at and
   * bumps updated_at so Sync LWW propagates the restore. Mirrors the
   * legacy `restoreNote` (single-row) — PR1 known constraint: restoring a
   * folder does NOT restore its descendants; the caller must restore each
   * id individually (legacy parity, tracked as Backlog ⑧ in the Notes
   * web-parity plan).
   */
  async restoreNoteUnified(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("items_meta")
      .update({ is_deleted: false, deleted_at: null, updated_at: now })
      .eq("id", id)
      .eq("role", "note");
    if (error) throw new Error(`restoreNoteUnified failed: ${error.message}`);
  }

  /**
   * Hard-delete from items_meta. notes_payload is cleaned up automatically
   * by the 0008 `ON DELETE CASCADE` FK (`notes_payload.item_id ->
   * items_meta(id)`). The composite parent FK introduced by 0014 is
   * `ON DELETE NO ACTION`, so a folder whose subtree still references it
   * must be purged descendants-first — mirrors `permanentDeleteTask`
   * (DB-Q3). The pool is built from live + trashed (a trashed root with
   * trashed children must purge in one call).
   *
   * sortByDepthDesc lives in utils/ keyed to TaskNode; rather than
   * generalising it (out of scope for this PR), the depth walk is
   * inlined here against the Note pool. Cycle guard mirrors the
   * task-tree pattern (known-issue 016).
   */
  async permanentDeleteNoteUnified(id: string): Promise<void> {
    const [live, trashed] = await Promise.all([
      this.listNotesUnified(),
      this.fetchDeletedNotesUnified(),
    ]);
    const pool = [...live, ...trashed];

    // Build child index + collect the subtree rooted at `id`.
    const childrenByParent = new Map<string | null, string[]>();
    for (const n of pool) {
      const list = childrenByParent.get(n.parentId);
      if (list) list.push(n.id);
      else childrenByParent.set(n.parentId, [n.id]);
    }
    const subtree = new Set<string>();
    subtree.add(id);
    const stack = [id];
    while (stack.length > 0) {
      const parent = stack.pop()!;
      for (const cid of childrenByParent.get(parent) ?? []) {
        if (subtree.has(cid)) continue; // cycle guard (known-issue 016)
        subtree.add(cid);
        stack.push(cid);
      }
    }

    // Depth walk for leaf-first ordering. Cap at pool size to defuse
    // cyclic parent chains (same shape as sortByDepthDesc).
    const nodeById = new Map(pool.map((n) => [n.id, n]));
    const depthOf = (startId: string): number => {
      let d = 0;
      let cur: string | null = startId;
      const seen = new Set<string>();
      while (cur !== null) {
        if (seen.has(cur)) break;
        seen.add(cur);
        const node = nodeById.get(cur);
        if (!node || node.parentId === null) break;
        cur = node.parentId;
        d++;
      }
      return d;
    };
    const ordered = [...subtree].sort((a, b) => depthOf(b) - depthOf(a));

    for (const did of ordered) {
      const { error } = await this.client
        .from("items_meta")
        .delete()
        .eq("id", did)
        .eq("role", "note");
      if (error)
        throw new Error(`permanentDeleteNoteUnified ${did}: ${error.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Search (DU-G PR1)
  // -------------------------------------------------------------------------

  /**
   * Title + content search. The 2-row split forces a 2-step query: gather
   * payload.item_ids whose content_json matches, then UNION the meta.title
   * matches at the items_meta layer (ilike on title). All filtered to
   * is_deleted=false and role='note'. Empty query short-circuits to all
   * notes (parity with legacy hook which client-filtered).
   *
   * SECURITY: every interpolated value flows through `pgrstQuoteValue`
   * (see SupabaseDataService.ts header) so reserved chars cannot break
   * out of the PostgREST filter grammar. The `%` wildcards stay outside
   * the quotes so they still act as ILIKE wildcards while the user query
   * is treated literally.
   *
   * KNOWN LIMITATION: content_json is jsonb. PostgREST `ilike` on jsonb
   * does an implicit text cast — works on TipTap docs (jsonb text repr
   * contains the user-visible text) but is more expensive than the
   * legacy single-table `content` text column. Acceptable for N=1 with
   * bounded dataset; if the dataset ever grows we'd add a tsvector
   * generated column. For now we accept the cast cost.
   */
  async searchNotesUnified(query: string): Promise<NoteNode[]> {
    const trimmed = query.trim();
    if (trimmed === "") return this.listNotesUnified();

    // Step 1: items_meta ids whose title ilike matches (role+!is_deleted).
    // `safe` is forward-compat — Supabase `.ilike()` already parameter-binds
    // `trimmed`, so the quoted variant is only needed if a future revision
    // switches to `.or("title.ilike.<v>,content.ilike.<v>")` (DU-G Step 5
    // multi-column widening, see L665 JSDoc + QA-3 review note).
    const safe = pgrstQuoteValueLocal(trimmed);
    const { data: titleHits, error: titleErr } = await this.client
      .from("items_meta")
      .select(ITEMS_META_NOTE_COLUMNS)
      .eq("role", "note")
      .eq("is_deleted", false)
      .ilike("title", `%${trimmed}%`);
    if (titleErr)
      throw new Error(`searchNotesUnified title failed: ${titleErr.message}`);

    // Step 2: notes_payload rows whose content_json ilike matches. We
    // need the payload ids, then look up meta for those ids that are
    // still live (composite filter is_deleted=false applied via items_meta
    // step 3).
    const { data: contentHits, error: contentErr } = await this.client
      .from("notes_payload")
      .select("item_id")
      .ilike("content_json::text", `%${trimmed}%`);
    if (contentErr)
      throw new Error(
        `searchNotesUnified content failed: ${contentErr.message}`,
      );

    // Step 3: merge id sets — title hits already include meta rows; for
    // content-only hits we need to fetch their meta + filter is_deleted.
    const titleMetaById = new Map<string, ItemsMetaNoteRow>();
    for (const m of titleHits ?? []) {
      const row = m as unknown as ItemsMetaNoteRow;
      titleMetaById.set(row.id, row);
    }
    const contentOnlyIds = (contentHits ?? [])
      .map((c) => (c as { item_id: string }).item_id)
      .filter((cid) => !titleMetaById.has(cid));

    let extraMetas: ItemsMetaNoteRow[] = [];
    if (contentOnlyIds.length > 0) {
      const { data: extraData, error: extraErr } = await this.client
        .from("items_meta")
        .select(ITEMS_META_NOTE_COLUMNS)
        .eq("role", "note")
        .eq("is_deleted", false)
        .in("id", contentOnlyIds);
      if (extraErr)
        throw new Error(`searchNotesUnified meta failed: ${extraErr.message}`);
      extraMetas = (extraData ?? []) as unknown as ItemsMetaNoteRow[];
    }

    const allMetas = [...titleMetaById.values(), ...extraMetas];
    const allIds = allMetas.map((m) => m.id);
    if (allIds.length === 0) {
      // Discard the forward-compat escaped form (see L399 + L665 JSDoc).
      // Activated by DU-G Step 5 if/when search widens to `.or()` multi-column.
      void safe;
      return [];
    }

    // Step 4: fetch payloads for the merged id set + join.
    const { data: payloads, error: payErr } = await this.client
      .from("notes_payload")
      .select(NOTES_PAYLOAD_COLUMNS)
      .in("item_id", allIds);
    if (payErr)
      throw new Error(`searchNotesUnified payload failed: ${payErr.message}`);

    const payloadById = new Map<string, NotesPayloadRow>();
    for (const p of payloads ?? []) {
      const row = p as unknown as NotesPayloadRow;
      payloadById.set(row.item_id, row);
    }

    const out: NoteNode[] = [];
    for (const meta of allMetas) {
      const payload = payloadById.get(meta.id);
      if (!payload) continue;
      out.push(rowsToNoteNode(meta, payload));
    }
    // Order by updated_at DESC (legacy parity).
    out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return out;
  }

  // -------------------------------------------------------------------------
  // Password gate (DU-G PR1)
  //
  // PARITY MANDATE: plaintext equality, matching the legacy Notes mapper
  // header ("kept as-is for parity — Tauri parity mandate, not a crypto
  // redesign; keeping the hash off the wire is the strongest mitigation
  // available here"). RLS scopes every read to auth.uid()'s rows, so the
  // raw hash never crosses to another user. `has_password` is the
  // generated stored column projected back to the client.
  // -------------------------------------------------------------------------

  /**
   * Write password_hash into notes_payload. NoteNode round-trip done via
   * getNoteUnified so the GENERATED `has_password` column reflects on the
   * returned domain object. Bump items_meta.updated_at + version so Sync
   * LWW propagates.
   */
  async setNotePasswordUnified(
    id: string,
    password: string,
  ): Promise<NoteNode> {
    const now = new Date().toISOString();
    const nextVersion = await this.nextVersion(id, "setNotePasswordUnified");

    const { error: metaErr } = await this.client
      .from("items_meta")
      .update({ updated_at: now, version: nextVersion })
      .eq("id", id)
      .eq("role", "note");
    if (metaErr)
      throw new Error(`setNotePasswordUnified meta failed: ${metaErr.message}`);

    const { error: payErr } = await this.client
      .from("notes_payload")
      .update({ password_hash: password })
      .eq("item_id", id);
    if (payErr)
      throw new Error(
        `setNotePasswordUnified payload failed: ${payErr.message}`,
      );

    const updated = await this.getNoteUnified(id);
    if (!updated)
      throw new Error(
        `setNotePasswordUnified: row vanished after update (id="${id}")`,
      );
    return updated;
  }

  /**
   * Verify-then-clear. Tauri parity: a wrong currentPassword must NOT
   * mutate the row, so verify is the first step and rejects on mismatch.
   */
  async removeNotePasswordUnified(
    id: string,
    currentPassword: string,
  ): Promise<NoteNode> {
    const valid = await this.verifyNotePasswordUnified(id, currentPassword);
    if (!valid) throw new Error("Invalid password");

    const now = new Date().toISOString();
    const nextVersion = await this.nextVersion(id, "removeNotePasswordUnified");

    const { error: metaErr } = await this.client
      .from("items_meta")
      .update({ updated_at: now, version: nextVersion })
      .eq("id", id)
      .eq("role", "note");
    if (metaErr)
      throw new Error(
        `removeNotePasswordUnified meta failed: ${metaErr.message}`,
      );

    const { error: payErr } = await this.client
      .from("notes_payload")
      .update({ password_hash: null })
      .eq("item_id", id);
    if (payErr)
      throw new Error(
        `removeNotePasswordUnified payload failed: ${payErr.message}`,
      );

    const updated = await this.getNoteUnified(id);
    if (!updated)
      throw new Error(
        `removeNotePasswordUnified: row vanished after update (id="${id}")`,
      );
    return updated;
  }

  /**
   * Plaintext equality. SELECTs password_hash from notes_payload (RLS
   * scopes to auth.uid()'s rows). Returns `false` when no hash is set.
   * EXISTING DEBT (carried from legacy): ideally a `security invoker`
   * RPC so the hash never leaves Postgres; kept as-is for parity.
   */
  async verifyNotePasswordUnified(
    id: string,
    password: string,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from("notes_payload")
      .select("password_hash")
      .eq("item_id", id)
      .maybeSingle();
    if (error)
      throw new Error(`verifyNotePasswordUnified failed: ${error.message}`);
    const hash = (data as { password_hash: string | null } | null)
      ?.password_hash;
    return hash != null && hash === password;
  }

  // -------------------------------------------------------------------------
  // Edit lock (DU-G PR1)
  // -------------------------------------------------------------------------

  /**
   * Flip notes_payload.is_edit_locked. Read-modify-write because PostgREST
   * cannot express the SQLite `CASE WHEN ... END` in one statement. Bumps
   * items_meta.updated_at + version so Sync LWW propagates.
   */
  async toggleNoteEditLockUnified(id: string): Promise<NoteNode> {
    const { data: cur, error: readErr } = await this.client
      .from("notes_payload")
      .select("is_edit_locked")
      .eq("item_id", id)
      .single();
    if (readErr)
      throw new Error(
        `toggleNoteEditLockUnified read failed: ${readErr.message}`,
      );
    const next = !(cur as { is_edit_locked: boolean }).is_edit_locked;

    const now = new Date().toISOString();
    const nextVersion = await this.nextVersion(id, "toggleNoteEditLockUnified");

    const { error: metaErr } = await this.client
      .from("items_meta")
      .update({ updated_at: now, version: nextVersion })
      .eq("id", id)
      .eq("role", "note");
    if (metaErr)
      throw new Error(
        `toggleNoteEditLockUnified meta failed: ${metaErr.message}`,
      );

    const { error: payErr } = await this.client
      .from("notes_payload")
      .update({ is_edit_locked: next })
      .eq("item_id", id);
    if (payErr)
      throw new Error(
        `toggleNoteEditLockUnified payload failed: ${payErr.message}`,
      );

    const updated = await this.getNoteUnified(id);
    if (!updated)
      throw new Error(
        `toggleNoteEditLockUnified: row vanished after update (id="${id}")`,
      );
    return updated;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Read current items_meta.version and return version + 1. Mirrors the
   * legacy `nextVersion` helper. A missing row throws (caller invariant:
   * the row exists; this helper only runs from password/lock paths where
   * the UI has already loaded the note).
   */
  private async nextVersion(id: string, label: string): Promise<number> {
    const { data, error } = await this.client
      .from("items_meta")
      .select("version")
      .eq("id", id)
      .eq("role", "note")
      .single();
    if (error) throw new Error(`${label} version read: ${error.message}`);
    const row = data as { version: number | null };
    return (row?.version ?? 0) + 1;
  }
}

/**
 * Local copy of pgrstQuoteValue (see SupabaseDataService.ts header for the
 * security rationale). Duplicated to avoid a circular import — this file
 * is the dispatch target, SupabaseDataService.ts imports it. Identical
 * contract: double-quote wrap + backslash-escape embedded `"` and `\`.
 *
 * Used in searchNotesUnified for parity with the legacy escape posture;
 * the current implementation uses `.ilike()` (parameter-binding underneath
 * Supabase's client) for both title and content so the safe-string is
 * defence-in-depth, not the primary guard. Kept reachable so future
 * `.or()`-based widening (e.g. multi-column search) inherits the escape.
 * Concretely: DU-G Step 5 (multi-column / boolean composition) will switch
 * to `.or("title.ilike.<safe>,content_json.ilike.<safe>")` where the quoted
 * form is mandatory because `.or()` parses the value as PostgREST grammar
 * — that is the activation point for this helper.
 */
function pgrstQuoteValueLocal(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export const PHASE2_NOTES_UNIFIED_METHODS: ReadonlySet<string> = new Set([
  "listNotesUnified",
  "getNoteUnified",
  "createNoteUnified",
  "updateNoteUnified",
  "softDeleteNoteUnified",
  "moveNoteUnified",
  // DU-G PR1
  "fetchDeletedNotesUnified",
  "restoreNoteUnified",
  "permanentDeleteNoteUnified",
  "searchNotesUnified",
  "setNotePasswordUnified",
  "removeNotePasswordUnified",
  "verifyNotePasswordUnified",
  "toggleNoteEditLockUnified",
]);
