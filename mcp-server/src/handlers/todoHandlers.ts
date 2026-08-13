import { randomUUID } from "node:crypto";
import { getSupabase } from "../supabase.js";
import { markdownToTiptap } from "../utils/markdownToTiptap.js";
import {
  META_COLUMNS,
  insertItem,
  requireMeta,
  softDeleteItem,
  updatePayload,
  type ItemsMetaRow,
} from "../utils/items.js";
import { localDayUtcRange } from "../utils/localDate.js";
import { contentPlainText, contentPreview } from "../utils/content.js";
import {
  fetchAllPages,
  fetchByIdChunks,
  resolveListLimit,
} from "../utils/pagination.js";
import {
  getTagsForEntity,
  getTagMapByRole,
  type TagInfo,
} from "./wikiTagHandlers.js";

/*
 * Todo handlers — Supabase edition (#360).
 *
 * Replaces the legacy single-table SQLite `todos` access (dropped by 0007)
 * with the unified 2-row model (0008): one `items_meta` row (role='task') +
 * one `tasks_payload` row per todo. Write rituals (orphan recovery, the
 * §10.2 updated_at bump, soft delete) live in ../utils/items.ts.
 *
 * Column-set deltas vs the legacy SQLite shape:
 *   - `type` → `task_type`, `"order"` → `sort_order`, `parent_id` →
 *     `parent_item_id` (now an items_meta ref).
 *   - `status` is UPPERCASE in the DB (CHECK NOT_STARTED|IN_PROGRESS|DONE).
 *     The MCP tool contract keeps the lowercase vocabulary it always had,
 *     so this module translates in both directions — a caller can feed a
 *     `get_todo` result straight back into `update_todo`.
 *   - title / created_at / is_deleted live on items_meta, not the payload.
 *
 * life-tags S3 (#225) retired the folder node type. Legacy `task_type =
 * 'folder'` rows are excluded in-app (same rule as
 * SupabaseDataService.fetchTodoTree): filtering query-side with `.neq`
 * would also drop NULL task_type rows and silently hide plain todos. A
 * todo parented to an excluded folder still surfaces (orphan tolerance).
 */

interface TasksPayloadRow {
  item_id: string;
  parent_item_id: string | null;
  task_type: "folder" | "task" | null;
  status: string | null;
  content: string | null;
  time_memo: string | null;
  scheduled_at: string | null;
  scheduled_end_at: string | null;
  is_all_day: boolean;
  completed_at: string | null;
  sort_order: number;
}

const PAYLOAD_COLUMNS =
  "item_id, parent_item_id, task_type, status, content, time_memo, " +
  "scheduled_at, scheduled_end_at, is_all_day, completed_at, sort_order";

const STATUS_TO_DB: Record<string, string> = {
  not_started: "NOT_STARTED",
  in_progress: "IN_PROGRESS",
  done: "DONE",
};

/** Tool vocabulary (lowercase) → DB CHECK vocabulary (uppercase). */
export function toDbStatus(status: string): string {
  const mapped = STATUS_TO_DB[status.toLowerCase()];
  if (!mapped) {
    throw new Error(
      `Invalid status "${status}" (expected not_started|in_progress|done)`,
    );
  }
  return mapped;
}

/** DB vocabulary → tool vocabulary, so callers see one set of values. */
export function toToolStatus(status: string | null): string | null {
  return status === null ? null : status.toLowerCase();
}

/**
 * True for the retired folder node type (S3 #225). NULL is a plain todo —
 * the whole in-app filter hinges on that, which is why it is exported for
 * the unit test. `list_todos` used a query-side `.eq('task_type','task')`
 * until #702 ②, which dropped every NULL row and made it disagree with
 * `get_todo_tree` about which todos exist.
 */
export function isLegacyFolder(
  row: Pick<TasksPayloadRow, "task_type">,
): boolean {
  return row.task_type === "folder";
}

/** Every field but the body — how the body is carried differs per tool. */
function formatTodoBase(meta: ItemsMetaRow, payload: TasksPayloadRow) {
  return {
    id: meta.id,
    type: payload.task_type ?? "task",
    title: meta.title,
    parentId: payload.parent_item_id,
    order: payload.sort_order,
    status: toToolStatus(payload.status),
    createdAt: meta.created_at,
    completedAt: payload.completed_at,
    scheduledAt: payload.scheduled_at,
    scheduledEndAt: payload.scheduled_end_at,
    isAllDay: payload.is_all_day,
    timeMemo: payload.time_memo,
  };
}

/**
 * Single-todo result: the stored body plus its plain text (#702 ①).
 *
 * `content` is TipTap JSON while `update_todo` writes Markdown, so reading a
 * todo and feeding `content` straight back would bury the JSON in the
 * document as literal text. `contentText` is the half of that round trip
 * that was missing — it is what a caller edits and writes back.
 */
export function formatTodo(meta: ItemsMetaRow, payload: TasksPayloadRow) {
  return {
    ...formatTodoBase(meta, payload),
    content: payload.content,
    contentText: contentPlainText(payload.content),
  };
}

/**
 * List result: a preview by default (#702 ①). `list_todos` used to return
 * every todo's whole TipTap JSON body, so asking "what is on my plate" cost
 * the entire todo collection's content in one answer.
 */
export function formatTodoListEntry(
  meta: ItemsMetaRow,
  payload: TasksPayloadRow,
  includeContent: boolean,
) {
  const base = {
    ...formatTodoBase(meta, payload),
    contentPreview: contentPreview(payload.content),
  };
  if (!includeContent) return base;
  return {
    ...base,
    content: payload.content,
    contentText: contentPlainText(payload.content),
  };
}

/**
 * Normalise a tool-supplied bound for a `scheduled_at` (timestamptz)
 * comparison. A bare "YYYY-MM-DD" is expanded to the local day's UTC
 * instant so a date-only range covers whole days instead of stopping at
 * midnight; a full ISO 8601 timestamp passes through untouched.
 */
export function rangeBound(value: string, edge: "start" | "end"): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const { startIso, endIso } = localDayUtcRange(value);
  return edge === "start" ? startIso : endIso;
}

/**
 * Live items_meta rows for the given todo ids, keyed by id. Chunked: the
 * ids ride in the query string, so an unbounded `.in()` risks URL limits.
 * An id absent from the result is soft-deleted or never existed.
 */
async function fetchTodoMetas(
  ids: string[],
): Promise<Map<string, ItemsMetaRow>> {
  const { client } = await getSupabase();
  const rows = await fetchByIdChunks<ItemsMetaRow>(ids, async (chunk) => {
    const { data, error } = await client
      .from("items_meta")
      .select(META_COLUMNS)
      .eq("role", "task")
      .eq("is_deleted", false)
      .in("id", chunk);
    if (error) throw new Error(`list todo items_meta: ${error.message}`);
    return (data ?? []) as unknown as ItemsMetaRow[];
  });

  const byId = new Map<string, ItemsMetaRow>();
  for (const m of rows) byId.set(m.id, m);
  return byId;
}

/** Fetch one live todo (meta + payload) or throw a not-found error. */
async function getTodoRows(id: string) {
  const meta = await requireMeta(id, "task", "Todo");
  const { client } = await getSupabase();
  const { data, error } = await client
    .from("tasks_payload")
    .select(PAYLOAD_COLUMNS)
    .eq("item_id", id)
    .maybeSingle();
  if (error) throw new Error(`get tasks_payload: ${error.message}`);
  if (!data) throw new Error(`Todo not found: ${id}`);
  return { meta, payload: data as unknown as TasksPayloadRow };
}

export async function listTodos(args: {
  status?: string;
  date_range?: { start: string; end: string };
  /** Renamed from `folder_id` in #419 — it always filtered on the parent todo,
   *  never on a folder (the folder node type retired in #225). */
  parent_id?: string;
  include_content?: boolean;
  limit?: number;
}) {
  const limit = resolveListLimit(args.limit);
  const { client } = await getSupabase();

  // A fresh builder per page: PostgREST builders are single-use, and the
  // order must end in a unique column or page boundaries can drop rows.
  const payloads = await fetchAllPages<TasksPayloadRow>((from, to) => {
    // The retired folder type is excluded IN-APP (below), never here: a
    // query-side task_type filter also drops NULL rows, which are plain
    // todos. That is the mismatch #702 ② removes — get_todo_tree has always
    // filtered in-app, so the two tools used to disagree about which todos
    // exist, and the header comment at the top of this file warns about
    // exactly the trap the query below used to fall into.
    let query = client.from("tasks_payload").select(PAYLOAD_COLUMNS);
    if (args.status) query = query.eq("status", toDbStatus(args.status));
    if (args.date_range) {
      query = query
        .gte("scheduled_at", rangeBound(args.date_range.start, "start"))
        .lt("scheduled_at", rangeBound(args.date_range.end, "end"));
    }
    if (args.parent_id) query = query.eq("parent_item_id", args.parent_id);
    return query
      .order("sort_order", { ascending: true })
      .order("item_id", { ascending: true })
      .range(from, to);
  }, "list tasks_payload");

  // Two exclusions, both in-app and both before the count: the retired
  // folder type (see above), and a payload whose meta is missing — that one
  // is soft-deleted or an orphan, so it is not a todo the caller can see and
  // must not count towards `total` either.
  const visible = payloads.filter((p) => !isLegacyFolder(p));
  if (visible.length === 0) return { todos: [], total: 0, hasMore: false };

  const metaById = await fetchTodoMetas(visible.map((p) => p.item_id));
  const live = visible.filter((p) => metaById.has(p.item_id));

  const todos = live
    .slice(0, limit)
    .map((p) =>
      formatTodoListEntry(
        metaById.get(p.item_id) as ItemsMetaRow,
        p,
        args.include_content === true,
      ),
    );
  return { todos, total: live.length, hasMore: live.length > todos.length };
}

export async function getTodo(args: { id: string }) {
  const { meta, payload } = await getTodoRows(args.id);
  return {
    ...formatTodo(meta, payload),
    tags: await getTagsForEntity(args.id),
  };
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

export async function getTodoTree(args: {
  root_id?: string;
  include_done?: boolean;
  max_depth?: number;
}) {
  const { client } = await getSupabase();
  const includeDone = args.include_done !== false;

  const [metaRows, payloadRows, tagMap] = await Promise.all([
    fetchAllPages<ItemsMetaRow>(
      (from, to) =>
        client
          .from("items_meta")
          .select(META_COLUMNS)
          .eq("role", "task")
          .eq("is_deleted", false)
          .order("id", { ascending: true })
          .range(from, to),
      "tree items_meta",
    ),
    fetchAllPages<TasksPayloadRow>(
      (from, to) =>
        client
          .from("tasks_payload")
          .select(PAYLOAD_COLUMNS)
          .order("sort_order", { ascending: true })
          .order("item_id", { ascending: true })
          .range(from, to),
      "tree tasks_payload",
    ),
    getTagMapByRole("task"),
  ]);

  const metaById = new Map<string, ItemsMetaRow>();
  for (const m of metaRows) metaById.set(m.id, m);

  // Live payloads in sort order, paired with their meta parent.
  const rows: Array<{ meta: ItemsMetaRow; payload: TasksPayloadRow }> = [];
  for (const p of payloadRows) {
    if (isLegacyFolder(p)) continue;
    const m = metaById.get(p.item_id);
    if (m) rows.push({ meta: m, payload: p });
  }

  const childrenMap = new Map<string | null, typeof rows>();
  for (const row of rows) {
    const key = row.payload.parent_item_id;
    const list = childrenMap.get(key) ?? [];
    list.push(row);
    childrenMap.set(key, list);
  }

  function toNode(
    row: { meta: ItemsMetaRow; payload: TasksPayloadRow },
    children: TreeNode[],
  ): TreeNode {
    return {
      id: row.meta.id,
      type: row.payload.task_type ?? "task",
      title: row.meta.title,
      status: toToolStatus(row.payload.status),
      order: row.payload.sort_order,
      createdAt: row.meta.created_at,
      completedAt: row.payload.completed_at,
      scheduledAt: row.payload.scheduled_at,
      scheduledEndAt: row.payload.scheduled_end_at,
      isAllDay: row.payload.is_all_day,
      tags: tagMap.get(row.meta.id) ?? [],
      children,
    };
  }

  function buildTree(parentId: string | null, depth: number): TreeNode[] {
    if (args.max_depth !== undefined && depth > args.max_depth) return [];

    const children = childrenMap.get(parentId) ?? [];
    const result: TreeNode[] = [];
    for (const row of children) {
      if (!includeDone && row.payload.status === "DONE") continue;
      result.push(toNode(row, buildTree(row.meta.id, depth + 1)));
    }
    return result;
  }

  if (args.root_id) {
    const rootRow = rows.find((r) => r.meta.id === args.root_id);
    if (!rootRow) throw new Error(`Todo not found: ${args.root_id}`);
    return toNode(rootRow, buildTree(args.root_id, 1));
  }

  return buildTree(null, 0);
}

export async function createTodo(args: {
  title: string;
  parent_id?: string;
  scheduled_at?: string;
  scheduled_end_at?: string;
  is_all_day?: boolean;
  content?: string;
  status?: string;
}) {
  // #702 ③: create_todo took neither body nor status, so creating a todo
  // with anything in it always cost two calls (create → update). The write
  // vocabulary is update_todo's, unchanged: Markdown in, TipTap JSON stored.
  const status =
    args.status === undefined ? "NOT_STARTED" : toDbStatus(args.status);
  const { client } = await getSupabase();
  const id = `task-${randomUUID()}`;

  // Append at the end of the destination level.
  let siblingQuery = client
    .from("tasks_payload")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  siblingQuery = args.parent_id
    ? siblingQuery.eq("parent_item_id", args.parent_id)
    : siblingQuery.is("parent_item_id", null);
  const { data: siblings, error: sErr } = await siblingQuery;
  if (sErr) throw new Error(`max sort_order: ${sErr.message}`);
  const maxOrder = (siblings ?? [])[0]?.sort_order ?? -1;

  await insertItem({
    id,
    role: "task",
    title: args.title,
    payloadTable: "tasks_payload",
    payload: {
      parent_item_id: args.parent_id ?? null,
      task_type: "task",
      status,
      // A todo created as already done still records when — update_todo does
      // the same, and a DONE row with no completed_at reads as never finished.
      completed_at: status === "DONE" ? new Date().toISOString() : null,
      is_expanded: false,
      content: args.content
        ? JSON.stringify(markdownToTiptap(args.content))
        : null,
      scheduled_at: args.scheduled_at ?? null,
      scheduled_end_at: args.scheduled_end_at ?? null,
      is_all_day: args.is_all_day ?? false,
      reminder_enabled: false,
      sort_order: maxOrder + 1,
    },
  });

  const { meta, payload } = await getTodoRows(id);
  return formatTodo(meta, payload);
}

export async function updateTodo(args: {
  id: string;
  title?: string;
  status?: string;
  scheduled_at?: string;
  scheduled_end_at?: string;
  content?: string;
  time_memo?: string | null;
}) {
  await getTodoRows(args.id); // not-found guard

  const metaPatch: Record<string, unknown> = {};
  if (args.title !== undefined) metaPatch.title = args.title;

  const payloadPatch: Record<string, unknown> = {};
  if (args.status !== undefined) {
    const dbStatus = toDbStatus(args.status);
    payloadPatch.status = dbStatus;
    payloadPatch.completed_at =
      dbStatus === "DONE" ? new Date().toISOString() : null;
  }
  if (args.scheduled_at !== undefined)
    payloadPatch.scheduled_at = args.scheduled_at;
  if (args.scheduled_end_at !== undefined)
    payloadPatch.scheduled_end_at = args.scheduled_end_at;
  if (args.content !== undefined)
    payloadPatch.content = JSON.stringify(markdownToTiptap(args.content));
  if (args.time_memo !== undefined) payloadPatch.time_memo = args.time_memo;

  await updatePayload(
    "tasks_payload",
    args.id,
    "task",
    payloadPatch,
    metaPatch,
  );

  const { meta, payload } = await getTodoRows(args.id);
  return formatTodo(meta, payload);
}

export async function deleteTodo(args: { id: string }) {
  await requireMeta(args.id, "task", "Todo");
  await softDeleteItem(args.id, "task");
  return { success: true, id: args.id, softDeleted: true };
}
