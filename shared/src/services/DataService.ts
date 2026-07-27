import type { TaskNode } from "../types/taskTree";
import type {
  TimerSettings,
  TimerSession,
  SessionType,
  PomodoroPreset,
} from "../types/timer";
import type { SoundSettings } from "../types/sound";
import type { DailyNode } from "../types/daily";
import type { NoteNode } from "../types/note";

import type { CalendarNode } from "../types/calendar";
import type { RoutineNode } from "../types/routine";
import type { ScheduleItem } from "../types/schedule";
import type { Playlist, PlaylistItem } from "../types/playlist";
import type { WikiTag, NoteConnection } from "../types/wikiTag";
import type {
  WikiTag as WikiTagUnified,
  WikiTagAssignment as WikiTagAssignmentUnified,
  WikiTagConnection as WikiTagConnectionUnified,
} from "../types/wikiTagUnified";
import type {
  NoteLink,
  NoteLinkPayload,
  BacklinkHit,
  UnlinkedMention,
} from "../types/noteLink";

/**
 * Kinds of calendar-displayed data the user can bulk soft-delete from
 * Settings → Data → "Calendar データ一括削除".
 *
 * - "tasks":    scheduled tasks (type='task' AND scheduled_at IS NOT NULL)
 * - "events":   schedule_items with no routine_id (manual events)
 * - "routines": routines + their non-completed derived schedule_items (cascade)
 * - "dailies":  dailies rows
 * - "notes":    notes rows
 */
export type CalendarDataKind =
  "tasks" | "events" | "routines" | "dailies" | "notes";

export interface BulkSoftDeleteResult {
  tasks: number;
  events: number;
  routines: number;
  /** Routine-derived schedule_items removed by the routine cascade. */
  cascadedScheduleItems: number;
  dailies: number;
  notes: number;
}

export interface DataService {
  // Tasks
  fetchTaskTree(): Promise<TaskNode[]>;
  fetchDeletedTasks(): Promise<TaskNode[]>;
  createTask(node: TaskNode): Promise<TaskNode>;
  updateTask(id: string, updates: Partial<TaskNode>): Promise<TaskNode>;
  syncTaskTree(nodes: TaskNode[]): Promise<void>;
  softDeleteTask(id: string): Promise<void>;
  restoreTask(id: string): Promise<void>;
  permanentDeleteTask(id: string): Promise<void>;
  migrateTasksToBackend(nodes: TaskNode[]): Promise<void>;

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
    taskId?: string,
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
  fetchSessionsByTaskId(taskId: string): Promise<TimerSession[]>;

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

  // Daily / Notes legacy method signatures were removed in DU-G G4.
  // The Daily + Notes write paths now go through the *Unified blocks below
  // (items_meta + dailies_payload / notes_payload 2-row pattern); the
  // legacy Bridge that mapped legacy → Unified names has been retired.

  // Calendars
  fetchCalendars(): Promise<CalendarNode[]>;
  createCalendar(
    id: string,
    title: string,
    tagId: string,
  ): Promise<CalendarNode>;
  updateCalendar(
    id: string,
    updates: Partial<Pick<CalendarNode, "title" | "tagId" | "order">>,
  ): Promise<CalendarNode>;
  deleteCalendar(id: string): Promise<void>;

  // Calendar Tags domain removed in DU-F Step 3-5 (DB DROPped in DU-C+
  // 0012; replaced by WikiTags Unified for the 5-role tag/link graph).

  // Routines
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

  // Schedule Items
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
  fetchEvents(): Promise<ScheduleItem[]>;

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

  // Wiki Tags
  fetchWikiTags(): Promise<WikiTag[]>;
  setWikiTagsForEntity(
    entityId: string,
    entityType: string,
    tagIds: string[],
  ): Promise<void>;

  // Wiki Tags Unified (DU-C+ — items_meta-based tag/link, 5 roles)
  // Coexists with the legacy polymorphic API above (currently throws
  // "not implemented in phase 2"); DU-F deletes the legacy block.
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
  ): Promise<WikiTagConnectionUnified>;
  deleteItemLink(linkId: string): Promise<void>;

  // Notes Unified (DU-D — items_meta + notes_payload 2-row pattern).
  // Coexists with the legacy single-table Notes block above; DU-F retires
  // the legacy block once frontend↔shared integration lands. DU-G PR1 adds
  // the remaining UX-critical methods (trash / restore / hard-delete /
  // search / password gate / edit lock) so the legacy bridge can finally
  // drop its `_pendingDuRewrite` stubs.
  listNotesUnified(): Promise<NoteNode[]>;
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

  // Dailies Unified (DU-D — items_meta + dailies_payload 2-row pattern).
  // upsertDailyByDateUnified is the primary write path (date is UNIQUE).
  listDailiesUnified(): Promise<DailyNode[]>;
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

  // Note Connections
  fetchNoteConnections(): Promise<NoteConnection[]>;
  createNoteConnection(
    sourceNoteId: string,
    targetNoteId: string,
  ): Promise<NoteConnection>;
  deleteNoteConnection(id: string): Promise<void>;
  deleteNoteConnectionByPair(
    sourceNoteId: string,
    targetNoteId: string,
  ): Promise<void>;

  // Note Links (Obsidian-style [[...]] syntax)
  fetchAllNoteLinks(): Promise<NoteLink[]>;
  fetchForwardLinksForNote(sourceNoteId: string): Promise<NoteLink[]>;
  fetchBacklinksForNote(targetNoteId: string): Promise<BacklinkHit[]>;
  upsertNoteLinksForNote(
    sourceNoteId: string,
    links: NoteLinkPayload[],
  ): Promise<void>;
  upsertNoteLinksForDaily(
    sourceDailyDate: string,
    links: NoteLinkPayload[],
  ): Promise<void>;
  deleteNoteLinksForNote(sourceNoteId: string): Promise<void>;
  fetchUnlinkedMentions(sourceNoteId: string): Promise<UnlinkedMention[]>;

  // Shell
  openExternal(url: string): Promise<void>;

  // System Integration
  getAutoLaunch(): Promise<boolean>;
  setAutoLaunch(enabled: boolean): Promise<void>;
}
