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
  SupabaseTodosService,
  PHASE2_TODOS_METHODS,
} from "./SupabaseTodosService";
import {
  SupabaseRoutinesService,
  PHASE2_ROUTINES_METHODS,
} from "./SupabaseRoutinesService";
import {
  SupabaseScheduleItemsService,
  PHASE2_SCHEDULE_ITEM_METHODS,
} from "./SupabaseScheduleItemsService";
import {
  SupabaseCalendarsService,
  PHASE2_CALENDAR_METHODS,
} from "./SupabaseCalendarsService";
import {
  SupabaseItemConversionService,
  PHASE2_ITEM_CONVERSION_METHODS,
} from "./SupabaseItemConversionService";
/*
 * Phase 2 S1 Supabase implementation.
 *
 * The `todos` domain is fully implemented (full-column round-trip against
 * the 0003_tasks_full_schema.sql shape: hierarchy / soft-delete /
 * scheduling / versioning). Pure mapping lives in `todoMapper.ts`; this
 * file is the I/O layer only. Every other domain is ported too (daily /
 * notes / wiki-tags / routines / schedule / calendars / timer / audio /
 * item conversion), so as of #671 C4 the "not implemented in
 * phase 2" thrower below is unreachable for any DataService member — it
 * only answers properties nothing declares.
 *
 * Each domain is a real class with an `implements` clause against its
 * slice of DataService, and a Proxy routes each property to the class that
 * owns it. The `as unknown as DataService` cast at the end is what makes
 * that cheap — and what nothing can check. `dataServiceRouting.ts` +
 * `shared/tests/dataServiceRouting.test.ts` are the guard that closes the
 * hole: interface, routing tuples and class methods now fail the build (or
 * the test) the moment they disagree.
 */

// Moved to supabaseServiceHelpers.ts; re-exported so existing importers
// (tests, host modules) keep one stable surface.
export { pgrstQuoteValue } from "./supabaseServiceHelpers";

// Moved to SupabaseRoutinesService.ts; re-exported so existing importers
// (tests) keep one stable surface.
export { SupabaseRoutinesService } from "./SupabaseRoutinesService";

// Moved to SupabaseScheduleItemsService.ts; re-exported so existing importers
// (tests) keep one stable surface.
export { SupabaseScheduleItemsService } from "./SupabaseScheduleItemsService";

// #625 Event <-> Todo conversion — same one-surface rule as the two above.
export {
  SupabaseItemConversionService,
  ItemConversionError,
} from "./SupabaseItemConversionService";

/**
 * Create a Phase 2 Supabase-backed DataService.
 *
 * Every domain is implemented. The roster is NOT repeated here — the SSOT is
 * `PHASE2_ROUTING_DOMAINS` in ./dataServiceRouting, one entry per domain with
 * its method-name list, and `DataServiceIsFullyRouted` in that same file is a
 * type-level assertion that the union of those lists is exactly `DataService`.
 * A count written here would drift silently, and did: this block claimed 9
 * todo / 12 daily / 14 note methods against actual sets of 10 / 14 / 16, and
 * kept advertising the 11 note-link + note-connection methods for months after
 * they went unused (deleted in #1156).
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
  const todosService = new SupabaseTodosService(client);
  const routinesService = new SupabaseRoutinesService(client);
  const scheduleItemsService = new SupabaseScheduleItemsService(client);
  const calendarsService = new SupabaseCalendarsService(client);
  // #625: Event <-> Todo. Its own class rather than a method on either domain
  // service, because it writes BOTH payload tables plus items_meta — hanging
  // it off Todos or Schedule would make one of them the silent owner of the
  // other's rows.
  const itemConversionService = new SupabaseItemConversionService(client);
  // W3-A: independent timer / audio tables (0018). Not items_meta entities.
  const timerService = new SupabaseTimerService(client);
  const audioService = new SupabaseAudioService(client);

  // Dispatch table: method name -> the instance that implements it. The
  // Proxy's target is arbitrary (an empty object); routing is entirely
  // by this map so adding a domain is one entry, no target juggling.
  const route = (prop: string): object | null => {
    if (PHASE2_TODOS_METHODS.has(prop)) return todosService;
    if (PHASE2_ROUTINES_METHODS.has(prop)) return routinesService;
    if (PHASE2_SCHEDULE_ITEM_METHODS.has(prop)) return scheduleItemsService;
    if (PHASE2_CALENDAR_METHODS.has(prop)) return calendarsService;
    if (PHASE2_ITEM_CONVERSION_METHODS.has(prop)) return itemConversionService;
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
// (rowToTodoNode / todoNodeToRow / todoUpdatesToPatch / TodoRow /
// TodoWriteRow) are gone — call sites must migrate to the new API.
export {
  rowsToTodoNode,
  todoNodeToRows,
  todoUpdatesToPatches,
  ITEMS_META_TASK_COLUMNS,
  TASKS_PAYLOAD_COLUMNS,
} from "./todoMapper";
export type {
  TasksPayloadRow,
  TasksPayloadWriteRow,
  TasksPayloadUpdatePatch,
} from "./todoMapper";
// The items_meta shape is role-independent and lives in its own module
// since #670 C3 PR 2 (it used to sit inside todoMapper).
export type {
  ItemsMetaRow,
  ItemsMetaInsertRow,
  ItemsMetaUpdatePatch,
} from "./itemsMeta";

// Schedule domain (S4-2) — mapper re-exports for round-trip / host use.
// Routine / ScheduleItem are 2-row domains: their single-row shims
// (rowToRoutine / routineToRow / routineUpdatesToPatch / RoutineRow /
// RoutineWriteRow and the ScheduleItem equivalents) were deleted in #670
// C3 PR 1 — the 2-row API is exported from the todoMapper block above and
// from the mapper modules directly. Only the frequency helpers, which the
// 2-row mapper still uses, remain here.
export { toFrequencyType, parseFrequencyDays } from "./routineMapper";
export {
  rowToCalendar,
  calendarToRow,
  calendarUpdatesToPatch,
} from "./calendarMapper";
export type { CalendarRow, CalendarWriteRow } from "./calendarMapper";
// CalendarTag mappers removed in DU-F Step 3-5 (DB DROPped in DU-C+ 0012;
// shared layer purged in cohort with the UI death-code).
