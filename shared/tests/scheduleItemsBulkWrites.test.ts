import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseScheduleItemsService } from "../src/services/SupabaseDataService";
import {
  POSTGREST_IN_CHUNK_SIZE,
  POSTGREST_PAGE_SIZE,
} from "../src/services/postgrestFetchAll";

/*
 * #897 — the four bulk WRITE paths of SupabaseScheduleItemsService that had no
 * test at all (updateFutureScheduleItemsByRoutine is covered separately by
 * updateFutureScheduleItemsByRoutine.test.ts).
 *
 * These are the routine generator's write surface, so the contracts pinned
 * here are the ones whose breakage is SILENT in the UI:
 *
 *   - Idempotency (Issue 011): the partial UNIQUE (routine_item_id,
 *     source_date) WHERE is_deleted_cache = false cannot be named in a
 *     PostgREST `onConflict`, so bulkCreate dedupes with a pre-SELECT of live
 *     pairs instead. Losing that pre-check grows duplicate occurrences.
 *   - Write / delete ORDER (db-conventions DB-Q3): items_meta is the parent
 *     (events_payload.item_id references it ON DELETE CASCADE), so INSERT goes
 *     parent-first and DELETE targets the parent only. R2 cleanup after a
 *     failed payload INSERT must hard-delete the metas just written, or the
 *     batch leaves orphan meta rows behind.
 *   - Soft-delete / restore never touch events_payload: the 0008 AFTER UPDATE
 *     trigger mirrors is_deleted onto is_deleted_cache. An app-layer mirror
 *     would be a second writer for the same fact.
 *
 * Mock style mirrors updateFutureScheduleItemsByRoutine.test.ts: single-use
 * thenable PostgREST builders over an in-memory row set, recording every write
 * in call order so ordering assertions are possible.
 */

const USER_ID = "user-1";

interface LivePairRow {
  routine_item_id: string;
  source_date: string;
  is_deleted_cache: boolean;
  /**
   * Present so a test can put a DISMISSED-but-live pair in the table. The
   * pre-check deliberately does NOT filter on it — see the dismissed case
   * below.
   */
  is_dismissed?: boolean;
}

/** One pre-check SELECT, recorded so paging can be asserted. */
interface SelectRecord {
  table: string;
  range: [number, number] | null;
}

type WriteRecord =
  | { op: "insert"; table: string; rows: Array<Record<string, unknown>> }
  | {
      op: "update";
      table: string;
      patch: Record<string, unknown>;
      ids: string[];
    }
  | { op: "delete"; table: string; ids: string[] };

interface Filter {
  op: "eq" | "in";
  col: string;
  val: unknown;
}

/** Which write should fail, and with what message. */
interface FailurePlan {
  metaInsert?: string;
  payloadInsert?: string;
  metaDelete?: string;
  metaUpdate?: string;
}

class Builder implements PromiseLike<{ data?: unknown; error: unknown }> {
  private mode: "select" | "insert" | "update" | "delete" | null = null;
  private columns = "";
  private rows: Array<Record<string, unknown>> = [];
  private patch: Record<string, unknown> = {};
  private filters: Filter[] = [];
  private rangeArgs: [number, number] | null = null;

  constructor(
    private readonly table: string,
    private readonly live: LivePairRow[],
    private readonly writes: WriteRecord[],
    private readonly fail: FailurePlan,
    private readonly selects: SelectRecord[],
  ) {}

  select(columns = ""): this {
    this.mode = "select";
    this.columns = columns;
    return this;
  }
  insert(rows: Array<Record<string, unknown>>): this {
    this.mode = "insert";
    this.rows = rows;
    return this;
  }
  update(patch: Record<string, unknown>): this {
    this.mode = "update";
    this.patch = patch;
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
  order(): this {
    return this;
  }
  range(from: number, to: number): this {
    this.rangeArgs = [from, to];
    return this;
  }

  private matches(row: Record<string, unknown>): boolean {
    return this.filters.every((f) => {
      const cell = row[f.col];
      if (f.op === "eq") return cell === f.val;
      return (f.val as unknown[]).includes(cell);
    });
  }

  private idsFromFilters(): string[] {
    const f = this.filters.find((x) => x.op === "in");
    return f ? ((f.val as string[]) ?? []) : [];
  }

  private resolve(): { data?: unknown; error: unknown } {
    if (this.mode === "select") {
      this.selects.push({ table: this.table, range: this.rangeArgs });
      let rows = (
        this.live as unknown as Array<Record<string, unknown>>
      ).filter((r) => this.matches(r));
      if (this.rangeArgs) {
        const [from, to] = this.rangeArgs;
        rows = rows.slice(from, to + 1);
      }
      const cols = this.columns.split(",").map((c) => c.trim());
      return {
        data: rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]]))),
        error: null,
      };
    }
    if (this.mode === "insert") {
      const message =
        this.table === "items_meta"
          ? this.fail.metaInsert
          : this.fail.payloadInsert;
      if (message) return { error: { message } };
      this.writes.push({ op: "insert", table: this.table, rows: this.rows });
      return { error: null };
    }
    if (this.mode === "delete") {
      if (this.fail.metaDelete)
        return { error: { message: this.fail.metaDelete } };
      this.writes.push({
        op: "delete",
        table: this.table,
        ids: this.idsFromFilters(),
      });
      return { error: null };
    }
    if (this.fail.metaUpdate)
      return { error: { message: this.fail.metaUpdate } };
    this.writes.push({
      op: "update",
      table: this.table,
      patch: this.patch,
      ids: this.idsFromFilters(),
    });
    return { error: null };
  }

  then<TResult1 = { data?: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data?: unknown;
          error: unknown;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }
}

function makeClient(
  opts: { live?: LivePairRow[]; fail?: FailurePlan; authed?: boolean } = {},
) {
  const writes: WriteRecord[] = [];
  const selects: SelectRecord[] = [];
  // Default is_dismissed so a row is only "dismissed" when a case says so.
  // Without it, adding a stray `.eq("is_dismissed", false)` to the pre-check
  // would fail EVERY dedup case on undefined !== false, and the one case that
  // is actually about dismissal would stop being a distinguishable signal.
  const live = (opts.live ?? []).map((r) => ({
    is_dismissed: false,
    ...r,
  }));
  const fail = opts.fail ?? {};
  let authCalls = 0;
  const client = {
    auth: {
      getUser: async () => {
        authCalls += 1;
        return opts.authed === false
          ? { data: { user: null }, error: null }
          : { data: { user: { id: USER_ID } }, error: null };
      },
    },
    from: (table: string) => new Builder(table, live, writes, fail, selects),
  } as unknown as SupabaseClient;
  return { client, writes, selects, authCalls: () => authCalls };
}

function item(
  id: string,
  over: Partial<{
    date: string;
    title: string;
    startTime: string;
    endTime: string;
    routineId: string;
  }> = {},
) {
  return {
    id,
    date: "2026-08-20",
    title: "Gym",
    startTime: "19:00",
    endTime: "20:30",
    ...over,
  };
}

function inserted(
  writes: WriteRecord[],
  table: string,
): Array<Record<string, unknown>> {
  return writes.flatMap((w) =>
    w.op === "insert" && w.table === table ? w.rows : [],
  );
}

function ids(rows: Array<Record<string, unknown>>, key: string): string[] {
  return rows.map((r) => r[key] as string);
}

const ROUTINE = "routine-1";

describe("bulkCreateScheduleItems — 2-row INSERT + Issue 011 idempotency", () => {
  it("is a no-op for an empty batch (no auth round-trip, no writes)", async () => {
    const { client, writes, authCalls } = makeClient();
    const svc = new SupabaseScheduleItemsService(client);

    await svc.bulkCreateScheduleItems([]);

    expect(writes).toHaveLength(0);
    expect(authCalls()).toBe(0);
  });

  it("writes items_meta BEFORE events_payload (parent-first — payload.item_id FKs the meta)", async () => {
    const { client, writes } = makeClient();
    const svc = new SupabaseScheduleItemsService(client);

    await svc.bulkCreateScheduleItems([item("si-1")]);

    expect(writes.map((w) => `${w.op}:${w.table}`)).toEqual([
      "insert:items_meta",
      "insert:events_payload",
    ]);
    const meta = inserted(writes, "items_meta")[0];
    expect(meta).toMatchObject({
      id: "si-1",
      user_id: USER_ID,
      role: "event",
      title: "Gym",
      is_deleted: false,
    });
    const payload = inserted(writes, "events_payload")[0];
    expect(payload).toMatchObject({
      item_id: "si-1",
      user_id: USER_ID,
      start_at: "2026-08-20",
      start_time: "19:00",
      end_time: "20:30",
      done: false,
    });
  });

  it("stamps source_date from start_at for routine rows and leaves it null for manual ones", async () => {
    const { client, writes } = makeClient();
    const svc = new SupabaseScheduleItemsService(client);

    await svc.bulkCreateScheduleItems([
      item("si-manual"),
      item("si-routine", { routineId: ROUTINE }),
    ]);

    const payloads = inserted(writes, "events_payload");
    expect(payloads).toEqual([
      expect.objectContaining({
        item_id: "si-manual",
        routine_item_id: null,
        source_date: null,
      }),
      expect.objectContaining({
        item_id: "si-routine",
        routine_item_id: ROUTINE,
        source_date: "2026-08-20",
      }),
    ]);
  });

  it("drops routine rows whose (routine_item_id, source_date) is already live (silent idempotent skip)", async () => {
    const { client, writes } = makeClient({
      live: [
        {
          routine_item_id: ROUTINE,
          source_date: "2026-08-20",
          is_deleted_cache: false,
        },
      ],
    });
    const svc = new SupabaseScheduleItemsService(client);

    await svc.bulkCreateScheduleItems([
      item("si-dupe", { routineId: ROUTINE }),
      item("si-fresh", { routineId: ROUTINE, date: "2026-08-21" }),
    ]);

    expect(ids(inserted(writes, "items_meta"), "id")).toEqual(["si-fresh"]);
    expect(ids(inserted(writes, "events_payload"), "item_id")).toEqual([
      "si-fresh",
    ]);
  });

  /*
   * #933 — the pre-check used to compare the batch against the DB only, so
   * two rows inside ONE batch claiming the same (routine, date) sailed
   * through to the INSERT. That INSERT is a single statement: 23505 rolls
   * back every payload row, and the R2 cleanup then hard-deletes the metas
   * for the whole batch. A 30-day fill with one duplicate produced zero
   * events, and the retry was whenever the effect happened to fire again.
   */
  it("keeps the first of two rows in the SAME batch claiming one (routine, date)", async () => {
    const { client, writes } = makeClient();
    const svc = new SupabaseScheduleItemsService(client);

    await svc.bulkCreateScheduleItems([
      item("si-first", { routineId: ROUTINE }),
      item("si-dupe", { routineId: ROUTINE }),
      item("si-other", { routineId: ROUTINE, date: "2026-08-21" }),
    ]);

    expect(ids(inserted(writes, "items_meta"), "id")).toEqual([
      "si-first",
      "si-other",
    ]);
    expect(ids(inserted(writes, "events_payload"), "item_id")).toEqual([
      "si-first",
      "si-other",
    ]);
  });

  it("still writes the rest of the batch when a duplicate is dropped from it", async () => {
    // The regression this Issue is really about: nothing is annihilated.
    const { client, writes } = makeClient();
    const svc = new SupabaseScheduleItemsService(client);
    const days = Array.from({ length: 30 }, (_, i) =>
      item(`si-${i}`, {
        routineId: ROUTINE,
        date: `2026-08-${String(i + 1).padStart(2, "0")}`,
      }),
    );

    await svc.bulkCreateScheduleItems([
      ...days,
      // Same routine, same day as days[0] — the poison row.
      item("si-dupe", { routineId: ROUTINE, date: "2026-08-01" }),
    ]);

    expect(inserted(writes, "items_meta")).toHaveLength(30);
    expect(ids(inserted(writes, "items_meta"), "id")).not.toContain("si-dupe");
  });

  it("does not fold distinct manual events together (they all share the null pair)", async () => {
    // routinePairKey spells a manual row "null|null", so a dedupe that
    // forgot to exempt them would collapse every hand-made event on the
    // batch into one.
    const { client, writes } = makeClient();
    const svc = new SupabaseScheduleItemsService(client);

    await svc.bulkCreateScheduleItems([
      item("si-a"),
      item("si-b"),
      item("si-c"),
    ]);

    expect(ids(inserted(writes, "items_meta"), "id")).toEqual([
      "si-a",
      "si-b",
      "si-c",
    ]);
  });

  it("ignores a soft-deleted pair when deduping (the partial UNIQUE only covers live rows)", async () => {
    const { client, writes } = makeClient({
      live: [
        {
          routine_item_id: ROUTINE,
          source_date: "2026-08-20",
          is_deleted_cache: true,
        },
      ],
    });
    const svc = new SupabaseScheduleItemsService(client);

    await svc.bulkCreateScheduleItems([item("si-1", { routineId: ROUTINE })]);

    expect(ids(inserted(writes, "items_meta"), "id")).toEqual(["si-1"]);
  });

  it("keeps deduping a DISMISSED live pair — a skipped day must not be re-generated", async () => {
    // The pre-check filters on is_deleted_cache ALONE. Adding
    // `.eq("is_dismissed", false)` would read as a tightening but is exactly
    // what would resurrect every day the user skipped: a dismissed
    // occurrence still occupies its (routine, date) pair.
    const { client, writes } = makeClient({
      live: [
        {
          routine_item_id: ROUTINE,
          source_date: "2026-08-20",
          is_deleted_cache: false,
          is_dismissed: true,
        },
      ],
    });
    const svc = new SupabaseScheduleItemsService(client);

    await svc.bulkCreateScheduleItems([item("si-1", { routineId: ROUTINE })]);

    expect(writes).toHaveLength(0);
  });

  it("never deduplicates manual events, even on a date a routine already owns", async () => {
    const { client, writes } = makeClient({
      live: [
        {
          routine_item_id: ROUTINE,
          source_date: "2026-08-20",
          is_deleted_cache: false,
        },
      ],
    });
    const svc = new SupabaseScheduleItemsService(client);

    await svc.bulkCreateScheduleItems([
      item("si-a"),
      item("si-b"),
      item("si-routine", { routineId: ROUTINE, date: "2026-08-21" }),
    ]);

    // The routine row is present so the pre-check actually runs — without it
    // the helper early-returns and this case would pass even if the
    // `routine_item_id === null` short-circuit were deleted.
    expect(ids(inserted(writes, "items_meta"), "id")).toEqual([
      "si-a",
      "si-b",
      "si-routine",
    ]);
  });

  it("issues no pre-check query at all for a manual-only batch", async () => {
    const { client, selects } = makeClient();
    const svc = new SupabaseScheduleItemsService(client);

    await svc.bulkCreateScheduleItems([item("si-a"), item("si-b")]);

    expect(selects).toHaveLength(0);
  });

  it("pages the pre-check instead of reading one capped page", async () => {
    // The .in().in() filter is a cross-product: the result scales with the
    // EXISTING live rows, not the insert batch, so a single un-ranged read
    // would silently stop at the server's max-rows cap and let already-live
    // pairs through to the INSERT — turning the whole batch into a 23505.
    const dates = Array.from({ length: POSTGREST_PAGE_SIZE + 1 }, (_, i) =>
      String(i).padStart(5, "0"),
    );
    const live: LivePairRow[] = dates.map((d) => ({
      routine_item_id: ROUTINE,
      source_date: d,
      is_deleted_cache: false,
    }));
    const { client, writes, selects } = makeClient({ live });
    const svc = new SupabaseScheduleItemsService(client);

    await svc.bulkCreateScheduleItems([
      ...dates.map((d, i) =>
        item(`si-dupe-${i}`, { routineId: ROUTINE, date: d }),
      ),
      item("si-fresh", { routineId: ROUTINE, date: "fresh" }),
    ]);

    expect(selects.map((s) => s.range)).toEqual([
      [0, POSTGREST_PAGE_SIZE - 1],
      [POSTGREST_PAGE_SIZE, POSTGREST_PAGE_SIZE * 2 - 1],
    ]);
    // The pair on page 2 is the proof: a capped read would not have seen it,
    // so its duplicate would have slipped through to the INSERT.
    expect(ids(inserted(writes, "items_meta"), "id")).toEqual(["si-fresh"]);
  });

  it("writes nothing when the caller is not authenticated", async () => {
    const { client, writes } = makeClient({ authed: false });
    const svc = new SupabaseScheduleItemsService(client);

    await expect(svc.bulkCreateScheduleItems([item("si-1")])).rejects.toThrow(
      /not authenticated/,
    );
    expect(writes).toHaveLength(0);
  });

  it("writes nothing when every requested pair is already live", async () => {
    const { client, writes } = makeClient({
      live: [
        {
          routine_item_id: ROUTINE,
          source_date: "2026-08-20",
          is_deleted_cache: false,
        },
      ],
    });
    const svc = new SupabaseScheduleItemsService(client);

    await svc.bulkCreateScheduleItems([
      item("si-dupe", { routineId: ROUTINE }),
    ]);

    expect(writes).toHaveLength(0);
  });

  it("runs R2 cleanup on the metas it just wrote when the payload INSERT fails, and rethrows the original error", async () => {
    const { client, writes } = makeClient({
      live: [
        {
          routine_item_id: ROUTINE,
          source_date: "2026-08-20",
          is_deleted_cache: false,
        },
      ],
      fail: { payloadInsert: "duplicate key value violates unique constraint" },
    });
    const svc = new SupabaseScheduleItemsService(client);

    await expect(
      svc.bulkCreateScheduleItems([
        item("si-dupe", { routineId: ROUTINE }),
        item("si-fresh", { routineId: ROUTINE, date: "2026-08-21" }),
      ]),
    ).rejects.toThrow(/bulkCreateScheduleItems events_payload/);

    // Only the row that actually reached the INSERT is cleaned up — the
    // pre-check dropped si-dupe, whose live meta must survive.
    expect(writes.filter((w) => w.op === "delete")).toEqual([
      { op: "delete", table: "items_meta", ids: ["si-fresh"] },
    ]);
  });

  it("does not let an R2 cleanup failure mask the original INSERT error", async () => {
    const { client } = makeClient({
      fail: {
        payloadInsert: "payload exploded",
        metaDelete: "cleanup exploded",
      },
    });
    const svc = new SupabaseScheduleItemsService(client);

    await expect(svc.bulkCreateScheduleItems([item("si-1")])).rejects.toThrow(
      /payload exploded/,
    );
  });

  it("throws without touching events_payload when the items_meta INSERT fails", async () => {
    const { client, writes } = makeClient({
      fail: { metaInsert: "meta exploded" },
    });
    const svc = new SupabaseScheduleItemsService(client);

    await expect(svc.bulkCreateScheduleItems([item("si-1")])).rejects.toThrow(
      /bulkCreateScheduleItems items_meta: meta exploded/,
    );
    // No payload INSERT and no cleanup: nothing was written to roll back.
    expect(writes).toHaveLength(0);
  });
});

describe("bulkDeleteScheduleItems — hard delete via the parent only", () => {
  it("returns 0 and writes nothing for an empty id list", async () => {
    const { client, writes } = makeClient();
    const svc = new SupabaseScheduleItemsService(client);

    expect(await svc.bulkDeleteScheduleItems([])).toBe(0);
    expect(writes).toHaveLength(0);
  });

  it("deletes items_meta only — events_payload rides the ON DELETE CASCADE", async () => {
    const { client, writes } = makeClient();
    const svc = new SupabaseScheduleItemsService(client);

    const count = await svc.bulkDeleteScheduleItems(["si-1", "si-2"]);

    expect(count).toBe(2);
    expect(writes).toEqual([
      { op: "delete", table: "items_meta", ids: ["si-1", "si-2"] },
    ]);
  });

  it("chunks the id list so the DELETE query string stays under the URL cap", async () => {
    const { client, writes } = makeClient();
    const svc = new SupabaseScheduleItemsService(client);
    const many = Array.from(
      { length: POSTGREST_IN_CHUNK_SIZE + 50 },
      (_, i) => `si-${i}`,
    );

    const count = await svc.bulkDeleteScheduleItems(many);

    expect(count).toBe(many.length);
    expect(writes.map((w) => (w.op === "delete" ? w.ids.length : -1))).toEqual([
      POSTGREST_IN_CHUNK_SIZE,
      50,
    ]);
  });

  it("propagates a failing chunk instead of reporting a count", async () => {
    const { client } = makeClient({ fail: { metaDelete: "delete exploded" } });
    const svc = new SupabaseScheduleItemsService(client);

    await expect(svc.bulkDeleteScheduleItems(["si-1"])).rejects.toThrow(
      /bulkDeleteScheduleItems: delete exploded/,
    );
  });
});

describe("bulkSoftDeleteScheduleItems / bulkRestoreScheduleItems — Trash round trip", () => {
  it("both return 0 and write nothing for an empty id list", async () => {
    const { client, writes } = makeClient();
    const svc = new SupabaseScheduleItemsService(client);

    expect(await svc.bulkSoftDeleteScheduleItems([])).toBe(0);
    expect(await svc.bulkRestoreScheduleItems([])).toBe(0);
    expect(writes).toHaveLength(0);
  });

  it("soft-delete sets the flag + timestamps on items_meta only (the 0008 trigger mirrors the cache)", async () => {
    const { client, writes } = makeClient();
    const svc = new SupabaseScheduleItemsService(client);

    const count = await svc.bulkSoftDeleteScheduleItems(["si-1", "si-2"]);

    expect(count).toBe(2);
    expect(writes).toHaveLength(1);
    const write = writes[0];
    expect(write.op).toBe("update");
    if (write.op !== "update") throw new Error("unreachable");
    expect(write.table).toBe("items_meta");
    expect(write.ids).toEqual(["si-1", "si-2"]);
    expect(write.patch.is_deleted).toBe(true);
    // DB-Q2: the LWW cursor advances on every write, and deleted_at shares
    // the same instant so Trash ordering matches the sync cursor.
    expect(write.patch.deleted_at).toBe(write.patch.updated_at);
    expect(typeof write.patch.updated_at).toBe("string");
  });

  it("restore clears the flag and deleted_at while still bumping updated_at", async () => {
    const { client, writes } = makeClient();
    const svc = new SupabaseScheduleItemsService(client);

    const count = await svc.bulkRestoreScheduleItems(["si-1"]);

    expect(count).toBe(1);
    expect(writes).toHaveLength(1);
    const write = writes[0];
    if (write.op !== "update") throw new Error("expected an update");
    expect(write.table).toBe("items_meta");
    expect(write.patch).toMatchObject({ is_deleted: false, deleted_at: null });
    expect(typeof write.patch.updated_at).toBe("string");
  });

  it("chunks both directions on the same id-count boundary", async () => {
    const many = Array.from(
      { length: POSTGREST_IN_CHUNK_SIZE + 1 },
      (_, i) => `si-${i}`,
    );

    const soft = makeClient();
    await new SupabaseScheduleItemsService(
      soft.client,
    ).bulkSoftDeleteScheduleItems(many);
    expect(
      soft.writes.map((w) => (w.op === "update" ? w.ids.length : -1)),
    ).toEqual([POSTGREST_IN_CHUNK_SIZE, 1]);

    const restore = makeClient();
    await new SupabaseScheduleItemsService(
      restore.client,
    ).bulkRestoreScheduleItems(many);
    expect(
      restore.writes.map((w) => (w.op === "update" ? w.ids.length : -1)),
    ).toEqual([POSTGREST_IN_CHUNK_SIZE, 1]);
  });

  it("propagates a failing chunk instead of reporting a count", async () => {
    const { client } = makeClient({ fail: { metaUpdate: "update exploded" } });
    const svc = new SupabaseScheduleItemsService(client);

    await expect(svc.bulkSoftDeleteScheduleItems(["si-1"])).rejects.toThrow(
      /bulkSoftDeleteScheduleItems: update exploded/,
    );
    await expect(svc.bulkRestoreScheduleItems(["si-1"])).rejects.toThrow(
      /bulkRestoreScheduleItems: update exploded/,
    );
  });
});
