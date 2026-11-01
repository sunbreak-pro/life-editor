// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { clipExcerpt } from "../src/utils/contentExcerpt";

/*
 * #2392 — one todo by id, for the link panel. Same driving trick as
 * legacyFolderFilter.test: the real service through createSupabaseDataService(),
 * over a minimal PostgREST-shaped stub. The stub records the filters, because
 * "only this row, only a live task" is what the method adds to the tree read.
 */

const state = vi.hoisted(() => ({
  meta: null as Record<string, unknown> | null,
  payload: null as Record<string, unknown> | null,
  calls: [] as Array<{ table: string; filters: Array<[string, unknown]> }>,
}));

vi.mock("../src/services/supabaseClient", () => ({
  getSupabaseClient: () => ({
    from: (table: string) => {
      const filters: Array<[string, unknown]> = [];
      state.calls.push({ table, filters });
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      };
      builder.maybeSingle = async () => ({
        data: table === "items_meta" ? state.meta : state.payload,
        error: null,
      });
      return builder;
    },
  }),
}));

import { createSupabaseDataService } from "../src/services/SupabaseDataService";

const META = {
  id: "task-1",
  user_id: "u",
  role: "task",
  title: "Order the tiles",
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-02T00:00:00.000Z",
  is_deleted: false,
  deleted_at: null,
};

const PAYLOAD = {
  item_id: "task-1",
  user_id: "u",
  parent_item_id: null,
  parent_item_role: null,
  task_type: "task",
  status: "DONE",
  content: "Ask for the matte ones",
  sort_order: 0,
  priority: null,
  scheduled_at: null,
  scheduled_end_at: null,
};

beforeEach(() => {
  state.meta = META;
  state.payload = PAYLOAD;
  state.calls = [];
});

describe("getTodoById (#2392)", () => {
  it("joins the two rows of that todo, asking for a live task only", async () => {
    const todo = await createSupabaseDataService().getTodoById("task-1");

    expect(todo?.id).toBe("task-1");
    expect(todo?.title).toBe("Order the tiles");
    expect(todo?.status).toBe("DONE");
    expect(state.calls[0].table).toBe("items_meta");
    expect(state.calls[0].filters).toEqual([
      ["id", "task-1"],
      ["role", "task"],
      ["is_deleted", false],
    ]);
    expect(state.calls[1].table).toBe("tasks_payload");
    expect(state.calls[1].filters).toEqual([["item_id", "task-1"]]);
  });

  it("answers null for no such row, without reading the payload", async () => {
    state.meta = null;

    expect(await createSupabaseDataService().getTodoById("nope")).toBeNull();
    expect(state.calls).toHaveLength(1);
  });

  it("answers null for an orphan and for a legacy folder row, as the tree does", async () => {
    state.payload = null;
    expect(await createSupabaseDataService().getTodoById("task-1")).toBeNull();

    state.payload = { ...PAYLOAD, task_type: "folder" };
    expect(await createSupabaseDataService().getTodoById("task-1")).toBeNull();
  });
});

describe("clipExcerpt (#2392)", () => {
  it("leaves a text at the limit whole and marks a longer one", () => {
    expect(clipExcerpt("abc", 3)).toBe("abc");
    expect(clipExcerpt("abcd", 3)).toBe("abc…");
  });

  it("counts an emoji as one character and never splits it", () => {
    expect(clipExcerpt("😀😀😀", 2)).toBe("😀😀…");
    expect(clipExcerpt("😀😀", 2)).toBe("😀😀");
  });
});
