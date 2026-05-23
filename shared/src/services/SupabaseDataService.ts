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
import { generateId } from "../utils/generateId";
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
  // DU-C-3: 2-row API (items_meta + routines_payload)
  ITEMS_META_ROUTINE_COLUMNS,
  ROUTINES_PAYLOAD_COLUMNS,
  rowsToRoutineNode,
  routineNodeToRows,
  routineUpdatesToPatches,
  type ItemsMetaRoutineRow,
  type RoutinesPayloadRow,
} from "./routineMapper";
import {
  ROUTINE_GROUP_SELECT_COLUMNS,
  rowToRoutineGroup,
  routineGroupUpdatesToPatch,
  type RoutineGroupRow,
  // DU-C-4: V2 dedicated-table API (0008 sort_order + soft-delete columns)
  ROUTINE_GROUPS_COLUMNS,
  rowToRoutineGroupV2,
  routineGroupToRowV2,
  routineGroupUpdatesToPatchV2,
  type RoutineGroupRowV2,
} from "./routineGroupMapper";
import {
  ROUTINE_GROUP_ASSIGNMENT_SELECT_COLUMNS,
  rowToRoutineGroupAssignment,
  type RoutineGroupAssignmentRow,
  // DU-C-4: V2 (routine_item_id rename + no created_at)
  ROUTINE_GROUP_ASSIGNMENTS_COLUMNS,
  rowToRoutineGroupAssignmentV2,
  type RoutineGroupAssignmentRowV2,
} from "./routineGroupAssignmentMapper";
import {
  SCHEDULE_ITEM_SELECT_COLUMNS,
  rowToScheduleItem,
  scheduleItemUpdatesToPatch,
  type ScheduleItemRow,
  // DU-C-5: 2-row API (items_meta + events_payload)
  ITEMS_META_EVENT_COLUMNS,
  EVENTS_PAYLOAD_COLUMNS,
  rowsToScheduleItem,
  scheduleItemToRows,
  scheduleItemUpdatesToPatches,
  type ItemsMetaEventRow,
  type EventsPayloadRow,
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
 * DU-C/D pending stubs (2026-05-23). The legacy per-domain tables
 * (`notes` / `dailies` / `routines` / `schedule_items` / `note_links` /
 * `note_connections` / `routine_groups` / `routine_group_assignments`)
 * were dropped by migration 0007 ahead of the unified items_meta +
 * <role>_payload schema. The Postgres side has the new payload tables
 * (`notes_payload` / `dailies_payload` / `routines_payload` /
 * `events_payload`) ready, but the TypeScript mapper + 2-row I/O
 * rewrite is scheduled for DU-C (Events + Routine + RoutineGroup) and
 * DU-D (Notes + Daily). Until those land:
 *
 *   - fetch* methods return an empty array / null so the web UI loads
 *     instead of crashing on PostgREST "Could not find the table
 *     'public.<name>' in the schema cache".
 *   - write* methods throw a clearly-labelled "pending DU-C/D rewrite"
 *     error so a user action surfaces immediately instead of silently
 *     hitting a dropped table or silently losing data.
 *
 * Replace each stub with the real items_meta + <role>_payload
 * implementation in DU-C / DU-D — same pattern as DU-B-3
 * SupabaseTasksService.
 */

function _pendingDuRewrite(method: string, domain: string): never {
  throw new Error(
    `${method}: ${domain} pending DU-C/D rewrite to items_meta + <role>_payload (legacy public.${domain} was dropped by migration 0007; see .claude/docs/vision/plans/2026-05-21-data-unification-items-meta.md)`,
  );
}

class SupabaseDailyService {
  private readonly client: SupabaseClient;
  // Keep mapper imports statically referenced (verbatimModuleSyntax).
  private static readonly _unused_select = DAILY_SELECT_COLUMNS;
  private static readonly _unused_mapper = rowToDailyNode;
  declare private _unused_row: DailyRow;

  constructor(client: SupabaseClient) {
    this.client = client;
    void this.client;
  }

  async fetchAllDailies(): Promise<DailyNode[]> {
    return [];
  }
  async fetchDailyByDate(_date: string): Promise<DailyNode | null> {
    void _date;
    return null;
  }
  async fetchDeletedDailies(): Promise<DailyNode[]> {
    return [];
  }
  async upsertDaily(_date: string, _content: string): Promise<DailyNode> {
    void _date;
    void _content;
    _pendingDuRewrite("upsertDaily", "dailies");
  }
  async deleteDaily(_date: string): Promise<void> {
    void _date;
    _pendingDuRewrite("deleteDaily", "dailies");
  }
  async restoreDaily(_date: string): Promise<void> {
    void _date;
    _pendingDuRewrite("restoreDaily", "dailies");
  }
  async permanentDeleteDaily(_date: string): Promise<void> {
    void _date;
    _pendingDuRewrite("permanentDeleteDaily", "dailies");
  }
  async toggleDailyPin(_date: string): Promise<DailyNode> {
    void _date;
    _pendingDuRewrite("toggleDailyPin", "dailies");
  }
  async setDailyPassword(_date: string, _password: string): Promise<DailyNode> {
    void _date;
    void _password;
    _pendingDuRewrite("setDailyPassword", "dailies");
  }
  async removeDailyPassword(
    _date: string,
    _currentPassword: string,
  ): Promise<DailyNode> {
    void _date;
    void _currentPassword;
    _pendingDuRewrite("removeDailyPassword", "dailies");
  }
  async verifyDailyPassword(
    _date: string,
    _password: string,
  ): Promise<boolean> {
    void _date;
    void _password;
    return false;
  }
  async toggleDailyEditLock(_date: string): Promise<DailyNode> {
    void _date;
    _pendingDuRewrite("toggleDailyEditLock", "dailies");
  }
}

class SupabaseNotesService {
  private readonly client: SupabaseClient;
  private static readonly _unused_select = NOTE_SELECT_COLUMNS;
  private static readonly _unused_mapper = rowToNoteNode;
  private static readonly _unused_patch = noteUpdatesToPatch;
  declare private _unused_row: NoteRow;

  constructor(client: SupabaseClient) {
    this.client = client;
    void this.client;
  }

  async fetchAllNotes(): Promise<NoteNode[]> {
    return [];
  }
  async fetchDeletedNotes(): Promise<NoteNode[]> {
    return [];
  }
  async createNote(
    _id: string,
    _title: string,
    _parentId?: string | null,
  ): Promise<NoteNode> {
    void _id;
    void _title;
    void _parentId;
    _pendingDuRewrite("createNote", "notes");
  }
  async createNoteFolder(
    _id: string,
    _title: string,
    _parentId: string | null,
  ): Promise<NoteNode> {
    void _id;
    void _title;
    void _parentId;
    _pendingDuRewrite("createNoteFolder", "notes");
  }
  async updateNote(
    _id: string,
    _updates: Partial<
      Pick<NoteNode, "title" | "content" | "isPinned" | "color" | "icon">
    >,
  ): Promise<NoteNode> {
    void _id;
    void _updates;
    _pendingDuRewrite("updateNote", "notes");
  }
  async syncNoteTree(
    _items: Array<{ id: string; parentId: string | null; order: number }>,
  ): Promise<void> {
    void _items;
    _pendingDuRewrite("syncNoteTree", "notes");
  }
  async softDeleteNote(_id: string): Promise<void> {
    void _id;
    _pendingDuRewrite("softDeleteNote", "notes");
  }
  async restoreNote(_id: string): Promise<void> {
    void _id;
    _pendingDuRewrite("restoreNote", "notes");
  }
  async permanentDeleteNote(_id: string): Promise<void> {
    void _id;
    _pendingDuRewrite("permanentDeleteNote", "notes");
  }
  async searchNotes(_query: string): Promise<NoteNode[]> {
    void _query;
    return [];
  }
  async setNotePassword(_id: string, _password: string): Promise<NoteNode> {
    void _id;
    void _password;
    _pendingDuRewrite("setNotePassword", "notes");
  }
  async removeNotePassword(
    _id: string,
    _currentPassword: string,
  ): Promise<NoteNode> {
    void _id;
    void _currentPassword;
    _pendingDuRewrite("removeNotePassword", "notes");
  }
  async verifyNotePassword(_id: string, _password: string): Promise<boolean> {
    void _id;
    void _password;
    return false;
  }
  async toggleNoteEditLock(_id: string): Promise<NoteNode> {
    void _id;
    _pendingDuRewrite("toggleNoteEditLock", "notes");
  }
}

class SupabaseNoteLinkService {
  private readonly client: SupabaseClient;
  private static readonly _unused_select = NOTE_LINK_SELECT_COLUMNS;
  private static readonly _unused_mapper = rowToNoteLink;
  declare private _unused_row: NoteLinkRow;

  constructor(client: SupabaseClient) {
    this.client = client;
    void this.client;
  }

  async fetchAllNoteLinks(): Promise<NoteLink[]> {
    return [];
  }
  async fetchForwardLinksForNote(_sourceNoteId: string): Promise<NoteLink[]> {
    void _sourceNoteId;
    return [];
  }
  async fetchBacklinksForNote(_targetNoteId: string): Promise<BacklinkHit[]> {
    void _targetNoteId;
    return [];
  }
  async upsertNoteLinksForNote(
    _sourceNoteId: string,
    _links: NoteLinkPayload[],
  ): Promise<void> {
    void _sourceNoteId;
    void _links;
    _pendingDuRewrite("upsertNoteLinksForNote", "note_links");
  }
  async upsertNoteLinksForDaily(
    _sourceDailyDate: string,
    _links: NoteLinkPayload[],
  ): Promise<void> {
    void _sourceDailyDate;
    void _links;
    _pendingDuRewrite("upsertNoteLinksForDaily", "note_links");
  }
  async deleteNoteLinksForNote(_sourceNoteId: string): Promise<void> {
    void _sourceNoteId;
    _pendingDuRewrite("deleteNoteLinksForNote", "note_links");
  }
  async fetchUnlinkedMentions(
    _sourceNoteId: string,
  ): Promise<UnlinkedMention[]> {
    void _sourceNoteId;
    return [];
  }
}

class SupabaseNoteConnectionService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
    void this.client;
  }

  async fetchNoteConnections(): Promise<NoteConnection[]> {
    return [];
  }
  async createNoteConnection(
    _sourceNoteId: string,
    _targetNoteId: string,
  ): Promise<NoteConnection> {
    void _sourceNoteId;
    void _targetNoteId;
    _pendingDuRewrite("createNoteConnection", "note_connections");
  }
  async deleteNoteConnection(_id: string): Promise<void> {
    void _id;
    _pendingDuRewrite("deleteNoteConnection", "note_connections");
  }
  async deleteNoteConnectionByPair(
    _sourceNoteId: string,
    _targetNoteId: string,
  ): Promise<void> {
    void _sourceNoteId;
    void _targetNoteId;
    _pendingDuRewrite("deleteNoteConnectionByPair", "note_connections");
  }
}

/*
 * DU-C-3: SupabaseRoutinesService over items_meta (role='routine') +
 * routines_payload. Same pattern as SupabaseTasksService — pure mapping
 * lives in routineMapper.ts; this class is the I/O layer.
 *
 * NOT MODELLED HERE:
 *   - The `groupIds` join (routine_group_assignments) is the
 *     SupabaseRoutineGroupAssignmentsService's concern (DU-C-4). The
 *     RoutineNode returned by these methods is the "lone" shape — the
 *     RoutineProvider composes groupIds at the consumer level (Phase 2
 *     parity).
 *   - Routine-generated event materialisation lives in
 *     SupabaseScheduleItemsService.bulkCreateScheduleItems (DU-C-5);
 *     softDeleteRoutine here only cascades soft-deletes to the events
 *     items_meta rows and returns the affected ids so the Schedule UI
 *     can reconcile in-memory state.
 */
class SupabaseRoutinesService {
  private readonly client: SupabaseClient;
  // Keep legacy mapper imports statically referenced (verbatimModuleSyntax)
  // until DU-C cleanup deletes them.
  private static readonly _unused_select = ROUTINE_SELECT_COLUMNS;
  private static readonly _unused_mapper = rowToRoutine;
  private static readonly _unused_patch = routineUpdatesToPatch;
  declare private _unused_row: RoutineRow;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  private async getUserId(): Promise<string> {
    const { data, error } = await this.client.auth.getUser();
    if (error) throw new Error(`getUserId failed: ${error.message}`);
    const uid = data.user?.id;
    if (!uid) throw new Error("getUserId failed: not authenticated");
    return uid;
  }

  /**
   * Live routines. Two SELECTs (items_meta WHERE role='routine' +
   * routines_payload) joined in-app. Missing payload (R2 orphan) skipped.
   */
  async fetchAllRoutines(): Promise<RoutineNode[]> {
    const { data: metas, error: metaErr } = await this.client
      .from("items_meta")
      .select(ITEMS_META_ROUTINE_COLUMNS)
      .eq("role", "routine")
      .eq("is_deleted", false);
    if (metaErr)
      throw new Error(`fetchAllRoutines items_meta: ${metaErr.message}`);
    const metaRows = (metas as unknown as ItemsMetaRoutineRow[]) ?? [];
    if (metaRows.length === 0) return [];

    const ids = metaRows.map((m) => m.id);
    const { data: payloads, error: pErr } = await this.client
      .from("routines_payload")
      .select(ROUTINES_PAYLOAD_COLUMNS)
      .in("item_id", ids);
    if (pErr)
      throw new Error(`fetchAllRoutines routines_payload: ${pErr.message}`);
    const payloadRows = (payloads as unknown as RoutinesPayloadRow[]) ?? [];
    const payloadById = new Map<string, RoutinesPayloadRow>();
    for (const p of payloadRows) payloadById.set(p.item_id, p);

    const out: RoutineNode[] = [];
    for (const m of metaRows) {
      const p = payloadById.get(m.id);
      if (!p) continue; // R2 orphan — skip
      out.push(rowsToRoutineNode(m, p));
    }
    return out;
  }

  /** Trashed counterpart (Trash UI). */
  async fetchDeletedRoutines(): Promise<RoutineNode[]> {
    const { data: metas, error: metaErr } = await this.client
      .from("items_meta")
      .select(ITEMS_META_ROUTINE_COLUMNS)
      .eq("role", "routine")
      .eq("is_deleted", true);
    if (metaErr)
      throw new Error(`fetchDeletedRoutines items_meta: ${metaErr.message}`);
    const metaRows = (metas as unknown as ItemsMetaRoutineRow[]) ?? [];
    if (metaRows.length === 0) return [];

    const ids = metaRows.map((m) => m.id);
    const { data: payloads, error: pErr } = await this.client
      .from("routines_payload")
      .select(ROUTINES_PAYLOAD_COLUMNS)
      .in("item_id", ids);
    if (pErr)
      throw new Error(`fetchDeletedRoutines routines_payload: ${pErr.message}`);
    const payloadRows = (payloads as unknown as RoutinesPayloadRow[]) ?? [];
    const payloadById = new Map<string, RoutinesPayloadRow>();
    for (const p of payloadRows) payloadById.set(p.item_id, p);

    const out: RoutineNode[] = [];
    for (const m of metaRows) {
      const p = payloadById.get(m.id);
      if (!p) continue;
      out.push(rowsToRoutineNode(m, p));
    }
    return out;
  }

  /**
   * INSERT items_meta + routines_payload with R2 hard-delete recovery.
   * Mirrors createTask (DU-B-3): if the payload INSERT fails, the meta
   * orphan is hard-deleted to keep the 1:1 invariant.
   *
   * The frontend signature is (id, title, optional schedule + frequency
   * fields). Optional fields default to a "daily, always visible, no
   * reminder" routine — the Tauri / Phase 2 default.
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
    const userId = await this.getUserId();
    const now = new Date().toISOString();
    // Build a RoutineNode shape so the mapper handles the 2-row split.
    const node: RoutineNode = {
      id,
      title,
      startTime: startTime ?? null,
      endTime: endTime ?? null,
      isArchived: false,
      isVisible: true,
      isDeleted: false,
      deletedAt: null,
      order: 0,
      frequencyType: (frequencyType ?? "daily") as RoutineNode["frequencyType"],
      frequencyDays: frequencyDays ?? [],
      frequencyInterval: frequencyInterval ?? null,
      frequencyStartDate: frequencyStartDate ?? null,
      reminderEnabled: reminderEnabled ?? false,
      reminderOffset: reminderOffset,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    const { meta, payload } = routineNodeToRows(node, userId);

    const { data: metaRow, error: metaErr } = await this.client
      .from("items_meta")
      .insert(meta)
      .select(ITEMS_META_ROUTINE_COLUMNS)
      .single();
    if (metaErr)
      throw new Error(`createRoutine items_meta: ${metaErr.message}`);

    try {
      const { data: payloadRow, error: pErr } = await this.client
        .from("routines_payload")
        .insert(payload)
        .select(ROUTINES_PAYLOAD_COLUMNS)
        .single();
      if (pErr)
        throw new Error(`createRoutine routines_payload: ${pErr.message}`);
      return rowsToRoutineNode(
        metaRow as unknown as ItemsMetaRoutineRow,
        payloadRow as unknown as RoutinesPayloadRow,
      );
    } catch (err) {
      // R2 orphan recovery — same pattern as createTask.
      await this.client.from("items_meta").delete().eq("id", meta.id);
      throw err;
    }
  }

  /**
   * Mapper-driven dual UPDATE. metaPatch ALWAYS carries updated_at
   * (DB-Q2 enforcement is in routineUpdatesToPatches). Empty payload
   * patch skips the no-op write.
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
    const userId = await this.getUserId();
    const now = new Date().toISOString();
    const { metaPatch, payloadPatch } = routineUpdatesToPatches(
      updates,
      userId,
      now,
    );

    const { error: metaErr } = await this.client
      .from("items_meta")
      .update(metaPatch)
      .eq("id", id);
    if (metaErr)
      throw new Error(`updateRoutine items_meta: ${metaErr.message}`);

    if (Object.keys(payloadPatch).length > 0) {
      const { error: pErr } = await this.client
        .from("routines_payload")
        .update(payloadPatch)
        .eq("item_id", id);
      if (pErr)
        throw new Error(`updateRoutine routines_payload: ${pErr.message}`);
    }

    const [
      { data: metaRow, error: metaReadErr },
      { data: payloadRow, error: payloadReadErr },
    ] = await Promise.all([
      this.client
        .from("items_meta")
        .select(ITEMS_META_ROUTINE_COLUMNS)
        .eq("id", id)
        .single(),
      this.client
        .from("routines_payload")
        .select(ROUTINES_PAYLOAD_COLUMNS)
        .eq("item_id", id)
        .single(),
    ]);
    if (metaReadErr)
      throw new Error(`updateRoutine read items_meta: ${metaReadErr.message}`);
    if (payloadReadErr)
      throw new Error(
        `updateRoutine read routines_payload: ${payloadReadErr.message}`,
      );
    return rowsToRoutineNode(
      metaRow as unknown as ItemsMetaRoutineRow,
      payloadRow as unknown as RoutinesPayloadRow,
    );
  }

  /**
   * Hard-delete via items_meta (payload cascades via 0008 FK ON DELETE
   * CASCADE). Legacy API kept for the DataService interface; the
   * normal user-facing path is softDeleteRoutine -> restoreRoutine ->
   * permanentDeleteRoutine.
   */
  async deleteRoutine(id: string): Promise<void> {
    const { error } = await this.client
      .from("items_meta")
      .delete()
      .eq("id", id);
    if (error) throw new Error(`deleteRoutine: ${error.message}`);
  }

  /**
   * Soft-delete the routine AND cascade soft-delete to all routine-
   * generated events that reference it. Returns the deleted event ids
   * so the Schedule UI can reconcile in-memory state without re-
   * fetching.
   *
   * Why aren't the 0008/0011 triggers enough? `trg_sync_event_deleted_
   * cache` fires on items_meta UPDATE OF is_deleted WHERE the row's id
   * == events_payload.item_id — i.e. it mirrors a single event's own
   * meta-deletion into the partial-UNIQUE filter mirror. It does NOT
   * cascade from a routine row to its generated events; that's a
   * many-to-one structural deletion the app layer owns.
   */
  async softDeleteRoutine(
    id: string,
  ): Promise<{ deletedScheduleItemIds: string[] }> {
    const now = new Date().toISOString();

    // 1. Find live routine-generated events (items_meta ids) that
    //    point at this routine.
    const { data: eventRows, error: findErr } = await this.client
      .from("events_payload")
      .select("item_id")
      .eq("routine_item_id", id)
      .eq("is_deleted_cache", false);
    if (findErr)
      throw new Error(`softDeleteRoutine find events: ${findErr.message}`);
    const eventIds =
      (eventRows as unknown as { item_id: string }[] | null)?.map(
        (r) => r.item_id,
      ) ?? [];

    // 2. Soft-delete the routine itself (items_meta).
    const { error: routineErr } = await this.client
      .from("items_meta")
      .update({ is_deleted: true, deleted_at: now, updated_at: now })
      .eq("id", id);
    if (routineErr)
      throw new Error(`softDeleteRoutine routine: ${routineErr.message}`);

    // 3. Soft-delete all derived events. The 0008 UPDATE-side trigger
    //    propagates each row's is_deleted into events_payload.is_
    //    deleted_cache so the partial-UNIQUE generator filter is in
    //    sync. version bump is implicit via metaPatch on items_meta —
    //    but here we're doing a direct UPDATE so we bump updated_at
    //    explicitly.
    if (eventIds.length > 0) {
      const { error: eventErr } = await this.client
        .from("items_meta")
        .update({ is_deleted: true, deleted_at: now, updated_at: now })
        .in("id", eventIds);
      if (eventErr)
        throw new Error(`softDeleteRoutine events: ${eventErr.message}`);
    }

    return { deletedScheduleItemIds: eventIds };
  }

  /**
   * Inverse of softDeleteRoutine. Restores the routine; the events
   * are intentionally NOT restored — the Schedule generator
   * (RoutineScheduleSync) will re-generate them on the next sync cycle
   * if the routine's frequency still matches. Mirrors Tauri behaviour:
   * a restore is "wake the routine up", not "reinstate every past
   * occurrence".
   */
  async restoreRoutine(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("items_meta")
      .update({ is_deleted: false, deleted_at: null, updated_at: now })
      .eq("id", id);
    if (error) throw new Error(`restoreRoutine: ${error.message}`);
  }

  /**
   * Physical purge. The 0011 composite FK on events_payload is ON
   * DELETE NO ACTION, so PG would reject the routine items_meta DELETE
   * while any event still references it via (routine_item_id,
   * routine_item_role). Hard-delete the dependent events_payload-
   * backed items_meta rows first (cascades to events_payload through
   * the 0008 item_id FK), then the routine itself.
   */
  async permanentDeleteRoutine(id: string): Promise<void> {
    // 1. Collect event items_meta ids that reference this routine
    //    (live + trashed — the partial-UNIQUE filter on is_deleted_cache
    //    excludes trashed events, but the composite FK does NOT, so we
    //    must clear them too).
    const { data: eventRows, error: findErr } = await this.client
      .from("events_payload")
      .select("item_id")
      .eq("routine_item_id", id);
    if (findErr)
      throw new Error(`permanentDeleteRoutine find events: ${findErr.message}`);
    const eventIds =
      (eventRows as unknown as { item_id: string }[] | null)?.map(
        (r) => r.item_id,
      ) ?? [];

    // 2. Hard-delete event items_meta rows. events_payload cascades via
    //    the 0008 item_id FK. Done one-by-one to mirror the Tasks
    //    descendants-first pattern (NO ACTION-friendly).
    for (const eid of eventIds) {
      const { error } = await this.client
        .from("items_meta")
        .delete()
        .eq("id", eid);
      if (error)
        throw new Error(
          `permanentDeleteRoutine event ${eid}: ${error.message}`,
        );
    }

    // 3. Hard-delete the routine items_meta row. routines_payload
    //    cascades via 0008 item_id FK.
    const { error } = await this.client
      .from("items_meta")
      .delete()
      .eq("id", id);
    if (error) throw new Error(`permanentDeleteRoutine: ${error.message}`);
  }
}

/*
 * DU-C-4: SupabaseRoutineGroupsService over the 0008 dedicated
 * routine_groups table (NOT a payload — groups are not items, so no
 * items_meta row). VERSIONED with native is_deleted/deleted_at; the
 * Phase 2 RoutineGroup domain type doesn't surface those (groups were
 * physically deleted in 0006) so the SELECT path filters is_deleted=
 * false at the query site.
 *
 * `deleteRoutineGroup` is the user-facing "delete" — a SOFT delete on
 * the 0008 schema (the table now has is_deleted/deleted_at). A hard
 * purge is not exposed to the UI yet.
 */
class SupabaseRoutineGroupsService {
  private readonly client: SupabaseClient;
  // Keep legacy mapper imports statically referenced.
  private static readonly _unused_select = ROUTINE_GROUP_SELECT_COLUMNS;
  private static readonly _unused_mapper = rowToRoutineGroup;
  private static readonly _unused_patch = routineGroupUpdatesToPatch;
  declare private _unused_row: RoutineGroupRow;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * Live routine groups. Filters is_deleted=false at the query site so
   * the V2 mapper doesn't need a separate "trashed" view (frontend
   * never surfaces trashed groups).
   */
  async fetchRoutineGroups(): Promise<RoutineGroup[]> {
    const { data, error } = await this.client
      .from("routine_groups")
      .select(ROUTINE_GROUPS_COLUMNS)
      .eq("is_deleted", false)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(`fetchRoutineGroups: ${error.message}`);
    const rows = (data as unknown as RoutineGroupRowV2[]) ?? [];
    return rows.map(rowToRoutineGroupV2);
  }

  /**
   * INSERT with full row. Optional frequency fields default to "daily,
   * no specific days, always visible" (Tauri parity). version=1,
   * is_deleted=false on first INSERT.
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
    const now = new Date().toISOString();
    const group: RoutineGroup = {
      id,
      name,
      color,
      isVisible: true,
      order: 0,
      frequencyType: (frequencyType ??
        "daily") as RoutineGroup["frequencyType"],
      frequencyDays: frequencyDays ?? [],
      frequencyInterval: frequencyInterval ?? null,
      frequencyStartDate: frequencyStartDate ?? null,
      createdAt: now,
      updatedAt: now,
    };
    const writeRow = routineGroupToRowV2(group);

    const { data, error } = await this.client
      .from("routine_groups")
      .insert(writeRow)
      .select(ROUTINE_GROUPS_COLUMNS)
      .single();
    if (error) throw new Error(`createRoutineGroup: ${error.message}`);
    return rowToRoutineGroupV2(data as unknown as RoutineGroupRowV2);
  }

  /**
   * Mapper-driven UPDATE with DB-Q2 bump (updated_at always set). The
   * patch covers name / color / visibility / order / all frequency_*
   * fields. version bump is NOT issued here — LWW counter advances on
   * full sync paths, not per-field UPDATE.
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
    const now = new Date().toISOString();
    const patch = routineGroupUpdatesToPatchV2(updates, now);

    const { error: updErr } = await this.client
      .from("routine_groups")
      .update(patch)
      .eq("id", id);
    if (updErr) throw new Error(`updateRoutineGroup: ${updErr.message}`);

    const { data, error: readErr } = await this.client
      .from("routine_groups")
      .select(ROUTINE_GROUPS_COLUMNS)
      .eq("id", id)
      .single();
    if (readErr) throw new Error(`updateRoutineGroup read: ${readErr.message}`);
    return rowToRoutineGroupV2(data as unknown as RoutineGroupRowV2);
  }

  /**
   * Soft-delete the group. The 0008 schema gives routine_groups
   * is_deleted/deleted_at columns (unlike Phase 2). routine_group_
   * assignments rows that reference this group are NOT soft-deleted
   * here — the frontend filters them out at the consumer level via
   * the `is_deleted=false` join. A purge path (hard delete + cascade
   * on assignments via the 0008 FK) is intentionally not exposed.
   */
  async deleteRoutineGroup(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("routine_groups")
      .update({ is_deleted: true, deleted_at: now, updated_at: now })
      .eq("id", id);
    if (error) throw new Error(`deleteRoutineGroup: ${error.message}`);
  }
}

/*
 * DU-C-4: SupabaseRoutineGroupAssignmentsService over the 0008 schema
 * (RELATION table — routine_item_id FK targets items_meta(id), not the
 * legacy routines table; no created_at column).
 *
 * `setGroupsForRoutine` is the only mutator the frontend exposes — it
 * computes the diff (add / remove) against the live join set and
 * issues partial-UNIQUE-safe INSERT for new memberships + soft-delete
 * UPDATE for removed ones. The partial UNIQUE (routine_item_id,
 * group_id) WHERE is_deleted=false enforces "at most one live join"
 * (Issue 008 same-pattern).
 */
class SupabaseRoutineGroupAssignmentsService {
  private readonly client: SupabaseClient;
  // Keep legacy mapper imports statically referenced.
  private static readonly _unused_select =
    ROUTINE_GROUP_ASSIGNMENT_SELECT_COLUMNS;
  private static readonly _unused_mapper = rowToRoutineGroupAssignment;
  declare private _unused_row: RoutineGroupAssignmentRow;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * All live (is_deleted=false) join rows for the current user. The
   * RoutineProvider composes `groupIds` per routine by bucketing these
   * client-side — keeps the read path simple and lets the join run
   * once for the whole list view.
   */
  async fetchAllRoutineGroupAssignments(): Promise<RoutineGroupAssignment[]> {
    const { data, error } = await this.client
      .from("routine_group_assignments")
      .select(ROUTINE_GROUP_ASSIGNMENTS_COLUMNS)
      .eq("is_deleted", false);
    if (error)
      throw new Error(`fetchAllRoutineGroupAssignments: ${error.message}`);
    const rows = (data as unknown as RoutineGroupAssignmentRowV2[]) ?? [];
    return rows.map(rowToRoutineGroupAssignmentV2);
  }

  /**
   * Replace the set of groups for a routine. Computes the diff against
   * the CURRENT live joins so:
   *   - groups in the new set but not currently joined → INSERT new row
   *   - groups currently joined but not in the new set → soft-delete
   *   - groups in both → leave untouched (no-op)
   *
   * partial-UNIQUE re-create: if a previously soft-deleted (group_id,
   * routine_item_id) pair is re-added, the old row stays trashed and a
   * NEW row is INSERTed with a fresh id. This matches Issue 008's
   * "soft-deleted row stays for the delta, new live row uses a fresh
   * id" contract — the partial UNIQUE allows it because the index
   * filter only sees is_deleted=false rows.
   */
  async setGroupsForRoutine(
    routineId: string,
    groupIds: string[],
  ): Promise<void> {
    const now = new Date().toISOString();

    // 1. Fetch current LIVE joins for this routine.
    const { data: currentRows, error: fetchErr } = await this.client
      .from("routine_group_assignments")
      .select("id, group_id")
      .eq("routine_item_id", routineId)
      .eq("is_deleted", false);
    if (fetchErr)
      throw new Error(`setGroupsForRoutine fetch: ${fetchErr.message}`);
    const current =
      (currentRows as unknown as { id: string; group_id: string }[] | null) ??
      [];
    const currentGroupToId = new Map(current.map((r) => [r.group_id, r.id]));
    const newSet = new Set(groupIds);

    // 2. Diff: rows to INSERT (in new, not in current).
    const toInsert: { group_id: string }[] = [];
    for (const gid of newSet) {
      if (!currentGroupToId.has(gid)) toInsert.push({ group_id: gid });
    }

    // 3. Diff: row ids to soft-delete (in current, not in new).
    const toSoftDelete: string[] = [];
    for (const [gid, rowId] of currentGroupToId) {
      if (!newSet.has(gid)) toSoftDelete.push(rowId);
    }

    // 4. INSERT new joins (one row per group). Fresh id each, partial-
    //    UNIQUE protects the live set.
    if (toInsert.length > 0) {
      const insertRows = toInsert.map((r) => ({
        id: generateId("rga"),
        routine_item_id: routineId,
        group_id: r.group_id,
        updated_at: now,
        is_deleted: false,
        deleted_at: null,
      }));
      const { error: insErr } = await this.client
        .from("routine_group_assignments")
        .insert(insertRows);
      if (insErr)
        throw new Error(`setGroupsForRoutine insert: ${insErr.message}`);
    }

    // 5. Soft-delete removed joins. Each row gets is_deleted=true +
    //    deleted_at + updated_at bump so the delta sync replicates the
    //    unassign (Issue 008 contract).
    if (toSoftDelete.length > 0) {
      const { error: delErr } = await this.client
        .from("routine_group_assignments")
        .update({ is_deleted: true, deleted_at: now, updated_at: now })
        .in("id", toSoftDelete);
      if (delErr)
        throw new Error(`setGroupsForRoutine soft-delete: ${delErr.message}`);
    }
  }
}

/*
 * DU-C-5: SupabaseScheduleItemsService over items_meta (role='event') +
 * events_payload. Pure mapping lives in scheduleItemMapper.ts.
 *
 * KEY DIFFERENCES FROM SupabaseTasksService:
 *   - The Issue-011 partial UNIQUE (routine_item_id, source_date)
 *     WHERE routine_item_id IS NOT NULL AND is_deleted_cache=false
 *     enforces "at most one LIVE routine-generated event per (routine,
 *     date)". bulkCreate uses ON CONFLICT ignoreDuplicates to absorb
 *     collisions when the generator over-shoots.
 *   - softDelete/restore on items_meta auto-propagates to
 *     events_payload.is_deleted_cache via the 0008 AFTER UPDATE
 *     trigger — no app-layer cascade needed.
 *   - The 0011 BEFORE INSERT trigger initialises is_deleted_cache
 *     from items_meta.is_deleted (defence for the "soft-delete first,
 *     then INSERT" edge case).
 *   - reminder_at write is intentionally NULL — the mapper documents
 *     that timezone math at the call site is required for absolute
 *     reminders; the bulkCreate signature doesn't carry timezone info
 *     so we drop reminderOffset on the floor.
 */
class SupabaseScheduleItemsService {
  private readonly client: SupabaseClient;
  // Keep legacy mapper imports statically referenced.
  private static readonly _unused_select = SCHEDULE_ITEM_SELECT_COLUMNS;
  private static readonly _unused_mapper = rowToScheduleItem;
  private static readonly _unused_patch = scheduleItemUpdatesToPatch;
  declare private _unused_row: ScheduleItemRow;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  private async getUserId(): Promise<string> {
    const { data, error } = await this.client.auth.getUser();
    if (error) throw new Error(`getUserId failed: ${error.message}`);
    const uid = data.user?.id;
    if (!uid) throw new Error("getUserId failed: not authenticated");
    return uid;
  }

  /**
   * In-app join of items_meta (WHERE role='event' AND meta.is_deleted=
   * false) with events_payload by item_id. Used as the SELECT helper
   * for every multi-row fetch.
   *
   * Note: events_payload.is_deleted_cache mirrors items_meta.is_deleted
   * via the 0008 AFTER UPDATE trigger, so either column would work for
   * the live filter. We filter on items_meta.is_deleted as the
   * authority and treat the cache as a partial-UNIQUE optimisation
   * only (per CLAUDE.md §4.4 SSOT rule).
   */
  private async fetchByPayloadFilter(
    payloadFilter: (
      // PostgrestFilterBuilder once `.select()` has been called — typed
      // loosely as `any` because the @supabase/supabase-js generic
      // surface for filter chaining is awkward to spell here. The lambda
      // body is the type-narrowed surface (eq/gte/lte/in are all fine).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      q: any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) => any,
    metaIsDeleted: boolean,
  ): Promise<ScheduleItem[]> {
    // 1. payload first (filterable by start_at / routine_item_id etc.)
    const pQuery = payloadFilter(
      this.client.from("events_payload").select(EVENTS_PAYLOAD_COLUMNS),
    );
    const { data: payloads, error: pErr } = await pQuery;
    if (pErr)
      throw new Error(`fetchScheduleItems events_payload: ${pErr.message}`);
    const payloadRows = (payloads as unknown as EventsPayloadRow[]) ?? [];
    if (payloadRows.length === 0) return [];

    // 2. metas (filter by role + is_deleted)
    const ids = payloadRows.map((p) => p.item_id);
    const { data: metas, error: mErr } = await this.client
      .from("items_meta")
      .select(ITEMS_META_EVENT_COLUMNS)
      .eq("role", "event")
      .eq("is_deleted", metaIsDeleted)
      .in("id", ids);
    if (mErr) throw new Error(`fetchScheduleItems items_meta: ${mErr.message}`);
    const metaRows = (metas as unknown as ItemsMetaEventRow[]) ?? [];
    const metaById = new Map<string, ItemsMetaEventRow>();
    for (const m of metaRows) metaById.set(m.id, m);

    // 3. Join in-app; skip orphans (payload without meta in the
    //    requested is_deleted bucket).
    const out: ScheduleItem[] = [];
    for (const p of payloadRows) {
      const m = metaById.get(p.item_id);
      if (!m) continue;
      out.push(rowsToScheduleItem(m, p));
    }
    return out;
  }

  /** Live events on a specific date (excludes dismissed). */
  async fetchScheduleItemsByDate(date: string): Promise<ScheduleItem[]> {
    const all = await this.fetchByPayloadFilter(
      (q) => q.eq("start_at", date).eq("is_dismissed", false),
      false,
    );
    return all;
  }

  /** Live events on a specific date INCLUDING dismissed (Trash-adjacent UI). */
  async fetchScheduleItemsByDateAll(date: string): Promise<ScheduleItem[]> {
    return this.fetchByPayloadFilter((q) => q.eq("start_at", date), false);
  }

  /** Live events in a date range (inclusive). */
  async fetchScheduleItemsByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ScheduleItem[]> {
    return this.fetchByPayloadFilter(
      (q) =>
        q
          .gte("start_at", startDate)
          .lte("start_at", endDate)
          .eq("is_dismissed", false),
      false,
    );
  }

  /** Trashed events (Trash UI). */
  async fetchDeletedScheduleItems(): Promise<ScheduleItem[]> {
    return this.fetchByPayloadFilter((q) => q, true);
  }

  /** All live events (no date filter — used by analytics / sync). */
  async fetchEvents(): Promise<ScheduleItem[]> {
    return this.fetchByPayloadFilter((q) => q.eq("is_dismissed", false), false);
  }

  /** All live events for a specific routine (current + future). */
  async fetchScheduleItemsByRoutineId(
    routineId: string,
  ): Promise<ScheduleItem[]> {
    return this.fetchByPayloadFilter(
      (q) => q.eq("routine_item_id", routineId).eq("is_dismissed", false),
      false,
    );
  }

  /**
   * MAX(source_date) across routine-generated events. Used by the
   * RoutineScheduleSync to decide whether to generate more days.
   */
  async fetchLastRoutineDate(): Promise<string | null> {
    const { data, error } = await this.client
      .from("events_payload")
      .select("source_date")
      .not("source_date", "is", null)
      .not("routine_item_id", "is", null)
      .order("source_date", { ascending: false })
      .limit(1);
    if (error) throw new Error(`fetchLastRoutineDate: ${error.message}`);
    const rows = (data as unknown as { source_date: string }[]) ?? [];
    return rows.length > 0 ? rows[0].source_date : null;
  }

  /**
   * INSERT items_meta + events_payload with R2 hard-delete recovery.
   * The frontend signature carries (id, date, title, startTime,
   * endTime, optional routineId/templateId/noteId/isAllDay/content).
   * templateId / noteId / content are NOT persisted (0008 events_
   * payload drops them by design — see scheduleItemMapper header).
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
    void templateId; // dropped — no events_payload column
    void noteId; // dropped — events<->notes use wiki_tag_connections
    void content; // dropped — no events_payload column
    const userId = await this.getUserId();
    const now = new Date().toISOString();
    const item: ScheduleItem = {
      id,
      date,
      title,
      startTime,
      endTime,
      completed: false,
      completedAt: null,
      routineId: routineId ?? null,
      templateId: null,
      memo: null,
      noteId: null,
      content: null,
      isDeleted: false,
      isDismissed: false,
      isAllDay: isAllDay ?? false,
      reminderEnabled: false,
      createdAt: now,
      updatedAt: now,
    };
    const { meta, payload } = scheduleItemToRows(item, userId);

    const { data: metaRow, error: metaErr } = await this.client
      .from("items_meta")
      .insert(meta)
      .select(ITEMS_META_EVENT_COLUMNS)
      .single();
    if (metaErr)
      throw new Error(`createScheduleItem items_meta: ${metaErr.message}`);

    try {
      const { data: payloadRow, error: pErr } = await this.client
        .from("events_payload")
        .insert(payload)
        .select(EVENTS_PAYLOAD_COLUMNS)
        .single();
      if (pErr)
        throw new Error(`createScheduleItem events_payload: ${pErr.message}`);
      return rowsToScheduleItem(
        metaRow as unknown as ItemsMetaEventRow,
        payloadRow as unknown as EventsPayloadRow,
      );
    } catch (err) {
      await this.client.from("items_meta").delete().eq("id", meta.id);
      throw err;
    }
  }

  /**
   * Mapper-driven dual UPDATE with DB-Q2 bump. content/noteId/template
   * Id/reminderOffset are silently dropped (no events_payload columns).
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
    const userId = await this.getUserId();
    const now = new Date().toISOString();
    const { metaPatch, payloadPatch } = scheduleItemUpdatesToPatches(
      updates,
      userId,
      now,
    );

    const { error: metaErr } = await this.client
      .from("items_meta")
      .update(metaPatch)
      .eq("id", id);
    if (metaErr)
      throw new Error(`updateScheduleItem items_meta: ${metaErr.message}`);

    if (Object.keys(payloadPatch).length > 0) {
      const { error: pErr } = await this.client
        .from("events_payload")
        .update(payloadPatch)
        .eq("item_id", id);
      if (pErr)
        throw new Error(`updateScheduleItem events_payload: ${pErr.message}`);
    }

    const [
      { data: metaRow, error: metaReadErr },
      { data: payloadRow, error: payloadReadErr },
    ] = await Promise.all([
      this.client
        .from("items_meta")
        .select(ITEMS_META_EVENT_COLUMNS)
        .eq("id", id)
        .single(),
      this.client
        .from("events_payload")
        .select(EVENTS_PAYLOAD_COLUMNS)
        .eq("item_id", id)
        .single(),
    ]);
    if (metaReadErr)
      throw new Error(
        `updateScheduleItem read items_meta: ${metaReadErr.message}`,
      );
    if (payloadReadErr)
      throw new Error(
        `updateScheduleItem read events_payload: ${payloadReadErr.message}`,
      );
    return rowsToScheduleItem(
      metaRow as unknown as ItemsMetaEventRow,
      payloadRow as unknown as EventsPayloadRow,
    );
  }

  /** Hard-delete via items_meta (events_payload cascades via 0008 FK). */
  async deleteScheduleItem(id: string): Promise<void> {
    const { error } = await this.client
      .from("items_meta")
      .delete()
      .eq("id", id);
    if (error) throw new Error(`deleteScheduleItem: ${error.message}`);
  }

  /**
   * Soft-delete: flip items_meta.is_deleted=true. The 0008 AFTER
   * UPDATE trigger auto-propagates to events_payload.is_deleted_cache
   * so the Issue-011 partial UNIQUE filter excludes the row from the
   * "at most one live (routine, date) pair" constraint.
   */
  async softDeleteScheduleItem(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("items_meta")
      .update({ is_deleted: true, deleted_at: now, updated_at: now })
      .eq("id", id);
    if (error) throw new Error(`softDeleteScheduleItem: ${error.message}`);
  }

  /** Inverse of softDeleteScheduleItem. Trigger updates the cache mirror. */
  async restoreScheduleItem(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("items_meta")
      .update({ is_deleted: false, deleted_at: null, updated_at: now })
      .eq("id", id);
    if (error) throw new Error(`restoreScheduleItem: ${error.message}`);
  }

  /** Hard purge (items_meta DELETE; events_payload cascades). */
  async permanentDeleteScheduleItem(id: string): Promise<void> {
    const { error } = await this.client
      .from("items_meta")
      .delete()
      .eq("id", id);
    if (error) throw new Error(`permanentDeleteScheduleItem: ${error.message}`);
  }

  /**
   * Toggle `done` (payload) + completed_at (payload) and bump
   * items_meta.updated_at (DB-Q2). Single read-back returns the
   * updated ScheduleItem.
   */
  async toggleScheduleItemComplete(id: string): Promise<ScheduleItem> {
    // Read current done state to flip.
    const { data: cur, error: curErr } = await this.client
      .from("events_payload")
      .select("done")
      .eq("item_id", id)
      .single();
    if (curErr)
      throw new Error(`toggleScheduleItemComplete read: ${curErr.message}`);
    const wasDone = (cur as unknown as { done: boolean }).done;
    const now = new Date().toISOString();

    const { error: pErr } = await this.client
      .from("events_payload")
      .update({
        done: !wasDone,
        completed_at: !wasDone ? now : null,
      })
      .eq("item_id", id);
    if (pErr)
      throw new Error(
        `toggleScheduleItemComplete events_payload: ${pErr.message}`,
      );

    const { error: mErr } = await this.client
      .from("items_meta")
      .update({ updated_at: now })
      .eq("id", id);
    if (mErr)
      throw new Error(`toggleScheduleItemComplete items_meta: ${mErr.message}`);

    // Read back combined.
    const [
      { data: metaRow, error: mReadErr },
      { data: payloadRow, error: pReadErr },
    ] = await Promise.all([
      this.client
        .from("items_meta")
        .select(ITEMS_META_EVENT_COLUMNS)
        .eq("id", id)
        .single(),
      this.client
        .from("events_payload")
        .select(EVENTS_PAYLOAD_COLUMNS)
        .eq("item_id", id)
        .single(),
    ]);
    if (mReadErr)
      throw new Error(
        `toggleScheduleItemComplete read meta: ${mReadErr.message}`,
      );
    if (pReadErr)
      throw new Error(
        `toggleScheduleItemComplete read payload: ${pReadErr.message}`,
      );
    return rowsToScheduleItem(
      metaRow as unknown as ItemsMetaEventRow,
      payloadRow as unknown as EventsPayloadRow,
    );
  }

  /**
   * Flip is_dismissed=true on events_payload + bump items_meta.updated
   * _at (DB-Q2). dismiss is the Issue-017 "user-removed-from-day"
   * signal that the routine generator respects (it won't regenerate a
   * dismissed routine-event on the same source_date).
   */
  async dismissScheduleItem(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error: pErr } = await this.client
      .from("events_payload")
      .update({ is_dismissed: true })
      .eq("item_id", id);
    if (pErr)
      throw new Error(`dismissScheduleItem events_payload: ${pErr.message}`);
    const { error: mErr } = await this.client
      .from("items_meta")
      .update({ updated_at: now })
      .eq("id", id);
    if (mErr)
      throw new Error(`dismissScheduleItem items_meta: ${mErr.message}`);
  }

  /** Inverse of dismissScheduleItem. */
  async undismissScheduleItem(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error: pErr } = await this.client
      .from("events_payload")
      .update({ is_dismissed: false })
      .eq("item_id", id);
    if (pErr)
      throw new Error(`undismissScheduleItem events_payload: ${pErr.message}`);
    const { error: mErr } = await this.client
      .from("items_meta")
      .update({ updated_at: now })
      .eq("id", id);
    if (mErr)
      throw new Error(`undismissScheduleItem items_meta: ${mErr.message}`);
  }

  /**
   * Bulk INSERT for the RoutineScheduleSync generator. Same R2 logic
   * as createScheduleItem but in two batched UPSERTs. The events_
   * payload INSERT uses upsert(..., { onConflict: 'routine_item_id,
   * source_date', ignoreDuplicates: true }) — the Issue-011 partial
   * UNIQUE filter means an existing LIVE generated row blocks the new
   * INSERT silently, which is exactly the idempotency we want (don't
   * generate "the same routine on the same date" twice).
   *
   * NOTE: the partial UNIQUE filter only matches WHERE routine_item_id
   * IS NOT NULL AND is_deleted_cache = false. Manual events (no
   * routineId) are never deduplicated; bulkCreate of manual events is
   * an unusual path, but the upsert still works (no constraint to hit).
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
    if (items.length === 0) return;
    const userId = await this.getUserId();
    const now = new Date().toISOString();

    // Pre-build all 2-row pairs so we can issue two batched writes.
    const pairs = items.map((it) => {
      void it.templateId;
      void it.noteId;
      void it.reminderEnabled;
      void it.reminderOffset;
      const item: ScheduleItem = {
        id: it.id,
        date: it.date,
        title: it.title,
        startTime: it.startTime,
        endTime: it.endTime,
        completed: false,
        completedAt: null,
        routineId: it.routineId ?? null,
        templateId: null,
        memo: null,
        noteId: null,
        content: null,
        isDeleted: false,
        isDismissed: false,
        isAllDay: false,
        reminderEnabled: false,
        createdAt: now,
        updatedAt: now,
      };
      const { meta, payload } = scheduleItemToRows(item, userId);
      return { meta, payload };
    });

    // 1. items_meta bulk INSERT. No onConflict — the generator is
    //    expected to mint fresh ids each cycle. If a caller passes a
    //    duplicate id we want a hard error.
    const { error: metaErr } = await this.client
      .from("items_meta")
      .insert(pairs.map((p) => p.meta));
    if (metaErr)
      throw new Error(`bulkCreateScheduleItems items_meta: ${metaErr.message}`);

    // 2. events_payload upsert WITH onConflict ignoreDuplicates on the
    //    partial-UNIQUE filter. Any row that would violate the live
    //    (routine_item_id, source_date) pair is dropped silently
    //    (idempotent regenerate).
    //
    //    ⚠️ events_payload.source_date is populated from
    //    `item.date` mirror — scheduleItemToRows leaves source_date as
    //    null today (the mapper's INSERT path was DU-A pre-spec). We
    //    PATCH it here so the partial UNIQUE is meaningful for the
    //    routine-generated path. Manual creates pass routineId=null
    //    and we leave source_date=null too.
    const payloadRows = pairs.map((p) => ({
      ...p.payload,
      source_date:
        p.payload.routine_item_id !== null ? p.payload.start_at : null,
    }));
    try {
      const { error: pErr } = await this.client
        .from("events_payload")
        .upsert(payloadRows, {
          onConflict: "routine_item_id,source_date",
          ignoreDuplicates: true,
        });
      if (pErr)
        throw new Error(
          `bulkCreateScheduleItems events_payload: ${pErr.message}`,
        );
    } catch (err) {
      // R2 cleanup: hard-delete the meta rows we just inserted. The
      // partial-UNIQUE collision path goes through ignoreDuplicates so
      // it does NOT raise — only a real PG/network failure lands here.
      const ids = pairs.map((p) => p.meta.id);
      await this.client.from("items_meta").delete().in("id", ids);
      throw err;
    }
  }

  /**
   * UPDATE all events generated by a routine on or after fromDate.
   * Used when a routine's schedule (title / startTime / endTime)
   * changes and the user opts to propagate forward. Returns the count
   * of rows updated for UI feedback.
   *
   * The payload UPDATE is filtered by (routine_item_id, start_at >=
   * fromDate, is_deleted_cache = false). items_meta.updated_at is
   * bumped for every affected row so Cloud Sync's LWW cursor advances.
   * Title is on items_meta; start_time/end_time are on events_payload.
   */
  async updateFutureScheduleItemsByRoutine(
    routineId: string,
    updates: { title?: string; startTime?: string; endTime?: string },
    fromDate: string,
  ): Promise<number> {
    const now = new Date().toISOString();

    // 1. Find affected rows.
    const { data: rows, error: findErr } = await this.client
      .from("events_payload")
      .select("item_id")
      .eq("routine_item_id", routineId)
      .eq("is_deleted_cache", false)
      .gte("start_at", fromDate);
    if (findErr)
      throw new Error(
        `updateFutureScheduleItemsByRoutine find: ${findErr.message}`,
      );
    const ids =
      (rows as unknown as { item_id: string }[] | null)?.map(
        (r) => r.item_id,
      ) ?? [];
    if (ids.length === 0) return 0;

    // 2. payload patch (start/end time).
    const payloadPatch: { start_time?: string; end_time?: string } = {};
    if (updates.startTime !== undefined)
      payloadPatch.start_time = updates.startTime;
    if (updates.endTime !== undefined) payloadPatch.end_time = updates.endTime;
    if (Object.keys(payloadPatch).length > 0) {
      const { error: pErr } = await this.client
        .from("events_payload")
        .update(payloadPatch)
        .in("item_id", ids);
      if (pErr)
        throw new Error(
          `updateFutureScheduleItemsByRoutine events_payload: ${pErr.message}`,
        );
    }

    // 3. meta patch (title + updated_at bump for every row).
    const metaPatch: { title?: string; updated_at: string } = {
      updated_at: now,
    };
    if (updates.title !== undefined) metaPatch.title = updates.title;
    const { error: mErr } = await this.client
      .from("items_meta")
      .update(metaPatch)
      .in("id", ids);
    if (mErr)
      throw new Error(
        `updateFutureScheduleItemsByRoutine items_meta: ${mErr.message}`,
      );

    return ids.length;
  }

  /**
   * Bulk hard-delete (used by Cleanup tooling — not the user-facing
   * trash path). Returns the count of rows actually deleted.
   * events_payload cascades via the 0008 item_id FK.
   */
  async bulkDeleteScheduleItems(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const { error } = await this.client
      .from("items_meta")
      .delete()
      .in("id", ids);
    if (error) throw new Error(`bulkDeleteScheduleItems: ${error.message}`);
    return ids.length;
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
