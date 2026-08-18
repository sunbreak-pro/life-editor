import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SupabaseScheduleItemsService,
  SupabaseRoutinesService,
} from "../src/services/SupabaseDataService";

/*
 * #996 — every items_meta UPDATE in the schedule path is filtered by role.
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
 * Mock style mirrors scheduleItemsBulkWrites.test.ts / updateFuture
 * ScheduleItemsByRoutine.test.ts: single-use thenable PostgREST builders over
 * in-memory rows. This one actually APPLIES the filters rather than recording
 * them, because "0 rows updated" is the contract under test.
 */

interface Row {
  [col: string]: unknown;
}

interface Filter {
  op: "eq" | "in" | "gte";
  col: string;
  val: unknown;
}

/** Every UPDATE the service issued, for the "did it even run?" assertions. */
interface UpdateRecord {
  table: string;
  filters: Filter[];
  matched: number;
}

class Builder implements PromiseLike<{ data?: unknown; error: unknown }> {
  private mode: "select" | "update" | "insert" | "delete" | null = null;
  private patch: Row = {};
  private filters: Filter[] = [];
  private singleRow = false;

  constructor(
    private readonly table: string,
    private readonly db: Record<string, Row[]>,
    private readonly updates: UpdateRecord[],
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
  insert(): this {
    this.mode = "insert";
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
      if (f.op === "eq") return row[f.col] === f.val;
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

    if (this.mode === "update") {
      for (const row of hit) Object.assign(row, this.patch);
      this.updates.push({
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
      this.db[this.table] = rows.filter((r) => !this.matches(r));
      return Promise.resolve({ data: null, error: null }).then(
        onFulfilled,
        onRejected,
      );
    }
    const data = this.singleRow ? (hit[0] ?? null) : hit;
    return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
  }
}

function makeClient(db: Record<string, Row[]>, updates: UpdateRecord[]) {
  return {
    from: (table: string) => new Builder(table, db, updates),
    // The mapper-driven writes stamp user_id, so they ask who is signed in.
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: "user-1" } }, error: null }),
    },
  } as unknown as SupabaseClient;
}

/** The role filter the site under test is supposed to carry. */
function roleFilters(updates: UpdateRecord[]): Filter[] {
  return updates
    .filter((u) => u.table === "items_meta")
    .flatMap((u) => u.filters.filter((f) => f.col === "role"));
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
      const updates: UpdateRecord[] = [];
      const db: Record<string, Row[]> = {
        items_meta: [converted, control],
        events_payload: [payload("converted-1"), payload("control-1")],
      };
      const svc = new SupabaseScheduleItemsService(makeClient(db, updates));

      await c.run(svc, "converted-1");

      expect(converted).toEqual(snapshot);
      expect(roleFilters(updates)).toEqual([
        { op: "eq", col: "role", val: "event" },
      ]);
      expect(
        updates.filter((u) => u.table === "items_meta").map((u) => u.matched),
      ).toEqual([0]);
    });

    it(`${c.name} still writes a live event`, async () => {
      const { converted, control } = seed("event");
      const updates: UpdateRecord[] = [];
      const db: Record<string, Row[]> = {
        items_meta: [converted, control],
        events_payload: [payload("converted-1"), payload("control-1")],
      };
      const svc = new SupabaseScheduleItemsService(makeClient(db, updates));

      await c.run(svc, "control-1");

      expect(control.updated_at).not.toBe("2026-01-01T00:00:00.000Z");
      expect(
        updates.filter((u) => u.table === "items_meta").map((u) => u.matched),
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
    const updates: UpdateRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [converted, control],
      events_payload: [payload("converted-1"), payload("control-1")],
    };
    const svc = new SupabaseScheduleItemsService(makeClient(db, updates));

    await expect(svc.toggleScheduleItemComplete("converted-1")).rejects.toThrow(
      /items_meta\.role expected "event"/,
    );

    expect(converted).toEqual(snapshot);
    expect(roleFilters(updates)).toEqual([
      { op: "eq", col: "role", val: "event" },
    ]);
    expect(
      updates.filter((u) => u.table === "items_meta").map((u) => u.matched),
    ).toEqual([0]);
  });

  it("updateScheduleItem refuses a converted row (#625's original guard)", async () => {
    const { converted, control, snapshot } = seed("event");
    const updates: UpdateRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [converted, control],
      events_payload: [payload("converted-1"), payload("control-1")],
    };
    const svc = new SupabaseScheduleItemsService(makeClient(db, updates));

    await expect(
      svc.updateScheduleItem("converted-1", { title: "hijacked" }),
    ).rejects.toThrow(/items_meta\.role expected "event"/);

    expect(converted).toEqual(snapshot);
  });

  it("bulkSoftDeleteScheduleItems skips converted ids and keeps the rest", async () => {
    const { converted, control, snapshot } = seed("event");
    const updates: UpdateRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [converted, control],
      events_payload: [payload("converted-1"), payload("control-1")],
    };
    const svc = new SupabaseScheduleItemsService(makeClient(db, updates));

    // The generator's cleanup pass hands over a list it built earlier; one of
    // the ids was converted in between.
    await svc.bulkSoftDeleteScheduleItems(["converted-1", "control-1"]);

    expect(converted).toEqual(snapshot);
    expect(control.is_deleted).toBe(true);
    expect(roleFilters(updates)).toEqual([
      { op: "eq", col: "role", val: "event" },
    ]);
  });

  it("updateFutureScheduleItemsByRoutine skips converted ids", async () => {
    const { converted, control, snapshot } = seed("event");
    const updates: UpdateRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [converted, control],
      events_payload: [
        payload("converted-1", { routine_item_id: "routine-1" }),
        payload("control-1", { routine_item_id: "routine-1" }),
      ],
    };
    const svc = new SupabaseScheduleItemsService(makeClient(db, updates));

    await svc.updateFutureScheduleItemsByRoutine(
      "routine-1",
      { title: "series rename" },
      "2026-08-01",
      { title: "converted", startTime: "10:00", endTime: "11:00" },
    );

    expect(converted).toEqual(snapshot);
    expect(roleFilters(updates)).toEqual([
      { op: "eq", col: "role", val: "event" },
    ]);
  });

  it("restoreScheduleItem leaves a converted row untouched", async () => {
    const { converted, control, snapshot } = seed("event");
    converted.is_deleted = true;
    snapshot.is_deleted = true;
    const updates: UpdateRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [converted, control],
      events_payload: [
        payload("converted-1", { is_deleted_cache: true }),
        payload("control-1"),
      ],
    };
    const svc = new SupabaseScheduleItemsService(makeClient(db, updates));

    await svc.restoreScheduleItem("converted-1");

    expect(converted).toEqual(snapshot);
    expect(roleFilters(updates)).toEqual([
      { op: "eq", col: "role", val: "event" },
    ]);
  });
});

describe("#996 routine items_meta UPDATE is role-guarded", () => {
  it("updateRoutine will not write a row that is no longer a routine", async () => {
    const { converted, control, snapshot } = seed("routine");
    const updates: UpdateRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [converted, control],
      routines_payload: [{ item_id: "converted-1", user_id: "user-1" }],
    };
    const svc = new SupabaseRoutinesService(makeClient(db, updates));

    // Same two-layer shape as updateScheduleItem: the filter makes the write
    // miss, the read-back mapper turns the miss into a loud refusal.
    await expect(
      svc.updateRoutine("converted-1", { title: "hijacked" }),
    ).rejects.toThrow(/items_meta\.role expected "routine"/);

    expect(converted).toEqual(snapshot);
    expect(roleFilters(updates)).toEqual([
      { op: "eq", col: "role", val: "routine" },
    ]);
  });

  it("restoreRoutine will not resurrect a row that is no longer a routine", async () => {
    const { converted, control, snapshot } = seed("routine");
    converted.is_deleted = true;
    snapshot.is_deleted = true;
    const updates: UpdateRecord[] = [];
    const db: Record<string, Row[]> = { items_meta: [converted, control] };
    const svc = new SupabaseRoutinesService(makeClient(db, updates));

    await svc.restoreRoutine("converted-1");

    expect(converted).toEqual(snapshot);
    expect(roleFilters(updates)).toEqual([
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
    const updates: UpdateRecord[] = [];
    const db: Record<string, Row[]> = {
      items_meta: [routine, convertedOccurrence, liveOccurrence],
      events_payload: [
        payload("occ-converted", { routine_item_id: "routine-1" }),
        payload("occ-live", { routine_item_id: "routine-1" }),
      ],
    };
    const svc = new SupabaseRoutinesService(makeClient(db, updates));

    await svc.softDeleteRoutine("routine-1");

    expect(routine.is_deleted).toBe(true);
    expect(liveOccurrence.is_deleted).toBe(true);
    expect(convertedOccurrence).toEqual(snapshot);
    expect(roleFilters(updates)).toEqual([
      { op: "eq", col: "role", val: "routine" },
      { op: "eq", col: "role", val: "event" },
    ]);
  });
});
