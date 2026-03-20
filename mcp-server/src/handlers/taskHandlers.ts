import { getDb } from "../db.js";
import { markdownToTiptap } from "../utils/markdownToTiptap.js";
import {
  getTagsForEntity,
  getTagMapByEntityType,
  type TagInfo,
} from "./wikiTagHandlers.js";

interface TaskRow {
  id: string;
  type: string;
  title: string;
  parent_id: string | null;
  order: number;
  status: string | null;
  is_deleted: number;
  created_at: string;
  completed_at: string | null;
  scheduled_at: string | null;
  scheduled_end_at: string | null;
  is_all_day: number;
  content: string | null;
  time_memo: string | null;
}

function formatTask(row: TaskRow) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    parentId: row.parent_id,
    order: row.order,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    scheduledAt: row.scheduled_at,
    scheduledEndAt: row.scheduled_end_at,
    isAllDay: row.is_all_day === 1,
    content: row.content,
    timeMemo: row.time_memo,
  };
}

export function listTasks(args: {
  status?: string;
  date_range?: { start: string; end: string };
  folder_id?: string;
}) {
  const db = getDb();
  const conditions = ["is_deleted = 0", "type = 'task'"];
  const params: Record<string, string> = {};

  if (args.status) {
    conditions.push("status = @status");
    params.status = args.status;
  }
  if (args.date_range) {
    conditions.push("scheduled_at >= @start AND scheduled_at <= @end");
    params.start = args.date_range.start;
    params.end = args.date_range.end;
  }
  if (args.folder_id) {
    conditions.push("parent_id = @folder_id");
    params.folder_id = args.folder_id;
  }

  const sql = `SELECT * FROM tasks WHERE ${conditions.join(" AND ")} ORDER BY "order" ASC`;
  const rows = db.prepare(sql).all(params) as TaskRow[];
  return rows.map(formatTask);
}

export function getTask(args: { id: string }) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(args.id) as
    | TaskRow
    | undefined;
  if (!row) throw new Error(`Task not found: ${args.id}`);
  return { ...formatTask(row), tags: getTagsForEntity(args.id) };
}

interface TreeNode {
  id: string;
  type: string;
  title: string;
  status: string | null;
  order: number;
  createdAt: string;
  completedAt: string | null;
  scheduledAt: string | null;
  scheduledEndAt: string | null;
  isAllDay: boolean;
  tags: TagInfo[];
  children: TreeNode[];
}

export function getTaskTree(args: {
  root_id?: string;
  include_done?: boolean;
  max_depth?: number;
}) {
  const db = getDb();
  const includeDone = args.include_done !== false;

  const rows = db
    .prepare(`SELECT * FROM tasks WHERE is_deleted = 0 ORDER BY "order" ASC`)
    .all() as TaskRow[];

  const tagMap = getTagMapByEntityType("task");

  const childrenMap = new Map<string | null, TaskRow[]>();
  for (const row of rows) {
    const key = row.parent_id;
    const list = childrenMap.get(key) ?? [];
    list.push(row);
    childrenMap.set(key, list);
  }

  function buildTree(parentId: string | null, depth: number): TreeNode[] {
    if (args.max_depth !== undefined && depth > args.max_depth) return [];

    const children = childrenMap.get(parentId) ?? [];
    const result: TreeNode[] = [];

    for (const row of children) {
      if (!includeDone && row.status === "done" && row.type !== "folder") {
        continue;
      }

      const node: TreeNode = {
        id: row.id,
        type: row.type,
        title: row.title,
        status: row.status,
        order: row.order,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        scheduledAt: row.scheduled_at,
        scheduledEndAt: row.scheduled_end_at,
        isAllDay: row.is_all_day === 1,
        tags: tagMap.get(row.id) ?? [],
        children: buildTree(row.id, depth + 1),
      };
      result.push(node);
    }

    return result;
  }

  if (args.root_id) {
    const rootRow = rows.find((r) => r.id === args.root_id);
    if (!rootRow) throw new Error(`Task not found: ${args.root_id}`);

    const rootNode: TreeNode = {
      id: rootRow.id,
      type: rootRow.type,
      title: rootRow.title,
      status: rootRow.status,
      order: rootRow.order,
      createdAt: rootRow.created_at,
      completedAt: rootRow.completed_at,
      scheduledAt: rootRow.scheduled_at,
      scheduledEndAt: rootRow.scheduled_end_at,
      isAllDay: rootRow.is_all_day === 1,
      tags: tagMap.get(rootRow.id) ?? [],
      children: buildTree(rootRow.id, 1),
    };
    return rootNode;
  }

  return buildTree(null, 0);
}

export function createTask(args: {
  title: string;
  parent_id?: string;
  scheduled_at?: string;
  scheduled_end_at?: string;
  is_all_day?: boolean;
}) {
  const db = getDb();
  const id = `task-${Date.now()}`;

  // Determine order (append at end)
  const maxOrder = db
    .prepare(
      `SELECT COALESCE(MAX("order"), -1) as max_order FROM tasks WHERE parent_id ${args.parent_id ? "= @parent_id" : "IS NULL"} AND is_deleted = 0`,
    )
    .get(args.parent_id ? { parent_id: args.parent_id } : {}) as {
    max_order: number;
  };

  db.prepare(
    `INSERT INTO tasks (id, type, title, parent_id, "order", status, is_expanded, is_deleted, created_at, scheduled_at, scheduled_end_at, is_all_day, content)
     VALUES (@id, 'task', @title, @parent_id, @order, 'not_started', 0, 0, datetime('now'), @scheduled_at, @scheduled_end_at, @is_all_day, NULL)`,
  ).run({
    id,
    title: args.title,
    parent_id: args.parent_id ?? null,
    order: maxOrder.max_order + 1,
    scheduled_at: args.scheduled_at ?? null,
    scheduled_end_at: args.scheduled_end_at ?? null,
    is_all_day: args.is_all_day ? 1 : 0,
  });

  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow;
  return formatTask(row);
}

export function updateTask(args: {
  id: string;
  title?: string;
  status?: string;
  scheduled_at?: string;
  scheduled_end_at?: string;
  content?: string;
  time_memo?: string | null;
}) {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM tasks WHERE id = ?")
    .get(args.id) as TaskRow | undefined;
  if (!existing) throw new Error(`Task not found: ${args.id}`);

  const updates: string[] = [];
  const params: Record<string, unknown> = { id: args.id };

  if (args.title !== undefined) {
    updates.push("title = @title");
    params.title = args.title;
  }
  if (args.status !== undefined) {
    updates.push("status = @status");
    params.status = args.status;
    if (args.status === "done") {
      updates.push("completed_at = datetime('now')");
    }
  }
  if (args.scheduled_at !== undefined) {
    updates.push("scheduled_at = @scheduled_at");
    params.scheduled_at = args.scheduled_at;
  }
  if (args.scheduled_end_at !== undefined) {
    updates.push("scheduled_end_at = @scheduled_end_at");
    params.scheduled_end_at = args.scheduled_end_at;
  }
  if (args.content !== undefined) {
    updates.push("content = @content");
    params.content = JSON.stringify(markdownToTiptap(args.content));
  }
  if (args.time_memo !== undefined) {
    updates.push("time_memo = @time_memo");
    params.time_memo = args.time_memo;
  }

  if (updates.length === 0) return formatTask(existing);

  db.prepare(`UPDATE tasks SET ${updates.join(", ")} WHERE id = @id`).run(
    params,
  );
  const row = db
    .prepare("SELECT * FROM tasks WHERE id = ?")
    .get(args.id) as TaskRow;
  return formatTask(row);
}

export function deleteTask(args: { id: string }) {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM tasks WHERE id = ?")
    .get(args.id) as TaskRow | undefined;
  if (!existing) throw new Error(`Task not found: ${args.id}`);

  db.prepare(
    "UPDATE tasks SET is_deleted = 1, deleted_at = datetime('now') WHERE id = ?",
  ).run(args.id);

  return { success: true, id: args.id };
}
