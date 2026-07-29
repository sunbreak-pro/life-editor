import { type SupabaseClient } from "@supabase/supabase-js";
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
  SupabaseWikiTagsUnifiedService,
  PHASE2_WIKI_TAGS_UNIFIED_METHODS,
} from "./SupabaseWikiTagsUnifiedService";
import {
  SupabaseNotesUnifiedService,
  PHASE2_NOTES_UNIFIED_METHODS,
} from "./SupabaseNotesUnifiedService";
import {
  SupabaseDailiesUnifiedService,
  PHASE2_DAILIES_UNIFIED_METHODS,
} from "./SupabaseDailiesUnifiedService";
import {
  SupabaseTimerService,
  PHASE2_TIMER_METHODS,
} from "./SupabaseTimerService";
import {
  SupabaseAudioService,
  PHASE2_AUDIO_METHODS,
} from "./SupabaseAudioService";
import {
  SupabaseTasksService,
  PHASE2_TASKS_METHODS,
} from "./SupabaseTasksService";
import {
  SupabaseRoutinesService,
  PHASE2_ROUTINES_METHODS,
} from "./SupabaseRoutinesService";
import {
  SupabaseScheduleItemsService,
  PHASE2_SCHEDULE_ITEM_METHODS,
} from "./SupabaseScheduleItemsService";
import type { CalendarNode } from "../types/calendar";
import {
  CALENDAR_SELECT_COLUMNS,
  rowToCalendar,
  calendarUpdatesToPatch,
  type CalendarRow,
} from "./calendarMapper";
import { fetchAllPages } from "./postgrestFetchAll";
/*
 * Phase 2 S1 Supabase implementation.
 *
 * The `tasks` domain is fully implemented (full-column round-trip against
 * the 0003_tasks_full_schema.sql shape: hierarchy / soft-delete /
 * scheduling / versioning). Pure mapping lives in `taskMapper.ts`; this
 * file is the I/O layer only. Several other domains are now ported as
 * well (daily / notes / wiki-tags / routines / schedule / calendars /
 * timer / audio); only methods on the remaining un-ported domains throw
 * at call time ("not implemented in phase 2"). Later S-steps port the rest.
 *
 * The full `DataService` interface has ~200 members; enumerating throwing
 * stubs by hand for all of them is noise. The implemented tasks methods
 * live on a real class and a Proxy fills the rest with a throwing
 * fallback, asserted to `DataService` so consumers keep static typing.
 */

// Moved to supabaseServiceHelpers.ts; re-exported so existing importers
// (tests, host modules) keep one stable surface.
export { pgrstQuoteValue } from "./supabaseServiceHelpers";

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

class SupabaseNoteLinkService {
  private readonly client: SupabaseClient;

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

// Moved to SupabaseRoutinesService.ts; re-exported so existing importers
// (tests) keep one stable surface.
export { SupabaseRoutinesService } from "./SupabaseRoutinesService";

// Moved to SupabaseScheduleItemsService.ts; re-exported so existing importers
// (tests) keep one stable surface.
export { SupabaseScheduleItemsService } from "./SupabaseScheduleItemsService";

/*
 * Calendars domain (S4-2). VERSIONED but PHYSICAL-delete (0006 omits
 * is_deleted — the frontend never soft-deletes a calendar). 1:1 port of
 * the retired Tauri calendar_repository.rs (removed 2026-07-11, see tag
 * `pre-tauri-removal`).
 *
 * PARITY DIVERGENCE (documented, not silent): the Rust `update` accepted
 * the bind column too, but the S4-1 QA-passed `calendarUpdatesToPatch`
 * whitelist (the contract per the "frontend type is the SSOT" S2/S3
 * rule) only exposes title/order. The DataService interface's
 * `updateCalendar` signature also only accepts title/tagId/order;
 * tagId in `updates` is therefore accepted by the type but dropped
 * by the patch builder. This matches the mapper SSOT; a calendar is
 * rebound to a new life-tag by recreation in current UI flows. Flagged
 * for QA. (life-tags S2 / 0021: the bind column is now tag_id ->
 * wiki_tags(id), was folder_id -> items_meta(id).)
 */
class SupabaseCalendarsService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /** Tauri `fetch_all`: ORDER BY "order" ASC, created_at ASC. */
  async fetchCalendars(): Promise<CalendarNode[]> {
    const rows = await fetchAllPages<CalendarRow>(
      (from, to) =>
        this.client
          .from("calendars")
          .select(CALENDAR_SELECT_COLUMNS)
          .order("order", { ascending: true })
          .order("created_at", { ascending: true })
          .order("id")
          .range(from, to),
      "fetchCalendars failed",
    );
    return rows.map(rowToCalendar);
  }

  /**
   * Tauri `create`: `"order"` = next_order (MAX+1), version default 1.
   * `tagId` references wiki_tags(id) (the 0021 FK) — a calendar is a
   * life-tag-scoped view. `user_id` RLS-derived.
   */
  async createCalendar(
    id: string,
    title: string,
    tagId: string,
  ): Promise<CalendarNode> {
    const nextOrder = await this.nextOrder();
    const now = new Date().toISOString();
    const payload = {
      id,
      title,
      tag_id: tagId,
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
   * title/order; see class header re tagId divergence). Empty patch
   * = re-read NO version bump. Otherwise version + 1 (read-then-written)
   * + updated_at.
   */
  async updateCalendar(
    id: string,
    updates: Partial<Pick<CalendarNode, "title" | "tagId" | "order">>,
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

const PHASE2_CALENDAR_METHODS = new Set<string>([
  "fetchCalendars",
  "createCalendar",
  "updateCalendar",
  "deleteCalendar",
]);

/**
 * Create a Phase 2 Supabase-backed DataService.
 *
 * Implemented: the full tasks domain (9 methods) + the full daily domain
 * (12 methods) + the notes domain (S3: 14 note methods + 7 note-link
 * methods + 4 note-connection methods — full CRUD / hierarchy / search /
 * soft-delete / versioning / password gate, plus versioned note links and
 * the relation-table note connections), plus the routines, schedule and
 * calendar domains and the timer / audio settings. Methods on domains not
 * yet ported throw "not implemented in phase 2".
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
  // Unified services are constructed first because the legacy Daily /
  // Notes services bridge to them (DU-F follow-up — see the class
  // headers). Order: Unified → legacy bridge → other singletons.
  const wikiTagsUnifiedService = new SupabaseWikiTagsUnifiedService(client);
  const notesUnifiedService = new SupabaseNotesUnifiedService(client);
  const dailiesUnifiedService = new SupabaseDailiesUnifiedService(client);
  const tasksService = new SupabaseTasksService(client);
  const noteLinkService = new SupabaseNoteLinkService(client);
  const noteConnectionService = new SupabaseNoteConnectionService(client);
  const routinesService = new SupabaseRoutinesService(client);
  const scheduleItemsService = new SupabaseScheduleItemsService(client);
  const calendarsService = new SupabaseCalendarsService(client);
  // W3-A: independent timer / audio tables (0018). Not items_meta entities.
  const timerService = new SupabaseTimerService(client);
  const audioService = new SupabaseAudioService(client);

  // Dispatch table: method name -> the instance that implements it. The
  // Proxy's target is arbitrary (an empty object); routing is entirely
  // by this map so adding a domain is one entry, no target juggling.
  const route = (prop: string): object | null => {
    if (PHASE2_TASKS_METHODS.has(prop)) return tasksService;
    if (PHASE2_NOTE_LINK_METHODS.has(prop)) return noteLinkService;
    if (PHASE2_NOTE_CONNECTION_METHODS.has(prop)) return noteConnectionService;
    if (PHASE2_ROUTINES_METHODS.has(prop)) return routinesService;
    if (PHASE2_SCHEDULE_ITEM_METHODS.has(prop)) return scheduleItemsService;
    if (PHASE2_CALENDAR_METHODS.has(prop)) return calendarsService;
    if (PHASE2_WIKI_TAGS_UNIFIED_METHODS.has(prop))
      return wikiTagsUnifiedService;
    if (PHASE2_NOTES_UNIFIED_METHODS.has(prop)) return notesUnifiedService;
    if (PHASE2_DAILIES_UNIFIED_METHODS.has(prop)) return dailiesUnifiedService;
    if (PHASE2_TIMER_METHODS.has(prop)) return timerService;
    if (PHASE2_AUDIO_METHODS.has(prop)) return audioService;
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
// CalendarTag mappers removed in DU-F Step 3-5 (DB DROPped in DU-C+ 0012;
// shared layer purged in cohort with the UI death-code).
