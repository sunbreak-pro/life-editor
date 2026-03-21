import type { DataService } from "./DataService";
import type { PaperBoard, PaperNode, PaperEdge } from "../types/paperBoard";
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

import { notSupported } from "./notSupported";

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

  // Timer
  fetchTimerSettings(): Promise<TimerSettings> {
    return get("/api/timer/settings");
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
    return patch("/api/timer/settings", settings);
  }
  startTimerSession(
    sessionType: SessionType,
    taskId?: string,
  ): Promise<TimerSession> {
    return post("/api/timer/sessions/start", { sessionType, taskId });
  }
  endTimerSession(
    id: number,
    duration: number,
    completed: boolean,
  ): Promise<TimerSession> {
    return post(`/api/timer/sessions/${id}/end`, { duration, completed });
  }
  fetchTimerSessions(): Promise<TimerSession[]> {
    return get("/api/timer/sessions");
  }
  fetchSessionsByTaskId(taskId: string): Promise<TimerSession[]> {
    return get(`/api/timer/sessions/by-task/${taskId}`);
  }

  // Pomodoro Presets
  fetchPomodoroPresets(): Promise<PomodoroPreset[]> {
    return get("/api/timer/presets");
  }
  createPomodoroPreset(
    preset: Omit<PomodoroPreset, "id" | "createdAt">,
  ): Promise<PomodoroPreset> {
    return post("/api/timer/presets", preset);
  }
  updatePomodoroPreset(
    id: number,
    updates: Partial<Omit<PomodoroPreset, "id" | "createdAt">>,
  ): Promise<PomodoroPreset> {
    return patch(`/api/timer/presets/${id}`, updates);
  }
  deletePomodoroPreset(id: number): Promise<void> {
    return del(`/api/timer/presets/${id}`);
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

  // Calendars
  fetchCalendars(): Promise<CalendarNode[]> {
    return get("/api/calendars");
  }
  createCalendar(
    id: string,
    title: string,
    folderId: string,
  ): Promise<CalendarNode> {
    return post("/api/calendars", { id, title, folderId });
  }
  updateCalendar(
    id: string,
    updates: Partial<Pick<CalendarNode, "title" | "folderId" | "order">>,
  ): Promise<CalendarNode> {
    return patch(`/api/calendars/${id}`, updates);
  }
  deleteCalendar(id: string): Promise<void> {
    return del(`/api/calendars/${id}`);
  }

  // Routine Tags
  fetchRoutineTags(): Promise<RoutineTag[]> {
    return get("/api/routine-tags");
  }
  createRoutineTag(name: string, color: string): Promise<RoutineTag> {
    return post("/api/routine-tags", { name, color });
  }
  updateRoutineTag(
    id: number,
    updates: Partial<
      Pick<RoutineTag, "name" | "color" | "textColor" | "order">
    >,
  ): Promise<RoutineTag> {
    return patch(`/api/routine-tags/${id}`, updates);
  }
  deleteRoutineTag(id: number): Promise<void> {
    return del(`/api/routine-tags/${id}`);
  }
  fetchAllRoutineTagAssignments(): Promise<
    Array<{ routine_id: string; tag_id: number }>
  > {
    return get("/api/routine-tags/assignments");
  }
  setTagsForRoutine(routineId: string, tagIds: number[]): Promise<void> {
    return put(`/api/routine-tags/routines/${routineId}`, { tagIds });
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
  dismissScheduleItem(id: string): Promise<void> {
    return del(`/api/schedule-items/${id}/dismiss`);
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

  // Playlists
  fetchPlaylists(): Promise<Playlist[]> {
    return get("/api/playlists");
  }
  createPlaylist(id: string, name: string): Promise<Playlist> {
    return post("/api/playlists", { id, name });
  }
  updatePlaylist(
    id: string,
    updates: Partial<
      Pick<Playlist, "name" | "sortOrder" | "repeatMode" | "isShuffle">
    >,
  ): Promise<Playlist> {
    return patch(`/api/playlists/${id}`, updates);
  }
  deletePlaylist(id: string): Promise<void> {
    return del(`/api/playlists/${id}`);
  }
  fetchPlaylistItems(playlistId: string): Promise<PlaylistItem[]> {
    return get(`/api/playlists/${playlistId}/items`);
  }
  fetchAllPlaylistItems(): Promise<PlaylistItem[]> {
    return get("/api/playlists/items/all");
  }
  addPlaylistItem(
    id: string,
    playlistId: string,
    soundId: string,
  ): Promise<PlaylistItem> {
    return post(`/api/playlists/${playlistId}/items`, { id, soundId });
  }
  removePlaylistItem(itemId: string): Promise<void> {
    return del(`/api/playlists/items/${itemId}`);
  }
  reorderPlaylistItems(playlistId: string, itemIds: string[]): Promise<void> {
    return put(`/api/playlists/${playlistId}/items/reorder`, { itemIds });
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

  // Wiki Tag Groups
  fetchWikiTagGroups(): Promise<WikiTagGroup[]> {
    return get("/api/wiki-tag-groups");
  }
  createWikiTagGroup(
    name: string,
    noteIds: string[],
    filterTags?: string[],
  ): Promise<WikiTagGroup> {
    return post("/api/wiki-tag-groups", { name, noteIds, filterTags });
  }
  updateWikiTagGroup(
    id: string,
    updates: { name?: string; filterTags?: string[] },
  ): Promise<WikiTagGroup> {
    return patch(`/api/wiki-tag-groups/${id}`, updates);
  }
  deleteWikiTagGroup(id: string): Promise<void> {
    return del(`/api/wiki-tag-groups/${id}`);
  }
  fetchAllWikiTagGroupMembers(): Promise<WikiTagGroupMember[]> {
    return get("/api/wiki-tag-groups/members");
  }
  setWikiTagGroupMembers(groupId: string, noteIds: string[]): Promise<void> {
    return put(`/api/wiki-tag-groups/${groupId}/members`, { noteIds });
  }
  addWikiTagGroupMember(groupId: string, noteId: string): Promise<void> {
    return post(`/api/wiki-tag-groups/${groupId}/members`, { noteId });
  }
  removeWikiTagGroupMember(groupId: string, noteId: string): Promise<void> {
    return del(`/api/wiki-tag-groups/${groupId}/members/${noteId}`);
  }

  // Wiki Tag Connections
  fetchWikiTagConnections(): Promise<WikiTagConnection[]> {
    return get("/api/wiki-tag-connections");
  }
  createWikiTagConnection(
    sourceTagId: string,
    targetTagId: string,
  ): Promise<WikiTagConnection> {
    return post("/api/wiki-tag-connections", { sourceTagId, targetTagId });
  }
  deleteWikiTagConnection(id: string): Promise<void> {
    return del(`/api/wiki-tag-connections/${id}`);
  }
  deleteWikiTagConnectionByPair(
    sourceTagId: string,
    targetTagId: string,
  ): Promise<void> {
    return post("/api/wiki-tag-connections/delete-by-pair", {
      sourceTagId,
      targetTagId,
    });
  }

  // Note Connections
  fetchNoteConnections(): Promise<NoteConnection[]> {
    return get("/api/note-connections");
  }
  createNoteConnection(
    sourceNoteId: string,
    targetNoteId: string,
  ): Promise<NoteConnection> {
    return post("/api/note-connections", { sourceNoteId, targetNoteId });
  }
  deleteNoteConnection(id: string): Promise<void> {
    return del(`/api/note-connections/${id}`);
  }
  deleteNoteConnectionByPair(
    sourceNoteId: string,
    targetNoteId: string,
  ): Promise<void> {
    return post("/api/note-connections/delete-by-pair", {
      sourceNoteId,
      targetNoteId,
    });
  }

  // Time Memos
  fetchTimeMemosByDate(date: string): Promise<TimeMemo[]> {
    return get(`/api/time-memos/${date}`);
  }
  upsertTimeMemo(
    id: string,
    date: string,
    hour: number,
    content: string,
  ): Promise<TimeMemo> {
    return put("/api/time-memos", { id, date, hour, content });
  }
  deleteTimeMemo(id: string): Promise<void> {
    return del(`/api/time-memos/${id}`);
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

  // Paper Boards — not available on mobile
  fetchPaperBoards(): Promise<PaperBoard[]> {
    return notSupported("Paper Boards");
  }
  fetchPaperBoardById(_id: string): Promise<PaperBoard | null> {
    return notSupported("Paper Boards");
  }
  fetchPaperBoardByNoteId(_noteId: string): Promise<PaperBoard | null> {
    return notSupported("Paper Boards");
  }
  createPaperBoard(
    _name: string,
    _linkedNoteId?: string | null,
  ): Promise<PaperBoard> {
    return notSupported("Paper Boards");
  }
  updatePaperBoard(
    _id: string,
    _updates: Partial<
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
    return notSupported("Paper Boards");
  }
  deletePaperBoard(_id: string): Promise<void> {
    return notSupported("Paper Boards");
  }
  fetchPaperNodeCountsByBoard(): Promise<Record<string, number>> {
    return Promise.resolve({});
  }
  fetchPaperNodesByBoard(_boardId: string): Promise<PaperNode[]> {
    return notSupported("Paper Boards");
  }
  createPaperNode(_params: {
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
  }): Promise<PaperNode> {
    return notSupported("Paper Boards");
  }
  updatePaperNode(
    _id: string,
    _updates: Partial<
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
      >
    >,
  ): Promise<PaperNode> {
    return notSupported("Paper Boards");
  }
  bulkUpdatePaperNodePositions(
    _updates: Array<{
      id: string;
      positionX: number;
      positionY: number;
      parentNodeId: string | null;
    }>,
  ): Promise<void> {
    return notSupported("Paper Boards");
  }
  deletePaperNode(_id: string): Promise<void> {
    return notSupported("Paper Boards");
  }
  fetchPaperEdgesByBoard(_boardId: string): Promise<PaperEdge[]> {
    return notSupported("Paper Boards");
  }
  createPaperEdge(_params: {
    boardId: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    label?: string | null;
    styleJson?: string | null;
  }): Promise<PaperEdge> {
    return notSupported("Paper Boards");
  }
  deletePaperEdge(_id: string): Promise<void> {
    return notSupported("Paper Boards");
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
