import type Database from "better-sqlite3";
import type { TaskNode } from "../types";
import { prepareSoftDeleteStatements } from "./repositoryHelpers";

interface TaskRow {
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
  icon: string | null;
  due_date: string | null;
  time_memo: string | null;
  updated_at: string | null;
  version: number;
  folder_type: string | null;
  original_parent_id: string | null;
  priority: number | null;
  reminder_enabled: number;
  reminder_offset: number | null;
}

function rowToNode(row: TaskRow): TaskNode {
  return {
    id: row.id,
    type: row.type as TaskNode["type"],
    title: row.title,
    parentId: row.parent_id,
    order: row.order,
    status: (row.status as TaskNode["status"]) ?? undefined,
    isExpanded: row.is_expanded ? true : undefined,
    isDeleted: row.is_deleted ? true : undefined,
    deletedAt: row.deleted_at ?? undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    scheduledAt: row.scheduled_at ?? undefined,
    scheduledEndAt: row.scheduled_end_at ?? undefined,
    isAllDay: row.is_all_day ? true : undefined,
    content: row.content ?? undefined,
    workDurationMinutes: row.work_duration_minutes ?? undefined,
    color: row.color ?? undefined,
    icon: row.icon ?? undefined,
    timeMemo: row.time_memo ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    version: row.version ?? 1,
    folderType: (row.folder_type as TaskNode["folderType"]) ?? undefined,
    originalParentId: row.original_parent_id ?? undefined,
    priority: (row.priority as TaskNode["priority"]) ?? undefined,
    reminderEnabled: row.reminder_enabled === 1 ? true : undefined,
    reminderOffset: row.reminder_offset ?? undefined,
  };
}

export function createTaskRepository(db: Database.Database) {
  const softDelete = prepareSoftDeleteStatements(db, "tasks");

  const stmts = {
    fetchTree: db.prepare(
      `SELECT * FROM tasks WHERE is_deleted = 0 ORDER BY "order" ASC`,
    ),
    ...softDelete,
    fetchById: db.prepare(`SELECT * FROM tasks WHERE id = ?`),
    insert: db.prepare(`
      INSERT INTO tasks (id, type, title, parent_id, "order", status, is_expanded, is_deleted, deleted_at, created_at, completed_at, scheduled_at, scheduled_end_at, is_all_day, content, work_duration_minutes, color, icon, due_date, time_memo, folder_type, original_parent_id, priority, reminder_enabled, reminder_offset)
      VALUES (@id, @type, @title, @parentId, @order, @status, @isExpanded, @isDeleted, @deletedAt, @createdAt, @completedAt, @scheduledAt, @scheduledEndAt, @isAllDay, @content, @workDurationMinutes, @color, @icon, @dueDate, @timeMemo, @folderType, @originalParentId, @priority, @reminderEnabled, @reminderOffset)
    `),
    update: db.prepare(`
      UPDATE tasks SET type=@type, title=@title, parent_id=@parentId, "order"=@order, status=@status,
        is_expanded=@isExpanded, is_deleted=@isDeleted, deleted_at=@deletedAt, created_at=@createdAt,
        completed_at=@completedAt, scheduled_at=@scheduledAt, scheduled_end_at=@scheduledEndAt,
        is_all_day=@isAllDay, content=@content,
        work_duration_minutes=@workDurationMinutes, color=@color, icon=@icon, due_date=@dueDate, time_memo=@timeMemo,
        folder_type=@folderType, original_parent_id=@originalParentId, priority=@priority,
        reminder_enabled=@reminderEnabled, reminder_offset=@reminderOffset,
        version = version + 1, updated_at = datetime('now')
      WHERE id=@id
    `),
    deleteAll: db.prepare(`DELETE FROM tasks`),
  };

  function nodeToParams(node: TaskNode) {
    return {
      id: node.id,
      type: node.type,
      title: node.title,
      parentId: node.parentId,
      order: node.order,
      status: node.status ?? null,
      isExpanded: node.isExpanded ? 1 : 0,
      isDeleted: node.isDeleted ? 1 : 0,
      deletedAt: node.deletedAt ?? null,
      createdAt: node.createdAt,
      completedAt: node.completedAt ?? null,
      scheduledAt: node.scheduledAt ?? null,
      scheduledEndAt: node.scheduledEndAt ?? null,
      isAllDay: node.isAllDay ? 1 : 0,
      content: node.content ?? null,
      workDurationMinutes: node.workDurationMinutes ?? null,
      color: node.color ?? null,
      icon: node.icon ?? null,
      dueDate: null,
      timeMemo: node.timeMemo ?? null,
      folderType: node.folderType ?? null,
      originalParentId: node.originalParentId ?? null,
      priority: node.priority ?? null,
      reminderEnabled: node.reminderEnabled ? 1 : 0,
      reminderOffset: node.reminderOffset ?? null,
    };
  }

  return {
    fetchTree(): TaskNode[] {
      return (stmts.fetchTree.all() as TaskRow[]).map(rowToNode);
    },

    fetchDeleted(): TaskNode[] {
      return (stmts.fetchDeleted.all() as TaskRow[]).map(rowToNode);
    },

    create(node: TaskNode): TaskNode {
      stmts.insert.run(nodeToParams(node));
      const row = stmts.fetchById.get(node.id) as TaskRow;
      return rowToNode(row);
    },

    update(id: string, updates: Partial<TaskNode>): TaskNode {
      const existing = stmts.fetchById.get(id) as TaskRow | undefined;
      if (!existing) throw new Error(`Task not found: ${id}`);
      const current = rowToNode(existing);
      const merged = { ...current, ...updates, id };
      stmts.update.run(nodeToParams(merged));
      const row = stmts.fetchById.get(id) as TaskRow;
      return rowToNode(row);
    },

    syncTree: db.transaction((nodes: TaskNode[]) => {
      // Defer FK checks to end of transaction so parent-child delete order doesn't matter
      db.pragma("defer_foreign_keys = ON");

      const incomingIds = new Set(nodes.map((n) => n.id));

      // Fix orphan parent_id references: null out any parentId not present in incoming nodes
      for (const node of nodes) {
        if (node.parentId && !incomingIds.has(node.parentId)) {
          node.parentId = null;
        }
      }
      const existingRows = db.prepare("SELECT id FROM tasks").all() as {
        id: string;
      }[];
      for (const { id } of existingRows) {
        if (!incomingIds.has(id)) {
          stmts.permanentDelete.run(id);
        }
      }
      // Use ON CONFLICT DO UPDATE instead of INSERT OR REPLACE
      // INSERT OR REPLACE does DELETE+INSERT internally, which:
      //   1. Triggers FK violations from child rows referencing the deleted parent
      //   2. Cascades deletes to task_tags and calendars (data loss)
      const upsert = db.prepare(`
        INSERT INTO tasks (id, type, title, parent_id, "order", status, is_expanded, is_deleted, deleted_at, created_at, completed_at, scheduled_at, scheduled_end_at, is_all_day, content, work_duration_minutes, color, icon, due_date, time_memo, folder_type, original_parent_id, priority, reminder_enabled, reminder_offset)
        VALUES (@id, @type, @title, @parentId, @order, @status, @isExpanded, @isDeleted, @deletedAt, @createdAt, @completedAt, @scheduledAt, @scheduledEndAt, @isAllDay, @content, @workDurationMinutes, @color, @icon, @dueDate, @timeMemo, @folderType, @originalParentId, @priority, @reminderEnabled, @reminderOffset)
        ON CONFLICT(id) DO UPDATE SET
          type = excluded.type,
          title = excluded.title,
          parent_id = excluded.parent_id,
          "order" = excluded."order",
          status = excluded.status,
          is_expanded = excluded.is_expanded,
          is_deleted = excluded.is_deleted,
          deleted_at = excluded.deleted_at,
          created_at = excluded.created_at,
          completed_at = excluded.completed_at,
          scheduled_at = excluded.scheduled_at,
          scheduled_end_at = excluded.scheduled_end_at,
          is_all_day = excluded.is_all_day,
          content = excluded.content,
          work_duration_minutes = excluded.work_duration_minutes,
          color = excluded.color,
          icon = excluded.icon,
          due_date = excluded.due_date,
          time_memo = excluded.time_memo,
          folder_type = excluded.folder_type,
          original_parent_id = excluded.original_parent_id,
          priority = excluded.priority,
          reminder_enabled = excluded.reminder_enabled,
          reminder_offset = excluded.reminder_offset
      `);
      for (const node of nodes) {
        upsert.run(nodeToParams(node));
      }
    }),

    softDelete(id: string): void {
      stmts.softDelete.run(id);
    },

    restore(id: string): void {
      stmts.restore.run(id);
    },

    permanentDelete(id: string): void {
      stmts.permanentDelete.run(id);
    },
  };
}

export type TaskRepository = ReturnType<typeof createTaskRepository>;
