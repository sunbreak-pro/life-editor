import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseTodosService } from "../src/services/SupabaseTodosService";
import { SupabaseNotesUnifiedService } from "../src/services/SupabaseNotesUnifiedService";
import { SupabaseDailiesUnifiedService } from "../src/services/SupabaseDailiesUnifiedService";

/*
 * Badge COUNT reads (#511). These replace materialsCounts.test.ts: the badge
 * numbers used to be derived in app memory from full list fetches, so the rules
 * were testable as a pure function. They now live in the query, so the query
 * shape IS the rule and this suite pins it.
 *
 * What each assertion protects (the query is never executed here, so only the
 * shape can be checked — the numbers themselves were verified against prod
 * with the equivalent SQL, see the PR):
 *
 *   - `{ count: 'exact', head: true }` — the point of the whole change. Drop
 *     `head` and the badge silently goes back to downloading every row.
 *   - `!inner` on the payload embed — excludes payload-less meta rows, which
 *     is what the list reads do (`if (!payload) continue`). An outer join
 *     would over-count.
 *   - the `!<fk>` hint — tasks_payload / notes_payload reference items_meta
 *     twice, so PostgREST rejects an unhinted embed as ambiguous.
 *   - `.is.null` legs in every `or()` — a bare `neq` in PostgREST ALSO drops
 *     NULL rows. Without the null leg the badge would undercount every row
 *     whose task_type / note_type / status was never set. This is the single
 *     easiest way to reintroduce a wrong number, so it gets an explicit test.
 */

interface Recorded {
  table: string;
  cols: string;
  options: unknown;
  eq: Array<[string, unknown]>;
  or: Array<[string, unknown]>;
}

interface CountResult {
  count: number | null;
  error: { message: string } | null;
}

function makeStub(result: CountResult) {
  const rec: Recorded = {
    table: "",
    cols: "",
    options: undefined,
    eq: [],
    or: [],
  };
  const builder: Record<string, unknown> = {
    eq(col: string, val: unknown) {
      rec.eq.push([col, val]);
      return builder;
    },
    or(filter: string, opts: unknown) {
      rec.or.push([filter, opts]);
      return builder;
    },
    then(resolve: (v: CountResult) => unknown) {
      return Promise.resolve(result).then(resolve);
    },
  };
  const client = {
    from(table: string) {
      rec.table = table;
      return {
        select(cols: string, options: unknown) {
          rec.cols = cols;
          rec.options = options;
          return builder;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, rec };
}

const OK = (count: number | null): CountResult => ({ count, error: null });

describe("countUnfinishedTodos", () => {
  it("asks for a header-only exact count over the live task rows", async () => {
    const { client, rec } = makeStub(OK(3));
    const n = await new SupabaseTodosService(client).countUnfinishedTodos();

    expect(n).toBe(3);
    expect(rec.table).toBe("items_meta");
    expect(rec.options).toEqual({ count: "exact", head: true });
    expect(rec.cols).toContain(
      "tasks_payload!tasks_payload_item_id_fkey!inner(item_id)",
    );
    expect(rec.eq).toEqual([
      ["role", "task"],
      ["is_deleted", false],
    ]);
  });

  it("excludes DONE and legacy folders WITHOUT dropping null-valued rows", async () => {
    const { client, rec } = makeStub(OK(0));
    await new SupabaseTodosService(client).countUnfinishedTodos();

    expect(rec.or).toEqual([
      [
        "task_type.is.null,task_type.neq.folder",
        { referencedTable: "tasks_payload" },
      ],
      ["status.is.null,status.neq.DONE", { referencedTable: "tasks_payload" }],
    ]);
  });

  it("reads a missing count as zero rather than NaN", async () => {
    const { client } = makeStub(OK(null));
    await expect(
      new SupabaseTodosService(client).countUnfinishedTodos(),
    ).resolves.toBe(0);
  });

  it("throws on a query error so the caller can keep its last known count", async () => {
    const { client } = makeStub({ count: null, error: { message: "boom" } });
    await expect(
      new SupabaseTodosService(client).countUnfinishedTodos(),
    ).rejects.toThrow(/countUnfinishedTodos failed: boom/);
  });
});

describe("countLiveNotes", () => {
  it("counts live notes over an inner payload join, excluding legacy folders", async () => {
    const { client, rec } = makeStub(OK(7));
    const n = await new SupabaseNotesUnifiedService(client).countLiveNotes();

    expect(n).toBe(7);
    expect(rec.table).toBe("items_meta");
    expect(rec.options).toEqual({ count: "exact", head: true });
    expect(rec.cols).toContain(
      "notes_payload!notes_payload_item_id_fkey!inner(item_id)",
    );
    expect(rec.eq).toEqual([
      ["role", "note"],
      ["is_deleted", false],
    ]);
    expect(rec.or).toEqual([
      [
        "note_type.is.null,note_type.neq.folder",
        { referencedTable: "notes_payload" },
      ],
    ]);
  });

  it("throws on a query error", async () => {
    const { client } = makeStub({ count: null, error: { message: "boom" } });
    await expect(
      new SupabaseNotesUnifiedService(client).countLiveNotes(),
    ).rejects.toThrow(/countLiveNotes failed: boom/);
  });
});

describe("countLiveDailies", () => {
  it("counts live dailies with no folder clause (Daily is flat)", async () => {
    const { client, rec } = makeStub(OK(9));
    const n = await new SupabaseDailiesUnifiedService(
      client,
    ).countLiveDailies();

    expect(n).toBe(9);
    expect(rec.table).toBe("items_meta");
    expect(rec.options).toEqual({ count: "exact", head: true });
    expect(rec.cols).toContain(
      "dailies_payload!dailies_payload_item_id_fkey!inner(item_id)",
    );
    expect(rec.eq).toEqual([
      ["role", "daily"],
      ["is_deleted", false],
    ]);
    expect(rec.or).toEqual([]);
  });

  it("throws on a query error", async () => {
    const { client } = makeStub({ count: null, error: { message: "boom" } });
    await expect(
      new SupabaseDailiesUnifiedService(client).countLiveDailies(),
    ).rejects.toThrow(/countLiveDailies failed: boom/);
  });
});
