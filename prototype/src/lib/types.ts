export type EntityId = string;

export type TaskStatus = "todo" | "doing" | "done";
export type ScheduleItemType = "task" | "event" | "birthday" | "holiday";
export type SessionType = "WORK" | "BREAK" | "LONG_BREAK";
export type MaterialKind = "notes" | "daily";
export type Mood = "green" | "sky" | "yellow" | "peach" | "red";
export type ThemeMode = "light" | "dark" | "system";
export type Language = "ja" | "en";
export type NotificationKind =
  | "pomodoroSessionEnd"
  | "scheduleReminder10min"
  | "scheduleReminder30min"
  | "dailyUnwritten";

export interface ScheduleItem {
  id: EntityId;
  title: string;
  type: ScheduleItemType;
  status: TaskStatus;
  due?: string;
  time?: string;
  endTime?: string;
  description?: string;
  wikiTagIds: string[];
  isDeleted: boolean;
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface WikiTag {
  id: EntityId;
  name: string;
  color: string;
  createdAt: number;
}

export interface PomodoroPreset {
  id: EntityId;
  name: string;
  workMin: number;
  breakMin: number;
  longBreakMin: number;
  sessionsBeforeLongBreak: number;
  isDeleted: boolean;
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface TimerSession {
  id: EntityId;
  scheduleItemId: EntityId | null;
  scheduleItemTitle: string | null;
  sessionType: SessionType;
  plannedSec: number;
  durationSec: number;
  startedAt: number;
  completedAt: number;
  /** Free-form memo about what was done this session (WORK sessions). */
  comment?: string;
  isDeleted: boolean;
  deletedAt?: number;
}

export interface Note {
  id: EntityId;
  kind: MaterialKind;
  title: string;
  excerpt: string;
  body: string;
  wikiTagIds: string[];
  pinned: boolean;
  date?: string;
  weekday?: string;
  mood?: Mood;
  pomodoroSessions?: number;
  isDeleted: boolean;
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  themeMode: ThemeMode;
  fontSize: number;
  language: Language;
  notifications: Record<NotificationKind, boolean>;
  layoutDefaults: {
    materialsLayout: "card" | "list";
  };
  updatedAt: number;
}

export interface MockState {
  scheduleItems: ScheduleItem[];
  notes: Note[];
  presets: PomodoroPreset[];
  timerSessions: TimerSession[];
  wikiTags: WikiTag[];
  settings: AppSettings;
  activePresetId: EntityId | null;
  currentTaskId: EntityId | null;
  autoStartBreaks: boolean;
}
