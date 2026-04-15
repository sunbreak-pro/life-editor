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
      session_type: sessionType,
      task_id: taskId ?? null,
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
      task_id: taskId,
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
      sound_type: soundType,
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
      settings_json: settingsJson,
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
      sound_id: soundId,
    });
  }
  setTagsForSound(soundId: string, tagIds: number[]): Promise<void> {
    return tauriInvoke("db_sound_set_tags_for_sound", {
      sound_id: soundId,
      tag_ids: tagIds,
    });
  }
  fetchAllSoundTagAssignments(): Promise<
    Array<{ sound_id: string; tag_id: number }>
  > {
    return tauriInvoke("db_sound_fetch_all_sound_tag_assignments");
  }
  fetchAllSoundDisplayMeta(): Promise<SoundDisplayMeta[]> {
    return tauriInvoke("db_sound_fetch_all_sound_display_meta");
  }
  updateSoundDisplayMeta(soundId: string, displayName: string): Promise<void> {
    return tauriInvoke("db_sound_update_sound_display_meta", {
      sound_id: soundId,
      display_name: displayName,
    });
  }
  fetchWorkscreenSelections(): Promise<
    Array<{ soundId: string; displayOrder: number }>
  > {
    return tauriInvoke("db_sound_fetch_workscreen_selections");
  }
  setWorkscreenSelections(soundIds: string[]): Promise<void> {
    return tauriInvoke("db_sound_set_workscreen_selections", {
      sound_ids: soundIds,
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
      current_password: currentPassword,
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
      parent_id: parentId ?? null,
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
      current_password: currentPassword,
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
      parent_id: parentId,
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
      folder_id: folderId,
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
    Array<{ routine_id: string; tag_id: number }>
  > {
    return tauriInvoke("db_routine_tags_fetch_all_assignments");
  }
  setTagsForRoutine(routineId: string, tagIds: number[]): Promise<void> {
    return tauriInvoke("db_routine_tags_set_tags_for_routine", {
      routine_id: routineId,
      tag_ids: tagIds,
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
    Array<{ schedule_item_id: string; tag_id: number }>
  > {
    return tauriInvoke("db_calendar_tags_fetch_all_assignments");
  }
  setTagsForScheduleItem(
    scheduleItemId: string,
    tagIds: number[],
  ): Promise<void> {
    return tauriInvoke("db_calendar_tags_set_tags_for_schedule_item", {
      schedule_item_id: scheduleItemId,
      tag_ids: tagIds,
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
      start_time: startTime,
      end_time: endTime,
      frequency_type: frequencyType,
      frequency_days: frequencyDays,
      frequency_interval: frequencyInterval,
      frequency_start_date: frequencyStartDate,
      reminder_enabled: reminderEnabled,
      reminder_offset: reminderOffset,
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
  softDeleteRoutine(id: string): Promise<void> {
    return tauriInvoke("db_routines_soft_delete", { id });
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
      start_date: startDate,
      end_date: endDate,
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
      start_time: startTime,
      end_time: endTime,
      routine_id: routineId,
      template_id: templateId,
      note_id: noteId,
      is_all_day: isAllDay,
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
      routine_id: routineId,
      updates,
      from_date: fromDate,
    });
  }
  fetchScheduleItemsByRoutineId(routineId: string): Promise<ScheduleItem[]> {
    return tauriInvoke("db_schedule_items_fetch_by_routine_id", {
      routine_id: routineId,
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
      frequency_type: frequencyType,
      frequency_days: frequencyDays,
      frequency_interval: frequencyInterval,
      frequency_start_date: frequencyStartDate,
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
    Array<{ group_id: string; tag_id: number }>
  > {
    return tauriInvoke("db_routine_groups_fetch_all_tag_assignments");
  }
  setTagsForRoutineGroup(groupId: string, tagIds: number[]): Promise<void> {
    return tauriInvoke("db_routine_groups_set_tags_for_group", {
      group_id: groupId,
      tag_ids: tagIds,
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
      playlist_id: playlistId,
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
      playlist_id: playlistId,
      sound_id: soundId,
    });
  }
  removePlaylistItem(itemId: string): Promise<void> {
    return tauriInvoke("db_playlists_remove_item", { item_id: itemId });
  }
  reorderPlaylistItems(playlistId: string, itemIds: string[]): Promise<void> {
    return tauriInvoke("db_playlists_reorder_items", {
      playlist_id: playlistId,
      item_ids: itemIds,
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
      source_id: sourceId,
      target_id: targetId,
    });
  }
  fetchWikiTagsForEntity(entityId: string): Promise<WikiTag[]> {
    return tauriInvoke("db_wiki_tags_fetch_for_entity", {
      entity_id: entityId,
    });
  }
  setWikiTagsForEntity(
    entityId: string,
    entityType: string,
    tagIds: string[],
  ): Promise<void> {
    return tauriInvoke("db_wiki_tags_set_for_entity", {
      entity_id: entityId,
      entity_type: entityType,
      tag_ids: tagIds,
    });
  }
  syncInlineWikiTags(
    entityId: string,
    entityType: string,
    tagNames: string[],
  ): Promise<void> {
    return tauriInvoke("db_wiki_tags_sync_inline", {
      entity_id: entityId,
      entity_type: entityType,
      tag_names: tagNames,
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
      tag_id: tagId,
      entity_id: entityId,
      entity_type: entityType,
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
      note_ids: noteIds,
      filter_tags: filterTags,
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
      group_id: groupId,
      note_ids: noteIds,
    });
  }
  addWikiTagGroupMember(groupId: string, noteId: string): Promise<void> {
    return tauriInvoke("db_wiki_tag_groups_add_member", {
      group_id: groupId,
      note_id: noteId,
    });
  }
  removeWikiTagGroupMember(groupId: string, noteId: string): Promise<void> {
    return tauriInvoke("db_wiki_tag_groups_remove_member", {
      group_id: groupId,
      note_id: noteId,
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
      source_tag_id: sourceTagId,
      target_tag_id: targetTagId,
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
      source_tag_id: sourceTagId,
      target_tag_id: targetTagId,
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
      source_note_id: sourceNoteId,
      target_note_id: targetNoteId,
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
      source_note_id: sourceNoteId,
      target_note_id: targetNoteId,
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
      note_id: noteId,
    });
  }
  createPaperBoard(
    name: string,
    linkedNoteId?: string | null,
  ): Promise<PaperBoard> {
    return tauriInvoke("db_paper_boards_create", {
      name,
      linked_note_id: linkedNoteId,
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
      board_id: boardId,
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
      board_id: boardId,
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
      database_id: databaseId,
      name,
      property_type: type,
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
      database_id: databaseId,
      order,
    });
  }
  reorderDatabaseRows(rowIds: string[]): Promise<void> {
    return tauriInvoke("db_database_reorder_rows", { row_ids: rowIds });
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
      row_id: rowId,
      property_id: propertyId,
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
      relative_path: relativePath,
    });
  }
  getFileInfo(relativePath: string): Promise<FileInfo> {
    return tauriInvoke("files_get_file_info", {
      relative_path: relativePath,
    });
  }
  readTextFile(relativePath: string): Promise<string> {
    return tauriInvoke("files_read_text_file", {
      relative_path: relativePath,
    });
  }
  readFile(relativePath: string): Promise<ArrayBuffer> {
    return tauriInvoke("files_read_file", { relative_path: relativePath });
  }
  createDirectory(relativePath: string): Promise<void> {
    return tauriInvoke("files_create_directory", {
      relative_path: relativePath,
    });
  }
  createFile(relativePath: string): Promise<void> {
    return tauriInvoke("files_create_file", { relative_path: relativePath });
  }
  writeTextFile(relativePath: string, content: string): Promise<void> {
    return tauriInvoke("files_write_text_file", {
      relative_path: relativePath,
      content,
    });
  }
  renameFile(oldPath: string, newPath: string): Promise<void> {
    return tauriInvoke("files_rename", {
      old_path: oldPath,
      new_path: newPath,
    });
  }
  moveFile(sourcePath: string, destPath: string): Promise<void> {
    return tauriInvoke("files_move", {
      source_path: sourcePath,
      dest_path: destPath,
    });
  }
  deleteFile(relativePath: string): Promise<void> {
    return tauriInvoke("files_delete", { relative_path: relativePath });
  }
  openFileInSystem(relativePath: string): Promise<void> {
    return tauriInvoke("files_open_in_system", {
      relative_path: relativePath,
    });
  }

  // --- Copy (Notes/Memos <-> Files) ---
  copyNoteToFile(noteId: string, directoryPath: string): Promise<string> {
    return tauriInvoke("copy_note_to_file", {
      note_id: noteId,
      directory_path: directoryPath,
    });
  }
  copyMemoToFile(memoDate: string, directoryPath: string): Promise<string> {
    return tauriInvoke("copy_memo_to_file", {
      memo_date: memoDate,
      directory_path: directoryPath,
    });
  }
  convertFileToTiptap(
    relativeFilePath: string,
  ): Promise<{ title: string; content: string }> {
    return tauriInvoke("copy_convert_file_to_tiptap", {
      relative_file_path: relativeFilePath,
    });
  }
}
