import type {
  AudioDataService,
  CalendarsDataService,
  DailiesUnifiedDataService,
  DataService,
  ItemConversionDataService,
  NoteConnectionsDataService,
  NoteLinksDataService,
  NotesUnifiedDataService,
  RoutinesDataService,
  ScheduleItemsDataService,
  TodosDataService,
  TimerDataService,
  WikiTagsUnifiedDataService,
} from "./DataService";
import {
  SupabaseAudioService,
  PHASE2_AUDIO_METHOD_NAMES,
  PHASE2_AUDIO_METHODS,
  type AudioMethodName,
} from "./SupabaseAudioService";
import {
  SupabaseCalendarsService,
  PHASE2_CALENDAR_METHOD_NAMES,
  PHASE2_CALENDAR_METHODS,
  type CalendarMethodName,
} from "./SupabaseCalendarsService";
import {
  SupabaseDailiesUnifiedService,
  PHASE2_DAILIES_UNIFIED_METHOD_NAMES,
  PHASE2_DAILIES_UNIFIED_METHODS,
  type DailiesUnifiedMethodName,
} from "./SupabaseDailiesUnifiedService";
import {
  SupabaseItemConversionService,
  PHASE2_ITEM_CONVERSION_METHOD_NAMES,
  PHASE2_ITEM_CONVERSION_METHODS,
  type ItemConversionMethodName,
} from "./SupabaseItemConversionService";
import {
  SupabaseNoteConnectionService,
  SupabaseNoteLinkService,
  PHASE2_NOTE_CONNECTION_METHOD_NAMES,
  PHASE2_NOTE_CONNECTION_METHODS,
  PHASE2_NOTE_LINK_METHOD_NAMES,
  PHASE2_NOTE_LINK_METHODS,
  type NoteConnectionMethodName,
  type NoteLinkMethodName,
} from "./SupabaseNoteLinksService";
import {
  SupabaseNotesUnifiedService,
  PHASE2_NOTES_UNIFIED_METHOD_NAMES,
  PHASE2_NOTES_UNIFIED_METHODS,
  type NotesUnifiedMethodName,
} from "./SupabaseNotesUnifiedService";
import {
  SupabaseRoutinesService,
  PHASE2_ROUTINES_METHOD_NAMES,
  PHASE2_ROUTINES_METHODS,
  type RoutinesMethodName,
} from "./SupabaseRoutinesService";
import {
  SupabaseScheduleItemsService,
  PHASE2_SCHEDULE_ITEM_METHOD_NAMES,
  PHASE2_SCHEDULE_ITEM_METHODS,
  type ScheduleItemMethodName,
} from "./SupabaseScheduleItemsService";
import {
  SupabaseTodosService,
  PHASE2_TODOS_METHOD_NAMES,
  PHASE2_TODOS_METHODS,
  type TodosMethodName,
} from "./SupabaseTodosService";
import {
  SupabaseTimerService,
  PHASE2_TIMER_METHOD_NAMES,
  PHASE2_TIMER_METHODS,
  type TimerMethodName,
} from "./SupabaseTimerService";
import {
  SupabaseWikiTagsUnifiedService,
  PHASE2_WIKI_TAGS_UNIFIED_METHOD_NAMES,
  PHASE2_WIKI_TAGS_UNIFIED_METHODS,
  type WikiTagsUnifiedMethodName,
} from "./SupabaseWikiTagsUnifiedService";

/*
 * Lockstep guard for the DataService routing table (#671 C4 S3).
 *
 * `createSupabaseDataService()` returns a Proxy asserted with
 * `as unknown as DataService`, so the only thing tying the interface to the
 * dispatch table is ~120 hand-written strings in the `PHASE2_*_METHOD_NAMES`
 * tuples. This module makes that tie a compile error instead of a runtime
 * surprise: each domain interface is compared BOTH WAYS against its tuple,
 * so a method declared and never routed (it would throw "not implemented in
 * phase 2" the first time a user hits it) and a routed name that no longer
 * exists on the interface (a dead string nothing can reach) each fail
 * `cd shared && npm run build`.
 *
 * This lives in `src`, NOT in `tests`, on purpose: `shared/tsconfig.json`
 * only includes `src`, so a type-level assertion parked in `shared/tests`
 * is never type-checked by the build and silently guards nothing. The
 * runtime half of the guard — duplicates across domains, every name really
 * resolving on its owner class, the Proxy's fallback — is what
 * `shared/tests/dataServiceRouting.test.ts` covers.
 */

/**
 * Compiles only when `T` is the empty union. A non-empty `T` fails with
 * "Type '\"someMethod\"' does not satisfy the constraint 'never'", which
 * names the offending method at the line of the failing domain.
 */
type AssertNever<T extends never> = T;

/**
 * Every member of `Iface` missing from `Names`, plus every member of
 * `Names` missing from `Iface`. Empty exactly when the two agree.
 */
type Mismatch<Iface, Names extends string> =
  Exclude<keyof Iface & string, Names> | Exclude<Names, keyof Iface & string>;

// One assertion per routed domain. Each name is exported so the failure
// surfaces at a named declaration rather than inside an unused local.
export type TasksRoutingIsExact = AssertNever<
  Mismatch<TodosDataService, TodosMethodName>
>;
export type TimerRoutingIsExact = AssertNever<
  Mismatch<TimerDataService, TimerMethodName>
>;
export type AudioRoutingIsExact = AssertNever<
  Mismatch<AudioDataService, AudioMethodName>
>;
export type CalendarsRoutingIsExact = AssertNever<
  Mismatch<CalendarsDataService, CalendarMethodName>
>;
export type RoutinesRoutingIsExact = AssertNever<
  Mismatch<RoutinesDataService, RoutinesMethodName>
>;
export type ScheduleItemsRoutingIsExact = AssertNever<
  Mismatch<ScheduleItemsDataService, ScheduleItemMethodName>
>;
export type ItemConversionRoutingIsExact = AssertNever<
  Mismatch<ItemConversionDataService, ItemConversionMethodName>
>;
export type WikiTagsUnifiedRoutingIsExact = AssertNever<
  Mismatch<WikiTagsUnifiedDataService, WikiTagsUnifiedMethodName>
>;
export type NotesUnifiedRoutingIsExact = AssertNever<
  Mismatch<NotesUnifiedDataService, NotesUnifiedMethodName>
>;
export type DailiesUnifiedRoutingIsExact = AssertNever<
  Mismatch<DailiesUnifiedDataService, DailiesUnifiedMethodName>
>;
export type NoteConnectionsRoutingIsExact = AssertNever<
  Mismatch<NoteConnectionsDataService, NoteConnectionMethodName>
>;
export type NoteLinksRoutingIsExact = AssertNever<
  Mismatch<NoteLinksDataService, NoteLinkMethodName>
>;

/** Every method name the Proxy can route, across all domains. */
export type RoutedMethodName =
  | TodosMethodName
  | TimerMethodName
  | AudioMethodName
  | CalendarMethodName
  | RoutinesMethodName
  | ScheduleItemMethodName
  | ItemConversionMethodName
  | WikiTagsUnifiedMethodName
  | NotesUnifiedMethodName
  | DailiesUnifiedMethodName
  | NoteConnectionMethodName
  | NoteLinkMethodName;

/**
 * Catches the case the per-domain assertions cannot see: a member declared
 * straight on `DataService` (rather than on one of the domain interfaces it
 * extends), which would belong to no domain and therefore route nowhere.
 */
export type DataServiceIsFullyRouted = AssertNever<
  Mismatch<DataService, RoutedMethodName>
>;

/**
 * The routing table as data, for the runtime half of the guard.
 *
 * `SupabaseDataService.route()` keeps its explicit if-chain (it needs
 * instances, not constructors); this registry is what the test walks to
 * prove that chain covers every name exactly once and that each name is a
 * real method on the class that claims it.
 */
export const PHASE2_ROUTING_DOMAINS = [
  {
    domain: "tasks",
    names: PHASE2_TODOS_METHOD_NAMES,
    methods: PHASE2_TODOS_METHODS,
    service: SupabaseTodosService,
  },
  {
    domain: "timer",
    names: PHASE2_TIMER_METHOD_NAMES,
    methods: PHASE2_TIMER_METHODS,
    service: SupabaseTimerService,
  },
  {
    domain: "audio",
    names: PHASE2_AUDIO_METHOD_NAMES,
    methods: PHASE2_AUDIO_METHODS,
    service: SupabaseAudioService,
  },
  {
    domain: "calendars",
    names: PHASE2_CALENDAR_METHOD_NAMES,
    methods: PHASE2_CALENDAR_METHODS,
    service: SupabaseCalendarsService,
  },
  {
    domain: "routines",
    names: PHASE2_ROUTINES_METHOD_NAMES,
    methods: PHASE2_ROUTINES_METHODS,
    service: SupabaseRoutinesService,
  },
  {
    domain: "scheduleItems",
    names: PHASE2_SCHEDULE_ITEM_METHOD_NAMES,
    methods: PHASE2_SCHEDULE_ITEM_METHODS,
    service: SupabaseScheduleItemsService,
  },
  {
    domain: "itemConversion",
    names: PHASE2_ITEM_CONVERSION_METHOD_NAMES,
    methods: PHASE2_ITEM_CONVERSION_METHODS,
    service: SupabaseItemConversionService,
  },
  {
    domain: "wikiTagsUnified",
    names: PHASE2_WIKI_TAGS_UNIFIED_METHOD_NAMES,
    methods: PHASE2_WIKI_TAGS_UNIFIED_METHODS,
    service: SupabaseWikiTagsUnifiedService,
  },
  {
    domain: "notesUnified",
    names: PHASE2_NOTES_UNIFIED_METHOD_NAMES,
    methods: PHASE2_NOTES_UNIFIED_METHODS,
    service: SupabaseNotesUnifiedService,
  },
  {
    domain: "dailiesUnified",
    names: PHASE2_DAILIES_UNIFIED_METHOD_NAMES,
    methods: PHASE2_DAILIES_UNIFIED_METHODS,
    service: SupabaseDailiesUnifiedService,
  },
  {
    domain: "noteConnections",
    names: PHASE2_NOTE_CONNECTION_METHOD_NAMES,
    methods: PHASE2_NOTE_CONNECTION_METHODS,
    service: SupabaseNoteConnectionService,
  },
  {
    domain: "noteLinks",
    names: PHASE2_NOTE_LINK_METHOD_NAMES,
    methods: PHASE2_NOTE_LINK_METHODS,
    service: SupabaseNoteLinkService,
  },
] as const satisfies ReadonlyArray<{
  domain: string;
  names: readonly RoutedMethodName[];
  methods: ReadonlySet<string>;
  service: new (...args: never[]) => object;
}>;

/** Flat list of every routed method name (duplicates would show up here). */
export const ROUTED_METHOD_NAMES: readonly RoutedMethodName[] =
  PHASE2_ROUTING_DOMAINS.flatMap((d) => [...d.names]);
