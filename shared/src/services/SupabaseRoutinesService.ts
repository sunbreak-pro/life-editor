import { type SupabaseClient } from "@supabase/supabase-js";
import type { RoutinesDataService } from "./DataService";
import type { RoutineNode } from "../types/routine";
import {
  // DU-C-3: 2-row API (items_meta + routines_payload)
  ITEMS_META_ROUTINE_COLUMNS,
  ROUTINES_PAYLOAD_COLUMNS,
  rowsToRoutineNode,
  routineNodeToRows,
  routineUpdatesToPatches,
  type ItemsMetaRoutineRow,
  type RoutinesPayloadRow,
} from "./routineMapper";
import { fetchAllPages, forEachIdChunk } from "./postgrestFetchAll";
import { requireSingleRow, requireRowPair } from "./postgrestSingle";
import { fetchMetaFirstJoin } from "./itemsMetaJoin";
import { getAuthedUserId } from "./supabaseServiceHelpers";
import { logServiceError } from "../utils/logError";
import { todayDateKey } from "../utils/dateKey";

/*
 * DU-C-3: SupabaseRoutinesService over items_meta (role='routine') +
 * routines_payload. Same pattern as SupabaseTodosService — pure mapping
 * lives in routineMapper.ts; this class is the I/O layer.
 *
 * NOT MODELLED HERE:
 *   - Routine-generated event materialisation lives in
 *     SupabaseScheduleItemsService.bulkCreateScheduleItems (DU-C-5);
 *     softDeleteRoutine here only cascades soft-deletes to the events
 *     items_meta rows and returns the affected ids so the Schedule UI
 *     can reconcile in-memory state.
 */
// Exported for unit testing (detachRoutine / softDeleteRoutine cascade
// semantics — #185). The Proxy in createSupabaseDataService remains the
// production entry point; tests construct this class with a mock client.
export class SupabaseRoutinesService implements RoutinesDataService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * Live routines. Two SELECTs (items_meta WHERE role='routine' +
   * routines_payload) joined in-app. Missing payload (R2 orphan) skipped.
   */
  async fetchAllRoutines(): Promise<RoutineNode[]> {
    return fetchMetaFirstJoin<
      ItemsMetaRoutineRow,
      RoutinesPayloadRow,
      RoutineNode
    >({
      client: this.client,
      role: "routine",
      isDeleted: false,
      metaColumns: ITEMS_META_ROUTINE_COLUMNS,
      metaLabel: "fetchAllRoutines items_meta",
      payloadTable: "routines_payload",
      payloadColumns: ROUTINES_PAYLOAD_COLUMNS,
      payloadLabel: "fetchAllRoutines routines_payload",
      toDomain: rowsToRoutineNode,
    });
  }

  /** Trashed counterpart (Trash UI). */
  async fetchDeletedRoutines(): Promise<RoutineNode[]> {
    return fetchMetaFirstJoin<
      ItemsMetaRoutineRow,
      RoutinesPayloadRow,
      RoutineNode
    >({
      client: this.client,
      role: "routine",
      isDeleted: true,
      metaColumns: ITEMS_META_ROUTINE_COLUMNS,
      metaLabel: "fetchDeletedRoutines items_meta",
      payloadTable: "routines_payload",
      payloadColumns: ROUTINES_PAYLOAD_COLUMNS,
      payloadLabel: "fetchDeletedRoutines routines_payload",
      toDomain: rowsToRoutineNode,
    });
  }

  /**
   * INSERT items_meta + routines_payload with R2 hard-delete recovery.
   * Mirrors createTodo (DU-B-3): if the payload INSERT fails, the meta
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
    const userId = await getAuthedUserId(this.client);
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

    const metaRow = await requireSingleRow<ItemsMetaRoutineRow>(
      this.client
        .from("items_meta")
        .insert(meta)
        .select(ITEMS_META_ROUTINE_COLUMNS)
        .single(),
      "createRoutine items_meta",
    );

    try {
      const payloadRow = await requireSingleRow<RoutinesPayloadRow>(
        this.client
          .from("routines_payload")
          .insert(payload)
          .select(ROUTINES_PAYLOAD_COLUMNS)
          .single(),
        "createRoutine routines_payload",
      );
      return rowsToRoutineNode(metaRow, payloadRow);
    } catch (err) {
      // R2 orphan recovery — same pattern as createTodo. The role filter is
      // the #1098 census guard, not a fix: this removes the row the INSERT
      // above just created, which `routineNodeToRows` stamped role='routine'
      // and whose id no caller holds yet.
      await this.client
        .from("items_meta")
        .delete()
        .eq("id", meta.id)
        .eq("role", "routine");
      throw err;
    }
  }

  /**
   * Event→Repeats conversion (#185 / #296). Sequenced writes:
   *   1. createRoutine — AWAITED, so the attach below can never lose the
   *      0011 composite-FK race (the old UI flow fired the routine INSERT
   *      and the occurrence writes as unordered promises).
   *   2. Bump the seed's items_meta.updated_at FIRST (DB-Q2 — payload rows
   *      carry no own LWW cursor), THEN attach the routine link on
   *      events_payload. This ORDER matters for clean rollback: while the
   *      seed's events_payload.routine_item_id is still null, the routine
   *      has no inbound composite FK (0011, ON DELETE NO ACTION), so a
   *      rollback delete of the routine is unblocked. Attaching first and
   *      failing the bump would wedge the rollback behind that FK, leaving
   *      a half-converted routine+seed pair. A pre-attach bump that never
   *      reaches the attach is a harmless spurious cursor advance (the
   *      seed's payload is unchanged).
   *   3. Attach the seed: events_payload.routine_item_id + source_date :=
   *      the seed's own day (the (routine, source_date) partial UNIQUE then
   *      treats the seed as that day's occurrence, so the generator will
   *      not mint a duplicate).
   * The seed row is NEVER deleted. If any step after createRoutine fails,
   * the just-created routine is rolled back (hard delete — nothing
   * references it yet) and the error is re-thrown: the conversion simply
   * did not happen, the seed event keeps its data (routine link still null).
   */
  async convertEventToRoutine(
    eventId: string,
    routineId: string,
    init: {
      title: string;
      startTime?: string;
      endTime?: string;
      frequencyType?: string;
      frequencyDays?: number[];
      frequencyInterval?: number | null;
      frequencyStartDate?: string | null;
      sourceDate: string;
    },
  ): Promise<RoutineNode> {
    const routine = await this.createRoutine(
      routineId,
      init.title,
      init.startTime,
      init.endTime,
      init.frequencyType,
      init.frequencyDays,
      init.frequencyInterval,
      init.frequencyStartDate,
    );
    try {
      const now = new Date().toISOString();
      const { error: mErr } = await this.client
        .from("items_meta")
        .update({ updated_at: now })
        .eq("id", eventId)
        .eq("role", "event");
      if (mErr)
        throw new Error(`convertEventToRoutine meta bump: ${mErr.message}`);
      // #407 double-conversion guard: attach ONLY while the seed is still
      // unattached. The host decides manual-vs-series on its (async,
      // clobberable) optimistic routineId, so a second conversion for the
      // same seed can reach here after the first one already landed — the
      // old unconditional UPDATE then re-pointed the seed at the new
      // routine and stranded the first one LIVE with no referencing seed:
      // a zombie that kept generating occurrences. With the `.is()` filter
      // the late conversion matches zero rows, rolls its routine back
      // below and surfaces as a plain failed conversion.
      const { data: attached, error: pErr } = await this.client
        .from("events_payload")
        .update({ routine_item_id: routineId, source_date: init.sourceDate })
        .eq("item_id", eventId)
        .is("routine_item_id", null)
        .select("item_id");
      if (pErr)
        throw new Error(`convertEventToRoutine attach: ${pErr.message}`);
      if (!attached || attached.length === 0)
        throw new Error(
          `convertEventToRoutine attach: seed ${eventId} is missing or already belongs to a routine (#407 double-conversion guard)`,
        );
      return routine;
    } catch (err) {
      // Roll the routine back so a half-converted state cannot survive.
      // The seed never references THIS routine on any failure path (the
      // attach did not run, did not land, or was skipped because the seed
      // already belongs to ANOTHER routine — #407), so this delete is never
      // blocked by the 0011 composite FK. Best-effort: a rollback failure
      // must not mask the original error.
      try {
        // #1098 census guard, and the one DELETE on this path that reads its
        // own result — so be precise about what a miss would cost. It is not
        // a false alarm: under the miss-not-error contract a filtered-out row
        // comes back `error: null` and the branch below stays QUIET. That is
        // the expensive direction, because the log line is this site's whole
        // product — it is what makes a #407 zombie findable at all. Suppress
        // it and the zombie is created in silence. The only reason that is an
        // acceptable trade is that the filter cannot miss here: `routineId`
        // was minted by the createRoutine call above, and 'routine' is not a
        // #625 conversion endpoint (conversion only re-roles task ⇄ event), so
        // nothing can have moved this row out from under the rollback.
        const { error: rollbackErr } = await this.client
          .from("items_meta")
          .delete()
          .eq("id", routineId)
          .eq("role", "routine");
        // supabase-js reports failures via the result, not by throwing —
        // the old unchecked call made a failed rollback silent, and what a
        // failed rollback leaves behind is exactly the #407 zombie: a live
        // routine no seed references. Log it so the strand is diagnosable.
        if (rollbackErr)
          logServiceError(
            "Routines",
            `convertEventToRoutine rollback (${routineId})`,
            rollbackErr,
          );
      } catch (rollbackErr) {
        // swallow — rethrow the original err below
        logServiceError(
          "Routines",
          `convertEventToRoutine rollback (${routineId})`,
          rollbackErr,
        );
      }
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
    const userId = await getAuthedUserId(this.client);
    const now = new Date().toISOString();
    const { metaPatch, payloadPatch } = routineUpdatesToPatches(
      updates,
      userId,
      now,
    );

    const { error: metaErr } = await this.client
      .from("items_meta")
      .update(metaPatch)
      .eq("id", id)
      .eq("role", "routine");
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

    const [metaRow, payloadRow] = await requireRowPair<
      ItemsMetaRoutineRow,
      RoutinesPayloadRow
    >(
      this.client
        .from("items_meta")
        .select(ITEMS_META_ROUTINE_COLUMNS)
        .eq("id", id)
        .single(),
      "updateRoutine read items_meta",
      this.client
        .from("routines_payload")
        .select(ROUTINES_PAYLOAD_COLUMNS)
        .eq("item_id", id)
        .single(),
      "updateRoutine read routines_payload",
    );
    return rowsToRoutineNode(metaRow, payloadRow);
  }

  /**
   * Hard-delete via items_meta (payload cascades via 0008 FK ON DELETE
   * CASCADE). Legacy API kept for the DataService interface; the
   * normal user-facing path is softDeleteRoutine -> restoreRoutine ->
   * permanentDeleteRoutine.
   */
  async deleteRoutine(id: string): Promise<void> {
    // #1098: a caller-supplied id with no read-back, structurally the same
    // exposure as deleteScheduleItem. It is not a live hole today — 'routine'
    // is not a #625 conversion endpoint, which only re-roles between 'event'
    // and 'task' — so this is the census rule holding rather than a bug being
    // fixed. Said plainly here so nobody reads the filter as evidence of one.
    const { error } = await this.client
      .from("items_meta")
      .delete()
      .eq("id", id)
      .eq("role", "routine");
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
    //    point at this routine. Paged: a long-lived routine accumulates
    //    events past the max-rows cap, and a truncated id list here
    //    would leave live events pointing at a trashed routine.
    const eventRows = await fetchAllPages<{ item_id: string }>(
      (from, to) =>
        this.client
          .from("events_payload")
          .select("item_id")
          .eq("routine_item_id", id)
          .eq("is_deleted_cache", false)
          .order("item_id")
          .range(from, to),
      "softDeleteRoutine find events",
    );
    const eventIds = eventRows.map((r) => r.item_id);

    // 2. Soft-delete the routine itself (items_meta).
    const { error: routineErr } = await this.client
      .from("items_meta")
      .update({ is_deleted: true, deleted_at: now, updated_at: now })
      .eq("id", id)
      .eq("role", "routine");
    if (routineErr)
      throw new Error(`softDeleteRoutine routine: ${routineErr.message}`);

    // 3. Soft-delete all derived events. The 0008 UPDATE-side trigger
    //    propagates each row's is_deleted into events_payload.is_
    //    deleted_cache so the partial-UNIQUE generator filter is in
    //    sync. version bump is implicit via metaPatch on items_meta —
    //    but here we're doing a direct UPDATE so we bump updated_at
    //    explicitly.
    if (eventIds.length > 0) {
      await forEachIdChunk(
        eventIds,
        (chunk) =>
          this.client
            .from("items_meta")
            .update({ is_deleted: true, deleted_at: now, updated_at: now })
            .in("id", chunk)
            .eq("role", "event"),
        "softDeleteRoutine events",
      );
    }

    return { deletedScheduleItemIds: eventIds };
  }

  /**
   * "Turn the repeat off" (#185 Step 3): detach a routine series from
   * today onward. Unlike softDeleteRoutine — which trashes EVERY live
   * occurrence regardless of date/completion — this keeps the user's life
   * record intact: only future, still-incomplete, still-live occurrences
   * are soft-deleted; past occurrences (completed or not) and any already
   * completed future one stay. The routine itself is then soft-deleted
   * WITHOUT cascading to those survivors.
   *
   * Survivor detach (QA #185, data-preservation): the survivors must NOT
   * keep pointing at the now-trashed routine, or a later
   * `permanentDeleteRoutine` — which hard-deletes EVERY event referencing
   * the routine (composite-FK ordering) before dropping it — would silently
   * purge the very life record this method set out to preserve ("detach →
   * empty the trash" data loss). So every LIVE survivor has its
   * events_payload.routine_item_id + source_date NULLed (truly cut loose),
   * with its items_meta.updated_at bumped (payload has no own updated_at —
   * DB-Q2 LWW). routine_item_role is a 0011 generated-stored column ('event'
   * / 'routine') so it is never written; the composite FK is MATCH SIMPLE so
   * a NULL routine_item_id is unenforced; the partial UNIQUE
   * uq_events_payload_routine_date is `WHERE routine_item_id IS NOT NULL` so
   * a NULLed row drops out of the index (no violation). Trashed referencing
   * rows are left untouched — purge removing an already-binned occurrence is
   * expected. Accepted trade-offs: survivors lose their routine variant
   * (indigo band), and a detach → restore-from-trash can re-generate a
   * duplicate on view — both judged lighter than losing the record to purge.
   *
   * Why the routine can be trashed without reviving the survivors: the
   * generator (RoutineScheduleSync) drives off the LIVE routine list, and
   * `shouldCreateRoutineItem` returns false for a deleted routine — a
   * trashed routine is simply absent, so no occurrence is ever regenerated.
   *
   * `today` honours the day-start-hour pref (#218/#242) via todayDateKey()
   * so a still-running late-night day is treated as editable, not past.
   * Paging (#243) mirrors softDeleteRoutine: a long-lived routine can
   * accumulate occurrences past the max-rows cap, and a truncated id list
   * would leave rows either alive (future) or still bound (survivors).
   */
  async detachRoutine(
    id: string,
    today: string = todayDateKey(),
    opts?: { keepItemIds?: string[] },
  ): Promise<{ deletedScheduleItemIds: string[] }> {
    const now = new Date().toISOString();
    // #296: ids the caller pins as survivors (the occurrence the user is
    // editing when they turn the repeat off). They move from the delete
    // partition to the detach partition below.
    const keep = new Set(opts?.keepItemIds ?? []);

    // 1. Read ALL live occurrences of this routine (item_id + the two fields
    //    that decide the partition). Paged so the id list is never silently
    //    truncated past the max-rows cap.
    const rows = await fetchAllPages<{
      item_id: string;
      start_at: string;
      done: boolean;
    }>(
      (from, to) =>
        this.client
          .from("events_payload")
          .select("item_id, start_at, done")
          .eq("routine_item_id", id)
          .eq("is_deleted_cache", false)
          .order("item_id")
          .range(from, to),
      "detachRoutine find events",
    );

    // Partition: future (start_at >= today) AND incomplete → soft-delete;
    // everything else live (past, completed, or caller-pinned keepItemIds)
    // → detach (NULL the link).
    const isFutureIncomplete = (r: {
      item_id: string;
      start_at: string;
      done: boolean;
    }) => r.start_at >= today && !r.done && !keep.has(r.item_id);
    const deleteIds = rows.filter(isFutureIncomplete).map((r) => r.item_id);
    const detachIds = rows
      .filter((r) => !isFutureIncomplete(r))
      .map((r) => r.item_id);

    // 2. Soft-delete the future/incomplete occurrences (items_meta). The
    //    0008 UPDATE-side trigger mirrors is_deleted into events_payload.
    //    is_deleted_cache so the partial-UNIQUE generator filter stays in
    //    sync. updated_at is bumped for every row (DB-Q2 LWW cursor).
    if (deleteIds.length > 0) {
      await forEachIdChunk(
        deleteIds,
        (chunk) =>
          this.client
            .from("items_meta")
            .update({ is_deleted: true, deleted_at: now, updated_at: now })
            .in("id", chunk)
            .eq("role", "event"),
        "detachRoutine events",
      );
    }

    // 3. Detach the survivors: NULL the routine link on events_payload, then
    //    bump each survivor's items_meta.updated_at (payload carries no own
    //    updated_at — the meta bump is the LWW signal for the payload edit).
    if (detachIds.length > 0) {
      await forEachIdChunk(
        detachIds,
        (chunk) =>
          this.client
            .from("events_payload")
            .update({ routine_item_id: null, source_date: null })
            .in("item_id", chunk),
        "detachRoutine survivors payload",
      );
      await forEachIdChunk(
        detachIds,
        (chunk) =>
          this.client
            .from("items_meta")
            .update({ updated_at: now })
            .in("id", chunk)
            .eq("role", "event"),
        "detachRoutine survivors meta",
      );
    }

    // 4. Soft-delete the routine itself — NO cascade to the survivors (that
    //    is what makes this different from softDeleteRoutine). Bump
    //    updated_at so Cloud Sync's LWW cursor advances (DB-Q2).
    const { error: routineErr } = await this.client
      .from("items_meta")
      .update({ is_deleted: true, deleted_at: now, updated_at: now })
      .eq("id", id)
      .eq("role", "routine");
    if (routineErr)
      throw new Error(`detachRoutine routine: ${routineErr.message}`);

    return { deletedScheduleItemIds: deleteIds };
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
      .eq("id", id)
      .eq("role", "routine");
    if (error) throw new Error(`restoreRoutine: ${error.message}`);
  }

  /**
   * Physical purge. The 0011 composite FK on events_payload is ON
   * DELETE NO ACTION, so PG would reject the routine items_meta DELETE
   * while any event still references it via (routine_item_id,
   * routine_item_role). Hard-delete the dependent events_payload-
   * backed items_meta rows first (cascades to events_payload through
   * the 0008 item_id FK), then the routine itself.
   *
   * #1098 — THE ONE PLACE WHERE A ROLE MISS IS NOT SILENT. Everywhere else on
   * the schedule path a filtered-out DELETE simply evaporates. Not here: if
   * step 2's `role='event'` filter spares a row, that row's events_payload
   * record survives still pointing at the routine, and the NO ACTION FK then
   * makes step 3 fail — the purge throws instead of completing.
   *
   * That is still the side of the trade we want. The alternative is step 2
   * hard-deleting a row that is now a Todo and cascading its tasks_payload
   * away through the 0008 FK; a purge that refuses is recoverable and a
   * deleted Todo is not.
   *
   * TWO ROUTES REACH IT, and the second is the cheap one — do not read the
   * first and conclude this is unreachable:
   *   (a) A conversion that died between flipping items_meta.role and
   *       dropping the old events_payload row. convertEventToTodo's step 3 is
   *       best-effort by design (db-conventions §10.5 names the leftover and
   *       ships a detection query for it), so this needs no crash, just a
   *       failed cleanup.
   *   (b) convertEventToRoutine ATTACHING a routine to such a leftover. Its
   *       meta bump above is `.eq("role","event")` but only checks `mErr`, so
   *       a zero-row match on an already-converted id falls through silently;
   *       the attach that follows filters on item_id and
   *       `.is("routine_item_id", null)` and never looks at the role. The
   *       conversion then reports SUCCESS, and the routine it created is one
   *       that can never be purged.
   * Route (b) is queued as a follow-up (check the bump's row count the way
   * SupabaseItemConversionService.reRole already does); it is out of #1098's
   * DELETE scope, not out of mind.
   *
   * KNOWN ROUGH EDGE, ALSO DEFERRED: when this fires, the caller gets
   * Postgres's raw `violates foreign key constraint` text from step 3 rather
   * than something naming the spared occurrence. The fix is for step 2 to
   * `.select("id")` what it actually removed and throw a named error before
   * step 3 runs — deliberately not done here because it would require
   * reshaping permanentDeleteRoutine.test.ts's mock, which is outside this
   * Issue's file scope (P-008).
   */
  async permanentDeleteRoutine(id: string): Promise<void> {
    // 1. Collect event items_meta ids that reference this routine
    //    (live + trashed — the partial-UNIQUE filter on is_deleted_cache
    //    excludes trashed events, but the composite FK does NOT, so we
    //    must clear them too).
    const eventRows = await fetchAllPages<{ item_id: string }>(
      (from, to) =>
        this.client
          .from("events_payload")
          .select("item_id")
          .eq("routine_item_id", id)
          .order("item_id")
          .range(from, to),
      "permanentDeleteRoutine find events",
    );
    const eventIds = eventRows.map((r) => r.item_id);

    // 2. Hard-delete event items_meta rows. events_payload cascades via
    //    the 0008 item_id FK.
    //
    //    Chunked, not one-by-one (#934). The ordering the NO ACTION FK
    //    demands is between the events and the ROUTINE — step 2 before step
    //    3 — not among the events themselves: they are siblings and nothing
    //    references one from another. Deleting them one request at a time
    //    bought no ordering guarantee and cost a round trip per occurrence,
    //    so a routine with 500 occurrences took 500 of them.
    if (eventIds.length > 0) {
      await forEachIdChunk(
        eventIds,
        // role='event', not 'routine': these ids came out of events_payload,
        // so what step 2 removes is the OCCURRENCES. The two steps carrying
        // different roles is what makes the split guardable at all — see the
        // #1098 note in the doc above for what a miss costs here.
        (chunk) =>
          this.client
            .from("items_meta")
            .delete()
            .in("id", chunk)
            .eq("role", "event"),
        "permanentDeleteRoutine events",
      );
    }

    // 3. Hard-delete the routine items_meta row. routines_payload
    //    cascades via 0008 item_id FK.
    const { error } = await this.client
      .from("items_meta")
      .delete()
      .eq("id", id)
      .eq("role", "routine");
    if (error) throw new Error(`permanentDeleteRoutine: ${error.message}`);
  }
}

export const PHASE2_ROUTINES_METHOD_NAMES = [
  "fetchAllRoutines",
  "fetchDeletedRoutines",
  "createRoutine",
  "convertEventToRoutine",
  "updateRoutine",
  "deleteRoutine",
  "softDeleteRoutine",
  "detachRoutine",
  "restoreRoutine",
  "permanentDeleteRoutine",
] as const;

export type RoutinesMethodName = (typeof PHASE2_ROUTINES_METHOD_NAMES)[number];

export const PHASE2_ROUTINES_METHODS: ReadonlySet<string> = new Set(
  PHASE2_ROUTINES_METHOD_NAMES,
);
