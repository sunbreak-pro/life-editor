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
// DU-B-3: full SupabaseTasksService rewrite over items_meta +
// tasks_payload. Pure mapping lives in taskMapper.ts; this file is the
// I/O layer only. Re-exports at the bottom of this file keep one stable
// surface for host modules and the round-trip harness.
import {
  ITEMS_META_TASK_COLUMNS,
  TASKS_PAYLOAD_COLUMNS,
  rowsToTaskNode,
  taskNodeToRows,
  taskUpdatesToPatches,
  type ItemsMetaRow,
  type TasksPayloadRow,
} from "./taskMapper";
import { collectDescendantIds } from "../utils/getDescendantTasks";
import { sortByDepthDesc } from "../utils/sortByDepthDesc";
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
import type { CalendarNode } from "../types/calendar";
import type { RoutineNode } from "../types/routine";
import type { CalendarTag } from "../types/calendarTag";
import type { ScheduleItem } from "../types/schedule";
import type {
  RoutineGroup,
  RoutineGroupAssignment,
} from "../types/routineGroup";
import {
  ROUTINE_SELECT_COLUMNS,
  rowToRoutine,
  routineUpdatesToPatch,
  type RoutineRow,
} from "./routineMapper";
import {
  ROUTINE_GROUP_SELECT_COLUMNS,
  rowToRoutineGroup,
  routineGroupUpdatesToPatch,
  type RoutineGroupRow,
} from "./routineGroupMapper";
import {
  ROUTINE_GROUP_ASSIGNMENT_SELECT_COLUMNS,
  rowToRoutineGroupAssignment,
  type RoutineGroupAssignmentRow,
} from "./routineGroupAssignmentMapper";
import {
  SCHEDULE_ITEM_SELECT_COLUMNS,
  rowToScheduleItem,
  scheduleItemUpdatesToPatch,
  type ScheduleItemRow,
} from "./scheduleItemMapper";
import {
  CALENDAR_SELECT_COLUMNS,
  rowToCalendar,
  calendarUpdatesToPatch,
  type CalendarRow,
} from "./calendarMapper";
import {
  CALENDAR_TAG_DEFINITION_SELECT_COLUMNS,
  rowToCalendarTag,
  calendarTagUpdatesToPatch,
  type CalendarTagDefinitionRow,
} from "./calendarTagDefinitionMapper";
import {
  CALENDAR_TAG_ASSIGNMENT_SELECT_COLUMNS,
  type CalendarTagAssignmentRow,
} from "./calendarTagAssignmentMapper";

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

/*
 * Tasks domain (DU-B-3). Full 9-method rewrite over the items_meta
 * (role='task') + tasks_payload 2-row split introduced in migration
 * 0008 and hardened by 0009 (composite FK + parent_item_role generated
 * stored). Pure mapping lives in taskMapper.ts; this class is the I/O
 * layer only.
 *
 * Write-path invariants enforced here (parent SSOT:
 * docs/vision/plans/2026-05-21-data-unification-items-meta.md +
 * 2026-05-23-data-unification-b-tasks.md):
 *
 *   - DB-Q1 hard-delete on createTask payload failure (R2): a successful
 *     items_meta INSERT followed by a failed tasks_payload INSERT would
 *     leave an orphan meta row that no other code path can reach (role=
 *     task without a payload is not surfaced by fetchTaskTree). The
 *     try/catch hard-deletes the orphan so the next operation starts
 *     from a clean state and Cloud Sync LWW does not propagate a
 *     half-born row.
 *
 *   - DB-Q2 updated_at bump (R3): items_meta.updated_at is the LWW
 *     cursor for Sync; tasks_payload has no own updated_at. Every write
 *     path that touches a row MUST bump items_meta.updated_at, including
 *     payload-only updates and soft-delete / restore. The mapper's
 *     taskUpdatesToPatches always sets metaPatch.updated_at; soft /
 *     restore set it explicitly; permanentDelete physically removes the
 *     row so a bump is moot.
 *
 *   - DB-Q3 composite FK ON DELETE NO ACTION (v3-rev2):
 *     permanentDeleteTask deletes descendants before their parent so PG
 *     never rejects a parent DELETE while a child payload still
 *     references it. The order is computed by sortByDepthDesc against
 *     the union of live + trashed pool so trashed children of a
 *     soft-deleted root are also purged in the right order.
 *
 * migrateTasksToBackend is a deliberate no-op on web (Supabase-native;
 * nothing to migrate). Kept to satisfy the DataService interface.
 */
class SupabaseTasksService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * Resolve the authenticated user id for INSERT paths. RLS would
   * default user_id to auth.uid() on its own, but writing it explicitly
   * mirrors the Tauri contract and keeps cross-device payloads
   * deterministic. Throws if the caller is not signed in — every Tasks
   * write path is auth-gated upstream.
   */
  private async getUserId(): Promise<string> {
    const { data, error } = await this.client.auth.getUser();
    if (error) throw new Error(`getUserId failed: ${error.message}`);
    const uid = data.user?.id;
    if (!uid) throw new Error("getUserId failed: not authenticated");
    return uid;
  }

  /**
   * Bump items_meta.updated_at for write paths that do NOT route through
   * the mapper (which auto-injects updated_at into metaPatch). Used only
   * by code paths that touch items_meta directly without taskUpdates.
   * NOTE: currently inlined into softDelete / restore so the bump and
   * the state change happen in one UPDATE — kept here as the canonical
   * helper for future single-column writes.
   */
  private async bumpItemsMetaUpdatedAt(
    itemId: string,
    now: string,
  ): Promise<void> {
    const { error } = await this.client
      .from("items_meta")
      .update({ updated_at: now })
      .eq("id", itemId);
    if (error)
      throw new Error(`bumpItemsMetaUpdatedAt failed: ${error.message}`);
  }

  /**
   * Read all live tasks. Two SELECTs (items_meta then tasks_payload)
   * joined in-app: the role=task filter and the explicit shape match
   * keep query intent reviewable, and a missing payload row (R2
   * orphan) is silently dropped from the result so a half-born row
   * never surfaces in the UI. The orphan is still detectable via the
   * R2 detection SQL in db-conventions.md.
   */
  async fetchTaskTree(): Promise<TaskNode[]> {
    const { data: metas, error: metaErr } = await this.client
      .from("items_meta")
      .select(ITEMS_META_TASK_COLUMNS)
      .eq("role", "task")
      .eq("is_deleted", false);
    if (metaErr)
      throw new Error(`fetchTaskTree items_meta: ${metaErr.message}`);
    const metaRows = (metas as unknown as ItemsMetaRow[]) ?? [];
    if (metaRows.length === 0) return [];

    const ids = metaRows.map((m) => m.id);
    const { data: payloads, error: pErr } = await this.client
      .from("tasks_payload")
      .select(TASKS_PAYLOAD_COLUMNS)
      .in("item_id", ids);
    if (pErr) throw new Error(`fetchTaskTree tasks_payload: ${pErr.message}`);
    const payloadRows = (payloads as unknown as TasksPayloadRow[]) ?? [];
    const payloadById = new Map<string, TasksPayloadRow>();
    for (const p of payloadRows) payloadById.set(p.item_id, p);

    const out: TaskNode[] = [];
    for (const m of metaRows) {
      const p = payloadById.get(m.id);
      if (!p) continue; // R2 orphan: meta without payload — skip
      out.push(rowsToTaskNode(m, p));
    }
    return out;
  }

  /** Trashed counterpart of fetchTaskTree (Trash UI). */
  async fetchDeletedTasks(): Promise<TaskNode[]> {
    const { data: metas, error: metaErr } = await this.client
      .from("items_meta")
      .select(ITEMS_META_TASK_COLUMNS)
      .eq("role", "task")
      .eq("is_deleted", true);
    if (metaErr)
      throw new Error(`fetchDeletedTasks items_meta: ${metaErr.message}`);
    const metaRows = (metas as unknown as ItemsMetaRow[]) ?? [];
    if (metaRows.length === 0) return [];

    const ids = metaRows.map((m) => m.id);
    const { data: payloads, error: pErr } = await this.client
      .from("tasks_payload")
      .select(TASKS_PAYLOAD_COLUMNS)
      .in("item_id", ids);
    if (pErr)
      throw new Error(`fetchDeletedTasks tasks_payload: ${pErr.message}`);
    const payloadRows = (payloads as unknown as TasksPayloadRow[]) ?? [];
    const payloadById = new Map<string, TasksPayloadRow>();
    for (const p of payloadRows) payloadById.set(p.item_id, p);

    const out: TaskNode[] = [];
    for (const m of metaRows) {
      const p = payloadById.get(m.id);
      if (!p) continue;
      out.push(rowsToTaskNode(m, p));
    }
    return out;
  }

  /**
   * Insert items_meta then tasks_payload. The mapper guarantees the
   * INSERT shape; the try/catch implements R2's hard-delete recovery
   * (DB-Q1): if the payload INSERT fails for ANY reason (network, FK
   * violation on parent_item_id, RLS rejection), the meta row is
   * physically removed so no orphan persists. The hard-delete itself
   * may also fail (e.g. NW dropped after the first INSERT); in that
   * case the throw escapes the catch and the daily R2 detection SQL
   * (Recovery Playbook) sweeps the orphan up later.
   */
  async createTask(node: TaskNode): Promise<TaskNode> {
    const userId = await this.getUserId();
    const { meta, payload } = taskNodeToRows(node, userId);

    const { data: metaRow, error: metaErr } = await this.client
      .from("items_meta")
      .insert(meta)
      .select(ITEMS_META_TASK_COLUMNS)
      .single();
    if (metaErr) throw new Error(`createTask items_meta: ${metaErr.message}`);

    try {
      const { data: payloadRow, error: pErr } = await this.client
        .from("tasks_payload")
        .insert(payload)
        .select(TASKS_PAYLOAD_COLUMNS)
        .single();
      if (pErr) throw new Error(`createTask tasks_payload: ${pErr.message}`);
      return rowsToTaskNode(
        metaRow as unknown as ItemsMetaRow,
        payloadRow as unknown as TasksPayloadRow,
      );
    } catch (err) {
      // R2 hard-delete: remove the orphan meta. A failure here is
      // logged via the thrown error context but does NOT mask the
      // original payload-INSERT failure (rethrow err, not cleanupErr).
      await this.client.from("items_meta").delete().eq("id", meta.id);
      throw err;
    }
  }

  /**
   * Mapper-driven dual UPDATE. metaPatch ALWAYS carries updated_at
   * (DB-Q2 enforcement is in taskUpdatesToPatches, not here). payload
   * UPDATE is skipped when payloadPatch is empty so a metadata-only
   * change (e.g. title) doesn't issue a no-op tasks_payload write.
   * The final read joins the two rows back into a TaskNode — atomic
   * row-snapshot from the caller's perspective even though PostgREST
   * cannot wrap the two writes in a transaction.
   */
  async updateTask(id: string, updates: Partial<TaskNode>): Promise<TaskNode> {
    const userId = await this.getUserId();
    const now = new Date().toISOString();
    const { metaPatch, payloadPatch } = taskUpdatesToPatches(
      updates,
      userId,
      now,
    );

    // items_meta UPDATE (metaPatch.updated_at is guaranteed present).
    const { error: metaErr } = await this.client
      .from("items_meta")
      .update(metaPatch)
      .eq("id", id);
    if (metaErr) throw new Error(`updateTask items_meta: ${metaErr.message}`);

    if (Object.keys(payloadPatch).length > 0) {
      const { error: pErr } = await this.client
        .from("tasks_payload")
        .update(payloadPatch)
        .eq("item_id", id);
      if (pErr) throw new Error(`updateTask tasks_payload: ${pErr.message}`);
    }

    // Read-back both rows to materialise the returned TaskNode. Parallel
    // SELECTs because they are independent and small.
    const [
      { data: metaRow, error: metaReadErr },
      { data: payloadRow, error: payloadReadErr },
    ] = await Promise.all([
      this.client
        .from("items_meta")
        .select(ITEMS_META_TASK_COLUMNS)
        .eq("id", id)
        .single(),
      this.client
        .from("tasks_payload")
        .select(TASKS_PAYLOAD_COLUMNS)
        .eq("item_id", id)
        .single(),
    ]);
    if (metaReadErr)
      throw new Error(`updateTask read items_meta: ${metaReadErr.message}`);
    if (payloadReadErr)
      throw new Error(
        `updateTask read tasks_payload: ${payloadReadErr.message}`,
      );
    return rowsToTaskNode(
      metaRow as unknown as ItemsMetaRow,
      payloadRow as unknown as TasksPayloadRow,
    );
  }

  /**
   * Bulk UPSERT for tree-structural rebuilds (DnD reorders that touch
   * many siblings). Two PostgREST upserts keyed on `id` / `item_id`
   * respectively. Each call to the mapper supplies a fresh meta+payload
   * pair, so an UPSERT against an existing row overwrites every column
   * including version — callers that need version-aware merging must
   * compose updateTask instead.
   */
  async syncTaskTree(nodes: TaskNode[]): Promise<void> {
    if (nodes.length === 0) return;
    const userId = await this.getUserId();
    const now = new Date().toISOString();
    const rowsPairs = nodes.map((n) => taskNodeToRows(n, userId));

    // DB-Q2 enforcement on the UPSERT-as-UPDATE branch. taskNodeToRows
    // omits `updated_at` from the meta INSERT row because the items_meta
    // column has `DEFAULT now()` — which only fires on a real INSERT. A
    // PostgREST upsert that hits an existing row becomes a straight
    // UPDATE, and items_meta has no UPDATE-side trigger to refresh
    // updated_at (migration 0008). Without an explicit bump here, a
    // syncTaskTree-driven structural change (e.g. a DnD reorder that
    // rewrites every sibling) would leave updated_at stale and Sync's
    // LWW cursor would never propagate the move. Spread `updated_at:
    // now` so the bump is structural, not caller-dependent.
    const { error: metaErr } = await this.client.from("items_meta").upsert(
      rowsPairs.map((r) => ({ ...r.meta, updated_at: now })),
      { onConflict: "id" },
    );
    if (metaErr) throw new Error(`syncTaskTree items_meta: ${metaErr.message}`);

    const { error: pErr } = await this.client.from("tasks_payload").upsert(
      rowsPairs.map((r) => r.payload),
      { onConflict: "item_id" },
    );
    if (pErr) throw new Error(`syncTaskTree tasks_payload: ${pErr.message}`);
  }

  /**
   * Flip is_deleted=true on items_meta with the matching deleted_at +
   * updated_at bump (DB-Q2). tasks_payload is left untouched: the 1:1
   * FK keeps the payload reachable via the trashed meta, and a restore
   * needs the payload columns intact.
   */
  async softDeleteTask(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("items_meta")
      .update({ is_deleted: true, deleted_at: now, updated_at: now })
      .eq("id", id);
    if (error) throw new Error(`softDeleteTask: ${error.message}`);
  }

  /** Inverse of softDeleteTask. updated_at is bumped (DB-Q2). */
  async restoreTask(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("items_meta")
      .update({ is_deleted: false, deleted_at: null, updated_at: now })
      .eq("id", id);
    if (error) throw new Error(`restoreTask: ${error.message}`);
  }

  /**
   * Physical purge with descendants-first ordering (DB-Q3). The
   * composite FK introduced by 0009 is ON DELETE NO ACTION: PG rejects
   * a parent DELETE while a child payload still references it. The
   * pool is live + trashed so a trashed root with trashed children is
   * also purged in a single call. tasks_payload rows are cleaned up by
   * the 0008 ON DELETE CASCADE FK to items_meta — only items_meta
   * needs explicit DELETE statements.
   */
  async permanentDeleteTask(id: string): Promise<void> {
    const [live, deleted] = await Promise.all([
      this.fetchTaskTree(),
      this.fetchDeletedTasks(),
    ]);
    const pool = [...live, ...deleted];

    // collectDescendantIds includes `id` itself in the returned Set.
    const descendantIds = collectDescendantIds(id, pool);
    const idsToDelete = sortByDepthDesc([...descendantIds], pool);

    for (const did of idsToDelete) {
      const { error } = await this.client
        .from("items_meta")
        .delete()
        .eq("id", did);
      if (error)
        throw new Error(`permanentDeleteTask ${did}: ${error.message}`);
    }
  }

  /**
   * Web no-op stub (user-confirmed). On Tauri this migrated local
   * SQLite tasks into the cloud backend; the web build is Supabase-
   * native so there is nothing to migrate. Kept to satisfy the
   * DataService interface and any caller that invokes it
   * unconditionally.
   */
  async migrateTasksToBackend(_nodes: TaskNode[]): Promise<void> {
    void _nodes;
    void this.client; // explicit no-op — bound method but does not touch DB
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

/*
 * Routines domain (S4-2). VERSIONED + soft-delete (TrashView-restorable,
 * CLAUDE.md §4.4). 1:1 port of src-tauri/src/db/routine_repository.rs.
 *
 * `version` is bumped on every mutation (mirrors the SQLite
 * `version = version + 1`); PostgREST cannot express a relative
 * `version + 1` so it is read-then-written (same shape as the notes
 * domain). `softDeleteRoutine` is the Issue 017 anti-ghost path: it
 * SOFT-deletes the routine AND its non-completed derived schedule_items
 * in one logical operation and returns the cascaded ids (physical DELETE
 * would leave no Cloud Sync delta, so other devices would push the items
 * back — see routine_repository.rs `soft_delete` comment). `frequency_days`
 * is the JSON-array-string column; the mapper owns the parse/stringify.
 */
class SupabaseRoutinesService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * Tauri `fetch_all`: `is_archived = 0 AND is_deleted = 0
   * ORDER BY "order" ASC, created_at ASC`. PostgREST stacks .order()
   * calls in call order so the two-key sort is reproduced exactly.
   */
  async fetchAllRoutines(): Promise<RoutineNode[]> {
    const { data, error } = await this.client
      .from("routines")
      .select(ROUTINE_SELECT_COLUMNS)
      .eq("is_archived", false)
      .eq("is_deleted", false)
      .order("order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(`fetchAllRoutines failed: ${error.message}`);
    return (data as unknown as RoutineRow[]).map(rowToRoutine);
  }

  async fetchDeletedRoutines(): Promise<RoutineNode[]> {
    const { data, error } = await this.client
      .from("routines")
      .select(ROUTINE_SELECT_COLUMNS)
      .eq("is_deleted", true)
      .order("deleted_at", { ascending: false });
    if (error) throw new Error(`fetchDeletedRoutines failed: ${error.message}`);
    return (data as unknown as RoutineRow[]).map(rowToRoutine);
  }

  /**
   * Tauri `create`: `"order"` = MAX("order") + 1 (global, not per-user —
   * RLS already scopes the SELECT to the caller's rows), is_archived=0,
   * is_visible=1, version default 1, frequency_type default 'daily',
   * frequency_days default '[]'. `user_id` is RLS-derived and never sent.
   */
  async createRoutine(
    id: string,
    title: string,
    startTime?: string,
    endTime?: string,
    frequencyType?: string,
    frequencyDays?: number[],
    frequencyInterval?: number | null,
    frequencyStartDate?: string | null,
    reminderEnabled?: boolean,
    reminderOffset?: number,
  ): Promise<RoutineNode> {
    const nextOrder = await this.nextOrder();
    const now = new Date().toISOString();
    const payload = {
      id,
      title,
      start_time: startTime ?? null,
      end_time: endTime ?? null,
      is_archived: false,
      is_visible: true,
      is_deleted: false,
      deleted_at: null,
      order: nextOrder,
      version: 1,
      frequency_type: frequencyType ?? "daily",
      frequency_days: JSON.stringify(frequencyDays ?? []),
      frequency_interval: frequencyInterval ?? null,
      frequency_start_date: frequencyStartDate ?? null,
      reminder_enabled: reminderEnabled ?? false,
      reminder_offset: reminderOffset ?? null,
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await this.client
      .from("routines")
      .insert(payload)
      .select(ROUTINE_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`createRoutine failed: ${error.message}`);
    return rowToRoutine(data as unknown as RoutineRow);
  }

  /**
   * Tauri `update`: only the whitelisted columns mutate
   * (routineUpdatesToPatch enforces the same surface). Empty patch =
   * re-read with NO version bump (Rust `if sets.is_empty()` short
   * circuit). Otherwise bump version + updated_at. version + 1 is
   * read-then-written (PostgREST has no relative increment).
   */
  async updateRoutine(
    id: string,
    updates: Partial<
      Pick<
        RoutineNode,
        | "title"
        | "startTime"
        | "endTime"
        | "isArchived"
        | "isVisible"
        | "order"
        | "frequencyType"
        | "frequencyDays"
        | "frequencyInterval"
        | "frequencyStartDate"
        | "reminderEnabled"
        | "reminderOffset"
      >
    >,
  ): Promise<RoutineNode> {
    const patch = routineUpdatesToPatch(updates);
    if (Object.keys(patch).length === 0) {
      const { data, error } = await this.client
        .from("routines")
        .select(ROUTINE_SELECT_COLUMNS)
        .eq("id", id)
        .single();
      if (error) throw new Error(`updateRoutine failed: ${error.message}`);
      return rowToRoutine(data as unknown as RoutineRow);
    }
    const next = await this.nextVersion(id, "updateRoutine");
    const { data, error } = await this.client
      .from("routines")
      .update({
        ...patch,
        version: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(ROUTINE_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`updateRoutine failed: ${error.message}`);
    return rowToRoutine(data as unknown as RoutineRow);
  }

  /** Tauri `delete`: physical DELETE by id (hard, no soft-delete). */
  async deleteRoutine(id: string): Promise<void> {
    const { error } = await this.client.from("routines").delete().eq("id", id);
    if (error) throw new Error(`deleteRoutine failed: ${error.message}`);
  }

  /**
   * Tauri `soft_delete` (routine_repository.rs) ported 1:1 — the Issue
   * 017 anti-ghost path. The Rust version runs a single transaction:
   *  1. collect the ids of non-completed, non-deleted schedule_items
   *     belonging to this routine,
   *  2. SOFT-delete them (is_deleted=1, deleted_at, version+1,
   *     updated_at) — NOT physical, so Cloud Sync LWW propagates the
   *     removal and other devices do not push the items back,
   *  3. SOFT-delete the routine itself (same shape).
   * PostgREST has no multi-statement transaction; the ordering here
   * (children first, then parent) keeps the invariant that a partial
   * failure never leaves the routine deleted while its items linger
   * visible. version+1 is read-then-written per row (no relative
   * increment). Returns the cascaded schedule_item ids exactly like the
   * Rust signature so the caller can prune local state (Issue 017 (b):
   * the routine_id-matched items are explicitly removed, not left to
   * resurrect).
   */
  async softDeleteRoutine(
    id: string,
  ): Promise<{ deletedScheduleItemIds: string[] }> {
    const { data: live, error: readErr } = await this.client
      .from("schedule_items")
      .select("id, version")
      .eq("routine_id", id)
      .eq("completed", false)
      .eq("is_deleted", false);
    if (readErr)
      throw new Error(`softDeleteRoutine failed: ${readErr.message}`);
    const rows = (live as Array<{ id: string; version: number }>) ?? [];
    const now = new Date().toISOString();
    for (const row of rows) {
      const { error } = await this.client
        .from("schedule_items")
        .update({
          is_deleted: true,
          deleted_at: now,
          version: (row.version ?? 0) + 1,
          updated_at: now,
        })
        .eq("id", row.id);
      if (error) throw new Error(`softDeleteRoutine failed: ${error.message}`);
    }
    const next = await this.nextVersion(id, "softDeleteRoutine");
    const { error: routineErr } = await this.client
      .from("routines")
      .update({
        is_deleted: true,
        deleted_at: now,
        version: next,
        updated_at: now,
      })
      .eq("id", id);
    if (routineErr)
      throw new Error(`softDeleteRoutine failed: ${routineErr.message}`);
    return { deletedScheduleItemIds: rows.map((r) => r.id) };
  }

  /** Tauri `restore`: clear soft-delete + version+1 + updated_at. */
  async restoreRoutine(id: string): Promise<void> {
    const next = await this.nextVersion(id, "restoreRoutine");
    const { error } = await this.client
      .from("routines")
      .update({
        is_deleted: false,
        deleted_at: null,
        version: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(`restoreRoutine failed: ${error.message}`);
  }

  /**
   * Tauri `permanent_delete`: physical DELETE guarded by
   * `is_deleted = 1` (only trashed routines can be purged).
   */
  async permanentDeleteRoutine(id: string): Promise<void> {
    const { error } = await this.client
      .from("routines")
      .delete()
      .eq("id", id)
      .eq("is_deleted", true);
    if (error)
      throw new Error(`permanentDeleteRoutine failed: ${error.message}`);
  }

  /** MAX("order") + 1 across the caller's routines (RLS-scoped SELECT). */
  private async nextOrder(): Promise<number> {
    const { data, error } = await this.client
      .from("routines")
      .select('"order"')
      .order("order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`createRoutine failed: ${error.message}`);
    const max = (data as { order: number } | null)?.order;
    return (max ?? -1) + 1;
  }

  /** Read current version, return version + 1 (LWW bump helper). */
  private async nextVersion(id: string, label: string): Promise<number> {
    const { data, error } = await this.client
      .from("routines")
      .select("version")
      .eq("id", id)
      .single();
    if (error) throw new Error(`${label} failed: ${error.message}`);
    return ((data as { version: number }).version ?? 0) + 1;
  }
}

/*
 * Routine Groups domain (S4-2). VERSIONED but PHYSICAL-delete (0006
 * deliberately omits is_deleted — the frontend never soft-deletes a
 * group). 1:1 port of src-tauri/src/db/routine_group_repository.rs.
 * `version` is bumped on every update (read-then-written, no relative
 * increment). `deleteRoutineGroup` is a hard DELETE (no soft-delete API
 * to map; the rga child rows cascade via the 0006 FK).
 */
class SupabaseRoutineGroupsService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /** Tauri `fetch_all`: `ORDER BY "order" ASC, created_at ASC`. */
  async fetchRoutineGroups(): Promise<RoutineGroup[]> {
    const { data, error } = await this.client
      .from("routine_groups")
      .select(ROUTINE_GROUP_SELECT_COLUMNS)
      .order("order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(`fetchRoutineGroups failed: ${error.message}`);
    return (data as unknown as RoutineGroupRow[]).map(rowToRoutineGroup);
  }

  /**
   * Tauri `create`: `"order"` = MAX("order") + 1, is_visible=1,
   * version default 1, frequency_type default 'daily', frequency_days
   * default '[]'. `user_id` RLS-derived.
   */
  async createRoutineGroup(
    id: string,
    name: string,
    color: string,
    frequencyType?: string,
    frequencyDays?: number[],
    frequencyInterval?: number | null,
    frequencyStartDate?: string | null,
  ): Promise<RoutineGroup> {
    const nextOrder = await this.nextOrder();
    const now = new Date().toISOString();
    const payload = {
      id,
      name,
      color,
      order: nextOrder,
      version: 1,
      frequency_type: frequencyType ?? "daily",
      frequency_days: JSON.stringify(frequencyDays ?? []),
      frequency_interval: frequencyInterval ?? null,
      frequency_start_date: frequencyStartDate ?? null,
      is_visible: true,
      created_at: now,
      updated_at: now,
    };
    const { data, error } = await this.client
      .from("routine_groups")
      .insert(payload)
      .select(ROUTINE_GROUP_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`createRoutineGroup failed: ${error.message}`);
    return rowToRoutineGroup(data as unknown as RoutineGroupRow);
  }

  /**
   * Tauri `update`: whitelisted columns only (routineGroupUpdatesToPatch
   * enforces the surface). Empty patch = re-read NO version bump (Rust
   * short circuit). Otherwise version + 1 (read-then-written) +
   * updated_at.
   */
  async updateRoutineGroup(
    id: string,
    updates: Partial<
      Pick<
        RoutineGroup,
        | "name"
        | "color"
        | "isVisible"
        | "order"
        | "frequencyType"
        | "frequencyDays"
        | "frequencyInterval"
        | "frequencyStartDate"
      >
    >,
  ): Promise<RoutineGroup> {
    const patch = routineGroupUpdatesToPatch(updates);
    if (Object.keys(patch).length === 0) {
      const { data, error } = await this.client
        .from("routine_groups")
        .select(ROUTINE_GROUP_SELECT_COLUMNS)
        .eq("id", id)
        .single();
      if (error) throw new Error(`updateRoutineGroup failed: ${error.message}`);
      return rowToRoutineGroup(data as unknown as RoutineGroupRow);
    }
    const next = await this.nextVersion(id, "updateRoutineGroup");
    const { data, error } = await this.client
      .from("routine_groups")
      .update({
        ...patch,
        version: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(ROUTINE_GROUP_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`updateRoutineGroup failed: ${error.message}`);
    return rowToRoutineGroup(data as unknown as RoutineGroupRow);
  }

  /**
   * Tauri `delete`: physical DELETE by id (no soft-delete column —
   * S4-0 confirmed). The 0006 FK cascades routine_group_assignments
   * children, so a deleted group cannot leave dangling junction rows.
   */
  async deleteRoutineGroup(id: string): Promise<void> {
    const { error } = await this.client
      .from("routine_groups")
      .delete()
      .eq("id", id);
    if (error) throw new Error(`deleteRoutineGroup failed: ${error.message}`);
  }

  private async nextOrder(): Promise<number> {
    const { data, error } = await this.client
      .from("routine_groups")
      .select('"order"')
      .order("order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`createRoutineGroup failed: ${error.message}`);
    const max = (data as { order: number } | null)?.order;
    return (max ?? -1) + 1;
  }

  private async nextVersion(id: string, label: string): Promise<number> {
    const { data, error } = await this.client
      .from("routine_groups")
      .select("version")
      .eq("id", id)
      .single();
    if (error) throw new Error(`${label} failed: ${error.message}`);
    return ((data as { version: number }).version ?? 0) + 1;
  }
}

/*
 * Routine Group Assignments domain (S4-2). RELATION + soft-delete, NO
 * version (delta sync pages it by updated_at — Issue 008
 * soft-delete-aware relation). 1:1 port of
 * src-tauri/src/db/routine_group_assignment_repository.rs.
 *
 * `fetchAll` returns ONLY live rows (is_deleted=false) — soft-deleted
 * rows stay in the table so Cloud Sync delta replicates the unassign,
 * but UI consumers must not see them. `setGroupsForRoutine` is the
 * replace-set diff: rows no longer in the new set are soft-deleted,
 * previously-deleted rows that reappear are restored, genuinely-new
 * pairs are inserted with `rga-<uuid>` ids, and the PARENT routine's
 * version + updated_at are bumped so the routine itself shows up in the
 * next delta-sync push (the junction has no version of its own).
 *
 * DELTA-SYNC NOTE (Issue 008): the cross-device delta query that pages
 * this relation by parent `updated_at` lives in the sync engine (S8),
 * NOT here — S4-2 only owns the CRUD + the parent version bump that
 * makes the relation visible to that future delta query.
 */
class SupabaseRoutineGroupAssignmentsService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * Tauri `fetch_all`: live rows only. Soft-deleted junction rows are
   * kept for Cloud Sync delta replication but hidden from UI.
   */
  async fetchAllRoutineGroupAssignments(): Promise<RoutineGroupAssignment[]> {
    const { data, error } = await this.client
      .from("routine_group_assignments")
      .select(ROUTINE_GROUP_ASSIGNMENT_SELECT_COLUMNS)
      .eq("is_deleted", false);
    if (error)
      throw new Error(
        `fetchAllRoutineGroupAssignments failed: ${error.message}`,
      );
    return (data as unknown as RoutineGroupAssignmentRow[]).map(
      rowToRoutineGroupAssignment,
    );
  }

  /**
   * Tauri `set_groups_for_routine` ported 1:1: load the routine's full
   * existing junction rows (live AND soft-deleted), then for each:
   *  - in the new set & currently soft-deleted -> restore
   *    (is_deleted=false, deleted_at=null, updated_at),
   *  - NOT in the new set & currently live -> soft-delete
   *    (is_deleted=true, deleted_at, updated_at — Issue 008 so the
   *    unassign replicates via delta sync, NOT a physical DELETE),
   * then INSERT a fresh `rga-<uuid>` row for every group_id with no
   * existing junction row at all. Finally bump the parent routine's
   * version + updated_at (the junction has no version; the parent's
   * bump is what the delta query keys on). PostgREST has no
   * transaction; the ordering (diff existing, then insert new, then
   * bump parent) is failure-safe — a partial failure can leave the set
   * stale but never half-applies a single membership.
   */
  async setGroupsForRoutine(
    routineId: string,
    groupIds: string[],
  ): Promise<void> {
    const { data: existingRaw, error: readErr } = await this.client
      .from("routine_group_assignments")
      .select("id, group_id, is_deleted")
      .eq("routine_id", routineId);
    if (readErr)
      throw new Error(`setGroupsForRoutine failed: ${readErr.message}`);
    const existing =
      (existingRaw as Array<{
        id: string;
        group_id: string;
        is_deleted: boolean;
      }>) ?? [];
    const now = new Date().toISOString();
    const newSet = new Set(groupIds);

    for (const row of existing) {
      const inNewSet = newSet.has(row.group_id);
      if (inNewSet && row.is_deleted) {
        const { error } = await this.client
          .from("routine_group_assignments")
          .update({ is_deleted: false, deleted_at: null, updated_at: now })
          .eq("id", row.id);
        if (error)
          throw new Error(`setGroupsForRoutine failed: ${error.message}`);
      } else if (!inNewSet && !row.is_deleted) {
        const { error } = await this.client
          .from("routine_group_assignments")
          .update({ is_deleted: true, deleted_at: now, updated_at: now })
          .eq("id", row.id);
        if (error)
          throw new Error(`setGroupsForRoutine failed: ${error.message}`);
      }
    }

    const existingGroupIds = new Set(existing.map((r) => r.group_id));
    const toInsert = groupIds
      .filter((g) => !existingGroupIds.has(g))
      .map((groupId) => ({
        id: `rga-${crypto.randomUUID()}`,
        routine_id: routineId,
        group_id: groupId,
        created_at: now,
        updated_at: now,
        is_deleted: false,
        deleted_at: null,
      }));
    if (toInsert.length > 0) {
      const { error } = await this.client
        .from("routine_group_assignments")
        .insert(toInsert);
      if (error)
        throw new Error(`setGroupsForRoutine failed: ${error.message}`);
    }

    // Parent routine version bump (junction has no version; the delta
    // query pages the relation by the parent routine's updated_at).
    const { data: cur, error: verErr } = await this.client
      .from("routines")
      .select("version")
      .eq("id", routineId)
      .maybeSingle();
    if (verErr)
      throw new Error(`setGroupsForRoutine failed: ${verErr.message}`);
    const curRow = cur as { version: number } | null;
    if (curRow != null) {
      const { error } = await this.client
        .from("routines")
        .update({ version: (curRow.version ?? 0) + 1, updated_at: now })
        .eq("id", routineId);
      if (error)
        throw new Error(`setGroupsForRoutine failed: ${error.message}`);
    }
  }
}

/*
 * Schedule Items domain (S4-2). VERSIONED + soft-delete + a LOGICAL
 * uniqueness invariant (at most one live row per (routine_id, date) —
 * Issue 011, enforced by the 0006 partial unique index). 1:1 port of
 * src-tauri/src/db/schedule_item_repository.rs.
 *
 * date / start_time / end_time are TEXT (S4-0: real date/timestamptz
 * would TZ-shift across the JST boundary) — passed through verbatim.
 *
 * `updateScheduleItem` is the Issue 020 path: the patch is the
 * whitelist-only `scheduleItemUpdatesToPatch` (a date-only move never
 * re-emits title/time), folded into a SINGLE versioned update; the
 * version read uses `.maybeSingle()` so a not-yet-persisted optimistic
 * row (INSERT in flight) is a skip, not a 406 (same race the notes
 * domain documents). `version` is bumped read-then-written.
 *
 * Issue 017 (a): every by-date / by-range / by-routine read filters
 * `.eq('is_deleted', false)` so a soft-deleted item never re-surfaces.
 */
class SupabaseScheduleItemsService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /** Tauri `fetch_by_date`: date + is_deleted=0 + is_dismissed=0, ORDER BY start_time. */
  async fetchScheduleItemsByDate(date: string): Promise<ScheduleItem[]> {
    const { data, error } = await this.client
      .from("schedule_items")
      .select(SCHEDULE_ITEM_SELECT_COLUMNS)
      .eq("date", date)
      .eq("is_deleted", false)
      .eq("is_dismissed", false)
      .order("start_time", { ascending: true });
    if (error)
      throw new Error(`fetchScheduleItemsByDate failed: ${error.message}`);
    return (data as unknown as ScheduleItemRow[]).map(rowToScheduleItem);
  }

  /** Tauri `fetch_by_date_all`: date + is_deleted=0 (dismissed INCLUDED). */
  async fetchScheduleItemsByDateAll(date: string): Promise<ScheduleItem[]> {
    const { data, error } = await this.client
      .from("schedule_items")
      .select(SCHEDULE_ITEM_SELECT_COLUMNS)
      .eq("date", date)
      .eq("is_deleted", false)
      .order("start_time", { ascending: true });
    if (error)
      throw new Error(`fetchScheduleItemsByDateAll failed: ${error.message}`);
    return (data as unknown as ScheduleItemRow[]).map(rowToScheduleItem);
  }

  /** Tauri `fetch_by_date_range`: BETWEEN + is_deleted=0 + is_dismissed=0, ORDER BY date, start_time. */
  async fetchScheduleItemsByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ScheduleItem[]> {
    const { data, error } = await this.client
      .from("schedule_items")
      .select(SCHEDULE_ITEM_SELECT_COLUMNS)
      .gte("date", startDate)
      .lte("date", endDate)
      .eq("is_deleted", false)
      .eq("is_dismissed", false)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error)
      throw new Error(`fetchScheduleItemsByDateRange failed: ${error.message}`);
    return (data as unknown as ScheduleItemRow[]).map(rowToScheduleItem);
  }

  /**
   * Tauri `create`: if `routineId` is set and a live row already exists
   * for (routine_id, date) RETURN the existing row instead of inserting
   * (the Issue 011 idempotency guard — the 0006 partial UNIQUE would
   * otherwise raise a constraint violation). Defaults: completed=0,
   * is_deleted=0, is_dismissed=0, reminder_enabled=0, version 1.
   */
  async createScheduleItem(
    id: string,
    date: string,
    title: string,
    startTime: string,
    endTime: string,
    routineId?: string,
    templateId?: string,
    noteId?: string,
    isAllDay?: boolean,
    content?: string,
  ): Promise<ScheduleItem> {
    if (routineId != null) {
      const { data: existing, error: existErr } = await this.client
        .from("schedule_items")
        .select(SCHEDULE_ITEM_SELECT_COLUMNS)
        .eq("routine_id", routineId)
        .eq("date", date)
        .eq("is_deleted", false)
        .limit(1)
        .maybeSingle();
      if (existErr)
        throw new Error(`createScheduleItem failed: ${existErr.message}`);
      if (existing != null)
        return rowToScheduleItem(existing as unknown as ScheduleItemRow);
    }
    const now = new Date().toISOString();
    const payload = {
      id,
      date,
      title,
      start_time: startTime,
      end_time: endTime,
      completed: false,
      completed_at: null,
      routine_id: routineId ?? null,
      template_id: templateId ?? null,
      memo: null,
      is_dismissed: false,
      note_id: noteId ?? null,
      is_all_day: isAllDay ?? false,
      content: content ?? null,
      reminder_enabled: false,
      reminder_offset: null,
      is_deleted: false,
      deleted_at: null,
      created_at: now,
      updated_at: now,
      version: 1,
    };
    const { data, error } = await this.client
      .from("schedule_items")
      .insert(payload)
      .select(SCHEDULE_ITEM_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`createScheduleItem failed: ${error.message}`);
    return rowToScheduleItem(data as unknown as ScheduleItemRow);
  }

  /**
   * Tauri `update`: whitelisted columns only. Empty patch = re-read,
   * NO updated_at touch (Rust `if sets.is_empty()` short circuit).
   * Issue 020: the patch is folded into ONE update; the version read is
   * `.maybeSingle()` so a not-yet-persisted optimistic row (INSERT in
   * flight, e.g. a generator just queued the row) is a SKIP returning a
   * synthesized node from the patch — NOT a PostgREST 406. A real read
   * error (auth/network) still throws. version+1 read-then-written.
   * NOTE: the Tauri repo does NOT bump version on schedule_items.update
   * (only updated_at); the web layer DOES bump version so the change
   * delta-syncs (schedule_items is VERSIONED — the Tauri omission was a
   * pre-existing sync gap, not a contract; bumping here is correct LWW).
   */
  async updateScheduleItem(
    id: string,
    updates: Partial<
      Pick<
        ScheduleItem,
        | "title"
        | "startTime"
        | "endTime"
        | "completed"
        | "completedAt"
        | "memo"
        | "isAllDay"
        | "content"
        | "date"
      >
    >,
  ): Promise<ScheduleItem> {
    const patch = scheduleItemUpdatesToPatch(updates);
    if (Object.keys(patch).length === 0) {
      const { data, error } = await this.client
        .from("schedule_items")
        .select(SCHEDULE_ITEM_SELECT_COLUMNS)
        .eq("id", id)
        .single();
      if (error) throw new Error(`updateScheduleItem failed: ${error.message}`);
      return rowToScheduleItem(data as unknown as ScheduleItemRow);
    }
    const { data: cur, error: readErr } = await this.client
      .from("schedule_items")
      .select("version")
      .eq("id", id)
      .maybeSingle();
    if (readErr)
      throw new Error(`updateScheduleItem failed: ${readErr.message}`);
    const curRow = cur as { version: number } | null;
    if (curRow == null) {
      // Row not yet persisted (optimistic INSERT in flight). Local
      // state is canonical and the post-INSERT flush persists this
      // edit, so skip the DB write and synthesize a well-formed node
      // from the patch (no `as`-cast type lie through rowToScheduleItem,
      // which presupposes NOT-NULL columns are materialised). Mirrors
      // the notes-domain Issue 020 skip path.
      const now = new Date().toISOString();
      return rowToScheduleItem({
        id,
        user_id: "",
        date: patch.date ?? "",
        title: patch.title ?? "",
        start_time: patch.start_time ?? "",
        end_time: patch.end_time ?? "",
        completed: patch.completed ?? false,
        completed_at: patch.completed_at ?? null,
        routine_id: null,
        template_id: patch.template_id ?? null,
        memo: patch.memo ?? null,
        is_dismissed: patch.is_dismissed ?? false,
        note_id: patch.note_id ?? null,
        is_all_day: patch.is_all_day ?? false,
        content: patch.content ?? null,
        reminder_enabled: patch.reminder_enabled ?? false,
        reminder_offset: patch.reminder_offset ?? null,
        is_deleted: patch.is_deleted ?? false,
        deleted_at: patch.deleted_at ?? null,
        created_at: now,
        updated_at: now,
        version: 0,
      });
    }
    const { data, error } = await this.client
      .from("schedule_items")
      .update({
        ...patch,
        version: (curRow.version ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(SCHEDULE_ITEM_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`updateScheduleItem failed: ${error.message}`);
    return rowToScheduleItem(data as unknown as ScheduleItemRow);
  }

  /** Tauri `delete`: physical DELETE by id. */
  async deleteScheduleItem(id: string): Promise<void> {
    // Issue 017 cascade-cleanup applied to the polymorphic cta relation
    // (sync-auditor High-2): cta has NO FK to schedule_items (0006 keeps
    // the polymorphic side FK-free, entity_type CHECK only), so a
    // physical delete here would orphan calendar_tag_assignments rows.
    // Clear them BEFORE the row vanishes so Cloud Sync delta replicates
    // the cleared tag (mirrors deleteCalendarTag's parent-bump-then-
    // delete order — see SupabaseCalendarTagsService).
    await this.purgeCalendarTagAssignments([id]);
    const { error } = await this.client
      .from("schedule_items")
      .delete()
      .eq("id", id);
    if (error) throw new Error(`deleteScheduleItem failed: ${error.message}`);
  }

  /** Tauri `soft_delete` (helpers::soft_delete): is_deleted=1 + deleted_at + version+1 + updated_at. */
  async softDeleteScheduleItem(id: string): Promise<void> {
    const next = await this.nextVersion(id, "softDeleteScheduleItem");
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("schedule_items")
      .update({
        is_deleted: true,
        deleted_at: now,
        version: next,
        updated_at: now,
      })
      .eq("id", id);
    if (error)
      throw new Error(`softDeleteScheduleItem failed: ${error.message}`);
  }

  /** Tauri `restore` (helpers::restore): is_deleted=0 + deleted_at=null + version+1 + updated_at. */
  async restoreScheduleItem(id: string): Promise<void> {
    const next = await this.nextVersion(id, "restoreScheduleItem");
    const { error } = await this.client
      .from("schedule_items")
      .update({
        is_deleted: false,
        deleted_at: null,
        version: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(`restoreScheduleItem failed: ${error.message}`);
  }

  /** Tauri `permanent_delete` (helpers::permanent_delete): physical DELETE guarded by is_deleted=1. */
  async permanentDeleteScheduleItem(id: string): Promise<void> {
    // Same cta orphan guard as deleteScheduleItem (sync-auditor High-2),
    // but ORDER-FLIPPED: the delete is guarded by is_deleted=1, so it is
    // a no-op for a live row. Clear cta only for rows that were actually
    // removed (`.select("id")` returns the deleted rows) — otherwise a
    // mistaken purge of a live item would also wipe its tag.
    const { data, error } = await this.client
      .from("schedule_items")
      .delete()
      .eq("id", id)
      .eq("is_deleted", true)
      .select("id");
    if (error)
      throw new Error(`permanentDeleteScheduleItem failed: ${error.message}`);
    if ((data as Array<{ id: string }> | null)?.length) {
      await this.purgeCalendarTagAssignments([id]);
    }
  }

  async fetchDeletedScheduleItems(): Promise<ScheduleItem[]> {
    const { data, error } = await this.client
      .from("schedule_items")
      .select(SCHEDULE_ITEM_SELECT_COLUMNS)
      .eq("is_deleted", true)
      .order("deleted_at", { ascending: false });
    if (error)
      throw new Error(`fetchDeletedScheduleItems failed: ${error.message}`);
    return (data as unknown as ScheduleItemRow[]).map(rowToScheduleItem);
  }

  /**
   * Tauri `toggle_complete`: read current `completed`, flip it +
   * set/null completed_at. The Rust path bumps only updated_at; the web
   * layer also bumps version (VERSIONED table — same rationale as
   * updateScheduleItem). Read-modify-write (no SQL CASE in PostgREST).
   */
  async toggleScheduleItemComplete(id: string): Promise<ScheduleItem> {
    const { data: cur, error: readErr } = await this.client
      .from("schedule_items")
      .select("completed, version")
      .eq("id", id)
      .single();
    if (readErr)
      throw new Error(`toggleScheduleItemComplete failed: ${readErr.message}`);
    const row = cur as { completed: boolean; version: number };
    const now = new Date().toISOString();
    const nextCompleted = !row.completed;
    const { data, error } = await this.client
      .from("schedule_items")
      .update({
        completed: nextCompleted,
        completed_at: nextCompleted ? now : null,
        version: (row.version ?? 0) + 1,
        updated_at: now,
      })
      .eq("id", id)
      .select(SCHEDULE_ITEM_SELECT_COLUMNS)
      .single();
    if (error)
      throw new Error(`toggleScheduleItemComplete failed: ${error.message}`);
    return rowToScheduleItem(data as unknown as ScheduleItemRow);
  }

  /** Tauri `dismiss`: is_dismissed=1 + updated_at (version bumped for delta sync). */
  async dismissScheduleItem(id: string): Promise<void> {
    await this.setDismissed(id, true, "dismissScheduleItem");
  }

  /** Tauri `undismiss`: is_dismissed=0 + updated_at (version bumped for delta sync). */
  async undismissScheduleItem(id: string): Promise<void> {
    await this.setDismissed(id, false, "undismissScheduleItem");
  }

  private async setDismissed(
    id: string,
    dismissed: boolean,
    label: string,
  ): Promise<void> {
    const next = await this.nextVersion(id, label);
    const { error } = await this.client
      .from("schedule_items")
      .update({
        is_dismissed: dismissed,
        version: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(`${label} failed: ${error.message}`);
  }

  /**
   * Tauri `fetch_last_routine_date`: `MAX(date) WHERE routine_id IS NOT
   * NULL`. PostgREST cannot aggregate without an RPC, so order by date
   * desc and take the first routine-derived row's date (equivalent —
   * `date` is text "YYYY-MM-DD" so lexical desc == chronological desc).
   * No `is_deleted` filter (Rust parity: the Rust query does not filter
   * it either — the last generated date governs the next generation
   * window regardless of trash state).
   */
  async fetchLastRoutineDate(): Promise<string | null> {
    const { data, error } = await this.client
      .from("schedule_items")
      .select("date")
      .not("routine_id", "is", null)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`fetchLastRoutineDate failed: ${error.message}`);
    return (data as { date: string } | null)?.date ?? null;
  }

  /**
   * Tauri `bulk_create`: per-item, skip when a live row for
   * (routine_id, date) already exists (Issue 011 idempotency — the
   * partial UNIQUE would otherwise raise). Soft-deleted rows are
   * intentionally NOT counted as existing so re-creation after trash is
   * allowed. PostgREST has no transaction; each surviving row is
   * inserted individually (a single insert array would abort the whole
   * batch on the first conflict, defeating the per-row skip).
   */
  async bulkCreateScheduleItems(
    items: Array<{
      id: string;
      date: string;
      title: string;
      startTime: string;
      endTime: string;
      routineId?: string;
      templateId?: string;
      noteId?: string;
      reminderEnabled?: boolean;
      reminderOffset?: number;
    }>,
  ): Promise<void> {
    const now = new Date().toISOString();
    for (const item of items) {
      if (item.routineId != null) {
        const { data: existing, error: existErr } = await this.client
          .from("schedule_items")
          .select("id")
          .eq("routine_id", item.routineId)
          .eq("date", item.date)
          .eq("is_deleted", false)
          .limit(1)
          .maybeSingle();
        if (existErr)
          throw new Error(
            `bulkCreateScheduleItems failed: ${existErr.message}`,
          );
        if (existing != null) continue;
      }
      const { error } = await this.client.from("schedule_items").insert({
        id: item.id,
        date: item.date,
        title: item.title,
        start_time: item.startTime,
        end_time: item.endTime,
        completed: false,
        completed_at: null,
        routine_id: item.routineId ?? null,
        template_id: item.templateId ?? null,
        memo: null,
        is_dismissed: false,
        note_id: item.noteId ?? null,
        is_all_day: false,
        content: null,
        reminder_enabled: item.reminderEnabled ?? false,
        reminder_offset: item.reminderOffset ?? null,
        is_deleted: false,
        deleted_at: null,
        created_at: now,
        updated_at: now,
        version: 1,
      });
      if (error)
        throw new Error(`bulkCreateScheduleItems failed: ${error.message}`);
    }
  }

  /**
   * Tauri `update_future_by_routine`: apply title/startTime/endTime to
   * every live routine-derived row with date >= fromDate. The Rust
   * version uses a single `UPDATE ... WHERE routine_id=? AND
   * is_deleted=0` with per-column `CASE WHEN date >= ?`; PostgREST has
   * no CASE, so the rows are selected (date>=fromDate filter applied
   * server-side, which is equivalent because the CASE only changed rows
   * with date>=fromDate anyway) and patched individually. Returns the
   * affected row count (Rust signature parity). version is bumped
   * per-row (VERSIONED table).
   */
  async updateFutureScheduleItemsByRoutine(
    routineId: string,
    updates: { title?: string; startTime?: string; endTime?: string },
    fromDate: string,
  ): Promise<number> {
    const patch: Record<string, string> = {};
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.startTime !== undefined) patch.start_time = updates.startTime;
    if (updates.endTime !== undefined) patch.end_time = updates.endTime;
    if (Object.keys(patch).length === 0) return 0;

    const { data: rows, error: readErr } = await this.client
      .from("schedule_items")
      .select("id, version")
      .eq("routine_id", routineId)
      .eq("is_deleted", false)
      .gte("date", fromDate);
    if (readErr)
      throw new Error(
        `updateFutureScheduleItemsByRoutine failed: ${readErr.message}`,
      );
    const targets = (rows as Array<{ id: string; version: number }>) ?? [];
    const now = new Date().toISOString();
    for (const t of targets) {
      const { error } = await this.client
        .from("schedule_items")
        .update({
          ...patch,
          version: (t.version ?? 0) + 1,
          updated_at: now,
        })
        .eq("id", t.id);
      if (error)
        throw new Error(
          `updateFutureScheduleItemsByRoutine failed: ${error.message}`,
        );
    }
    return targets.length;
  }

  /** Tauri `fetch_by_routine_id`: routine_id + is_deleted=0, ORDER BY date, start_time (Issue 017 (a)). */
  async fetchScheduleItemsByRoutineId(
    routineId: string,
  ): Promise<ScheduleItem[]> {
    const { data, error } = await this.client
      .from("schedule_items")
      .select(SCHEDULE_ITEM_SELECT_COLUMNS)
      .eq("routine_id", routineId)
      .eq("is_deleted", false)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error)
      throw new Error(`fetchScheduleItemsByRoutineId failed: ${error.message}`);
    return (data as unknown as ScheduleItemRow[]).map(rowToScheduleItem);
  }

  /**
   * Tauri `bulk_delete`: physical DELETE per id, returns the count
   * actually removed. PostgREST `.in()` deletes in one round-trip; the
   * count is the returned row length (the Rust path sums per-id
   * `changes()` — equivalent total).
   */
  async bulkDeleteScheduleItems(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const { data, error } = await this.client
      .from("schedule_items")
      .delete()
      .in("id", ids)
      .select("id");
    if (error)
      throw new Error(`bulkDeleteScheduleItems failed: ${error.message}`);
    const removed = (data as Array<{ id: string }>).map((r) => r.id);
    // sync-auditor High-2 — the generator's bulk physical-delete path is
    // the highest-volume cta orphan source (Routine cleanup deletes many
    // rows at once). Clear cta for exactly the rows that were removed.
    await this.purgeCalendarTagAssignments(removed);
    return removed.length;
  }

  /** Tauri `fetch_events`: routine_id IS NULL + is_deleted=0 (manual events), ORDER BY date, start_time. */
  async fetchEvents(): Promise<ScheduleItem[]> {
    const { data, error } = await this.client
      .from("schedule_items")
      .select(SCHEDULE_ITEM_SELECT_COLUMNS)
      .is("routine_id", null)
      .eq("is_deleted", false)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw new Error(`fetchEvents failed: ${error.message}`);
    return (data as unknown as ScheduleItemRow[]).map(rowToScheduleItem);
  }

  private async nextVersion(id: string, label: string): Promise<number> {
    const { data, error } = await this.client
      .from("schedule_items")
      .select("version")
      .eq("id", id)
      .single();
    if (error) throw new Error(`${label} failed: ${error.message}`);
    return ((data as { version: number }).version ?? 0) + 1;
  }

  /**
   * sync-auditor High-2 — Issue 017's "clean up derived rows when the
   * parent is destroyed" principle applied to the POLYMORPHIC cta
   * relation. calendar_tag_assignments has NO FK to schedule_items (0006
   * keeps the polymorphic side FK-free, entity_type CHECK only), so the
   * DB cascade that protects e.g. routine_group_assignments does NOT
   * fire here — a physically-deleted schedule_item would leave an
   * orphan cta forever (it survives delta sync; fetchAll keeps returning
   * it). This is the symmetric counterpart of
   * SupabaseCalendarTagsService.deleteCalendarTag (which clears cta when
   * the OTHER parent — the tag definition — is deleted).
   *
   * No version bump is needed on a deleted parent (the row is gone — a
   * delta peer learns the deletion via the schedule_items full-replicate
   * / version path). PostgREST has no transaction; clearing cta as a
   * separate statement is the failure-safe order (a partial failure can
   * leave an orphan cta but never loses the schedule_items deletion).
   * `entity_type` is constrained so the (schedule_item, id) filter
   * cannot collide with a same-id task row.
   */
  private async purgeCalendarTagAssignments(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await this.client
      .from("calendar_tag_assignments")
      .delete()
      .eq("entity_type", "schedule_item")
      .in("entity_id", ids);
    if (error)
      throw new Error(
        `schedule_item cta orphan cleanup failed: ${error.message}`,
      );
  }
}

/*
 * Calendars domain (S4-2). VERSIONED but PHYSICAL-delete (0006 omits
 * is_deleted — the frontend never soft-deletes a calendar). 1:1 port of
 * src-tauri/src/db/calendar_repository.rs.
 *
 * PARITY DIVERGENCE (documented, not silent): the Rust `update` accepts
 * `folderId` too, but the S4-1 QA-passed `calendarUpdatesToPatch`
 * whitelist (the contract per the "frontend type is the SSOT" S2/S3
 * rule) only exposes title/order. The DataService interface's
 * `updateCalendar` signature also only accepts title/folderId/order;
 * folderId in `updates` is therefore accepted by the type but dropped
 * by the patch builder. This matches the mapper SSOT; a calendar is
 * rebound by recreation in current UI flows. Flagged for QA.
 */
class SupabaseCalendarsService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /** Tauri `fetch_all`: ORDER BY "order" ASC, created_at ASC. */
  async fetchCalendars(): Promise<CalendarNode[]> {
    const { data, error } = await this.client
      .from("calendars")
      .select(CALENDAR_SELECT_COLUMNS)
      .order("order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(`fetchCalendars failed: ${error.message}`);
    return (data as unknown as CalendarRow[]).map(rowToCalendar);
  }

  /**
   * Tauri `create`: `"order"` = next_order (MAX+1), version default 1.
   * `folderId` references tasks(id) (the 0006 FK) — a calendar is a
   * folder-scoped view. `user_id` RLS-derived.
   */
  async createCalendar(
    id: string,
    title: string,
    folderId: string,
  ): Promise<CalendarNode> {
    const nextOrder = await this.nextOrder();
    const now = new Date().toISOString();
    const payload = {
      id,
      title,
      folder_id: folderId,
      order: nextOrder,
      created_at: now,
      updated_at: now,
      version: 1,
    };
    const { data, error } = await this.client
      .from("calendars")
      .insert(payload)
      .select(CALENDAR_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`createCalendar failed: ${error.message}`);
    return rowToCalendar(data as unknown as CalendarRow);
  }

  /**
   * Tauri `update`: whitelisted columns (calendarUpdatesToPatch =
   * title/order; see class header re folderId divergence). Empty patch
   * = re-read NO version bump. Otherwise version + 1 (read-then-written)
   * + updated_at.
   */
  async updateCalendar(
    id: string,
    updates: Partial<Pick<CalendarNode, "title" | "folderId" | "order">>,
  ): Promise<CalendarNode> {
    const patch = calendarUpdatesToPatch(updates);
    if (Object.keys(patch).length === 0) {
      const { data, error } = await this.client
        .from("calendars")
        .select(CALENDAR_SELECT_COLUMNS)
        .eq("id", id)
        .single();
      if (error) throw new Error(`updateCalendar failed: ${error.message}`);
      return rowToCalendar(data as unknown as CalendarRow);
    }
    const next = await this.nextVersion(id, "updateCalendar");
    const { data, error } = await this.client
      .from("calendars")
      .update({
        ...patch,
        version: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(CALENDAR_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`updateCalendar failed: ${error.message}`);
    return rowToCalendar(data as unknown as CalendarRow);
  }

  /** Tauri `delete`: physical DELETE by id (no soft-delete column). */
  async deleteCalendar(id: string): Promise<void> {
    const { error } = await this.client.from("calendars").delete().eq("id", id);
    if (error) throw new Error(`deleteCalendar failed: ${error.message}`);
  }

  private async nextOrder(): Promise<number> {
    const { data, error } = await this.client
      .from("calendars")
      .select('"order"')
      .order("order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`createCalendar failed: ${error.message}`);
    const max = (data as { order: number } | null)?.order;
    return (max ?? -1) + 1;
  }

  private async nextVersion(id: string, label: string): Promise<number> {
    const { data, error } = await this.client
      .from("calendars")
      .select("version")
      .eq("id", id)
      .single();
    if (error) throw new Error(`${label} failed: ${error.message}`);
    return ((data as { version: number }).version ?? 0) + 1;
  }
}

/*
 * Calendar Tags domain (S4-2): calendar_tag_definitions (the tag
 * dictionary) + calendar_tag_assignments (the polymorphic 1:1
 * junction). 1:1 port of src-tauri/src/db/calendar_tag_repository.rs.
 *
 * ctd ID CONTRACT (load-bearing): `id` is `integer generated always as
 * identity` — CalendarTag.id is a `number`. A create OMITS id (Postgres
 * assigns it) and reads the assigned row back. `version` is bumped on
 * mutation (read-then-written).
 *
 * ctd PHYSICAL-DELETE DIVERGENCE (documented, not silent): the Rust
 * `delete` SOFT-deletes the definition (is_deleted=1). But S4-0
 * confirmed 0006 deliberately OMITS is_deleted on
 * calendar_tag_definitions (the V65 sync columns there are
 * full-replicate, see the S4-1 申し送り "ctd full-replicate" note), so
 * the soft-delete API is mapped to a PHYSICAL DELETE here. The cascade
 * side-effects are preserved 1:1: before deleting the definition, every
 * cta row referencing this tag is physically removed AND its parent
 * entity (tasks / schedule_items) gets version+1 + updated_at so Cloud
 * Sync delta picks up the cleared assignment (Issue 008-adjacent).
 *
 * cta SYNC CLASS: RELATION, physical-delete, NO version/soft-delete.
 * UNIQUE(entity_type, entity_id) = 1:1. `setTagForEntity` clears the
 * existing assignment then inserts the new one (tagId=null = clear
 * only) and bumps the parent entity's version + updated_at.
 */
class SupabaseCalendarTagsService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /** Tauri `fetch_all`: ORDER BY "order" ASC, id ASC (is_deleted filter dropped — physical-delete). */
  async fetchCalendarTags(): Promise<CalendarTag[]> {
    const { data, error } = await this.client
      .from("calendar_tag_definitions")
      .select(CALENDAR_TAG_DEFINITION_SELECT_COLUMNS)
      .order("order", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw new Error(`fetchCalendarTags failed: ${error.message}`);
    return (data as unknown as CalendarTagDefinitionRow[]).map(
      rowToCalendarTag,
    );
  }

  /**
   * Tauri `create`: `"order"` = MAX("order") + 1, version 1. `id` is
   * OMITTED (integer identity — Postgres assigns it); the inserted row
   * is read back so the caller gets the server-assigned numeric id.
   */
  async createCalendarTag(name: string, color: string): Promise<CalendarTag> {
    const nextOrder = await this.nextOrder();
    const now = new Date().toISOString();
    const payload = {
      name,
      color,
      text_color: null,
      order: nextOrder,
      created_at: now,
      updated_at: now,
      version: 1,
    };
    const { data, error } = await this.client
      .from("calendar_tag_definitions")
      .insert(payload)
      .select(CALENDAR_TAG_DEFINITION_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`createCalendarTag failed: ${error.message}`);
    return rowToCalendarTag(data as unknown as CalendarTagDefinitionRow);
  }

  /**
   * Tauri `update`: whitelisted columns (calendarTagUpdatesToPatch =
   * name/color/textColor/order). Empty patch = re-read NO version bump.
   * Otherwise version + 1 (read-then-written) + updated_at.
   */
  async updateCalendarTag(
    id: number,
    updates: Partial<
      Pick<CalendarTag, "name" | "color" | "textColor" | "order">
    >,
  ): Promise<CalendarTag> {
    const patch = calendarTagUpdatesToPatch(updates);
    if (Object.keys(patch).length === 0) {
      const { data, error } = await this.client
        .from("calendar_tag_definitions")
        .select(CALENDAR_TAG_DEFINITION_SELECT_COLUMNS)
        .eq("id", id)
        .single();
      if (error) throw new Error(`updateCalendarTag failed: ${error.message}`);
      return rowToCalendarTag(data as unknown as CalendarTagDefinitionRow);
    }
    const next = await this.nextVersion(id, "updateCalendarTag");
    const { data, error } = await this.client
      .from("calendar_tag_definitions")
      .update({
        ...patch,
        version: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(CALENDAR_TAG_DEFINITION_SELECT_COLUMNS)
      .single();
    if (error) throw new Error(`updateCalendarTag failed: ${error.message}`);
    return rowToCalendarTag(data as unknown as CalendarTagDefinitionRow);
  }

  /**
   * Tauri `delete` cascade ported 1:1 EXCEPT the definition itself is
   * PHYSICALLY deleted (S4-0: 0006 omits is_deleted on ctd — see class
   * header). Order matters: first bump every parent entity referenced
   * by a cta row for this tag (schedule_items + tasks, version+1 +
   * updated_at) so Cloud Sync delta replicates the cleared assignment,
   * then physically delete the cta rows, then the definition. PostgREST
   * has no transaction; bumping parents BEFORE deleting cta is the
   * failure-safe order (a partial failure can leave the tag but never
   * loses the delta signal that the assignment changed).
   */
  async deleteCalendarTag(id: number): Promise<void> {
    const { data: assigns, error: aErr } = await this.client
      .from("calendar_tag_assignments")
      .select("entity_type, entity_id")
      .eq("tag_id", id);
    if (aErr) throw new Error(`deleteCalendarTag failed: ${aErr.message}`);
    const rows =
      (assigns as Array<{ entity_type: string; entity_id: string }>) ?? [];
    const scheduleIds = rows
      .filter((r) => r.entity_type === "schedule_item")
      .map((r) => r.entity_id);
    const taskIds = rows
      .filter((r) => r.entity_type === "task")
      .map((r) => r.entity_id);
    await this.bumpEntities("schedule_items", scheduleIds);
    await this.bumpEntities("tasks", taskIds);

    const { error: ctaErr } = await this.client
      .from("calendar_tag_assignments")
      .delete()
      .eq("tag_id", id);
    if (ctaErr) throw new Error(`deleteCalendarTag failed: ${ctaErr.message}`);

    const { error } = await this.client
      .from("calendar_tag_definitions")
      .delete()
      .eq("id", id);
    if (error) throw new Error(`deleteCalendarTag failed: ${error.message}`);
  }

  async fetchAllCalendarTagAssignments(): Promise<
    Array<{
      entityType: "task" | "schedule_item";
      entityId: string;
      tagId: number;
    }>
  > {
    const { data, error } = await this.client
      .from("calendar_tag_assignments")
      .select(CALENDAR_TAG_ASSIGNMENT_SELECT_COLUMNS);
    if (error)
      throw new Error(
        `fetchAllCalendarTagAssignments failed: ${error.message}`,
      );
    return (data as unknown as CalendarTagAssignmentRow[]).map((r) => ({
      entityType: r.entity_type as "task" | "schedule_item",
      entityId: r.entity_id,
      tagId: r.tag_id,
    }));
  }

  /**
   * Tauri `set_tag_for_entity` ported 1:1: DELETE any existing
   * assignment for (entity_type, entity_id) (the UNIQUE enforces 1:1),
   * then if `tagId` is non-null INSERT a fresh `cta-<uuid>` row, then
   * bump the parent entity's version + updated_at so Cloud Sync delta
   * picks up the (re)tag/clear. PostgREST has no transaction; the order
   * (clear -> insert -> bump) keeps the 1:1 invariant and never leaves
   * two live rows for one entity.
   */
  async setTagForEntity(
    entityType: "task" | "schedule_item",
    entityId: string,
    tagId: number | null,
  ): Promise<void> {
    const { error: delErr } = await this.client
      .from("calendar_tag_assignments")
      .delete()
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);
    if (delErr) throw new Error(`setTagForEntity failed: ${delErr.message}`);

    if (tagId != null) {
      const now = new Date().toISOString();
      const { error: insErr } = await this.client
        .from("calendar_tag_assignments")
        .insert({
          id: `cta-${crypto.randomUUID()}`,
          entity_type: entityType,
          entity_id: entityId,
          tag_id: tagId,
          created_at: now,
          updated_at: now,
        });
      if (insErr) throw new Error(`setTagForEntity failed: ${insErr.message}`);
    }

    const table = entityType === "schedule_item" ? "schedule_items" : "tasks";
    await this.bumpEntities(table, [entityId]);
  }

  /**
   * Tauri backwards-compat shim `set_tags_for_schedule_item`: collapse
   * the array to its first element (or clear if empty) since
   * CalendarTags are 1:1. Delegates to setTagForEntity.
   */
  async setTagsForScheduleItem(
    scheduleItemId: string,
    tagIds: number[],
  ): Promise<void> {
    const single = tagIds.length > 0 ? tagIds[0] : null;
    await this.setTagForEntity("schedule_item", scheduleItemId, single);
  }

  /**
   * Bump version + updated_at on the given parent rows so a cta change
   * delta-syncs (mirrors the Rust `UPDATE ... SET version=version+1`).
   * version+1 is read-then-written per row (no relative increment). A
   * missing row is skipped (the cta may reference an already-deleted
   * entity — not an error).
   */
  private async bumpEntities(
    table: "schedule_items" | "tasks",
    ids: string[],
  ): Promise<void> {
    if (ids.length === 0) return;
    const { data, error } = await this.client
      .from(table)
      .select("id, version")
      .in("id", ids);
    if (error)
      throw new Error(`calendar tag entity bump failed: ${error.message}`);
    const rows = (data as Array<{ id: string; version: number }>) ?? [];
    const now = new Date().toISOString();
    for (const row of rows) {
      const { error: upErr } = await this.client
        .from(table)
        .update({ version: (row.version ?? 0) + 1, updated_at: now })
        .eq("id", row.id);
      if (upErr)
        throw new Error(`calendar tag entity bump failed: ${upErr.message}`);
    }
  }

  private async nextOrder(): Promise<number> {
    const { data, error } = await this.client
      .from("calendar_tag_definitions")
      .select('"order"')
      .order("order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`createCalendarTag failed: ${error.message}`);
    const max = (data as { order: number } | null)?.order;
    return (max ?? -1) + 1;
  }

  private async nextVersion(id: number, label: string): Promise<number> {
    const { data, error } = await this.client
      .from("calendar_tag_definitions")
      .select("version")
      .eq("id", id)
      .single();
    if (error) throw new Error(`${label} failed: ${error.message}`);
    return ((data as { version: number }).version ?? 0) + 1;
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

const PHASE2_ROUTINES_METHODS = new Set<string>([
  "fetchAllRoutines",
  "fetchDeletedRoutines",
  "createRoutine",
  "updateRoutine",
  "deleteRoutine",
  "softDeleteRoutine",
  "restoreRoutine",
  "permanentDeleteRoutine",
]);

const PHASE2_ROUTINE_GROUP_METHODS = new Set<string>([
  "fetchRoutineGroups",
  "createRoutineGroup",
  "updateRoutineGroup",
  "deleteRoutineGroup",
]);

const PHASE2_ROUTINE_GROUP_ASSIGNMENT_METHODS = new Set<string>([
  "fetchAllRoutineGroupAssignments",
  "setGroupsForRoutine",
]);

const PHASE2_SCHEDULE_ITEM_METHODS = new Set<string>([
  "fetchScheduleItemsByDate",
  "fetchScheduleItemsByDateAll",
  "fetchScheduleItemsByDateRange",
  "createScheduleItem",
  "updateScheduleItem",
  "deleteScheduleItem",
  "softDeleteScheduleItem",
  "restoreScheduleItem",
  "permanentDeleteScheduleItem",
  "fetchDeletedScheduleItems",
  "toggleScheduleItemComplete",
  "dismissScheduleItem",
  "undismissScheduleItem",
  "fetchLastRoutineDate",
  "bulkCreateScheduleItems",
  "updateFutureScheduleItemsByRoutine",
  "fetchScheduleItemsByRoutineId",
  "bulkDeleteScheduleItems",
  "fetchEvents",
]);

const PHASE2_CALENDAR_METHODS = new Set<string>([
  "fetchCalendars",
  "createCalendar",
  "updateCalendar",
  "deleteCalendar",
]);

const PHASE2_CALENDAR_TAG_METHODS = new Set<string>([
  "fetchCalendarTags",
  "createCalendarTag",
  "updateCalendarTag",
  "deleteCalendarTag",
  "fetchAllCalendarTagAssignments",
  "setTagForEntity",
  "setTagsForScheduleItem",
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
  const routinesService = new SupabaseRoutinesService(client);
  const routineGroupsService = new SupabaseRoutineGroupsService(client);
  const routineGroupAssignmentsService =
    new SupabaseRoutineGroupAssignmentsService(client);
  const scheduleItemsService = new SupabaseScheduleItemsService(client);
  const calendarsService = new SupabaseCalendarsService(client);
  const calendarTagsService = new SupabaseCalendarTagsService(client);

  // Dispatch table: method name -> the instance that implements it. The
  // Proxy's target is arbitrary (an empty object); routing is entirely
  // by this map so adding a domain is one entry, no target juggling.
  const route = (prop: string): object | null => {
    if (PHASE2_TASKS_METHODS.has(prop)) return tasksService;
    if (PHASE2_DAILY_METHODS.has(prop)) return dailyService;
    if (PHASE2_NOTES_METHODS.has(prop)) return notesService;
    if (PHASE2_NOTE_LINK_METHODS.has(prop)) return noteLinkService;
    if (PHASE2_NOTE_CONNECTION_METHODS.has(prop)) return noteConnectionService;
    if (PHASE2_ROUTINES_METHODS.has(prop)) return routinesService;
    if (PHASE2_ROUTINE_GROUP_METHODS.has(prop)) return routineGroupsService;
    if (PHASE2_ROUTINE_GROUP_ASSIGNMENT_METHODS.has(prop))
      return routineGroupAssignmentsService;
    if (PHASE2_SCHEDULE_ITEM_METHODS.has(prop)) return scheduleItemsService;
    if (PHASE2_CALENDAR_METHODS.has(prop)) return calendarsService;
    if (PHASE2_CALENDAR_TAG_METHODS.has(prop)) return calendarTagsService;
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
// DU-B-2: 2-row API (items_meta + tasks_payload). Old single-row symbols
// (rowToTaskNode / taskNodeToRow / taskUpdatesToPatch / TaskRow /
// TaskWriteRow) are gone — call sites must migrate to the new API.
export {
  rowsToTaskNode,
  taskNodeToRows,
  taskUpdatesToPatches,
  ITEMS_META_TASK_COLUMNS,
  TASKS_PAYLOAD_COLUMNS,
} from "./taskMapper";
export type {
  ItemsMetaRow,
  TasksPayloadRow,
  ItemsMetaInsertRow,
  TasksPayloadWriteRow,
  ItemsMetaUpdatePatch,
  TasksPayloadUpdatePatch,
} from "./taskMapper";
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

// Schedule domain (S4-2) — mapper re-exports for round-trip / host use.
export {
  rowToRoutine,
  routineToRow,
  routineUpdatesToPatch,
  toFrequencyType,
  parseFrequencyDays,
} from "./routineMapper";
export type { RoutineRow, RoutineWriteRow } from "./routineMapper";
export {
  rowToRoutineGroup,
  routineGroupToRow,
  routineGroupUpdatesToPatch,
} from "./routineGroupMapper";
export type {
  RoutineGroupRow,
  RoutineGroupWriteRow,
} from "./routineGroupMapper";
export {
  rowToRoutineGroupAssignment,
  routineGroupAssignmentToRow,
  routineGroupAssignmentUpdatesToPatch,
} from "./routineGroupAssignmentMapper";
export type {
  RoutineGroupAssignmentRow,
  RoutineGroupAssignmentWriteRow,
} from "./routineGroupAssignmentMapper";
export {
  rowToScheduleItem,
  scheduleItemToRow,
  scheduleItemUpdatesToPatch,
} from "./scheduleItemMapper";
export type {
  ScheduleItemRow,
  ScheduleItemWriteRow,
} from "./scheduleItemMapper";
export {
  rowToCalendar,
  calendarToRow,
  calendarUpdatesToPatch,
} from "./calendarMapper";
export type { CalendarRow, CalendarWriteRow } from "./calendarMapper";
export {
  rowToCalendarTag,
  calendarTagToRow,
  calendarTagUpdatesToPatch,
} from "./calendarTagDefinitionMapper";
export type {
  CalendarTagDefinitionRow,
  CalendarTagDefinitionWriteRow,
} from "./calendarTagDefinitionMapper";
export {
  rowToCalendarTagAssignment,
  calendarTagAssignmentToRow,
  calendarTagAssignmentUpdatesToPatch,
  toCtaEntityType,
} from "./calendarTagAssignmentMapper";
export type {
  CalendarTagAssignment,
  CalendarTagAssignmentEntityType,
  CalendarTagAssignmentRow,
  CalendarTagAssignmentWriteRow,
} from "./calendarTagAssignmentMapper";
