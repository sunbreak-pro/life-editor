// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseRoutinesService } from "../src/services/SupabaseDataService";
import { POSTGREST_IN_CHUNK_SIZE } from "../src/services/postgrestFetchAll";

/*
 * permanentDeleteRoutine — the physical purge, and the one delete in the
 * schedule domain whose ORDER the database actually enforces.
 *
 * The 0011 composite FK on events_payload (routine_item_id,
 * routine_item_role) is ON DELETE NO ACTION, so Postgres refuses to remove
 * the routine's items_meta row while any event still points at it. Events
 * first, routine second (db-conventions DB-Q3, descendants-first).
 *
 * What is NOT ordered is the events among themselves — they are siblings and
 * no event references another. The purge used to spend one request per
 * occurrence anyway, on the stated grounds of mirroring the Todos
 * descendants-first pattern, which made a 500-occurrence routine 500 round
 * trips (#934). #897's DoD called this delete order out as untested; these
 * cases are that missing cover.
 */

interface DeleteRecord {
  table: string;
  /** Ids named by `.in("id", …)`, or the single id from `.eq("id", …)`. */
  ids: string[];
}

interface Filter {
  op: "eq" | "in";
  col: string;
  val: unknown;
}

/** Which delete should fail, keyed by the first id it names. */
type FailurePlan = Record<string, string>;

class Builder implements PromiseLike<{ data?: unknown; error: unknown }> {
  private mode: "select" | "delete" | null = null;
  private filters: Filter[] = [];
  private rangeArgs: [number, number] | null = null;

  constructor(
    private readonly table: string,
    private readonly eventIds: string[],
    private readonly deletes: DeleteRecord[],
    private readonly fail: FailurePlan,
  ) {}

  select(): this {
    this.mode = "select";
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

  private targetIds(): string[] {
    const many = this.filters.find((f) => f.op === "in" && f.col === "id");
    if (many) return (many.val as string[]) ?? [];
    const one = this.filters.find((f) => f.op === "eq" && f.col === "id");
    return one ? [one.val as string] : [];
  }

  private resolve(): { data?: unknown; error: unknown } {
    if (this.mode === "select") {
      let rows = this.eventIds.map((id) => ({ item_id: id }));
      if (this.rangeArgs) {
        const [from, to] = this.rangeArgs;
        rows = rows.slice(from, to + 1);
      }
      return { data: rows, error: null };
    }
    const ids = this.targetIds();
    const message = this.fail[ids[0] ?? ""];
    if (message) return { error: { message } };
    this.deletes.push({ table: this.table, ids });
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

function makeClient(eventIds: string[], fail: FailurePlan = {}) {
  const deletes: DeleteRecord[] = [];
  const client = {
    from: (table: string) => new Builder(table, eventIds, deletes, fail),
  } as unknown as SupabaseClient;
  return { client, deletes };
}

const ROUTINE = "routine-1";

describe("permanentDeleteRoutine — delete order and round trips (#934)", () => {
  it("removes every occurrence before the routine, never the other way round", async () => {
    const { client, deletes } = makeClient(["si-1", "si-2", "si-3"]);
    const svc = new SupabaseRoutinesService(client);

    await svc.permanentDeleteRoutine(ROUTINE);

    // The composite FK is NO ACTION: the routine's row cannot go first, and
    // reversing these two steps is what the DB would reject.
    expect(deletes).toEqual([
      { table: "items_meta", ids: ["si-1", "si-2", "si-3"] },
      { table: "items_meta", ids: [ROUTINE] },
    ]);
  });

  it("folds the siblings into one request instead of one each", async () => {
    const { client, deletes } = makeClient(["si-1", "si-2", "si-3"]);
    const svc = new SupabaseRoutinesService(client);

    await svc.permanentDeleteRoutine(ROUTINE);

    // 3 occurrences used to mean 3 requests, 500 would mean 500.
    expect(deletes).toHaveLength(2);
  });

  it("chunks at the URL cap and still deletes the whole set", async () => {
    const eventIds = Array.from(
      { length: POSTGREST_IN_CHUNK_SIZE + 1 },
      (_, i) => `si-${i}`,
    );
    const { client, deletes } = makeClient(eventIds);
    const svc = new SupabaseRoutinesService(client);

    await svc.permanentDeleteRoutine(ROUTINE);

    expect(deletes.map((d) => d.ids.length)).toEqual([
      POSTGREST_IN_CHUNK_SIZE,
      1,
      1, // the routine itself
    ]);
    // Behaviour is unchanged where it counts: the same set disappears.
    expect(deletes.slice(0, 2).flatMap((d) => d.ids)).toEqual(eventIds);
    expect(deletes[2].ids).toEqual([ROUTINE]);
  });

  it("deletes the routine alone when it never generated anything", async () => {
    const { client, deletes } = makeClient([]);
    const svc = new SupabaseRoutinesService(client);

    await svc.permanentDeleteRoutine(ROUTINE);

    expect(deletes).toEqual([{ table: "items_meta", ids: [ROUTINE] }]);
  });

  it("leaves the routine in place when its occurrences could not be removed", async () => {
    // Purging the parent after a failed child delete is the one thing the FK
    // would reject anyway — the throw has to come first.
    const { client, deletes } = makeClient(["si-1"], {
      "si-1": "delete exploded",
    });
    const svc = new SupabaseRoutinesService(client);

    await expect(svc.permanentDeleteRoutine(ROUTINE)).rejects.toThrow(
      /permanentDeleteRoutine events: delete exploded/,
    );
    expect(deletes).toHaveLength(0);
  });
});
