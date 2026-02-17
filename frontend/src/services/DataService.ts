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
import type {
  AIAdviceRequest,
  AIAdviceResponse,
  AISettingsResponse,
} from "../types/ai";
import type { CustomSoundMeta } from "../types/customSound";
import type { NoteNode } from "../types/note";

import type { CalendarNode } from "../types/calendar";
import type { RoutineNode } from "../types/routine";
import type { ScheduleItem, RoutineTemplate } from "../types/schedule";
import type { Playlist, PlaylistItem } from "../types/playlist";
import type {
  LogEntry,
  IpcChannelMetrics,
  SystemInfo,
} from "../types/diagnostics";

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
  fetchSoundPresets(): Promise<SoundPreset[]>;
  createSoundPreset(name: string, settingsJson: string): Promise<SoundPreset>;
  deleteSoundPreset(id: number): Promise<void>;

  // Sound Tags
  fetchAllSoundTags(): Promise<SoundTag[]>;
  createSoundTag(name: string, color: string): Promise<SoundTag>;
  updateSoundTag(
    id: number,
    updates: { name?: string; color?: string },
  ): Promise<SoundTag>;
  deleteSoundTag(id: number): Promise<void>;
  fetchTagsForSound(soundId: string): Promise<SoundTag[]>;
  setTagsForSound(soundId: string, tagIds: number[]): Promise<void>;
  fetchAllSoundTagAssignments(): Promise<
    Array<{ sound_id: string; tag_id: number }>
  >;
  fetchAllSoundDisplayMeta(): Promise<SoundDisplayMeta[]>;
  updateSoundDisplayMeta(soundId: string, displayName: string): Promise<void>;
  fetchWorkscreenSelections(): Promise<
    Array<{ soundId: string; displayOrder: number }>
  >;
  setWorkscreenSelections(soundIds: string[]): Promise<void>;

  // Memo
  fetchAllMemos(): Promise<MemoNode[]>;
  fetchMemoByDate(date: string): Promise<MemoNode | null>;
  upsertMemo(date: string, content: string): Promise<MemoNode>;
  deleteMemo(date: string): Promise<void>;

  // Notes
  fetchAllNotes(): Promise<NoteNode[]>;
  fetchDeletedNotes(): Promise<NoteNode[]>;
  createNote(id: string, title: string): Promise<NoteNode>;
  updateNote(
    id: string,
    updates: Partial<Pick<NoteNode, "title" | "content" | "isPinned">>,
  ): Promise<NoteNode>;
  softDeleteNote(id: string): Promise<void>;
  restoreNote(id: string): Promise<void>;
  permanentDeleteNote(id: string): Promise<void>;
  searchNotes(query: string): Promise<NoteNode[]>;

  // Custom Sounds
  saveCustomSound(
    id: string,
    data: ArrayBuffer,
    meta: CustomSoundMeta,
  ): Promise<void>;
  loadCustomSound(id: string): Promise<ArrayBuffer | null>;
  deleteCustomSound(id: string): Promise<void>;
  fetchCustomSoundMetas(): Promise<CustomSoundMeta[]>;

  // AI
  fetchAIAdvice(request: AIAdviceRequest): Promise<AIAdviceResponse>;
  fetchAISettings(): Promise<AISettingsResponse>;
  updateAISettings(settings: {
    apiKey?: string;
    model?: string;
  }): Promise<AISettingsResponse>;

  // Calendars
  fetchCalendars(): Promise<CalendarNode[]>;
  createCalendar(
    id: string,
    title: string,
    folderId: string,
  ): Promise<CalendarNode>;
  updateCalendar(
    id: string,
    updates: Partial<Pick<CalendarNode, "title" | "folderId" | "order">>,
  ): Promise<CalendarNode>;
  deleteCalendar(id: string): Promise<void>;

  // Routines
  fetchAllRoutines(): Promise<RoutineNode[]>;
  createRoutine(
    id: string,
    title: string,
    startTime?: string,
    endTime?: string,
  ): Promise<RoutineNode>;
  updateRoutine(
    id: string,
    updates: Partial<
      Pick<
        RoutineNode,
        "title" | "startTime" | "endTime" | "isArchived" | "order"
      >
    >,
  ): Promise<RoutineNode>;
  deleteRoutine(id: string): Promise<void>;

  // Routine Templates
  fetchRoutineTemplates(): Promise<RoutineTemplate[]>;
  createRoutineTemplate(
    id: string,
    name: string,
    frequencyType?: string,
    frequencyDays?: number[],
  ): Promise<RoutineTemplate>;
  updateRoutineTemplate(
    id: string,
    updates: Partial<
      Pick<
        RoutineTemplate,
        "name" | "frequencyType" | "frequencyDays" | "order"
      >
    >,
  ): Promise<RoutineTemplate>;
  deleteRoutineTemplate(id: string): Promise<void>;
  addRoutineTemplateItem(templateId: string, routineId: string): Promise<void>;
  removeRoutineTemplateItem(
    templateId: string,
    routineId: string,
  ): Promise<void>;
  reorderRoutineTemplateItems(
    templateId: string,
    routineIds: string[],
  ): Promise<void>;

  // Schedule Items
  fetchScheduleItemsByDate(date: string): Promise<ScheduleItem[]>;
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
  ): Promise<ScheduleItem>;
  updateScheduleItem(
    id: string,
    updates: Partial<
      Pick<
        ScheduleItem,
        "title" | "startTime" | "endTime" | "completed" | "completedAt"
      >
    >,
  ): Promise<ScheduleItem>;
  deleteScheduleItem(id: string): Promise<void>;
  toggleScheduleItemComplete(id: string): Promise<ScheduleItem>;
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
  ): Promise<ScheduleItem[]>;

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

  // Data I/O
  exportData(): Promise<boolean>;
  importData(): Promise<boolean>;
  resetData(): Promise<boolean>;

  // Diagnostics
  fetchLogs(options?: { level?: string; limit?: number }): Promise<LogEntry[]>;
  openLogFolder(): Promise<void>;
  exportLogs(): Promise<boolean>;
  fetchMetrics(): Promise<IpcChannelMetrics[]>;
  resetMetrics(): Promise<boolean>;
  fetchSystemInfo(): Promise<SystemInfo>;

  // Updater
  checkForUpdates(): Promise<void>;
  downloadUpdate(): Promise<void>;
  installUpdate(): Promise<void>;
}
