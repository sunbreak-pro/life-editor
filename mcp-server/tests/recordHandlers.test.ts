// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AppRecordBucket,
  AppRecordGroupBy,
  AppRecordPoint,
} from "../src/utils/appRecordAggregation.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseStub,
  createWritableStub,
  type StubRow,
  type StubTables,
  type SupabaseStub,
} from "./supabaseStub.js";

/*
 * The record tools against the real handlers (#2163, plan 2026-10-08-extension-
 * app-records-and-apps-section.md Step 4).
 *
 * They run on `createWritableStub`, which applies writes — a create called
 * twice cannot be checked against the recorder stub, because the second call
 * would never see the first. The stub also refuses a repeated
 * (user, source_app, external_id) the way 0039's partial unique index does.
 */

let tables: StubTables;
let stub: SupabaseStub;

function freshDatabase(rows: Partial<StubTables> = {}): void {
  tables = { app_records: [], extension_apps: [], ...rows };
  stub = createWritableStub(tables, {
    unique: [
      {
        table: "app_records",
        columns: ["user_id", "source_app", "external_id"],
        where: (row) => row.external_id != null,
      },
    ],
  });
}
freshDatabase();

vi.mock("../src/supabase.js", () => ({
  getSupabase: async () => stub,
}));

const { remoteRegistry } = await import("../src/remoteTools.js");
const { runAs } = await import("../src/callerContext.js");
const { codeOf } = await import("../src/errorCodes.js");
const { rejection } = await import("./rejection.js");

async function call<T = Record<string, unknown>>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { content } = await remoteRegistry.call(name, args);
  return JSON.parse(content[0].text) as T;
}

const failure = (name: string, args: Record<string, unknown>) =>
  rejection(remoteRegistry.call(name, args));

const rows = (): StubRow[] => tables.app_records;

const COFFEE = {
  kind: "expense",
  value: 450,
  unit: "JPY",
  occurred_at: "2026-10-11T12:10:00+09:00",
  dims: { category: "food", shop: "cafe" },
  note: "latte",
};

beforeEach(() => freshDatabase());

describe("the tools are on the remote set", () => {
  it("publishes the four record tools", () => {
    const names = remoteRegistry.tools.map((t) => t.name);
    for (const name of [
      "create_record",
      "list_records",
      "delete_record",
      "list_extension_apps",
    ]) {
      expect(names).toContain(name);
    }
  });
});

describe("create_record", () => {
  it("writes one row as 'claude' by default and returns its id", async () => {
    const result = await call<{ id: string; created: boolean }>(
      "create_record",
      COFFEE,
    );

    expect(result.created).toBe(true);
    expect(result.id).toMatch(/^record-/);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatchObject({
      id: result.id,
      user_id: "user-under-test",
      source_app: "claude",
      external_id: null,
      kind: "expense",
      value: 450,
      unit: "JPY",
      dims: { category: "food", shop: "cafe" },
      note: "latte",
      occurred_at: "2026-10-11T03:10:00.000Z",
    });
  });

  it("fills occurred_at with now and dims with {} when they are left out", async () => {
    const before = Date.now();
    await call("create_record", { kind: "weight", value: 61.5, unit: "kg" });
    const [row] = rows();

    expect(Date.parse(row.occurred_at as string)).toBeGreaterThanOrEqual(
      before,
    );
    expect(row.dims).toEqual({});
    expect(row.note).toBeNull();
  });

  it("takes source_app from the arguments outside the gateway", async () => {
    await call("create_record", { ...COFFEE, source_app: "kakeibo" });
    expect(rows()[0].source_app).toBe("kakeibo");
  });

  describe("with an external_id", () => {
    it("returns the same id the second time and leaves one row", async () => {
      const args = { ...COFFEE, external_id: "ext-1" };
      const first = await call<{ id: string; created: boolean }>(
        "create_record",
        args,
      );
      const second = await call<{ id: string; created: boolean }>(
        "create_record",
        args,
      );

      expect(second).toEqual({ id: first.id, created: false });
      expect(rows()).toHaveLength(1);
      const inserts = stub.calls.filter(
        (c) => c.table === "app_records" && c.op === "insert" && c.executed,
      );
      expect(inserts).toHaveLength(1);
    });

    it("is still a replay when the retry leaves occurred_at out", async () => {
      const { occurred_at: _at, ...withoutTime } = COFFEE;
      const first = await call<{ id: string }>("create_record", {
        ...withoutTime,
        external_id: "ext-1",
      });
      const second = await call<{ id: string; created: boolean }>(
        "create_record",
        { ...withoutTime, external_id: "ext-1" },
      );
      expect(second).toEqual({ id: first.id, created: false });
      expect(rows()).toHaveLength(1);
    });

    it("treats a different key order in dims as the same content", async () => {
      await call("create_record", {
        ...COFFEE,
        dims: { category: "food", shop: "cafe" },
        external_id: "ext-1",
      });
      const again = await call<{ created: boolean }>("create_record", {
        ...COFFEE,
        dims: { shop: "cafe", category: "food" },
        external_id: "ext-1",
      });
      expect(again.created).toBe(false);
    });

    it.each([
      ["value", { value: 460 }],
      ["kind", { kind: "income" }],
      ["unit", { unit: "USD" }],
      ["note", { note: "mocha" }],
      ["dims", { dims: { category: "drink" } }],
      ["occurred_at", { occurred_at: "2026-10-11T13:00:00+09:00" }],
    ])(
      "refuses the same key with a different %s as idempotency_key_reused",
      async (_field, change) => {
        await call("create_record", { ...COFFEE, external_id: "ext-1" });

        const error = await failure("create_record", {
          ...COFFEE,
          ...change,
          external_id: "ext-1",
        });

        expect(codeOf(error)).toBe("idempotency_key_reused");
        expect(rows()).toHaveLength(1);
        expect(rows()[0].value).toBe(450);
      },
    );

    it("keeps keys apart per source_app", async () => {
      await call("create_record", { ...COFFEE, external_id: "ext-1" });
      const other = await call<{ created: boolean }>("create_record", {
        ...COFFEE,
        value: 999,
        external_id: "ext-1",
        source_app: "kakeibo",
      });
      expect(other.created).toBe(true);
      expect(rows()).toHaveLength(2);
    });

    it("answers a lost insert race as a replay of the winner", async () => {
      // The first lookup misses (the twin has not landed yet), then the unique
      // index rejects the insert. The loser must come back with the winner's
      // id, not an error.
      const winner: StubRow = {
        id: "record-winner",
        source_app: "claude",
        external_id: "ext-1",
        kind: "expense",
        occurred_at: "2026-10-11T03:10:00.000Z",
        value: 450,
        unit: "JPY",
        dims: { category: "food", shop: "cafe" },
        note: "latte",
      };
      let lookups = 0;
      stub = createSupabaseStub(
        (call) => {
          if (call.table !== "app_records") return null;
          lookups += 1;
          return lookups === 1 ? null : winner;
        },
        undefined,
        (call) =>
          call.op === "insert"
            ? { code: "23505", message: "duplicate key value" }
            : undefined,
      );

      const result = await call<{ id: string; created: boolean }>(
        "create_record",
        { ...COFFEE, external_id: "ext-1" },
      );
      expect(result).toEqual({ id: "record-winner", created: false });
      expect(lookups).toBe(2);
    });
  });

  describe("dims", () => {
    const dimsFailure = (dims: unknown) =>
      failure("create_record", { ...COFFEE, dims });

    it("accepts strings, numbers and booleans", async () => {
      await call("create_record", {
        ...COFFEE,
        dims: { a: "x", b_2: 3, c: true, d: 0.5 },
      });
      expect(rows()[0].dims).toEqual({ a: "x", b_2: 3, c: true, d: 0.5 });
    });

    it("accepts exactly 20 keys and refuses 21", async () => {
      const keys = (n: number) =>
        Object.fromEntries(
          Array.from({ length: n }, (_, i) => [`k${i}`, i] as const),
        );
      await call("create_record", { ...COFFEE, dims: keys(20) });
      const error = await dimsFailure(keys(21));
      expect(codeOf(error)).toBe("invalid_arguments");
      expect(error.message).toMatch(/at most 20/);
    });

    it.each([
      ["a nested object", { shop: { name: "cafe" } }],
      ["an array", { tags: ["a"] }],
      ["null", { shop: null }],
    ])("refuses %s as a value", async (_label, dims) => {
      // null is "not supplied" for a top-level property, but inside dims it is
      // a value the table cannot hold.
      const error = await dimsFailure(dims);
      expect(codeOf(error)).toBe("invalid_arguments");
      expect(rows()).toHaveLength(0);
    });

    it.each(["Shop", "1shop", "shop-name", "a".repeat(33), ""])(
      "refuses the key %j",
      async (key) => {
        const error = await dimsFailure({ [key]: "x" });
        expect(codeOf(error)).toBe("invalid_arguments");
      },
    );

    it("refuses dims that is not an object", async () => {
      expect(codeOf(await dimsFailure(["a"]))).toBe("invalid_arguments");
      expect(codeOf(await dimsFailure("a"))).toBe("invalid_arguments");
    });
  });

  describe("the other arguments", () => {
    it.each(["Expense", "1x", "a-b", "x".repeat(33), ""])(
      "refuses the kind %j",
      async (kind) => {
        const error = await failure("create_record", { ...COFFEE, kind });
        expect(codeOf(error)).toBe("invalid_arguments");
      },
    );

    it("refuses a value that is not a number", async () => {
      const error = await failure("create_record", {
        ...COFFEE,
        value: "450",
      });
      expect(codeOf(error)).toBe("invalid_arguments");
    });

    it.each([
      "yesterday",
      "2026-10-11",
      "2026-10-11T12:10:00",
      "2026-13-40T00:00:00Z",
    ])("refuses occurred_at %j", async (occurred_at) => {
      const error = await failure("create_record", { ...COFFEE, occurred_at });
      expect(codeOf(error)).toBe("invalid_arguments");
      expect(error.message).toContain("occurred_at");
    });

    it("refuses a malformed source_app and an over-long external_id", async () => {
      expect(
        codeOf(
          await failure("create_record", { ...COFFEE, source_app: "Bad App" }),
        ),
      ).toBe("invalid_arguments");
      expect(
        codeOf(
          await failure("create_record", {
            ...COFFEE,
            external_id: "x".repeat(201),
          }),
        ),
      ).toBe("invalid_arguments");
      expect(rows()).toHaveLength(0);
    });
  });

  describe("who is calling", () => {
    const APP = {
      app: "kakeibo",
      account: "owner",
      scopes: ["read", "write"],
    } as const;

    it("writes as the calling app", async () => {
      await runAs(APP, () => call("create_record", COFFEE));
      expect(rows()[0].source_app).toBe("kakeibo");
    });

    it("refuses a source_app that is not the caller's", async () => {
      const error = await runAs(APP, () =>
        failure("create_record", { ...COFFEE, source_app: "claude" }),
      );
      expect(codeOf(error)).toBe("forbidden");
      expect(rows()).toHaveLength(0);
    });
  });
});

describe("delete_record", () => {
  it("removes the row", async () => {
    const { id } = await call<{ id: string }>("create_record", COFFEE);
    const result = await call("delete_record", { id });

    expect(result).toEqual({ success: true, id });
    expect(rows()).toHaveLength(0);
  });

  it("fails with not_found for an id that is not there", async () => {
    const error = await failure("delete_record", { id: "record-nope" });
    expect(codeOf(error)).toBe("not_found");
  });

  it("frees the external_id again", async () => {
    const args = { ...COFFEE, external_id: "ext-1" };
    const first = await call<{ id: string }>("create_record", args);
    await call("delete_record", { id: first.id });
    const again = await call<{ id: string; created: boolean }>(
      "create_record",
      args,
    );
    expect(again.created).toBe(true);
    expect(again.id).not.toBe(first.id);
  });

  it("lets an app delete only its own rows", async () => {
    const mine = await call<{ id: string }>("create_record", {
      ...COFFEE,
      source_app: "kakeibo",
    });
    const owners = await call<{ id: string }>("create_record", COFFEE);
    const APP = {
      app: "kakeibo",
      account: "owner",
      scopes: ["read", "write"],
    } as const;

    const error = await runAs(APP, () =>
      failure("delete_record", { id: owners.id }),
    );
    expect(codeOf(error)).toBe("not_found");
    expect(rows()).toHaveLength(2);

    await runAs(APP, () => call("delete_record", { id: mine.id }));
    expect(rows().map((r) => r.id)).toEqual([owners.id]);
  });
});

describe("list_records", () => {
  const rec = (
    id: string,
    occurredAt: string,
    over: Partial<StubRow> = {},
  ): StubRow => ({
    id,
    user_id: "user-under-test",
    source_app: "claude",
    external_id: null,
    kind: "expense",
    occurred_at: occurredAt,
    value: 100,
    unit: "JPY",
    dims: {},
    note: null,
    ...over,
  });

  it("returns the created record in the shape the arguments had", async () => {
    const { id } = await call<{ id: string }>("create_record", {
      ...COFFEE,
      external_id: "ext-1",
    });
    const result = await call<{
      records: Record<string, unknown>[];
      hasMore: boolean;
    }>("list_records");

    expect(result.hasMore).toBe(false);
    expect(result.records).toEqual([
      {
        id,
        source_app: "claude",
        external_id: "ext-1",
        kind: "expense",
        occurred_at: "2026-10-11T03:10:00.000Z",
        value: 450,
        unit: "JPY",
        dims: { category: "food", shop: "cafe" },
        note: "latte",
      },
    ]);
  });

  it("lists newest first, and reports hasMore past the limit", async () => {
    freshDatabase({
      app_records: [
        rec("r1", "2026-10-01T00:00:00.000Z"),
        rec("r2", "2026-10-03T00:00:00.000Z"),
        rec("r3", "2026-10-02T00:00:00.000Z"),
      ],
    });
    const page = await call<{
      records: { id: string }[];
      hasMore: boolean;
    }>("list_records", { limit: 2 });
    expect(page.records.map((r) => r.id)).toEqual(["r2", "r3"]);
    expect(page.hasMore).toBe(true);

    const all = await call<{ records: { id: string }[]; hasMore: boolean }>(
      "list_records",
      { limit: 3 },
    );
    expect(all.records).toHaveLength(3);
    expect(all.hasMore).toBe(false);
  });

  it("filters by kind, source_app and a period", async () => {
    freshDatabase({
      app_records: [
        rec("a", "2026-10-05T03:00:00.000Z"),
        rec("b", "2026-10-06T03:00:00.000Z", { kind: "weight" }),
        rec("c", "2026-10-06T04:00:00.000Z", { source_app: "kakeibo" }),
        rec("d", "2026-10-08T03:00:00.000Z"),
      ],
    });
    const ids = async (args: Record<string, unknown>) =>
      (
        await call<{ records: { id: string }[] }>("list_records", args)
      ).records.map((r) => r.id);

    expect(await ids({ kind: "weight" })).toEqual(["b"]);
    expect(await ids({ source_app: "kakeibo" })).toEqual(["c"]);
    // `to` as a date includes that whole local day.
    expect(await ids({ from: "2026-10-06", to: "2026-10-06" })).toEqual([
      "c",
      "b",
    ]);
    expect(await ids({ from: "2026-10-06" })).toEqual(["d", "c", "b"]);
    // An instant `to` is exclusive.
    expect(
      await ids({
        from: "2026-10-05T03:00:00Z",
        to: "2026-10-06T03:00:00Z",
      }),
    ).toEqual(["a"]);
  });

  it("refuses a limit above the cap and a window that ends before it starts", async () => {
    expect(codeOf(await failure("list_records", { limit: 0 }))).toBe(
      "invalid_arguments",
    );
    expect(
      codeOf(
        await failure("list_records", { from: "2026-10-06", to: "2026-10-05" }),
      ),
    ).toBe("invalid_arguments");
  });

  describe("group_by — the shared sample data", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const fixture = JSON.parse(
      readFileSync(
        resolve(here, "../../shared/tests/fixtures/appRecordAggregation.json"),
        "utf8",
      ),
    ) as {
      aggregates: {
        name: string;
        groupBy: AppRecordGroupBy;
        points: AppRecordPoint[];
        expected: AppRecordBucket[];
      }[];
    };

    it("has cases for day, week and month", () => {
      const kinds = new Set(fixture.aggregates.map((c) => c.groupBy));
      expect([...kinds].sort()).toEqual(["day", "month", "week"]);
    });

    it.each(fixture.aggregates.map((c) => [c.name, c] as const))(
      "%s",
      async (_name, { groupBy, points, expected }) => {
        // Each point becomes a record at noon local time on its day, read back
        // through list_records the way a user would.
        freshDatabase({
          app_records: points.map((p, i) =>
            rec(
              `r${i}`,
              new Date(`${p.dateKey}T12:00:00+09:00`).toISOString(),
              {
                value: p.value,
              },
            ),
          ),
        });

        const result = await call<{
          group_by: string;
          buckets: AppRecordBucket[];
        }>("list_records", { group_by: groupBy });

        expect(result.group_by).toBe(groupBy);
        expect(result.buckets).toEqual(expected);
      },
    );
  });

  it("puts a 01:00 JST record on its own local day", async () => {
    freshDatabase({
      app_records: [
        // 2026-10-04T16:00Z is 01:00 JST on the 5th.
        rec("late", "2026-10-04T16:00:00.000Z", { value: 10 }),
      ],
    });
    const result = await call<{ buckets: AppRecordBucket[] }>("list_records", {
      group_by: "day",
    });
    expect(result.buckets.map((b) => b.period)).toEqual(["2026-10-05"]);
  });

  it("uses the Sunday-start week and the month key of the Goals", async () => {
    freshDatabase({
      app_records: [
        rec("mon", "2026-10-05T03:00:00.000Z", { value: 1 }),
        rec("sat", "2026-10-10T03:00:00.000Z", { value: 2 }),
        rec("nextsun", "2026-10-11T03:00:00.000Z", { value: 4 }),
      ],
    });
    const weeks = await call<{ buckets: AppRecordBucket[] }>("list_records", {
      group_by: "week",
    });
    expect(weeks.buckets).toEqual([
      { period: "2026-10-04", count: 2, sum: 3, avg: 1.5, min: 1, max: 2 },
      { period: "2026-10-11", count: 1, sum: 4, avg: 4, min: 4, max: 4 },
    ]);
    const months = await call<{ buckets: AppRecordBucket[] }>("list_records", {
      group_by: "month",
    });
    expect(months.buckets).toEqual([
      { period: "2026-10", count: 3, sum: 7, avg: 7 / 3, min: 1, max: 4 },
    ]);
  });

  it("asks for a kind when a grouped range holds several, and names them", async () => {
    freshDatabase({
      app_records: [
        rec("a", "2026-10-05T03:00:00.000Z"),
        rec("b", "2026-10-05T04:00:00.000Z", { kind: "weight" }),
      ],
    });
    const error = await failure("list_records", { group_by: "day" });
    expect(codeOf(error)).toBe("invalid_arguments");
    expect(error.message).toContain("expense, weight");

    const ok = await call<{ kind: string; buckets: AppRecordBucket[] }>(
      "list_records",
      { group_by: "day", kind: "weight" },
    );
    expect(ok.kind).toBe("weight");
    expect(ok.buckets).toHaveLength(1);
  });

  it("answers an empty period with no buckets", async () => {
    const result = await call<{ buckets: unknown[] }>("list_records", {
      group_by: "month",
    });
    expect(result.buckets).toEqual([]);
  });
});

describe("list_extension_apps", () => {
  it("returns no apps for an empty ledger", async () => {
    expect(await call("list_extension_apps")).toEqual({ apps: [] });
  });

  it("adds last_record_at and records_30d to each ledger row", async () => {
    const day = 24 * 60 * 60 * 1000;
    // One clock reading, so ago(1) means the same instant each time it is asked.
    const now = Date.now();
    const ago = (days: number) => new Date(now - days * day).toISOString();
    const app = (slug: string, sort: number): StubRow => ({
      slug,
      name: slug.toUpperCase(),
      url: `https://${slug}.example`,
      icon: null,
      description: null,
      sort_order: sort,
    });
    const rec = (id: string, source: string, at: string): StubRow => ({
      id,
      source_app: source,
      occurred_at: at,
      kind: "expense",
      value: 1,
    });
    freshDatabase({
      extension_apps: [app("sleepy", 1), app("kakeibo", 0), app("idle", 2)],
      app_records: [
        rec("k1", "kakeibo", ago(1)),
        rec("k2", "kakeibo", ago(10)),
        rec("k3", "kakeibo", ago(45)),
        rec("s1", "sleepy", ago(40)),
        // Claude's own records have no ledger row and do not appear.
        rec("c1", "claude", ago(1)),
      ],
    });

    const { apps } = await call<{
      apps: {
        slug: string;
        last_record_at: string | null;
        records_30d: number;
      }[];
    }>("list_extension_apps");

    expect(apps.map((a) => a.slug)).toEqual(["kakeibo", "sleepy", "idle"]);
    expect(apps[0]).toMatchObject({
      name: "KAKEIBO",
      url: "https://kakeibo.example",
      sort_order: 0,
      last_record_at: ago(1),
      records_30d: 2,
    });
    // Quiet for 40 days: it has a last record, but none in the window.
    expect(apps[1]).toMatchObject({
      last_record_at: ago(40),
      records_30d: 0,
    });
    // Registered and never used.
    expect(apps[2]).toMatchObject({ last_record_at: null, records_30d: 0 });
  });
});
