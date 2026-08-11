import { type SupabaseClient } from "@supabase/supabase-js";
import type {
  ItemConversionDataService,
} from "./DataService";
import type { TaskNode } from "../types/taskTree";
import type { ScheduleItem } from "../types/schedule";
import {
  ITEMS_META_TASK_COLUMNS,
  TASKS_PAYLOAD_COLUMNS,
  rowsToTaskNode,
  taskNodeToRows,
  type TasksPayloadRow,
} from "./taskMapper";
import type { ItemsMetaRow } from "./itemsMeta";
import {
  ITEMS_META_EVENT_COLUMNS,
  EVENTS_PAYLOAD_COLUMNS,
  rowsToScheduleItem,
  scheduleItemToRows,
  type ItemsMetaEventRow,
  type EventsPayloadRow,
} from "./scheduleItemMapper";
import { getAuthedUserId } from "./supabaseServiceHelpers";
import { logServiceError } from "../utils/logError";

/*
 * Event <-> Todo conversion (#625).
 *
 * WHY THIS IS NOT "delete + create"
 * =================================
 * The id is kept (2026-08-10 user ruling D-20260810-sched-2 = 案 A). Tags and
 * item links reference `items_meta.id` with no role column of their own
 * (CLAUDE.md §4), so re-roling the SAME row carries the whole graph across
 * untouched, while delete+create would silently drop every tag and every
 * "[[ ]]" edge the item was part of. It also keeps Trash, Analytics and any
 * open panel pointing at a row that still exists.
 *
 * THE THREE STEPS, AND WHY THIS ORDER
 * ===================================
 *   1. UPSERT the NEW `<role>_payload` row.
 *   2. UPDATE items_meta.role (+ the DB-Q2 bump).
 *   3. DELETE the OLD `<role>_payload` row.
 *
 * PostgREST gives us no multi-statement transaction, so one of these three is
 * always the last one that lands. The order is chosen by asking what the
 * SURVIVING middle state looks like, because that is the only thing the user
 * ever sees:
 *
 *   - This order leaves, at worst, an item that holds TWO payload rows. Every
 *     read path filters items_meta by role and joins its own payload
 *     (SupabaseTasksService.fetchTaskTree / SupabaseScheduleItemsService
 *     .fetchByPayloadFilter), so the payload belonging to the role the item no
 *     longer has is simply never reached. Invisible, harmless, and swept away
 *     with the item itself (both payload FKs are ON DELETE CASCADE).
 *   - The reverse order (delete first) leaves an items_meta row whose role has
 *     NO payload — exactly the R2 orphan db-conventions §10 forbids. Those are
 *     invisible too, but they still own the id, so the user sees the item
 *     vanish with no route back to it. That is the state worth engineering
 *     against, so the deletion goes last.
 *
 * Nothing in the schema forbids the overlap: both payload tables reference
 * `items_meta(id)` with a SINGLE-column FK (0008), not the composite one — the
 * role-carrying composite FKs are `tasks_payload.parent_item_id` (0009) and
 * `events_payload.routine_item_id` (0011), and this service refuses both of
 * the cases that could touch them (children / routine-derived) before it
 * writes anything.
 *
 * COMPENSATION
 * ============
 * One step, and only for the middle failure: if the role UPDATE does not land,
 * the just-written new payload is deleted again and the item is exactly as it
 * started. A failed step 3 needs NO compensation — the conversion has already
 * happened as far as every reader is concerned, so reporting a failure there
 * would be a lie; the leftover row is logged and left for the §10.5 sweep.
 *
 * KNOWN AND ACCEPTED: the payload is read, mapped, and written back as the
 * other role in separate requests. An edit made on another device inside that
 * window is a lost update (the conversion writes what it read). Locking it
 * down would need a version check the payload tables do not carry, and the
 * window is a single user's own two devices racing on one item — the same
 * exposure every other write path here already has.
 */

/** A conversion refused by a rule rather than by an I/O failure (#625). */
export class ItemConversionError extends Error {
  readonly reason: "role" | "routine" | "children" | "trashed" | "missing";
  constructor(reason: ItemConversionError["reason"], message: string) {
    super(message);
    this.name = "ItemConversionError";
    this.reason = reason;
  }
}

export class SupabaseItemConversionService implements ItemConversionDataService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * Re-role items_meta. Shared by both directions because the statement is
   * symmetric — only the two role literals differ.
   *
   * `fromRole` is part of the UPDATE filter, not just an assertion: a second
   * conversion racing the same id then matches zero rows instead of re-roling
   * a row that has already moved on (same idiom as the #407 conditional attach
   * in convertEventToRoutine).
   *
   * The timestamp is taken HERE, per call, and never passed in. items_meta
   * .updated_at is the LWW cursor for Sync (DB-Q2) and the payload tables carry
   * no own timestamp, so a stamp captured before the request and reused would
   * make the cursor stand still — or, on a compensating write, move backwards
   * relative to whatever landed in between.
   */
  private async reRole(
    id: string,
    fromRole: "task" | "event",
    toRole: "task" | "event",
  ): Promise<void> {
    const { data, error } = await this.client
      .from("items_meta")
      .update({ role: toRole, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("role", fromRole)
      .select("id");
    if (error)
      throw new Error(`convert items_meta role -> ${toRole}: ${error.message}`);
    if (!data || data.length === 0)
      throw new ItemConversionError(
        "role",
        `convert: ${id} is not a live "${fromRole}" item (already converted, or removed)`,
      );
  }

  /**
   * Run a cleanup write whose failure must not mask (or manufacture) an error.
   *
   * Two callers, both about a row the reader cannot see: undoing the new
   * payload after a failed role flip, and dropping the old payload once the
   * flip has landed. Either failure leaves a stray payload row, which the
   * §10.5 detection query is there to find — so it gets logged rather than
   * thrown, since throwing would report a conversion that actually succeeded
   * as a failure.
   */
  private async bestEffort(
    label: string,
    run: () => PromiseLike<{ error: { message: string } | null }>,
  ): Promise<void> {
    try {
      const { error } = await run();
      if (error) logServiceError("ItemConversion", label, error.message);
    } catch (e) {
      logServiceError("ItemConversion", label, e);
    }
  }

  /**
   * Event → Todo. The event's DATE, time span, all-day flag and reminder are
   * dropped (D-20260810-sched-3: the host confirms that in a dialog first) —
   * a Todo has nowhere to keep them. What DOES survive, because the dialog
   * never offered them up: the memo (as the task body) and the completion
   * state (a done event becomes a DONE Todo, keeping its completed_at).
   *
   * A routine-derived event is refused (D-20260810-sched-5). The user-facing
   * reason is that a Todo has no repeat — but the rejection is also load-
   * bearing for this method: it is what guarantees the row never exercises
   * the 0011 composite FK on `routine_item_id`, and it is what keeps the
   * routine generator from simply re-creating the occurrence the next time it
   * runs. Anyone relaxing that ruling has to solve both of those first.
   *
   * `order` comes from the host so the new row lands the way a fresh task does
   * (top of the root group).
   */
  async convertEventToTask(
    eventId: string,
    init: { order: number },
  ): Promise<TaskNode> {
    const userId = await getAuthedUserId(this.client);

    const [
      { data: metaRow, error: metaErr },
      { data: payloadRow, error: payloadErr },
    ] = await Promise.all([
      this.client
        .from("items_meta")
        .select(ITEMS_META_EVENT_COLUMNS)
        .eq("id", eventId)
        .maybeSingle(),
      this.client
        .from("events_payload")
        .select(EVENTS_PAYLOAD_COLUMNS)
        .eq("item_id", eventId)
        .maybeSingle(),
    ]);
    if (metaErr)
      throw new Error(`convertEventToTask read items_meta: ${metaErr.message}`);
    if (payloadErr)
      throw new Error(
        `convertEventToTask read events_payload: ${payloadErr.message}`,
      );
    if (!metaRow || !payloadRow)
      throw new ItemConversionError(
        "missing",
        `convertEventToTask: ${eventId} has no event row to convert`,
      );

    const meta = metaRow as unknown as ItemsMetaEventRow;
    const payload = payloadRow as unknown as EventsPayloadRow;
    if (meta.role !== "event")
      throw new ItemConversionError(
        "role",
        `convertEventToTask: ${eventId} is a "${meta.role}", not an event`,
      );
    // Defensive: no UI reaches Trash's rows with a convert action today, but a
    // trashed item re-roled here would land in the OTHER section's Trash, which
    // is not something any dialog offered.
    if (meta.is_deleted)
      throw new ItemConversionError(
        "trashed",
        `convertEventToTask: ${eventId} is in Trash — restore it first`,
      );
    if (payload.routine_item_id != null)
      throw new ItemConversionError(
        "routine",
        `convertEventToTask: ${eventId} is routine-derived — a Todo cannot carry a repeat`,
      );

    const node: TaskNode = {
      id: eventId,
      type: "task",
      title: meta.title,
      parentId: null,
      order: init.order,
      // The dialog warns about time and repeat, not about progress — so a done
      // event must not come back as an untouched Todo.
      status: payload.done ? "DONE" : "NOT_STARTED",
      completedAt: payload.completed_at ?? undefined,
      createdAt: meta.created_at,
      isDeleted: meta.is_deleted,
      deletedAt: meta.deleted_at ?? undefined,
      content: payload.memo ?? undefined,
      version: meta.version,
    };
    const { payload: taskPayload } = taskNodeToRows(node, userId);

    // 1. new payload in. UPSERT, not INSERT: a conversion that lost the race
    //    at step 2 on another device can leave a stale payload row behind
    //    (its step-3 cleanup is best-effort), and a plain INSERT would then
    //    fail on the PK forever. The conflicting row is stale BY DEFINITION —
    //    the role filter below is what decides who actually converts.
    const { data: inserted, error: insErr } = await this.client
      .from("tasks_payload")
      .upsert(taskPayload, { onConflict: "item_id" })
      .select(TASKS_PAYLOAD_COLUMNS)
      .single();
    if (insErr)
      throw new Error(
        `convertEventToTask insert tasks_payload: ${insErr.message}`,
      );

    // 2. role flip (+ DB-Q2 bump). The only step that needs undoing.
    try {
      await this.reRole(eventId, "event", "task");
    } catch (err) {
      await this.bestEffort("convertEventToTask undo tasks_payload", () =>
        this.client.from("tasks_payload").delete().eq("item_id", eventId),
      );
      throw err;
    }

    // 3. old payload out. Past this point the conversion HAS happened for
    //    every reader, so a failure here is logged, not thrown.
    await this.bestEffort("convertEventToTask drop events_payload", () =>
      this.client.from("events_payload").delete().eq("item_id", eventId),
    );

    const { data: newMeta, error: newMetaErr } = await this.client
      .from("items_meta")
      .select(ITEMS_META_TASK_COLUMNS)
      .eq("id", eventId)
      .single();
    if (newMetaErr)
      throw new Error(
        `convertEventToTask read back items_meta: ${newMetaErr.message}`,
      );
    return rowsToTaskNode(
      newMeta as unknown as ItemsMetaRow,
      inserted as unknown as TasksPayloadRow,
    );
  }

  /**
   * Todo → Event. The task's status is dropped (D-20260810-sched-4: the host
   * confirms that first) — an event has no third state to map "in progress"
   * onto — except for DONE, which an event CAN hold, so a finished Todo does
   * not reopen itself. The body survives as the event memo. A child Todo loses
   * its parent link (events have no hierarchy); the host's dialog says so.
   *
   * A Todo WITH CHILDREN is refused (same ruling), and the check is repeated
   * here rather than trusted to the host: 0009's composite FK
   * (parent_item_id, parent_item_role='task') -> items_meta(id, role) would
   * reject the role UPDATE anyway, and a raw FK error mid-sequence is a worse
   * outcome than a refusal before anything is written. Soft-deleted children
   * count — they hold the FK just the same, and they are invisible to the
   * host's live-tree check.
   *
   * `date` / `startTime` / `endTime` / `isAllDay` come from the host
   * (taskToEventPlacement): a placed Todo keeps its slot, an unplaced one
   * becomes an all-day item on the day the host is showing.
   */
  async convertTaskToEvent(
    taskId: string,
    init: {
      date: string;
      startTime: string;
      endTime: string;
      isAllDay: boolean;
    },
  ): Promise<ScheduleItem> {
    const userId = await getAuthedUserId(this.client);

    const [
      { data: metaRow, error: metaErr },
      { data: payloadRow, error: payloadErr },
      { data: childRows, error: childErr },
    ] = await Promise.all([
      this.client
        .from("items_meta")
        .select(ITEMS_META_TASK_COLUMNS)
        .eq("id", taskId)
        .maybeSingle(),
      this.client
        .from("tasks_payload")
        .select(TASKS_PAYLOAD_COLUMNS)
        .eq("item_id", taskId)
        .maybeSingle(),
      this.client
        .from("tasks_payload")
        .select("item_id")
        .eq("parent_item_id", taskId)
        .limit(1),
    ]);
    if (metaErr)
      throw new Error(`convertTaskToEvent read items_meta: ${metaErr.message}`);
    if (payloadErr)
      throw new Error(
        `convertTaskToEvent read tasks_payload: ${payloadErr.message}`,
      );
    if (childErr)
      throw new Error(`convertTaskToEvent read children: ${childErr.message}`);
    if (!metaRow || !payloadRow)
      throw new ItemConversionError(
        "missing",
        `convertTaskToEvent: ${taskId} has no task row to convert`,
      );

    const meta = metaRow as unknown as ItemsMetaRow;
    const payload = payloadRow as unknown as TasksPayloadRow;
    if (meta.role !== "task")
      throw new ItemConversionError(
        "role",
        `convertTaskToEvent: ${taskId} is a "${meta.role}", not a task`,
      );
    if (meta.is_deleted)
      throw new ItemConversionError(
        "trashed",
        `convertTaskToEvent: ${taskId} is in Trash — restore it first`,
      );
    if (childRows && childRows.length > 0)
      throw new ItemConversionError(
        "children",
        `convertTaskToEvent: ${taskId} still has child tasks — move or delete them first`,
      );

    const item: ScheduleItem = {
      id: taskId,
      date: init.date,
      title: meta.title,
      startTime: init.startTime,
      endTime: init.endTime,
      completed: payload.status === "DONE",
      completedAt: payload.completed_at,
      routineId: null,
      templateId: null,
      memo: payload.content,
      noteId: null,
      content: null,
      isDeleted: meta.is_deleted,
      deletedAt: meta.deleted_at,
      isDismissed: false,
      isAllDay: init.isAllDay,
      createdAt: meta.created_at,
      // Display-only on the domain object; the row's real cursor is bumped by
      // the role UPDATE below (DB-Q2), which takes its own timestamp.
      updatedAt: meta.updated_at,
    };
    const { payload: eventPayload } = scheduleItemToRows(item, userId);

    // 1. new payload in (UPSERT — see the twin method for why).
    const { data: inserted, error: insErr } = await this.client
      .from("events_payload")
      .upsert(eventPayload, { onConflict: "item_id" })
      .select(EVENTS_PAYLOAD_COLUMNS)
      .single();
    if (insErr)
      throw new Error(
        `convertTaskToEvent insert events_payload: ${insErr.message}`,
      );

    // 2. role flip (+ DB-Q2 bump).
    try {
      await this.reRole(taskId, "task", "event");
    } catch (err) {
      await this.bestEffort("convertTaskToEvent undo events_payload", () =>
        this.client.from("events_payload").delete().eq("item_id", taskId),
      );
      throw err;
    }

    // 3. old payload out (logged, not thrown — the conversion has landed).
    await this.bestEffort("convertTaskToEvent drop tasks_payload", () =>
      this.client.from("tasks_payload").delete().eq("item_id", taskId),
    );

    const { data: newMeta, error: newMetaErr } = await this.client
      .from("items_meta")
      .select(ITEMS_META_EVENT_COLUMNS)
      .eq("id", taskId)
      .single();
    if (newMetaErr)
      throw new Error(
        `convertTaskToEvent read back items_meta: ${newMetaErr.message}`,
      );
    return rowsToScheduleItem(
      newMeta as unknown as ItemsMetaEventRow,
      inserted as unknown as EventsPayloadRow,
    );
  }
}

export const PHASE2_ITEM_CONVERSION_METHOD_NAMES = [
  "convertEventToTask",
  "convertTaskToEvent",
] as const;

export type ItemConversionMethodName = (typeof PHASE2_ITEM_CONVERSION_METHOD_NAMES)[number];

export const PHASE2_ITEM_CONVERSION_METHODS: ReadonlySet<string> = new Set(PHASE2_ITEM_CONVERSION_METHOD_NAMES);
