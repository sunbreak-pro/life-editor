// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchMetaFirstJoin,
  type MetaFirstJoinOptions,
} from "../src/services/itemsMetaJoin";
import { POSTGREST_PAGE_SIZE } from "../src/services/postgrestFetchAll";

/*
 * #674 / C7 — the shared items_meta + <role>_payload meta-first join, pulled
 * out of eight hand-written copies (Todos / Routines / Notes / Dailies × live
 * + Trash).
 *
 * These tests pin the parts the call sites relied on and that a reader cannot
 * see from the signature: that an empty meta result costs ZERO payload
 * round-trips, that the `id` tiebreaker is always ordered LAST (page
 * determinism), that orphan metas are skipped rather than thrown on, and that
 * each side's error label survives verbatim.
 */

interface RecordedCall {
  table: string;
  op: string;
  args: unknown[];
}

interface StagedResult {
  data: unknown;
  error: { message: string } | null;
}

/**
 * In-memory PostgREST builder stub. Every chain method records its call and
 * returns the builder; awaiting it consumes the next staged `<table>.<op>`
 * result. Mirrors the stub in SupabaseDailiesUnifiedService.test.ts.
 */
function makeStub() {
  const calls: RecordedCall[] = [];
  const staged = new Map<string, StagedResult[]>();

  function stage(table: string, op: string, result: StagedResult): void {
    const key = `${table}.${op}`;
    const list = staged.get(key);
    if (list) list.push(result);
    else staged.set(key, [result]);
  }

  function consume(table: string, op: string): StagedResult {
    const list = staged.get(`${table}.${op}`);
    if (!list || list.length === 0)
      throw new Error(`Stub: no staged result for ${table}.${op}`);
    return list.shift()!;
  }

  function builderFor(table: string, op: string): unknown {
    const builder: Record<string, unknown> = {};
    for (const method of ["eq", "in", "order", "range"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ table, op: method, args });
        return builder;
      };
    }
    builder.then = (resolve: (v: StagedResult) => unknown) =>
      Promise.resolve(consume(table, op)).then(resolve);
    return builder;
  }

  const client = {
    from(table: string) {
      return {
        select(cols: string) {
          calls.push({ table, op: "select", args: [cols] });
          return builderFor(table, "select");
        },
      };
    },
  } as unknown as SupabaseClient;

  return { client, calls, stage };
}

interface MetaRow {
  id: string;
  title: string;
}
interface PayloadRow {
  item_id: string;
  kind: string;
}

function meta(id: string): MetaRow {
  return { id, title: `title-${id}` };
}
function payload(id: string, kind = "plain"): PayloadRow {
  return { item_id: id, kind };
}

type Options = MetaFirstJoinOptions<MetaRow, PayloadRow, string>;

function run(
  client: SupabaseClient,
  overrides: Partial<Options> = {},
): Promise<string[]> {
  return fetchMetaFirstJoin<MetaRow, PayloadRow, string>({
    client,
    role: "note",
    isDeleted: false,
    metaColumns: "id, title",
    metaLabel: "listThings meta failed",
    payloadTable: "notes_payload",
    payloadColumns: "item_id, kind",
    payloadLabel: "listThings payload failed",
    toDomain: (m, p) => `${m.id}:${p.kind}`,
    ...overrides,
  });
}

describe("fetchMetaFirstJoin", () => {
  let stub: ReturnType<typeof makeStub>;

  beforeEach(() => {
    stub = makeStub();
  });

  it("joins meta and payload rows through toDomain, in meta order", async () => {
    stub.stage("items_meta", "select", {
      data: [meta("n2"), meta("n1")],
      error: null,
    });
    stub.stage("notes_payload", "select", {
      data: [payload("n1", "a"), payload("n2", "b")],
      error: null,
    });

    // Result order follows the META rows (the payload rows arrive in whatever
    // order the DB delivers them) — the ordering the list UIs depend on.
    await expect(run(stub.client)).resolves.toEqual(["n2:b", "n1:a"]);
  });

  it("returns [] without a payload round-trip when no meta matches", async () => {
    stub.stage("items_meta", "select", { data: [], error: null });

    await expect(run(stub.client)).resolves.toEqual([]);
    expect(stub.calls.some((c) => c.table === "notes_payload")).toBe(false);
  });

  it("filters items_meta by role and the is_deleted bucket", async () => {
    stub.stage("items_meta", "select", { data: [], error: null });
    await run(stub.client, { role: "daily", isDeleted: true });

    const eqs = stub.calls
      .filter((c) => c.table === "items_meta" && c.op === "eq")
      .map((c) => c.args);
    expect(eqs).toEqual([
      ["role", "daily"],
      ["is_deleted", true],
    ]);
  });

  it("orders by id only when no extra ordering is asked for", async () => {
    stub.stage("items_meta", "select", { data: [], error: null });
    await run(stub.client);

    const orders = stub.calls
      .filter((c) => c.table === "items_meta" && c.op === "order")
      .map((c) => c.args[0]);
    expect(orders).toEqual(["id"]);
  });

  it("applies extra ordering BEFORE the id tiebreaker (Trash: deleted_at DESC)", async () => {
    stub.stage("items_meta", "select", { data: [], error: null });
    await run(stub.client, {
      isDeleted: true,
      metaOrderBy: [{ column: "deleted_at", ascending: false }],
    });

    const orders = stub.calls.filter(
      (c) => c.table === "items_meta" && c.op === "order",
    );
    // The unique tiebreaker MUST come last or the pages can overlap/skip.
    expect(orders.map((c) => c.args[0])).toEqual(["deleted_at", "id"]);
    expect(orders[0]?.args[1]).toEqual({ ascending: false });
  });

  it("skips an orphan meta whose payload row is missing (R2 tolerance)", async () => {
    stub.stage("items_meta", "select", {
      data: [meta("n1"), meta("orphan"), meta("n2")],
      error: null,
    });
    stub.stage("notes_payload", "select", {
      data: [payload("n1", "a"), payload("n2", "b")],
      error: null,
    });

    await expect(run(stub.client)).resolves.toEqual(["n1:a", "n2:b"]);
  });

  it("drops rows rejected by `keep`, after the orphan skip", async () => {
    stub.stage("items_meta", "select", {
      data: [meta("n1"), meta("n2")],
      error: null,
    });
    stub.stage("notes_payload", "select", {
      data: [payload("n1", "folder"), payload("n2", "plain")],
      error: null,
    });

    // Stand-in for isLegacyFolderRow / isLegacyNoteFolderRow (#225 / #375).
    await expect(
      run(stub.client, { keep: (p) => p.kind !== "folder" }),
    ).resolves.toEqual(["n2:plain"]);
  });

  it("passes both rows to `keep` so a predicate can consult the meta side", async () => {
    stub.stage("items_meta", "select", { data: [meta("n1")], error: null });
    stub.stage("notes_payload", "select", {
      data: [payload("n1", "a")],
      error: null,
    });

    const seen: unknown[] = [];
    await run(stub.client, {
      keep: (p, m) => {
        seen.push([p, m]);
        return true;
      },
    });
    expect(seen).toEqual([[payload("n1", "a"), meta("n1")]]);
  });

  it("throws with the meta label when the items_meta page fails", async () => {
    stub.stage("items_meta", "select", {
      data: null,
      error: { message: "pg-meta" },
    });

    await expect(run(stub.client)).rejects.toThrow(
      "listThings meta failed: pg-meta",
    );
  });

  it("throws with the payload label when the payload chunk fails", async () => {
    stub.stage("items_meta", "select", { data: [meta("n1")], error: null });
    stub.stage("notes_payload", "select", {
      data: null,
      error: { message: "pg-pay" },
    });

    await expect(run(stub.client)).rejects.toThrow(
      "listThings payload failed: pg-pay",
    );
  });

  it("keeps paging items_meta while a full page comes back", async () => {
    // A full page means "there may be more" — the read must not stop there,
    // which is the silent-truncation trap postgrestFetchAll exists to avoid.
    const firstPage = Array.from({ length: POSTGREST_PAGE_SIZE }, (_, i) =>
      meta(`n${i}`),
    );
    stub.stage("items_meta", "select", { data: firstPage, error: null });
    stub.stage("items_meta", "select", { data: [meta("last")], error: null });
    // The 1001 ids are fetched in POSTGREST_IN_CHUNK_SIZE slices; only the
    // final slice holds "last".
    const chunks = Math.ceil((POSTGREST_PAGE_SIZE + 1) / 200);
    for (let i = 0; i < chunks - 1; i++) {
      stub.stage("notes_payload", "select", { data: [], error: null });
    }
    stub.stage("notes_payload", "select", {
      data: [payload("last", "z")],
      error: null,
    });

    await expect(run(stub.client)).resolves.toContain("last:z");
    const ranges = stub.calls
      .filter((c) => c.table === "items_meta" && c.op === "range")
      .map((c) => c.args);
    expect(ranges).toEqual([
      [0, POSTGREST_PAGE_SIZE - 1],
      [POSTGREST_PAGE_SIZE, POSTGREST_PAGE_SIZE * 2 - 1],
    ]);
  });

  it("looks payload rows up by item_id with an in() on the meta ids", async () => {
    stub.stage("items_meta", "select", {
      data: [meta("n1"), meta("n2")],
      error: null,
    });
    stub.stage("notes_payload", "select", { data: [], error: null });

    await run(stub.client);
    const inCall = stub.calls.find(
      (c) => c.table === "notes_payload" && c.op === "in",
    );
    expect(inCall?.args).toEqual(["item_id", ["n1", "n2"]]);
  });
});
