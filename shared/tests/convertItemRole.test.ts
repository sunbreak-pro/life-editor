import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SupabaseItemConversionService,
  ItemConversionError,
} from "../src/services/SupabaseDataService";

/*
 * Event <-> Todo conversion (#625) — the write sequence and its compensation.
 *
 * Everything worth pinning here is ORDER. The item keeps its id
 * (D-20260810-sched-2), so the three writes act on one row that is briefly
 * inconsistent, and PostgREST gives us no transaction to hide that:
 *
 *   1. new payload UPSERT
 *   2. items_meta.role UPDATE — filtered on the OLD role, so a second
 *      conversion racing the same id matches zero rows instead of re-roling a
 *      row that already moved (the #407 idiom). Carries the DB-Q2 bump.
 *   3. old payload DELETE
 *
 * The order is chosen by what SURVIVES a half-finished run. This one can leave
 * an item holding two payload rows — invisible, because every read filters
 * items_meta by role and joins its own payload. The reverse (delete first)
 * leaves a payload-less meta: also invisible, but it owns the id, so the user
 * watches the item vanish with no route back. §10 R2 forbids exactly that.
 *
 * Which is why only step 2 has a compensation (drop the payload just written),
 * and step 3 has none: past the role flip the conversion HAS happened for every
 * reader, so failing the call there would report a lie.
 *
 * The mock records every write, so the tests assert the sequence rather than
 * the individual statements.
 */

interface Op {
  table: string;
  kind: "select" | "insert" | "upsert" | "update" | "delete";
  filters: Array<[string, unknown]>;
  values?: Record<string, unknown>;
}

const USER_ID = "11111111-1111-1111-1111-111111111111";

const EVENT_META = {
  id: "item-1",
  user_id: USER_ID,
  role: "event",
  title: "Dentist",
  is_deleted: false,
  deleted_at: null,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  version: 1,
};

const EVENT_PAYLOAD = {
  item_id: "item-1",
  user_id: USER_ID,
  start_at: "2026-08-10",
  start_time: "10:00",
  end_time: "11:00",
  is_all_day: false,
  done: false,
  completed_at: null,
  is_dismissed: false,
  reminder_at: null,
  memo: "bring the card",
  routine_item_id: null,
  routine_item_role: null,
  source_date: null,
  is_deleted_cache: false,
};

const TASK_META = { ...EVENT_META, role: "task" };

const TASK_PAYLOAD = {
  item_id: "item-1",
  user_id: USER_ID,
  parent_item_id: null,
  parent_item_role: "task",
  task_type: "task",
  folder_type: null,
  start_at: null,
  due_at: null,
  status: "NOT_STARTED",
  is_expanded: false,
  content: "bring the card",
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

interface ClientOptions {
  /** Queued results per `table:kind`; the last one repeats once exhausted. */
  results: Record<
    string,
    Array<{ data: unknown; error: { message: string } | null }>
  >;
}

function makeClient(opts: ClientOptions) {
  const ops: Op[] = [];
  const take = (key: string) => {
    const queue = opts.results[key];
    if (!queue || queue.length === 0)
      throw new Error(`mock client: no result queued for "${key}"`);
    return queue.length === 1 ? queue[0] : queue.shift()!;
  };

  const chain = (op: Op) => {
    ops.push(op);
    const result = () => take(`${op.table}:${op.kind}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const self: any = {
      select: () => self,
      eq: (col: string, val: unknown) => {
        op.filters.push([col, val]);
        return self;
      },
      limit: () => self,
      single: () => Promise.resolve(result()),
      maybeSingle: () => Promise.resolve(result()),
      then: (
        resolve: (v: unknown) => unknown,
        reject?: (e: unknown) => unknown,
      ) => Promise.resolve(result()).then(resolve, reject),
    };
    return self;
  };

  const client = {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: USER_ID } }, error: null }),
    },
    from: (table: string) => ({
      select: () => chain({ table, kind: "select", filters: [] }),
      insert: (values: Record<string, unknown>) =>
        chain({ table, kind: "insert", filters: [], values }),
      upsert: (values: Record<string, unknown>) =>
        chain({ table, kind: "upsert", filters: [], values }),
      update: (values: Record<string, unknown>) =>
        chain({ table, kind: "update", filters: [], values }),
      delete: () => chain({ table, kind: "delete", filters: [] }),
    }),
  } as unknown as SupabaseClient;

  return { client, ops };
}

/** The write ops in order, as `table:kind` — the sequence under test. */
function writeSequence(ops: Op[]): string[] {
  return ops
    .filter((o) => o.kind !== "select")
    .map((o) => `${o.table}:${o.kind}`);
}

describe("convertEventToTask (#625)", () => {
  // A factory, not a constant: the mock SHIFTS its queues, so a shared array
  // would carry one test's consumption into the next.
  const happy = () => ({
    "items_meta:select": [
      { data: EVENT_META, error: null },
      { data: TASK_META, error: null },
    ],
    "events_payload:select": [{ data: EVENT_PAYLOAD, error: null }],
    "tasks_payload:upsert": [{ data: TASK_PAYLOAD, error: null }],
    "items_meta:update": [{ data: [{ id: "item-1" }], error: null }],
    "events_payload:delete": [{ data: null, error: null }],
  });

  it("writes the task payload, re-roles the meta, then drops the event payload", async () => {
    const { client, ops } = makeClient({ results: happy() });
    const svc = new SupabaseItemConversionService(client);

    const node = await svc.convertEventToTask("item-1", { order: 0 });

    expect(writeSequence(ops)).toEqual([
      "tasks_payload:upsert",
      "items_meta:update",
      "events_payload:delete",
    ]);

    const roleUpdate = ops.find(
      (o) => o.table === "items_meta" && o.kind === "update",
    )!;
    expect(roleUpdate.values).toMatchObject({ role: "task" });
    // DB-Q2: items_meta.updated_at is the LWW cursor and the payload tables
    // carry no own timestamp, so the bump rides this same statement.
    expect(typeof roleUpdate.values!.updated_at).toBe("string");
    expect(roleUpdate.filters).toEqual([
      ["id", "item-1"],
      ["role", "event"],
    ]);

    expect(node.id).toBe("item-1");
  });

  it("carries the event's own values into the task row it writes", async () => {
    const { client, ops } = makeClient({ results: happy() });
    const svc = new SupabaseItemConversionService(client);
    await svc.convertEventToTask("item-1", { order: 3 });

    const written = ops.find(
      (o) => o.table === "tasks_payload" && o.kind === "upsert",
    )!;
    expect(written.values).toMatchObject({
      item_id: "item-1",
      // Root of the tree, open, at the host's slot.
      parent_item_id: null,
      sort_order: 3,
      status: "NOT_STARTED",
      // The memo is not dropped: the confirm dialog only warns about date,
      // time and repeat, so the sentence the user wrote has to land somewhere.
      content: "bring the card",
      // The date IS dropped (D-20260810-sched-3) — writing it into
      // scheduled_at would put the Todo straight back on the calendar the
      // dialog just said it was leaving.
      scheduled_at: null,
      scheduled_end_at: null,
      is_all_day: false,
    });
  });

  it("keeps a DONE event done — status is not blanket-reset", async () => {
    const { client, ops } = makeClient({
      results: {
        ...happy(),
        "events_payload:select": [
          {
            data: {
              ...EVENT_PAYLOAD,
              done: true,
              completed_at: "2026-08-10T02:00:00.000Z",
            },
            error: null,
          },
        ],
        "tasks_payload:upsert": [
          {
            data: {
              ...TASK_PAYLOAD,
              status: "DONE",
              completed_at: "2026-08-10T02:00:00.000Z",
            },
            error: null,
          },
        ],
      },
    });
    const svc = new SupabaseItemConversionService(client);
    const node = await svc.convertEventToTask("item-1", { order: 0 });

    // The dialog warns about time and repeat, never about progress — a done
    // event coming back as an untouched Todo is silent data loss.
    const written = ops.find(
      (o) => o.table === "tasks_payload" && o.kind === "upsert",
    )!;
    expect(written.values).toMatchObject({
      status: "DONE",
      completed_at: "2026-08-10T02:00:00.000Z",
    });
    expect(node.status).toBe("DONE");
  });

  it("never touches the tag or link tables — that is what keeping the id buys", async () => {
    const { client, ops } = makeClient({ results: happy() });
    const svc = new SupabaseItemConversionService(client);
    await svc.convertEventToTask("item-1", { order: 0 });

    // Tags and "[[ ]]" edges reference items_meta.id with no role of their own,
    // so a conversion that re-roles in place has nothing to migrate. A future
    // rewrite that reaches for wiki_* here is a delete+create in disguise.
    expect(ops.every((o) => !o.table.startsWith("wiki_"))).toBe(true);
  });

  it("refuses a routine-derived event before writing anything", async () => {
    const { client, ops } = makeClient({
      results: {
        "items_meta:select": [{ data: EVENT_META, error: null }],
        "events_payload:select": [
          {
            data: { ...EVENT_PAYLOAD, routine_item_id: "routine-1" },
            error: null,
          },
        ],
      },
    });
    const svc = new SupabaseItemConversionService(client);

    await expect(
      svc.convertEventToTask("item-1", { order: 0 }),
    ).rejects.toBeInstanceOf(ItemConversionError);
    expect(writeSequence(ops)).toEqual([]);
  });

  it("refuses a trashed event before writing anything", async () => {
    const { client, ops } = makeClient({
      results: {
        "items_meta:select": [
          { data: { ...EVENT_META, is_deleted: true }, error: null },
        ],
        "events_payload:select": [{ data: EVENT_PAYLOAD, error: null }],
      },
    });
    const svc = new SupabaseItemConversionService(client);

    await expect(
      svc.convertEventToTask("item-1", { order: 0 }),
    ).rejects.toMatchObject({ reason: "trashed" });
    expect(writeSequence(ops)).toEqual([]);
  });

  it("drops the payload it just wrote when the role UPDATE fails", async () => {
    const { client, ops } = makeClient({
      results: {
        ...happy(),
        "items_meta:update": [
          { data: null, error: { message: "row level security" } },
        ],
        "tasks_payload:delete": [{ data: null, error: null }],
      },
    });
    const svc = new SupabaseItemConversionService(client);

    await expect(
      svc.convertEventToTask("item-1", { order: 0 }),
    ).rejects.toThrow(/items_meta role/);

    // One compensating write, and the item is untouched: still role 'event',
    // still holding its own payload, with the half-written task row removed.
    expect(writeSequence(ops)).toEqual([
      "tasks_payload:upsert",
      "items_meta:update",
      "tasks_payload:delete",
    ]);
    // The event's own payload is NEVER a delete target on this path — that is
    // the whole point of writing the new one first.
    expect(
      ops.some((o) => o.table === "events_payload" && o.kind === "delete"),
    ).toBe(false);
  });

  it("compensates the same way when the role UPDATE matches no row (lost race)", async () => {
    const { client, ops } = makeClient({
      results: {
        ...happy(),
        // Zero rows matched: something else already re-roled this item.
        "items_meta:update": [{ data: [], error: null }],
        "tasks_payload:delete": [{ data: null, error: null }],
      },
    });
    const svc = new SupabaseItemConversionService(client);

    await expect(
      svc.convertEventToTask("item-1", { order: 0 }),
    ).rejects.toBeInstanceOf(ItemConversionError);
    expect(writeSequence(ops)).toEqual([
      "tasks_payload:upsert",
      "items_meta:update",
      "tasks_payload:delete",
    ]);
  });

  it("still succeeds when the old payload cannot be dropped", async () => {
    const { client } = makeClient({
      results: {
        ...happy(),
        "events_payload:delete": [
          { data: null, error: { message: "network" } },
        ],
      },
    });
    const svc = new SupabaseItemConversionService(client);

    // Past the role flip the item IS a Todo for every reader, so reporting a
    // failure would send the user looking for something that already worked.
    // The leftover row is invisible and swept by the §10.5 detection query.
    const node = await svc.convertEventToTask("item-1", { order: 0 });
    expect(node.id).toBe("item-1");
  });
});

describe("convertTaskToEvent (#625)", () => {
  const PLACEMENT = {
    date: "2026-08-11",
    startTime: "00:00",
    endTime: "00:00",
    isAllDay: true,
  };

  const happy = () => ({
    "items_meta:select": [
      { data: TASK_META, error: null },
      { data: EVENT_META, error: null },
    ],
    // Two reads: the row itself, then the children probe (empty).
    "tasks_payload:select": [
      { data: TASK_PAYLOAD, error: null },
      { data: [], error: null },
    ],
    "events_payload:upsert": [{ data: EVENT_PAYLOAD, error: null }],
    "items_meta:update": [{ data: [{ id: "item-1" }], error: null }],
    "tasks_payload:delete": [{ data: null, error: null }],
  });

  it("writes the event payload, re-roles the meta, then drops the task payload", async () => {
    const { client, ops } = makeClient({ results: happy() });
    const svc = new SupabaseItemConversionService(client);

    const item = await svc.convertTaskToEvent("item-1", PLACEMENT);

    expect(writeSequence(ops)).toEqual([
      "events_payload:upsert",
      "items_meta:update",
      "tasks_payload:delete",
    ]);
    const roleUpdate = ops.find(
      (o) => o.table === "items_meta" && o.kind === "update",
    )!;
    expect(roleUpdate.values).toMatchObject({ role: "event" });
    expect(roleUpdate.filters).toEqual([
      ["id", "item-1"],
      ["role", "task"],
    ]);

    // The placement the host computed reaches the payload verbatim, and the
    // task body lands in the event memo (the dialog only warns about status).
    const written = ops.find(
      (o) => o.table === "events_payload" && o.kind === "upsert",
    )!;
    expect(written.values).toMatchObject({
      item_id: "item-1",
      start_at: "2026-08-11",
      start_time: "00:00",
      end_time: "00:00",
      is_all_day: true,
      memo: "bring the card",
      routine_item_id: null,
      done: false,
    });
    expect(item.id).toBe("item-1");
    expect(ops.every((o) => !o.table.startsWith("wiki_"))).toBe(true);
  });

  it("keeps a DONE todo completed", async () => {
    const { client, ops } = makeClient({
      results: {
        ...happy(),
        "tasks_payload:select": [
          {
            data: {
              ...TASK_PAYLOAD,
              status: "DONE",
              completed_at: "2026-08-10T02:00:00.000Z",
            },
            error: null,
          },
          { data: [], error: null },
        ],
      },
    });
    const svc = new SupabaseItemConversionService(client);
    await svc.convertTaskToEvent("item-1", PLACEMENT);

    const written = ops.find(
      (o) => o.table === "events_payload" && o.kind === "upsert",
    )!;
    expect(written.values).toMatchObject({
      done: true,
      completed_at: "2026-08-10T02:00:00.000Z",
    });
  });

  it("refuses a todo with children before writing anything", async () => {
    const { client, ops } = makeClient({
      results: {
        "items_meta:select": [{ data: TASK_META, error: null }],
        "tasks_payload:select": [
          { data: TASK_PAYLOAD, error: null },
          { data: [{ item_id: "child-1" }], error: null },
        ],
      },
    });
    const svc = new SupabaseItemConversionService(client);

    await expect(
      svc.convertTaskToEvent("item-1", PLACEMENT),
    ).rejects.toMatchObject({ reason: "children" });
    expect(writeSequence(ops)).toEqual([]);
  });

  it("drops the payload it just wrote when the role UPDATE fails", async () => {
    const { client, ops } = makeClient({
      results: {
        ...happy(),
        "items_meta:update": [{ data: null, error: { message: "boom" } }],
        "events_payload:delete": [{ data: null, error: null }],
      },
    });
    const svc = new SupabaseItemConversionService(client);

    await expect(svc.convertTaskToEvent("item-1", PLACEMENT)).rejects.toThrow(
      /items_meta role/,
    );

    expect(writeSequence(ops)).toEqual([
      "events_payload:upsert",
      "items_meta:update",
      "events_payload:delete",
    ]);
    // The todo's own payload survives untouched — nothing to restore, because
    // nothing was taken away.
    expect(
      ops.some((o) => o.table === "tasks_payload" && o.kind === "delete"),
    ).toBe(false);
  });
});
