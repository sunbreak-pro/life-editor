// Duplicated from frontend/src/types/* because electron/tsconfig rootDir constraint
// prevents cross-importing from ../frontend/

export type NodeType = "folder" | "task";
export type TaskStatus = "TODO" | "DONE";

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
}

export type SessionType = "WORK" | "BREAK" | "LONG_BREAK";

export interface TimerSettings {
  id: number;
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
  autoStartBreaks: boolean;
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
  deletedAt?: number;
}

export interface TaskTemplate {
  id: number;
  name: string;
  nodesJson: string;
  createdAt: string;
}

export interface NoteNode {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SoundTag {
  id: number;
  name: string;
  color: string;
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

export interface RoutineNode {
  id: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  isArchived: boolean;
  isDeleted: boolean;
  deletedAt: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineTag {
  id: number;
  name: string;
  color: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface WikiTag {
  id: string;
  name: string;
  color: string;
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
