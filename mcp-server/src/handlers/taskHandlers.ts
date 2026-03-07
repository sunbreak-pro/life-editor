import { getDb } from "../db.js";

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
  return formatTask(row);
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
     VALUES (@id, 'task', @title, @parent_id, @order, 'todo', 0, 0, datetime('now'), @scheduled_at, @scheduled_end_at, @is_all_day, NULL)`,
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
    // Convert plain text to minimal TipTap JSON
    const tiptapDoc = {
      type: "doc",
      content: args.content.split("\n").map((line) => ({
        type: "paragraph",
        content: line ? [{ type: "text", text: line }] : [],
      })),
    };
    updates.push("content = @content");
    params.content = JSON.stringify(tiptapDoc);
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
