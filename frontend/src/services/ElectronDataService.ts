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
import type { ScheduleItem } from "../types/schedule";
import type { Playlist, PlaylistItem } from "../types/playlist";
import type {
  LogEntry,
  IpcChannelMetrics,
  SystemInfo,
} from "../types/diagnostics";
import type { WikiTag, WikiTagAssignment } from "../types/wikiTag";

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return window.electronAPI!.invoke<T>(channel, ...args);
}

export class ElectronDataService implements DataService {
  // Tasks
  fetchTaskTree(): Promise<TaskNode[]> {
    return invoke("db:tasks:fetchTree");
  }
  fetchDeletedTasks(): Promise<TaskNode[]> {
    return invoke("db:tasks:fetchDeleted");
  }
  createTask(node: TaskNode): Promise<TaskNode> {
    return invoke("db:tasks:create", node);
  }
  updateTask(id: string, updates: Partial<TaskNode>): Promise<TaskNode> {
    return invoke("db:tasks:update", id, updates);
  }
  syncTaskTree(nodes: TaskNode[]): Promise<void> {
    return invoke("db:tasks:syncTree", nodes);
  }
  softDeleteTask(id: string): Promise<void> {
    return invoke("db:tasks:softDelete", id);
  }
  restoreTask(id: string): Promise<void> {
    return invoke("db:tasks:restore", id);
  }
  permanentDeleteTask(id: string): Promise<void> {
    return invoke("db:tasks:permanentDelete", id);
  }
  migrateTasksToBackend(nodes: TaskNode[]): Promise<void> {
    return invoke("app:migrateFromLocalStorage", { tasks: nodes });
  }

  // Timer
  fetchTimerSettings(): Promise<TimerSettings> {
    return invoke("db:timer:fetchSettings");
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
      >
    >,
  ): Promise<TimerSettings> {
    return invoke("db:timer:updateSettings", settings);
  }
  startTimerSession(
    sessionType: SessionType,
    taskId?: string,
  ): Promise<TimerSession> {
    return invoke("db:timer:startSession", sessionType, taskId ?? null);
  }
  endTimerSession(
    id: number,
    duration: number,
    completed: boolean,
  ): Promise<TimerSession> {
    return invoke("db:timer:endSession", id, duration, completed);
  }
  fetchTimerSessions(): Promise<TimerSession[]> {
    return invoke("db:timer:fetchSessions");
  }
  fetchSessionsByTaskId(taskId: string): Promise<TimerSession[]> {
    return invoke("db:timer:fetchSessionsByTaskId", taskId);
  }

  // Pomodoro Presets
  fetchPomodoroPresets(): Promise<PomodoroPreset[]> {
    return invoke("db:timer:fetchPomodoroPresets");
  }
  createPomodoroPreset(
    preset: Omit<PomodoroPreset, "id" | "createdAt">,
  ): Promise<PomodoroPreset> {
    return invoke("db:timer:createPomodoroPreset", preset);
  }
  updatePomodoroPreset(
    id: number,
    updates: Partial<Omit<PomodoroPreset, "id" | "createdAt">>,
  ): Promise<PomodoroPreset> {
    return invoke("db:timer:updatePomodoroPreset", id, updates);
  }
  deletePomodoroPreset(id: number): Promise<void> {
    return invoke("db:timer:deletePomodoroPreset", id);
  }

  // Sound
  fetchSoundSettings(): Promise<SoundSettings[]> {
    return invoke("db:sound:fetchSettings");
  }
  updateSoundSetting(
    soundType: string,
    volume: number,
    enabled: boolean,
  ): Promise<SoundSettings> {
    return invoke("db:sound:updateSetting", soundType, volume, enabled);
  }
  fetchSoundPresets(): Promise<SoundPreset[]> {
    return invoke("db:sound:fetchPresets");
  }
  createSoundPreset(name: string, settingsJson: string): Promise<SoundPreset> {
    return invoke("db:sound:createPreset", name, settingsJson);
  }
  deleteSoundPreset(id: number): Promise<void> {
    return invoke("db:sound:deletePreset", id);
  }

  // Sound Tags
  fetchAllSoundTags(): Promise<SoundTag[]> {
    return invoke("db:sound:fetchAllSoundTags");
  }
  createSoundTag(name: string, color: string): Promise<SoundTag> {
    return invoke("db:sound:createSoundTag", name, color);
  }
  updateSoundTag(
    id: number,
    updates: { name?: string; color?: string },
  ): Promise<SoundTag> {
    return invoke("db:sound:updateSoundTag", id, updates.name, updates.color);
  }
  deleteSoundTag(id: number): Promise<void> {
    return invoke("db:sound:deleteSoundTag", id);
  }
  fetchTagsForSound(soundId: string): Promise<SoundTag[]> {
    return invoke("db:sound:fetchTagsForSound", soundId);
  }
  setTagsForSound(soundId: string, tagIds: number[]): Promise<void> {
    return invoke("db:sound:setTagsForSound", soundId, tagIds);
  }
  fetchAllSoundTagAssignments(): Promise<
    Array<{ sound_id: string; tag_id: number }>
  > {
    return invoke("db:sound:fetchAllSoundTagAssignments");
  }
  fetchAllSoundDisplayMeta(): Promise<SoundDisplayMeta[]> {
    return invoke("db:sound:fetchAllSoundDisplayMeta");
  }
  updateSoundDisplayMeta(soundId: string, displayName: string): Promise<void> {
    return invoke("db:sound:updateSoundDisplayMeta", soundId, displayName);
  }
  fetchWorkscreenSelections(): Promise<
    Array<{ soundId: string; displayOrder: number }>
  > {
    return invoke("db:sound:fetchWorkscreenSelections");
  }
  setWorkscreenSelections(soundIds: string[]): Promise<void> {
    return invoke("db:sound:setWorkscreenSelections", soundIds);
  }

  // Memo
  fetchAllMemos(): Promise<MemoNode[]> {
    return invoke("db:memo:fetchAll");
  }
  fetchMemoByDate(date: string): Promise<MemoNode | null> {
    return invoke("db:memo:fetchByDate", date);
  }
  upsertMemo(date: string, content: string): Promise<MemoNode> {
    return invoke("db:memo:upsert", date, content);
  }
  deleteMemo(date: string): Promise<void> {
    return invoke("db:memo:delete", date);
  }
  fetchDeletedMemos(): Promise<MemoNode[]> {
    return invoke("db:memo:fetchDeleted");
  }
  restoreMemo(date: string): Promise<void> {
    return invoke("db:memo:restore", date);
  }
  permanentDeleteMemo(date: string): Promise<void> {
    return invoke("db:memo:permanentDelete", date);
  }

  // Notes
  fetchAllNotes(): Promise<NoteNode[]> {
    return invoke("db:notes:fetchAll");
  }
  fetchDeletedNotes(): Promise<NoteNode[]> {
    return invoke("db:notes:fetchDeleted");
  }
  createNote(id: string, title: string): Promise<NoteNode> {
    return invoke("db:notes:create", id, title);
  }
  updateNote(
    id: string,
    updates: Partial<Pick<NoteNode, "title" | "content" | "isPinned">>,
  ): Promise<NoteNode> {
    return invoke("db:notes:update", id, updates);
  }
  softDeleteNote(id: string): Promise<void> {
    return invoke("db:notes:softDelete", id);
  }
  restoreNote(id: string): Promise<void> {
    return invoke("db:notes:restore", id);
  }
  permanentDeleteNote(id: string): Promise<void> {
    return invoke("db:notes:permanentDelete", id);
  }
  searchNotes(query: string): Promise<NoteNode[]> {
    return invoke("db:notes:search", query);
  }

  // Custom Sounds
  async saveCustomSound(
    _id: string,
    data: ArrayBuffer,
    meta: CustomSoundMeta,
  ): Promise<void> {
    await invoke("db:customSound:save", meta, data);
  }
  loadCustomSound(id: string): Promise<ArrayBuffer | null> {
    return invoke("db:customSound:load", id);
  }
  deleteCustomSound(id: string): Promise<void> {
    return invoke("db:customSound:delete", id);
  }
  fetchCustomSoundMetas(): Promise<CustomSoundMeta[]> {
    return invoke("db:customSound:fetchMetas");
  }
  fetchDeletedCustomSounds(): Promise<CustomSoundMeta[]> {
    return invoke("db:customSound:fetchDeleted");
  }
  restoreCustomSound(id: string): Promise<void> {
    return invoke("db:customSound:restore", id);
  }
  permanentDeleteCustomSound(id: string): Promise<void> {
    return invoke("db:customSound:permanentDelete", id);
  }

  // Calendars
  fetchCalendars(): Promise<CalendarNode[]> {
    return invoke("db:calendars:fetchAll");
  }
  createCalendar(
    id: string,
    title: string,
    folderId: string,
  ): Promise<CalendarNode> {
    return invoke("db:calendars:create", id, title, folderId);
  }
  updateCalendar(
    id: string,
    updates: Partial<Pick<CalendarNode, "title" | "folderId" | "order">>,
  ): Promise<CalendarNode> {
    return invoke("db:calendars:update", id, updates);
  }
  deleteCalendar(id: string): Promise<void> {
    return invoke("db:calendars:delete", id);
  }

  // Routine Tags
  fetchRoutineTags(): Promise<RoutineTag[]> {
    return invoke("db:routineTags:fetchAll");
  }
  createRoutineTag(name: string, color: string): Promise<RoutineTag> {
    return invoke("db:routineTags:create", name, color);
  }
  updateRoutineTag(
    id: number,
    updates: Partial<Pick<RoutineTag, "name" | "color" | "order">>,
  ): Promise<RoutineTag> {
    return invoke("db:routineTags:update", id, updates);
  }
  deleteRoutineTag(id: number): Promise<void> {
    return invoke("db:routineTags:delete", id);
  }
  fetchAllRoutineTagAssignments(): Promise<
    Array<{ routine_id: string; tag_id: number }>
  > {
    return invoke("db:routineTags:fetchAllAssignments");
  }
  setTagsForRoutine(routineId: string, tagIds: number[]): Promise<void> {
    return invoke("db:routineTags:setTagsForRoutine", routineId, tagIds);
  }

  // Routines
  fetchAllRoutines(): Promise<RoutineNode[]> {
    return invoke("db:routines:fetchAll");
  }
  createRoutine(
    id: string,
    title: string,
    startTime?: string,
    endTime?: string,
  ): Promise<RoutineNode> {
    return invoke("db:routines:create", id, title, startTime, endTime);
  }
  updateRoutine(
    id: string,
    updates: Partial<
      Pick<
        RoutineNode,
        "title" | "startTime" | "endTime" | "isArchived" | "order"
      >
    >,
  ): Promise<RoutineNode> {
    return invoke("db:routines:update", id, updates);
  }
  deleteRoutine(id: string): Promise<void> {
    return invoke("db:routines:delete", id);
  }
  fetchDeletedRoutines(): Promise<RoutineNode[]> {
    return invoke("db:routines:fetchDeleted");
  }
  softDeleteRoutine(id: string): Promise<void> {
    return invoke("db:routines:softDelete", id);
  }
  restoreRoutine(id: string): Promise<void> {
    return invoke("db:routines:restore", id);
  }
  permanentDeleteRoutine(id: string): Promise<void> {
    return invoke("db:routines:permanentDelete", id);
  }

  // Schedule Items
  fetchScheduleItemsByDate(date: string): Promise<ScheduleItem[]> {
    return invoke("db:scheduleItems:fetchByDate", date);
  }
  fetchScheduleItemsByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ScheduleItem[]> {
    return invoke("db:scheduleItems:fetchByDateRange", startDate, endDate);
  }
  createScheduleItem(
    id: string,
    date: string,
    title: string,
    startTime: string,
    endTime: string,
    routineId?: string,
    templateId?: string,
  ): Promise<ScheduleItem> {
    return invoke(
      "db:scheduleItems:create",
      id,
      date,
      title,
      startTime,
      endTime,
      routineId,
      templateId,
    );
  }
  updateScheduleItem(
    id: string,
    updates: Partial<
      Pick<
        ScheduleItem,
        "title" | "startTime" | "endTime" | "completed" | "completedAt"
      >
    >,
  ): Promise<ScheduleItem> {
    return invoke("db:scheduleItems:update", id, updates);
  }
  deleteScheduleItem(id: string): Promise<void> {
    return invoke("db:scheduleItems:delete", id);
  }
  toggleScheduleItemComplete(id: string): Promise<ScheduleItem> {
    return invoke("db:scheduleItems:toggleComplete", id);
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
    }>,
  ): Promise<ScheduleItem[]> {
    return invoke("db:scheduleItems:bulkCreate", items);
  }

  // Playlists
  fetchPlaylists(): Promise<Playlist[]> {
    return invoke("db:playlists:fetchAll");
  }
  createPlaylist(id: string, name: string): Promise<Playlist> {
    return invoke("db:playlists:create", id, name);
  }
  updatePlaylist(
    id: string,
    updates: Partial<
      Pick<Playlist, "name" | "sortOrder" | "repeatMode" | "isShuffle">
    >,
  ): Promise<Playlist> {
    return invoke("db:playlists:update", id, updates);
  }
  deletePlaylist(id: string): Promise<void> {
    return invoke("db:playlists:delete", id);
  }
  fetchPlaylistItems(playlistId: string): Promise<PlaylistItem[]> {
    return invoke("db:playlists:fetchItems", playlistId);
  }
  fetchAllPlaylistItems(): Promise<PlaylistItem[]> {
    return invoke("db:playlists:fetchAllItems");
  }
  addPlaylistItem(
    id: string,
    playlistId: string,
    soundId: string,
  ): Promise<PlaylistItem> {
    return invoke("db:playlists:addItem", id, playlistId, soundId);
  }
  removePlaylistItem(itemId: string): Promise<void> {
    return invoke("db:playlists:removeItem", itemId);
  }
  reorderPlaylistItems(playlistId: string, itemIds: string[]): Promise<void> {
    return invoke("db:playlists:reorderItems", playlistId, itemIds);
  }

  // Wiki Tags
  fetchWikiTags(): Promise<WikiTag[]> {
    return invoke("db:wikiTags:fetchAll");
  }
  searchWikiTags(query: string): Promise<WikiTag[]> {
    return invoke("db:wikiTags:search", query);
  }
  createWikiTag(name: string, color: string): Promise<WikiTag> {
    return invoke("db:wikiTags:create", name, color);
  }
  updateWikiTag(
    id: string,
    updates: Partial<Pick<WikiTag, "name" | "color">>,
  ): Promise<WikiTag> {
    return invoke("db:wikiTags:update", id, updates);
  }
  deleteWikiTag(id: string): Promise<void> {
    return invoke("db:wikiTags:delete", id);
  }
  mergeWikiTags(sourceId: string, targetId: string): Promise<WikiTag> {
    return invoke("db:wikiTags:merge", sourceId, targetId);
  }
  fetchWikiTagsForEntity(entityId: string): Promise<WikiTag[]> {
    return invoke("db:wikiTags:fetchForEntity", entityId);
  }
  setWikiTagsForEntity(
    entityId: string,
    entityType: string,
    tagIds: string[],
  ): Promise<void> {
    return invoke("db:wikiTags:setForEntity", entityId, entityType, tagIds);
  }
  syncInlineWikiTags(
    entityId: string,
    entityType: string,
    tagNames: string[],
  ): Promise<void> {
    return invoke("db:wikiTags:syncInline", entityId, entityType, tagNames);
  }
  fetchAllWikiTagAssignments(): Promise<WikiTagAssignment[]> {
    return invoke("db:wikiTags:fetchAllAssignments");
  }

  // Data I/O
  exportData(): Promise<boolean> {
    return invoke("data:export");
  }
  importData(): Promise<boolean> {
    return invoke("data:import");
  }
  resetData(): Promise<boolean> {
    return invoke("data:reset");
  }

  // Diagnostics
  fetchLogs(options?: { level?: string; limit?: number }): Promise<LogEntry[]> {
    return invoke("diagnostics:fetchLogs", options);
  }
  openLogFolder(): Promise<void> {
    return invoke("diagnostics:openLogFolder");
  }
  exportLogs(): Promise<boolean> {
    return invoke("diagnostics:exportLogs");
  }
  fetchMetrics(): Promise<IpcChannelMetrics[]> {
    return invoke("diagnostics:fetchMetrics");
  }
  resetMetrics(): Promise<boolean> {
    return invoke("diagnostics:resetMetrics");
  }
  fetchSystemInfo(): Promise<SystemInfo> {
    return invoke("diagnostics:fetchSystemInfo");
  }

  // Updater
  checkForUpdates(): Promise<void> {
    return invoke("updater:checkForUpdates");
  }
  downloadUpdate(): Promise<void> {
    return invoke("updater:downloadUpdate");
  }
  installUpdate(): Promise<void> {
    return invoke("updater:installUpdate");
  }
}
