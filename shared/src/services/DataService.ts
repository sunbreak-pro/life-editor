import type { TodoNode } from "../types/todoTree";
import type {
  TimerSettings,
  TimerSession,
  SessionType,
  PomodoroPreset,
} from "../types/timer";
import type { SoundSettings } from "../types/sound";
import type { DailyNode } from "../types/daily";
import type { NoteNode } from "../types/note";

import type { TagGroupNode } from "../types/tagGroup";
import type { RoutineNode } from "../types/routine";
import type { ScheduleItem } from "../types/schedule";
import type { Playlist, PlaylistItem } from "../types/playlist";
import type {
  WikiTag as WikiTagUnified,
  WikiTagAssignment as WikiTagAssignmentUnified,
  WikiTagConnection as WikiTagConnectionUnified,
  WikiTagConnectionOrigin,
} from "../types/wikiTagUnified";

/*
 * DataService is split into one interface per routing domain (#671 C4 S5).
 *
 * The split is not cosmetic: each domain interface is the contract of
 * exactly ONE Supabase service class (SupabaseTodosService,
 * SupabaseTimerService, ...), so those classes can carry a real
 * `implements` clause instead of being typed only by the
 * `as unknown as DataService` cast in SupabaseDataService's Proxy.
 * `dataServiceRouting.ts` then pins each domain interface against the
 * matching `PHASE2_*_METHOD_NAMES` tuple, which makes the routing table a
 * compile-time-checked mirror of this file rather than 120 hand-written
 * strings nothing verifies.
 *
 * When adding a method: put it on the domain interface, add its name to
 * that domain's `PHASE2_*_METHOD_NAMES` tuple, and implement it on the
 * owning class. Missing any of the three is now a build error.
 */

// ---------------------------------------------------------------------------
// Todos — SupabaseTodosService
// ---------------------------------------------------------------------------

export interface TodosDataService {
  fetchTodoTree(): Promise<TodoNode[]>;
  /**
   * Live, unfinished todo count for the badge (#511) — a number, not a
   * list, so the read carries no row bodies. Meaning of the number:
   * materials/materialsCounts.ts.
   */
  countUnfinishedTodos(): Promise<number>;
  fetchDeletedTodos(): Promise<TodoNode[]>;
  createTodo(node: TodoNode): Promise<TodoNode>;
  updateTodo(id: string, updates: Partial<TodoNode>): Promise<TodoNode>;
  syncTodoTree(nodes: TodoNode[]): Promise<void>;
  softDeleteTodo(id: string): Promise<void>;
  restoreTodo(id: string): Promise<void>;
  permanentDeleteTodo(id: string): Promise<void>;
  migrateTodosToBackend(nodes: TodoNode[]): Promise<void>;
}

// ---------------------------------------------------------------------------
// Timer + Pomodoro presets — SupabaseTimerService
// ---------------------------------------------------------------------------

export interface TimerDataService {
  // Timer
  fetchTimerSettings(): Promise<TimerSettings>;
  updateTimerSettings(
    settings: Partial<
      Pick<
        TimerSettings,
        | "workDuration"
        | "breakDuration"
        | "longBreakDuration"
        | "sessionsBeforeLongBreak"
        | "autoStartBreaks"
        | "targetSessions"
      >
    >,
  ): Promise<TimerSettings>;
  startTimerSession(
    sessionType: SessionType,
    todoId?: string,
  ): Promise<TimerSession>;
  endTimerSession(
    id: number,
    duration: number,
    completed: boolean,
  ): Promise<TimerSession>;
  endTimerSessionWithLabel(
    id: number,
    duration: number,
    completed: boolean,
    label: string | null,
  ): Promise<TimerSession>;
  fetchTimerSessions(): Promise<TimerSession[]>;
  fetchSessionsByTodoId(todoId: string): Promise<TimerSession[]>;

  // Pomodoro Presets
  fetchPomodoroPresets(): Promise<PomodoroPreset[]>;
  createPomodoroPreset(
    preset: Omit<PomodoroPreset, "id" | "createdAt">,
  ): Promise<PomodoroPreset>;
  updatePomodoroPreset(
    id: number,
    updates: Partial<Omit<PomodoroPreset, "id" | "createdAt">>,
  ): Promise<PomodoroPreset>;
  deletePomodoroPreset(id: number): Promise<void>;
}

// ---------------------------------------------------------------------------
// Sound settings + playlists — SupabaseAudioService
// ---------------------------------------------------------------------------

export interface AudioDataService {
  // Sound
  fetchSoundSettings(): Promise<SoundSettings[]>;
  updateSoundSetting(
    soundType: string,
    volume: number,
    enabled: boolean,
  ): Promise<SoundSettings>;
  /**
   * Public URL of an audio asset in the `sounds` Storage bucket (W3-C).
   * Pure URL construction — no network round-trip; an un-uploaded object
   * simply yields a URL that 404s on play.
   */
  getSoundAssetUrl(objectName: string): Promise<string>;

  // Playlists
  fetchPlaylists(): Promise<Playlist[]>;
  createPlaylist(id: string, name: string): Promise<Playlist>;
  updatePlaylist(
    id: string,
    updates: Partial<
      Pick<Playlist, "name" | "sortOrder" | "repeatMode" | "isShuffle">
    >,
  ): Promise<Playlist>;
  deletePlaylist(id: string): Promise<void>;
  fetchPlaylistItems(playlistId: string): Promise<PlaylistItem[]>;
  fetchAllPlaylistItems(): Promise<PlaylistItem[]>;
  addPlaylistItem(
    id: string,
    playlistId: string,
    soundId: string,
  ): Promise<PlaylistItem>;
  removePlaylistItem(itemId: string): Promise<void>;
  reorderPlaylistItems(playlistId: string, itemIds: string[]): Promise<void>;
}

// ---------------------------------------------------------------------------
// Tag groups — SupabaseTagGroupsService
// ---------------------------------------------------------------------------

/*
 * #1173 replaced the `calendars` domain with this one. A calendar was a saved
 * view over ONE tag; a group is the same saved view over MANY, so the four
 * methods line up one-for-one and the routing table simply swapped services.
 * The `calendars` TABLE outlived its code because DDL is the user's gate
 * (CLAUDE.md §7.3); migration 0026 drops it (#1277).
 */
export interface TagGroupsDataService {
  fetchTagGroups(): Promise<TagGroupNode[]>;
  createTagGroup(
    id: string,
    name: string,
    tagIds: readonly string[],
  ): Promise<TagGroupNode>;
  updateTagGroup(
    id: string,
    updates: { name?: string; tagIds?: readonly string[] },
  ): Promise<TagGroupNode>;
  deleteTagGroup(id: string): Promise<void>;
}

// Calendar Tags domain removed in DU-F Step 3-5 (DB DROPped in DU-C+
// 0012; replaced by WikiTags Unified for the 5-role tag/link graph).

// ---------------------------------------------------------------------------
// Routines — SupabaseRoutinesService
// ---------------------------------------------------------------------------

export interface RoutinesDataService {
  fetchAllRoutines(): Promise<RoutineNode[]>;
  createRoutine(
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
  ): Promise<RoutineNode>;
  updateRoutine(
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
  ): Promise<RoutineNode>;
  deleteRoutine(id: string): Promise<void>;
  fetchDeletedRoutines(): Promise<RoutineNode[]>;
  softDeleteRoutine(id: string): Promise<{ deletedScheduleItemIds: string[] }>;
  /**
   * "Turn the repeat off" (#185): soft-delete every future, incomplete,
   * still-live occurrence of the routine, then soft-delete the routine
   * itself WITHOUT cascading to its past occurrences (completed or not) —
   * those stay as the user's life record. Unlike softDeleteRoutine (which
   * trashes ALL live occurrences), this is the calendar-app "delete this and
   * following events" semantics. `today` defaults to the day-start-hour-aware
   * todayDateKey(); callers/tests may pass an explicit key for determinism.
   * Returns the soft-deleted occurrence ids so the UI can reconcile in-memory.
   *
   * `opts.keepItemIds` (#296): occurrence ids that must SURVIVE as detached
   * one-offs even when they fall in the future/incomplete delete partition.
   * The repeat-off editor passes the occurrence the user is looking at —
   * deleting the very item they are editing reads as data loss.
   */
  detachRoutine(
    id: string,
    today?: string,
    opts?: { keepItemIds?: string[] },
  ): Promise<{ deletedScheduleItemIds: string[] }>;
  /**
   * Event→Repeats conversion (#185 / #296): create the routine, then attach
   * the EXISTING seed event to it (events_payload.routine_item_id +
   * source_date = the seed's own day) as its first materialised occurrence.
   * The seed row is never deleted — its id, memo, completion state and
   * selection survive the conversion. Writes are sequenced (routine INSERT
   * settles before the attach UPDATE) so the attach cannot lose the 0011
   * composite-FK race; if the attach fails the just-created routine is
   * rolled back and the seed is left untouched (the conversion simply did
   * not happen — nothing is lost).
   *
   * #407: the attach is CONDITIONAL on the seed still being unattached
   * (routine_item_id IS NULL). A conversion that loses that race — the
   * seed already belongs to another routine — rolls its routine back and
   * REJECTS, so a double conversion can never strand a live, unreferenced
   * twin routine (which would keep generating occurrences forever).
   */
  convertEventToRoutine(
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
      /** The seed event's date key — becomes events_payload.source_date so
       *  the (routine, source_date) partial UNIQUE treats the converted seed
       *  as that day's occurrence. */
      sourceDate: string;
    },
  ): Promise<RoutineNode>;
  restoreRoutine(id: string): Promise<void>;
  permanentDeleteRoutine(id: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Schedule items — SupabaseScheduleItemsService
// ---------------------------------------------------------------------------

/**
 * Outcome of a restore that is allowed to come back partially (#932).
 *
 * Every requested id lands in exactly one of the two lists, so a caller can
 * repaint from `restoredIds` and say something about `conflictedIds` without
 * a second read.
 */
export interface ScheduleRestoreResult {
  /** Rows now live again. */
  restoredIds: string[];
  /**
   * Rows deliberately left in the trash: a live row already holds their
   * (routine_item_id, source_date) pair, so bringing them back would break
   * the Issue-011 partial UNIQUE. The day they belong to already has an
   * occurrence — this is a refusal, not a failure.
   */
  conflictedIds: string[];
}

export interface ScheduleItemsDataService {
  fetchScheduleItemsByDate(date: string): Promise<ScheduleItem[]>;
  fetchScheduleItemsByDateAll(date: string): Promise<ScheduleItem[]>;
  fetchScheduleItemsByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ScheduleItem[]>;
  createScheduleItem(
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
  ): Promise<ScheduleItem>;
  updateScheduleItem(
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
  ): Promise<ScheduleItem>;
  deleteScheduleItem(id: string): Promise<void>;
  softDeleteScheduleItem(id: string): Promise<void>;
  restoreScheduleItem(id: string): Promise<void>;
  permanentDeleteScheduleItem(id: string): Promise<void>;
  fetchDeletedScheduleItems(): Promise<ScheduleItem[]>;
  toggleScheduleItemComplete(id: string): Promise<ScheduleItem>;
  dismissScheduleItem(id: string): Promise<void>;
  undismissScheduleItem(id: string): Promise<void>;
  bulkCreateScheduleItems(
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
  ): Promise<void>;
  /**
   * Series edit propagation (#279 scope dialog "今後" / "すべて"). Patches the
   * routine's materialised occurrences with start_at >= fromDate, honouring
   * the tier-1 §Schedule conflict rules: done / dismissed occurrences are
   * never touched, and when `template` (the routine's PRE-edit title/times)
   * is supplied, occurrences deviating from it (= manually edited) are
   * skipped — manual edits win over series edits. Returns patched count.
   */
  updateFutureScheduleItemsByRoutine(
    routineId: string,
    updates: { title?: string; startTime?: string; endTime?: string },
    fromDate: string,
    template?: {
      title: string;
      startTime: string | null;
      endTime: string | null;
    },
  ): Promise<number>;
  fetchScheduleItemsByRoutineId(routineId: string): Promise<ScheduleItem[]>;
  bulkDeleteScheduleItems(ids: string[]): Promise<number>;
  /**
   * Bulk soft-delete (items_meta.is_deleted = true — Trash-recoverable).
   * The generator's frequency-mismatch cleanup uses THIS, not the hard
   * bulkDeleteScheduleItems: auto-cleanup destroying rows beyond recovery
   * was #296's worst data-loss path.
   */
  bulkSoftDeleteScheduleItems(ids: string[]): Promise<number>;
  /**
   * Inverse of bulkSoftDeleteScheduleItems. Undoing a routine deletion has to
   * bring back the exact rows softDeleteRoutine trashed — occurrences AND the
   * seed event the user made by hand (#708) — and one restore call per row is
   * a round trip per occurrence for a routine that has been running for
   * months. Chunked like its inverse, for the same reason.
   *
   * Partial by design (#932): an occurrence whose (routine, date) pair has
   * been re-taken by a live row stays in the trash and comes back in
   * `conflictedIds` — the alternative is the whole batch failing on one
   * collision, which is what used to happen and what left the seed event
   * trashed too.
   */
  bulkRestoreScheduleItems(ids: string[]): Promise<ScheduleRestoreResult>;
  fetchEvents(): Promise<ScheduleItem[]>;
}

// ---------------------------------------------------------------------------
// Event <-> Todo conversion (#625) — SupabaseItemConversionService
// ---------------------------------------------------------------------------

export interface ItemConversionDataService {
  /**
   * Turn an event into a Todo, KEEPING its id (D-20260810-sched-2 = 案 A):
   * tags and item links reference `items_meta.id` with no role of their own,
   * so re-roling the same row carries the whole graph across, where a
   * delete+create would drop every one of them.
   *
   * Three writes in a fixed order — new payload UPSERT, `items_meta.role`
   * UPDATE (+ DB-Q2 bump), old payload DELETE. There is no transaction, so the
   * order is chosen by what the surviving middle state looks like: an item
   * briefly holding two payload rows is invisible (every read filters by role
   * and joins its own payload), while the reverse order can leave a payload-
   * less meta — the R2 orphan db-conventions §10 forbids, which owns the id
   * and shows the user nothing.
   *
   * Date / time span / all-day / reminder are dropped (D-20260810-sched-3 —
   * the host confirms that first); the memo survives as the todo body and a
   * done event becomes a DONE Todo. A routine-derived event is REJECTED
   * (D-20260810-sched-5): a Todo cannot carry a repeat. `order` is the host's,
   * so the new row lands like a freshly added todo.
   */
  convertEventToTodo(
    eventId: string,
    init: { order: number },
  ): Promise<TodoNode>;
  /**
   * Turn a Todo into an event, keeping its id — the mirror of
   * convertEventToTodo, same ordering and same compensation.
   *
   * The status is dropped (D-20260810-sched-4 — the host confirms first),
   * except that a DONE Todo arrives completed rather than open; the todo body
   * survives as the event memo, and a child Todo loses its parent link (events
   * have no hierarchy). A Todo WITH CHILDREN is REJECTED (same ruling): 0009's
   * composite FK would reject the role UPDATE anyway, and the service checks
   * first so the caller gets a reason instead of an FK error mid-sequence —
   * soft-deleted children count, since they hold the FK just the same. The
   * placement is the host's (`todoToEventPlacement`).
   */
  convertTodoToEvent(
    todoId: string,
    init: {
      date: string;
      startTime: string;
      endTime: string;
      isAllDay: boolean;
    },
  ): Promise<ScheduleItem>;
}

// ---------------------------------------------------------------------------
// Wiki Tags Unified (DU-C+ — items_meta-based tag/link, 5 roles)
// — SupabaseWikiTagsUnifiedService
//
// The legacy polymorphic Wiki Tags API (fetchWikiTags /
// setWikiTagsForEntity) was declared here but never routed and never
// called from any of the four trees; #671 C4 S1 deleted the two dead
// declarations rather than wiring throwing stubs for them.
// ---------------------------------------------------------------------------

export interface WikiTagsUnifiedDataService {
  listAllWikiTagsUnified(): Promise<WikiTagUnified[]>;
  createWikiTagUnified(
    id: string,
    name: string,
    color: string | null,
  ): Promise<WikiTagUnified>;
  updateWikiTagUnified(
    id: string,
    updates: Partial<WikiTagUnified>,
  ): Promise<WikiTagUnified>;
  softDeleteWikiTagUnified(id: string): Promise<void>;
  listTagsForItem(itemId: string): Promise<WikiTagAssignmentUnified[]>;
  /** Bulk-load all active item↔tag assignments (N+1 elimination). */
  listAllTagAssignments(): Promise<WikiTagAssignmentUnified[]>;
  assignTagToItem(
    assignmentId: string,
    itemId: string,
    tagId: string,
  ): Promise<WikiTagAssignmentUnified>;
  unassignTagFromItem(assignmentId: string): Promise<void>;
  listLinksFromItem(itemId: string): Promise<WikiTagConnectionUnified[]>;
  listLinksToItem(itemId: string): Promise<WikiTagConnectionUnified[]>;
  /** Bulk-load all active item↔item links (N+1 elimination). */
  listAllTagConnections(): Promise<WikiTagConnectionUnified[]>;
  createItemLink(
    linkId: string,
    fromItemId: string,
    toItemId: string,
    /** Defaults to "manual". "inline" marks the edge for delete-sync (#372). */
    origin?: WikiTagConnectionOrigin,
  ): Promise<WikiTagConnectionUnified>;
  deleteItemLink(linkId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Notes Unified (DU-D — items_meta + notes_payload 2-row pattern)
// — SupabaseNotesUnifiedService
//
// DU-G PR1 added the remaining UX-critical methods (trash / restore /
// hard-delete / search / password gate / edit lock) so the legacy bridge
// could finally drop its `_pendingDuRewrite` stubs; the legacy
// single-table Notes block itself was retired in DU-G G4.
// ---------------------------------------------------------------------------

export interface NotesUnifiedDataService {
  listNotesUnified(): Promise<NoteNode[]>;
  /**
   * The note TEMPLATES (#1047) — `notes_payload.note_type = 'template'`.
   *
   * Its own read because it is the ONLY one that returns those rows: a template
   * is excluded from `listNotesUnified`, `searchNotesUnified`, `countLiveNotes`
   * and `fetchDeletedNotesUnified`, so NotesUnifiedContext never holds one and
   * the template panel has to ask for them directly. Everything else about a
   * template goes through the ordinary note methods (create / update / soft
   * delete / get), because on the DB side that is exactly what it is.
   */
  listNoteTemplatesUnified(): Promise<NoteNode[]>;
  /** Live note count for the badge (#511) — see countUnfinishedTodos. */
  countLiveNotes(): Promise<number>;
  getNoteUnified(id: string): Promise<NoteNode | null>;
  createNoteUnified(node: NoteNode): Promise<NoteNode>;
  updateNoteUnified(id: string, updates: Partial<NoteNode>): Promise<NoteNode>;
  softDeleteNoteUnified(id: string): Promise<void>;
  moveNoteUnified(
    id: string,
    parentId: string | null,
    order: number,
  ): Promise<void>;
  fetchDeletedNotesUnified(): Promise<NoteNode[]>;
  restoreNoteUnified(id: string): Promise<void>;
  permanentDeleteNoteUnified(id: string): Promise<void>;
  searchNotesUnified(query: string): Promise<NoteNode[]>;
  setNotePasswordUnified(id: string, password: string): Promise<NoteNode>;
  removeNotePasswordUnified(
    id: string,
    currentPassword: string,
  ): Promise<NoteNode>;
  verifyNotePasswordUnified(id: string, password: string): Promise<boolean>;
  toggleNoteEditLockUnified(id: string): Promise<NoteNode>;
}

// ---------------------------------------------------------------------------
// Dailies Unified (DU-D — items_meta + dailies_payload 2-row pattern)
// — SupabaseDailiesUnifiedService
//
// upsertDailyByDateUnified is the primary write path (date is UNIQUE).
// The legacy Daily method signatures were removed in DU-G G4.
// ---------------------------------------------------------------------------

export interface DailiesUnifiedDataService {
  listDailiesUnified(): Promise<DailyNode[]>;
  /** Live daily count for the badge (#511) — see countUnfinishedTodos. */
  countLiveDailies(): Promise<number>;
  getDailyByDateUnified(date: string): Promise<DailyNode | null>;
  upsertDailyByDateUnified(date: string, content: string): Promise<DailyNode>;
  createDailyUnified(node: DailyNode): Promise<DailyNode>;
  updateDailyUnified(
    id: string,
    updates: Partial<DailyNode>,
  ): Promise<DailyNode>;
  softDeleteDailyUnified(id: string): Promise<void>;
  // DU-G G2 additions (Trash / password / lock; id-keyed).
  fetchDeletedDailiesUnified(): Promise<DailyNode[]>;
  restoreDailyUnified(id: string): Promise<void>;
  permanentDeleteDailyUnified(id: string): Promise<void>;
  setDailyPasswordUnified(id: string, password: string): Promise<DailyNode>;
  removeDailyPasswordUnified(
    id: string,
    currentPassword: string,
  ): Promise<DailyNode>;
  verifyDailyPasswordUnified(id: string, password: string): Promise<boolean>;
  toggleDailyEditLockUnified(id: string): Promise<DailyNode>;
}

/**
 * The whole data surface the frontend may reach (CLAUDE.md §3.1).
 *
 * Purely the union of the domain interfaces above — it declares no member
 * of its own, so "a method exists on DataService" and "a method belongs to
 * exactly one routed domain" are the same statement.
 */
export interface DataService
  extends
    TodosDataService,
    TimerDataService,
    AudioDataService,
    TagGroupsDataService,
    RoutinesDataService,
    ScheduleItemsDataService,
    ItemConversionDataService,
    WikiTagsUnifiedDataService,
    NotesUnifiedDataService,
    DailiesUnifiedDataService {}
