import { Hono } from "hono";
import type Database from "better-sqlite3";
import { createTaskRepository } from "../../database/taskRepository";
import { createMemoRepository } from "../../database/memoRepository";
import { createNoteRepository } from "../../database/noteRepository";
import { createScheduleItemRepository } from "../../database/scheduleItemRepository";
import { createRoutineRepository } from "../../database/routineRepository";
import { createWikiTagRepository } from "../../database/wikiTagRepository";
import { createTimeMemoRepository } from "../../database/timeMemoRepository";
import { createCalendarRepository } from "../../database/calendarRepository";
import { broadcastChange } from "../broadcast";

const CHANGES_LIMIT = 500;

export function createSyncRoutes(db: Database.Database): Hono {
  const app = new Hono();

  // GET /full — Full data snapshot for initial sync
  app.get("/full", (c) => {
    const snapshot = db.transaction(() => {
      const taskRepo = createTaskRepository(db);
      const memoRepo = createMemoRepository(db);
      const noteRepo = createNoteRepository(db);
      const routineRepo = createRoutineRepository(db);
      const wikiTagRepo = createWikiTagRepository(db);
      const calendarRepo = createCalendarRepository(db);

      // Include both active and deleted records for full sync
      const activeTasks = taskRepo.fetchTree();
      const deletedTasks = taskRepo.fetchDeleted();

      const activeMemos = memoRepo.fetchAll();
      const deletedMemos = memoRepo.fetchDeleted();

      const activeNotes = noteRepo.fetchAll();
      const deletedNotes = noteRepo.fetchDeleted();

      const activeRoutines = routineRepo.fetchAll();
      const deletedRoutines = routineRepo.fetchDeleted();

      // Schedule items (no soft delete)
      const scheduleItems = db
        .prepare(
          `SELECT * FROM schedule_items ORDER BY date ASC, start_time ASC`,
        )
        .all();

      // Time memos (no soft delete)
      const timeMemos = db
        .prepare(`SELECT * FROM time_memos ORDER BY date ASC, hour ASC`)
        .all();

      return {
        tasks: [...activeTasks, ...deletedTasks],
        memos: [...activeMemos, ...deletedMemos],
        notes: [...activeNotes, ...deletedNotes],
        scheduleItems: mapScheduleItems(scheduleItems as ScheduleRow[]),
        routines: [...activeRoutines, ...deletedRoutines],
        wikiTags: wikiTagRepo.fetchAll(),
        wikiTagAssignments: wikiTagRepo.fetchAllAssignments(),
        wikiTagConnections: db
          .prepare(`SELECT * FROM wiki_tag_connections`)
          .all(),
        noteConnections: db.prepare(`SELECT * FROM note_connections`).all(),
        timeMemos: mapTimeMemos(timeMemos as TimeMemoRow[]),
        calendars: calendarRepo.fetchAll(),
        timestamp: new Date().toISOString(),
      };
    })();

    return c.json(snapshot);
  });

  // GET /changes?since=<iso_timestamp> — Incremental sync
  app.get("/changes", (c) => {
    const since = c.req.query("since");
    if (!since) {
      return c.json({ error: "Missing 'since' query parameter" }, 400);
    }

    const changes = db.transaction(() => {
      const fetchChanged = (table: string, limit: number) =>
        db
          .prepare(
            `SELECT * FROM ${table} WHERE updated_at > ? ORDER BY updated_at ASC LIMIT ?`,
          )
          .all(since, limit + 1);

      const tasks = fetchChanged("tasks", CHANGES_LIMIT) as TaskSyncRow[];
      const memos = fetchChanged("memos", CHANGES_LIMIT) as MemoSyncRow[];
      const notes = fetchChanged("notes", CHANGES_LIMIT) as NoteSyncRow[];
      const scheduleItems = fetchChanged(
        "schedule_items",
        CHANGES_LIMIT,
      ) as ScheduleRow[];
      const routines = fetchChanged(
        "routines",
        CHANGES_LIMIT,
      ) as RoutineSyncRow[];
      const wikiTags = fetchChanged(
        "wiki_tags",
        CHANGES_LIMIT,
      ) as WikiTagSyncRow[];
      const wikiTagAssignments = fetchChanged(
        "wiki_tag_assignments",
        CHANGES_LIMIT,
      );
      const wikiTagConnections = fetchChanged(
        "wiki_tag_connections",
        CHANGES_LIMIT,
      );
      const noteConnections = fetchChanged("note_connections", CHANGES_LIMIT);
      const timeMemos = fetchChanged(
        "time_memos",
        CHANGES_LIMIT,
      ) as TimeMemoRow[];
      const calendars = fetchChanged("calendars", CHANGES_LIMIT);

      // Check if any table has more than CHANGES_LIMIT records
      const hasMore = [
        tasks,
        memos,
        notes,
        scheduleItems,
        routines,
        wikiTags,
        wikiTagAssignments,
        wikiTagConnections,
        noteConnections,
        timeMemos,
        calendars,
      ].some((arr) => arr.length > CHANGES_LIMIT);

      // Trim to limit
      const trim = <T>(arr: T[]): T[] => arr.slice(0, CHANGES_LIMIT);

      return {
        tasks: mapTaskRows(trim(tasks)),
        memos: mapMemoRows(trim(memos)),
        notes: mapNoteRows(trim(notes)),
        scheduleItems: mapScheduleItems(trim(scheduleItems)),
        routines: mapRoutineRows(trim(routines)),
        wikiTags: mapWikiTagRows(trim(wikiTags)),
        wikiTagAssignments: mapWikiTagAssignmentRows(
          trim(wikiTagAssignments) as WikiTagAssignmentRow[],
        ),
        wikiTagConnections: mapWikiTagConnectionRows(
          trim(wikiTagConnections) as WikiTagConnectionRow[],
        ),
        noteConnections: mapNoteConnectionRows(
          trim(noteConnections) as NoteConnectionRow[],
        ),
        timeMemos: mapTimeMemos(trim(timeMemos)),
        calendars: trim(calendars),
        timestamp: new Date().toISOString(),
        hasMore,
      };
    })();

    return c.json(changes);
  });

  // POST /batch — Apply batch of changes from offline queue
  app.post("/batch", async (c) => {
    const body = await c.req.json<{
      operations: Array<{
        entityType: string;
        action: string;
        entityId: string;
        data?: Record<string, unknown>;
        version?: number;
      }>;
    }>();

    const results = db.transaction(() => {
      return body.operations.map((op) => {
        try {
          return applyOperation(db, op);
        } catch (err) {
          return {
            entityType: op.entityType,
            entityId: op.entityId,
            status: "error" as const,
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      });
    })();

    // Broadcast changes for successful operations
    for (const result of results) {
      if (result.status === "success") {
        broadcastChange(result.entityType, "update", result.entityId);
      }
    }

    return c.json({
      results,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

// --- Operation handler ---

interface OperationResult {
  entityType: string;
  entityId: string;
  status: "success" | "conflict" | "error";
  serverVersion?: number;
  serverData?: unknown;
  error?: string;
}

function applyOperation(
  db: Database.Database,
  op: {
    entityType: string;
    action: string;
    entityId: string;
    data?: Record<string, unknown>;
    version?: number;
  },
): OperationResult {
  const tableMap: Record<string, string> = {
    task: "tasks",
    memo: "memos",
    note: "notes",
    scheduleItem: "schedule_items",
    routine: "routines",
    wikiTag: "wiki_tags",
    timeMemo: "time_memos",
    calendar: "calendars",
  };

  const table = tableMap[op.entityType];
  if (!table) {
    return {
      entityType: op.entityType,
      entityId: op.entityId,
      status: "error",
      error: `Unknown entity type: ${op.entityType}`,
    };
  }

  // Version check for optimistic locking
  if (op.version != null && op.action !== "create") {
    const existing = db
      .prepare(`SELECT version FROM ${table} WHERE id = ?`)
      .get(op.entityId) as { version: number } | undefined;

    if (existing && existing.version !== op.version) {
      const serverRow = db
        .prepare(`SELECT * FROM ${table} WHERE id = ?`)
        .get(op.entityId);
      return {
        entityType: op.entityType,
        entityId: op.entityId,
        status: "conflict",
        serverVersion: existing.version,
        serverData: serverRow,
      };
    }
  }

  // Delegate to entity-specific repositories
  switch (op.entityType) {
    case "task":
      return applyTaskOp(db, op);
    case "memo":
      return applyMemoOp(db, op);
    case "note":
      return applyNoteOp(db, op);
    case "scheduleItem":
      return applyScheduleItemOp(db, op);
    case "routine":
      return applyRoutineOp(db, op);
    case "wikiTag":
      return applyWikiTagOp(db, op);
    case "timeMemo":
      return applyTimeMemoOp(db, op);
    case "calendar":
      return applyCalendarOp(db, op);
    default:
      return {
        entityType: op.entityType,
        entityId: op.entityId,
        status: "error",
        error: `Unhandled entity type: ${op.entityType}`,
      };
  }
}

function applyTaskOp(
  db: Database.Database,
  op: { action: string; entityId: string; data?: Record<string, unknown> },
): OperationResult {
  const repo = createTaskRepository(db);
  if (op.action === "create" && op.data) {
    repo.create(op.data as never);
  } else if (op.action === "update" && op.data) {
    repo.update(op.entityId, op.data as never);
  } else if (op.action === "delete") {
    repo.softDelete(op.entityId);
  }
  return { entityType: "task", entityId: op.entityId, status: "success" };
}

function applyMemoOp(
  db: Database.Database,
  op: { action: string; entityId: string; data?: Record<string, unknown> },
): OperationResult {
  const repo = createMemoRepository(db);
  if ((op.action === "create" || op.action === "update") && op.data) {
    repo.upsert(op.data.date as string, op.data.content as string);
  } else if (op.action === "delete") {
    repo.delete(op.entityId);
  }
  return { entityType: "memo", entityId: op.entityId, status: "success" };
}

function applyNoteOp(
  db: Database.Database,
  op: { action: string; entityId: string; data?: Record<string, unknown> },
): OperationResult {
  const repo = createNoteRepository(db);
  if (op.action === "create" && op.data) {
    repo.create(op.entityId, (op.data.title as string) ?? "");
  } else if (op.action === "update" && op.data) {
    repo.update(op.entityId, op.data as never);
  } else if (op.action === "delete") {
    repo.softDelete(op.entityId);
  }
  return { entityType: "note", entityId: op.entityId, status: "success" };
}

function applyScheduleItemOp(
  db: Database.Database,
  op: { action: string; entityId: string; data?: Record<string, unknown> },
): OperationResult {
  const repo = createScheduleItemRepository(db);
  if (op.action === "create" && op.data) {
    const d = op.data;
    repo.create(
      op.entityId,
      d.date as string,
      d.title as string,
      d.startTime as string,
      d.endTime as string,
      d.routineId as string | undefined,
      d.templateId as string | undefined,
    );
  } else if (op.action === "update" && op.data) {
    repo.update(op.entityId, op.data as never);
  } else if (op.action === "delete") {
    repo.delete(op.entityId);
  }
  return {
    entityType: "scheduleItem",
    entityId: op.entityId,
    status: "success",
  };
}

function applyRoutineOp(
  db: Database.Database,
  op: { action: string; entityId: string; data?: Record<string, unknown> },
): OperationResult {
  const repo = createRoutineRepository(db);
  if (op.action === "create" && op.data) {
    const d = op.data;
    repo.create(
      op.entityId,
      d.title as string,
      d.startTime as string | undefined,
      d.endTime as string | undefined,
    );
  } else if (op.action === "update" && op.data) {
    repo.update(op.entityId, op.data as never);
  } else if (op.action === "delete") {
    repo.softDelete(op.entityId);
  }
  return { entityType: "routine", entityId: op.entityId, status: "success" };
}

function applyWikiTagOp(
  db: Database.Database,
  op: { action: string; entityId: string; data?: Record<string, unknown> },
): OperationResult {
  const repo = createWikiTagRepository(db);
  if (op.action === "create" && op.data) {
    repo.createWithId(
      op.entityId,
      op.data.name as string,
      op.data.color as string,
    );
  } else if (op.action === "update" && op.data) {
    repo.update(op.entityId, op.data as never);
  } else if (op.action === "delete") {
    repo.delete(op.entityId);
  }
  return { entityType: "wikiTag", entityId: op.entityId, status: "success" };
}

function applyTimeMemoOp(
  db: Database.Database,
  op: { action: string; entityId: string; data?: Record<string, unknown> },
): OperationResult {
  const repo = createTimeMemoRepository(db);
  if ((op.action === "create" || op.action === "update") && op.data) {
    repo.upsert(
      op.entityId,
      op.data.date as string,
      op.data.hour as number,
      op.data.content as string,
    );
  } else if (op.action === "delete") {
    repo.delete(op.entityId);
  }
  return { entityType: "timeMemo", entityId: op.entityId, status: "success" };
}

function applyCalendarOp(
  db: Database.Database,
  op: { action: string; entityId: string; data?: Record<string, unknown> },
): OperationResult {
  const repo = createCalendarRepository(db);
  if (op.action === "create" && op.data) {
    repo.create(
      op.entityId,
      op.data.title as string,
      op.data.folderId as string,
    );
  } else if (op.action === "update" && op.data) {
    repo.update(op.entityId, op.data as never);
  } else if (op.action === "delete") {
    repo.delete(op.entityId);
  }
  return { entityType: "calendar", entityId: op.entityId, status: "success" };
}

// --- Row types for raw queries ---

interface TaskSyncRow {
  id: string;
  type: string;
  title: string;
  parent_id: string | null;
  order: number;
  status: string | null;
  is_expanded: number | null;
  is_deleted: number | null;
  deleted_at: string | null;
  created_at: string;
  completed_at: string | null;
  scheduled_at: string | null;
  scheduled_end_at: string | null;
  is_all_day: number | null;
  content: string | null;
  work_duration_minutes: number | null;
  color: string | null;
  time_memo: string | null;
  updated_at: string | null;
  version: number;
}

interface MemoSyncRow {
  id: string;
  date: string;
  content: string;
  is_pinned: number;
  is_deleted: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

interface NoteSyncRow {
  id: string;
  title: string;
  content: string;
  is_pinned: number;
  is_deleted: number;
  deleted_at: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

interface ScheduleRow {
  id: string;
  date: string;
  title: string;
  start_time: string;
  end_time: string;
  completed: number;
  completed_at: string | null;
  routine_id: string | null;
  template_id: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

interface RoutineSyncRow {
  id: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  is_archived: number;
  is_deleted: number;
  deleted_at: string | null;
  order: number;
  created_at: string;
  updated_at: string;
  version: number;
}

interface WikiTagSyncRow {
  id: string;
  name: string;
  color: string;
  text_color: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

interface WikiTagAssignmentRow {
  tag_id: string;
  entity_id: string;
  entity_type: string;
  source: string;
  created_at: string;
  updated_at: string | null;
}

interface WikiTagConnectionRow {
  id: string;
  source_tag_id: string;
  target_tag_id: string;
  created_at: string;
  updated_at: string | null;
}

interface NoteConnectionRow {
  id: string;
  source_note_id: string;
  target_note_id: string;
  created_at: string;
  updated_at: string | null;
}

interface TimeMemoRow {
  id: string;
  date: string;
  hour: number;
  content: string;
  created_at: string;
  updated_at: string;
  version: number;
}

// --- Row mappers (snake_case → camelCase) ---

function mapTaskRows(rows: TaskSyncRow[]) {
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    parentId: r.parent_id,
    order: r.order,
    status: r.status ?? undefined,
    isExpanded: r.is_expanded ? true : undefined,
    isDeleted: r.is_deleted ? true : undefined,
    deletedAt: r.deleted_at ?? undefined,
    createdAt: r.created_at,
    completedAt: r.completed_at ?? undefined,
    scheduledAt: r.scheduled_at ?? undefined,
    scheduledEndAt: r.scheduled_end_at ?? undefined,
    isAllDay: r.is_all_day ? true : undefined,
    content: r.content ?? undefined,
    workDurationMinutes: r.work_duration_minutes ?? undefined,
    color: r.color ?? undefined,
    timeMemo: r.time_memo ?? undefined,
    updatedAt: r.updated_at ?? undefined,
    version: r.version ?? 1,
  }));
}

function mapMemoRows(rows: MemoSyncRow[]) {
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    content: r.content,
    isPinned: r.is_pinned === 1,
    isDeleted: r.is_deleted === 1,
    deletedAt: r.deleted_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    version: r.version ?? 1,
  }));
}

function mapNoteRows(rows: NoteSyncRow[]) {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    isPinned: r.is_pinned === 1,
    isDeleted: r.is_deleted === 1,
    deletedAt: r.deleted_at ?? undefined,
    color: r.color ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    version: r.version ?? 1,
  }));
}

function mapScheduleItems(rows: ScheduleRow[]) {
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    title: r.title,
    startTime: r.start_time,
    endTime: r.end_time,
    completed: r.completed === 1,
    completedAt: r.completed_at,
    routineId: r.routine_id,
    templateId: r.template_id,
    memo: r.memo ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    version: r.version ?? 1,
  }));
}

function mapRoutineRows(rows: RoutineSyncRow[]) {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    startTime: r.start_time,
    endTime: r.end_time,
    isArchived: r.is_archived === 1,
    isDeleted: r.is_deleted === 1,
    deletedAt: r.deleted_at,
    order: r.order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    version: r.version ?? 1,
  }));
}

function mapWikiTagRows(rows: WikiTagSyncRow[]) {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    textColor: r.text_color ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    version: r.version ?? 1,
  }));
}

function mapWikiTagAssignmentRows(rows: WikiTagAssignmentRow[]) {
  return rows.map((r) => ({
    tagId: r.tag_id,
    entityId: r.entity_id,
    entityType: r.entity_type,
    source: r.source,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

function mapWikiTagConnectionRows(rows: WikiTagConnectionRow[]) {
  return rows.map((r) => ({
    id: r.id,
    sourceTagId: r.source_tag_id,
    targetTagId: r.target_tag_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

function mapNoteConnectionRows(rows: NoteConnectionRow[]) {
  return rows.map((r) => ({
    id: r.id,
    sourceNoteId: r.source_note_id,
    targetNoteId: r.target_note_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

function mapTimeMemos(rows: TimeMemoRow[]) {
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    hour: r.hour,
    content: r.content,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    version: r.version ?? 1,
  }));
}
