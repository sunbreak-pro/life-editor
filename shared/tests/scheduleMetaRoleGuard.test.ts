import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SupabaseScheduleItemsService,
  SupabaseRoutinesService,
} from "../src/services/SupabaseDataService";

/*
 * Every items_meta WRITE in the schedule path is filtered by role —
 * #996 for the UPDATEs, #1098 for the DELETEs.
 *
 * WHY THE FILTER IS NOT DECORATION
 * ================================
 * #625 lets one row change ROLE while keeping its id (D-20260810-sched-2), so
 * `items_meta.id` alone stopped being a safe address the moment conversion
 * shipped. An undo entry, a queued toast action or a stale panel still holding
 * the id will happily fire `dismissScheduleItem("x")` at a row that is now a
 * Todo — and without the role in the WHERE clause PostgREST finds it and
 * writes. #625 closed that hole for `updateScheduleItem` only; this pins the
 * other seventeen.
 *
 * #1098 is the same story one notch heavier. A wrong UPDATE stamps a row and
 * can be stamped back; a wrong DELETE removes the Todo's items_meta row and
 * takes its tasks_payload with it through the 0008 FK, and there is nothing
 * left to correct. The delete surface is ten sites across the two services —
 * three of them caller-supplied ids with no read-back, which is where the real
 * exposure lives.
 *
 * WHAT "SAFE" LOOKS LIKE HERE
 * ===========================
 * Not an error — a MISS. PostgREST reports zero matched rows as a success with
 * no error, which is the outcome we want: the stale operation evaporates
 * instead of corrupting the converted row, and the caller's `if (error)` path
 * never fires. So each case asserts the converted row is byte-identical
 * afterwards, and a control row of the right role in the same call IS written
 * — a filter that matched nothing at all would pass the first assertion for
 * the wrong reason.
 *
 * The one exception is `permanentDeleteRoutine`, whose two deletes are ordered
 * by an ON DELETE NO ACTION FK: a spared occurrence keeps its events_payload
 * row pointing at the routine, so the purge fails loudly rather than quietly.
 * Its case below pins the half that decides that — which rows each step
 * addresses, and in which order. The FK itself is not modelled here (no mock
 * enforces one), so the case says so rather than implying it proved the throw.
 *
 * Mock style mirrors scheduleItemsBulkWrites.test.ts / updateFuture
 * ScheduleItemsByRoutine.test.ts: single-use thenable PostgREST builders over
 * in-memory rows. This one actually APPLIES the filters rather than recording
 * them, because "0 rows written" is the contract under test.
 *
 * TWO TRAPS THIS FILE HAS TO AVOID
 * ================================
 * 1. Survival of a DELETE cannot be asserted against the captured row object.
 *    The delete branch replaces `db.items_meta` with a filtered copy, so the
 *    test's own `converted` reference stays alive either way and
 *    `expect(converted).toEqual(snapshot)` would pass even on a successful
 *    delete. Every delete case reads `metaIds(db)` instead.
 * 2. A census assertion is only as good as its scanner. The static test at the
 *    bottom counts raw `.delete(` tokens and compares that with the number it
 *    found inside a scanned chain, so a DELETE written in a shape it cannot
 *    read fails as a mismatch instead of vanishing into "all clear".
 */

interface Row {
  [col: string]: unknown;
}

interface Filter {
  op: "eq" | "in" | "gte" | "is";
  col: string;
  val: unknown;
}

/**
 * Every UPDATE and DELETE the service issued, for the "did it even run?"
 * assertions. One log rather than one per verb (#1098): the sentence being
 * pinned is "every items_meta write in this call named its role", and that
 * should not have to be restated once for UPDATE and once for DELETE.
 * `matched` means the same thing for both — rows the filters actually hit.
 */
interface WriteRecord {
  kind: "update" | "delete";
  table: string;
  filters: Filter[];
  matched: number;
}

class Builder implements PromiseLike<{ data?: unknown; error: unknown }> {
  private mode: "select" | "update" | "insert" | "delete" | null = null;
  private patch: Row = {};
  private filters: Filter[] = [];
  private singleRow = false;

  private inserted: Row[] = [];

  constructor(
    private readonly table: string,
    private readonly db: Record<string, Row[]>,
    private readonly writes: WriteRecord[],
    private readonly failInsert: Record<string, string>,
  ) {}

  select(): this {
    if (this.mode === null) this.mode = "select";
    return this;
  }
  update(patch: Row): this {
    this.mode = "update";
    this.patch = patch;
    return this;
  }
  /*
   * Real since #1098. The R2 orphan cleanups are only reachable by making the
   * PAYLOAD insert fail after the META insert succeeded, so the mock has to
   * both land rows and be able to refuse one table. The old stub also made
   * `.insert().select().single()` hand back whichever row was already first in
   * the table, which would have mapped the wrong row rather than failing.
   */
  insert(rows: Row | Row[]): this {
    this.mode = "insert";
    this.inserted = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  delete(): this {
    this.mode = "delete";
    return this;
  }
  eq(col: string, val: unknown): this {
    this.filters.push({ op: "eq", col, val });
    return this;
  }
  in(col: string, val: unknown): this {
    this.filters.push({ op: "in", col, val });
    return this;
  }
  gte(col: string, val: unknown): this {
    this.filters.push({ op: "gte", col, val });
    return this;
  }
  /*
   * Only convertEventToRoutine needs this — its #407 attach guard filters
   * `.is("routine_item_id", null)`. Over in-memory rows `is null` and strict
   * equality are the same test, so `matches()` treats it as one. Without the
   * method the chain dies on "is is not a function", and the rollback case
   * below is the whole reason that chain gets exercised here at all.
   */
  is(col: string, val: unknown): this {
    this.filters.push({ op: "is", col, val });
    return this;
  }
  order(): this {
    return this;
  }
  range(): this {
    return this;
  }
  maybeSingle(): this {
    this.singleRow = true;
    return this;
  }
  single(): this {
    this.singleRow = true;
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => {
      if (f.op === "eq" || f.op === "is") return row[f.col] === f.val;
      if (f.op === "gte") return String(row[f.col]) >= String(f.val);
      return (f.val as unknown[]).includes(row[f.col]);
    });
  }

  then<R1 = { data?: unknown; error: unknown }, R2 = never>(
    onFulfilled?:
      ((v: { data?: unknown; error: unknown }) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((r: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    const rows = this.db[this.table] ?? [];
    const hit = rows.filter((r) => this.matches(r));

    if (this.mode === "insert") {
      const message = this.failInsert[this.table];
      if (message !== undefined) {
        return Promise.resolve({ data: null, error: { message } }).then(
          onFulfilled,
          onRejected,
        );
      }
      this.db[this.table] = [...rows, ...this.inserted];
      const landed = this.singleRow
        ? (this.inserted[0] ?? null)
        : this.inserted;
      return Promise.resolve({ data: landed, error: null }).then(
        onFulfilled,
        onRejected,
      );
    }
    if (this.mode === "update") {
      for (const row of hit) Object.assign(row, this.patch);
      this.writes.push({
        kind: "update",
        table: this.table,
        filters: this.filters,
        matched: hit.length,
      });
      return Promise.resolve({ data: hit, error: null }).then(
        onFulfilled,
        onRejected,
      );
    }
    if (this.mode === "delete") {
      // Recorded since #1098 — the branch used to rewrite the table and say
      // nothing, so a census assertion written against `writes` would have
      // read an empty array and passed for the wrong reason.
      this.writes.push({
        kind: "delete",
        table: this.table,
        filters: this.filters,
        matched: hit.length,
      });
      this.db[this.table] = rows.filter((r) => !this.matches(r));
      // PostgREST answers a DELETE with no error even when it matched nothing.
      // That IS the contract: the stale operation evaporates.
      return Promise.resolve({ data: null, error: null }).then(
        onFulfilled,
        onRejected,
      );
    }
    const data = this.singleRow ? (hit[0] ?? null) : hit;
    return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
  }
}

function makeClient(
  db: Record<string, Row[]>,
  writes: WriteRecord[],
  /** Tables whose INSERT should come back as a PostgREST error, by message. */
  failInsert: Record<string, string> = {},
) {
  return {
    from: (table: string) => new Builder(table, db, writes, failInsert),
    // The mapper-driven writes stamp user_id, so they ask who is signed in.
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: "user-1" } }, error: null }),
    },
  } as unknown as SupabaseClient;
}

/** The role filter the site under test is supposed to carry. */
function roleFilters(writes: WriteRecord[]): Filter[] {
  return writes
    .filter((u) => u.table === "items_meta")
    .flatMap((u) => u.filters.filter((f) => f.col === "role"));
}

/**
 * What is left in items_meta. The vocabulary of every DELETE case, because the
 * delete branch swaps the array out and the test's own row references survive
 * it (trap 1 in the header).
 */
function metaIds(db: Record<string, Row[]>): string[] {
  return (db.items_meta ?? []).map((r) => r.id as string);
}

/** Rows a single items_meta write actually hit, in call order. */
function metaMatched(writes: WriteRecord[]): number[] {
  return writes.filter((u) => u.table === "items_meta").map((u) => u.matched);
}

/**
 * One converted row (id kept, role moved on) plus one live control row of the
 * role under test. Both start with the same mutable columns so "unchanged"
 * and "changed" are decidable by comparing them to the snapshot.
 */
function seed(liveRole: "event" | "routine") {
  const converted: Row = {
    id: "converted-1",
    role: "task", // #625 moved it; the caller still holds the old id
    title: "converted",
    is_deleted: false,
    deleted_at: null,
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const control: Row = {
    id: "control-1",
    role: liveRole,
    title: "control",
    is_deleted: false,
    deleted_at: null,
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  return { converted, control, snapshot: { ...converted } };
}

const payload = (itemId: string, extra: Row = {}): Row => ({
  item_id: itemId,
  user_id: "user-1",
  start_at: "2026-08-20",
  start_time: "10:00",
  end_time: "11:00",
  is_all_day: false,
  done: false,
  is_dismissed: false,
  routine_item_id: null,
  source_date: null,
  is_deleted_cache: false,
  ...extra,
});

describe("#996 schedule items_meta UPDATE is role-guarded", () => {
  /**
   * Table-driven over the single-id write surface. Every one of these used to
   * address the row by id alone, so every one of them could hit a converted
   * Todo.
   */
  const singleIdCases: Array<{
    name: string;
    run: (svc: SupabaseScheduleItemsService, id: string) => Promise<unknown>;
  }> = [
    {
      name: "softDeleteScheduleItem",
      run: (svc, id) => svc.softDeleteScheduleItem(id),
    },
    {
      name: "dismissScheduleItem",
      run: (svc, id) => svc.dismissScheduleItem(id),
    },
    {
      name: "undismissScheduleItem",
      run: (svc, id) => svc.undismissScheduleItem(id),
    },
  ];

  for (const c of singleIdCases) {
    it(`${c.name} leaves a converted row untouched`, async () => {
      const { converted, control, snapshot } = seed("event");
      const writes: WriteRecord[] = [];
      const db: Record<string, Row[]> = {
        items_meta: [converted, control],
        events_payload: [payload("converted-1"), payload("control-1")],
      };
      const svc = new SupabaseScheduleItemsService(makeClient(db, writes));

      await c.run(svc, "converted-1");

      expect(converted).toEqual(snapshot);
      expect(roleFilters(writes)).toEqual([
        { op: "eq", col: "role", val: "event" },
      ]);
      expect(
        writes.filter((u) => u.table === "items_meta").map((u) => u.matched),
      ).toEqual([0]);
    });

    it(`${c.name} still writes a live event`, async () => {
      const { converted, control } = seed("event");
      const writes: WriteRecord[] = [];
      const db: Record<string, Row[]> = {
        items_meta: [converted, control],
        events_payload: [payload("converted-1"), payload("control-1")],
      };
      const svc = new SupabaseScheduleItemsService(makeClient(db, writes));

      await c.run(svc, "control-1");

      expect(control.updated_at).not.toBe("2026-01-01T00:00:00.000Z");
      expect(
        writes.filter((u) => u.table === "items_meta").map((u) => u.matched),
      ).toEqual([1]);
    });
  }

  /*
   * The two methods that READ THE ROW BACK end differently, and better: the
   * role filter makes the write miss, then `assertItemsMetaPair` refuses to
   * map a "task" row as an event and the call rejects. The caller learns the
   * item moved instead of getting a silently stale ScheduleItem back — so the
   * contract pinned here is "untouched AND loud", not "untouched and quiet".
   */
  it("toggleScheduleItemComplete refuses a converted row and writes nothing", async () => {
    const { converted, control, snapshot } = seed("event");
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [converted, control],
      events_payload: [payload("converted-1"), payload("control-1")],
    };
    const svc = new SupabaseScheduleItemsService(makeClient(db, writes));

    await expect(svc.toggleScheduleItemComplete("converted-1")).rejects.toThrow(
      /items_meta\.role expected "event"/,
    );

    expect(converted).toEqual(snapshot);
    expect(roleFilters(writes)).toEqual([
      { op: "eq", col: "role", val: "event" },
    ]);
    expect(
      writes.filter((u) => u.table === "items_meta").map((u) => u.matched),
    ).toEqual([0]);
  });

  it("updateScheduleItem refuses a converted row (#625's original guard)", async () => {
    const { converted, control, snapshot } = seed("event");
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [converted, control],
      events_payload: [payload("converted-1"), payload("control-1")],
    };
    const svc = new SupabaseScheduleItemsService(makeClient(db, writes));

    await expect(
      svc.updateScheduleItem("converted-1", { title: "hijacked" }),
    ).rejects.toThrow(/items_meta\.role expected "event"/);

    expect(converted).toEqual(snapshot);
  });

  it("bulkSoftDeleteScheduleItems skips converted ids and keeps the rest", async () => {
    const { converted, control, snapshot } = seed("event");
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [converted, control],
      events_payload: [payload("converted-1"), payload("control-1")],
    };
    const svc = new SupabaseScheduleItemsService(makeClient(db, writes));

    // The generator's cleanup pass hands over a list it built earlier; one of
    // the ids was converted in between.
    await svc.bulkSoftDeleteScheduleItems(["converted-1", "control-1"]);

    expect(converted).toEqual(snapshot);
    expect(control.is_deleted).toBe(true);
    expect(roleFilters(writes)).toEqual([
      { op: "eq", col: "role", val: "event" },
    ]);
  });

  it("updateFutureScheduleItemsByRoutine skips converted ids", async () => {
    const { converted, control, snapshot } = seed("event");
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [converted, control],
      events_payload: [
        payload("converted-1", { routine_item_id: "routine-1" }),
        payload("control-1", { routine_item_id: "routine-1" }),
      ],
    };
    const svc = new SupabaseScheduleItemsService(makeClient(db, writes));

    await svc.updateFutureScheduleItemsByRoutine(
      "routine-1",
      { title: "series rename" },
      "2026-08-01",
      { title: "converted", startTime: "10:00", endTime: "11:00" },
    );

    expect(converted).toEqual(snapshot);
    expect(roleFilters(writes)).toEqual([
      { op: "eq", col: "role", val: "event" },
    ]);
  });

  it("restoreScheduleItem leaves a converted row untouched", async () => {
    const { converted, control, snapshot } = seed("event");
    converted.is_deleted = true;
    snapshot.is_deleted = true;
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [converted, control],
      events_payload: [
        payload("converted-1", { is_deleted_cache: true }),
        payload("control-1"),
      ],
    };
    const svc = new SupabaseScheduleItemsService(makeClient(db, writes));

    await svc.restoreScheduleItem("converted-1");

    expect(converted).toEqual(snapshot);
    expect(roleFilters(writes)).toEqual([
      { op: "eq", col: "role", val: "event" },
    ]);
  });
});

describe("#996 routine items_meta UPDATE is role-guarded", () => {
  it("updateRoutine will not write a row that is no longer a routine", async () => {
    const { converted, control, snapshot } = seed("routine");
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [converted, control],
      routines_payload: [{ item_id: "converted-1", user_id: "user-1" }],
    };
    const svc = new SupabaseRoutinesService(makeClient(db, writes));

    // Same two-layer shape as updateScheduleItem: the filter makes the write
    // miss, the read-back mapper turns the miss into a loud refusal.
    await expect(
      svc.updateRoutine("converted-1", { title: "hijacked" }),
    ).rejects.toThrow(/items_meta\.role expected "routine"/);

    expect(converted).toEqual(snapshot);
    expect(roleFilters(writes)).toEqual([
      { op: "eq", col: "role", val: "routine" },
    ]);
  });

  it("restoreRoutine will not resurrect a row that is no longer a routine", async () => {
    const { converted, control, snapshot } = seed("routine");
    converted.is_deleted = true;
    snapshot.is_deleted = true;
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = { items_meta: [converted, control] };
    const svc = new SupabaseRoutinesService(makeClient(db, writes));

    await svc.restoreRoutine("converted-1");

    expect(converted).toEqual(snapshot);
    expect(roleFilters(writes)).toEqual([
      { op: "eq", col: "role", val: "routine" },
    ]);
  });

  it("softDeleteRoutine guards the routine row and its occurrences separately", async () => {
    const routine: Row = {
      id: "routine-1",
      role: "routine",
      title: "r",
      is_deleted: false,
      deleted_at: null,
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    // An occurrence that was converted to a Todo since the last generator pass:
    // still linked from events_payload, no longer an event.
    const convertedOccurrence: Row = {
      id: "occ-converted",
      role: "task",
      title: "occ",
      is_deleted: false,
      deleted_at: null,
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const liveOccurrence: Row = {
      ...convertedOccurrence,
      id: "occ-live",
      role: "event",
    };
    const snapshot = { ...convertedOccurrence };
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [routine, convertedOccurrence, liveOccurrence],
      events_payload: [
        payload("occ-converted", { routine_item_id: "routine-1" }),
        payload("occ-live", { routine_item_id: "routine-1" }),
      ],
    };
    const svc = new SupabaseRoutinesService(makeClient(db, writes));

    await svc.softDeleteRoutine("routine-1");

    expect(routine.is_deleted).toBe(true);
    expect(liveOccurrence.is_deleted).toBe(true);
    expect(convertedOccurrence).toEqual(snapshot);
    expect(roleFilters(writes)).toEqual([
      { op: "eq", col: "role", val: "routine" },
      { op: "eq", col: "role", val: "event" },
    ]);
  });
});
describe("#1098 schedule items_meta DELETE is role-guarded", () => {
  /*
   * The two hard deletes that take a caller-supplied id and never read the row
   * back. Identical chains, so one pair of cases covers both — and the pair is
   * the point: "the converted row survived" on its own would also be true of a
   * guard misspelled into matching nothing at all.
   */
  const singleIdDeleteCases: Array<{
    name: string;
    run: (svc: SupabaseScheduleItemsService, id: string) => Promise<void>;
  }> = [
    {
      name: "deleteScheduleItem",
      run: (svc, id) => svc.deleteScheduleItem(id),
    },
    {
      name: "permanentDeleteScheduleItem",
      run: (svc, id) => svc.permanentDeleteScheduleItem(id),
    },
  ];

  for (const c of singleIdDeleteCases) {
    it(`${c.name} leaves a converted row in the table`, async () => {
      const { converted, control } = seed("event");
      const writes: WriteRecord[] = [];
      const db: Record<string, Row[]> = {
        items_meta: [converted, control],
        events_payload: [payload("converted-1"), payload("control-1")],
      };
      const svc = new SupabaseScheduleItemsService(makeClient(db, writes));

      // Resolves rather than throwing: zero matched rows is a PostgREST
      // success, and the caller must not be told about a row it no longer owns.
      await expect(c.run(svc, "converted-1")).resolves.toBeUndefined();

      expect(metaIds(db)).toEqual(["converted-1", "control-1"]);
      expect(roleFilters(writes)).toEqual([
        { op: "eq", col: "role", val: "event" },
      ]);
      expect(metaMatched(writes)).toEqual([0]);
    });

    it(`${c.name} still removes a live event`, async () => {
      const { converted, control } = seed("event");
      const writes: WriteRecord[] = [];
      const db: Record<string, Row[]> = {
        items_meta: [converted, control],
        events_payload: [payload("converted-1"), payload("control-1")],
      };
      const svc = new SupabaseScheduleItemsService(makeClient(db, writes));

      await c.run(svc, "control-1");

      expect(metaIds(db)).toEqual(["converted-1"]);
      expect(metaMatched(writes)).toEqual([1]);
    });
  }

  it("bulkDeleteScheduleItems drops a converted id and deletes the rest", async () => {
    const { converted, control } = seed("event");
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [converted, control],
      events_payload: [payload("converted-1"), payload("control-1")],
    };
    const svc = new SupabaseScheduleItemsService(makeClient(db, writes));

    // The widest surface of the ten: a list built earlier, with one of its ids
    // converted in between. Pre-#1098 that id took a Todo's meta row — and its
    // tasks_payload through the 0008 cascade — out with the batch.
    const requested = await svc.bulkDeleteScheduleItems([
      "converted-1",
      "control-1",
    ]);

    expect(metaIds(db)).toEqual(["converted-1"]);
    expect(roleFilters(writes)).toEqual([
      { op: "eq", col: "role", val: "event" },
    ]);
    // Still the REQUESTED count, as the method's own doc promises: these
    // DELETEs go out without `count: "exact"`, so a filtered-out id was
    // already indistinguishable from one that no longer existed.
    expect(requested).toBe(2);
  });

  /*
   * The R2 orphan cleanups get the CONTROL half only, and deliberately so.
   * Their DELETE addresses the row the same call inserted microseconds
   * earlier, so there is no converted direction to reach: `items_meta.id` is
   * unique and the INSERT had just succeeded. What the guard could plausibly
   * break here is the opposite failure — a filter typo leaving the orphan
   * behind, which is the exact R2 violation the cleanup exists to prevent.
   */
  it("createScheduleItem still clears its orphan meta when the payload insert fails", async () => {
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = { items_meta: [], events_payload: [] };
    const svc = new SupabaseScheduleItemsService(
      makeClient(db, writes, { events_payload: "payload boom" }),
    );

    await expect(
      svc.createScheduleItem("ev-1", "2026-08-20", "t", "10:00", "11:00"),
    ).rejects.toThrow(/payload boom/);

    expect(metaIds(db)).toEqual([]);
    expect(roleFilters(writes)).toEqual([
      { op: "eq", col: "role", val: "event" },
    ]);
  });

  it("bulkCreateScheduleItems still clears its orphan metas when the payload insert fails", async () => {
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = { items_meta: [], events_payload: [] };
    const svc = new SupabaseScheduleItemsService(
      makeClient(db, writes, { events_payload: "payload boom" }),
    );

    // No routineId, so the Issue-011 live-pair pre-check short-circuits before
    // it needs a SELECT — this case is about the cleanup, not the dedup.
    await expect(
      svc.bulkCreateScheduleItems([
        {
          id: "ev-1",
          date: "2026-08-20",
          title: "a",
          startTime: "10:00",
          endTime: "11:00",
        },
        {
          id: "ev-2",
          date: "2026-08-21",
          title: "b",
          startTime: "10:00",
          endTime: "11:00",
        },
      ]),
    ).rejects.toThrow(/payload boom/);

    expect(metaIds(db)).toEqual([]);
    expect(roleFilters(writes)).toEqual([
      { op: "eq", col: "role", val: "event" },
    ]);
  });
});

describe("#1098 routine items_meta DELETE is role-guarded", () => {
  it("deleteRoutine leaves a row that is no longer a routine", async () => {
    const { converted, control } = seed("routine");
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = { items_meta: [converted, control] };
    const svc = new SupabaseRoutinesService(makeClient(db, writes));

    await expect(svc.deleteRoutine("converted-1")).resolves.toBeUndefined();

    expect(metaIds(db)).toEqual(["converted-1", "control-1"]);
    expect(roleFilters(writes)).toEqual([
      { op: "eq", col: "role", val: "routine" },
    ]);
  });

  it("deleteRoutine still removes a live routine", async () => {
    const { control } = seed("routine");
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = { items_meta: [control] };
    const svc = new SupabaseRoutinesService(makeClient(db, writes));

    await svc.deleteRoutine("control-1");

    expect(metaIds(db)).toEqual([]);
    expect(metaMatched(writes)).toEqual([1]);
  });

  it("createRoutine still clears its orphan meta when the payload insert fails", async () => {
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = { items_meta: [], routines_payload: [] };
    const svc = new SupabaseRoutinesService(
      makeClient(db, writes, { routines_payload: "payload boom" }),
    );

    await expect(
      svc.createRoutine("rt-1", "Stretch"),
    ).rejects.toThrow(/payload boom/);

    expect(metaIds(db)).toEqual([]);
    expect(roleFilters(writes)).toEqual([
      { op: "eq", col: "role", val: "routine" },
    ]);
  });

  /*
   * convertEventToRoutine's rollback. CONTROL HALF ONLY, and the comment
   * convention here is to say why rather than let the gap look accidental:
   * `routineId` is minted by the host and the row was created by the awaited
   * createRoutine two statements earlier, so there is no converted direction
   * to reach — no failure has ever been witnessed at this site. It is guarded
   * so the census can be absolute and so the file reads one way.
   *
   * What the control half is genuinely worth: convertEventToRoutine.test.ts
   * records the rollback's filters but never applies them, so it cannot tell
   * a correct filter from one that matches nothing. This runs the real
   * createRoutine and the real rollback against a db that DOES apply them, so
   * "the routine row is actually gone" becomes checkable.
   *
   * The rollback is reached the cheap way — seed no events_payload row for
   * the event, so the #407 attach guard's read-back comes back empty and
   * throws.
   */
  it("convertEventToRoutine rolls its routine back out of items_meta", async () => {
    const seedEvent: Row = {
      id: "ev-1",
      role: "event",
      title: "seed",
      is_deleted: false,
      deleted_at: null,
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [seedEvent],
      events_payload: [],
      routines_payload: [],
    };
    const svc = new SupabaseRoutinesService(makeClient(db, writes));

    await expect(
      svc.convertEventToRoutine("ev-1", "routine-1", {
        title: "Stretch",
        sourceDate: "2026-08-20",
      }),
    ).rejects.toThrow(/#407 double-conversion guard/);

    // The routine createRoutine inserted is gone again; the seed is untouched.
    expect(metaIds(db)).toEqual(["ev-1"]);
    // Both guarded items_meta writes on this path, in order: the seed's
    // updated_at bump (event) and the rollback delete (routine).
    expect(roleFilters(writes)).toEqual([
      { op: "eq", col: "role", val: "event" },
      { op: "eq", col: "role", val: "routine" },
    ]);
  });

  /*
   * The only method with two guarded DELETEs carrying DIFFERENT roles — and
   * the only one where a miss is not silent.
   *
   * The state seeded here is reachable rather than hypothetical: a conversion
   * writes the new payload, flips items_meta.role, then drops the old payload
   * (convertItemRole), so a run that dies between the last two steps leaves
   * exactly this — a role='task' row still linked from events_payload.
   *
   * In the real DB, sparing that occurrence means its events_payload row keeps
   * referencing the routine through the 0011 composite FK (ON DELETE NO
   * ACTION), so step 3 is REJECTED and the purge throws. The mock has no FK to
   * enforce, so what this case pins is the half that decides it: which rows
   * each step addresses, and in which order. That is the trade #1098 chose —
   * a purge that refuses leaves a diagnosable leftover, and a hard-deleted
   * Todo leaves nothing.
   */
  it("permanentDeleteRoutine purges its occurrences and itself, sparing a converted one", async () => {
    const routine: Row = {
      id: "routine-1",
      role: "routine",
      title: "r",
      is_deleted: false,
      deleted_at: null,
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const convertedOccurrence: Row = {
      id: "occ-converted",
      role: "task",
      title: "occ",
      is_deleted: false,
      deleted_at: null,
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const liveOccurrence: Row = {
      ...convertedOccurrence,
      id: "occ-live",
      role: "event",
    };
    const writes: WriteRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [routine, convertedOccurrence, liveOccurrence],
      events_payload: [
        payload("occ-converted", { routine_item_id: "routine-1" }),
        payload("occ-live", { routine_item_id: "routine-1" }),
      ],
    };
    const svc = new SupabaseRoutinesService(makeClient(db, writes));

    await svc.permanentDeleteRoutine("routine-1");

    expect(metaIds(db)).toEqual(["occ-converted"]);
    // Step 2 addresses the OCCURRENCES (role='event'), step 3 the routine —
    // in that order, which is the ordering the NO ACTION FK demands.
    expect(roleFilters(writes)).toEqual([
      { op: "eq", col: "role", val: "event" },
      { op: "eq", col: "role", val: "routine" },
    ]);
  });
});
/*
 * THE CENSUS (#1098 DoD: "全数 role 絞り込み済み" pinned by a counting test)
 * ========================================================================
 * The behavioural cases above prove the guards that exist behave correctly.
 * They cannot prove no unguarded DELETE is left, and they cannot notice one
 * added next month. This reads the two service files off disk and states the
 * whole delete surface as a fact.
 *
 * It deliberately does NOT extend to the #996 UPDATE sites. Sixteen more
 * pinned lines in two files several branches are editing concurrently is real
 * merge friction, and the Issue asks for the delete half — the scan below is
 * three lines away from covering them if that ever becomes worth paying for.
 *
 * What it also does not catch: the two deletes inside permanentDeleteRoutine
 * swapping roles with each other. The multiset it compares would be identical.
 * That one is owned by the behavioural case above, which asserts the order.
 */

const SERVICE_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/services",
);

/**
 * Comments become spaces of the same length rather than being removed, so
 * every offset and line number still lines up with the real file. These files
 * are heavily commented by house style, and a comment sitting mid-chain must
 * not be able to truncate one. The `(?<!:)` keeps a `"https://…"` literal from
 * reading as a line comment — neither file has one today, and the insurance is
 * free.
 */
function blankComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\/|(?<!:)\/\/[^\n]*/g, (m) =>
    m.replace(/[^\n]/g, " "),
  );
}

interface Chain {
  /** The whole `.from("items_meta")…` call chain, comments blanked. */
  text: string;
  line: number;
  method: string;
}

/**
 * Walk the chain instead of matching it. A regex cannot survive nested parens
 * (`.insert(pairs.map((p) => p.meta))`) or the arrow-wrapped chains inside
 * `forEachIdChunk`, and three of the ten sites are exactly those shapes.
 */
function itemsMetaChains(blanked: string): Chain[] {
  const NEEDLE = '.from("items_meta")';
  const out: Chain[] = [];
  for (
    let i = blanked.indexOf(NEEDLE);
    i !== -1;
    i = blanked.indexOf(NEEDLE, i + NEEDLE.length)
  ) {
    let cursor = i + NEEDLE.length;
    let text = NEEDLE;
    for (;;) {
      while (cursor < blanked.length && /\s/.test(blanked[cursor])) cursor++;
      if (blanked[cursor] !== ".") break;
      let name = cursor + 1;
      while (name < blanked.length && /[A-Za-z0-9_]/.test(blanked[name]))
        name++;
      if (blanked[name] !== "(") break;
      let depth = 0;
      let end = name;
      for (; end < blanked.length; end++) {
        if (blanked[end] === "(") depth++;
        else if (blanked[end] === ")" && --depth === 0) {
          end++;
          break;
        }
      }
      text += blanked.slice(cursor, end);
      cursor = end;
    }
    const before = blanked.slice(0, i);
    out.push({
      text,
      line: 1 + (before.match(/\n/g) ?? []).length,
      method: enclosingMethod(before),
    });
  }
  return out;
}

/**
 * Nearest preceding member declaration. Both files are a single class indented
 * two spaces, so the shape is unambiguous; the offender line falls back to
 * "?" if that ever stops being true, which still leaves file:line to act on.
 */
function enclosingMethod(before: string): string {
  const lines = before.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const m =
      /^ {2}(?:private |public |protected )?(?:async )?([A-Za-z_]\w*)\s*\(/.exec(
        lines[i],
      );
    if (m) return m[1];
  }
  return "?";
}

const CENSUS_FILES = [
  "SupabaseScheduleItemsService.ts",
  "SupabaseRoutinesService.ts",
] as const;

/**
 * The pinned surface: one `method → role` line per items_meta DELETE, sorted.
 * A new delete fails this list, and the offender message says what to add.
 */
const EXPECTED: Record<(typeof CENSUS_FILES)[number], string[]> = {
  "SupabaseScheduleItemsService.ts": [
    "bulkCreateScheduleItems → event",
    "bulkDeleteScheduleItems → event",
    "createScheduleItem → event",
    "deleteScheduleItem → event",
    "permanentDeleteScheduleItem → event",
  ],
  "SupabaseRoutinesService.ts": [
    "convertEventToRoutine → routine",
    "createRoutine → routine",
    "deleteRoutine → routine",
    "permanentDeleteRoutine → event",
    "permanentDeleteRoutine → routine",
  ],
};

describe("#1098 census — every schedule-side items_meta DELETE names its role", () => {
  for (const file of CENSUS_FILES) {
    const blanked = blankComments(
      readFileSync(resolve(SERVICE_DIR, file), "utf8").replace(/\r\n/g, "\n"),
    );
    const chains = itemsMetaChains(blanked);
    const deletes = chains.filter((c) => c.text.includes(".delete("));

    it(`${file}: the scanner sees every DELETE in the file`, () => {
      // Guards the guard. If a DELETE is ever written in a shape this scanner
      // cannot read — a builder stashed in a const, a helper handed `from(...)`
      // — it must surface as a mismatch, not as silent under-coverage.
      const raw = (blanked.match(/\.delete\(/g) ?? []).length;
      expect(
        deletes.length,
        `${file}: ${raw} .delete( calls in the file but only ${deletes.length} inside a scanned .from("items_meta") chain. A DELETE is being built in a shape this census cannot read (#1098) — inline the chain, or teach itemsMetaChains().`,
      ).toBe(raw);
    });

    it(`${file}: no items_meta DELETE addresses a row by id alone`, () => {
      const offenders = deletes
        .filter((c) => !/\.(eq|in)\("role"/.test(c.text))
        .map(
          (c) =>
            `${file}:${c.line} ${c.method} — ${c.text.replace(/\s+/g, " ")} — add .eq("role", "<role>") (#1098: #625 lets a row keep its id while changing role, so id alone can address a Todo)`,
        );
      expect(offenders).toEqual([]);
    });

    it(`${file}: the delete surface is exactly the pinned set`, () => {
      const actual = deletes
        .map((c) => {
          const role = /\.eq\("role",\s*"(\w+)"\)/.exec(c.text)?.[1];
          return `${c.method} → ${role ?? "UNGUARDED"}`;
        })
        .sort();
      expect(actual).toEqual([...EXPECTED[file]].sort());
    });
  }
});
