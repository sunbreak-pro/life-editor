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
import type {
  WikiTag,
  WikiTagAssignment,
  WikiTagConnection,
  WikiTagGroup,
  WikiTagGroupMember,
  NoteConnection,
} from "../types/wikiTag";
import type { TimeMemo } from "../types/timeMemo";
import { apiFetch } from "../config/api";

async function get<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

async function put<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "PUT",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
  return res.json();
}

async function patch<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status}`);
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
  return res.json();
}

function notSupported(feature: string): never {
  throw new Error(`${feature} is not supported on mobile`);
}

export class RestDataService implements DataService {
  // Tasks
  fetchTaskTree(): Promise<TaskNode[]> {
    return get("/api/tasks");
  }
  fetchDeletedTasks(): Promise<TaskNode[]> {
    return get("/api/tasks/deleted");
  }
  createTask(node: TaskNode): Promise<TaskNode> {
    return post("/api/tasks", node);
  }
  updateTask(id: string, updates: Partial<TaskNode>): Promise<TaskNode> {
    return patch(`/api/tasks/${id}`, updates);
  }
  syncTaskTree(nodes: TaskNode[]): Promise<void> {
    return put("/api/tasks/sync", nodes);
  }
  softDeleteTask(id: string): Promise<void> {
    return del(`/api/tasks/${id}`);
  }
  restoreTask(id: string): Promise<void> {
    return post(`/api/tasks/${id}/restore`);
  }
  permanentDeleteTask(id: string): Promise<void> {
    return del(`/api/tasks/${id}/permanent`);
  }
  migrateTasksToBackend(): Promise<void> {
    return notSupported("migrateTasksToBackend");
  }

  // Timer — not available on mobile (Phase 2)
  fetchTimerSettings(): Promise<TimerSettings> {
    return notSupported("Timer");
  }
  updateTimerSettings(
    _settings: Partial<
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
    return notSupported("Timer");
  }
  startTimerSession(
    _sessionType: SessionType,
    _taskId?: string,
  ): Promise<TimerSession> {
    return notSupported("Timer");
  }
  endTimerSession(
    _id: number,
    _duration: number,
    _completed: boolean,
  ): Promise<TimerSession> {
    return notSupported("Timer");
  }
  fetchTimerSessions(): Promise<TimerSession[]> {
    return notSupported("Timer");
  }
  fetchSessionsByTaskId(_taskId: string): Promise<TimerSession[]> {
    return notSupported("Timer");
  }

  // Pomodoro Presets — not available on mobile
  fetchPomodoroPresets(): Promise<PomodoroPreset[]> {
    return notSupported("Pomodoro");
  }
  createPomodoroPreset(
    _preset: Omit<PomodoroPreset, "id" | "createdAt">,
  ): Promise<PomodoroPreset> {
    return notSupported("Pomodoro");
  }
  updatePomodoroPreset(
    _id: number,
    _updates: Partial<Omit<PomodoroPreset, "id" | "createdAt">>,
  ): Promise<PomodoroPreset> {
    return notSupported("Pomodoro");
  }
  deletePomodoroPreset(_id: number): Promise<void> {
    return notSupported("Pomodoro");
  }

  // Sound — not available on mobile
  fetchSoundSettings(): Promise<SoundSettings[]> {
    return notSupported("Sound");
  }
  updateSoundSetting(
    _soundType: string,
    _volume: number,
    _enabled: boolean,
  ): Promise<SoundSettings> {
    return notSupported("Sound");
  }
  fetchSoundPresets(): Promise<SoundPreset[]> {
    return notSupported("Sound");
  }
  createSoundPreset(
    _name: string,
    _settingsJson: string,
  ): Promise<SoundPreset> {
    return notSupported("Sound");
  }
  deleteSoundPreset(_id: number): Promise<void> {
    return notSupported("Sound");
  }

  // Sound Tags — not available on mobile
  fetchAllSoundTags(): Promise<SoundTag[]> {
    return notSupported("Sound");
  }
  createSoundTag(_name: string, _color: string): Promise<SoundTag> {
    return notSupported("Sound");
  }
  updateSoundTag(
    _id: number,
    _updates: { name?: string; color?: string; textColor?: string | null },
  ): Promise<SoundTag> {
    return notSupported("Sound");
  }
  deleteSoundTag(_id: number): Promise<void> {
    return notSupported("Sound");
  }
  fetchTagsForSound(_soundId: string): Promise<SoundTag[]> {
    return notSupported("Sound");
  }
  setTagsForSound(_soundId: string, _tagIds: number[]): Promise<void> {
    return notSupported("Sound");
  }
  fetchAllSoundTagAssignments(): Promise<
    Array<{ sound_id: string; tag_id: number }>
  > {
    return notSupported("Sound");
  }
  fetchAllSoundDisplayMeta(): Promise<SoundDisplayMeta[]> {
    return notSupported("Sound");
  }
  updateSoundDisplayMeta(
    _soundId: string,
    _displayName: string,
  ): Promise<void> {
    return notSupported("Sound");
  }
  fetchWorkscreenSelections(): Promise<
    Array<{ soundId: string; displayOrder: number }>
  > {
    return notSupported("Sound");
  }
  setWorkscreenSelections(_soundIds: string[]): Promise<void> {
    return notSupported("Sound");
  }

  // Memo
  fetchAllMemos(): Promise<MemoNode[]> {
    return get("/api/memos");
  }
  fetchMemoByDate(date: string): Promise<MemoNode | null> {
    return get(`/api/memos/${date}`);
  }
  upsertMemo(date: string, content: string): Promise<MemoNode> {
    return put(`/api/memos/${date}`, { content });
  }
  deleteMemo(date: string): Promise<void> {
    return del(`/api/memos/${date}`);
  }
  fetchDeletedMemos(): Promise<MemoNode[]> {
    return get("/api/memos/deleted");
  }
  restoreMemo(date: string): Promise<void> {
    return post(`/api/memos/${date}/restore`);
  }
  permanentDeleteMemo(date: string): Promise<void> {
    return del(`/api/memos/${date}/permanent`);
  }
  toggleMemoPin(date: string): Promise<MemoNode> {
    return post(`/api/memos/${date}/toggle-pin`);
  }

  // Notes
  fetchAllNotes(): Promise<NoteNode[]> {
    return get("/api/notes");
  }
  fetchDeletedNotes(): Promise<NoteNode[]> {
    return get("/api/notes/deleted");
  }
  createNote(id: string, title: string): Promise<NoteNode> {
    return post("/api/notes", { id, title });
  }
  updateNote(
    id: string,
    updates: Partial<
      Pick<NoteNode, "title" | "content" | "isPinned" | "color">
    >,
  ): Promise<NoteNode> {
    return patch(`/api/notes/${id}`, updates);
  }
  softDeleteNote(id: string): Promise<void> {
    return del(`/api/notes/${id}`);
  }
  restoreNote(id: string): Promise<void> {
    return post(`/api/notes/${id}/restore`);
  }
  permanentDeleteNote(id: string): Promise<void> {
    return del(`/api/notes/${id}/permanent`);
  }
  searchNotes(query: string): Promise<NoteNode[]> {
    return get(`/api/notes/search?q=${encodeURIComponent(query)}`);
  }

  // Custom Sounds — not available on mobile
  saveCustomSound(
    _id: string,
    _data: ArrayBuffer,
    _meta: CustomSoundMeta,
  ): Promise<void> {
    return notSupported("Custom Sound");
  }
  loadCustomSound(_id: string): Promise<ArrayBuffer | null> {
    return notSupported("Custom Sound");
  }
  deleteCustomSound(_id: string): Promise<void> {
    return notSupported("Custom Sound");
  }
  fetchCustomSoundMetas(): Promise<CustomSoundMeta[]> {
    return notSupported("Custom Sound");
  }
  fetchDeletedCustomSounds(): Promise<CustomSoundMeta[]> {
    return notSupported("Custom Sound");
  }
  restoreCustomSound(_id: string): Promise<void> {
    return notSupported("Custom Sound");
  }
  permanentDeleteCustomSound(_id: string): Promise<void> {
    return notSupported("Custom Sound");
  }

  // Calendars — Phase 2
  fetchCalendars(): Promise<CalendarNode[]> {
    return notSupported("Calendars");
  }
  createCalendar(
    _id: string,
    _title: string,
    _folderId: string,
  ): Promise<CalendarNode> {
    return notSupported("Calendars");
  }
  updateCalendar(
    _id: string,
    _updates: Partial<Pick<CalendarNode, "title" | "folderId" | "order">>,
  ): Promise<CalendarNode> {
    return notSupported("Calendars");
  }
  deleteCalendar(_id: string): Promise<void> {
    return notSupported("Calendars");
  }

  // Routine Tags — Phase 2
  fetchRoutineTags(): Promise<RoutineTag[]> {
    return notSupported("Routine Tags");
  }
  createRoutineTag(_name: string, _color: string): Promise<RoutineTag> {
    return notSupported("Routine Tags");
  }
  updateRoutineTag(
    _id: number,
    _updates: Partial<
      Pick<RoutineTag, "name" | "color" | "textColor" | "order">
    >,
  ): Promise<RoutineTag> {
    return notSupported("Routine Tags");
  }
  deleteRoutineTag(_id: number): Promise<void> {
    return notSupported("Routine Tags");
  }
  fetchAllRoutineTagAssignments(): Promise<
    Array<{ routine_id: string; tag_id: number }>
  > {
    return notSupported("Routine Tags");
  }
  setTagsForRoutine(_routineId: string, _tagIds: number[]): Promise<void> {
    return notSupported("Routine Tags");
  }

  // Routines
  fetchAllRoutines(): Promise<RoutineNode[]> {
    return get("/api/routines");
  }
  createRoutine(
    id: string,
    title: string,
    startTime?: string,
    endTime?: string,
  ): Promise<RoutineNode> {
    return post("/api/routines", { id, title, startTime, endTime });
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
    return patch(`/api/routines/${id}`, updates);
  }
  deleteRoutine(id: string): Promise<void> {
    return del(`/api/routines/${id}`);
  }
  fetchDeletedRoutines(): Promise<RoutineNode[]> {
    return get("/api/routines/deleted");
  }
  softDeleteRoutine(id: string): Promise<void> {
    return del(`/api/routines/${id}`);
  }
  restoreRoutine(id: string): Promise<void> {
    return post(`/api/routines/${id}/restore`);
  }
  permanentDeleteRoutine(id: string): Promise<void> {
    return del(`/api/routines/${id}/permanent`);
  }

  // Schedule Items
  fetchScheduleItemsByDate(date: string): Promise<ScheduleItem[]> {
    return get(`/api/schedule-items/by-date/${date}`);
  }
  fetchScheduleItemsByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ScheduleItem[]> {
    return get(
      `/api/schedule-items/by-date-range?start=${startDate}&end=${endDate}`,
    );
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
    return post("/api/schedule-items", {
      id,
      date,
      title,
      startTime,
      endTime,
      routineId,
      templateId,
    });
  }
  updateScheduleItem(
    id: string,
    updates: Partial<
      Pick<
        ScheduleItem,
        "title" | "startTime" | "endTime" | "completed" | "completedAt" | "memo"
      >
    >,
  ): Promise<ScheduleItem> {
    return patch(`/api/schedule-items/${id}`, updates);
  }
  deleteScheduleItem(id: string): Promise<void> {
    return del(`/api/schedule-items/${id}`);
  }
  toggleScheduleItemComplete(id: string): Promise<ScheduleItem> {
    return post(`/api/schedule-items/${id}/toggle-complete`);
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
    return post("/api/schedule-items/bulk", items);
  }

  // Playlists — not available on mobile
  fetchPlaylists(): Promise<Playlist[]> {
    return notSupported("Playlists");
  }
  createPlaylist(_id: string, _name: string): Promise<Playlist> {
    return notSupported("Playlists");
  }
  updatePlaylist(
    _id: string,
    _updates: Partial<
      Pick<Playlist, "name" | "sortOrder" | "repeatMode" | "isShuffle">
    >,
  ): Promise<Playlist> {
    return notSupported("Playlists");
  }
  deletePlaylist(_id: string): Promise<void> {
    return notSupported("Playlists");
  }
  fetchPlaylistItems(_playlistId: string): Promise<PlaylistItem[]> {
    return notSupported("Playlists");
  }
  fetchAllPlaylistItems(): Promise<PlaylistItem[]> {
    return notSupported("Playlists");
  }
  addPlaylistItem(
    _id: string,
    _playlistId: string,
    _soundId: string,
  ): Promise<PlaylistItem> {
    return notSupported("Playlists");
  }
  removePlaylistItem(_itemId: string): Promise<void> {
    return notSupported("Playlists");
  }
  reorderPlaylistItems(_playlistId: string, _itemIds: string[]): Promise<void> {
    return notSupported("Playlists");
  }

  // Wiki Tags
  fetchWikiTags(): Promise<WikiTag[]> {
    return get("/api/wiki-tags");
  }
  searchWikiTags(query: string): Promise<WikiTag[]> {
    return get(`/api/wiki-tags/search?q=${encodeURIComponent(query)}`);
  }
  createWikiTag(name: string, color: string): Promise<WikiTag> {
    return post("/api/wiki-tags", { name, color });
  }
  createWikiTagWithId(
    id: string,
    name: string,
    color: string,
  ): Promise<WikiTag> {
    return post("/api/wiki-tags/with-id", { id, name, color });
  }
  updateWikiTag(
    id: string,
    updates: Partial<Pick<WikiTag, "name" | "color" | "textColor">>,
  ): Promise<WikiTag> {
    return patch(`/api/wiki-tags/${id}`, updates);
  }
  deleteWikiTag(id: string): Promise<void> {
    return del(`/api/wiki-tags/${id}`);
  }
  mergeWikiTags(sourceId: string, targetId: string): Promise<WikiTag> {
    return post("/api/wiki-tags/merge", { sourceId, targetId });
  }
  fetchWikiTagsForEntity(entityId: string): Promise<WikiTag[]> {
    return get(`/api/wiki-tags/entity/${entityId}`);
  }
  setWikiTagsForEntity(
    entityId: string,
    entityType: string,
    tagIds: string[],
  ): Promise<void> {
    return put(`/api/wiki-tags/entity/${entityId}`, { entityType, tagIds });
  }
  syncInlineWikiTags(
    entityId: string,
    entityType: string,
    tagNames: string[],
  ): Promise<void> {
    return post(`/api/wiki-tags/entity/${entityId}/sync-inline`, {
      entityType,
      tagNames,
    });
  }
  fetchAllWikiTagAssignments(): Promise<WikiTagAssignment[]> {
    return get("/api/wiki-tags/assignments");
  }
  restoreWikiTagAssignment(
    tagId: string,
    entityId: string,
    entityType: string,
    source: string,
  ): Promise<void> {
    return post("/api/wiki-tags/restore-assignment", {
      tagId,
      entityId,
      entityType,
      source,
    });
  }

  // Wiki Tag Groups — Phase 2
  fetchWikiTagGroups(): Promise<WikiTagGroup[]> {
    return notSupported("Wiki Tag Groups");
  }
  createWikiTagGroup(
    _name: string,
    _noteIds: string[],
    _filterTags?: string[],
  ): Promise<WikiTagGroup> {
    return notSupported("Wiki Tag Groups");
  }
  updateWikiTagGroup(
    _id: string,
    _updates: { name?: string; filterTags?: string[] },
  ): Promise<WikiTagGroup> {
    return notSupported("Wiki Tag Groups");
  }
  deleteWikiTagGroup(_id: string): Promise<void> {
    return notSupported("Wiki Tag Groups");
  }
  fetchAllWikiTagGroupMembers(): Promise<WikiTagGroupMember[]> {
    return notSupported("Wiki Tag Groups");
  }
  setWikiTagGroupMembers(_groupId: string, _noteIds: string[]): Promise<void> {
    return notSupported("Wiki Tag Groups");
  }
  addWikiTagGroupMember(_groupId: string, _noteId: string): Promise<void> {
    return notSupported("Wiki Tag Groups");
  }
  removeWikiTagGroupMember(_groupId: string, _noteId: string): Promise<void> {
    return notSupported("Wiki Tag Groups");
  }

  // Wiki Tag Connections — Phase 2
  fetchWikiTagConnections(): Promise<WikiTagConnection[]> {
    return notSupported("Wiki Tag Connections");
  }
  createWikiTagConnection(
    _sourceTagId: string,
    _targetTagId: string,
  ): Promise<WikiTagConnection> {
    return notSupported("Wiki Tag Connections");
  }
  deleteWikiTagConnection(_id: string): Promise<void> {
    return notSupported("Wiki Tag Connections");
  }
  deleteWikiTagConnectionByPair(
    _sourceTagId: string,
    _targetTagId: string,
  ): Promise<void> {
    return notSupported("Wiki Tag Connections");
  }

  // Note Connections — Phase 2
  fetchNoteConnections(): Promise<NoteConnection[]> {
    return notSupported("Note Connections");
  }
  createNoteConnection(
    _sourceNoteId: string,
    _targetNoteId: string,
  ): Promise<NoteConnection> {
    return notSupported("Note Connections");
  }
  deleteNoteConnection(_id: string): Promise<void> {
    return notSupported("Note Connections");
  }
  deleteNoteConnectionByPair(
    _sourceNoteId: string,
    _targetNoteId: string,
  ): Promise<void> {
    return notSupported("Note Connections");
  }

  // Time Memos
  fetchTimeMemosByDate(_date: string): Promise<TimeMemo[]> {
    return notSupported("Time Memos");
  }
  upsertTimeMemo(
    _id: string,
    _date: string,
    _hour: number,
    _content: string,
  ): Promise<TimeMemo> {
    return notSupported("Time Memos");
  }
  deleteTimeMemo(_id: string): Promise<void> {
    return notSupported("Time Memos");
  }

  // Data I/O — not available on mobile
  exportData(): Promise<boolean> {
    return notSupported("Data I/O");
  }
  importData(): Promise<boolean> {
    return notSupported("Data I/O");
  }
  resetData(): Promise<boolean> {
    return notSupported("Data I/O");
  }

  // Diagnostics — not available on mobile
  fetchLogs(_options?: {
    level?: string;
    limit?: number;
  }): Promise<LogEntry[]> {
    return notSupported("Diagnostics");
  }
  openLogFolder(): Promise<void> {
    return notSupported("Diagnostics");
  }
  exportLogs(): Promise<boolean> {
    return notSupported("Diagnostics");
  }
  fetchMetrics(): Promise<IpcChannelMetrics[]> {
    return notSupported("Diagnostics");
  }
  resetMetrics(): Promise<boolean> {
    return notSupported("Diagnostics");
  }
  fetchSystemInfo(): Promise<SystemInfo> {
    return notSupported("Diagnostics");
  }

  // Updater — not available on mobile
  checkForUpdates(): Promise<void> {
    return notSupported("Updater");
  }
  downloadUpdate(): Promise<void> {
    return notSupported("Updater");
  }
  installUpdate(): Promise<void> {
    return notSupported("Updater");
  }
}
