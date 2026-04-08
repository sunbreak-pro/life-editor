// Duplicated from frontend/src/types/* because electron/tsconfig rootDir constraint
// prevents cross-importing from ../frontend/

export type NodeType = "folder" | "task";
export type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE";

export interface TaskNode {
  id: string;
  type: NodeType;
  title: string;
  parentId: string | null;
  order: number;
  status?: TaskStatus;
  isExpanded?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  completedAt?: string;
  scheduledAt?: string;
  scheduledEndAt?: string;
  isAllDay?: boolean;
  content?: string;
  workDurationMinutes?: number;
  color?: string;
  timeMemo?: string;
  updatedAt?: string;
  version?: number;
  folderType?: "normal" | "complete";
  originalParentId?: string | null;
}

export type SessionType = "WORK" | "BREAK" | "LONG_BREAK";

export interface TimerSettings {
  id: number;
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
  autoStartBreaks: boolean;
  targetSessions: number;
  updatedAt: string;
}

export interface TimerSession {
  id: number;
  taskId: string | null;
  sessionType: SessionType;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  completed: boolean;
}

export interface SoundSettings {
  id: number;
  soundType: string;
  volume: number;
  enabled: boolean;
  updatedAt: string;
}

export interface SoundPreset {
  id: number;
  name: string;
  settingsJson: string;
  createdAt: string;
}

export interface MemoNode {
  id: string;
  date: string;
  content: string;
  isPinned?: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomSoundMeta {
  id: string;
  label: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: number;
  isDeleted?: boolean;
  deletedAt?: string | null;
}

export interface TaskTemplate {
  id: number;
  name: string;
  nodesJson: string;
  createdAt: string;
}

export type NoteNodeType = "folder" | "note";

export interface NoteNode {
  id: string;
  type: NoteNodeType;
  title: string;
  content: string;
  parentId: string | null;
  order: number;
  isPinned: boolean;
  isDeleted: boolean;
  deletedAt?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export type PropertyType = "text" | "number" | "select" | "date" | "checkbox";

export interface DatabaseEntity {
  id: string;
  title: string;
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseProperty {
  id: string;
  databaseId: string;
  name: string;
  type: PropertyType;
  order: number;
  config: {
    options?: Array<{ id: string; label: string; color: string }>;
  };
  createdAt: string;
}

export interface DatabaseRow {
  id: string;
  databaseId: string;
  order: number;
  createdAt: string;
}

export interface DatabaseCell {
  id: string;
  rowId: string;
  propertyId: string;
  value: string;
}

export interface SoundTag {
  id: number;
  name: string;
  color: string;
  textColor?: string;
}

export interface SoundDisplayMeta {
  soundId: string;
  displayName: string | null;
}

export interface CalendarNode {
  id: string;
  title: string;
  folderId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface PomodoroPreset {
  id: number;
  name: string;
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
  createdAt: string;
}

export type FrequencyType = "daily" | "weekdays" | "interval";

export interface RoutineNode {
  id: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  isArchived: boolean;
  isVisible: boolean;
  isDeleted: boolean;
  deletedAt: string | null;
  order: number;
  frequencyType: FrequencyType;
  frequencyDays: number[];
  frequencyInterval: number | null;
  frequencyStartDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineTag {
  id: number;
  name: string;
  color: string;
  textColor?: string;
  order: number;
}

export interface CalendarTag {
  id: number;
  name: string;
  color: string;
  textColor?: string;
  order: number;
}

export interface ScheduleItem {
  id: string;
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  completed: boolean;
  completedAt: string | null;
  routineId: string | null;
  templateId: string | null;
  memo: string | null;
  noteId: string | null;
  content: string | null;
  isDismissed: boolean;
  isAllDay: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineGroup {
  id: string;
  name: string;
  color: string;
  isVisible: boolean;
  order: number;
  frequencyType: FrequencyType;
  frequencyDays: number[];
  frequencyInterval: number | null;
  frequencyStartDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimeMemo {
  id: string;
  date: string;
  hour: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface WikiTag {
  id: string;
  name: string;
  color: string;
  textColor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WikiTagAssignment {
  tagId: string;
  entityId: string;
  entityType: "task" | "memo" | "note";
  source: "inline" | "manual";
  createdAt: string;
}

export interface WikiTagConnection {
  id: string;
  sourceTagId: string;
  targetTagId: string;
  createdAt: string;
}

export interface WikiTagGroup {
  id: string;
  name: string;
  filterTags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WikiTagGroupMember {
  groupId: string;
  noteId: string;
}

export interface NoteConnection {
  id: string;
  sourceNoteId: string;
  targetNoteId: string;
  createdAt: string;
}

export type PaperNodeType = "card" | "text" | "frame";

export interface PaperBoard {
  id: string;
  name: string;
  linkedNoteId: string | null;
  viewportX: number;
  viewportY: number;
  viewportZoom: number;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaperNode {
  id: string;
  boardId: string;
  nodeType: PaperNodeType;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  zIndex: number;
  parentNodeId: string | null;
  refEntityId: string | null;
  refEntityType: string | null;
  textContent: string | null;
  frameColor: string | null;
  frameLabel: string | null;
  label: string | null;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaperEdge {
  id: string;
  boardId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  label: string | null;
  styleJson: string | null;
  createdAt: string;
}

export interface MigrationPayload {
  tasks?: TaskNode[];
  timerSettings?: Partial<TimerSettings>;
  soundSettings?: Array<{
    soundType: string;
    volume: number;
    enabled: boolean;
  }>;
  memos?: MemoNode[];
}
