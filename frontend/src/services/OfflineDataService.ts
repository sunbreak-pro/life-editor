import type { DataService } from "./DataService";
import { RestDataService } from "./RestDataService";
import { SyncQueue } from "./SyncQueue";
import { getOfflineDb } from "../db/indexedDb";
import { performFullSync, performIncrementalSync } from "../db/syncOperations";
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
import { notSupported } from "./notSupported";

export class OfflineDataService implements DataService {
  private rest = new RestDataService();
  private syncQueue = new SyncQueue();
  private initialSyncDone = false;
  private onQueueChange: (() => void) | null = null;

  constructor() {
    this.syncQueue.setConflictHandler(
      async (entityType, entityId, serverData) => {
        // Last-write-wins: update IndexedDB with server data
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
    if (this.initialSyncDone) return;
    try {
      await performIncrementalSync();
      this.initialSyncDone = true;
      // Flush any pending offline changes
      await this.syncQueue.flush();
    } catch {
      // Offline — we'll work from IndexedDB cache
      this.initialSyncDone = true;
    }
  }

  async triggerSync(): Promise<void> {
    try {
      await this.syncQueue.flush();
      await performIncrementalSync();
    } catch {
      // Offline — will retry later
    }
  }

  async triggerFullSync(): Promise<void> {
    try {
      await performFullSync();
    } catch {
      // Offline
    }
  }

  destroy(): void {
    this.syncQueue.destroy();
  }

  // --- Helper: try REST, fall back to IndexedDB ---

  private async withFallback<T>(
    _storeName: string,
    restCall: () => Promise<T>,
    idbFallback: () => Promise<T>,
    updateCache?: (result: T) => Promise<void>,
  ): Promise<T> {
    try {
      const result = await restCall();
      if (updateCache) await updateCache(result);
      return result;
    } catch {
      return idbFallback();
    }
  }

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

  fetchTaskTree(): Promise<TaskNode[]> {
    return this.withFallback(
      "tasks",
      async () => {
        const result = await this.rest.fetchTaskTree();
        const db = await getOfflineDb();
        const tx = db.transaction("tasks", "readwrite");
        for (const t of result)
          tx.objectStore("tasks").put(t as unknown as Record<string, unknown>);
        await tx.done;
        return result;
      },
      () => this.getAllFromStore<TaskNode>("tasks", (t) => !t.isDeleted),
    );
  }

  fetchDeletedTasks(): Promise<TaskNode[]> {
    return this.withFallback(
      "tasks",
      () => this.rest.fetchDeletedTasks(),
      () => this.getAllFromStore<TaskNode>("tasks", (t) => !!t.isDeleted),
    );
  }

  async createTask(node: TaskNode): Promise<TaskNode> {
    // Optimistic: write to IndexedDB immediately
    const db = await getOfflineDb();
    await db.put("tasks", node as unknown as Record<string, unknown>);
    await this.syncQueue.enqueue("task", node.id, "create", node);
    try {
      const result = await this.rest.createTask(node);
      await db.put("tasks", result as unknown as Record<string, unknown>);
      return result;
    } catch {
      return node;
    }
  }

  async updateTask(id: string, updates: Partial<TaskNode>): Promise<TaskNode> {
    const db = await getOfflineDb();
    const existing = (await db.get("tasks", id)) as TaskNode | undefined;
    const merged = { ...existing, ...updates, id } as TaskNode;
    await db.put("tasks", merged as unknown as Record<string, unknown>);
    await this.syncQueue.enqueue("task", id, "update", updates);
    try {
      return await this.rest.updateTask(id, updates);
    } catch {
      return merged;
    }
  }

  async syncTaskTree(nodes: TaskNode[]): Promise<void> {
    try {
      await this.rest.syncTaskTree(nodes);
    } catch {
      // Queue each node update
      for (const node of nodes) {
        await this.syncQueue.enqueue("task", node.id, "update", node);
      }
    }
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
    try {
      await this.rest.softDeleteTask(id);
    } catch {
      // queued
    }
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
    try {
      await this.rest.restoreTask(id);
    } catch {
      // Will sync on reconnect
    }
  }

  async permanentDeleteTask(id: string): Promise<void> {
    const db = await getOfflineDb();
    await db.delete("tasks", id);
    try {
      await this.rest.permanentDeleteTask(id);
    } catch {
      // queued
    }
  }

  migrateTasksToBackend(): Promise<void> {
    return notSupported("migrateTasksToBackend");
  }

  // ============================================================
  // Memos
  // ============================================================

  fetchAllMemos(): Promise<MemoNode[]> {
    return this.withFallback(
      "memos",
      async () => {
        const result = await this.rest.fetchAllMemos();
        const db = await getOfflineDb();
        const tx = db.transaction("memos", "readwrite");
        for (const m of result)
          tx.objectStore("memos").put(m as unknown as Record<string, unknown>);
        await tx.done;
        return result;
      },
      () => this.getAllFromStore<MemoNode>("memos", (m) => !m.isDeleted),
    );
  }

  async fetchMemoByDate(date: string): Promise<MemoNode | null> {
    try {
      return await this.rest.fetchMemoByDate(date);
    } catch {
      const all = await this.getAllFromStore<MemoNode>("memos");
      return all.find((m) => m.date === date) ?? null;
    }
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
    try {
      return await this.rest.upsertMemo(date, content);
    } catch {
      return memo;
    }
  }

  async deleteMemo(date: string): Promise<void> {
    const id = `memo-${date}`;
    await this.syncQueue.enqueue("memo", id, "delete");
    try {
      await this.rest.deleteMemo(date);
    } catch {
      // queued
    }
  }

  fetchDeletedMemos(): Promise<MemoNode[]> {
    return this.withFallback(
      "memos",
      () => this.rest.fetchDeletedMemos(),
      () => this.getAllFromStore<MemoNode>("memos", (m) => !!m.isDeleted),
    );
  }

  async restoreMemo(date: string): Promise<void> {
    try {
      await this.rest.restoreMemo(date);
    } catch {
      // offline
    }
  }

  async permanentDeleteMemo(date: string): Promise<void> {
    const id = `memo-${date}`;
    const db = await getOfflineDb();
    await db.delete("memos", id);
    try {
      await this.rest.permanentDeleteMemo(date);
    } catch {
      // offline
    }
  }

  async toggleMemoPin(date: string): Promise<MemoNode> {
    try {
      return await this.rest.toggleMemoPin(date);
    } catch {
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

  fetchAllNotes(): Promise<NoteNode[]> {
    return this.withFallback(
      "notes",
      async () => {
        const result = await this.rest.fetchAllNotes();
        const db = await getOfflineDb();
        const tx = db.transaction("notes", "readwrite");
        for (const n of result)
          tx.objectStore("notes").put(n as unknown as Record<string, unknown>);
        await tx.done;
        return result;
      },
      () => this.getAllFromStore<NoteNode>("notes", (n) => !n.isDeleted),
    );
  }

  fetchDeletedNotes(): Promise<NoteNode[]> {
    return this.withFallback(
      "notes",
      () => this.rest.fetchDeletedNotes(),
      () => this.getAllFromStore<NoteNode>("notes", (n) => !!n.isDeleted),
    );
  }

  async createNote(id: string, title: string): Promise<NoteNode> {
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
    try {
      return await this.rest.createNote(id, title);
    } catch {
      return note;
    }
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
    try {
      return await this.rest.updateNote(id, updates);
    } catch {
      return merged;
    }
  }

  async softDeleteNote(id: string): Promise<void> {
    await this.syncQueue.enqueue("note", id, "delete");
    try {
      await this.rest.softDeleteNote(id);
    } catch {
      // queued
    }
  }

  async restoreNote(id: string): Promise<void> {
    try {
      await this.rest.restoreNote(id);
    } catch {
      // offline
    }
  }

  async permanentDeleteNote(id: string): Promise<void> {
    const db = await getOfflineDb();
    await db.delete("notes", id);
    try {
      await this.rest.permanentDeleteNote(id);
    } catch {
      // offline
    }
  }

  searchNotes(query: string): Promise<NoteNode[]> {
    return this.withFallback(
      "notes",
      () => this.rest.searchNotes(query),
      async () => {
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
      },
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
  // Routines (delegate to REST with offline fallback reads)
  // ============================================================

  fetchAllRoutines(): Promise<RoutineNode[]> {
    return this.withFallback(
      "routines",
      async () => {
        const result = await this.rest.fetchAllRoutines();
        const db = await getOfflineDb();
        const tx = db.transaction("routines", "readwrite");
        for (const r of result)
          tx.objectStore("routines").put(
            r as unknown as Record<string, unknown>,
          );
        await tx.done;
        return result;
      },
      () =>
        this.getAllFromStore<RoutineNode>(
          "routines",
          (r) => !r.isDeleted && !r.isArchived,
        ),
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
    try {
      return await this.rest.createRoutine(
        id,
        title,
        startTime,
        endTime,
        frequencyType,
        frequencyDays,
        frequencyInterval,
        frequencyStartDate,
        reminderEnabled,
        reminderOffset,
      );
    } catch {
      const routine: RoutineNode = {
        id,
        title,
        startTime: startTime ?? null,
        endTime: endTime ?? null,
        isArchived: false,
        isDeleted: false,
        deletedAt: null,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const db = await getOfflineDb();
      await db.put("routines", routine as unknown as Record<string, unknown>);
      await this.syncQueue.enqueue("routine", id, "create", {
        title,
        startTime,
        endTime,
      });
      return routine;
    }
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
      >
    >,
  ): Promise<RoutineNode> {
    try {
      return await this.rest.updateRoutine(id, updates);
    } catch {
      const db = await getOfflineDb();
      const existing = (await db.get("routines", id)) as
        | RoutineNode
        | undefined;
      const merged = { ...existing, ...updates, id } as RoutineNode;
      await db.put("routines", merged as unknown as Record<string, unknown>);
      await this.syncQueue.enqueue("routine", id, "update", updates);
      return merged;
    }
  }

  async deleteRoutine(id: string): Promise<void> {
    try {
      await this.rest.deleteRoutine(id);
    } catch {
      await this.syncQueue.enqueue("routine", id, "delete");
    }
  }

  fetchDeletedRoutines(): Promise<RoutineNode[]> {
    return this.withFallback(
      "routines",
      () => this.rest.fetchDeletedRoutines(),
      () => this.getAllFromStore<RoutineNode>("routines", (r) => !!r.isDeleted),
    );
  }

  async softDeleteRoutine(id: string): Promise<void> {
    await this.syncQueue.enqueue("routine", id, "delete");
    try {
      await this.rest.softDeleteRoutine(id);
    } catch {
      // queued
    }
  }

  async restoreRoutine(id: string): Promise<void> {
    try {
      await this.rest.restoreRoutine(id);
    } catch {
      // offline
    }
  }

  async permanentDeleteRoutine(id: string): Promise<void> {
    const db = await getOfflineDb();
    await db.delete("routines", id);
    try {
      await this.rest.permanentDeleteRoutine(id);
    } catch {
      // offline
    }
  }

  // ============================================================
  // Schedule Items
  // ============================================================

  fetchScheduleItemsByDate(date: string): Promise<ScheduleItem[]> {
    return this.withFallback(
      "scheduleItems",
      async () => {
        const result = await this.rest.fetchScheduleItemsByDate(date);
        const db = await getOfflineDb();
        const tx = db.transaction("scheduleItems", "readwrite");
        for (const s of result)
          tx.objectStore("scheduleItems").put(
            s as unknown as Record<string, unknown>,
          );
        await tx.done;
        return result;
      },
      async () => {
        const all = await this.getAllFromStore<ScheduleItem>("scheduleItems");
        return all
          .filter((s) => s.date === date)
          .sort((a, b) => a.startTime.localeCompare(b.startTime));
      },
    );
  }

  async fetchScheduleItemsByDateAll(date: string): Promise<ScheduleItem[]> {
    return this.fetchScheduleItemsByDate(date);
  }

  fetchScheduleItemsByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ScheduleItem[]> {
    return this.withFallback(
      "scheduleItems",
      () => this.rest.fetchScheduleItemsByDateRange(startDate, endDate),
      async () => {
        const all = await this.getAllFromStore<ScheduleItem>("scheduleItems");
        return all
          .filter((s) => s.date >= startDate && s.date <= endDate)
          .sort(
            (a, b) =>
              a.date.localeCompare(b.date) ||
              a.startTime.localeCompare(b.startTime),
          );
      },
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
  ): Promise<ScheduleItem> {
    try {
      return await this.rest.createScheduleItem(
        id,
        date,
        title,
        startTime,
        endTime,
        routineId,
        templateId,
        noteId,
        isAllDay,
      );
    } catch {
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
        noteId: noteId ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const db = await getOfflineDb();
      await db.put("scheduleItems", item as unknown as Record<string, unknown>);
      await this.syncQueue.enqueue("scheduleItem", id, "create", {
        date,
        title,
        startTime,
        endTime,
        routineId,
        templateId,
      });
      return item;
    }
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
        | "date"
      >
    >,
  ): Promise<ScheduleItem> {
    try {
      return await this.rest.updateScheduleItem(id, updates);
    } catch {
      const db = await getOfflineDb();
      const existing = (await db.get("scheduleItems", id)) as
        | ScheduleItem
        | undefined;
      const merged = { ...existing, ...updates, id } as ScheduleItem;
      await db.put(
        "scheduleItems",
        merged as unknown as Record<string, unknown>,
      );
      await this.syncQueue.enqueue("scheduleItem", id, "update", updates);
      return merged;
    }
  }

  async deleteScheduleItem(id: string): Promise<void> {
    const db = await getOfflineDb();
    await db.delete("scheduleItems", id);
    await this.syncQueue.enqueue("scheduleItem", id, "delete");
    try {
      await this.rest.deleteScheduleItem(id);
    } catch {
      // queued
    }
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

  async toggleScheduleItemComplete(id: string): Promise<ScheduleItem> {
    try {
      return await this.rest.toggleScheduleItemComplete(id);
    } catch {
      const db = await getOfflineDb();
      const existing = (await db.get("scheduleItems", id)) as
        | ScheduleItem
        | undefined;
      if (!existing) throw new Error(`ScheduleItem not found: ${id}`);
      const updated = {
        ...existing,
        completed: !existing.completed,
        completedAt: !existing.completed ? new Date().toISOString() : null,
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
  }

  async dismissScheduleItem(id: string): Promise<void> {
    try {
      await this.rest.dismissScheduleItem(id);
    } catch {
      // queued
    }
  }

  async undismissScheduleItem(_id: string): Promise<void> {
    return notSupported("undismissScheduleItem");
  }

  async fetchLastRoutineDate(): Promise<string | null> {
    return this.rest.fetchLastRoutineDate();
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
    try {
      return await this.rest.bulkCreateScheduleItems(items);
    } catch {
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
          ),
        );
      }
      return results;
    }
  }

  async updateFutureScheduleItemsByRoutine(
    routineId: string,
    updates: { title?: string; startTime?: string; endTime?: string },
    fromDate: string,
  ): Promise<number> {
    return this.rest.updateFutureScheduleItemsByRoutine(
      routineId,
      updates,
      fromDate,
    );
  }

  async fetchScheduleItemsByRoutineId(
    routineId: string,
  ): Promise<ScheduleItem[]> {
    return notSupported("fetchScheduleItemsByRoutineId");
  }

  async bulkDeleteScheduleItems(ids: string[]): Promise<number> {
    return notSupported("bulkDeleteScheduleItems");
  }

  async fetchEvents(): Promise<ScheduleItem[]> {
    return notSupported("fetchEvents");
  }

  // ============================================================
  // Calendars
  // ============================================================

  fetchCalendars(): Promise<CalendarNode[]> {
    return this.withFallback(
      "calendars",
      async () => {
        const result = await this.rest.fetchCalendars();
        const db = await getOfflineDb();
        const tx = db.transaction("calendars", "readwrite");
        for (const c of result)
          tx.objectStore("calendars").put(
            c as unknown as Record<string, unknown>,
          );
        await tx.done;
        return result;
      },
      () => this.getAllFromStore<CalendarNode>("calendars"),
    );
  }

  async createCalendar(
    id: string,
    title: string,
    folderId: string,
  ): Promise<CalendarNode> {
    try {
      return await this.rest.createCalendar(id, title, folderId);
    } catch {
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
  }

  async updateCalendar(
    id: string,
    updates: Partial<Pick<CalendarNode, "title" | "folderId" | "order">>,
  ): Promise<CalendarNode> {
    try {
      return await this.rest.updateCalendar(id, updates);
    } catch {
      const db = await getOfflineDb();
      const existing = (await db.get("calendars", id)) as
        | CalendarNode
        | undefined;
      const merged = { ...existing, ...updates, id } as CalendarNode;
      await db.put("calendars", merged as unknown as Record<string, unknown>);
      await this.syncQueue.enqueue("calendar", id, "update", updates);
      return merged;
    }
  }

  async deleteCalendar(id: string): Promise<void> {
    const db = await getOfflineDb();
    await db.delete("calendars", id);
    await this.syncQueue.enqueue("calendar", id, "delete");
    try {
      await this.rest.deleteCalendar(id);
    } catch {
      // queued
    }
  }

  // ============================================================
  // Wiki Tags — delegate reads with offline fallback
  // ============================================================

  fetchWikiTags(): Promise<WikiTag[]> {
    return this.withFallback(
      "wikiTags",
      async () => {
        const result = await this.rest.fetchWikiTags();
        const db = await getOfflineDb();
        const tx = db.transaction("wikiTags", "readwrite");
        for (const t of result)
          tx.objectStore("wikiTags").put(
            t as unknown as Record<string, unknown>,
          );
        await tx.done;
        return result;
      },
      () => this.getAllFromStore<WikiTag>("wikiTags"),
    );
  }

  searchWikiTags(query: string): Promise<WikiTag[]> {
    return this.withFallback(
      "wikiTags",
      () => this.rest.searchWikiTags(query),
      async () => {
        const all = await this.getAllFromStore<WikiTag>("wikiTags");
        const q = query.toLowerCase();
        return all.filter((t) => t.name.toLowerCase().includes(q));
      },
    );
  }

  // Simple pass-through for wiki tag writes (no offline support for complex tag operations)
  createWikiTag(name: string, color: string): Promise<WikiTag> {
    return this.rest.createWikiTag(name, color);
  }
  createWikiTagWithId(
    id: string,
    name: string,
    color: string,
  ): Promise<WikiTag> {
    return this.rest.createWikiTagWithId(id, name, color);
  }
  updateWikiTag(
    id: string,
    updates: Partial<Pick<WikiTag, "name" | "color" | "textColor">>,
  ): Promise<WikiTag> {
    return this.rest.updateWikiTag(id, updates);
  }
  deleteWikiTag(id: string): Promise<void> {
    return this.rest.deleteWikiTag(id);
  }
  mergeWikiTags(sourceId: string, targetId: string): Promise<WikiTag> {
    return this.rest.mergeWikiTags(sourceId, targetId);
  }
  fetchWikiTagsForEntity(entityId: string): Promise<WikiTag[]> {
    return this.rest.fetchWikiTagsForEntity(entityId);
  }
  setWikiTagsForEntity(
    entityId: string,
    entityType: string,
    tagIds: string[],
  ): Promise<void> {
    return this.rest.setWikiTagsForEntity(entityId, entityType, tagIds);
  }
  syncInlineWikiTags(
    entityId: string,
    entityType: string,
    tagNames: string[],
  ): Promise<void> {
    return this.rest.syncInlineWikiTags(entityId, entityType, tagNames);
  }
  fetchAllWikiTagAssignments(): Promise<WikiTagAssignment[]> {
    return this.rest.fetchAllWikiTagAssignments();
  }
  restoreWikiTagAssignment(
    tagId: string,
    entityId: string,
    entityType: string,
    source: string,
  ): Promise<void> {
    return this.rest.restoreWikiTagAssignment(
      tagId,
      entityId,
      entityType,
      source,
    );
  }

  // Wiki Tag Groups — pass through
  fetchWikiTagGroups(): Promise<WikiTagGroup[]> {
    return this.rest.fetchWikiTagGroups();
  }
  createWikiTagGroup(
    name: string,
    noteIds: string[],
    filterTags?: string[],
  ): Promise<WikiTagGroup> {
    return this.rest.createWikiTagGroup(name, noteIds, filterTags);
  }
  updateWikiTagGroup(
    id: string,
    updates: { name?: string; filterTags?: string[] },
  ): Promise<WikiTagGroup> {
    return this.rest.updateWikiTagGroup(id, updates);
  }
  deleteWikiTagGroup(id: string): Promise<void> {
    return this.rest.deleteWikiTagGroup(id);
  }
  fetchAllWikiTagGroupMembers(): Promise<WikiTagGroupMember[]> {
    return this.rest.fetchAllWikiTagGroupMembers();
  }
  setWikiTagGroupMembers(groupId: string, noteIds: string[]): Promise<void> {
    return this.rest.setWikiTagGroupMembers(groupId, noteIds);
  }
  addWikiTagGroupMember(groupId: string, noteId: string): Promise<void> {
    return this.rest.addWikiTagGroupMember(groupId, noteId);
  }
  removeWikiTagGroupMember(groupId: string, noteId: string): Promise<void> {
    return this.rest.removeWikiTagGroupMember(groupId, noteId);
  }

  // Wiki Tag Connections — pass through
  fetchWikiTagConnections(): Promise<WikiTagConnection[]> {
    return this.rest.fetchWikiTagConnections();
  }
  createWikiTagConnection(
    sourceTagId: string,
    targetTagId: string,
  ): Promise<WikiTagConnection> {
    return this.rest.createWikiTagConnection(sourceTagId, targetTagId);
  }
  deleteWikiTagConnection(id: string): Promise<void> {
    return this.rest.deleteWikiTagConnection(id);
  }
  deleteWikiTagConnectionByPair(
    sourceTagId: string,
    targetTagId: string,
  ): Promise<void> {
    return this.rest.deleteWikiTagConnectionByPair(sourceTagId, targetTagId);
  }

  // Note Connections — pass through
  fetchNoteConnections(): Promise<NoteConnection[]> {
    return this.rest.fetchNoteConnections();
  }
  createNoteConnection(
    sourceNoteId: string,
    targetNoteId: string,
  ): Promise<NoteConnection> {
    return this.rest.createNoteConnection(sourceNoteId, targetNoteId);
  }
  deleteNoteConnection(id: string): Promise<void> {
    return this.rest.deleteNoteConnection(id);
  }
  deleteNoteConnectionByPair(
    sourceNoteId: string,
    targetNoteId: string,
  ): Promise<void> {
    return this.rest.deleteNoteConnectionByPair(sourceNoteId, targetNoteId);
  }

  // ============================================================
  // Time Memos
  // ============================================================

  fetchTimeMemosByDate(date: string): Promise<TimeMemo[]> {
    return this.withFallback(
      "timeMemos",
      () => this.rest.fetchTimeMemosByDate(date),
      async () => {
        const all = await this.getAllFromStore<TimeMemo>("timeMemos");
        return all
          .filter((t) => t.date === date)
          .sort((a, b) => a.hour - b.hour);
      },
    );
  }

  async upsertTimeMemo(
    id: string,
    date: string,
    hour: number,
    content: string,
  ): Promise<TimeMemo> {
    try {
      return await this.rest.upsertTimeMemo(id, date, hour, content);
    } catch {
      const memo: TimeMemo = {
        id,
        date,
        hour,
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const db = await getOfflineDb();
      await db.put("timeMemos", memo as unknown as Record<string, unknown>);
      await this.syncQueue.enqueue("timeMemo", id, "update", {
        date,
        hour,
        content,
      });
      return memo;
    }
  }

  async deleteTimeMemo(id: string): Promise<void> {
    const db = await getOfflineDb();
    await db.delete("timeMemos", id);
    try {
      await this.rest.deleteTimeMemo(id);
    } catch {
      await this.syncQueue.enqueue("timeMemo", id, "delete");
    }
  }

  // ============================================================
  // Timer — pass through to REST (no offline timer support)
  // ============================================================

  fetchTimerSettings(): Promise<TimerSettings> {
    return this.rest.fetchTimerSettings();
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
    return this.rest.updateTimerSettings(settings);
  }
  startTimerSession(
    sessionType: SessionType,
    taskId?: string,
  ): Promise<TimerSession> {
    return this.rest.startTimerSession(sessionType, taskId);
  }
  endTimerSession(
    id: number,
    duration: number,
    completed: boolean,
  ): Promise<TimerSession> {
    return this.rest.endTimerSession(id, duration, completed);
  }
  fetchTimerSessions(): Promise<TimerSession[]> {
    return this.rest.fetchTimerSessions();
  }
  fetchSessionsByTaskId(taskId: string): Promise<TimerSession[]> {
    return this.rest.fetchSessionsByTaskId(taskId);
  }

  // Pomodoro Presets — pass through
  fetchPomodoroPresets(): Promise<PomodoroPreset[]> {
    return this.rest.fetchPomodoroPresets();
  }
  createPomodoroPreset(
    preset: Omit<PomodoroPreset, "id" | "createdAt">,
  ): Promise<PomodoroPreset> {
    return this.rest.createPomodoroPreset(preset);
  }
  updatePomodoroPreset(
    id: number,
    updates: Partial<Omit<PomodoroPreset, "id" | "createdAt">>,
  ): Promise<PomodoroPreset> {
    return this.rest.updatePomodoroPreset(id, updates);
  }
  deletePomodoroPreset(id: number): Promise<void> {
    return this.rest.deletePomodoroPreset(id);
  }

  // Routine Tags — pass through
  fetchRoutineTags(): Promise<RoutineTag[]> {
    return this.rest.fetchRoutineTags();
  }
  createRoutineTag(name: string, color: string): Promise<RoutineTag> {
    return this.rest.createRoutineTag(name, color);
  }
  updateRoutineTag(
    id: number,
    updates: Partial<
      Pick<RoutineTag, "name" | "color" | "textColor" | "order">
    >,
  ): Promise<RoutineTag> {
    return this.rest.updateRoutineTag(id, updates);
  }
  deleteRoutineTag(id: number): Promise<void> {
    return this.rest.deleteRoutineTag(id);
  }
  fetchAllRoutineTagAssignments(): Promise<
    Array<{ routine_id: string; tag_id: number }>
  > {
    return this.rest.fetchAllRoutineTagAssignments();
  }
  setTagsForRoutine(routineId: string, tagIds: number[]): Promise<void> {
    return this.rest.setTagsForRoutine(routineId, tagIds);
  }

  // Calendar Tags — pass through
  fetchCalendarTags(): Promise<CalendarTag[]> {
    return this.rest.fetchCalendarTags();
  }
  createCalendarTag(name: string, color: string): Promise<CalendarTag> {
    return this.rest.createCalendarTag(name, color);
  }
  updateCalendarTag(
    id: number,
    updates: Partial<
      Pick<CalendarTag, "name" | "color" | "textColor" | "order">
    >,
  ): Promise<CalendarTag> {
    return this.rest.updateCalendarTag(id, updates);
  }
  deleteCalendarTag(id: number): Promise<void> {
    return this.rest.deleteCalendarTag(id);
  }
  fetchAllCalendarTagAssignments(): Promise<
    Array<{ schedule_item_id: string; tag_id: number }>
  > {
    return this.rest.fetchAllCalendarTagAssignments();
  }
  setTagsForScheduleItem(
    scheduleItemId: string,
    tagIds: number[],
  ): Promise<void> {
    return this.rest.setTagsForScheduleItem(scheduleItemId, tagIds);
  }

  // Routine Groups — pass through
  fetchRoutineGroups(): Promise<RoutineGroup[]> {
    return this.rest.fetchRoutineGroups();
  }
  createRoutineGroup(
    id: string,
    name: string,
    color: string,
    frequencyType?: string,
    frequencyDays?: number[],
    frequencyInterval?: number | null,
    frequencyStartDate?: string | null,
  ): Promise<RoutineGroup> {
    return this.rest.createRoutineGroup(
      id,
      name,
      color,
      frequencyType,
      frequencyDays,
      frequencyInterval,
      frequencyStartDate,
    );
  }
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
  ): Promise<RoutineGroup> {
    return this.rest.updateRoutineGroup(id, updates);
  }
  deleteRoutineGroup(id: string): Promise<void> {
    return this.rest.deleteRoutineGroup(id);
  }
  fetchAllRoutineGroupTagAssignments(): Promise<
    Array<{ group_id: string; tag_id: number }>
  > {
    return this.rest.fetchAllRoutineGroupTagAssignments();
  }
  setTagsForRoutineGroup(groupId: string, tagIds: number[]): Promise<void> {
    return this.rest.setTagsForRoutineGroup(groupId, tagIds);
  }

  // Playlists — pass through
  fetchPlaylists(): Promise<Playlist[]> {
    return this.rest.fetchPlaylists();
  }
  createPlaylist(id: string, name: string): Promise<Playlist> {
    return this.rest.createPlaylist(id, name);
  }
  updatePlaylist(
    id: string,
    updates: Partial<
      Pick<Playlist, "name" | "sortOrder" | "repeatMode" | "isShuffle">
    >,
  ): Promise<Playlist> {
    return this.rest.updatePlaylist(id, updates);
  }
  deletePlaylist(id: string): Promise<void> {
    return this.rest.deletePlaylist(id);
  }
  fetchPlaylistItems(playlistId: string): Promise<PlaylistItem[]> {
    return this.rest.fetchPlaylistItems(playlistId);
  }
  fetchAllPlaylistItems(): Promise<PlaylistItem[]> {
    return this.rest.fetchAllPlaylistItems();
  }
  addPlaylistItem(
    id: string,
    playlistId: string,
    soundId: string,
  ): Promise<PlaylistItem> {
    return this.rest.addPlaylistItem(id, playlistId, soundId);
  }
  removePlaylistItem(itemId: string): Promise<void> {
    return this.rest.removePlaylistItem(itemId);
  }
  reorderPlaylistItems(playlistId: string, itemIds: string[]): Promise<void> {
    return this.rest.reorderPlaylistItems(playlistId, itemIds);
  }

  // ============================================================
  // Not supported on mobile — pass through
  // ============================================================

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

  exportData(): Promise<boolean> {
    return notSupported("Data I/O");
  }
  importData(): Promise<boolean> {
    return notSupported("Data I/O");
  }
  resetData(): Promise<boolean> {
    return notSupported("Data I/O");
  }

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
