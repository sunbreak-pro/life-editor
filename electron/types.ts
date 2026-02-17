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
  createdAt: string;
  updatedAt: string;
}

export type AIRequestType = "breakdown" | "encouragement" | "review";

export interface AIAdviceRequest {
  taskTitle: string;
  taskContent?: string;
  requestType: AIRequestType;
}

export interface AIAdviceResponse {
  advice: string;
  requestType: AIRequestType;
}

export interface AISettingsResponse {
  apiKey: string;
  model: string;
  hasApiKey: boolean;
}

export interface CustomSoundMeta {
  id: string;
  label: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: number;
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
  order: number;
  createdAt: string;
  updatedAt: string;
}

export type TemplateFrequencyType = "daily" | "custom";

export interface RoutineTemplate {
  id: string;
  name: string;
  frequencyType: TemplateFrequencyType;
  frequencyDays: number[];
  order: number;
  items: RoutineTemplateItem[];
  createdAt: string;
  updatedAt: string;
}

export interface RoutineTemplateItem {
  id: number;
  templateId: string;
  routineId: string;
  position: number;
  startTime: string | null;
  endTime: string | null;
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
