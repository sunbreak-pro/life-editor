import { type SupabaseClient } from "@supabase/supabase-js";
import type {
  ScheduleItemsDataService,
  ScheduleRestoreResult,
} from "./DataService";
import type { ScheduleItem } from "../types/schedule";
import {
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
  chunkIds,
  fetchAllPages,
  fetchByIdChunks,
  forEachIdChunk,
} from "./postgrestFetchAll";
import {
  ScheduleRestoreConflictError,
  isRoutinePairViolation,
} from "./scheduleRestoreConflict";
import { requireSingleRow, requireRowPair } from "./postgrestSingle";
import { getAuthedUserId } from "./supabaseServiceHelpers";
import {
  DEFAULT_ROUTINE_START_TIME,
  DEFAULT_ROUTINE_END_TIME,
} from "../utils/routineScheduleSync";

/*
 * DU-C-5: SupabaseScheduleItemsService over items_meta (role='event') +
 * events_payload. Pure mapping lives in scheduleItemMapper.ts.
 *
 * KEY DIFFERENCES FROM SupabaseTodosService:
 *   - The Issue-011 partial UNIQUE (routine_item_id, source_date)
 *     WHERE routine_item_id IS NOT NULL AND is_deleted_cache=false
 *     enforces "at most one LIVE routine-generated event per (routine,
 *     date)". bulkCreate absorbs the generator's over-shoot by
 *     pre-SELECTing the live pairs and dropping the collisions — NOT by
 *     ON CONFLICT / ignoreDuplicates, which PostgREST cannot aim at a
 *     PARTIAL unique index (see bulkCreateScheduleItems' own doc).
 *   - softDelete/restore on items_meta auto-propagates to
 *     events_payload.is_deleted_cache via the 0008 AFTER UPDATE
 *     trigger — no app-layer cascade needed.
 *   - The 0011 BEFORE INSERT trigger initialises is_deleted_cache
 *     from items_meta.is_deleted (defence for the "soft-delete first,
 *     then INSERT" edge case).
 *   - reminder_at write is intentionally NULL — #1374 moved the reminder
 *     to `reminder_offset_min`, and the retained absolute column is
 *     written by nobody.
 *   - bulkCreate STILL drops reminderOffset on the floor. Routine-
 *     generated occurrences therefore get no reminder; wiring the
 *     template's own offset through the generator is a follow-up, not
 *     part of #1374.
 */
/**
 * Composite key of the Issue-011 partial UNIQUE (routine_item_id,
 * source_date). Both the pre-check lookup and the drop filter must spell
 * it the same way, or the dedup silently stops matching.
 */
function routinePairKey(pair: {
  routine_item_id: string | null;
  source_date: string | null;
}): string {
  return `${pair.routine_item_id}|${pair.source_date}`;
}

// Exported for unit tests (mirrors SupabaseRoutinesService / detachRoutine):
// updateFutureScheduleItemsByRoutine's conflict-rule filtering (#279) is
// exercised against a query-builder mock.
export class SupabaseScheduleItemsService implements ScheduleItemsDataService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
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
    // 1. payload first (filterable by start_at / routine_item_id etc.).
    //    Paged: fetchEvents / fetchDeletedScheduleItems have no date
    //    bound, so the event history outgrows the max-rows cap first.
    const payloadRows = await fetchAllPages<EventsPayloadRow>(
      (from, to) =>
        payloadFilter(
          this.client.from("events_payload").select(EVENTS_PAYLOAD_COLUMNS),
        )
          .order("item_id")
          .range(from, to),
      "fetchScheduleItems events_payload",
    );
    if (payloadRows.length === 0) return [];

    // 2. metas (filter by role + is_deleted)
    const ids = payloadRows.map((p) => p.item_id);
    const metaRows = await fetchByIdChunks<ItemsMetaEventRow>(ids, (chunk) =>
      fetchAllPages(
        (from, to) =>
          this.client
            .from("items_meta")
            .select(ITEMS_META_EVENT_COLUMNS)
            .eq("role", "event")
            .eq("is_deleted", metaIsDeleted)
            .in("id", chunk)
            .order("id")
            .range(from, to),
        "fetchScheduleItems items_meta",
      ),
    );
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
    memo?: string,
  ): Promise<ScheduleItem> {
    void templateId; // dropped — no events_payload column
    void noteId; // dropped — events<->notes use wiki_tag_connections
    void content; // dropped — no events_payload column
    const userId = await getAuthedUserId(this.client);
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
      memo: memo ?? null,
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

    const metaRow = await requireSingleRow<ItemsMetaEventRow>(
      this.client
        .from("items_meta")
        .insert(meta)
        .select(ITEMS_META_EVENT_COLUMNS)
        .single(),
      "createScheduleItem items_meta",
    );

    try {
      const payloadRow = await requireSingleRow<EventsPayloadRow>(
        this.client
          .from("events_payload")
          .insert(payload)
          .select(EVENTS_PAYLOAD_COLUMNS)
          .single(),
        "createScheduleItem events_payload",
      );
      return rowsToScheduleItem(metaRow, payloadRow);
    } catch (err) {
      // R2 orphan recovery. The role filter cannot change the outcome — this
      // deletes the row the INSERT two statements up just created, and
      // `scheduleItemToRows` stamped it role='event' — so it is here for the
      // census in scheduleMetaRoleGuard.test.ts, not because a hole was found.
      // Uniformity is the point: "every items_meta DELETE names its role" is a
      // rule a reader can check, and "every one except the four that happen to
      // be provably safe today" is not.
      await this.client
        .from("items_meta")
        .delete()
        .eq("id", meta.id)
        .eq("role", "event");
      throw err;
    }
  }

  /**
   * Mapper-driven dual UPDATE with DB-Q2 bump. content / noteId /
   * templateId are silently dropped (no events_payload columns).
   * `reminderOffset` DOES land since #1374 — events_payload gained
   * `reminder_offset_min` in 0027.
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
        | "reminderOffset"
      >
    >,
  ): Promise<ScheduleItem> {
    const userId = await getAuthedUserId(this.client);
    const now = new Date().toISOString();
    const { metaPatch, payloadPatch } = scheduleItemUpdatesToPatches(
      updates,
      userId,
      now,
    );

    // #625: the role filter keeps this write off an item that is no longer an
    // event. Ids survive an Event→Todo conversion, so a stale holder of one —
    // an undo entry pushed before the conversion, a panel left open — would
    // otherwise stamp an event's title over the Todo's items_meta row. The
    // filter always matches for a genuine event, so no existing path changes;
    // the read-back below already refused the converted row (rowsToScheduleItem
    // throws on a non-event role), it just did so AFTER writing.
    const { error: metaErr } = await this.client
      .from("items_meta")
      .update(metaPatch)
      .eq("id", id)
      .eq("role", "event");
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

    const [metaRow, payloadRow] = await requireRowPair<
      ItemsMetaEventRow,
      EventsPayloadRow
    >(
      this.client
        .from("items_meta")
        .select(ITEMS_META_EVENT_COLUMNS)
        .eq("id", id)
        .single(),
      "updateScheduleItem read items_meta",
      this.client
        .from("events_payload")
        .select(EVENTS_PAYLOAD_COLUMNS)
        .eq("item_id", id)
        .single(),
      "updateScheduleItem read events_payload",
    );
    return rowsToScheduleItem(metaRow, payloadRow);
  }

  /*
   * WHY EVERY DELETE BELOW CARRIES `.eq("role", "event")` (#1098)
   * =============================================================
   * #996 put the role in the WHERE clause of every items_meta UPDATE on this
   * path; DELETE was outside that DoD and is the heavier half. #625 lets a row
   * change ROLE while keeping its id (D-20260810-sched-2), so `items_meta.id`
   * alone stopped being a safe address the moment conversion shipped — and a
   * Trash list rendered before the conversion, or a generator id list built
   * before it, does not know that. Without the filter, PostgREST finds the row
   * and removes it: the Todo's items_meta row is gone and its tasks_payload
   * cascades away with it through the 0008 FK. A wrong UPDATE stamps a row; a
   * wrong DELETE has nothing left to correct.
   *
   * The safe outcome is the same one #996 chose: a MISS, not an error.
   * PostgREST reports zero matched rows as a success with no error, so the
   * stale operation evaporates and the caller's `if (error)` never fires.
   *
   * ONE STRUCTURAL DIFFERENCE FROM #996, WORTH KNOWING BEFORE YOU "IMPROVE"
   * THIS. Half of #996's UPDATE sites get a second layer for free: they read
   * the row back through `rowsToScheduleItem` / `assertItemsMetaPair`, which
   * refuses a wrong-role row and turns the miss into a loud throw. Not one of
   * the DELETE sites has a read-back, so here the miss is silent everywhere —
   * `permanentDeleteRoutine` in SupabaseRoutinesService being the lone
   * exception, and only because a FK downstream notices (see the note there).
   * Silent is deliberate: the purge callers are fire-and-forget
   * (`useScheduleItemsTrash.ts` drops the row from the list and only logs), so
   * making a miss throw would surface an error about a row the user no longer
   * owns. `scheduleMetaRoleGuard.test.ts` pins the resolve-don't-throw shape.
   */

  /** Hard-delete via items_meta (events_payload cascades via 0008 FK). */
  async deleteScheduleItem(id: string): Promise<void> {
    const { error } = await this.client
      .from("items_meta")
      .delete()
      .eq("id", id)
      .eq("role", "event");
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
      .eq("id", id)
      .eq("role", "event");
    if (error) throw new Error(`softDeleteScheduleItem: ${error.message}`);
  }

  /**
   * Inverse of softDeleteScheduleItem. Trigger updates the cache mirror.
   *
   * Throws `ScheduleRestoreConflictError` when the row is a routine
   * occurrence whose (routine, date) pair is already held by a live row —
   * the generator mints one as soon as the occurrence is trashed, so this is
   * the common case, not an edge (#932). Letting the raw 23505 out instead
   * would reach the UI as an unreadable constraint name.
   */
  async restoreScheduleItem(id: string): Promise<void> {
    const { restorable } = await this.resolveRestorableIds([id]);
    if (restorable.length === 0) throw new ScheduleRestoreConflictError([id]);

    const now = new Date().toISOString();
    const { error } = await this.client
      .from("items_meta")
      .update({ is_deleted: false, deleted_at: null, updated_at: now })
      .eq("id", id)
      .eq("role", "event");
    if (!error) return;
    // Lost the race: the generator claimed the pair between the pre-check
    // and here. Same refusal, same shape.
    if (isRoutinePairViolation(error)) {
      throw new ScheduleRestoreConflictError([id]);
    }
    throw new Error(`restoreScheduleItem: ${error.message}`);
  }

  /**
   * Hard purge (items_meta DELETE; events_payload cascades).
   *
   * The role filter matters most here (#1098), and the reachable stale caller
   * is a cross-device Trash race rather than anything on the undo stack — the
   * schedule undo entries all go through softDelete/restore, so none of them
   * can reach a hard delete. What can: device A has Trash open showing trashed
   * event E; device B restores E and converts it to a Todo (that order is
   * forced — convertEventToTodo refuses a trashed row); device A, still
   * rendering the list it loaded before any of that, hits "delete
   * permanently". Unguarded, the id still resolves and the Todo's items_meta
   * row goes, taking its tasks_payload through the 0008 cascade.
   *
   * Heavier than `updateScheduleItem` for a second reason: there is no
   * `rowsToScheduleItem` read-back downstream to refuse a wrong-role row after
   * the fact, so the filter is the only thing standing there.
   */
  async permanentDeleteScheduleItem(id: string): Promise<void> {
    const { error } = await this.client
      .from("items_meta")
      .delete()
      .eq("id", id)
      .eq("role", "event");
    if (error) throw new Error(`permanentDeleteScheduleItem: ${error.message}`);
  }

  /**
   * Toggle `done` (payload) + completed_at (payload) and bump
   * items_meta.updated_at (DB-Q2). Single read-back returns the
   * updated ScheduleItem.
   */
  async toggleScheduleItemComplete(id: string): Promise<ScheduleItem> {
    // Read current done state to flip.
    const cur = await requireSingleRow<{ done: boolean }>(
      this.client
        .from("events_payload")
        .select("done")
        .eq("item_id", id)
        .single(),
      "toggleScheduleItemComplete read",
    );
    const wasDone = cur.done;
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
      .eq("id", id)
      .eq("role", "event");
    if (mErr)
      throw new Error(`toggleScheduleItemComplete items_meta: ${mErr.message}`);

    // Read back combined.
    const [metaRow, payloadRow] = await requireRowPair<
      ItemsMetaEventRow,
      EventsPayloadRow
    >(
      this.client
        .from("items_meta")
        .select(ITEMS_META_EVENT_COLUMNS)
        .eq("id", id)
        .single(),
      "toggleScheduleItemComplete read meta",
      this.client
        .from("events_payload")
        .select(EVENTS_PAYLOAD_COLUMNS)
        .eq("item_id", id)
        .single(),
      "toggleScheduleItemComplete read payload",
    );
    return rowsToScheduleItem(metaRow, payloadRow);
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
      .eq("id", id)
      .eq("role", "event");
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
      .eq("id", id)
      .eq("role", "event");
    if (mErr)
      throw new Error(`undismissScheduleItem items_meta: ${mErr.message}`);
  }

  /**
   * Bulk INSERT for the RoutineScheduleSync generator with app-layer
   * dedup against the Issue-011 partial UNIQUE (routine_item_id,
   * source_date) WHERE routine_item_id IS NOT NULL AND is_deleted_cache
   * = false.
   *
   * Why NOT upsert + onConflict
   * ===========================
   * PostgreSQL's INSERT ... ON CONFLICT can target a partial unique
   * index, but it requires the WHERE predicate to be supplied so the
   * planner can prove the index covers the new row. Supabase JS's
   * `.upsert({ onConflict: "col1,col2" })` only emits a column list to
   * PostgREST — there is no surface to pass the predicate. PG therefore
   * rejects the request with 400 "there is no unique or exclusion
   * constraint matching the ON CONFLICT specification" because no
   * NON-partial unique constraint covers (routine_item_id, source_date).
   *
   * Adding a non-partial UNIQUE would forbid re-creating a (routine,
   * date) pair after soft-delete, which contradicts the soft-delete-
   * aware design. So instead this method:
   *   1. Pre-SELECTs existing LIVE pairs for the (routine_item_ids,
   *      source_dates) about to be inserted.
   *   2. Drops items that would collide (silent idempotent skip).
   *   3. Issues two plain INSERTs (items_meta, then events_payload).
   *
   * Race window: between the SELECT and the INSERT another generator
   * pass could insert the same pair. If that happens, the partial-
   * UNIQUE index will raise on the second INSERT and we fall back to
   * R2 cleanup (hard-delete the meta rows we just wrote). The web
   * RoutineScheduleSync fires on an effect; concurrent fires within
   * the same browser tab are serialised by the JS event loop. Multi-
   * tab race is possible but rare and handled by the fallback.
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
    const userId = await getAuthedUserId(this.client);
    const now = new Date().toISOString();

    // Pre-build all 2-row pairs so we can issue two batched writes.
    const allPairs = items.map((it) => {
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
      // Patch source_date from start_at for the routine-generated path
      // (mapper INSERT leaves source_date null — DU-A pre-spec).
      const patchedPayload = {
        ...payload,
        source_date: payload.routine_item_id !== null ? payload.start_at : null,
      };
      return { meta, payload: patchedPayload };
    });

    // Pre-check: drop pairs whose (routine_item_id, source_date) is already
    // taken. Only routine-generated pairs are checked — manual events
    // (routine_item_id=null) are never deduplicated, and they all share the
    // key "null|null", so folding them together would collapse a day's
    // hand-made events into one.
    //
    // Two claimants, not one (#933). The live rows in the DB are the obvious
    // half; the other is THIS batch — nothing upstream promises the caller's
    // list holds each (routine, date) once, and a duplicate that reaches the
    // INSERT raises 23505 for the whole statement. Since a failed payload
    // INSERT rolls back every row, the R2 cleanup then hard-deletes the metas
    // for the entire batch: one duplicate turns a 30-day fill into zero
    // events, and the only retry is whenever the effect next fires.
    const liveSet = await this.fetchLiveRoutinePairKeys(
      allPairs.map((p) => p.payload),
    );
    const claimed = new Set<string>();
    const pairs = allPairs.filter((p) => {
      if (p.payload.routine_item_id === null) return true;
      const key = routinePairKey(p.payload);
      if (liveSet.has(key) || claimed.has(key)) return false;
      claimed.add(key);
      return true;
    });

    // All requested pairs were already live — idempotent no-op.
    if (pairs.length === 0) return;

    // 1. items_meta bulk INSERT. No onConflict — the generator is
    //    expected to mint fresh ids each cycle. If a caller passes a
    //    duplicate id we want a hard error.
    const { error: metaErr } = await this.client
      .from("items_meta")
      .insert(pairs.map((p) => p.meta));
    if (metaErr)
      throw new Error(`bulkCreateScheduleItems items_meta: ${metaErr.message}`);

    // 2. events_payload plain INSERT. If a concurrent generator pass
    //    raced us and inserted the same (routine, date) live row
    //    between our pre-check and here, the partial UNIQUE will raise
    //    23505 unique_violation. We catch and run R2 cleanup so no
    //    orphan items_meta survives.
    try {
      const { error: pErr } = await this.client
        .from("events_payload")
        .insert(pairs.map((p) => p.payload));
      if (pErr)
        throw new Error(
          `bulkCreateScheduleItems events_payload: ${pErr.message}`,
        );
    } catch (err) {
      // R2 cleanup, chunked so a large batch's ids fit the URL. Best-
      // effort: a cleanup failure must not mask the original INSERT
      // error (leftover orphans are swept by the R2 detection SQL).
      const ids = pairs.map((p) => p.meta.id);
      try {
        await forEachIdChunk(
          ids,
          // Same census guard as the single-row R2 cleanup above, and just as
          // provably a no-op: these are the metas this call bulk-INSERTed a
          // few lines up. It does not move the chunk budget either — a full
          // POSTGREST_IN_CHUNK_SIZE chunk is 200 × `si-<uuid>` (39 chars) plus
          // percent-encoded commas ≈ 8.4 KB of query string, so `&role=eq
          // .event` adds 14 bytes to something already sized against the 16 KB
          // proxy cap. (The helper's own header says "~25 chars per id", which
          // undercounts a prefixed uuid — the conclusion holds, the figure
          // does not.)
          (chunk) =>
            this.client
              .from("items_meta")
              .delete()
              .in("id", chunk)
              .eq("role", "event"),
          "bulkCreateScheduleItems R2 cleanup",
        );
      } catch {
        // swallow — rethrow the original err below
      }
      throw err;
    }
  }

  /**
   * The dedup half of bulkCreateScheduleItems' Issue-011 pre-check: given
   * the payload rows about to be inserted, return the `routinePairKey`s
   * that ALREADY exist as live rows. Manual events (routine_item_id null)
   * are not eligible for the partial UNIQUE and are never looked up.
   *
   * `is_deleted_cache = false` is the ONLY liveness filter, and that is
   * deliberate: adding `.eq("is_dismissed", false)` would read as a
   * tightening but is what stops a DISMISSED day from being re-generated
   * — a skipped occurrence still occupies its (routine, date) pair.
   *
   * Paged: the .in().in() filter is a CROSS-PRODUCT — the result scales
   * with the existing live rows matching |routineIds| × |sourceDates|,
   * not with the insert batch. A capped pre-check would let already-live
   * pairs through to the INSERT and turn the whole batch into a 23505 →
   * R2-cleanup throw.
   */
  private async fetchLiveRoutinePairKeys(
    payloads: ReadonlyArray<{
      routine_item_id: string | null;
      source_date: string | null;
    }>,
  ): Promise<Set<string>> {
    const routinePairs = payloads.filter(
      (p) => p.routine_item_id !== null && p.source_date !== null,
    );
    const keys = new Set<string>();
    if (routinePairs.length === 0) return keys;

    const routineIds = Array.from(
      new Set(routinePairs.map((p) => p.routine_item_id as string)),
    );
    const sourceDates = Array.from(
      new Set(routinePairs.map((p) => p.source_date as string)),
    );
    const existing = await fetchAllPages<{
      routine_item_id: string;
      source_date: string;
    }>(
      (from, to) =>
        this.client
          .from("events_payload")
          .select("routine_item_id, source_date")
          .in("routine_item_id", routineIds)
          .in("source_date", sourceDates)
          .eq("is_deleted_cache", false)
          .order("item_id")
          .range(from, to),
      "bulkCreateScheduleItems pre-check",
    );
    for (const r of existing) keys.add(routinePairKey(r));
    return keys;
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
    template?: {
      title: string;
      startTime: string | null;
      endTime: string | null;
    },
  ): Promise<number> {
    const now = new Date().toISOString();

    // 1. Find affected rows (paged — same rationale as softDeleteRoutine).
    //    Conflict rules (tier-1 §Schedule, #279): done / dismissed occurrences
    //    are the user's life record and are never patched by a series edit.
    const rows = await fetchAllPages<{
      item_id: string;
      start_time: string;
      end_time: string;
      done: boolean;
      is_dismissed: boolean;
    }>(
      (from, to) =>
        this.client
          .from("events_payload")
          .select("item_id, start_time, end_time, done, is_dismissed")
          .eq("routine_item_id", routineId)
          .eq("is_deleted_cache", false)
          .gte("start_at", fromDate)
          .order("item_id")
          .range(from, to),
      "updateFutureScheduleItemsByRoutine find",
    );
    let candidates = rows.filter((r) => !r.done && !r.is_dismissed);

    // Manual edits win over series edits (tier-1 §Schedule rule 2): when the
    // caller supplies the routine's pre-edit template, only rows still
    // matching it (= never individually edited) receive the patch. A null
    // template time is NOT a wildcard — a time-less routine materialises
    // with the generator defaults, so compare against those effective values
    // (otherwise every hand-moved row of a default-time routine would lose
    // its rule-2 protection).
    if (template) {
      const templateStart = template.startTime ?? DEFAULT_ROUTINE_START_TIME;
      const templateEnd = template.endTime ?? DEFAULT_ROUTINE_END_TIME;
      candidates = candidates.filter(
        (r) => r.start_time === templateStart && r.end_time === templateEnd,
      );
      if (template.title != null && candidates.length > 0) {
        const titleRows = await fetchByIdChunks(
          candidates.map((r) => r.item_id),
          async (chunk) => {
            const { data, error } = await this.client
              .from("items_meta")
              .select("id, title")
              .in("id", chunk);
            if (error)
              throw new Error(
                `updateFutureScheduleItemsByRoutine titles: ${error.message}`,
              );
            return (data ?? []) as Array<{ id: string; title: string }>;
          },
        );
        const titleById = new Map(titleRows.map((r) => [r.id, r.title]));
        candidates = candidates.filter(
          (r) => titleById.get(r.item_id) === template.title,
        );
      }
    }

    const ids = candidates.map((r) => r.item_id);
    if (ids.length === 0) return 0;

    // 2. payload patch (start/end time). The done/dismissed predicates are
    // re-asserted server-side: a row completed or dismissed on another
    // device between the SELECT above and this UPDATE stays untouched
    // (rule 1 — cross-device TOCTOU guard; the meta bump below cannot carry
    // the same predicate, so a raced row may get a harmless updated_at/title
    // bump but never a time rewrite).
    const payloadPatch: { start_time?: string; end_time?: string } = {};
    if (updates.startTime !== undefined)
      payloadPatch.start_time = updates.startTime;
    if (updates.endTime !== undefined) payloadPatch.end_time = updates.endTime;
    if (Object.keys(payloadPatch).length > 0) {
      await forEachIdChunk(
        ids,
        (chunk) =>
          this.client
            .from("events_payload")
            .update(payloadPatch)
            .in("item_id", chunk)
            .eq("done", false)
            .eq("is_dismissed", false),
        "updateFutureScheduleItemsByRoutine events_payload",
      );
    }

    // 3. meta patch (title + updated_at bump for every row).
    const metaPatch: { title?: string; updated_at: string } = {
      updated_at: now,
    };
    if (updates.title !== undefined) metaPatch.title = updates.title;
    await forEachIdChunk(
      ids,
      (chunk) =>
        this.client
          .from("items_meta")
          .update(metaPatch)
          .in("id", chunk)
          .eq("role", "event"),
      "updateFutureScheduleItemsByRoutine items_meta",
    );

    return ids.length;
  }

  /**
   * Bulk hard-delete (used by Cleanup tooling — not the user-facing
   * trash path). events_payload cascades via the 0008 item_id FK.
   *
   * Returns the REQUESTED count, not the affected one: the DELETEs go out
   * without `count: "exact"`, so an id that no longer exists is
   * indistinguishable from one that was removed. Same for the soft-delete
   * / restore pair below. Callers read this as "the batch went through",
   * never as "N rows existed".
   */
  async bulkDeleteScheduleItems(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    await forEachIdChunk(
      ids,
      // The widest blast radius of the ten guarded deletes (#1098): a
      // caller-supplied array, hard-deleted, with one converted id anywhere in
      // it enough to take a Todo along. The returned count does not change
      // meaning — as the doc above already says, these DELETEs go out without
      // `count: "exact"`, so a filtered-out id was already indistinguishable
      // from one that no longer exists.
      (chunk) =>
        this.client
          .from("items_meta")
          .delete()
          .in("id", chunk)
          .eq("role", "event"),
      "bulkDeleteScheduleItems",
    );
    return ids.length;
  }

  /**
   * Bulk soft-delete (Trash-recoverable — items_meta.is_deleted, the 0008
   * trigger mirrors is_deleted_cache onto events_payload). The generator's
   * frequency-mismatch cleanup calls THIS (#296): hard bulkDelete there
   * destroyed hand-moved occurrences beyond any recovery.
   */
  async bulkSoftDeleteScheduleItems(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const now = new Date().toISOString();
    await forEachIdChunk(
      ids,
      (chunk) =>
        this.client
          .from("items_meta")
          .update({ is_deleted: true, deleted_at: now, updated_at: now })
          .in("id", chunk)
          .eq("role", "event"),
      "bulkSoftDeleteScheduleItems",
    );
    return ids.length;
  }

  /**
   * Inverse of bulkSoftDeleteScheduleItems (the 0008 trigger mirrors the
   * cleared flag back onto events_payload.is_deleted_cache, so the generator's
   * partial-UNIQUE filter sees these rows again).
   *
   * Undoing a routine deletion restores the whole cascade through here (#708):
   * the reads that feed the generator filter is_deleted, so a still-trashed
   * occurrence is invisible to it and it mints a fresh id for the same day
   * instead. Bringing the rows back BEFORE the routine returns to the live
   * list is what keeps the original ids.
   */
  async bulkRestoreScheduleItems(
    ids: string[],
  ): Promise<ScheduleRestoreResult> {
    if (ids.length === 0) return { restoredIds: [], conflictedIds: [] };

    const { restorable, conflicted } = await this.resolveRestorableIds(ids);
    const restoredIds: string[] = [];
    const conflictedIds = [...conflicted];
    if (restorable.length === 0) return { restoredIds, conflictedIds };

    const now = new Date().toISOString();
    const patch = { is_deleted: false, deleted_at: null, updated_at: now };
    const update = (chunk: string[]) =>
      this.client
        .from("items_meta")
        .update(patch)
        .in("id", chunk)
        .eq("role", "event");

    for (const chunk of chunkIds(restorable)) {
      const { error } = await update(chunk);
      if (!error) {
        restoredIds.push(...chunk);
        continue;
      }
      if (!isRoutinePairViolation(error)) {
        throw new Error(`bulkRestoreScheduleItems: ${error.message}`);
      }
      // A racing generator claimed one of the pairs, and PostgREST cannot
      // say which — the whole chunk was rolled back. Re-run it id by id so
      // the loser is the only row left behind (DoD: never stop half-way
      // with an unreported remainder).
      for (const single of chunk) {
        const { error: soloErr } = await update([single]);
        if (!soloErr) {
          restoredIds.push(single);
        } else if (isRoutinePairViolation(soloErr)) {
          conflictedIds.push(single);
        } else {
          throw new Error(`bulkRestoreScheduleItems: ${soloErr.message}`);
        }
      }
    }
    return { restoredIds, conflictedIds };
  }

  /**
   * Split a restore batch into rows that can come back and rows whose
   * (routine, date) pair is already taken by a live row (#932).
   *
   * Manual events (routine_item_id null) are never eligible for the
   * Issue-011 partial UNIQUE, so they are always restorable — including
   * the hand-made seed event a repeat was grown from (#296), which is the
   * row the user most wants back.
   *
   * Two sources of collision, and both have to be caught here or the write
   * throws: a pair already live in the DB, and two trashed rows inside this
   * same batch sharing a pair (possible after repeated trash/regenerate
   * cycles). For the latter the first id wins, matching the order the
   * caller asked for.
   */
  private async resolveRestorableIds(
    ids: readonly string[],
  ): Promise<{ restorable: string[]; conflicted: string[] }> {
    const rows = await fetchByIdChunks<{
      item_id: string;
      routine_item_id: string | null;
      source_date: string | null;
    }>(ids, (chunk) =>
      fetchAllPages(
        (from, to) =>
          this.client
            .from("events_payload")
            .select("item_id, routine_item_id, source_date")
            .in("item_id", chunk)
            .order("item_id")
            .range(from, to),
        "restore pre-check",
      ),
    );
    const pairKeyById = new Map<string, string>();
    const routinePairs: Array<{
      routine_item_id: string | null;
      source_date: string | null;
    }> = [];
    for (const row of rows) {
      if (row.routine_item_id === null || row.source_date === null) continue;
      pairKeyById.set(row.item_id, routinePairKey(row));
      routinePairs.push(row);
    }

    const liveSet = await this.fetchLiveRoutinePairKeys(routinePairs);
    const restorable: string[] = [];
    const conflicted: string[] = [];
    const claimed = new Set<string>();
    for (const id of ids) {
      const key = pairKeyById.get(id);
      if (key === undefined) {
        restorable.push(id);
        continue;
      }
      if (liveSet.has(key) || claimed.has(key)) {
        conflicted.push(id);
        continue;
      }
      claimed.add(key);
      restorable.push(id);
    }
    return { restorable, conflicted };
  }
}

export const PHASE2_SCHEDULE_ITEM_METHOD_NAMES = [
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
  "bulkCreateScheduleItems",
  "updateFutureScheduleItemsByRoutine",
  "fetchScheduleItemsByRoutineId",
  "bulkDeleteScheduleItems",
  "bulkSoftDeleteScheduleItems",
  "bulkRestoreScheduleItems",
  "fetchEvents",
] as const;

export type ScheduleItemMethodName =
  (typeof PHASE2_SCHEDULE_ITEM_METHOD_NAMES)[number];

export const PHASE2_SCHEDULE_ITEM_METHODS: ReadonlySet<string> = new Set(
  PHASE2_SCHEDULE_ITEM_METHOD_NAMES,
);
