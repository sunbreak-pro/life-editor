import { type SupabaseClient } from "@supabase/supabase-js";
import type { TaskNode } from "../types/taskTree";
import type { DailyNode } from "../types/daily";
import type { NoteNode } from "../types/note";
import type {
  NoteLink,
  NoteLinkPayload,
  BacklinkHit,
  UnlinkedMention,
} from "../types/noteLink";
import type { NoteConnection } from "../types/wikiTag";
import type { DataService } from "./DataService";
import { getSupabaseClient } from "./supabaseClient";
import {
  TASK_COLUMNS,
  rowToTaskNode,
  taskNodeToRow,
  taskUpdatesToPatch,
  type TaskRow,
} from "./taskMapper";
import {
  DAILY_SELECT_COLUMNS,
  rowToDailyNode,
  type DailyRow,
} from "./dailyMapper";
import {
  NOTE_SELECT_COLUMNS,
  rowToNoteNode,
  noteUpdatesToPatch,
  type NoteRow,
} from "./noteMapper";
import {
  NOTE_LINK_SELECT_COLUMNS,
  rowToNoteLink,
  type NoteLinkRow,
} from "./noteLinkMapper";

/*
 * Phase 2 S1 Supabase implementation.
 *
 * The `tasks` domain is fully implemented (full-column round-trip against
 * the 0003_tasks_full_schema.sql shape: hierarchy / soft-delete /
 * scheduling / versioning). Pure mapping lives in `taskMapper.ts`; this
 * file is the I/O layer only. Every other DataService method is still
 * unimplemented and throws at call time ("not implemented in phase 2");
 * later S-steps port the remaining domains.
 *
 * The full `DataService` interface has ~200 members; enumerating throwing
 * stubs by hand for all of them is noise. The implemented tasks methods
 * live on a real class and a Proxy fills the rest with a throwing
 * fallback, asserted to `DataService` so consumers keep static typing.
 */

/*
 * PostgREST or()/filter value escaping.
 *
 * Reserved chars (`,` `.` `:` `(` `)` and whitespace) terminate or split
 * a PostgREST filter value, so an attacker-influenced id/query could
 * break out of the intended grammar (e.g. inject extra `or(...)` legs and
 * widen a DELETE/SELECT). PostgREST's documented remedy is to wrap the
 * value in double quotes and backslash-escape any embedded `"` and `\`
 * — a quoted value is then treated literally regardless of reserved
 * chars. Both `searchNotes` (ilike pattern) and
 * `deleteNoteConnectionByPair` (eq id) route their interpolated values
 * through this single helper (DRY) so the escaping cannot drift apart.
 */
export function pgrstQuoteValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

class SupabaseTasksService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async fetchTaskTree(): Promise<TaskNode[]> {
    const { data, error } = await this.client
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("is_deleted", false)
      .order("order", { ascending: true });
    if (error) throw new Error(`fetchTaskTree failed: ${error.message}`);
    return (data as unknown as TaskRow[]).map(rowToTaskNode);
  }

  async fetchDeletedTasks(): Promise<TaskNode[]> {
    const { data, error } = await this.client
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("is_deleted", true)
      .order("deleted_at", { ascending: false });
    if (error) throw new Error(`fetchDeletedTasks failed: ${error.message}`);
    return (data as unknown as TaskRow[]).map(rowToTaskNode);
  }

  async createTask(node: TaskNode): Promise<TaskNode> {
    const { data, error } = await this.client
      .from("tasks")
      .insert(taskNodeToRow(node))
      .select(TASK_COLUMNS)
      .single();
    if (error) throw new Error(`createTask failed: ${error.message}`);
    return rowToTaskNode(data as unknown as TaskRow);
  }

  async updateTask(id: string, updates: Partial<TaskNode>): Promise<TaskNode> {
    const { data, error } = await this.client
      .from("tasks")
      .update(taskUpdatesToPatch(updates))
      .eq("id", id)
      .select(TASK_COLUMNS)
      .single();
    if (error) throw new Error(`updateTask failed: ${error.message}`);
    return rowToTaskNode(data as unknown as TaskRow);
  }

  async syncTaskTree(nodes: TaskNode[]): Promise<void> {
    if (nodes.length === 0) return;
    const rows = nodes.map(taskNodeToRow);
    const { error } = await this.client
      .from("tasks")
      .upsert(rows, { onConflict: "id" });
    if (error) throw new Error(`syncTaskTree failed: ${error.message}`);
  }

  async softDeleteTask(id: string): Promise<void> {
    const { error } = await this.client
      .from("tasks")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(`softDeleteTask failed: ${error.message}`);
  }

  async restoreTask(id: string): Promise<void> {
    const { error } = await this.client
      .from("tasks")
      .update({ is_deleted: false, deleted_at: null })
      .eq("id", id);
    if (error) throw new Error(`restoreTask failed: ${error.message}`);
  }

  async permanentDeleteTask(id: string): Promise<void> {
    const { error } = await this.client.from("tasks").delete().eq("id", id);
    if (error) throw new Error(`permanentDeleteTask failed: ${error.message}`);
  }

  /**
   * Web no-op stub (user-confirmed). On Tauri this migrated local SQLite
   * tasks into the cloud backend; the web build is Supabase-native so
   * there is nothing to migrate. Kept to satisfy the DataService
   * interface and any caller that invokes it unconditionally.
   */
  async migrateTasksToBackend(_nodes: TaskNode[]): Promise<void> {
    void _nodes;
  }
}

/*
 * Daily domain (S2). Single-table UPSERT-on-`date` model, `daily-<date>`
 * text id, soft-delete, versioned. Pure mapping lives in dailyMapper.ts;
 * this is the I/O layer only. The password column is mutated/compared
 * verbatim (Tauri contract, src-tauri/.../daily_repository.rs) — the raw
 * hash is NEVER selected back (DAILY_SELECT_COLUMNS projects only the
 * boolean `has_password`). `version` is bumped on every mutation,
 * mirroring the SQLite `version = version + 1`.
 */
class SupabaseDailyService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async fetchAllDailies(): Promise<DailyNode[]> {
    const { data, error } = await this.client
      .from("dailies")
      .select(DAILY_SELECT_COLUMNS)
      .eq("is_deleted", false)
      .order("date", { ascending: false });
    if (error) throw new Error(`fetchAllDailies failed: ${error.message}`);
    return (data as unknown as DailyRow[]).map(rowToDailyNode);
  }

  async fetchDailyByDate(date: string): Promise<DailyNode | null> {
    const { data, error } = await this.client
      .from("dailies")
      .select(DAILY_SELECT_COLUMNS)
      .eq("date", date)
      .maybeSingle();
    if (error) throw new Error(`fetchDailyByDate failed: ${error.message}`);
    return data ? rowToDailyNode(data as unknown as DailyRow) : null;
  }

  async fetchDeletedDailies(): Promise<DailyNode[]> {
    const { data, error } = await this.client
      .from("dailies")
      .select(DAILY_SELECT_COLUMNS)
      .eq("is_deleted", true)
      .order("deleted_at", { ascending: false });
    if (error) throw new Error(`fetchDeletedDailies failed: ${error.message}`);
    return (data as unknown as DailyRow[]).map(rowToDailyNode);
  }

  /**
   * UPSERT on the natural `date` key (the SQLite source did
   * `ON CONFLICT(date) DO UPDATE SET content=?, version=version+1`).
   * `version` cannot be a relative `version + 1` in a single PostgREST
   * upsert, so it is read-then-written: fetch the current row, compute
   * the next version, and upsert the full row. The `daily-<date>` id is
   * client-generated (CLAUDE.md §4.3). `user_id` is RLS-derived and
   * never sent.
   */
  async upsertDaily(date: string, content: string): Promise<DailyNode> {
    const { data: existing, error: readErr } = await this.client
      .from("dailies")
      .select("version, created_at")
      .eq("date", date)
      .maybeSingle();
    if (readErr) throw new Error(`upsertDaily failed: ${readErr.message}`);

    const now = new Date().toISOString();
    const existingRow = existing as {
      version: number;
      created_at: string;
    } | null;
    const payload = {
      id: `daily-${date}`,
      date,
      content,
      created_at: existingRow?.created_at ?? now,
      updated_at: now,
      version: (existingRow?.version ?? 0) + 1,
    };

    const { data, error } = await this.client
      .from("dailies")
      .upsert(payload, { onConflict: "date" })
      .select(DAILY_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`upsertDaily failed: ${error.message}`);
    return rowToDailyNode(data as unknown as DailyRow);
  }

  async deleteDaily(date: string): Promise<void> {
    const { error } = await this.client
      .from("dailies")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq("date", date);
    if (error) throw new Error(`deleteDaily failed: ${error.message}`);
  }

  async restoreDaily(date: string): Promise<void> {
    const { error } = await this.client
      .from("dailies")
      .update({ is_deleted: false, deleted_at: null })
      .eq("date", date);
    if (error) throw new Error(`restoreDaily failed: ${error.message}`);
  }

  async permanentDeleteDaily(date: string): Promise<void> {
    const { error } = await this.client
      .from("dailies")
      .delete()
      .eq("date", date);
    if (error) throw new Error(`permanentDeleteDaily failed: ${error.message}`);
  }

  /** Read-modify-write toggle (mirrors the SQLite CASE flip + version bump). */
  async toggleDailyPin(date: string): Promise<DailyNode> {
    return this.toggleBoolean(date, "is_pinned", "toggleDailyPin");
  }

  async toggleDailyEditLock(date: string): Promise<DailyNode> {
    return this.toggleBoolean(date, "is_edit_locked", "toggleDailyEditLock");
  }

  private async toggleBoolean(
    date: string,
    column: "is_pinned" | "is_edit_locked",
    label: string,
  ): Promise<DailyNode> {
    const { data: cur, error: readErr } = await this.client
      .from("dailies")
      .select(`${column}, version`)
      .eq("date", date)
      .single();
    if (readErr) throw new Error(`${label} failed: ${readErr.message}`);
    const row = cur as Record<string, unknown>;
    const next = !(row[column] as boolean);
    const { data, error } = await this.client
      .from("dailies")
      .update({
        [column]: next,
        version: (row.version as number) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("date", date)
      .select(DAILY_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`${label} failed: ${error.message}`);
    return rowToDailyNode(data as unknown as DailyRow);
  }

  /**
   * Store the password verbatim into `password_hash` (Tauri contract:
   * the backend stored/compared the value as-is — see
   * daily_repository.rs `set_password`/`verify_password`). RLS already
   * prevents any cross-user read; the raw value is never projected back
   * (DAILY_SELECT_COLUMNS). NOTE: plaintext-equality is a pre-existing
   * weakness carried over 1:1, not introduced here — flagged for
   * security review (S2 mandates parity, not a crypto redesign).
   */
  async setDailyPassword(date: string, password: string): Promise<DailyNode> {
    const { data, error } = await this.client
      .from("dailies")
      .update({ password_hash: password, updated_at: new Date().toISOString() })
      .eq("date", date)
      .select(DAILY_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`setDailyPassword failed: ${error.message}`);
    return rowToDailyNode(data as unknown as DailyRow);
  }

  /**
   * Verify `currentPassword` first, then NULL the hash (mirrors the
   * Tauri command layer which rejected a wrong current password before
   * `remove_password`).
   */
  async removeDailyPassword(
    date: string,
    currentPassword: string,
  ): Promise<DailyNode> {
    const valid = await this.verifyDailyPassword(date, currentPassword);
    if (!valid) throw new Error("Invalid password");
    const { data, error } = await this.client
      .from("dailies")
      .update({ password_hash: null, updated_at: new Date().toISOString() })
      .eq("date", date)
      .select(DAILY_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`removeDailyPassword failed: ${error.message}`);
    return rowToDailyNode(data as unknown as DailyRow);
  }

  /**
   * Plaintext-equality compare (Tauri parity). Reads `password_hash`
   * ONLY here, server-filtered to the owner's row by RLS, and never
   * returns it — the boolean result is all the client sees.
   */
  async verifyDailyPassword(date: string, password: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("dailies")
      .select("password_hash")
      .eq("date", date)
      .maybeSingle();
    if (error) throw new Error(`verifyDailyPassword failed: ${error.message}`);
    const hash = (data as { password_hash: string | null } | null)
      ?.password_hash;
    return hash != null && hash === password;
  }
}

/*
 * Notes domain (S3-3). Hierarchical folder/note tree, soft-delete,
 * versioned, optional password gate. Pure mapping lives in noteMapper.ts;
 * this is the I/O layer only. Behaviour is a 1:1 port of the Tauri
 * src-tauri/src/db/note_repository.rs (+ note_commands.rs for the
 * remove_password verify-first ordering) — NOT a redesign.
 *
 * `version` is bumped on every mutation (mirrors the SQLite
 * `version = version + 1`). The raw `password_hash` is NEVER selected
 * back (NOTE_SELECT_COLUMNS projects only the generated boolean
 * `has_password`). PLAINTEXT-EQUALITY PASSWORD: carried verbatim from the
 * Tauri backend (note_repository.rs set_password/verify_password store &
 * compare the value as-is). This is a PRE-EXISTING weakness kept 1:1 per
 * the S3 parity mandate (user-confirmed: do not improve here, do not
 * regress). EXISTING DEBT — a future hardening should move set/verify
 * behind a `security invoker` RPC so the hash never leaves Postgres at
 * all (today verifyNotePassword still SELECTs it into the client process,
 * RLS-scoped to the owner row). Flagged for security review.
 */
class SupabaseNotesService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * Tauri parity: `fetch_all` is
   * `is_deleted = 0 ORDER BY order_index ASC, updated_at DESC`. PostgREST
   * stacks .order() calls in call order, so order asc then updated_at
   * desc reproduces the SQLite ordering exactly.
   */
  async fetchAllNotes(): Promise<NoteNode[]> {
    const { data, error } = await this.client
      .from("notes")
      .select(NOTE_SELECT_COLUMNS)
      .eq("is_deleted", false)
      .order("order", { ascending: true })
      .order("updated_at", { ascending: false });
    if (error) throw new Error(`fetchAllNotes failed: ${error.message}`);
    return (data as unknown as NoteRow[]).map(rowToNoteNode);
  }

  async fetchDeletedNotes(): Promise<NoteNode[]> {
    const { data, error } = await this.client
      .from("notes")
      .select(NOTE_SELECT_COLUMNS)
      .eq("is_deleted", true)
      .order("deleted_at", { ascending: false });
    if (error) throw new Error(`fetchDeletedNotes failed: ${error.message}`);
    return (data as unknown as NoteRow[]).map(rowToNoteNode);
  }

  /**
   * Tauri `create`: type='note', content='', order_index=0,
   * is_pinned=0, is_deleted=0, created_at=updated_at=now(). `user_id` is
   * RLS-derived and never sent; `has_password`/`version` take their DB
   * defaults (false / 1).
   */
  async createNote(
    id: string,
    title: string,
    parentId?: string | null,
  ): Promise<NoteNode> {
    return this.insertNode(id, "note", title, parentId ?? null);
  }

  /** Tauri `create_folder`: identical to create but type='folder'. */
  async createNoteFolder(
    id: string,
    title: string,
    parentId: string | null,
  ): Promise<NoteNode> {
    return this.insertNode(id, "folder", title, parentId);
  }

  private async insertNode(
    id: string,
    type: "note" | "folder",
    title: string,
    parentId: string | null,
  ): Promise<NoteNode> {
    const now = new Date().toISOString();
    const payload = {
      id,
      type,
      title,
      content: "",
      parent_id: parentId,
      order: 0,
      is_pinned: false,
      is_edit_locked: false,
      is_deleted: false,
      created_at: now,
      updated_at: now,
      version: 1,
    };
    const { data, error } = await this.client
      .from("notes")
      .insert(payload)
      .select(NOTE_SELECT_COLUMNS)
      .single();
    if (error)
      throw new Error(
        `create${type === "folder" ? "NoteFolder" : "Note"} failed: ${error.message}`,
      );
    return rowToNoteNode(data as unknown as NoteRow);
  }

  /**
   * Tauri `update`: ONLY title/content/isPinned/color/icon are mutable
   * (noteUpdatesToPatch enforces the same whitelist). If nothing maps,
   * the Rust path just re-reads the row (no version bump) — replicated
   * here. Otherwise bump `version` + `updated_at`. The patch never
   * includes `password_hash`, so a content save cannot clobber a
   * password (partial-payload safety, matching the Rust whitelist).
   */
  async updateNote(
    id: string,
    updates: Partial<
      Pick<NoteNode, "title" | "content" | "isPinned" | "color" | "icon">
    >,
  ): Promise<NoteNode> {
    const patch = noteUpdatesToPatch(updates);
    if (Object.keys(patch).length === 0) {
      const { data, error } = await this.client
        .from("notes")
        .select(NOTE_SELECT_COLUMNS)
        .eq("id", id)
        .single();
      if (error) throw new Error(`updateNote failed: ${error.message}`);
      return rowToNoteNode(data as unknown as NoteRow);
    }
    // version = version + 1 cannot be expressed relatively in a single
    // PostgREST update, so read-then-write the next version.
    // .maybeSingle() (NOT .single()): an optimistic createNote adds the
    // node to local state and fires the INSERT fire-and-forget; a flush
    // (e.g. RichTextEditor unmount) can call updateNote BEFORE that
    // INSERT lands, so the version read legitimately sees 0 rows. With
    // .single() that 0-row case is a PostgREST 406 ("Cannot coerce the
    // result to a single JSON object") thrown into the caller. update is
    // existence-presupposing here, so a not-yet-existing row is NOT an
    // error: skip the DB write and return — local state already holds
    // the edit and the next flush after the INSERT lands persists it (no
    // data loss). A real read error (auth / network) still throws below;
    // only the genuine 0-row race is the skip path. See known-issue 020.
    const { data: cur, error: readErr } = await this.client
      .from("notes")
      .select("version")
      .eq("id", id)
      .maybeSingle();
    if (readErr) throw new Error(`updateNote failed: ${readErr.message}`);
    const curRow = cur as { version: number } | null;
    if (curRow == null) {
      // Row not yet present (INSERT in flight). Local state is canonical
      // and the post-INSERT flush persists this edit, so skip the DB
      // write. The caller (useNotesAPI.updateNote) discards this return
      // value (it only .catch()es), but the Promise<NoteNode> contract
      // still needs a well-formed node — synthesize one from the patch
      // with explicit column defaults (no `as`-cast type lie through
      // rowToNoteNode, which assumes NOT-NULL columns are materialised).
      const now = new Date().toISOString();
      return rowToNoteNode({
        id,
        user_id: "",
        type: "note",
        title: patch.title ?? "",
        content: patch.content ?? "",
        parent_id: null,
        order: patch.order ?? 0,
        is_pinned: patch.is_pinned ?? false,
        is_edit_locked: patch.is_edit_locked ?? false,
        color: patch.color ?? null,
        icon: patch.icon ?? null,
        has_password: false,
        is_deleted: false,
        deleted_at: null,
        created_at: now,
        updated_at: now,
        version: 0,
      });
    }
    const nextVersion = (curRow.version ?? 0) + 1;
    const { data, error } = await this.client
      .from("notes")
      .update({
        ...patch,
        version: nextVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(NOTE_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`updateNote failed: ${error.message}`);
    return rowToNoteNode(data as unknown as NoteRow);
  }

  /**
   * Tauri `sync_tree`: per-item UPDATE of parent_id + order_index, NO
   * version bump (it is a structural move, not a content mutation —
   * matching the Rust transaction which only sets parent_id/order_index).
   */
  async syncNoteTree(
    items: Array<{ id: string; parentId: string | null; order: number }>,
  ): Promise<void> {
    for (const item of items) {
      const { error } = await this.client
        .from("notes")
        .update({ parent_id: item.parentId, order: item.order })
        .eq("id", item.id);
      if (error) throw new Error(`syncNoteTree failed: ${error.message}`);
    }
  }

  async softDeleteNote(id: string): Promise<void> {
    const { error } = await this.client
      .from("notes")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`softDeleteNote failed: ${error.message}`);
  }

  async restoreNote(id: string): Promise<void> {
    const { error } = await this.client
      .from("notes")
      .update({ is_deleted: false, deleted_at: null })
      .eq("id", id);
    if (error) throw new Error(`restoreNote failed: ${error.message}`);
  }

  async permanentDeleteNote(id: string): Promise<void> {
    const { error } = await this.client.from("notes").delete().eq("id", id);
    if (error) throw new Error(`permanentDeleteNote failed: ${error.message}`);
  }

  /**
   * Tauri `search`: `is_deleted=0 AND (title LIKE %q% OR content LIKE
   * %q%) ORDER BY updated_at DESC`. PostgREST `.or()` with `ilike`
   * mirrors the SQLite case-insensitive LIKE (SQLite LIKE is
   * case-insensitive for ASCII by default). The interpolated query is
   * wrapped via `pgrstQuoteValue` so reserved chars (`,` `(` `)` `.`
   * etc.) cannot break out of the or-filter grammar; the `%` wildcards
   * stay OUTSIDE the quotes so they still act as LIKE wildcards while the
   * user-supplied substring is treated literally.
   */
  async searchNotes(query: string): Promise<NoteNode[]> {
    const safe = pgrstQuoteValue(query);
    const { data, error } = await this.client
      .from("notes")
      .select(NOTE_SELECT_COLUMNS)
      .eq("is_deleted", false)
      .or(`title.ilike.%${safe}%,content.ilike.%${safe}%`)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(`searchNotes failed: ${error.message}`);
    return (data as unknown as NoteRow[]).map(rowToNoteNode);
  }

  /**
   * Tauri `set_password`: store the value verbatim into `password_hash`,
   * bump version + updated_at. PLAINTEXT (pre-existing weakness, kept 1:1
   * — see class header / EXISTING DEBT note). RLS already blocks any
   * cross-user read; the raw value is never projected back
   * (NOTE_SELECT_COLUMNS).
   */
  async setNotePassword(id: string, password: string): Promise<NoteNode> {
    const next = await this.nextVersion(id, "setNotePassword");
    const { data, error } = await this.client
      .from("notes")
      .update({
        password_hash: password,
        version: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(NOTE_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`setNotePassword failed: ${error.message}`);
    return rowToNoteNode(data as unknown as NoteRow);
  }

  /**
   * Tauri parity (note_commands.rs `db_notes_remove_password`): verify
   * the current password FIRST, reject on mismatch, THEN NULL the hash +
   * bump version. Order matters — a wrong current password must not
   * mutate the row.
   */
  async removeNotePassword(
    id: string,
    currentPassword: string,
  ): Promise<NoteNode> {
    const valid = await this.verifyNotePassword(id, currentPassword);
    if (!valid) throw new Error("Invalid password");
    const next = await this.nextVersion(id, "removeNotePassword");
    const { data, error } = await this.client
      .from("notes")
      .update({
        password_hash: null,
        version: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(NOTE_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`removeNotePassword failed: ${error.message}`);
    return rowToNoteNode(data as unknown as NoteRow);
  }

  /**
   * Tauri `verify_password`: plaintext equality, `false` when no hash.
   * This is the ONLY path that SELECTs `password_hash`, server-filtered
   * to the owner's row by RLS, and it never returns it — the boolean is
   * all the client sees. EXISTING DEBT: ideally a `security invoker` RPC
   * so the hash never enters the client process; kept as-is for S3
   * parity (flagged for security review).
   */
  async verifyNotePassword(id: string, password: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("notes")
      .select("password_hash")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`verifyNotePassword failed: ${error.message}`);
    const hash = (data as { password_hash: string | null } | null)
      ?.password_hash;
    return hash != null && hash === password;
  }

  /**
   * Tauri `toggle_edit_lock`: flip is_edit_locked, bump version +
   * updated_at. Read-modify-write (PostgREST cannot express the SQLite
   * `CASE WHEN ... END` flip in one statement).
   */
  async toggleNoteEditLock(id: string): Promise<NoteNode> {
    const { data: cur, error: readErr } = await this.client
      .from("notes")
      .select("is_edit_locked, version")
      .eq("id", id)
      .single();
    if (readErr)
      throw new Error(`toggleNoteEditLock failed: ${readErr.message}`);
    const row = cur as { is_edit_locked: boolean; version: number };
    const { data, error } = await this.client
      .from("notes")
      .update({
        is_edit_locked: !row.is_edit_locked,
        version: (row.version ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(NOTE_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`toggleNoteEditLock failed: ${error.message}`);
    return rowToNoteNode(data as unknown as NoteRow);
  }

  /** Read current version, return version + 1 (LWW bump helper). */
  private async nextVersion(id: string, label: string): Promise<number> {
    const { data, error } = await this.client
      .from("notes")
      .select("version")
      .eq("id", id)
      .single();
    if (error) throw new Error(`${label} failed: ${error.message}`);
    return ((data as { version: number }).version ?? 0) + 1;
  }
}

/*
 * Note Links domain (S3-3). VERSIONED (version + soft-delete), LWW on
 * `id`. 1:1 port of src-tauri/src/db/note_link_repository.rs. The Tauri
 * upsert/delete paths SOFT-delete stale rows (so Cloud Sync LWW
 * propagates removals) then INSERT fresh `nl-<uuid>` rows with version 1
 * — replicated exactly. `source_memo_date` is the 0005 canonical column
 * name for the daily-memo source (legacy SQLite name was
 * `source_daily_date`).
 */
class SupabaseNoteLinkService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async fetchAllNoteLinks(): Promise<NoteLink[]> {
    const { data, error } = await this.client
      .from("note_links")
      .select(NOTE_LINK_SELECT_COLUMNS)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`fetchAllNoteLinks failed: ${error.message}`);
    return (data as unknown as NoteLinkRow[]).map(rowToNoteLink);
  }

  async fetchForwardLinksForNote(sourceNoteId: string): Promise<NoteLink[]> {
    const { data, error } = await this.client
      .from("note_links")
      .select(NOTE_LINK_SELECT_COLUMNS)
      .eq("source_note_id", sourceNoteId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true });
    if (error)
      throw new Error(`fetchForwardLinksForNote failed: ${error.message}`);
    return (data as unknown as NoteLinkRow[]).map(rowToNoteLink);
  }

  /**
   * Tauri `fetch_backlinks`: links INTO target with the source note's
   * title + a 200-char content preview joined in. PostgREST embeds the
   * FK relation (note_links.source_note_id -> notes) and the mapper
   * splits the embedded note off. The Rust query LEFT JOINs (a daily-memo
   * source has no note row) so the embed is nullable here too. Preview is
   * sliced to 200 chars client-side (mirrors the SQLite
   * `substr(content,1,200)`).
   */
  async fetchBacklinksForNote(targetNoteId: string): Promise<BacklinkHit[]> {
    const { data, error } = await this.client
      .from("note_links")
      .select(
        `${NOTE_LINK_SELECT_COLUMNS}, source:notes!note_links_source_note_id_fkey(title, content)`,
      )
      .eq("target_note_id", targetNoteId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });
    if (error)
      throw new Error(`fetchBacklinksForNote failed: ${error.message}`);
    type EmbeddedRow = NoteLinkRow & {
      source: { title: string | null; content: string | null } | null;
    };
    return (data as unknown as EmbeddedRow[]).map((r) => {
      const { source, ...linkRow } = r;
      return {
        link: rowToNoteLink(linkRow),
        sourceTitle: source?.title ?? null,
        sourcePreview:
          source?.content != null ? source.content.slice(0, 200) : null,
      };
    });
  }

  /**
   * Tauri `upsert_links_for_note`: soft-delete every non-deleted link
   * from this source (version + 1, is_deleted=1, deleted_at/updated_at
   * now), then INSERT a fresh `nl-<uuid>` row per payload (version 1,
   * link_type defaults to 'inline'). Replaces the full forward-link set.
   */
  async upsertNoteLinksForNote(
    sourceNoteId: string,
    links: NoteLinkPayload[],
  ): Promise<void> {
    await this.replaceLinks("source_note_id", sourceNoteId, links, {
      source_note_id: sourceNoteId,
      source_memo_date: null,
    });
  }

  /** Same as upsertNoteLinksForNote but keyed by a daily-memo date. */
  async upsertNoteLinksForDaily(
    sourceDailyDate: string,
    links: NoteLinkPayload[],
  ): Promise<void> {
    await this.replaceLinks("source_memo_date", sourceDailyDate, links, {
      source_note_id: null,
      source_memo_date: sourceDailyDate,
    });
  }

  /** Tauri `delete_links_for_note`: soft-delete all from this source. */
  async deleteNoteLinksForNote(sourceNoteId: string): Promise<void> {
    await this.softDeleteFrom("source_note_id", sourceNoteId);
  }

  private async replaceLinks(
    sourceColumn: "source_note_id" | "source_memo_date",
    sourceValue: string,
    links: NoteLinkPayload[],
    sourceCols: {
      source_note_id: string | null;
      source_memo_date: string | null;
    },
  ): Promise<void> {
    await this.softDeleteFrom(sourceColumn, sourceValue);
    if (links.length === 0) return;
    const now = new Date().toISOString();
    const rows = links.map((link) => ({
      id: `nl-${crypto.randomUUID()}`,
      ...sourceCols,
      target_note_id: link.targetNoteId,
      target_heading: link.targetHeading ?? null,
      target_block_id: link.targetBlockId ?? null,
      alias: link.alias ?? null,
      link_type: link.linkType ?? "inline",
      created_at: now,
      updated_at: now,
      is_deleted: false,
      deleted_at: null,
      version: 1,
    }));
    const { error } = await this.client.from("note_links").insert(rows);
    if (error) throw new Error(`upsertNoteLinks failed: ${error.message}`);
  }

  /**
   * Soft-delete (NOT physical) every currently-live link from a source —
   * version + 1 so Cloud Sync LWW propagates the removal (Tauri parity:
   * the SQLite path sets is_deleted=1 + version=version+1, never DELETEs).
   * version+1 is read-then-written per row because PostgREST has no
   * relative `version + 1` in a bulk update.
   */
  private async softDeleteFrom(
    sourceColumn: "source_note_id" | "source_memo_date",
    sourceValue: string,
  ): Promise<void> {
    const { data: live, error: readErr } = await this.client
      .from("note_links")
      .select("id, version")
      .eq(sourceColumn, sourceValue)
      .eq("is_deleted", false);
    if (readErr) throw new Error(`deleteNoteLinks failed: ${readErr.message}`);
    const rows = (live as Array<{ id: string; version: number }>) ?? [];
    if (rows.length === 0) return;
    const now = new Date().toISOString();
    for (const row of rows) {
      const { error } = await this.client
        .from("note_links")
        .update({
          is_deleted: true,
          deleted_at: now,
          updated_at: now,
          version: (row.version ?? 0) + 1,
        })
        .eq("id", row.id);
      if (error) throw new Error(`deleteNoteLinks failed: ${error.message}`);
    }
  }

  /**
   * Tauri `fetch_unlinked_mentions` (note_link_repository.rs) ported 1:1:
   *  1. load the source note's content (is_deleted=0); empty -> [].
   *  2. collect existing forward-link target ids to EXCLUDE
   *     (source_note_id=?, is_deleted=0).
   *  3. candidate pool = every OTHER non-deleted note with a non-empty
   *     title; a title shorter than 2 chars is skipped (noise guard,
   *     matching the Rust `title.len() < 2`).
   *  4. emit a hit when the candidate title occurs verbatim in the
   *     source content.
   * The matching is done client-side (substring containment), exactly
   * like the SQLite version's in-Rust loop — NOT a SQL LIKE — so the
   * behaviour is byte-identical. NOTE: `String.length` counts UTF-16 code
   * units while Rust `str::len()` counts UTF-8 bytes; for the 2-char
   * noise guard this differs only for sub-2-codepoint non-ASCII titles,
   * an acceptable parity gap for a heuristic (documented, not silently
   * diverged).
   */
  async fetchUnlinkedMentions(
    sourceNoteId: string,
  ): Promise<UnlinkedMention[]> {
    const { data: src, error: srcErr } = await this.client
      .from("notes")
      .select("content")
      .eq("id", sourceNoteId)
      .eq("is_deleted", false)
      .maybeSingle();
    if (srcErr)
      throw new Error(`fetchUnlinkedMentions failed: ${srcErr.message}`);
    const sourceContent = (src as { content: string } | null)?.content ?? "";
    if (sourceContent.length === 0) return [];

    const { data: linked, error: linkedErr } = await this.client
      .from("note_links")
      .select("target_note_id")
      .eq("source_note_id", sourceNoteId)
      .eq("is_deleted", false);
    if (linkedErr)
      throw new Error(`fetchUnlinkedMentions failed: ${linkedErr.message}`);
    const linkedIds = new Set(
      (linked as Array<{ target_note_id: string }>).map(
        (r) => r.target_note_id,
      ),
    );

    const { data: pool, error: poolErr } = await this.client
      .from("notes")
      .select("id, title")
      .neq("id", sourceNoteId)
      .eq("is_deleted", false)
      .not("title", "is", null)
      .neq("title", "");
    if (poolErr)
      throw new Error(`fetchUnlinkedMentions failed: ${poolErr.message}`);

    const hits: UnlinkedMention[] = [];
    for (const row of pool as Array<{ id: string; title: string }>) {
      if (linkedIds.has(row.id)) continue;
      if (row.title.length < 2) continue;
      if (sourceContent.includes(row.title)) {
        hits.push({
          sourceNoteId,
          sourceTitle: row.title,
          matchText: row.title,
        });
      }
    }
    return hits;
  }
}

/*
 * Note Connections domain (S3-3). RELATION table (no version, no
 * soft-delete) — physically deleted, exactly like the Tauri
 * src-tauri/src/db/note_connection_repository.rs (`DELETE FROM ...`).
 * The NoteConnection contract is minimal (id / sourceNoteId /
 * targetNoteId / createdAt — wikiTag.ts ~L40); the Rust struct also
 * carries an updated_at column but neither the TS type nor 0005 schema
 * expose it, so it is intentionally not modelled here.
 */
class SupabaseNoteConnectionService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async fetchNoteConnections(): Promise<NoteConnection[]> {
    const { data, error } = await this.client
      .from("note_connections")
      .select("id, source_note_id, target_note_id, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(`fetchNoteConnections failed: ${error.message}`);
    return (
      data as unknown as Array<{
        id: string;
        source_note_id: string;
        target_note_id: string;
        created_at: string;
      }>
    ).map((r) => ({
      id: r.id,
      sourceNoteId: r.source_note_id,
      targetNoteId: r.target_note_id,
      createdAt: r.created_at,
    }));
  }

  /** Tauri `create`: `nc-<uuid>` id, physical INSERT. */
  async createNoteConnection(
    sourceNoteId: string,
    targetNoteId: string,
  ): Promise<NoteConnection> {
    const id = `nc-${crypto.randomUUID()}`;
    const { data, error } = await this.client
      .from("note_connections")
      .insert({
        id,
        source_note_id: sourceNoteId,
        target_note_id: targetNoteId,
        created_at: new Date().toISOString(),
      })
      .select("id, source_note_id, target_note_id, created_at")
      .single();
    if (error) throw new Error(`createNoteConnection failed: ${error.message}`);
    const r = data as {
      id: string;
      source_note_id: string;
      target_note_id: string;
      created_at: string;
    };
    return {
      id: r.id,
      sourceNoteId: r.source_note_id,
      targetNoteId: r.target_note_id,
      createdAt: r.created_at,
    };
  }

  /** Tauri `delete`: physical DELETE by id. */
  async deleteNoteConnection(id: string): Promise<void> {
    const { error } = await this.client
      .from("note_connections")
      .delete()
      .eq("id", id);
    if (error) throw new Error(`deleteNoteConnection failed: ${error.message}`);
  }

  /**
   * Tauri `delete_by_note_pair`: physically delete BOTH directions of
   * the pair ((s,t) OR (t,s)). PostgREST `.or()` with a paired
   * `and(...)` reproduces the SQLite bidirectional WHERE. Both ids are
   * routed through `pgrstQuoteValue` (the same helper `searchNotes` uses)
   * so a crafted id cannot inject extra or-filter legs and widen the
   * DELETE beyond the intended pair.
   */
  async deleteNoteConnectionByPair(
    sourceNoteId: string,
    targetNoteId: string,
  ): Promise<void> {
    const s = pgrstQuoteValue(sourceNoteId);
    const t = pgrstQuoteValue(targetNoteId);
    const { error } = await this.client
      .from("note_connections")
      .delete()
      .or(
        `and(source_note_id.eq.${s},target_note_id.eq.${t}),` +
          `and(source_note_id.eq.${t},target_note_id.eq.${s})`,
      );
    if (error)
      throw new Error(`deleteNoteConnectionByPair failed: ${error.message}`);
  }
}

const PHASE2_TASKS_METHODS = new Set<string>([
  "fetchTaskTree",
  "fetchDeletedTasks",
  "createTask",
  "updateTask",
  "syncTaskTree",
  "softDeleteTask",
  "restoreTask",
  "permanentDeleteTask",
  "migrateTasksToBackend",
]);

const PHASE2_DAILY_METHODS = new Set<string>([
  "fetchAllDailies",
  "fetchDailyByDate",
  "fetchDeletedDailies",
  "upsertDaily",
  "deleteDaily",
  "restoreDaily",
  "permanentDeleteDaily",
  "toggleDailyPin",
  "toggleDailyEditLock",
  "setDailyPassword",
  "removeDailyPassword",
  "verifyDailyPassword",
]);

const PHASE2_NOTES_METHODS = new Set<string>([
  "fetchAllNotes",
  "fetchDeletedNotes",
  "createNote",
  "createNoteFolder",
  "updateNote",
  "syncNoteTree",
  "softDeleteNote",
  "restoreNote",
  "permanentDeleteNote",
  "searchNotes",
  "setNotePassword",
  "removeNotePassword",
  "verifyNotePassword",
  "toggleNoteEditLock",
]);

const PHASE2_NOTE_LINK_METHODS = new Set<string>([
  "fetchAllNoteLinks",
  "fetchForwardLinksForNote",
  "fetchBacklinksForNote",
  "upsertNoteLinksForNote",
  "upsertNoteLinksForDaily",
  "deleteNoteLinksForNote",
  "fetchUnlinkedMentions",
]);

const PHASE2_NOTE_CONNECTION_METHODS = new Set<string>([
  "fetchNoteConnections",
  "createNoteConnection",
  "deleteNoteConnection",
  "deleteNoteConnectionByPair",
]);

/**
 * Create a Phase 2 Supabase-backed DataService.
 *
 * Implemented: the full tasks domain (9 methods) + the full daily domain
 * (12 methods) + the notes domain (S3: 14 note methods + 7 note-link
 * methods + 4 note-connection methods — full CRUD / hierarchy / search /
 * soft-delete / versioning / password gate, plus versioned note links and
 * the relation-table note connections). Everything else throws "not
 * implemented in phase 2".
 *
 * Each domain is its own class; a single Proxy routes a property to the
 * service that owns it (allow-set lookup) and binds the call to that
 * instance so `this.client` resolves on the real target.
 *
 * Credentials are read from Vite env (`VITE_SUPABASE_URL` /
 * `VITE_SUPABASE_ANON_KEY`), validated lazily so importing this module
 * does not crash builds before the Supabase project exists.
 */
export function createSupabaseDataService(): DataService {
  const client = getSupabaseClient();
  const tasksService = new SupabaseTasksService(client);
  const dailyService = new SupabaseDailyService(client);
  const notesService = new SupabaseNotesService(client);
  const noteLinkService = new SupabaseNoteLinkService(client);
  const noteConnectionService = new SupabaseNoteConnectionService(client);

  // Dispatch table: method name -> the instance that implements it. The
  // Proxy's target is arbitrary (an empty object); routing is entirely
  // by this map so adding a domain is one entry, no target juggling.
  const route = (prop: string): object | null => {
    if (PHASE2_TASKS_METHODS.has(prop)) return tasksService;
    if (PHASE2_DAILY_METHODS.has(prop)) return dailyService;
    if (PHASE2_NOTES_METHODS.has(prop)) return notesService;
    if (PHASE2_NOTE_LINK_METHODS.has(prop)) return noteLinkService;
    if (PHASE2_NOTE_CONNECTION_METHODS.has(prop)) return noteConnectionService;
    return null;
  };

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== "string") {
          return () => {
            throw new Error(`${String(prop)}: not implemented in phase 2`);
          };
        }
        const owner = route(prop);
        if (owner) {
          // Bind to the owning instance so `this.client` resolves on the
          // real target, not back through this trap.
          const value = Reflect.get(owner, prop) as (
            ...args: unknown[]
          ) => unknown;
          return value.bind(owner);
        }
        return () => {
          throw new Error(`${prop}: not implemented in phase 2`);
        };
      },
    },
  ) as unknown as DataService;
}

// Re-exported for round-trip unit testing + host convenience.
export { rowToTaskNode, taskNodeToRow, taskUpdatesToPatch } from "./taskMapper";
export type { TaskRow, TaskWriteRow } from "./taskMapper";
export { rowToDailyNode, dailyNodeToRow } from "./dailyMapper";
export type { DailyRow, DailyWriteRow } from "./dailyMapper";
export {
  rowToNoteNode,
  noteNodeToRow,
  noteUpdatesToPatch,
  toNoteNodeType,
} from "./noteMapper";
export type { NoteRow, NoteWriteRow } from "./noteMapper";
export { rowToNoteLink, noteLinkToRow, toNoteLinkType } from "./noteLinkMapper";
export type { NoteLinkRow, NoteLinkWriteRow } from "./noteLinkMapper";
