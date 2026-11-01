// @vitest-environment node (#1079 — this suite touches no DOM)
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { POSTGREST_PAGE_SIZE } from "../src/services/postgrestFetchAll";
import type { TasksPayloadRow } from "../src/services/todoMapper";
import type { TodoNode } from "../src/types/todoTree";

/*
 * #2333 — the delta read. The fake client answers per table, records each query
 * as a PostgREST-like string and counts `.from()` by table, because "no change
 * means no request to a payload table" is the line the Issue is judged on.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

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
    let page: [number, number] | null = null;
    const builder = {
      select: (columns: string) => (parts.push(`select=${columns}`), builder),
      gt: (c: string, v: string) => (parts.push(`${c}=gt.${v}`), builder),
      in: (_: string, chunk: string[]) => ((ids = chunk), builder),
      order: () => builder,
      limit: () => builder,
      range: (lo: number, hi: number) => ((page = [lo, hi]), builder),
      then: (done: (r: unknown) => unknown) => {
        queries.push(`${table}?${parts.join("&")}`);
        const { rows = [], error = null } = answers[table] ?? {};
        const data = ids
          ? rows.filter((r) =>
              ids?.includes((r as { item_id: string }).item_id),
            )
          : rows;
        const paged = page ? data.slice(page[0], page[1] + 1) : data;
        return Promise.resolve({ data: error ? null : paged, error }).then(
          done,
        );
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
  settling: {},
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

  it.each([
    ["42703", "items_meta"],
    ["42P01", "items_meta_tombstones"],
    ["PGRST204", "items_meta"],
    ["PGRST205", "items_meta_tombstones"],
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

  it.each(["42703", "42P01", "PGRST204", "PGRST205"])(
    "remembers %s from the cursor read too",
    async (code) => {
      const { client, queries } = fakeClient({
        items_meta_tombstones: { error: { code, message: "missing" } },
      });
      expect(await readChangeCursor(client)).toBeNull();
      const asked = queries.length;
      expect(await readChangeCursor(client)).toBeNull();
      expect(
        await fetchItemChanges(client, TODO_CHANGES, cursor(), []),
      ).toBeNull();
      expect(queries).toHaveLength(asked);
    },
  );

  // PGRST301 is an expired JWT: nothing about the schema, and gone by the next
  // read. Remembering it would keep the delta off until a reload.
  it.each(["PGRST301", "500"])(
    "answers null on %s for this read only",
    async (code) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const answers: Record<string, Answer> = {
        items_meta: { error: { code, message: "boom" } },
      };
      const { client, count } = fakeClient(answers);
      expect(
        await fetchItemChanges(client, TODO_CHANGES, cursor(), []),
      ).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("boom"));
      expect(count.tasks_payload).toBeUndefined();

      answers.items_meta = { rows: [meta("task-1", T1)] };
      answers.tasks_payload = { rows: [payload("task-1")] };
      const next = await fetchItemChanges(client, TODO_CHANGES, cursor(), []);
      expect(idsOf(next?.data ?? [])).toEqual(["task-1"]);
    },
  );

  it.each(["PGRST301", "500"])(
    "lets the cursor read ask again after %s",
    async (code) => {
      const answers: Record<string, Answer> = {
        items_meta_tombstones: { error: { code, message: "boom" } },
      };
      const { client } = fakeClient(answers);
      expect(await readChangeCursor(client)).toBeNull();

      answers.items_meta_tombstones = {};
      answers.items_meta = { rows: [{ id: "a", changed_at: T1 }] };
      expect((await readChangeCursor(client))?.at).toBe(T1);
    },
  );

  it("throws when the payload read fails, so the hook can report and fall back", async () => {
    const { client } = fakeClient({
      items_meta: { rows: [meta("task-1", T1)] },
      tasks_payload: { error: { code: "500", message: "boom" } },
    });
    await expect(
      fetchItemChanges(client, TODO_CHANGES, cursor(), []),
    ).rejects.toThrow(/boom/);
  });

  // A concurrent write can shift an offset, and the cursor would then move past
  // the row it lost.
  describe("when the changes do not fit one page", () => {
    const manyMetas = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        meta(`note-${i}`, T1, { role: "note" }),
      );
    const manyTombstones = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `gone-${i}`,
        deleted_at: T1,
      }));

    it.each([
      ["items_meta", () => manyMetas(POSTGREST_PAGE_SIZE)],
      ["items_meta", () => manyMetas(POSTGREST_PAGE_SIZE + 5)],
      ["items_meta_tombstones", () => manyTombstones(POSTGREST_PAGE_SIZE)],
      ["items_meta_tombstones", () => manyTombstones(POSTGREST_PAGE_SIZE + 5)],
    ])("falls back to a full read on %s", async (table, rows) => {
      const answers: Record<string, Answer> = { [table]: { rows: rows() } };
      const { client, count } = fakeClient(answers);
      expect(
        await fetchItemChanges(client, TODO_CHANGES, cursor(), []),
      ).toBeNull();
      expect(count.tasks_payload).toBeUndefined();

      // Only this read: the delta is not switched off.
      answers[table] = {};
      expect(
        await fetchItemChanges(client, TODO_CHANGES, cursor(), []),
      ).not.toBeNull();
    });

    it("still reads a delta one row short of a page", async () => {
      const { client } = fakeClient({
        items_meta: { rows: manyMetas(POSTGREST_PAGE_SIZE - 1) },
        items_meta_tombstones: {
          rows: manyTombstones(POSTGREST_PAGE_SIZE - 1),
        },
      });
      expect(
        await fetchItemChanges(client, TODO_CHANGES, cursor(), []),
      ).not.toBeNull();
    });
  });
});

/*
 * How long a row is read again is measured on this device alone, so it cannot
 * depend on how far the device's clock is from the server's.
 */
describe("settling a row", () => {
  function reader(
    client: SupabaseClient,
    start: ChangeCursor = cursor(T1),
  ): {
    at: (ms: number) => Promise<void>;
    list: () => TodoNode[];
    position: () => ChangeCursor;
  } {
    let list: TodoNode[] = [];
    let position = start;
    return {
      at: async (ms) => {
        vi.spyOn(Date, "now").mockReturnValue(ms);
        const read = await fetchItemChanges(
          client,
          TODO_CHANGES,
          position,
          list,
        );
        if (read === null) throw new Error("expected a delta");
        list = read.data;
        position = read.cursor;
      },
      list: () => list,
      position: () => position,
    };
  }

  it.each([
    ["20 seconds ahead of", 20_000],
    ["an hour behind", -3_600_000],
  ])(
    "does not pin a stale payload on a device clock %s the server stamps",
    async (_, skew) => {
      const device = Date.parse(T2) + skew;
      const answers: Record<string, Answer> = {
        items_meta: { rows: [meta("task-1", T2)] },
        tasks_payload: { rows: [payload("task-1", { sort_order: 1 })] },
      };
      const { client, count } = fakeClient(answers);
      const read = reader(client);

      // Read between the meta write and the payload write.
      await read.at(device);
      expect(read.list()[0].order).toBe(1);
      expect(read.position().seen).toEqual({});
      expect(read.position().settling).toEqual({
        "task-1": { changedAt: T2, firstAt: device },
      });

      // The payload write lands, and does not move changed_at.
      answers.tasks_payload = { rows: [payload("task-1", { sort_order: 2 })] };
      await read.at(device + 5_000);
      expect(read.list()[0].order).toBe(2);
      expect(count.tasks_payload).toBe(2);

      // Read once more at the end of the span, and only then taken as read.
      await read.at(device + SETTLE_MS - 1);
      expect(count.tasks_payload).toBe(3);
      expect(read.position().seen).toEqual({});
      await read.at(device + SETTLE_MS);
      expect(count.tasks_payload).toBe(4);
      expect(read.position().seen).toEqual({ "task-1": T2 });
      expect(read.position().settling).toEqual({});

      // Settled: no change, no payload request.
      await read.at(device + 10 * SETTLE_MS);
      expect(count.tasks_payload).toBe(4);
      expect(read.list()[0].order).toBe(2);
    },
  );

  it("reads a settling row after a long pause, rather than taking it as read", async () => {
    const answers: Record<string, Answer> = {
      items_meta: { rows: [meta("task-1", T2)] },
      tasks_payload: { rows: [payload("task-1", { sort_order: 1 })] },
    };
    const { client } = fakeClient(answers);
    const read = reader(client);
    await read.at(1_000_000);
    answers.tasks_payload = { rows: [payload("task-1", { sort_order: 2 })] };
    await read.at(1_000_000 + 3_600_000);
    expect(read.list()[0].order).toBe(2);
    expect(read.position().seen).toEqual({ "task-1": T2 });
  });

  it("starts over when the row's changed_at moves", async () => {
    const later = "2026-10-21T11:00:10.000000+00:00";
    const answers: Record<string, Answer> = {
      items_meta: { rows: [meta("task-1", T2)] },
      tasks_payload: { rows: [payload("task-1")] },
    };
    const { client, count } = fakeClient(answers);
    const read = reader(client);
    await read.at(0);
    await read.at(SETTLE_MS);
    expect(read.position().seen).toEqual({ "task-1": T2 });

    answers.items_meta = { rows: [meta("task-1", later)] };
    await read.at(SETTLE_MS + 1);
    expect(count.tasks_payload).toBe(3);
    expect(read.position().seen).toEqual({});
    expect(read.position().settling).toEqual({
      "task-1": { changedAt: later, firstAt: SETTLE_MS + 1 },
    });
  });

  it("starts over when the device clock was set back", async () => {
    const { client, count } = fakeClient({
      items_meta: { rows: [meta("task-1", T2)] },
      tasks_payload: { rows: [payload("task-1")] },
    });
    const read = reader(client);
    await read.at(1_000_000);
    await read.at(5_000);
    expect(read.position().settling["task-1"].firstAt).toBe(5_000);
    await read.at(5_000 + SETTLE_MS);
    expect(read.position().seen).toEqual({ "task-1": T2 });
    expect(count.tasks_payload).toBe(3);
  });

  it("does not hold a row a much newer stamp has put outside the overlap", async () => {
    const { client } = fakeClient({
      items_meta: { rows: [meta("task-1", T1), meta("task-2", T2)] },
      tasks_payload: { rows: [payload("task-1"), payload("task-2")] },
    });
    const read = reader(client, cursor(T0));
    await read.at(0);
    // T1 is 30 minutes older than T2, so this very read has its final payload.
    expect(Object.keys(read.position().settling)).toEqual(["task-2"]);
  });

  it("settles what a full read's cursor named, then reads no payload", async () => {
    const answers: Record<string, Answer> = {
      items_meta: { rows: [meta("task-1", T2)] },
      tasks_payload: { rows: [payload("task-1")] },
    };
    const { client, count } = fakeClient(answers);
    vi.spyOn(Date, "now").mockReturnValue(0);
    const first = await readChangeCursor(client);
    expect(first?.settling).toEqual({
      "task-1": { changedAt: T2, firstAt: 0 },
    });

    const read = reader(client, first as ChangeCursor);
    await read.at(SETTLE_MS);
    expect(count.tasks_payload).toBe(1);
    await read.at(SETTLE_MS + 1);
    expect(count.tasks_payload).toBe(1);
  });
});

describe("the cursor", () => {
  it("takes the newest of rows and tombstones", () => {
    const rows = [{ id: "a", changed_at: T0 }];
    expect(cursorFrom(rows, [{ deleted_at: T1 }], 0)?.at).toBe(T1);
    expect(cursorFrom(rows, [], 0)?.at).toBe(T0);
  });

  it("does not move backwards on an empty or older delta", () => {
    expect(cursorFrom([], [], 0, cursor(T1))?.at).toBe(T1);
    expect(
      cursorFrom([{ id: "a", changed_at: T0 }], [], 0, cursor(T1))?.at,
    ).toBe(T1);
  });

  it("tells microseconds apart", () => {
    const later = "2026-10-21T10:00:00.1239+00:00"; // same millisecond as T0
    expect(
      cursorFrom([{ id: "a", changed_at: later }], [], 0, cursor(T0))?.at,
    ).toBe(later);
  });

  it("is null for an empty table, and for an error", async () => {
    expect(await readChangeCursor(fakeClient({}).client)).toBeNull();
    const failed = fakeClient({
      items_meta_tombstones: { error: { code: "500", message: "boom" } },
      items_meta: { rows: [{ id: "a", changed_at: T0 }] },
    });
    expect(await readChangeCursor(failed.client)).toBeNull();
  });

  it("holds the overlap's rows as settling, whatever the device clock says", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse(T2) + 3_600_000);
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
    expect(read?.seen).toEqual({});
    expect(Object.keys(read?.settling ?? {}).sort()).toEqual(["a", "b"]);
  });

  // The safety net is about the last full read. A delta on every day of the
  // week must not keep pushing it back.
  it("starts readAt at a full read and carries it through a delta", async () => {
    vi.spyOn(Date, "now").mockReturnValue(5_000);
    const { client } = fakeClient({
      items_meta: { rows: [meta("task-1", T2)] },
      tasks_payload: { rows: [payload("task-1")] },
    });
    const full = (await readChangeCursor(client)) as ChangeCursor;
    expect(full.readAt).toBe(5_000);

    vi.spyOn(Date, "now").mockReturnValue(9_000_000);
    const delta = await fetchItemChanges(client, TODO_CHANGES, full, []);
    expect(delta?.cursor.readAt).toBe(5_000);
    expect(cursorFrom([], [], 9_000_000, full)?.readAt).toBe(5_000);
  });

  it("shares one request between callers that overlap", async () => {
    const { client, count } = fakeClient({
      items_meta: { rows: [{ id: "a", changed_at: T2 }] },
    });
    const [a, b, c] = await Promise.all([
      readChangeCursor(client),
      readChangeCursor(client),
      readChangeCursor(client),
    ]);
    expect(count).toEqual({ items_meta: 1, items_meta_tombstones: 1 });
    expect(a?.at).toBe(T2);
    expect(b).toBe(a);
    expect(c).toBe(a);

    await readChangeCursor(client);
    expect(count).toEqual({ items_meta: 2, items_meta_tombstones: 2 });
  });

  it("does not share a request between clients", async () => {
    const one = fakeClient({});
    const two = fakeClient({});
    await Promise.all([
      readChangeCursor(one.client),
      readChangeCursor(two.client),
    ]);
    expect(one.count.items_meta).toBe(1);
    expect(two.count.items_meta).toBe(1);
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

    it("lets seen keep the row when it is newer than the delete", () => {
      const out = apply([node(id)], [], [{ id, deleted_at: T1 }], [], {
        [id]: T2,
      });
      expect(idsOf(out)).toEqual([id]);
    });

    it("lets the tombstone win when seen is older than the delete", () => {
      const out = apply([node(id)], [], [{ id, deleted_at: T1 }], [], {
        [id]: T0,
      });
      expect(out).toEqual([]);
    });

    it("lets the tombstone win when the row is outside the changed set", () => {
      const tombstones = [{ id, deleted_at: T1 }];
      // T2 is what a device with a fast clock wrote: later than the delete.
      expect(apply([node(id, T2)], [], tombstones)).toEqual([]);
      expect(apply([node(id, T0)], [], tombstones)).toEqual([]);
    });

    it("takes a row out on a delta read even if its updatedAt is ahead of the delete", async () => {
      const { client, count } = fakeClient({
        items_meta_tombstones: { rows: [{ id, deleted_at: T1 }] },
      });
      const read = await fetchItemChanges(client, TODO_CHANGES, cursor(), [
        node(id, T2),
        node("task-1"),
      ]);
      expect(idsOf(read?.data ?? [])).toEqual(["task-1"]);
      expect(read?.cursor.at).toBe(T1);
      expect(count.tasks_payload).toBeUndefined();
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

  it("asks for a full read when the last full read is over a week old", () => {
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

  // A volatile default would make add column rewrite the whole table.
  it("defaults changed_at to a stable now(), and stamps it from the clock", () => {
    const code = sql.replace(/--.*$/gm, "");
    expect(code).toMatch(/changed_at timestamptz not null default now\(\)/);
    expect(code).toContain("new.changed_at := clock_timestamp();");
  });

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
