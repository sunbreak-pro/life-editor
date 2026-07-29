import { type SupabaseClient } from "@supabase/supabase-js";
import type { ScheduleItem } from "../types/schedule";
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
  fetchAllPages,
  fetchByIdChunks,
  forEachIdChunk,
} from "./postgrestFetchAll";
import { getAuthedUserId } from "./supabaseServiceHelpers";
import {
  DEFAULT_ROUTINE_START_TIME,
  DEFAULT_ROUTINE_END_TIME,
} from "../utils/routineScheduleSync";

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
// Exported for unit tests (mirrors SupabaseRoutinesService / detachRoutine):
// updateFutureScheduleItemsByRoutine's conflict-rule filtering (#279) is
// exercised against a query-builder mock.
export class SupabaseScheduleItemsService {
  private readonly client: SupabaseClient;
  // Keep legacy mapper imports statically referenced.
  private static readonly _unused_select = SCHEDULE_ITEM_SELECT_COLUMNS;
  private static readonly _unused_mapper = rowToScheduleItem;
  private static readonly _unused_patch = scheduleItemUpdatesToPatch;
  declare private _unused_row: ScheduleItemRow;

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
    const userId = await getAuthedUserId(this.client);
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

    // Pre-check: drop pairs whose (routine_item_id, source_date) already
    // exists as a LIVE row. Only routine-generated pairs are checked —
    // manual events (routine_item_id=null) are never deduplicated.
    const routinePairs = allPairs.filter(
      (p) =>
        p.payload.routine_item_id !== null && p.payload.source_date !== null,
    );
    const liveSet = new Set<string>();
    if (routinePairs.length > 0) {
      const routineIds = Array.from(
        new Set(routinePairs.map((p) => p.payload.routine_item_id as string)),
      );
      const sourceDates = Array.from(
        new Set(routinePairs.map((p) => p.payload.source_date as string)),
      );
      // Paged: the .in().in() filter is a CROSS-PRODUCT — the result
      // scales with the existing live rows matching |routineIds| ×
      // |sourceDates|, not with the insert batch. A capped pre-check
      // would let already-live pairs through to the INSERT and turn the
      // whole batch into a 23505 → R2-cleanup throw.
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
      for (const r of existing) {
        liveSet.add(`${r.routine_item_id}|${r.source_date}`);
      }
    }

    const pairs = allPairs.filter((p) => {
      if (p.payload.routine_item_id === null) return true;
      const key = `${p.payload.routine_item_id}|${p.payload.source_date}`;
      return !liveSet.has(key);
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
          (chunk) => this.client.from("items_meta").delete().in("id", chunk),
          "bulkCreateScheduleItems R2 cleanup",
        );
      } catch {
        // swallow — rethrow the original err below
      }
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
        this.client.from("items_meta").update(metaPatch).in("id", chunk),
      "updateFutureScheduleItemsByRoutine items_meta",
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
    await forEachIdChunk(
      ids,
      (chunk) => this.client.from("items_meta").delete().in("id", chunk),
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
          .in("id", chunk),
      "bulkSoftDeleteScheduleItems",
    );
    return ids.length;
  }
}

export const PHASE2_SCHEDULE_ITEM_METHODS = new Set<string>([
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
  "fetchEvents",
]);
