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
    updates: { name?: string; color?: string; textColor?: string | null },
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
  fetchDeletedMemos(): Promise<MemoNode[]>;
  restoreMemo(date: string): Promise<void>;
  permanentDeleteMemo(date: string): Promise<void>;
  toggleMemoPin(date: string): Promise<MemoNode>;

  // Notes
  fetchAllNotes(): Promise<NoteNode[]>;
  fetchDeletedNotes(): Promise<NoteNode[]>;
  createNote(id: string, title: string): Promise<NoteNode>;
  updateNote(
    id: string,
    updates: Partial<
      Pick<NoteNode, "title" | "content" | "isPinned" | "color">
    >,
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
  fetchDeletedCustomSounds(): Promise<CustomSoundMeta[]>;
  restoreCustomSound(id: string): Promise<void>;
  permanentDeleteCustomSound(id: string): Promise<void>;
  updateCustomSoundLabel(id: string, label: string): Promise<void>;

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

  // Routine Tags
  fetchRoutineTags(): Promise<RoutineTag[]>;
  createRoutineTag(name: string, color: string): Promise<RoutineTag>;
  updateRoutineTag(
    id: number,
    updates: Partial<
      Pick<RoutineTag, "name" | "color" | "textColor" | "order">
    >,
  ): Promise<RoutineTag>;
  deleteRoutineTag(id: number): Promise<void>;
  fetchAllRoutineTagAssignments(): Promise<
    Array<{ routine_id: string; tag_id: number }>
  >;
  setTagsForRoutine(routineId: string, tagIds: number[]): Promise<void>;

  // Calendar Tags
  fetchCalendarTags(): Promise<CalendarTag[]>;
  createCalendarTag(name: string, color: string): Promise<CalendarTag>;
  updateCalendarTag(
    id: number,
    updates: Partial<
      Pick<CalendarTag, "name" | "color" | "textColor" | "order">
    >,
  ): Promise<CalendarTag>;
  deleteCalendarTag(id: number): Promise<void>;
  fetchAllCalendarTagAssignments(): Promise<
    Array<{ schedule_item_id: string; tag_id: number }>
  >;
  setTagsForScheduleItem(
    scheduleItemId: string,
    tagIds: number[],
  ): Promise<void>;

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
      >
    >,
  ): Promise<RoutineNode>;
  deleteRoutine(id: string): Promise<void>;
  fetchDeletedRoutines(): Promise<RoutineNode[]>;
  softDeleteRoutine(id: string): Promise<void>;
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
  toggleScheduleItemComplete(id: string): Promise<ScheduleItem>;
  dismissScheduleItem(id: string): Promise<void>;
  undismissScheduleItem(id: string): Promise<void>;
  fetchLastRoutineDate(): Promise<string | null>;
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
    }>,
  ): Promise<ScheduleItem[]>;
  updateFutureScheduleItemsByRoutine(
    routineId: string,
    updates: { title?: string; startTime?: string; endTime?: string },
    fromDate: string,
  ): Promise<number>;
  fetchScheduleItemsByRoutineId(routineId: string): Promise<ScheduleItem[]>;
  bulkDeleteScheduleItems(ids: string[]): Promise<number>;
  fetchEvents(): Promise<ScheduleItem[]>;

  // Routine Groups
  fetchRoutineGroups(): Promise<RoutineGroup[]>;
  createRoutineGroup(
    id: string,
    name: string,
    color: string,
    frequencyType?: string,
    frequencyDays?: number[],
    frequencyInterval?: number | null,
    frequencyStartDate?: string | null,
  ): Promise<RoutineGroup>;
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
  ): Promise<RoutineGroup>;
  deleteRoutineGroup(id: string): Promise<void>;
  fetchAllRoutineGroupTagAssignments(): Promise<
    Array<{ group_id: string; tag_id: number }>
  >;
  setTagsForRoutineGroup(groupId: string, tagIds: number[]): Promise<void>;

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
  searchWikiTags(query: string): Promise<WikiTag[]>;
  createWikiTag(name: string, color: string): Promise<WikiTag>;
  createWikiTagWithId(
    id: string,
    name: string,
    color: string,
  ): Promise<WikiTag>;
  updateWikiTag(
    id: string,
    updates: Partial<Pick<WikiTag, "name" | "color" | "textColor">>,
  ): Promise<WikiTag>;
  deleteWikiTag(id: string): Promise<void>;
  mergeWikiTags(sourceId: string, targetId: string): Promise<WikiTag>;
  fetchWikiTagsForEntity(entityId: string): Promise<WikiTag[]>;
  setWikiTagsForEntity(
    entityId: string,
    entityType: string,
    tagIds: string[],
  ): Promise<void>;
  syncInlineWikiTags(
    entityId: string,
    entityType: string,
    tagNames: string[],
  ): Promise<void>;
  fetchAllWikiTagAssignments(): Promise<WikiTagAssignment[]>;
  restoreWikiTagAssignment(
    tagId: string,
    entityId: string,
    entityType: string,
    source: string,
  ): Promise<void>;

  // Wiki Tag Groups
  fetchWikiTagGroups(): Promise<WikiTagGroup[]>;
  createWikiTagGroup(
    name: string,
    noteIds: string[],
    filterTags?: string[],
  ): Promise<WikiTagGroup>;
  updateWikiTagGroup(
    id: string,
    updates: { name?: string; filterTags?: string[] },
  ): Promise<WikiTagGroup>;
  deleteWikiTagGroup(id: string): Promise<void>;
  fetchAllWikiTagGroupMembers(): Promise<WikiTagGroupMember[]>;
  setWikiTagGroupMembers(groupId: string, noteIds: string[]): Promise<void>;
  addWikiTagGroupMember(groupId: string, noteId: string): Promise<void>;
  removeWikiTagGroupMember(groupId: string, noteId: string): Promise<void>;

  // Wiki Tag Connections
  fetchWikiTagConnections(): Promise<WikiTagConnection[]>;
  createWikiTagConnection(
    sourceTagId: string,
    targetTagId: string,
  ): Promise<WikiTagConnection>;
  deleteWikiTagConnection(id: string): Promise<void>;
  deleteWikiTagConnectionByPair(
    sourceTagId: string,
    targetTagId: string,
  ): Promise<void>;

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

  // Time Memos
  fetchTimeMemosByDate(date: string): Promise<TimeMemo[]>;
  upsertTimeMemo(
    id: string,
    date: string,
    hour: number,
    content: string,
  ): Promise<TimeMemo>;
  deleteTimeMemo(id: string): Promise<void>;

  // Paper Boards
  fetchPaperBoards(): Promise<PaperBoard[]>;
  fetchPaperBoardById(id: string): Promise<PaperBoard | null>;
  fetchPaperBoardByNoteId(noteId: string): Promise<PaperBoard | null>;
  createPaperBoard(
    name: string,
    linkedNoteId?: string | null,
  ): Promise<PaperBoard>;
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
  ): Promise<PaperBoard>;
  deletePaperBoard(id: string): Promise<void>;

  // Paper Nodes
  fetchPaperNodeCountsByBoard(): Promise<Record<string, number>>;
  fetchPaperNodesByBoard(boardId: string): Promise<PaperNode[]>;
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
  }): Promise<PaperNode>;
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
  ): Promise<PaperNode>;
  bulkUpdatePaperNodePositions(
    updates: Array<{
      id: string;
      positionX: number;
      positionY: number;
      parentNodeId: string | null;
    }>,
  ): Promise<void>;
  bulkUpdatePaperNodeZIndices(
    updates: Array<{
      id: string;
      zIndex: number;
      parentNodeId: string | null;
    }>,
  ): Promise<void>;
  deletePaperNode(id: string): Promise<void>;

  // Paper Edges
  fetchPaperEdgesByBoard(boardId: string): Promise<PaperEdge[]>;
  createPaperEdge(params: {
    boardId: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    label?: string | null;
    styleJson?: string | null;
  }): Promise<PaperEdge>;
  deletePaperEdge(id: string): Promise<void>;

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

  // Shell
  openExternal(url: string): Promise<void>;
  openAttachmentFile(id: string): Promise<void>;

  // Attachments
  saveAttachment(meta: AttachmentMeta, data: ArrayBuffer): Promise<void>;
  loadAttachment(id: string): Promise<ArrayBuffer | null>;
  deleteAttachment(id: string): Promise<void>;
  fetchAttachmentMetas(): Promise<AttachmentMeta[]>;

  // Updater
  checkForUpdates(): Promise<void>;
  downloadUpdate(): Promise<void>;
  installUpdate(): Promise<void>;
}
