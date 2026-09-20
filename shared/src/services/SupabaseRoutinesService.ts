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
import {
  POSTGREST_IN_CHUNK_SIZE,
  fetchAllPages,
  forEachIdChunk,
  forEachIdChunkReturning,
} from "./postgrestFetchAll";
import { requireSingleRow, requireRowPair } from "./postgrestSingle";
import { fetchMetaFirstJoin } from "./itemsMetaJoin";
import { getAuthedUserId } from "./supabaseServiceHelpers";
import { logServiceError } from "../utils/logError";
import { generateId } from "../utils/generateId";
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
   *      The order carries a second job since #1140: the bump is `.eq("role",
   *      "event")` AND reads its row count back, so it is the only place the
   *      conversion checks that the seed is still an event. Running it first
   *      is what keeps the role-blind attach from ever touching a row that
   *      stopped being one.
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
      // #1140: the bump reads its own row count, which makes this write the
      // ROLE GATE for the whole conversion — the attach below filters on
      // item_id + `.is("routine_item_id", null)` and never looks at the role,
      // so nothing downstream can tell an event from a former event. Checking
      // `mErr` alone let a zero-row match fall through silently: a seed already
      // re-roled to 'task' by convertEventToTodo missed the bump, and the
      // attach then bound the routine to the stray events_payload row that a
      // half-finished conversion leaves behind (§10.5). The conversion reported
      // SUCCESS and produced a routine no purge could ever remove — the 0011
      // composite FK is NO ACTION, and permanentDeleteRoutine's step 2 deletes
      // `role='event'` rows, so it can never clear a reference held by a
      // role='task' row. Same shape as SupabaseItemConversionService.reRole.
      const { data: bumped, error: mErr } = await this.client
        .from("items_meta")
        .update({ updated_at: now })
        .eq("id", eventId)
        .eq("role", "event")
        .select("id");
      if (mErr)
        throw new Error(`convertEventToRoutine meta bump: ${mErr.message}`);
      if (!bumped || bumped.length === 0)
        throw new Error(
          `convertEventToRoutine meta bump: seed ${eventId} is not a live "event" item (already converted to a Todo, or removed)`,
        );
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
    /*
     * #1632: hand the seed's tags to the series.
     *
     * The seed keeps its id through the conversion (#296), but the editor's
     * tag field switches its read to the ROUTINE id the moment one exists
     * (ScheduleEventEditor's `routineId ?? item.id`). So a conversion that
     * leaves the assignments on the seed empties the field while the tag side
     * still lists the seed — the two halves of #1632.
     *
     * AFTER the try/catch, and that position is the whole safety argument:
     * `wiki_tag_assignments.item_id` references items_meta ON DELETE CASCADE
     * (0008 §12), so a rollback firing after a landed move would not just undo
     * the conversion — it would destroy the user's tags. Nothing runs after
     * this line, so nothing can roll back over it. Its own failure is logged
     * and swallowed inside the helper: the conversion HAS landed by then
     * (rolling it back is impossible anyway — the seed's payload now
     * references the routine and the 0011 composite FK is NO ACTION), and
     * leaving the assignments where they are keeps them reachable from the
     * tag side rather than losing them from both.
     */
    await this.moveTagAssignments(
      eventId,
      routineId,
      `convertEventToRoutine tags (${eventId} -> ${routineId})`,
    );
    return routine;
  }

  /**
   * Move every LIVE tag assignment from one item to another (#1632).
   *
   * Moved, not copied: an assignment left behind would make the tag side count
   * the seed AND the series for one thing the user tagged once.
   *
   * Three groups, because two partial UNIQUEs constrain the destination:
   *
   *   - a tag the target already carries LIVE would break `uq_wta_item_tag`
   *     (item_id, tag_id) WHERE NOT is_deleted, so the source row is
   *     soft-deleted instead of moved — the target already says what it says;
   *   - the display-colour pick (#1580) travels with its row, unless the
   *     target already has one: `uq_wta_display_color` (item_id) WHERE
   *     is_display_color AND NOT is_deleted allows exactly one, and the
   *     target's own pick is the one the user made most recently for it;
   *   - everything else moves as it is.
   *
   * `updated_at` is bumped on every write so delta sync carries the move (the
   * relation table has no version column — Issue 008 pattern).
   *
   * Best-effort by contract: callers are conversion paths that have already
   * landed, and an error here must not fail them. Logged, never thrown.
   */
  private async moveTagAssignments(
    fromItemId: string,
    toItemId: string,
    context: string,
  ): Promise<void> {
    try {
      // Un-paginated on purpose: both reads are bounded by how many tags one
      // item carries, which is a handful (postgrestFetchAll's "structurally
      // bounded by their input" case).
      const { data: sourceData, error: sourceErr } = await this.client
        .from("wiki_tag_assignments")
        .select("id, tag_id, is_display_color")
        .eq("item_id", fromItemId)
        .eq("is_deleted", false);
      if (sourceErr) throw new Error(sourceErr.message);
      const source = (sourceData ?? []) as Array<{
        id: string;
        tag_id: string;
        is_display_color: boolean;
      }>;
      if (source.length === 0) return;

      const { data: targetData, error: targetErr } = await this.client
        .from("wiki_tag_assignments")
        .select("tag_id, is_display_color")
        .eq("item_id", toItemId)
        .eq("is_deleted", false);
      if (targetErr) throw new Error(targetErr.message);
      const target = (targetData ?? []) as Array<{
        tag_id: string;
        is_display_color: boolean;
      }>;
      const taken = new Set(target.map((r) => r.tag_id));
      const targetHasColour = target.some((r) => r.is_display_color);

      const now = new Date().toISOString();
      const duplicates = source
        .filter((r) => taken.has(r.tag_id))
        .map((r) => r.id);
      const movable = source.filter((r) => !taken.has(r.tag_id));
      const withColour = movable
        .filter((r) => r.is_display_color && !targetHasColour)
        .map((r) => r.id);
      const withoutColour = movable
        .filter((r) => !(r.is_display_color && !targetHasColour))
        .map((r) => r.id);

      if (duplicates.length > 0) {
        const { error } = await this.client
          .from("wiki_tag_assignments")
          .update({ is_deleted: true, deleted_at: now, updated_at: now })
          .in("id", duplicates);
        if (error) throw new Error(error.message);
      }
      // Colour cleared BEFORE the row that keeps one arrives, mirroring
      // setDisplayColorTag's "clear, then mark" order — the reverse is
      // rejected outright by uq_wta_display_color.
      if (withoutColour.length > 0) {
        const { error } = await this.client
          .from("wiki_tag_assignments")
          .update({
            item_id: toItemId,
            is_display_color: false,
            updated_at: now,
          })
          .in("id", withoutColour);
        if (error) throw new Error(error.message);
      }
      if (withColour.length > 0) {
        const { error } = await this.client
          .from("wiki_tag_assignments")
          .update({ item_id: toItemId, updated_at: now })
          .in("id", withColour);
        if (error) throw new Error(error.message);
      }
    } catch (e) {
      logServiceError("Routines", context, e);
    }
  }

  /**
   * Give every LIVE tag assignment on `fromItemId` to EACH of `toItemIds`
   * (#1770). The detach counterpart of {@link moveTagAssignments}, which is
   * the 1:1 case and stays as it is — a conversion has exactly one
   * destination, and re-pointing the row there keeps its id.
   *
   * Copied and then soft-deleted on the source rather than re-pointed,
   * because one row cannot be in two places: a series' tags are shown by
   * every one of its occurrences, so handing them to a single survivor is
   * what stripped the rest. The source rows still go, for the reason the 1:1
   * move has always taken them — an assignment left behind would count the
   * series AND its survivors for one thing the user tagged once.
   *
   * The same two partial UNIQUEs shape the copies as shape the move:
   *
   *   - `uq_wta_item_tag` (item_id, tag_id) WHERE NOT is_deleted — a tag a
   *     destination already carries LIVE is skipped. It already says that,
   *     and a second row would be rejected outright;
   *   - `uq_wta_display_color` (item_id) WHERE is_display_color AND NOT
   *     is_deleted — the source's colour pick travels only to destinations
   *     with no pick of their own, and at most once for each.
   *
   * Best-effort by contract, like the move: the detach has already landed by
   * the time this runs, and an error here must not fail it. Logged, never
   * thrown.
   */
  private async handOverTagAssignments(
    fromItemId: string,
    toItemIds: readonly string[],
    context: string,
  ): Promise<void> {
    try {
      if (toItemIds.length === 0) return;
      // Un-paginated: bounded by how many tags ONE item carries (a handful).
      const { data: sourceData, error: sourceErr } = await this.client
        .from("wiki_tag_assignments")
        .select("id, tag_id, is_display_color")
        .eq("item_id", fromItemId)
        .eq("is_deleted", false);
      if (sourceErr) throw new Error(sourceErr.message);
      const source = (sourceData ?? []) as Array<{
        id: string;
        tag_id: string;
        is_display_color: boolean;
      }>;
      if (source.length === 0) return;

      // What the destinations already carry. Chunked, unlike the source read:
      // this one is bounded by the number of survivors, and a long-lived
      // routine has one per past day.
      const existing = await forEachIdChunkReturning<{
        item_id: string;
        tag_id: string;
        is_display_color: boolean;
      }>(
        toItemIds,
        (chunk) =>
          this.client
            .from("wiki_tag_assignments")
            .select("item_id, tag_id, is_display_color")
            .in("item_id", chunk)
            .eq("is_deleted", false),
        `${context} destinations`,
      );
      const key = (itemId: string, tagId: string) => `${itemId}::${tagId}`;
      const taken = new Set(existing.map((r) => key(r.item_id, r.tag_id)));
      const hasColour = new Set(
        existing.filter((r) => r.is_display_color).map((r) => r.item_id),
      );

      const copies: Array<{
        id: string;
        item_id: string;
        tag_id: string;
        is_display_color: boolean;
        is_deleted: boolean;
        deleted_at: null;
      }> = [];
      for (const target of toItemIds) {
        for (const row of source) {
          if (taken.has(key(target, row.tag_id))) continue;
          const colour = row.is_display_color && !hasColour.has(target);
          if (colour) hasColour.add(target);
          copies.push({
            id: generateId("tag_assign"),
            item_id: target,
            tag_id: row.tag_id,
            is_display_color: colour,
            is_deleted: false,
            deleted_at: null,
          });
        }
      }
      for (let i = 0; i < copies.length; i += POSTGREST_IN_CHUNK_SIZE) {
        const { error } = await this.client
          .from("wiki_tag_assignments")
          .insert(copies.slice(i, i + POSTGREST_IN_CHUNK_SIZE));
        if (error) throw new Error(error.message);
      }

      // Last, and only once the copies are in: a source row dropped first
      // would take the tag with it if an insert then failed.
      const now = new Date().toISOString();
      const { error: dropErr } = await this.client
        .from("wiki_tag_assignments")
        .update({ is_deleted: true, deleted_at: now, updated_at: now })
        .in(
          "id",
          source.map((r) => r.id),
        );
      if (dropErr) throw new Error(dropErr.message);
    } catch (e) {
      logServiceError("Routines", context, e);
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

    // 3.5 #1632, widened by #1770: the tags the series carries go to the
    //     occurrences that OUTLIVE it — all of them, not one.
    //
    //     Every occurrence displayed those tags while the link existed: the
    //     editor reads them off `routineId ?? item.id` (ScheduleEventEditor),
    //     and the conversion that made the repeat moved the seed's tags onto
    //     the routine. So a row that keeps its place on the calendar and
    //     loses only its link has to be given them, or the split strips a tag
    //     the user can still see the row under.
    //
    //     Both entries land here, which is what stops them drifting apart
    //     again: the editor's Repeat = None pins one survivor, the scope
    //     dialog's "this and following" pins none and leaves the past rows.
    //     Pre-#1770 only the pinned shape handed anything over, so the second
    //     entry silently cleared the survivors' tag field.
    //     Before step 4 so the destinations are still live items.
    await this.handOverTagAssignments(
      id,
      detachIds,
      `detachRoutine tags (${id})`,
    );

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
   * away through the 0008 FK; nothing is destroyed by a purge that refuses,
   * and everything is by the other one.
   *
   * Be precise about what "recoverable" buys, though, because it is less than
   * it sounds at the UI seam: `useRoutinesAPI.permanentDeleteRoutine` drops
   * the row from `deletedRoutines` optimistically and hands the rejection to
   * `logServiceError`. So the user watches the routine leave Trash while it is
   * still in the database, and no message says otherwise. The data is intact
   * and diagnosable; the screen is lying. Surfacing it is the deferred rough
   * edge below.
   *
   * ONE ROUTE, IN TWO STEPS — and (a) on its own is harmless, so do not read
   * it alone and conclude the hazard is close at hand:
   *   (a) A conversion that died between flipping items_meta.role and dropping
   *       the old events_payload row. convertEventToTodo's step 3 is
   *       best-effort by design (db-conventions §10.5 names the leftover and
   *       ships a detection query for it), so this needs no crash, just a
   *       failed cleanup. What it leaves is a role='task' row with a stray
   *       events_payload record whose routine_item_id is NULL — because
   *       convertEventToTodo REFUSES a routine-linked event outright
   *       (SupabaseItemConversionService: `if (payload.routine_item_id != null)
   *       throw`, D-20260810-sched-5). A null link references no routine, so
   *       the NO ACTION FK has nothing to hold and no purge can wedge yet.
   *   (b) convertEventToRoutine then ATTACHING a routine to that leftover, at
   *       which point it does. Its meta bump used to check only `mErr`, so a
   *       zero-row match on an already-converted id fell through silently; the
   *       attach that follows filters on item_id and `.is("routine_item_id",
   *       null)` — which is exactly what a route-(a) leftover looks like — and
   *       never looks at the role. The conversion reported SUCCESS, and the
   *       routine it created was one that could never be purged.
   * So (b) is not a second way in, it is the second half of the only way in —
   * which is why CLOSING it closes this hazard completely rather than
   * narrowing it. #1140 did that: the bump now reads its row count back and
   * refuses a seed that is no longer an event, so nothing can attach a routine
   * to a role='task' row any more. Step 2 below therefore has no reachable
   * producer left — keep its guard anyway, because "no producer" is a claim
   * about today's call graph, not an invariant the database enforces.
   *
   * WHAT STEP 2 SAYS WHEN IT DOES MISS (#1140): it reads back the ids it
   * actually removed and throws naming the survivors, instead of letting step
   * 3 surface Postgres's raw `violates foreign key constraint`. Reporting is
   * the whole product here — the purge already refused either way. Note the
   * one false alarm this accepts: an occurrence hard-deleted by someone else
   * between step 1's read and step 2's write is also a shortfall, and it
   * throws even though the FK is clear. That window is sub-millisecond in a
   * single-user app and a retry re-reads step 1 and succeeds, which is a
   * cheaper trade than an extra round trip on every purge to tell the two
   * apart.
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
      const removed = await forEachIdChunkReturning<{ id: string }>(
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
            .eq("role", "event")
            .select("id"),
        "permanentDeleteRoutine events",
      );
      if (removed.length !== eventIds.length) {
        const gone = new Set(removed.map((r) => r.id));
        const spared = eventIds.filter((eventId) => !gone.has(eventId));
        // Name a handful, not all of them: a long-lived routine can spare
        // hundreds and the message is read in a console line.
        const sample = spared.slice(0, 5).join(", ");
        const rest = spared.length > 5 ? `, +${spared.length - 5} more` : "";
        throw new Error(
          `permanentDeleteRoutine events: ${spared.length} of ${eventIds.length} occurrence(s) referencing routine ${id} were not removed (${sample}${rest}) — they are no longer role='event', so the 0011 composite FK would block the purge`,
        );
      }
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
