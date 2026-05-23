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

class SupabaseRoutinesService {
  private readonly client: SupabaseClient;
  private static readonly _unused_select = ROUTINE_SELECT_COLUMNS;
  private static readonly _unused_mapper = rowToRoutine;
  private static readonly _unused_patch = routineUpdatesToPatch;
  declare private _unused_row: RoutineRow;

  constructor(client: SupabaseClient) {
    this.client = client;
    void this.client;
  }

  async fetchAllRoutines(): Promise<RoutineNode[]> {
    return [];
  }
  async fetchDeletedRoutines(): Promise<RoutineNode[]> {
    return [];
  }
  async createRoutine(
    _id: string,
    _title: string,
    _startTime?: string,
    _endTime?: string,
    _frequencyType?: string,
    _frequencyDays?: number[],
    _frequencyInterval?: number | null,
    _frequencyStartDate?: string | null,
    _reminderEnabled?: boolean,
    _reminderOffset?: number,
  ): Promise<RoutineNode> {
    void _id;
    void _title;
    void _startTime;
    void _endTime;
    void _frequencyType;
    void _frequencyDays;
    void _frequencyInterval;
    void _frequencyStartDate;
    void _reminderEnabled;
    void _reminderOffset;
    _pendingDuRewrite("createRoutine", "routines");
  }
  async updateRoutine(
    _id: string,
    _updates: Partial<
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
    void _id;
    void _updates;
    _pendingDuRewrite("updateRoutine", "routines");
  }
  async deleteRoutine(_id: string): Promise<void> {
    void _id;
    _pendingDuRewrite("deleteRoutine", "routines");
  }
  async softDeleteRoutine(
    _id: string,
  ): Promise<{ deletedScheduleItemIds: string[] }> {
    void _id;
    _pendingDuRewrite("softDeleteRoutine", "routines");
  }
  async restoreRoutine(_id: string): Promise<void> {
    void _id;
    _pendingDuRewrite("restoreRoutine", "routines");
  }
  async permanentDeleteRoutine(_id: string): Promise<void> {
    void _id;
    _pendingDuRewrite("permanentDeleteRoutine", "routines");
  }
}

class SupabaseRoutineGroupsService {
  private readonly client: SupabaseClient;
  private static readonly _unused_select = ROUTINE_GROUP_SELECT_COLUMNS;
  private static readonly _unused_mapper = rowToRoutineGroup;
  private static readonly _unused_patch = routineGroupUpdatesToPatch;
  declare private _unused_row: RoutineGroupRow;

  constructor(client: SupabaseClient) {
    this.client = client;
    void this.client;
  }

  async fetchRoutineGroups(): Promise<RoutineGroup[]> {
    return [];
  }
  async createRoutineGroup(
    _id: string,
    _name: string,
    _color: string,
    _frequencyType?: string,
    _frequencyDays?: number[],
    _frequencyInterval?: number | null,
    _frequencyStartDate?: string | null,
  ): Promise<RoutineGroup> {
    void _id;
    void _name;
    void _color;
    void _frequencyType;
    void _frequencyDays;
    void _frequencyInterval;
    void _frequencyStartDate;
    _pendingDuRewrite("createRoutineGroup", "routine_groups");
  }
  async updateRoutineGroup(
    _id: string,
    _updates: Partial<
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
    void _id;
    void _updates;
    _pendingDuRewrite("updateRoutineGroup", "routine_groups");
  }
  async deleteRoutineGroup(_id: string): Promise<void> {
    void _id;
    _pendingDuRewrite("deleteRoutineGroup", "routine_groups");
  }
}

class SupabaseRoutineGroupAssignmentsService {
  private readonly client: SupabaseClient;
  private static readonly _unused_select =
    ROUTINE_GROUP_ASSIGNMENT_SELECT_COLUMNS;
  private static readonly _unused_mapper = rowToRoutineGroupAssignment;
  declare private _unused_row: RoutineGroupAssignmentRow;

  constructor(client: SupabaseClient) {
    this.client = client;
    void this.client;
  }

  async fetchAllRoutineGroupAssignments(): Promise<RoutineGroupAssignment[]> {
    return [];
  }
  async setGroupsForRoutine(
    _routineId: string,
    _groupIds: string[],
  ): Promise<void> {
    void _routineId;
    void _groupIds;
    _pendingDuRewrite("setGroupsForRoutine", "routine_group_assignments");
  }
}

class SupabaseScheduleItemsService {
  private readonly client: SupabaseClient;
  private static readonly _unused_select = SCHEDULE_ITEM_SELECT_COLUMNS;
  private static readonly _unused_mapper = rowToScheduleItem;
  private static readonly _unused_patch = scheduleItemUpdatesToPatch;
  declare private _unused_row: ScheduleItemRow;

  constructor(client: SupabaseClient) {
    this.client = client;
    void this.client;
  }

  async fetchScheduleItemsByDate(_date: string): Promise<ScheduleItem[]> {
    void _date;
    return [];
  }
  async fetchScheduleItemsByDateAll(_date: string): Promise<ScheduleItem[]> {
    void _date;
    return [];
  }
  async fetchScheduleItemsByDateRange(
    _startDate: string,
    _endDate: string,
  ): Promise<ScheduleItem[]> {
    void _startDate;
    void _endDate;
    return [];
  }
  async createScheduleItem(
    _id: string,
    _date: string,
    _title: string,
    _startTime: string,
    _endTime: string,
    _routineId?: string,
    _templateId?: string,
    _noteId?: string,
    _isAllDay?: boolean,
    _content?: string,
  ): Promise<ScheduleItem> {
    void _id;
    void _date;
    void _title;
    void _startTime;
    void _endTime;
    void _routineId;
    void _templateId;
    void _noteId;
    void _isAllDay;
    void _content;
    _pendingDuRewrite("createScheduleItem", "schedule_items");
  }
  async updateScheduleItem(
    _id: string,
    _updates: Partial<
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
    void _id;
    void _updates;
    _pendingDuRewrite("updateScheduleItem", "schedule_items");
  }
  async deleteScheduleItem(_id: string): Promise<void> {
    void _id;
    _pendingDuRewrite("deleteScheduleItem", "schedule_items");
  }
  async softDeleteScheduleItem(_id: string): Promise<void> {
    void _id;
    _pendingDuRewrite("softDeleteScheduleItem", "schedule_items");
  }
  async restoreScheduleItem(_id: string): Promise<void> {
    void _id;
    _pendingDuRewrite("restoreScheduleItem", "schedule_items");
  }
  async permanentDeleteScheduleItem(_id: string): Promise<void> {
    void _id;
    _pendingDuRewrite("permanentDeleteScheduleItem", "schedule_items");
  }
  async fetchDeletedScheduleItems(): Promise<ScheduleItem[]> {
    return [];
  }
  async toggleScheduleItemComplete(_id: string): Promise<ScheduleItem> {
    void _id;
    _pendingDuRewrite("toggleScheduleItemComplete", "schedule_items");
  }
  async dismissScheduleItem(_id: string): Promise<void> {
    void _id;
    _pendingDuRewrite("dismissScheduleItem", "schedule_items");
  }
  async undismissScheduleItem(_id: string): Promise<void> {
    void _id;
    _pendingDuRewrite("undismissScheduleItem", "schedule_items");
  }
  async fetchLastRoutineDate(): Promise<string | null> {
    return null;
  }
  async bulkCreateScheduleItems(
    _items: Array<{
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
    void _items;
    _pendingDuRewrite("bulkCreateScheduleItems", "schedule_items");
  }
  async updateFutureScheduleItemsByRoutine(
    _routineId: string,
    _updates: { title?: string; startTime?: string; endTime?: string },
    _fromDate: string,
  ): Promise<number> {
    void _routineId;
    void _updates;
    void _fromDate;
    _pendingDuRewrite("updateFutureScheduleItemsByRoutine", "schedule_items");
  }
  async fetchScheduleItemsByRoutineId(
    _routineId: string,
  ): Promise<ScheduleItem[]> {
    void _routineId;
    return [];
  }
  async bulkDeleteScheduleItems(_ids: string[]): Promise<number> {
    void _ids;
    _pendingDuRewrite("bulkDeleteScheduleItems", "schedule_items");
  }
  async fetchEvents(): Promise<ScheduleItem[]> {
    return [];
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
