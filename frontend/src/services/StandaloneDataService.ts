import type { DataService } from "./DataService";
import { SyncQueue } from "./SyncQueue";
import { getOfflineDb } from "../db/indexedDb";
import { notSupported } from "./notSupported";
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
import type { CalendarTag } from "../types/calendarTag";

const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  id: 0,
  workDuration: 25,
  breakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
  autoStartBreaks: false,
  targetSessions: 8,
  updatedAt: new Date(),
};

export class StandaloneDataService implements DataService {
  private syncQueue = new SyncQueue();
  private onQueueChange: (() => void) | null = null;

  constructor() {
    this.syncQueue.setConflictHandler(
      async (entityType, entityId, serverData) => {
        if (serverData) {
          const db = await getOfflineDb();
          const storeMap: Record<string, string> = {
            task: "tasks",
            memo: "memos",
            note: "notes",
            scheduleItem: "scheduleItems",
            routine: "routines",
            wikiTag: "wikiTags",
            timeMemo: "timeMemos",
            calendar: "calendars",
          };
          const storeName = storeMap[entityType];
          if (storeName) {
            const tx = db.transaction(storeName as never, "readwrite");
            (
              tx.objectStore(storeName as never) as {
                put: (v: unknown) => void;
              }
            ).put(serverData);
            await tx.done;
          }
        }
        console.warn(
          `[Sync] Conflict resolved (last-write-wins): ${entityType}/${entityId}`,
        );
      },
    );

    this.syncQueue.setChangeHandler(() => {
      this.onQueueChange?.();
    });
  }

  setQueueChangeHandler(handler: () => void): void {
    this.onQueueChange = handler;
  }

  async getQueueSize(): Promise<number> {
    return this.syncQueue.getQueueSize();
  }

  async initialize(): Promise<void> {
    // No sync needed in standalone mode — IndexedDB is the primary store
  }

  async triggerSync(): Promise<void> {
    // No-op in standalone mode — will be enabled in Phase 2 (cloud sync)
  }

  async triggerFullSync(): Promise<void> {
    // No-op in standalone mode
  }

  destroy(): void {
    this.syncQueue.destroy();
  }

  // --- Helper ---

  private async getAllFromStore<T>(
    storeName: string,
    filter?: (item: T) => boolean,
  ): Promise<T[]> {
    const db = await getOfflineDb();
    const all = (await db.getAll(storeName as never)) as T[];
    return filter ? all.filter(filter) : all;
  }

  // ============================================================
  // Tasks
  // ============================================================

  async fetchTaskTree(): Promise<TaskNode[]> {
    return this.getAllFromStore<TaskNode>("tasks", (t) => !t.isDeleted);
  }

  async fetchDeletedTasks(): Promise<TaskNode[]> {
    return this.getAllFromStore<TaskNode>("tasks", (t) => !!t.isDeleted);
  }

  async createTask(node: TaskNode): Promise<TaskNode> {
    const db = await getOfflineDb();
    await db.put("tasks", node as unknown as Record<string, unknown>);
    await this.syncQueue.enqueue("task", node.id, "create", node);
    return node;
  }

  async updateTask(id: string, updates: Partial<TaskNode>): Promise<TaskNode> {
    const db = await getOfflineDb();
    const existing = (await db.get("tasks", id)) as TaskNode | undefined;
    const merged = { ...existing, ...updates, id } as TaskNode;
    await db.put("tasks", merged as unknown as Record<string, unknown>);
    await this.syncQueue.enqueue("task", id, "update", updates);
    return merged;
  }

  async syncTaskTree(nodes: TaskNode[]): Promise<void> {
    const db = await getOfflineDb();
    const tx = db.transaction("tasks", "readwrite");
    for (const node of nodes) {
      tx.objectStore("tasks").put(node as unknown as Record<string, unknown>);
    }
    await tx.done;
  }

  async softDeleteTask(id: string): Promise<void> {
    const db = await getOfflineDb();
    const existing = (await db.get("tasks", id)) as TaskNode | undefined;
    if (existing) {
      await db.put("tasks", {
        ...existing,
        isDeleted: true,
        deletedAt: new Date().toISOString(),
      } as unknown as Record<string, unknown>);
    }
    await this.syncQueue.enqueue("task", id, "delete");
  }

  async restoreTask(id: string): Promise<void> {
    const db = await getOfflineDb();
    const existing = (await db.get("tasks", id)) as TaskNode | undefined;
    if (existing) {
      await db.put("tasks", {
        ...existing,
        isDeleted: false,
        deletedAt: undefined,
      } as unknown as Record<string, unknown>);
    }
  }

  async permanentDeleteTask(id: string): Promise<void> {
    const db = await getOfflineDb();
    await db.delete("tasks", id);
  }

  migrateTasksToBackend(_nodes: TaskNode[]): Promise<void> {
    return notSupported("migrateTasksToBackend");
  }

  // ============================================================
  // Memos
  // ============================================================

  async fetchAllMemos(): Promise<MemoNode[]> {
    return this.getAllFromStore<MemoNode>("memos", (m) => !m.isDeleted);
  }

  async fetchMemoByDate(date: string): Promise<MemoNode | null> {
    const all = await this.getAllFromStore<MemoNode>("memos");
    return all.find((m) => m.date === date) ?? null;
  }

  async upsertMemo(date: string, content: string): Promise<MemoNode> {
    const id = `memo-${date}`;
    const db = await getOfflineDb();
    const existing = (await db.get("memos", id)) as MemoNode | undefined;
    const memo: MemoNode = {
      id,
      date,
      content,
      isPinned: existing?.isPinned ?? false,
      isDeleted: false,
      deletedAt: null,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.put("memos", memo as unknown as Record<string, unknown>);
    await this.syncQueue.enqueue("memo", id, existing ? "update" : "create", {
      date,
      content,
    });
    return memo;
  }

  async deleteMemo(date: string): Promise<void> {
    const id = `memo-${date}`;
    const db = await getOfflineDb();
    await db.delete("memos", id);
    await this.syncQueue.enqueue("memo", id, "delete");
  }

  async fetchDeletedMemos(): Promise<MemoNode[]> {
    return this.getAllFromStore<MemoNode>("memos", (m) => !!m.isDeleted);
  }

  async restoreMemo(date: string): Promise<void> {
    const id = `memo-${date}`;
    const db = await getOfflineDb();
    const existing = (await db.get("memos", id)) as MemoNode | undefined;
    if (existing) {
      await db.put("memos", {
        ...existing,
        isDeleted: false,
        deletedAt: null,
      } as unknown as Record<string, unknown>);
    }
  }

  async permanentDeleteMemo(date: string): Promise<void> {
    const id = `memo-${date}`;
    const db = await getOfflineDb();
    await db.delete("memos", id);
  }

  async toggleMemoPin(date: string): Promise<MemoNode> {
    const all = await this.getAllFromStore<MemoNode>("memos");
    const memo = all.find((m) => m.date === date);
    if (memo) {
      memo.isPinned = !memo.isPinned;
      const db = await getOfflineDb();
      await db.put("memos", memo as unknown as Record<string, unknown>);
      return memo;
    }
    throw new Error(`Memo not found: ${date}`);
  }

  setMemoPassword(_date: string, _password: string): Promise<MemoNode> {
    return notSupported("setMemoPassword");
  }
  removeMemoPassword(
    _date: string,
    _currentPassword: string,
  ): Promise<MemoNode> {
    return notSupported("removeMemoPassword");
  }
  verifyMemoPassword(_date: string, _password: string): Promise<boolean> {
    return notSupported("verifyMemoPassword");
  }
  toggleMemoEditLock(_date: string): Promise<MemoNode> {
    return notSupported("toggleMemoEditLock");
  }

  // ============================================================
  // Notes
  // ============================================================

  async fetchAllNotes(): Promise<NoteNode[]> {
    return this.getAllFromStore<NoteNode>("notes", (n) => !n.isDeleted);
  }

  async fetchDeletedNotes(): Promise<NoteNode[]> {
    return this.getAllFromStore<NoteNode>("notes", (n) => !!n.isDeleted);
  }

  async createNote(
    id: string,
    title: string,
    _parentId?: string | null,
  ): Promise<NoteNode> {
    const note: NoteNode = {
      id,
      type: "note",
      title,
      content: "",
      parentId: null,
      order: 0,
      isPinned: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const db = await getOfflineDb();
    await db.put("notes", note as unknown as Record<string, unknown>);
    await this.syncQueue.enqueue("note", id, "create", { title });
    return note;
  }

  async updateNote(
    id: string,
    updates: Partial<
      Pick<NoteNode, "title" | "content" | "isPinned" | "color" | "icon">
    >,
  ): Promise<NoteNode> {
    const db = await getOfflineDb();
    const existing = (await db.get("notes", id)) as NoteNode | undefined;
    const merged = { ...existing, ...updates, id } as NoteNode;
    merged.updatedAt = new Date().toISOString();
    await db.put("notes", merged as unknown as Record<string, unknown>);
    await this.syncQueue.enqueue("note", id, "update", updates);
    return merged;
  }

  async softDeleteNote(id: string): Promise<void> {
    const db = await getOfflineDb();
    const existing = (await db.get("notes", id)) as NoteNode | undefined;
    if (existing) {
      await db.put("notes", {
        ...existing,
        isDeleted: true,
        deletedAt: new Date().toISOString(),
      } as unknown as Record<string, unknown>);
    }
    await this.syncQueue.enqueue("note", id, "delete");
  }

  async restoreNote(id: string): Promise<void> {
    const db = await getOfflineDb();
    const existing = (await db.get("notes", id)) as NoteNode | undefined;
    if (existing) {
      await db.put("notes", {
        ...existing,
        isDeleted: false,
        deletedAt: null,
      } as unknown as Record<string, unknown>);
    }
  }

  async permanentDeleteNote(id: string): Promise<void> {
    const db = await getOfflineDb();
    await db.delete("notes", id);
  }

  async searchNotes(query: string): Promise<NoteNode[]> {
    const all = await this.getAllFromStore<NoteNode>(
      "notes",
      (n) => !n.isDeleted,
    );
    const q = query.toLowerCase();
    return all.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.content ?? "").toLowerCase().includes(q),
    );
  }

  setNotePassword(_id: string, _password: string): Promise<NoteNode> {
    return notSupported("setNotePassword");
  }
  removeNotePassword(_id: string, _currentPassword: string): Promise<NoteNode> {
    return notSupported("removeNotePassword");
  }
  verifyNotePassword(_id: string, _password: string): Promise<boolean> {
    return notSupported("verifyNotePassword");
  }
  toggleNoteEditLock(_id: string): Promise<NoteNode> {
    return notSupported("toggleNoteEditLock");
  }

  createNoteFolder(
    _id: string,
    _title: string,
    _parentId: string | null,
  ): Promise<NoteNode> {
    return notSupported("createNoteFolder");
  }

  syncNoteTree(
    _items: Array<{ id: string; parentId: string | null; order: number }>,
  ): Promise<void> {
    return notSupported("syncNoteTree");
  }

  // ============================================================
  // Routines
  // ============================================================

  async fetchAllRoutines(): Promise<RoutineNode[]> {
    return this.getAllFromStore<RoutineNode>(
      "routines",
      (r) => !r.isDeleted && !r.isArchived,
    );
  }

  async createRoutine(
    id: string,
    title: string,
    startTime?: string,
    endTime?: string,
    frequencyType?: string,
    frequencyDays?: number[],
    frequencyInterval?: number | null,
    frequencyStartDate?: string | null,
    reminderEnabled?: boolean,
    reminderOffset?: number,
  ): Promise<RoutineNode> {
    const routine: RoutineNode = {
      id,
      title,
      startTime: startTime ?? null,
      endTime: endTime ?? null,
      isVisible: true,
      frequencyType: (frequencyType ?? "daily") as RoutineNode["frequencyType"],
      frequencyDays: frequencyDays ?? [],
      frequencyInterval: frequencyInterval ?? null,
      frequencyStartDate: frequencyStartDate ?? null,
      isArchived: false,
      isDeleted: false,
      deletedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // Suppress unused variable warnings
    void reminderEnabled;
    void reminderOffset;
    const db = await getOfflineDb();
    await db.put("routines", routine as unknown as Record<string, unknown>);
    await this.syncQueue.enqueue("routine", id, "create", routine);
    return routine;
  }

  async updateRoutine(
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
        | "reminderEnabled"
        | "reminderOffset"
      >
    >,
  ): Promise<RoutineNode> {
    const db = await getOfflineDb();
    const existing = (await db.get("routines", id)) as RoutineNode | undefined;
    const merged = { ...existing, ...updates, id } as RoutineNode;
    merged.updatedAt = new Date().toISOString();
    await db.put("routines", merged as unknown as Record<string, unknown>);
    await this.syncQueue.enqueue("routine", id, "update", updates);
    return merged;
  }

  async deleteRoutine(id: string): Promise<void> {
    const db = await getOfflineDb();
    await db.delete("routines", id);
    await this.syncQueue.enqueue("routine", id, "delete");
  }

  async fetchDeletedRoutines(): Promise<RoutineNode[]> {
    return this.getAllFromStore<RoutineNode>("routines", (r) => !!r.isDeleted);
  }

  async softDeleteRoutine(id: string): Promise<void> {
    const db = await getOfflineDb();
    const existing = (await db.get("routines", id)) as RoutineNode | undefined;
    if (existing) {
      await db.put("routines", {
        ...existing,
        isDeleted: true,
        deletedAt: new Date().toISOString(),
      } as unknown as Record<string, unknown>);
    }
    await this.syncQueue.enqueue("routine", id, "delete");
  }

  async restoreRoutine(id: string): Promise<void> {
    const db = await getOfflineDb();
    const existing = (await db.get("routines", id)) as RoutineNode | undefined;
    if (existing) {
      await db.put("routines", {
        ...existing,
        isDeleted: false,
        deletedAt: null,
      } as unknown as Record<string, unknown>);
    }
  }

  async permanentDeleteRoutine(id: string): Promise<void> {
    const db = await getOfflineDb();
    await db.delete("routines", id);
  }

  // ============================================================
  // Schedule Items
  // ============================================================

  async fetchScheduleItemsByDate(date: string): Promise<ScheduleItem[]> {
    const all = await this.getAllFromStore<ScheduleItem>("scheduleItems");
    return all
      .filter((s) => s.date === date && !s.isDeleted)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  async fetchScheduleItemsByDateAll(date: string): Promise<ScheduleItem[]> {
    return this.fetchScheduleItemsByDate(date);
  }

  async fetchScheduleItemsByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ScheduleItem[]> {
    const all = await this.getAllFromStore<ScheduleItem>("scheduleItems");
    return all
      .filter((s) => s.date >= startDate && s.date <= endDate && !s.isDeleted)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.startTime.localeCompare(b.startTime),
      );
  }

  async createScheduleItem(
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
  ): Promise<ScheduleItem> {
    const item: ScheduleItem = {
      id,
      date,
      title,
      startTime,
      endTime,
      completed: false,
      completedAt: null,
      routineId: routineId ?? null,
      templateId: templateId ?? null,
      memo: null,
      content: content ?? null,
      noteId: noteId ?? null,
      isAllDay: isAllDay ?? false,
      isDeleted: false,
      deletedAt: null,
      reminderEnabled: false,
      reminderOffset: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const db = await getOfflineDb();
    await db.put("scheduleItems", item as unknown as Record<string, unknown>);
    await this.syncQueue.enqueue("scheduleItem", id, "create", item);
    return item;
  }

  async updateScheduleItem(
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
  ): Promise<ScheduleItem> {
    const db = await getOfflineDb();
    const existing = (await db.get("scheduleItems", id)) as
      | ScheduleItem
      | undefined;
    const merged = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    } as ScheduleItem;
    await db.put("scheduleItems", merged as unknown as Record<string, unknown>);
    await this.syncQueue.enqueue("scheduleItem", id, "update", updates);
    return merged;
  }

  async deleteScheduleItem(id: string): Promise<void> {
    const db = await getOfflineDb();
    await db.delete("scheduleItems", id);
    await this.syncQueue.enqueue("scheduleItem", id, "delete");
  }

  async toggleScheduleItemComplete(id: string): Promise<ScheduleItem> {
    const db = await getOfflineDb();
    const existing = (await db.get("scheduleItems", id)) as
      | ScheduleItem
      | undefined;
    if (!existing) throw new Error(`ScheduleItem not found: ${id}`);
    const updated = {
      ...existing,
      completed: !existing.completed,
      completedAt: !existing.completed ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    };
    await db.put(
      "scheduleItems",
      updated as unknown as Record<string, unknown>,
    );
    await this.syncQueue.enqueue("scheduleItem", id, "update", {
      completed: updated.completed,
      completedAt: updated.completedAt,
    });
    return updated;
  }

  async dismissScheduleItem(id: string): Promise<void> {
    const db = await getOfflineDb();
    const existing = (await db.get("scheduleItems", id)) as
      | ScheduleItem
      | undefined;
    if (existing) {
      await db.put("scheduleItems", {
        ...existing,
        dismissed: true,
        updatedAt: new Date().toISOString(),
      } as unknown as Record<string, unknown>);
    }
  }

  async bulkCreateScheduleItems(
    items: Array<{
      id: string;
      date: string;
      title: string;
      startTime: string;
      endTime: string;
      routineId?: string;
      templateId?: string;
      noteId?: string;
      reminderEnabled?: boolean;
      reminderOffset?: number;
    }>,
  ): Promise<ScheduleItem[]> {
    const results: ScheduleItem[] = [];
    for (const item of items) {
      results.push(
        await this.createScheduleItem(
          item.id,
          item.date,
          item.title,
          item.startTime,
          item.endTime,
          item.routineId,
          item.templateId,
          item.noteId,
        ),
      );
    }
    return results;
  }

  async fetchLastRoutineDate(): Promise<string | null> {
    const all = await this.getAllFromStore<ScheduleItem>("scheduleItems");
    const withRoutine = all.filter((s) => s.routineId);
    if (withRoutine.length === 0) return null;
    withRoutine.sort((a, b) => b.date.localeCompare(a.date));
    return withRoutine[0].date;
  }

  async updateFutureScheduleItemsByRoutine(
    routineId: string,
    updates: { title?: string; startTime?: string; endTime?: string },
    fromDate: string,
  ): Promise<number> {
    const db = await getOfflineDb();
    const all = await this.getAllFromStore<ScheduleItem>("scheduleItems");
    const targets = all.filter(
      (s) => s.routineId === routineId && s.date >= fromDate,
    );
    for (const item of targets) {
      const merged = {
        ...item,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      await db.put(
        "scheduleItems",
        merged as unknown as Record<string, unknown>,
      );
    }
    return targets.length;
  }

  fetchScheduleItemsByRoutineId(_routineId: string): Promise<ScheduleItem[]> {
    return notSupported("fetchScheduleItemsByRoutineId");
  }

  bulkDeleteScheduleItems(_ids: string[]): Promise<number> {
    return notSupported("bulkDeleteScheduleItems");
  }

  fetchEvents(): Promise<ScheduleItem[]> {
    return notSupported("fetchEvents");
  }

  softDeleteScheduleItem(_id: string): Promise<void> {
    return notSupported("softDeleteScheduleItem");
  }
  restoreScheduleItem(_id: string): Promise<void> {
    return notSupported("restoreScheduleItem");
  }
  permanentDeleteScheduleItem(_id: string): Promise<void> {
    return notSupported("permanentDeleteScheduleItem");
  }
  fetchDeletedScheduleItems(): Promise<ScheduleItem[]> {
    return notSupported("fetchDeletedScheduleItems");
  }
  undismissScheduleItem(_id: string): Promise<void> {
    return notSupported("undismissScheduleItem");
  }

  // ============================================================
  // Calendars
  // ============================================================

  async fetchCalendars(): Promise<CalendarNode[]> {
    return this.getAllFromStore<CalendarNode>("calendars");
  }

  async createCalendar(
    id: string,
    title: string,
    folderId: string,
  ): Promise<CalendarNode> {
    const cal: CalendarNode = {
      id,
      title,
      folderId,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const db = await getOfflineDb();
    await db.put("calendars", cal as unknown as Record<string, unknown>);
    await this.syncQueue.enqueue("calendar", id, "create", {
      title,
      folderId,
    });
    return cal;
  }

  async updateCalendar(
    id: string,
    updates: Partial<Pick<CalendarNode, "title" | "folderId" | "order">>,
  ): Promise<CalendarNode> {
    const db = await getOfflineDb();
    const existing = (await db.get("calendars", id)) as
      | CalendarNode
      | undefined;
    const merged = { ...existing, ...updates, id } as CalendarNode;
    merged.updatedAt = new Date().toISOString();
    await db.put("calendars", merged as unknown as Record<string, unknown>);
    await this.syncQueue.enqueue("calendar", id, "update", updates);
    return merged;
  }

  async deleteCalendar(id: string): Promise<void> {
    const db = await getOfflineDb();
    await db.delete("calendars", id);
    await this.syncQueue.enqueue("calendar", id, "delete");
  }

  // ============================================================
  // Wiki Tags
  // ============================================================

  async fetchWikiTags(): Promise<WikiTag[]> {
    return this.getAllFromStore<WikiTag>("wikiTags");
  }

  async searchWikiTags(query: string): Promise<WikiTag[]> {
    const all = await this.getAllFromStore<WikiTag>("wikiTags");
    const q = query.toLowerCase();
    return all.filter((t) => t.name.toLowerCase().includes(q));
  }

  createWikiTag(_name: string, _color: string): Promise<WikiTag> {
    return notSupported("WikiTag");
  }
  createWikiTagWithId(
    _id: string,
    _name: string,
    _color: string,
  ): Promise<WikiTag> {
    return notSupported("WikiTag");
  }
  updateWikiTag(
    _id: string,
    _updates: Partial<Pick<WikiTag, "name" | "color" | "textColor">>,
  ): Promise<WikiTag> {
    return notSupported("WikiTag");
  }
  deleteWikiTag(_id: string): Promise<void> {
    return notSupported("WikiTag");
  }
  mergeWikiTags(_sourceId: string, _targetId: string): Promise<WikiTag> {
    return notSupported("WikiTag");
  }
  fetchWikiTagsForEntity(_entityId: string): Promise<WikiTag[]> {
    return Promise.resolve([]);
  }
  setWikiTagsForEntity(
    _entityId: string,
    _entityType: string,
    _tagIds: string[],
  ): Promise<void> {
    return notSupported("WikiTag");
  }
  syncInlineWikiTags(
    _entityId: string,
    _entityType: string,
    _tagNames: string[],
  ): Promise<void> {
    return notSupported("WikiTag");
  }
  fetchAllWikiTagAssignments(): Promise<WikiTagAssignment[]> {
    return this.getAllFromStore("wikiTagAssignments");
  }
  restoreWikiTagAssignment(
    _tagId: string,
    _entityId: string,
    _entityType: string,
    _source: string,
  ): Promise<void> {
    return notSupported("WikiTag");
  }

  // ============================================================
  // Wiki Tag Groups
  // ============================================================

  fetchWikiTagGroups(): Promise<WikiTagGroup[]> {
    return Promise.resolve([]);
  }
  createWikiTagGroup(
    _name: string,
    _noteIds: string[],
    _filterTags?: string[],
  ): Promise<WikiTagGroup> {
    return notSupported("WikiTag");
  }
  updateWikiTagGroup(
    _id: string,
    _updates: { name?: string; filterTags?: string[] },
  ): Promise<WikiTagGroup> {
    return notSupported("WikiTag");
  }
  deleteWikiTagGroup(_id: string): Promise<void> {
    return notSupported("WikiTag");
  }
  fetchAllWikiTagGroupMembers(): Promise<WikiTagGroupMember[]> {
    return Promise.resolve([]);
  }
  setWikiTagGroupMembers(_groupId: string, _noteIds: string[]): Promise<void> {
    return notSupported("WikiTag");
  }
  addWikiTagGroupMember(_groupId: string, _noteId: string): Promise<void> {
    return notSupported("WikiTag");
  }
  removeWikiTagGroupMember(_groupId: string, _noteId: string): Promise<void> {
    return notSupported("WikiTag");
  }

  // ============================================================
  // Wiki Tag Connections
  // ============================================================

  fetchWikiTagConnections(): Promise<WikiTagConnection[]> {
    return this.getAllFromStore("wikiTagConnections");
  }
  createWikiTagConnection(
    _sourceTagId: string,
    _targetTagId: string,
  ): Promise<WikiTagConnection> {
    return notSupported("WikiTag");
  }
  deleteWikiTagConnection(_id: string): Promise<void> {
    return notSupported("WikiTag");
  }
  deleteWikiTagConnectionByPair(
    _sourceTagId: string,
    _targetTagId: string,
  ): Promise<void> {
    return notSupported("WikiTag");
  }

  // ============================================================
  // Note Connections
  // ============================================================

  fetchNoteConnections(): Promise<NoteConnection[]> {
    return this.getAllFromStore("noteConnections");
  }
  createNoteConnection(
    _sourceNoteId: string,
    _targetNoteId: string,
  ): Promise<NoteConnection> {
    return notSupported("NoteConnection");
  }
  deleteNoteConnection(_id: string): Promise<void> {
    return notSupported("NoteConnection");
  }
  deleteNoteConnectionByPair(
    _sourceNoteId: string,
    _targetNoteId: string,
  ): Promise<void> {
    return notSupported("NoteConnection");
  }

  // ============================================================
  // Time Memos
  // ============================================================

  async fetchTimeMemosByDate(date: string): Promise<TimeMemo[]> {
    const all = await this.getAllFromStore<TimeMemo>("timeMemos");
    return all.filter((t) => t.date === date).sort((a, b) => a.hour - b.hour);
  }

  async upsertTimeMemo(
    id: string,
    date: string,
    hour: number,
    content: string,
  ): Promise<TimeMemo> {
    const db = await getOfflineDb();
    const existing = (await db.get("timeMemos", id)) as TimeMemo | undefined;
    const memo: TimeMemo = {
      id,
      date,
      hour,
      content,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.put("timeMemos", memo as unknown as Record<string, unknown>);
    await this.syncQueue.enqueue("timeMemo", id, "update", {
      date,
      hour,
      content,
    });
    return memo;
  }

  async deleteTimeMemo(id: string): Promise<void> {
    const db = await getOfflineDb();
    await db.delete("timeMemos", id);
    await this.syncQueue.enqueue("timeMemo", id, "delete");
  }

  // ============================================================
  // Timer
  // ============================================================

  async fetchTimerSettings(): Promise<TimerSettings> {
    const db = await getOfflineDb();
    const stored = await db.get("timerSettings", "settings");
    if (stored) return stored as unknown as TimerSettings;
    return { ...DEFAULT_TIMER_SETTINGS };
  }

  async updateTimerSettings(
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
    const current = await this.fetchTimerSettings();
    const merged = { ...current, ...settings, key: "settings" };
    const db = await getOfflineDb();
    await db.put("timerSettings", merged as unknown as Record<string, unknown>);
    return merged;
  }

  async startTimerSession(
    sessionType: SessionType,
    taskId?: string,
  ): Promise<TimerSession> {
    const db = await getOfflineDb();
    const session = {
      sessionType,
      taskId: taskId ?? null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      duration: 0,
      completed: false,
    };
    const id = await db.add(
      "timerSessions",
      session as unknown as Record<string, unknown>,
    );
    return { ...session, id: id as number } as unknown as TimerSession;
  }

  async endTimerSession(
    id: number,
    duration: number,
    completed: boolean,
  ): Promise<TimerSession> {
    const db = await getOfflineDb();
    const existing = (await db.get("timerSessions", id)) as
      | Record<string, unknown>
      | undefined;
    if (!existing) throw new Error(`TimerSession not found: ${id}`);
    const updated = {
      ...existing,
      duration,
      completed,
      endedAt: new Date().toISOString(),
    };
    await db.put("timerSessions", updated);
    return updated as unknown as TimerSession;
  }

  async fetchTimerSessions(): Promise<TimerSession[]> {
    const db = await getOfflineDb();
    return (await db.getAll("timerSessions")) as unknown as TimerSession[];
  }

  async fetchSessionsByTaskId(taskId: string): Promise<TimerSession[]> {
    const db = await getOfflineDb();
    return (await db.getAllFromIndex(
      "timerSessions",
      "by-taskId",
      taskId,
    )) as unknown as TimerSession[];
  }

  // ============================================================
  // Pomodoro Presets
  // ============================================================

  async fetchPomodoroPresets(): Promise<PomodoroPreset[]> {
    const db = await getOfflineDb();
    return (await db.getAll("pomodoroPresets")) as unknown as PomodoroPreset[];
  }

  async createPomodoroPreset(
    preset: Omit<PomodoroPreset, "id" | "createdAt">,
  ): Promise<PomodoroPreset> {
    const db = await getOfflineDb();
    const data = { ...preset, createdAt: new Date().toISOString() };
    const id = await db.add(
      "pomodoroPresets",
      data as unknown as Record<string, unknown>,
    );
    return { ...data, id: id as number } as PomodoroPreset;
  }

  async updatePomodoroPreset(
    id: number,
    updates: Partial<Omit<PomodoroPreset, "id" | "createdAt">>,
  ): Promise<PomodoroPreset> {
    const db = await getOfflineDb();
    const existing = (await db.get("pomodoroPresets", id)) as
      | Record<string, unknown>
      | undefined;
    if (!existing) throw new Error(`PomodoroPreset not found: ${id}`);
    const merged = { ...existing, ...updates };
    await db.put("pomodoroPresets", merged);
    return merged as unknown as PomodoroPreset;
  }

  async deletePomodoroPreset(id: number): Promise<void> {
    const db = await getOfflineDb();
    await db.delete("pomodoroPresets", id);
  }

  // ============================================================
  // Routine Tags (empty returns — mobile UI works without data)
  // ============================================================

  fetchRoutineTags(): Promise<RoutineTag[]> {
    return Promise.resolve([]);
  }
  createRoutineTag(_name: string, _color: string): Promise<RoutineTag> {
    return notSupported("RoutineTag");
  }
  updateRoutineTag(
    _id: number,
    _updates: Partial<
      Pick<RoutineTag, "name" | "color" | "textColor" | "order">
    >,
  ): Promise<RoutineTag> {
    return notSupported("RoutineTag");
  }
  deleteRoutineTag(_id: number): Promise<void> {
    return notSupported("RoutineTag");
  }
  fetchAllRoutineTagAssignments(): Promise<
    Array<{ routine_id: string; tag_id: number }>
  > {
    return Promise.resolve([]);
  }
  setTagsForRoutine(_routineId: string, _tagIds: number[]): Promise<void> {
    return notSupported("RoutineTag");
  }

  // ============================================================
  // Calendar Tags (empty returns)
  // ============================================================

  fetchCalendarTags(): Promise<CalendarTag[]> {
    return Promise.resolve([]);
  }
  createCalendarTag(_name: string, _color: string): Promise<CalendarTag> {
    return notSupported("CalendarTag");
  }
  updateCalendarTag(
    _id: number,
    _updates: Partial<
      Pick<CalendarTag, "name" | "color" | "textColor" | "order">
    >,
  ): Promise<CalendarTag> {
    return notSupported("CalendarTag");
  }
  deleteCalendarTag(_id: number): Promise<void> {
    return notSupported("CalendarTag");
  }
  fetchAllCalendarTagAssignments(): Promise<
    Array<{ schedule_item_id: string; tag_id: number }>
  > {
    return Promise.resolve([]);
  }
  setTagsForScheduleItem(
    _scheduleItemId: string,
    _tagIds: number[],
  ): Promise<void> {
    return notSupported("CalendarTag");
  }

  // ============================================================
  // Routine Groups (empty returns)
  // ============================================================

  fetchRoutineGroups(): Promise<RoutineGroup[]> {
    return Promise.resolve([]);
  }
  createRoutineGroup(
    _id: string,
    _name: string,
    _color: string,
    _frequencyType?: string,
    _frequencyDays?: number[],
    _frequencyInterval?: number | null,
    _frequencyStartDate?: string | null,
  ): Promise<RoutineGroup> {
    return notSupported("RoutineGroup");
  }
  updateRoutineGroup(
    _id: string,
    _updates: Partial<
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
  ): Promise<RoutineGroup> {
    return notSupported("RoutineGroup");
  }
  deleteRoutineGroup(_id: string): Promise<void> {
    return notSupported("RoutineGroup");
  }
  fetchAllRoutineGroupTagAssignments(): Promise<
    Array<{ group_id: string; tag_id: number }>
  > {
    return Promise.resolve([]);
  }
  setTagsForRoutineGroup(_groupId: string, _tagIds: number[]): Promise<void> {
    return notSupported("RoutineGroup");
  }

  // ============================================================
  // Playlists (not supported on mobile)
  // ============================================================

  fetchPlaylists(): Promise<Playlist[]> {
    return notSupported("Playlist");
  }
  createPlaylist(_id: string, _name: string): Promise<Playlist> {
    return notSupported("Playlist");
  }
  updatePlaylist(
    _id: string,
    _updates: Partial<
      Pick<Playlist, "name" | "sortOrder" | "repeatMode" | "isShuffle">
    >,
  ): Promise<Playlist> {
    return notSupported("Playlist");
  }
  deletePlaylist(_id: string): Promise<void> {
    return notSupported("Playlist");
  }
  fetchPlaylistItems(_playlistId: string): Promise<PlaylistItem[]> {
    return notSupported("Playlist");
  }
  fetchAllPlaylistItems(): Promise<PlaylistItem[]> {
    return notSupported("Playlist");
  }
  addPlaylistItem(
    _id: string,
    _playlistId: string,
    _soundId: string,
  ): Promise<PlaylistItem> {
    return notSupported("Playlist");
  }
  removePlaylistItem(_itemId: string): Promise<void> {
    return notSupported("Playlist");
  }
  reorderPlaylistItems(_playlistId: string, _itemIds: string[]): Promise<void> {
    return notSupported("Playlist");
  }

  // ============================================================
  // Not supported on mobile
  // ============================================================

  // Sound
  fetchSoundSettings(): Promise<SoundSettings[]> {
    return notSupported("Sound");
  }
  updateSoundSetting(
    _s: string,
    _v: number,
    _e: boolean,
  ): Promise<SoundSettings> {
    return notSupported("Sound");
  }
  fetchSoundPresets(): Promise<SoundPreset[]> {
    return notSupported("Sound");
  }
  createSoundPreset(_n: string, _s: string): Promise<SoundPreset> {
    return notSupported("Sound");
  }
  deleteSoundPreset(_id: number): Promise<void> {
    return notSupported("Sound");
  }
  fetchAllSoundTags(): Promise<SoundTag[]> {
    return notSupported("Sound");
  }
  createSoundTag(_n: string, _c: string): Promise<SoundTag> {
    return notSupported("Sound");
  }
  updateSoundTag(
    _id: number,
    _u: { name?: string; color?: string; textColor?: string | null },
  ): Promise<SoundTag> {
    return notSupported("Sound");
  }
  deleteSoundTag(_id: number): Promise<void> {
    return notSupported("Sound");
  }
  fetchTagsForSound(_id: string): Promise<SoundTag[]> {
    return notSupported("Sound");
  }
  setTagsForSound(_id: string, _tids: number[]): Promise<void> {
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
  updateSoundDisplayMeta(_s: string, _d: string): Promise<void> {
    return notSupported("Sound");
  }
  fetchWorkscreenSelections(): Promise<
    Array<{ soundId: string; displayOrder: number }>
  > {
    return notSupported("Sound");
  }
  setWorkscreenSelections(_ids: string[]): Promise<void> {
    return notSupported("Sound");
  }

  // Custom Sound
  saveCustomSound(
    _id: string,
    _d: ArrayBuffer,
    _m: CustomSoundMeta,
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
  updateCustomSoundLabel(_id: string, _label: string): Promise<void> {
    return notSupported("Custom Sound");
  }

  // Data I/O
  exportData(): Promise<boolean> {
    return notSupported("Data I/O");
  }
  importData(): Promise<boolean> {
    return notSupported("Data I/O");
  }
  resetData(): Promise<boolean> {
    return notSupported("Data I/O");
  }

  // Diagnostics
  fetchLogs(_o?: { level?: string; limit?: number }): Promise<LogEntry[]> {
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

  // Paper Boards
  fetchPaperBoards(): Promise<PaperBoard[]> {
    return notSupported("Paper Boards");
  }
  fetchPaperBoardById(_id: string): Promise<PaperBoard | null> {
    return notSupported("Paper Boards");
  }
  fetchPaperBoardByNoteId(_nid: string): Promise<PaperBoard | null> {
    return notSupported("Paper Boards");
  }
  createPaperBoard(_n: string, _lid?: string | null): Promise<PaperBoard> {
    return notSupported("Paper Boards");
  }
  updatePaperBoard(
    _id: string,
    _u: Partial<
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
  fetchPaperNodesByBoard(_bid: string): Promise<PaperNode[]> {
    return notSupported("Paper Boards");
  }
  createPaperNode(_p: {
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
  }): Promise<PaperNode> {
    return notSupported("Paper Boards");
  }
  updatePaperNode(
    _id: string,
    _u: Partial<
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
  ): Promise<PaperNode> {
    return notSupported("Paper Boards");
  }
  bulkUpdatePaperNodePositions(
    _u: Array<{
      id: string;
      positionX: number;
      positionY: number;
      parentNodeId: string | null;
    }>,
  ): Promise<void> {
    return notSupported("Paper Boards");
  }
  bulkUpdatePaperNodeZIndices(
    _u: Array<{
      id: string;
      zIndex: number;
      parentNodeId: string | null;
    }>,
  ): Promise<void> {
    return notSupported("Paper Boards");
  }
  deletePaperNode(_id: string): Promise<void> {
    return notSupported("Paper Boards");
  }
  fetchPaperEdgesByBoard(_bid: string): Promise<PaperEdge[]> {
    return notSupported("Paper Boards");
  }
  createPaperEdge(_p: {
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

  // Shell
  openExternal(_url: string): Promise<void> {
    return notSupported("Shell");
  }
  openAttachmentFile(_id: string): Promise<void> {
    return notSupported("Shell");
  }

  // Attachments
  saveAttachment(_meta: AttachmentMeta, _data: ArrayBuffer): Promise<void> {
    return notSupported("Attachments");
  }
  loadAttachment(_id: string): Promise<ArrayBuffer | null> {
    return notSupported("Attachments");
  }
  deleteAttachment(_id: string): Promise<void> {
    return notSupported("Attachments");
  }
  fetchAttachmentMetas(): Promise<AttachmentMeta[]> {
    return notSupported("Attachments");
  }

  // Updater
  checkForUpdates(): Promise<void> {
    return notSupported("Updater");
  }
  downloadUpdate(): Promise<void> {
    return notSupported("Updater");
  }
  installUpdate(): Promise<void> {
    return notSupported("Updater");
  }

  // Databases
  fetchAllDatabases(): Promise<never> {
    return notSupported("fetchAllDatabases");
  }
  fetchDatabaseFull(): Promise<never> {
    return notSupported("fetchDatabaseFull");
  }
  createDatabase(): Promise<never> {
    return notSupported("createDatabase");
  }
  updateDatabase(): Promise<never> {
    return notSupported("updateDatabase");
  }
  softDeleteDatabase(): Promise<never> {
    return notSupported("softDeleteDatabase");
  }
  permanentDeleteDatabase(): Promise<never> {
    return notSupported("permanentDeleteDatabase");
  }
  addDatabaseProperty(): Promise<never> {
    return notSupported("addDatabaseProperty");
  }
  updateDatabaseProperty(): Promise<never> {
    return notSupported("updateDatabaseProperty");
  }
  removeDatabaseProperty(): Promise<never> {
    return notSupported("removeDatabaseProperty");
  }
  addDatabaseRow(): Promise<never> {
    return notSupported("addDatabaseRow");
  }
  reorderDatabaseRows(): Promise<never> {
    return notSupported("reorderDatabaseRows");
  }
  removeDatabaseRow(): Promise<never> {
    return notSupported("removeDatabaseRow");
  }
  upsertDatabaseCell(): Promise<never> {
    return notSupported("upsertDatabaseCell");
  }

  // App Settings
  getAppSetting(): Promise<never> {
    return notSupported("getAppSetting");
  }
  setAppSetting(): Promise<never> {
    return notSupported("setAppSetting");
  }
  getAllAppSettings(): Promise<never> {
    return notSupported("getAllAppSettings");
  }
  removeAppSetting(): Promise<never> {
    return notSupported("removeAppSetting");
  }

  // System Integration
  getAutoLaunch(): Promise<never> {
    return notSupported("getAutoLaunch");
  }
  setAutoLaunch(): Promise<never> {
    return notSupported("setAutoLaunch");
  }
  getStartMinimized(): Promise<never> {
    return notSupported("getStartMinimized");
  }
  setStartMinimized(): Promise<never> {
    return notSupported("setStartMinimized");
  }
  getTrayEnabled(): Promise<never> {
    return notSupported("getTrayEnabled");
  }
  setTrayEnabled(): Promise<never> {
    return notSupported("setTrayEnabled");
  }
  getGlobalShortcuts(): Promise<never> {
    return notSupported("getGlobalShortcuts");
  }
  setGlobalShortcuts(): Promise<never> {
    return notSupported("setGlobalShortcuts");
  }
  reregisterGlobalShortcuts(): Promise<never> {
    return notSupported("reregisterGlobalShortcuts");
  }
  updateTrayTimer(): Promise<never> {
    return notSupported("updateTrayTimer");
  }

  // Reminders
  getReminderSettings(): Promise<never> {
    return notSupported("getReminderSettings");
  }
  setReminderSettings(): Promise<never> {
    return notSupported("setReminderSettings");
  }

  // Files
  selectFolder(): Promise<never> {
    return notSupported("selectFolder");
  }
  getFilesRootPath(): Promise<never> {
    return notSupported("getFilesRootPath");
  }
  listDirectory(): Promise<never> {
    return notSupported("listDirectory");
  }
  getFileInfo(): Promise<never> {
    return notSupported("getFileInfo");
  }
  readTextFile(): Promise<never> {
    return notSupported("readTextFile");
  }
  readFile(): Promise<never> {
    return notSupported("readFile");
  }
  createDirectory(): Promise<never> {
    return notSupported("createDirectory");
  }
  createFile(): Promise<never> {
    return notSupported("createFile");
  }
  writeTextFile(): Promise<never> {
    return notSupported("writeTextFile");
  }
  renameFile(): Promise<never> {
    return notSupported("renameFile");
  }
  moveFile(): Promise<never> {
    return notSupported("moveFile");
  }
  deleteFile(): Promise<never> {
    return notSupported("deleteFile");
  }
  openFileInSystem(): Promise<never> {
    return notSupported("openFileInSystem");
  }
  copyNoteToFile(): Promise<never> {
    return notSupported("copyNoteToFile");
  }
  copyMemoToFile(): Promise<never> {
    return notSupported("copyMemoToFile");
  }
  convertFileToTiptap(): Promise<never> {
    return notSupported("convertFileToTiptap");
  }
}
