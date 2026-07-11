import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ItemsMetaRow, TasksPayloadRow } from "../src/services/taskMapper";

/*
 * life-tags S3 (#225) — legacy folder-row filtering. SupabaseTasksService's
 * fetchTaskTree / fetchDeletedTasks must exclude rows whose tasks_payload
 * task_type = 'folder' (prod still has a handful, active + soft-deleted),
 * while keeping:
 *   - rows with task_type = 'task' or NULL (a plain / legacy task), and
 *   - orphan tolerance: a task still pointing at an excluded folder parent
 *     surfaces with its (now-dangling) parentId intact until the data
 *     migration reparents it.
 *
 * The SupabaseTasksService class is not exported, so the test drives the real
 * fetch through createSupabaseDataService() with getSupabaseClient() mocked to
 * a minimal PostgREST-shaped stub. The stub ignores the query-level
 * .eq/.in filters (the client-side folder filter is what's under test) and
 * returns whatever rows the test stages in `state`.
 */

const state = vi.hoisted(() => ({
  metas: [] as ItemsMetaRow[],
  payloads: [] as TasksPayloadRow[],
}));

vi.mock("../src/services/supabaseClient", () => ({
  getSupabaseClient: () => {
    const from = (table: string) => {
      const result =
        table === "items_meta"
          ? { data: state.metas, error: null }
          : { data: state.payloads, error: null };
      // A thenable query builder: every chained filter (and the
      // .order/.range pagination pair from fetchAllPages, #172) returns
      // `this`, and awaiting it resolves to { data, error } for the
      // requested table. Staged rows stay < POSTGREST_PAGE_SIZE, so the
      // first page is short and pagination stops after one pull.
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      builder.select = chain;
      builder.eq = chain;
      builder.in = chain;
      builder.order = chain;
      builder.range = chain;
      builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
      return builder;
    };
    return { from };
  },
}));

import { createSupabaseDataService } from "../src/services/SupabaseDataService";

function meta(id: string, isDeleted: boolean): ItemsMetaRow {
  return {
    id,
    user_id: "u",
    role: "task",
    title: id,
    is_deleted: isDeleted,
    deleted_at: isDeleted ? "2026-07-11T00:00:00.000Z" : null,
    created_at: "2026-07-11T00:00:00.000Z",
    updated_at: "2026-07-11T00:00:00.000Z",
    version: 1,
  };
}

function payload(
  itemId: string,
  taskType: "task" | "folder" | null,
  parentItemId: string | null = null,
): TasksPayloadRow {
  return {
    item_id: itemId,
    user_id: "u",
    parent_item_id: parentItemId,
    parent_item_role: "task",
    task_type: taskType,
    folder_type: taskType === "folder" ? "normal" : null,
    start_at: null,
    due_at: null,
    status: null,
    is_expanded: false,
    content: null,
    work_duration_minutes: null,
    color: null,
    icon: null,
    time_memo: null,
    priority: null,
    reminder_enabled: false,
    reminder_offset: null,
    scheduled_at: null,
    scheduled_end_at: null,
    is_all_day: false,
    completed_at: null,
    original_parent_id: null,
    sort_order: 0,
  };
}

describe("legacy folder-row filtering (S3 #225)", () => {
  beforeEach(() => {
    state.metas = [];
    state.payloads = [];
  });

  it("fetchTaskTree drops task_type='folder' rows, keeps 'task'/NULL and folder-parented tasks", async () => {
    state.metas = [
      meta("t1", false),
      meta("f1", false), // legacy folder — must be excluded
      meta("t2", false),
      meta("t3", false),
    ];
    state.payloads = [
      payload("t1", "task"),
      payload("f1", "folder"),
      payload("t2", null), // NULL task_type → plain task, survives
      payload("t3", "task", "f1"), // task under the (excluded) folder — survives
    ];

    const ds = createSupabaseDataService();
    const nodes = await ds.fetchTaskTree();
    const ids = nodes.map((n) => n.id).sort();

    expect(ids).toEqual(["t1", "t2", "t3"]);
    expect(ids).not.toContain("f1");
    // Orphan tolerance: t3 keeps its dangling parentId until the migration.
    expect(nodes.find((n) => n.id === "t3")?.parentId).toBe("f1");
  });

  it("fetchDeletedTasks drops soft-deleted folder rows, keeps trashed tasks", async () => {
    state.metas = [meta("td", true), meta("fd", true)];
    state.payloads = [payload("td", "task"), payload("fd", "folder")];

    const ds = createSupabaseDataService();
    const nodes = await ds.fetchDeletedTasks();

    expect(nodes.map((n) => n.id)).toEqual(["td"]);
  });
});
