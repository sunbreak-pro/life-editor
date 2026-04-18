import type { DataService } from "./DataService";
import type { TaskNode } from "../types/taskTree";
import type {
  TimerSettings,
  TimerSession,
  SessionType,
  PomodoroPreset,
} from "../types/timer";
import type {
  SoundSettings,
  SoundPreset,
  SoundTag,
  SoundDisplayMeta,
} from "../types/sound";
import type { MemoNode } from "../types/memo";
import type { CustomSoundMeta } from "../types/customSound";
import type { NoteNode } from "../types/note";

import type { CalendarNode } from "../types/calendar";
import type { RoutineNode } from "../types/routine";
import type { RoutineTag } from "../types/routineTag";
import type { CalendarTag } from "../types/calendarTag";
import type { ScheduleItem } from "../types/schedule";
import type { RoutineGroup } from "../types/routineGroup";
import type { Playlist, PlaylistItem } from "../types/playlist";
import type {
  LogEntry,
  IpcChannelMetrics,
  SystemInfo,
} from "../types/diagnostics";
import type {
  WikiTag,
  WikiTagAssignment,
  WikiTagConnection,
  WikiTagGroup,
  WikiTagGroupMember,
  NoteConnection,
} from "../types/wikiTag";
import type { TimeMemo } from "../types/timeMemo";
import type { PaperBoard, PaperNode, PaperEdge } from "../types/paperBoard";
import type { AttachmentMeta } from "../types/attachment";
import type { FileEntry, FileInfo } from "../types/fileExplorer";
import type {
  DatabaseEntity,
  DatabaseFull,
  DatabaseProperty,
  DatabaseRow,
  DatabaseCell,
  PropertyType,
} from "../types/database";
import type { Template } from "../types/template";
import type { SyncResult, SyncStatus } from "../types/sync";
import { tauriInvoke } from "./bridge";

export class TauriDataService implements DataService {
  // --- Tasks ---
  fetchTaskTree(): Promise<TaskNode[]> {
    return tauriInvoke("db_tasks_fetch_tree");
  }
  fetchDeletedTasks(): Promise<TaskNode[]> {
    return tauriInvoke("db_tasks_fetch_deleted");
  }
  createTask(node: TaskNode): Promise<TaskNode> {
    return tauriInvoke("db_tasks_create", { node });
  }
  updateTask(id: string, updates: Partial<TaskNode>): Promise<TaskNode> {
    return tauriInvoke("db_tasks_update", { id, updates });
  }
  syncTaskTree(nodes: TaskNode[]): Promise<void> {
    return tauriInvoke("db_tasks_sync_tree", { nodes });
  }
  softDeleteTask(id: string): Promise<void> {
    return tauriInvoke("db_tasks_soft_delete", { id });
  }
  restoreTask(id: string): Promise<void> {
    return tauriInvoke("db_tasks_restore", { id });
  }
  permanentDeleteTask(id: string): Promise<void> {
    return tauriInvoke("db_tasks_permanent_delete", { id });
  }
  migrateTasksToBackend(nodes: TaskNode[]): Promise<void> {
    return tauriInvoke("app_migrate_from_local_storage", { tasks: nodes });
  }

  // --- Timer ---
  fetchTimerSettings(): Promise<TimerSettings> {
    return tauriInvoke("db_timer_fetch_settings");
  }
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
  ): Promise<TimerSettings> {
    return tauriInvoke("db_timer_update_settings", { settings });
  }
  startTimerSession(
    sessionType: SessionType,
    taskId?: string,
  ): Promise<TimerSession> {
    return tauriInvoke("db_timer_start_session", {
      sessionType,
      taskId: taskId ?? null,
    });
  }
  endTimerSession(
    id: number,
    duration: number,
    completed: boolean,
  ): Promise<TimerSession> {
    return tauriInvoke("db_timer_end_session", { id, duration, completed });
  }
  fetchTimerSessions(): Promise<TimerSession[]> {
    return tauriInvoke("db_timer_fetch_sessions");
  }
  fetchSessionsByTaskId(taskId: string): Promise<TimerSession[]> {
    return tauriInvoke("db_timer_fetch_sessions_by_task_id", {
      taskId,
    });
  }

  // --- Pomodoro Presets ---
  fetchPomodoroPresets(): Promise<PomodoroPreset[]> {
    return tauriInvoke("db_timer_fetch_pomodoro_presets");
  }
  createPomodoroPreset(
    preset: Omit<PomodoroPreset, "id" | "createdAt">,
  ): Promise<PomodoroPreset> {
    return tauriInvoke("db_timer_create_pomodoro_preset", { preset });
  }
  updatePomodoroPreset(
    id: number,
    updates: Partial<Omit<PomodoroPreset, "id" | "createdAt">>,
  ): Promise<PomodoroPreset> {
    return tauriInvoke("db_timer_update_pomodoro_preset", { id, updates });
  }
  deletePomodoroPreset(id: number): Promise<void> {
    return tauriInvoke("db_timer_delete_pomodoro_preset", { id });
  }

  // --- Sound ---
  fetchSoundSettings(): Promise<SoundSettings[]> {
    return tauriInvoke("db_sound_fetch_settings");
  }
  updateSoundSetting(
    soundType: string,
    volume: number,
    enabled: boolean,
  ): Promise<SoundSettings> {
    return tauriInvoke("db_sound_update_setting", {
      soundType,
      volume,
      enabled,
    });
  }
  fetchSoundPresets(): Promise<SoundPreset[]> {
    return tauriInvoke("db_sound_fetch_presets");
  }
  createSoundPreset(name: string, settingsJson: string): Promise<SoundPreset> {
    return tauriInvoke("db_sound_create_preset", {
      name,
      settingsJson,
    });
  }
  deleteSoundPreset(id: number): Promise<void> {
    return tauriInvoke("db_sound_delete_preset", { id });
  }

  // --- Sound Tags ---
  fetchAllSoundTags(): Promise<SoundTag[]> {
    return tauriInvoke("db_sound_fetch_all_sound_tags");
  }
  createSoundTag(name: string, color: string): Promise<SoundTag> {
    return tauriInvoke("db_sound_create_sound_tag", { name, color });
  }
  updateSoundTag(
    id: number,
    updates: { name?: string; color?: string; textColor?: string | null },
  ): Promise<SoundTag> {
    return tauriInvoke("db_sound_update_sound_tag", { id, updates });
  }
  deleteSoundTag(id: number): Promise<void> {
    return tauriInvoke("db_sound_delete_sound_tag", { id });
  }
  fetchTagsForSound(soundId: string): Promise<SoundTag[]> {
    return tauriInvoke("db_sound_fetch_tags_for_sound", {
      soundId,
    });
  }
  setTagsForSound(soundId: string, tagIds: number[]): Promise<void> {
    return tauriInvoke("db_sound_set_tags_for_sound", {
      soundId,
      tagIds,
    });
  }
  fetchAllSoundTagAssignments(): Promise<
    Array<{ soundId: string; tagId: number }>
  > {
    return tauriInvoke("db_sound_fetch_all_sound_tag_assignments");
  }
  fetchAllSoundDisplayMeta(): Promise<SoundDisplayMeta[]> {
    return tauriInvoke("db_sound_fetch_all_sound_display_meta");
  }
  updateSoundDisplayMeta(soundId: string, displayName: string): Promise<void> {
    return tauriInvoke("db_sound_update_sound_display_meta", {
      soundId,
      displayName,
    });
  }
  fetchWorkscreenSelections(): Promise<
    Array<{ soundId: string; displayOrder: number }>
  > {
    return tauriInvoke("db_sound_fetch_workscreen_selections");
  }
  setWorkscreenSelections(soundIds: string[]): Promise<void> {
    return tauriInvoke("db_sound_set_workscreen_selections", {
      soundIds,
    });
  }

  // --- Memo ---
  fetchAllMemos(): Promise<MemoNode[]> {
    return tauriInvoke("db_memo_fetch_all");
  }
  fetchMemoByDate(date: string): Promise<MemoNode | null> {
    return tauriInvoke("db_memo_fetch_by_date", { date });
  }
  upsertMemo(date: string, content: string): Promise<MemoNode> {
    return tauriInvoke("db_memo_upsert", { date, content });
  }
  deleteMemo(date: string): Promise<void> {
    return tauriInvoke("db_memo_delete", { date });
  }
  fetchDeletedMemos(): Promise<MemoNode[]> {
    return tauriInvoke("db_memo_fetch_deleted");
  }
  restoreMemo(date: string): Promise<void> {
    return tauriInvoke("db_memo_restore", { date });
  }
  permanentDeleteMemo(date: string): Promise<void> {
    return tauriInvoke("db_memo_permanent_delete", { date });
  }
  toggleMemoPin(date: string): Promise<MemoNode> {
    return tauriInvoke("db_memo_toggle_pin", { date });
  }
  setMemoPassword(date: string, password: string): Promise<MemoNode> {
    return tauriInvoke("db_memo_set_password", { date, password });
  }
  removeMemoPassword(date: string, currentPassword: string): Promise<MemoNode> {
    return tauriInvoke("db_memo_remove_password", {
      date,
      currentPassword,
    });
  }
  verifyMemoPassword(date: string, password: string): Promise<boolean> {
    return tauriInvoke("db_memo_verify_password", { date, password });
  }
  toggleMemoEditLock(date: string): Promise<MemoNode> {
    return tauriInvoke("db_memo_toggle_edit_lock", { date });
  }

  // --- Notes ---
  fetchAllNotes(): Promise<NoteNode[]> {
    return tauriInvoke("db_notes_fetch_all");
  }
  fetchDeletedNotes(): Promise<NoteNode[]> {
    return tauriInvoke("db_notes_fetch_deleted");
  }
  createNote(
    id: string,
    title: string,
    parentId?: string | null,
  ): Promise<NoteNode> {
    return tauriInvoke("db_notes_create", {
      id,
      title,
      parentId: parentId ?? null,
    });
  }
  updateNote(
    id: string,
    updates: Partial<
      Pick<NoteNode, "title" | "content" | "isPinned" | "color" | "icon">
    >,
  ): Promise<NoteNode> {
    return tauriInvoke("db_notes_update", { id, updates });
  }
  softDeleteNote(id: string): Promise<void> {
    return tauriInvoke("db_notes_soft_delete", { id });
  }
  restoreNote(id: string): Promise<void> {
    return tauriInvoke("db_notes_restore", { id });
  }
  permanentDeleteNote(id: string): Promise<void> {
    return tauriInvoke("db_notes_permanent_delete", { id });
  }
  searchNotes(query: string): Promise<NoteNode[]> {
    return tauriInvoke("db_notes_search", { query });
  }
  setNotePassword(id: string, password: string): Promise<NoteNode> {
    return tauriInvoke("db_notes_set_password", { id, password });
  }
  removeNotePassword(id: string, currentPassword: string): Promise<NoteNode> {
    return tauriInvoke("db_notes_remove_password", {
      id,
      currentPassword,
    });
  }
  verifyNotePassword(id: string, password: string): Promise<boolean> {
    return tauriInvoke("db_notes_verify_password", { id, password });
  }
  toggleNoteEditLock(id: string): Promise<NoteNode> {
    return tauriInvoke("db_notes_toggle_edit_lock", { id });
  }
  createNoteFolder(
    id: string,
    title: string,
    parentId: string | null,
  ): Promise<NoteNode> {
    return tauriInvoke("db_notes_create_folder", {
      id,
      title,
      parentId,
    });
  }
  syncNoteTree(
    items: Array<{ id: string; parentId: string | null; order: number }>,
  ): Promise<void> {
    return tauriInvoke("db_notes_sync_tree", { items });
  }

  // --- Custom Sounds ---
  async saveCustomSound(
    _id: string,
    data: ArrayBuffer,
    meta: CustomSoundMeta,
  ): Promise<void> {
    await tauriInvoke("db_custom_sound_save", {
      meta,
      data: Array.from(new Uint8Array(data)),
    });
  }
  loadCustomSound(id: string): Promise<ArrayBuffer | null> {
    return tauriInvoke("db_custom_sound_load", { id });
  }
  deleteCustomSound(id: string): Promise<void> {
    return tauriInvoke("db_custom_sound_delete", { id });
  }
  fetchCustomSoundMetas(): Promise<CustomSoundMeta[]> {
    return tauriInvoke("db_custom_sound_fetch_metas");
  }
  fetchDeletedCustomSounds(): Promise<CustomSoundMeta[]> {
    return tauriInvoke("db_custom_sound_fetch_deleted");
  }
  restoreCustomSound(id: string): Promise<void> {
    return tauriInvoke("db_custom_sound_restore", { id });
  }
  permanentDeleteCustomSound(id: string): Promise<void> {
    return tauriInvoke("db_custom_sound_permanent_delete", { id });
  }
  updateCustomSoundLabel(id: string, label: string): Promise<void> {
    return tauriInvoke("db_custom_sound_update_label", { id, label });
  }

  // --- Calendars ---
  fetchCalendars(): Promise<CalendarNode[]> {
    return tauriInvoke("db_calendars_fetch_all");
  }
  createCalendar(
    id: string,
    title: string,
    folderId: string,
  ): Promise<CalendarNode> {
    return tauriInvoke("db_calendars_create", {
      id,
      title,
      folderId,
    });
  }
  updateCalendar(
    id: string,
    updates: Partial<Pick<CalendarNode, "title" | "folderId" | "order">>,
  ): Promise<CalendarNode> {
    return tauriInvoke("db_calendars_update", { id, updates });
  }
  deleteCalendar(id: string): Promise<void> {
    return tauriInvoke("db_calendars_delete", { id });
  }

  // --- Routine Tags ---
  fetchRoutineTags(): Promise<RoutineTag[]> {
    return tauriInvoke("db_routine_tags_fetch_all");
  }
  createRoutineTag(name: string, color: string): Promise<RoutineTag> {
    return tauriInvoke("db_routine_tags_create", { name, color });
  }
  updateRoutineTag(
    id: number,
    updates: Partial<
      Pick<RoutineTag, "name" | "color" | "textColor" | "order">
    >,
  ): Promise<RoutineTag> {
    return tauriInvoke("db_routine_tags_update", { id, updates });
  }
  deleteRoutineTag(id: number): Promise<void> {
    return tauriInvoke("db_routine_tags_delete", { id });
  }
  fetchAllRoutineTagAssignments(): Promise<
    Array<{ routineId: string; tagId: number }>
  > {
    return tauriInvoke("db_routine_tags_fetch_all_assignments");
  }
  setTagsForRoutine(routineId: string, tagIds: number[]): Promise<void> {
    return tauriInvoke("db_routine_tags_set_tags_for_routine", {
      routineId,
      tagIds,
    });
  }

  // --- Calendar Tags ---
  fetchCalendarTags(): Promise<CalendarTag[]> {
    return tauriInvoke("db_calendar_tags_fetch_all");
  }
  createCalendarTag(name: string, color: string): Promise<CalendarTag> {
    return tauriInvoke("db_calendar_tags_create", { name, color });
  }
  updateCalendarTag(
    id: number,
    updates: Partial<
      Pick<CalendarTag, "name" | "color" | "textColor" | "order">
    >,
  ): Promise<CalendarTag> {
    return tauriInvoke("db_calendar_tags_update", { id, updates });
  }
  deleteCalendarTag(id: number): Promise<void> {
    return tauriInvoke("db_calendar_tags_delete", { id });
  }
  fetchAllCalendarTagAssignments(): Promise<
    Array<{ scheduleItemId: string; tagId: number }>
  > {
    return tauriInvoke("db_calendar_tags_fetch_all_assignments");
  }
  setTagsForScheduleItem(
    scheduleItemId: string,
    tagIds: number[],
  ): Promise<void> {
    return tauriInvoke("db_calendar_tags_set_tags_for_schedule_item", {
      scheduleItemId,
      tagIds,
    });
  }

  // --- Routines ---
  fetchAllRoutines(): Promise<RoutineNode[]> {
    return tauriInvoke("db_routines_fetch_all");
  }
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
  ): Promise<RoutineNode> {
    return tauriInvoke("db_routines_create", {
      id,
      title,
      startTime,
      endTime,
      frequencyType,
      frequencyDays,
      frequencyInterval,
      frequencyStartDate,
      reminderEnabled,
      reminderOffset,
    });
  }
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
  ): Promise<RoutineNode> {
    return tauriInvoke("db_routines_update", { id, updates });
  }
  deleteRoutine(id: string): Promise<void> {
    return tauriInvoke("db_routines_delete", { id });
  }
  fetchDeletedRoutines(): Promise<RoutineNode[]> {
    return tauriInvoke("db_routines_fetch_deleted");
  }
  async softDeleteRoutine(
    id: string,
  ): Promise<{ deletedScheduleItemIds: string[] }> {
    const ids = await tauriInvoke<string[]>("db_routines_soft_delete", { id });
    return { deletedScheduleItemIds: ids };
  }
  restoreRoutine(id: string): Promise<void> {
    return tauriInvoke("db_routines_restore", { id });
  }
  permanentDeleteRoutine(id: string): Promise<void> {
    return tauriInvoke("db_routines_permanent_delete", { id });
  }

  // --- Schedule Items ---
  fetchScheduleItemsByDate(date: string): Promise<ScheduleItem[]> {
    return tauriInvoke("db_schedule_items_fetch_by_date", { date });
  }
  fetchScheduleItemsByDateAll(date: string): Promise<ScheduleItem[]> {
    return tauriInvoke("db_schedule_items_fetch_by_date_all", { date });
  }
  fetchScheduleItemsByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ScheduleItem[]> {
    return tauriInvoke("db_schedule_items_fetch_by_date_range", {
      startDate,
      endDate,
    });
  }
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
  ): Promise<ScheduleItem> {
    return tauriInvoke("db_schedule_items_create", {
      id,
      date,
      title,
      startTime,
      endTime,
      routineId,
      templateId,
      noteId,
      isAllDay,
      content,
    });
  }
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
  ): Promise<ScheduleItem> {
    return tauriInvoke("db_schedule_items_update", { id, updates });
  }
  deleteScheduleItem(id: string): Promise<void> {
    return tauriInvoke("db_schedule_items_delete", { id });
  }
  softDeleteScheduleItem(id: string): Promise<void> {
    return tauriInvoke("db_schedule_items_soft_delete", { id });
  }
  restoreScheduleItem(id: string): Promise<void> {
    return tauriInvoke("db_schedule_items_restore", { id });
  }
  permanentDeleteScheduleItem(id: string): Promise<void> {
    return tauriInvoke("db_schedule_items_permanent_delete", { id });
  }
  fetchDeletedScheduleItems(): Promise<ScheduleItem[]> {
    return tauriInvoke("db_schedule_items_fetch_deleted");
  }
  toggleScheduleItemComplete(id: string): Promise<ScheduleItem> {
    return tauriInvoke("db_schedule_items_toggle_complete", { id });
  }
  dismissScheduleItem(id: string): Promise<void> {
    return tauriInvoke("db_schedule_items_dismiss", { id });
  }
  undismissScheduleItem(id: string): Promise<void> {
    return tauriInvoke("db_schedule_items_undismiss", { id });
  }
  fetchLastRoutineDate(): Promise<string | null> {
    return tauriInvoke("db_schedule_items_fetch_last_routine_date");
  }
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
  ): Promise<ScheduleItem[]> {
    return tauriInvoke("db_schedule_items_bulk_create", { items });
  }
  updateFutureScheduleItemsByRoutine(
    routineId: string,
    updates: { title?: string; startTime?: string; endTime?: string },
    fromDate: string,
  ): Promise<number> {
    return tauriInvoke("db_schedule_items_update_future_by_routine", {
      routineId,
      updates,
      fromDate,
    });
  }
  fetchScheduleItemsByRoutineId(routineId: string): Promise<ScheduleItem[]> {
    return tauriInvoke("db_schedule_items_fetch_by_routine_id", {
      routineId,
    });
  }
  bulkDeleteScheduleItems(ids: string[]): Promise<number> {
    return tauriInvoke("db_schedule_items_bulk_delete", { ids });
  }
  fetchEvents(): Promise<ScheduleItem[]> {
    return tauriInvoke("db_schedule_items_fetch_events");
  }

  // --- Routine Groups ---
  fetchRoutineGroups(): Promise<RoutineGroup[]> {
    return tauriInvoke("db_routine_groups_fetch_all");
  }
  createRoutineGroup(
    id: string,
    name: string,
    color: string,
    frequencyType?: string,
    frequencyDays?: number[],
    frequencyInterval?: number | null,
    frequencyStartDate?: string | null,
  ): Promise<RoutineGroup> {
    return tauriInvoke("db_routine_groups_create", {
      id,
      name,
      color,
      frequencyType,
      frequencyDays,
      frequencyInterval,
      frequencyStartDate,
    });
  }
  updateRoutineGroup(
    id: string,
    updates: Partial<
      Pick<
        RoutineGroup,
        | "name"
        | "color"
        | "isVisible"
        | "order"
        | "frequencyType"
        | "frequencyDays"
        | "frequencyInterval"
        | "frequencyStartDate"
      >
    >,
  ): Promise<RoutineGroup> {
    return tauriInvoke("db_routine_groups_update", { id, updates });
  }
  deleteRoutineGroup(id: string): Promise<void> {
    return tauriInvoke("db_routine_groups_delete", { id });
  }
  fetchAllRoutineGroupTagAssignments(): Promise<
    Array<{ groupId: string; tagId: number }>
  > {
    return tauriInvoke("db_routine_groups_fetch_all_tag_assignments");
  }
  setTagsForRoutineGroup(groupId: string, tagIds: number[]): Promise<void> {
    return tauriInvoke("db_routine_groups_set_tags_for_group", {
      groupId,
      tagIds,
    });
  }

  // --- Playlists ---
  fetchPlaylists(): Promise<Playlist[]> {
    return tauriInvoke("db_playlists_fetch_all");
  }
  createPlaylist(id: string, name: string): Promise<Playlist> {
    return tauriInvoke("db_playlists_create", { id, name });
  }
  updatePlaylist(
    id: string,
    updates: Partial<
      Pick<Playlist, "name" | "sortOrder" | "repeatMode" | "isShuffle">
    >,
  ): Promise<Playlist> {
    return tauriInvoke("db_playlists_update", { id, updates });
  }
  deletePlaylist(id: string): Promise<void> {
    return tauriInvoke("db_playlists_delete", { id });
  }
  fetchPlaylistItems(playlistId: string): Promise<PlaylistItem[]> {
    return tauriInvoke("db_playlists_fetch_items", {
      playlistId,
    });
  }
  fetchAllPlaylistItems(): Promise<PlaylistItem[]> {
    return tauriInvoke("db_playlists_fetch_all_items");
  }
  addPlaylistItem(
    id: string,
    playlistId: string,
    soundId: string,
  ): Promise<PlaylistItem> {
    return tauriInvoke("db_playlists_add_item", {
      id,
      playlistId,
      soundId,
    });
  }
  removePlaylistItem(itemId: string): Promise<void> {
    return tauriInvoke("db_playlists_remove_item", { itemId });
  }
  reorderPlaylistItems(playlistId: string, itemIds: string[]): Promise<void> {
    return tauriInvoke("db_playlists_reorder_items", {
      playlistId,
      itemIds,
    });
  }

  // --- Wiki Tags ---
  fetchWikiTags(): Promise<WikiTag[]> {
    return tauriInvoke("db_wiki_tags_fetch_all");
  }
  searchWikiTags(query: string): Promise<WikiTag[]> {
    return tauriInvoke("db_wiki_tags_search", { query });
  }
  createWikiTag(name: string, color: string): Promise<WikiTag> {
    return tauriInvoke("db_wiki_tags_create", { name, color });
  }
  createWikiTagWithId(
    id: string,
    name: string,
    color: string,
  ): Promise<WikiTag> {
    return tauriInvoke("db_wiki_tags_create_with_id", { id, name, color });
  }
  updateWikiTag(
    id: string,
    updates: Partial<Pick<WikiTag, "name" | "color" | "textColor">>,
  ): Promise<WikiTag> {
    return tauriInvoke("db_wiki_tags_update", { id, updates });
  }
  deleteWikiTag(id: string): Promise<void> {
    return tauriInvoke("db_wiki_tags_delete", { id });
  }
  mergeWikiTags(sourceId: string, targetId: string): Promise<WikiTag> {
    return tauriInvoke("db_wiki_tags_merge", {
      sourceId,
      targetId,
    });
  }
  fetchWikiTagsForEntity(entityId: string): Promise<WikiTag[]> {
    return tauriInvoke("db_wiki_tags_fetch_for_entity", {
      entityId,
    });
  }
  setWikiTagsForEntity(
    entityId: string,
    entityType: string,
    tagIds: string[],
  ): Promise<void> {
    return tauriInvoke("db_wiki_tags_set_for_entity", {
      entityId,
      entityType,
      tagIds,
    });
  }
  syncInlineWikiTags(
    entityId: string,
    entityType: string,
    tagNames: string[],
  ): Promise<void> {
    return tauriInvoke("db_wiki_tags_sync_inline", {
      entityId,
      entityType,
      tagNames,
    });
  }
  fetchAllWikiTagAssignments(): Promise<WikiTagAssignment[]> {
    return tauriInvoke("db_wiki_tags_fetch_all_assignments");
  }
  restoreWikiTagAssignment(
    tagId: string,
    entityId: string,
    entityType: string,
    source: string,
  ): Promise<void> {
    return tauriInvoke("db_wiki_tags_restore_assignment", {
      tagId,
      entityId,
      entityType,
      source,
    });
  }

  // --- Wiki Tag Groups ---
  fetchWikiTagGroups(): Promise<WikiTagGroup[]> {
    return tauriInvoke("db_wiki_tag_groups_fetch_all");
  }
  createWikiTagGroup(
    name: string,
    noteIds: string[],
    filterTags?: string[],
  ): Promise<WikiTagGroup> {
    return tauriInvoke("db_wiki_tag_groups_create", {
      name,
      noteIds,
      filterTags,
    });
  }
  updateWikiTagGroup(
    id: string,
    updates: { name?: string; filterTags?: string[] },
  ): Promise<WikiTagGroup> {
    return tauriInvoke("db_wiki_tag_groups_update", { id, updates });
  }
  deleteWikiTagGroup(id: string): Promise<void> {
    return tauriInvoke("db_wiki_tag_groups_delete", { id });
  }
  fetchAllWikiTagGroupMembers(): Promise<WikiTagGroupMember[]> {
    return tauriInvoke("db_wiki_tag_groups_fetch_all_members");
  }
  setWikiTagGroupMembers(groupId: string, noteIds: string[]): Promise<void> {
    return tauriInvoke("db_wiki_tag_groups_set_members", {
      groupId,
      noteIds,
    });
  }
  addWikiTagGroupMember(groupId: string, noteId: string): Promise<void> {
    return tauriInvoke("db_wiki_tag_groups_add_member", {
      groupId,
      noteId,
    });
  }
  removeWikiTagGroupMember(groupId: string, noteId: string): Promise<void> {
    return tauriInvoke("db_wiki_tag_groups_remove_member", {
      groupId,
      noteId,
    });
  }

  // --- Wiki Tag Connections ---
  fetchWikiTagConnections(): Promise<WikiTagConnection[]> {
    return tauriInvoke("db_wiki_tag_connections_fetch_all");
  }
  createWikiTagConnection(
    sourceTagId: string,
    targetTagId: string,
  ): Promise<WikiTagConnection> {
    return tauriInvoke("db_wiki_tag_connections_create", {
      sourceTagId,
      targetTagId,
    });
  }
  deleteWikiTagConnection(id: string): Promise<void> {
    return tauriInvoke("db_wiki_tag_connections_delete", { id });
  }
  deleteWikiTagConnectionByPair(
    sourceTagId: string,
    targetTagId: string,
  ): Promise<void> {
    return tauriInvoke("db_wiki_tag_connections_delete_by_tag_pair", {
      sourceTagId,
      targetTagId,
    });
  }

  // --- Note Connections ---
  fetchNoteConnections(): Promise<NoteConnection[]> {
    return tauriInvoke("db_note_connections_fetch_all");
  }
  createNoteConnection(
    sourceNoteId: string,
    targetNoteId: string,
  ): Promise<NoteConnection> {
    return tauriInvoke("db_note_connections_create", {
      sourceNoteId,
      targetNoteId,
    });
  }
  deleteNoteConnection(id: string): Promise<void> {
    return tauriInvoke("db_note_connections_delete", { id });
  }
  deleteNoteConnectionByPair(
    sourceNoteId: string,
    targetNoteId: string,
  ): Promise<void> {
    return tauriInvoke("db_note_connections_delete_by_note_pair", {
      sourceNoteId,
      targetNoteId,
    });
  }

  // --- Time Memos ---
  fetchTimeMemosByDate(date: string): Promise<TimeMemo[]> {
    return tauriInvoke("db_time_memos_fetch_by_date", { date });
  }
  upsertTimeMemo(
    id: string,
    date: string,
    hour: number,
    content: string,
  ): Promise<TimeMemo> {
    return tauriInvoke("db_time_memos_upsert", { id, date, hour, content });
  }
  deleteTimeMemo(id: string): Promise<void> {
    return tauriInvoke("db_time_memos_delete", { id });
  }

  // --- Paper Boards ---
  fetchPaperBoards(): Promise<PaperBoard[]> {
    return tauriInvoke("db_paper_boards_fetch_all");
  }
  fetchPaperBoardById(id: string): Promise<PaperBoard | null> {
    return tauriInvoke("db_paper_boards_fetch_by_id", { id });
  }
  fetchPaperBoardByNoteId(noteId: string): Promise<PaperBoard | null> {
    return tauriInvoke("db_paper_boards_fetch_by_note_id", {
      noteId,
    });
  }
  createPaperBoard(
    name: string,
    linkedNoteId?: string | null,
  ): Promise<PaperBoard> {
    return tauriInvoke("db_paper_boards_create", {
      name,
      linkedNoteId,
    });
  }
  updatePaperBoard(
    id: string,
    updates: Partial<
      Pick<
        PaperBoard,
        | "name"
        | "linkedNoteId"
        | "viewportX"
        | "viewportY"
        | "viewportZoom"
        | "order"
      >
    >,
  ): Promise<PaperBoard> {
    return tauriInvoke("db_paper_boards_update", { id, updates });
  }
  deletePaperBoard(id: string): Promise<void> {
    return tauriInvoke("db_paper_boards_delete", { id });
  }

  // --- Paper Nodes ---
  fetchPaperNodeCountsByBoard(): Promise<Record<string, number>> {
    return tauriInvoke("db_paper_nodes_fetch_node_counts");
  }
  fetchPaperNodesByBoard(boardId: string): Promise<PaperNode[]> {
    return tauriInvoke("db_paper_nodes_fetch_by_board", {
      boardId,
    });
  }
  createPaperNode(params: {
    id?: string;
    boardId: string;
    nodeType: PaperNode["nodeType"];
    positionX: number;
    positionY: number;
    width?: number;
    height?: number;
    zIndex?: number;
    parentNodeId?: string | null;
    refEntityId?: string | null;
    refEntityType?: string | null;
    textContent?: string | null;
    frameColor?: string | null;
    frameLabel?: string | null;
    label?: string | null;
    hidden?: boolean;
  }): Promise<PaperNode> {
    return tauriInvoke("db_paper_nodes_create", { params });
  }
  updatePaperNode(
    id: string,
    updates: Partial<
      Pick<
        PaperNode,
        | "positionX"
        | "positionY"
        | "width"
        | "height"
        | "zIndex"
        | "parentNodeId"
        | "textContent"
        | "frameColor"
        | "frameLabel"
        | "label"
        | "hidden"
      >
    >,
  ): Promise<PaperNode> {
    return tauriInvoke("db_paper_nodes_update", { id, updates });
  }
  bulkUpdatePaperNodePositions(
    updates: Array<{
      id: string;
      positionX: number;
      positionY: number;
      parentNodeId: string | null;
    }>,
  ): Promise<void> {
    return tauriInvoke("db_paper_nodes_bulk_update_positions", { updates });
  }
  bulkUpdatePaperNodeZIndices(
    updates: Array<{
      id: string;
      zIndex: number;
      parentNodeId: string | null;
    }>,
  ): Promise<void> {
    return tauriInvoke("db_paper_nodes_bulk_update_z_indices", { updates });
  }
  deletePaperNode(id: string): Promise<void> {
    return tauriInvoke("db_paper_nodes_delete", { id });
  }

  // --- Paper Edges ---
  fetchPaperEdgesByBoard(boardId: string): Promise<PaperEdge[]> {
    return tauriInvoke("db_paper_edges_fetch_by_board", {
      boardId,
    });
  }
  createPaperEdge(params: {
    boardId: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    label?: string | null;
    styleJson?: string | null;
  }): Promise<PaperEdge> {
    return tauriInvoke("db_paper_edges_create", { params });
  }
  deletePaperEdge(id: string): Promise<void> {
    return tauriInvoke("db_paper_edges_delete", { id });
  }

  // --- Data I/O ---
  exportData(): Promise<boolean> {
    return tauriInvoke("data_export");
  }
  importData(): Promise<boolean> {
    return tauriInvoke("data_import");
  }
  resetData(): Promise<boolean> {
    return tauriInvoke("data_reset");
  }

  // --- Diagnostics ---
  fetchLogs(options?: { level?: string; limit?: number }): Promise<LogEntry[]> {
    return tauriInvoke("diagnostics_fetch_logs", { options });
  }
  openLogFolder(): Promise<void> {
    return tauriInvoke("diagnostics_open_log_folder");
  }
  exportLogs(): Promise<boolean> {
    return tauriInvoke("diagnostics_export_logs");
  }
  fetchMetrics(): Promise<IpcChannelMetrics[]> {
    return tauriInvoke("diagnostics_fetch_metrics");
  }
  resetMetrics(): Promise<boolean> {
    return tauriInvoke("diagnostics_reset_metrics");
  }
  fetchSystemInfo(): Promise<SystemInfo> {
    return tauriInvoke("diagnostics_fetch_system_info");
  }

  // --- Shell ---
  openExternal(url: string): Promise<void> {
    return tauriInvoke("shell_open_external", { url });
  }
  openAttachmentFile(id: string): Promise<void> {
    return tauriInvoke("shell_open_path", { id });
  }

  // --- Attachments ---
  async saveAttachment(meta: AttachmentMeta, data: ArrayBuffer): Promise<void> {
    await tauriInvoke("attachment_save", {
      meta,
      data: Array.from(new Uint8Array(data)),
    });
  }
  loadAttachment(id: string): Promise<ArrayBuffer | null> {
    return tauriInvoke("attachment_load", { id });
  }
  deleteAttachment(id: string): Promise<void> {
    return tauriInvoke("attachment_delete", { id });
  }
  fetchAttachmentMetas(): Promise<AttachmentMeta[]> {
    return tauriInvoke("attachment_fetch_metas");
  }

  // --- Updater ---
  checkForUpdates(): Promise<void> {
    return tauriInvoke("updater_check_for_updates");
  }
  downloadUpdate(): Promise<void> {
    return tauriInvoke("updater_download_update");
  }
  installUpdate(): Promise<void> {
    return tauriInvoke("updater_install_update");
  }

  // --- Databases ---
  fetchAllDatabases(): Promise<DatabaseEntity[]> {
    return tauriInvoke("db_database_fetch_all");
  }
  fetchDatabaseFull(id: string): Promise<DatabaseFull | undefined> {
    return tauriInvoke("db_database_fetch_full", { id });
  }
  createDatabase(id: string, title: string): Promise<DatabaseEntity> {
    return tauriInvoke("db_database_create", { id, title });
  }
  updateDatabase(id: string, title: string): Promise<DatabaseEntity> {
    return tauriInvoke("db_database_update", { id, title });
  }
  softDeleteDatabase(id: string): Promise<void> {
    return tauriInvoke("db_database_soft_delete", { id });
  }
  permanentDeleteDatabase(id: string): Promise<void> {
    return tauriInvoke("db_database_permanent_delete", { id });
  }
  addDatabaseProperty(
    id: string,
    databaseId: string,
    name: string,
    type: PropertyType,
    order: number,
    config: DatabaseProperty["config"],
  ): Promise<DatabaseProperty> {
    return tauriInvoke("db_database_add_property", {
      id,
      databaseId,
      name,
      propertyType: type,
      order,
      config,
    });
  }
  updateDatabaseProperty(
    id: string,
    updates: {
      name?: string;
      type?: PropertyType;
      order?: number;
      config?: DatabaseProperty["config"];
    },
  ): Promise<void> {
    return tauriInvoke("db_database_update_property", { id, updates });
  }
  removeDatabaseProperty(id: string): Promise<void> {
    return tauriInvoke("db_database_remove_property", { id });
  }
  addDatabaseRow(
    id: string,
    databaseId: string,
    order: number,
  ): Promise<DatabaseRow> {
    return tauriInvoke("db_database_add_row", {
      id,
      databaseId,
      order,
    });
  }
  reorderDatabaseRows(rowIds: string[]): Promise<void> {
    return tauriInvoke("db_database_reorder_rows", { rowIds });
  }
  removeDatabaseRow(id: string): Promise<void> {
    return tauriInvoke("db_database_remove_row", { id });
  }
  upsertDatabaseCell(
    id: string,
    rowId: string,
    propertyId: string,
    value: string,
  ): Promise<DatabaseCell> {
    return tauriInvoke("db_database_upsert_cell", {
      id,
      rowId,
      propertyId,
      value,
    });
  }

  // --- App Settings ---
  getAppSetting(key: string): Promise<string | null> {
    return tauriInvoke("settings_get", { key });
  }
  setAppSetting(key: string, value: string): Promise<void> {
    return tauriInvoke("settings_set", { key, value });
  }
  getAllAppSettings(): Promise<Record<string, string>> {
    return tauriInvoke("settings_get_all");
  }
  removeAppSetting(key: string): Promise<void> {
    return tauriInvoke("settings_remove", { key });
  }

  // --- Templates ---
  fetchAllTemplates(): Promise<Template[]> {
    return tauriInvoke("db_templates_fetch_all");
  }
  fetchTemplateById(id: string): Promise<Template | undefined> {
    return tauriInvoke("db_templates_fetch_by_id", { id });
  }
  createTemplate(id: string, name: string): Promise<Template> {
    return tauriInvoke("db_templates_create", { id, name });
  }
  updateTemplate(
    id: string,
    updates: { name?: string; content?: string },
  ): Promise<Template> {
    return tauriInvoke("db_templates_update", { id, updates });
  }
  softDeleteTemplate(id: string): Promise<void> {
    return tauriInvoke("db_templates_soft_delete", { id });
  }
  permanentDeleteTemplate(id: string): Promise<void> {
    return tauriInvoke("db_templates_permanent_delete", { id });
  }

  // --- System Integration ---
  getAutoLaunch(): Promise<boolean> {
    return tauriInvoke("system_get_auto_launch");
  }
  setAutoLaunch(enabled: boolean): Promise<void> {
    return tauriInvoke("system_set_auto_launch", { enabled });
  }
  getStartMinimized(): Promise<boolean> {
    return tauriInvoke("system_get_start_minimized");
  }
  setStartMinimized(enabled: boolean): Promise<void> {
    return tauriInvoke("system_set_start_minimized", { enabled });
  }
  getTrayEnabled(): Promise<boolean> {
    return tauriInvoke("system_get_tray_enabled");
  }
  setTrayEnabled(enabled: boolean): Promise<void> {
    return tauriInvoke("system_set_tray_enabled", { enabled });
  }
  getGlobalShortcuts(): Promise<Record<string, string>> {
    return tauriInvoke("system_get_global_shortcuts");
  }
  setGlobalShortcuts(shortcuts: Record<string, string>): Promise<void> {
    return tauriInvoke("system_set_global_shortcuts", { shortcuts });
  }
  reregisterGlobalShortcuts(): Promise<{ success: boolean }> {
    return tauriInvoke("system_reregister_global_shortcuts");
  }
  updateTrayTimer(state: {
    remaining: string;
    isRunning: boolean;
  }): Promise<void> {
    return tauriInvoke("tray_update_timer", { state });
  }

  // --- Reminders ---
  getReminderSettings(): Promise<Record<string, string>> {
    return tauriInvoke("reminder_get_settings");
  }
  setReminderSettings(settings: Record<string, string>): Promise<void> {
    return tauriInvoke("reminder_set_settings", { settings });
  }

  // --- Files ---
  selectFolder(): Promise<string | null> {
    return tauriInvoke("files_select_folder");
  }
  getFilesRootPath(): Promise<string | null> {
    return tauriInvoke("files_get_root_path");
  }
  listDirectory(relativePath: string): Promise<FileEntry[]> {
    return tauriInvoke("files_list_directory", {
      relativePath,
    });
  }
  getFileInfo(relativePath: string): Promise<FileInfo> {
    return tauriInvoke("files_get_file_info", {
      relativePath,
    });
  }
  readTextFile(relativePath: string): Promise<string> {
    return tauriInvoke("files_read_text_file", {
      relativePath,
    });
  }
  readFile(relativePath: string): Promise<ArrayBuffer> {
    return tauriInvoke("files_read_file", { relativePath });
  }
  createDirectory(relativePath: string): Promise<void> {
    return tauriInvoke("files_create_directory", {
      relativePath,
    });
  }
  createFile(relativePath: string): Promise<void> {
    return tauriInvoke("files_create_file", { relativePath });
  }
  writeTextFile(relativePath: string, content: string): Promise<void> {
    return tauriInvoke("files_write_text_file", {
      relativePath,
      content,
    });
  }
  renameFile(oldPath: string, newPath: string): Promise<void> {
    return tauriInvoke("files_rename", {
      oldPath,
      newPath,
    });
  }
  moveFile(sourcePath: string, destPath: string): Promise<void> {
    return tauriInvoke("files_move", {
      sourcePath,
      destPath,
    });
  }
  deleteFile(relativePath: string): Promise<void> {
    return tauriInvoke("files_delete", { relativePath });
  }
  openFileInSystem(relativePath: string): Promise<void> {
    return tauriInvoke("files_open_in_system", {
      relativePath,
    });
  }

  // --- Copy (Notes/Memos <-> Files) ---
  copyNoteToFile(noteId: string, directoryPath: string): Promise<string> {
    return tauriInvoke("copy_note_to_file", {
      noteId,
      directoryPath,
    });
  }
  copyMemoToFile(memoDate: string, directoryPath: string): Promise<string> {
    return tauriInvoke("copy_memo_to_file", {
      memoDate,
      directoryPath,
    });
  }
  convertFileToTiptap(
    relativeFilePath: string,
  ): Promise<{ title: string; content: string }> {
    return tauriInvoke("copy_convert_file_to_tiptap", {
      relativeFilePath,
    });
  }

  // --- Sync ---
  syncConfigure(url: string, token: string): Promise<boolean> {
    return tauriInvoke("sync_configure", { url, token });
  }
  syncTrigger(): Promise<SyncResult> {
    return tauriInvoke("sync_trigger");
  }
  syncGetStatus(): Promise<SyncStatus> {
    return tauriInvoke("sync_get_status");
  }
  syncDisconnect(): Promise<void> {
    return tauriInvoke("sync_disconnect");
  }
  syncFullDownload(): Promise<SyncResult> {
    return tauriInvoke("sync_full_download");
  }
}
