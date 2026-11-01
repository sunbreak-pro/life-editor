// @vitest-environment node (#1079 — this suite touches no DOM)
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DAILY_CHANGES,
  FULL_READ_EVERY_STARTS,
  FULL_READ_MAX_AGE_MS,
  NOTE_CHANGES,
  SETTLE_MS,
  TODO_CHANGES,
  applyItemChanges,
  cursorFrom,
  fetchItemChanges,
  isFullReadDue,
  noteFullRead,
  readChangeCursor,
  resetFullReadPolicy,
  type ChangeCursor,
} from "../src/services/itemChanges";
import { ITEMS_META_COLUMNS } from "../src/services/itemsMeta";
import type { TasksPayloadRow } from "../src/services/todoMapper";
import type { TodoNode } from "../src/types/todoTree";

/*
 * #2333 — the delta read. The fake client answers per table, records each query
 * as a PostgREST-like string and counts `.from()` by table, because "no change
 * means no request to a payload table" is the line the Issue is judged on.
 */

const USER = "00000000-0000-0000-0000-000000000000";
const OLD = "2026-10-21T00:00:00.000Z";
const T0 = "2026-10-21T10:00:00.123456+00:00";
const T1 = "2026-10-21T10:30:00.000000+00:00";
const T2 = "2026-10-21T11:00:00.000000+00:00";

type Answer = { rows?: object[]; error?: { code: string; message: string } };

function fakeClient(answers: Record<string, Answer>) {
  const queries: string[] = [];
  const count: Record<string, number> = {};
  const from = (table: string) => {
    count[table] = (count[table] ?? 0) + 1;
    const parts: string[] = [];
    let ids: string[] | null = null;
    const builder = {
      select: (columns: string) => (parts.push(`select=${columns}`), builder),
      gt: (c: string, v: string) => (parts.push(`${c}=gt.${v}`), builder),
      in: (_: string, chunk: string[]) => ((ids = chunk), builder),
      order: () => builder,
      limit: () => builder,
      range: () => builder,
      then: (done: (r: unknown) => unknown) => {
        queries.push(`${table}?${parts.join("&")}`);
        const { rows = [], error = null } = answers[table] ?? {};
        const data = ids
          ? rows.filter((r) =>
              ids?.includes((r as { item_id: string }).item_id),
            )
          : rows;
        return Promise.resolve({ data: error ? null : data, error }).then(done);
      },
    };
    return builder;
  };
  return { client: { from } as unknown as SupabaseClient, queries, count };
}

function meta(id: string, changedAt: string, extra: object = {}) {
  return {
    id,
    user_id: USER,
    role: "task",
    title: id,
    is_deleted: false,
    deleted_at: null,
    created_at: OLD,
    updated_at: changedAt,
    changed_at: changedAt,
    ...extra,
  };
}

function payload(id: string, extra: Partial<TasksPayloadRow> = {}) {
  return {
    item_id: id,
    user_id: USER,
    parent_item_id: null,
    task_type: "task",
    status: "NOT_STARTED",
    priority: 1,
    sort_order: 1,
    ...extra,
  } as unknown as TasksPayloadRow;
}

function node(id: string, updatedAt = OLD): TodoNode {
  return { id, title: id, updatedAt } as unknown as TodoNode;
}

const cursor = (at = T0, seen: Record<string, string> = {}): ChangeCursor => ({
  at,
  seen,
  readAt: 0,
});

const idsOf = (rows: readonly { id: string }[]) => rows.map((r) => r.id);

function apply(
  list: TodoNode[],
  metas: ReturnType<typeof meta>[],
  tombstones: { id: string; deleted_at: string }[] = [],
  payloads = metas.map((m) => payload(m.id)),
  seen: Record<string, string> = {},
) {
  return applyItemChanges(
    TODO_CHANGES,
    list,
    { metas, tombstones },
    payloads,
    seen,
  );
}

describe("the delta query", () => {
  it("asks for rows after the cursor minus 60s, with no role or is_deleted filter", async () => {
    const { client, queries } = fakeClient({});
    await fetchItemChanges(client, TODO_CHANGES, cursor(T1), []);
    const since = "2026-10-21T10:29:00.000Z";
    expect(queries).toContainEqual(
      expect.stringContaining(`changed_at=gt.${since}`),
    );
    expect(queries).toContainEqual(
      expect.stringContaining(`deleted_at=gt.${since}`),
    );
    expect(queries.join()).not.toMatch(/role=|is_deleted=/);
  });

  it("sends no payload request when nothing changed", async () => {
    const seen = { "task-1": T0 };
    const { client, count } = fakeClient({
      items_meta: { rows: [meta("task-1", T0)] },
    });
    const read = await fetchItemChanges(
      client,
      TODO_CHANGES,
      cursor(T0, seen),
      [node("task-1")],
    );
    expect(count.tasks_payload).toBeUndefined();
    expect(count.items_meta).toBe(1);
    expect(idsOf(read?.data ?? [])).toEqual(["task-1"]);
  });

  it("reads the payload of a changed row of its own role only", async () => {
    const { client, queries, count } = fakeClient({
      items_meta: {
        rows: [
          meta("task-1", T1),
          meta("task-2", T1, { is_deleted: true }),
          meta("note-1", T1, { role: "note" }),
        ],
      },
      tasks_payload: { rows: [payload("task-1"), payload("task-2")] },
    });
    const read = await fetchItemChanges(client, TODO_CHANGES, cursor(), []);
    expect(count).toEqual({
      items_meta: 1,
      items_meta_tombstones: 1,
      tasks_payload: 1,
    });
    expect(queries.join()).not.toContain("notes_payload");
    expect(idsOf(read?.data ?? [])).toEqual(["task-1"]);
  });

  it("re-reads a row until it has settled, as its payload write may still follow", async () => {
    const young = new Date(Date.now() - SETTLE_MS + 5_000).toISOString();
    const { client, count } = fakeClient({
      items_meta: { rows: [meta("task-1", young)] },
      tasks_payload: { rows: [payload("task-1")] },
    });
    const first = await fetchItemChanges(
      client,
      TODO_CHANGES,
      cursor(young),
      [],
    );
    expect(first?.cursor.seen).toEqual({});
    await fetchItemChanges(
      client,
      TODO_CHANGES,
      first?.cursor as ChangeCursor,
      [],
    );
    expect(count.tasks_payload).toBe(2);
  });

  it.each([
    ["42703", "items_meta"],
    ["PGRST205", "items_meta_tombstones"],
    ["42P01", "items_meta_tombstones"],
  ])(
    "answers null on %s from %s, and does not ask again",
    async (code, table) => {
      const { client, queries } = fakeClient({
        [table]: { error: { code, message: "missing" } },
      });
      expect(
        await fetchItemChanges(client, TODO_CHANGES, cursor(), []),
      ).toBeNull();
      const asked = queries.length;
      expect(
        await fetchItemChanges(client, TODO_CHANGES, cursor(), []),
      ).toBeNull();
      expect(await readChangeCursor(client)).toBeNull();
      expect(queries).toHaveLength(asked);
    },
  );

  it("throws on any other failure, so the hook can report and fall back", async () => {
    const { client } = fakeClient({
      items_meta: { error: { code: "500", message: "boom" } },
    });
    await expect(
      fetchItemChanges(client, TODO_CHANGES, cursor(), []),
    ).rejects.toThrow(/boom/);
  });
});

describe("the cursor", () => {
  it("takes the newest of rows and tombstones", () => {
    const rows = [{ id: "a", changed_at: T0 }];
    expect(cursorFrom(rows, [{ deleted_at: T1 }], 0)?.at).toBe(T1);
    expect(cursorFrom(rows, [], 0)?.at).toBe(T0);
  });

  it("does not move backwards on an empty or older delta", () => {
    expect(cursorFrom([], [], 0, T1)?.at).toBe(T1);
    expect(cursorFrom([{ id: "a", changed_at: T0 }], [], 0, T1)?.at).toBe(T1);
  });

  it("tells microseconds apart", () => {
    const later = "2026-10-21T10:00:00.1239+00:00"; // same millisecond as T0
    expect(cursorFrom([{ id: "a", changed_at: later }], [], 0, T0)?.at).toBe(
      later,
    );
  });

  it("is null for an empty table, and for an error", async () => {
    expect(await readChangeCursor(fakeClient({}).client)).toBeNull();
    const failed = fakeClient({
      items_meta_tombstones: { error: { code: "500", message: "boom" } },
      items_meta: { rows: [{ id: "a", changed_at: T0 }] },
    });
    expect(await readChangeCursor(failed.client)).toBeNull();
  });

  it("names the settled rows of the overlap, so the next read skips them", async () => {
    const { client } = fakeClient({
      items_meta: {
        rows: [
          { id: "a", changed_at: T2 },
          { id: "b", changed_at: "2026-10-21T10:59:30.000000+00:00" },
          { id: "c", changed_at: T1 },
        ],
      },
    });
    const read = await readChangeCursor(client);
    expect(read?.at).toBe(T2);
    expect(Object.keys(read?.seen ?? {}).sort()).toEqual(["a", "b"]);
  });

  it("is not part of what the full reads select", () => {
    expect(ITEMS_META_COLUMNS).not.toContain("changed_at");
  });
});

describe("applying the changes", () => {
  it("adds, updates and keeps the id order of a full read", () => {
    const out = apply(
      [node("task-1"), node("task-3")],
      [meta("task-2", T1), meta("task-3", T1, { title: "moved" })],
    );
    expect(idsOf(out)).toEqual(["task-1", "task-2", "task-3"]);
    expect(out[2].title).toBe("moved");
  });

  it("takes a physically deleted row out", () => {
    const out = apply(
      [node("task-1"), node("task-2")],
      [],
      [{ id: "task-1", deleted_at: T1 }],
    );
    expect(idsOf(out)).toEqual(["task-2"]);
  });

  it("takes a soft-deleted row out, and puts a restored one back", () => {
    const list = [node("task-1")];
    expect(apply(list, [meta("task-1", T1, { is_deleted: true })])).toEqual([]);
    expect(idsOf(apply([], [meta("task-1", T1)]))).toEqual(["task-1"]);
  });

  it("removes an id that now has another role", () => {
    const out = apply([node("x")], [meta("x", T1, { role: "note" })], [], []);
    expect(out).toEqual([]);
  });

  it("adds an id that took this role, with its payload", () => {
    const out = apply([], [meta("x", T1)]);
    expect(idsOf(out)).toEqual(["x"]);
  });

  it("keeps a meta without its payload invisible, and drops it from the list", () => {
    expect(apply([], [meta("new", T1)], [], [])).toEqual([]);
    expect(apply([node("x")], [meta("x", T1)], [], [])).toEqual([]);
  });

  it("applies each domain's keep", () => {
    const folder = payload("x", { task_type: "folder" });
    expect(apply([node("x")], [meta("x", T1)], [], [folder])).toEqual([]);
    const template = { item_id: "n", user_id: USER, note_type: "template" };
    const changes = {
      metas: [meta("n", T1, { role: "note" })],
      tombstones: [],
    };
    expect(
      applyItemChanges(NOTE_CHANGES, [], changes, [template as never]),
    ).toEqual([]);
  });

  it("builds a Daily row without a body", () => {
    const id = "daily-2026-10-21";
    const out = applyItemChanges(
      DAILY_CHANGES,
      [],
      { metas: [meta(id, T1, { role: "daily" })], tombstones: [] },
      [{ item_id: id, user_id: USER, date: "2026-10-21" } as never],
    );
    expect(out[0]).toMatchObject({ id, bodyLoaded: false, content: "" });
  });

  describe("a tombstone beside a live row", () => {
    const id = "daily-2026-10-21";

    it("lets the row win when it was re-created after the delete", () => {
      const out = apply([], [meta(id, T2)], [{ id, deleted_at: T1 }]);
      expect(idsOf(out)).toEqual([id]);
    });

    it("lets the tombstone win when the delete came after the row was read", () => {
      const out = apply([node(id)], [meta(id, T1)], [{ id, deleted_at: T2 }]);
      expect(out).toEqual([]);
    });

    it("keeps a re-created row the overlap skips when its tombstone comes again", () => {
      const out = apply(
        [node(id, T2)],
        [meta(id, T2)],
        [{ id, deleted_at: T1 }],
        [],
        { [id]: T2 },
      );
      expect(idsOf(out)).toEqual([id]);
    });

    it("compares with the list when the row is outside the changed set", () => {
      const tombstones = [{ id, deleted_at: T1 }];
      expect(idsOf(apply([node(id, T2)], [], tombstones))).toEqual([id]);
      expect(apply([node(id, T0)], [], tombstones)).toEqual([]);
    });

    it("does not fetch a payload for a row the tombstone takes", async () => {
      const { client, count } = fakeClient({
        items_meta: { rows: [meta("task-1", T1)] },
        items_meta_tombstones: { rows: [{ id: "task-1", deleted_at: T2 }] },
      });
      const read = await fetchItemChanges(client, TODO_CHANGES, cursor(), [
        node("task-1"),
      ]);
      expect(count.tasks_payload).toBeUndefined();
      expect(read?.data).toEqual([]);
      expect(read?.cursor.at).toBe(T2);
    });
  });
});

describe("the safety net", () => {
  beforeEach(() => {
    resetFullReadPolicy();
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    } as unknown as Storage;
  });

  const recent = (): ChangeCursor => ({ ...cursor(), readAt: Date.now() });

  it("asks for a full read when the last read is over a week old", () => {
    expect(isFullReadDue("notes", recent())).toBe(false);
    const old = { ...cursor(), readAt: Date.now() - FULL_READ_MAX_AGE_MS - 1 };
    expect(isFullReadDue("notes", old)).toBe(true);
  });

  it("asks once per domain on every 20th start", () => {
    for (let start = 1; start < FULL_READ_EVERY_STARTS; start += 1) {
      resetFullReadPolicy();
      expect(isFullReadDue("notes", recent())).toBe(false);
    }
    resetFullReadPolicy();
    expect(isFullReadDue("notes", recent())).toBe(true);
    noteFullRead("notes");
    expect(isFullReadDue("notes", recent())).toBe(false);
    expect(isFullReadDue("todoTree", recent())).toBe(true);
  });
});

describe("migration 0045", () => {
  const sql = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../supabase/migrations/0045_items_meta_changed_at_tombstones.sql",
    ),
    "utf8",
  ).replace(/\r\n/g, "\n");

  it("gives the tombstones no foreign key", () => {
    const table = sql.match(/create table[^;]+items_meta_tombstones[^;]+;/);
    expect(table?.[0]).not.toMatch(/references/i);
  });

  // delete_my_account() raises if a user_id table still holds a row at the end,
  // and deleting items_meta is what writes the tombstones.
  it("erases the tombstones after items_meta when an account leaves", () => {
    const body = sql.slice(sql.indexOf("function public.delete_my_account()"));
    const rows = body.indexOf("delete from public.items_meta ");
    const stones = body.indexOf("delete from public.items_meta_tombstones");
    expect(rows).toBeGreaterThan(0);
    expect(stones).toBeGreaterThan(rows);
    expect(sql).toMatch(/for delete\s+to authenticated/);
  });

  it("leaves updated_at and the publication alone", () => {
    const code = sql.replace(/--.*$/gm, "");
    expect(code).not.toContain("updated_at");
    expect(code).not.toContain("supabase_realtime");
  });
});
