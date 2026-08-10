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
import {
  SupabaseCalendarsService,
  PHASE2_CALENDAR_METHODS,
} from "./SupabaseCalendarsService";
import {
  SupabaseItemConversionService,
  PHASE2_ITEM_CONVERSION_METHODS,
} from "./SupabaseItemConversionService";
import {
  SupabaseNoteLinkService,
  SupabaseNoteConnectionService,
  PHASE2_NOTE_LINK_METHODS,
  PHASE2_NOTE_CONNECTION_METHODS,
} from "./SupabaseNoteLinksService";
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
  // #625: Event <-> Todo. Its own class rather than a method on either domain
  // service, because it writes BOTH payload tables plus items_meta — hanging
  // it off Tasks or Schedule would make one of them the silent owner of the
  // other's rows.
  const itemConversionService = new SupabaseItemConversionService(client);
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
