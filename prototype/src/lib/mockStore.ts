import { SEED } from "../data/seed";
import { DAILY_TEMPLATE, genId, weekdayOf } from "./id";
import { storage } from "./storage";
import type {
  AppSettings,
  EntityId,
  MockState,
  Note,
  NotificationKind,
  PomodoroPreset,
  ScheduleItem,
  TaskStatus,
  TimerSession,
  WikiTag,
} from "./types";

const KEYS = {
  scheduleItems: "schedule-items",
  notes: "notes",
  presets: "presets",
  timerSessions: "timer-sessions",
  wikiTags: "wiki-tags",
  settings: "settings",
  activePresetId: "active-preset-id",
  currentTaskId: "current-task-id",
  autoStartBreaks: "auto-start-breaks",
} as const;

let state: MockState = {
  scheduleItems: storage.get(KEYS.scheduleItems, SEED.scheduleItems),
  notes: storage.get(KEYS.notes, SEED.notes),
  presets: storage.get(KEYS.presets, SEED.presets),
  timerSessions: storage.get(KEYS.timerSessions, SEED.timerSessions),
  wikiTags: storage.get(KEYS.wikiTags, SEED.wikiTags),
  settings: storage.get(KEYS.settings, SEED.settings),
  activePresetId: storage.get(KEYS.activePresetId, SEED.activePresetId),
  currentTaskId: storage.get(KEYS.currentTaskId, SEED.currentTaskId),
  autoStartBreaks: storage.get(KEYS.autoStartBreaks, SEED.autoStartBreaks),
};

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getState(): MockState {
  return state;
}

function setState(patch: Partial<MockState>): void {
  state = { ...state, ...patch };
  notify();
}

const excerptOf = (body: string): string =>
  body
    .replace(/^#+\s.*$/gm, "")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, 80);

// ===== ScheduleItem =====

export function addScheduleItem(
  input: Omit<ScheduleItem, "id" | "createdAt" | "updatedAt" | "isDeleted">,
): ScheduleItem {
  const ts = Date.now();
  const prefix = input.type === "task" ? "task" : "event";
  const item: ScheduleItem = {
    ...input,
    id: genId(prefix),
    createdAt: ts,
    updatedAt: ts,
    isDeleted: false,
  };
  const next = [...state.scheduleItems, item];
  storage.set(KEYS.scheduleItems, next);
  setState({ scheduleItems: next });
  return item;
}

export function updateScheduleItem(
  id: EntityId,
  patch: Partial<Omit<ScheduleItem, "id" | "createdAt">>,
): void {
  const next = state.scheduleItems.map((s) =>
    s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s,
  );
  storage.set(KEYS.scheduleItems, next);
  setState({ scheduleItems: next });
}

export function deleteScheduleItem(id: EntityId): void {
  const item = state.scheduleItems.find((s) => s.id === id);
  if (!item || item.type === "holiday") return;
  updateScheduleItem(id, { isDeleted: true, deletedAt: Date.now() });
}

export function restoreScheduleItem(id: EntityId): void {
  updateScheduleItem(id, { isDeleted: false, deletedAt: undefined });
}

export function purgeScheduleItem(id: EntityId): void {
  const next = state.scheduleItems.filter((s) => s.id !== id);
  storage.set(KEYS.scheduleItems, next);
  setState({ scheduleItems: next });
}

const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  todo: "doing",
  doing: "done",
  done: "todo",
};

export function toggleStatus(id: EntityId): void {
  const item = state.scheduleItems.find((s) => s.id === id);
  if (!item) return;
  if (item.type === "birthday" || item.type === "holiday") return;
  updateScheduleItem(id, { status: STATUS_CYCLE[item.status] });
}

// ===== Note =====

export function addNote(
  input: Omit<Note, "id" | "createdAt" | "updatedAt" | "isDeleted" | "excerpt">,
): Note {
  const ts = Date.now();
  const id =
    input.kind === "daily" && input.date
      ? `daily-${input.date}`
      : genId("note");
  const note: Note = {
    ...input,
    id,
    excerpt: excerptOf(input.body),
    createdAt: ts,
    updatedAt: ts,
    isDeleted: false,
  };
  const next = [note, ...state.notes];
  storage.set(KEYS.notes, next);
  setState({ notes: next });
  return note;
}

export function getOrCreateDaily(date: string): Note {
  const existing = state.notes.find(
    (n) => n.kind === "daily" && n.date === date && !n.isDeleted,
  );
  if (existing) return existing;
  return addNote({
    kind: "daily",
    title: date,
    body: DAILY_TEMPLATE,
    wikiTagIds: ["tag-journal"],
    pinned: false,
    date,
    weekday: weekdayOf(date),
    mood: "green",
    pomodoroSessions: 0,
  });
}

export function updateNote(
  id: EntityId,
  patch: Partial<Omit<Note, "id" | "createdAt">>,
): void {
  const next = state.notes.map((n) => {
    if (n.id !== id) return n;
    const merged = { ...n, ...patch, updatedAt: Date.now() };
    if (patch.body !== undefined) {
      merged.excerpt = excerptOf(patch.body);
    }
    return merged;
  });
  storage.set(KEYS.notes, next);
  setState({ notes: next });
}

export function togglePinNote(id: EntityId): void {
  const note = state.notes.find((n) => n.id === id);
  if (!note) return;
  updateNote(id, { pinned: !note.pinned });
}

export function duplicateNote(id: EntityId): Note | null {
  const note = state.notes.find((n) => n.id === id);
  if (!note || note.kind === "daily") return null;
  return addNote({
    kind: "notes",
    title: `${note.title} (コピー)`,
    body: note.body,
    wikiTagIds: [...note.wikiTagIds],
    pinned: false,
  });
}

export function deleteNote(id: EntityId): void {
  updateNote(id, { isDeleted: true, deletedAt: Date.now() });
}

export function restoreNote(id: EntityId): void {
  updateNote(id, { isDeleted: false, deletedAt: undefined });
}

export function purgeNote(id: EntityId): void {
  const next = state.notes.filter((n) => n.id !== id);
  storage.set(KEYS.notes, next);
  setState({ notes: next });
}

// ===== WikiTag =====

export function addWikiTag(name: string, color: string): WikiTag {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("tag name is required");
  }
  const normalized = trimmed.toLowerCase();
  const existing = state.wikiTags.find(
    (t) => t.name.toLowerCase() === normalized,
  );
  if (existing) return existing;
  const tag: WikiTag = {
    id: genId("tag"),
    name: trimmed,
    color,
    createdAt: Date.now(),
  };
  const next = [...state.wikiTags, tag];
  storage.set(KEYS.wikiTags, next);
  setState({ wikiTags: next });
  return tag;
}

const isScheduleEntity = (id: EntityId): boolean =>
  id.startsWith("task-") ||
  id.startsWith("event-") ||
  id.startsWith("event-holiday-");

const isNoteEntity = (id: EntityId): boolean =>
  id.startsWith("note-") || id.startsWith("daily-");

export function attachTag(entityId: EntityId, tagId: EntityId): void {
  if (isScheduleEntity(entityId)) {
    const item = state.scheduleItems.find((s) => s.id === entityId);
    if (!item || item.wikiTagIds.includes(tagId)) return;
    updateScheduleItem(entityId, { wikiTagIds: [...item.wikiTagIds, tagId] });
  } else if (isNoteEntity(entityId)) {
    const note = state.notes.find((n) => n.id === entityId);
    if (!note || note.wikiTagIds.includes(tagId)) return;
    updateNote(entityId, { wikiTagIds: [...note.wikiTagIds, tagId] });
  }
}

export function detachTag(entityId: EntityId, tagId: EntityId): void {
  if (isScheduleEntity(entityId)) {
    const item = state.scheduleItems.find((s) => s.id === entityId);
    if (!item) return;
    updateScheduleItem(entityId, {
      wikiTagIds: item.wikiTagIds.filter((id) => id !== tagId),
    });
  } else if (isNoteEntity(entityId)) {
    const note = state.notes.find((n) => n.id === entityId);
    if (!note) return;
    updateNote(entityId, {
      wikiTagIds: note.wikiTagIds.filter((id) => id !== tagId),
    });
  }
}

// ===== PomodoroPreset =====

export function addPreset(
  input: Omit<PomodoroPreset, "id" | "createdAt" | "updatedAt" | "isDeleted">,
): PomodoroPreset {
  const ts = Date.now();
  const preset: PomodoroPreset = {
    ...input,
    id: genId("preset"),
    createdAt: ts,
    updatedAt: ts,
    isDeleted: false,
  };
  const next = [...state.presets, preset];
  storage.set(KEYS.presets, next);
  setState({ presets: next });
  return preset;
}

export function updatePreset(
  id: EntityId,
  patch: Partial<Omit<PomodoroPreset, "id" | "createdAt">>,
): void {
  const next = state.presets.map((p) =>
    p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
  );
  storage.set(KEYS.presets, next);
  setState({ presets: next });
}

export function deletePreset(id: EntityId): boolean {
  const remaining = state.presets.filter((p) => !p.isDeleted);
  if (remaining.length <= 1) return false;
  updatePreset(id, { isDeleted: true, deletedAt: Date.now() });
  if (state.activePresetId === id) {
    const fallback = remaining.find((p) => p.id !== id);
    setActivePresetId(fallback ? fallback.id : null);
  }
  return true;
}

export function restorePreset(id: EntityId): void {
  updatePreset(id, { isDeleted: false, deletedAt: undefined });
}

export function purgePreset(id: EntityId): void {
  const next = state.presets.filter((p) => p.id !== id);
  storage.set(KEYS.presets, next);
  setState({ presets: next });
}

export function setActivePresetId(id: EntityId | null): void {
  storage.set(KEYS.activePresetId, id);
  setState({ activePresetId: id });
}

// ===== TimerSession =====

export function addTimerSession(
  input: Omit<TimerSession, "id" | "isDeleted">,
): TimerSession {
  const session: TimerSession = {
    ...input,
    id: genId("session"),
    isDeleted: false,
  };
  const next = [session, ...state.timerSessions];
  storage.set(KEYS.timerSessions, next);
  setState({ timerSessions: next });
  return session;
}

export function updateTimerSession(
  id: EntityId,
  patch: Partial<Omit<TimerSession, "id">>,
): void {
  const next = state.timerSessions.map((s) =>
    s.id === id ? { ...s, ...patch } : s,
  );
  storage.set(KEYS.timerSessions, next);
  setState({ timerSessions: next });
}

export function deleteTimerSession(id: EntityId): void {
  const next = state.timerSessions.map((s) =>
    s.id === id ? { ...s, isDeleted: true, deletedAt: Date.now() } : s,
  );
  storage.set(KEYS.timerSessions, next);
  setState({ timerSessions: next });
}

export function restoreTimerSession(id: EntityId): void {
  const next = state.timerSessions.map((s) =>
    s.id === id ? { ...s, isDeleted: false, deletedAt: undefined } : s,
  );
  storage.set(KEYS.timerSessions, next);
  setState({ timerSessions: next });
}

export function purgeTimerSession(id: EntityId): void {
  const next = state.timerSessions.filter((s) => s.id !== id);
  storage.set(KEYS.timerSessions, next);
  setState({ timerSessions: next });
}

// ===== currentTask / autoStartBreaks =====

export function setCurrentTaskId(id: EntityId | null): void {
  storage.set(KEYS.currentTaskId, id);
  setState({ currentTaskId: id });
}

export function setAutoStartBreaks(enabled: boolean): void {
  storage.set(KEYS.autoStartBreaks, enabled);
  setState({ autoStartBreaks: enabled });
}

// ===== Settings =====

export function setSettings(patch: Partial<AppSettings>): void {
  const next: AppSettings = {
    ...state.settings,
    ...patch,
    notifications: {
      ...state.settings.notifications,
      ...(patch.notifications ?? {}),
    },
    layoutDefaults: {
      ...state.settings.layoutDefaults,
      ...(patch.layoutDefaults ?? {}),
    },
    updatedAt: Date.now(),
  };
  storage.set(KEYS.settings, next);
  setState({ settings: next });
}

export function setNotification(kind: NotificationKind, value: boolean): void {
  setSettings({
    notifications: { ...state.settings.notifications, [kind]: value },
  });
}

// ===== Trash =====

export function purgeAllTrash(): void {
  const scheduleItems = state.scheduleItems.filter((s) => !s.isDeleted);
  const notes = state.notes.filter((n) => !n.isDeleted);
  const presets = state.presets.filter((p) => !p.isDeleted);
  const timerSessions = state.timerSessions.filter((s) => !s.isDeleted);
  storage.set(KEYS.scheduleItems, scheduleItems);
  storage.set(KEYS.notes, notes);
  storage.set(KEYS.presets, presets);
  storage.set(KEYS.timerSessions, timerSessions);
  setState({ scheduleItems, notes, presets, timerSessions });
}

// ===== Reset =====

export function resetAll(): void {
  storage.clearAll();
  if (typeof location !== "undefined") {
    location.reload();
  }
}
