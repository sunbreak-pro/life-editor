// @vitest-environment node (this suite touches no DOM)
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseAppRecordsService } from "../src/services/SupabaseAppRecordsService";
import {
  EXTENSION_APP_SLUG_PATTERN,
  ExtensionAppValidationError,
  extensionAppProblems,
  rowToAppRecord,
  type AppRecordRow,
} from "../src/services/appRecordMapper";

/*
 * SupabaseAppRecordsService (#2162) against a small in-memory PostgREST fake.
 * The tables come from 0039, which is merged but not yet pushed — so this
 * suite is the only place the reads and writes run before `supabase db push`.
 *
 * What the suite pins:
 *   - records are READ-ONLY: no method sends an insert / update / delete to
 *     app_records (plan — the screens only read; the MCP tools write, #2163);
 *   - a ledger update always sets the row's own updated_at (0039 — no
 *     items_meta row), and user_id is never sent (DB default auth.uid());
 *   - list reads filter by [from, to), source_app and kind, newest first;
 *   - the source summary counts per app without pulling every record;
 *   - a malformed slug / empty name / non-http URL is refused BEFORE any
 *     request, and a duplicate slug comes back as `taken`, not a raw 23505.
 */

type Row = Record<string, unknown>;
type Filter = { col: string; op: "eq" | "gt" | "gte" | "lt"; val: unknown };
type Order = { col: string; ascending: boolean };

interface Request {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  payload?: Row;
  head?: boolean;
  filters: Filter[];
}

const UID = "11111111-2222-3333-4444-555555555555";
const NOW = new Date("2026-10-11T03:00:00.000Z");

function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function makeFake(seed: Record<string, Row[]> = {}) {
  const db: Record<string, Row[]> = {
    app_records: [],
    extension_apps: [],
    ...seed,
  };
  const requests: Request[] = [];

  class Builder implements PromiseLike<{
    data: unknown;
    error: unknown;
    count?: number | null;
  }> {
    private op: Request["op"] = "select";
    private payload: Row = {};
    private head = false;
    private countExact = false;
    private filters: Filter[] = [];
    private orders: Order[] = [];
    private limitN: number | null = null;
    private rangeArgs: [number, number] | null = null;
    private singleMode: "one" | "maybe" | null = null;

    constructor(private readonly table: string) {}

    select(_cols?: string, opts?: { count?: string; head?: boolean }): this {
      if (opts?.count === "exact") this.countExact = true;
      if (opts?.head) this.head = true;
      return this;
    }
    insert(row: Row): this {
      this.op = "insert";
      this.payload = row;
      return this;
    }
    update(patch: Row): this {
      this.op = "update";
      this.payload = patch;
      return this;
    }
    delete(): this {
      this.op = "delete";
      return this;
    }
    eq(col: string, val: unknown): this {
      this.filters.push({ col, op: "eq", val });
      return this;
    }
    gt(col: string, val: unknown): this {
      this.filters.push({ col, op: "gt", val });
      return this;
    }
    gte(col: string, val: unknown): this {
      this.filters.push({ col, op: "gte", val });
      return this;
    }
    lt(col: string, val: unknown): this {
      this.filters.push({ col, op: "lt", val });
      return this;
    }
    order(col: string, opts?: { ascending?: boolean }): this {
      this.orders.push({ col, ascending: opts?.ascending ?? true });
      return this;
    }
    limit(n: number): this {
      this.limitN = n;
      return this;
    }
    range(from: number, to: number): this {
      this.rangeArgs = [from, to];
      return this;
    }
    maybeSingle(): this {
      this.singleMode = "maybe";
      return this;
    }
    single(): this {
      this.singleMode = "one";
      return this;
    }

    private matches(row: Row): boolean {
      return this.filters.every(({ col, op, val }) => {
        const c = compare(row[col], val);
        if (op === "eq") return row[col] === val;
        if (op === "gt") return c > 0;
        if (op === "gte") return c >= 0;
        return c < 0;
      });
    }

    private run(): { data: unknown; error: unknown; count?: number | null } {
      requests.push({
        table: this.table,
        op: this.op,
        payload: this.op === "select" ? undefined : { ...this.payload },
        head: this.head,
        filters: [...this.filters],
      });
      const rows = db[this.table];
      const stamp = new Date().toISOString();
      let out: Row[];

      if (this.op === "insert") {
        if (
          this.table === "extension_apps" &&
          rows.some((r) => r.slug === this.payload.slug)
        ) {
          return {
            data: null,
            error: { message: "duplicate key", code: "23505" },
          };
        }
        const row = {
          user_id: UID,
          created_at: stamp,
          updated_at: stamp,
          ...this.payload,
        };
        rows.push(row);
        out = [row];
      } else if (this.op === "update") {
        out = rows.filter((r) => this.matches(r));
        for (const r of out) Object.assign(r, this.payload);
      } else if (this.op === "delete") {
        out = rows.filter((r) => this.matches(r));
        db[this.table] = rows.filter((r) => !this.matches(r));
      } else {
        out = rows.filter((r) => this.matches(r));
        if (this.orders.length > 0) {
          out = [...out].sort((a, b) => {
            for (const { col, ascending } of this.orders) {
              const c = compare(a[col], b[col]);
              if (c !== 0) return ascending ? c : -c;
            }
            return 0;
          });
        }
      }

      const total = out.length;
      if (this.rangeArgs)
        out = out.slice(this.rangeArgs[0], this.rangeArgs[1] + 1);
      if (this.limitN !== null) out = out.slice(0, this.limitN);
      const count = this.countExact ? total : null;
      if (this.head) return { data: null, error: null, count };
      if (this.singleMode === "one") {
        return out.length === 1
          ? { data: { ...out[0] }, error: null }
          : {
              data: null,
              error: { message: `expected 1 row, got ${out.length}` },
            };
      }
      if (this.singleMode === "maybe") {
        return { data: out[0] ? { ...out[0] } : null, error: null };
      }
      return { data: out.map((r) => ({ ...r })), error: null, count };
    }

    then<TResult1, TResult2 = never>(
      onfulfilled?:
        | ((value: {
            data: unknown;
            error: unknown;
            count?: number | null;
          }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?:
        ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected);
    }
  }

  const client = {
    from: (table: string) => new Builder(table),
  } as unknown as SupabaseClient;
  return { client, db, requests };
}

function record(
  overrides: Partial<AppRecordRow> & { id: string },
): AppRecordRow {
  return {
    user_id: UID,
    source_app: "kakeibo",
    external_id: null,
    kind: "expense",
    occurred_at: "2026-10-10T01:00:00.000Z",
    value: 450,
    unit: "JPY",
    dims: {},
    note: null,
    created_at: "2026-10-10T01:00:01.000Z",
    updated_at: "2026-10-10T01:00:01.000Z",
    ...overrides,
  };
}

function appRow(slug: string, sortOrder: number): Row {
  return {
    slug,
    user_id: UID,
    name: slug,
    url: null,
    icon: null,
    description: null,
    sort_order: sortOrder,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("listAppRecords", () => {
  const seed = {
    app_records: [
      record({ id: "record-a", occurred_at: "2026-10-01T00:00:00.000Z" }),
      record({ id: "record-b", occurred_at: "2026-10-05T12:00:00.000Z" }),
      record({
        id: "record-c",
        occurred_at: "2026-10-05T12:00:00.000Z",
        source_app: "claude",
      }),
      record({
        id: "record-d",
        occurred_at: "2026-10-07T00:00:00.000Z",
        kind: "weight",
        value: "62.5",
        unit: "kg",
      }),
      record({ id: "record-e", occurred_at: "2026-10-08T00:00:00.000Z" }),
    ] as unknown as Row[],
  };

  it("returns [from, to) newest first, ties broken by id", async () => {
    const { client } = makeFake(seed);
    const records = await new SupabaseAppRecordsService(client).listAppRecords({
      from: "2026-10-05T12:00:00.000Z",
      to: "2026-10-08T00:00:00.000Z",
    });
    // record-a is before `from`; record-e sits exactly on `to` (exclusive).
    expect(records.map((r) => r.id)).toEqual([
      "record-d",
      "record-b",
      "record-c",
    ]);
  });

  it("narrows by source app and by kind", async () => {
    const { client } = makeFake(seed);
    const service = new SupabaseAppRecordsService(client);
    const range = {
      from: "2026-01-01T00:00:00.000Z",
      to: "2027-01-01T00:00:00.000Z",
    };
    expect(
      (await service.listAppRecords(range, { sourceApp: "claude" })).map(
        (r) => r.id,
      ),
    ).toEqual(["record-c"]);
    expect(
      (await service.listAppRecords(range, { kind: "weight" })).map(
        (r) => r.id,
      ),
    ).toEqual(["record-d"]);
  });

  it("maps numeric to a JS number, even when it arrives as a string", async () => {
    const { client } = makeFake(seed);
    const [weight] = await new SupabaseAppRecordsService(client).listAppRecords(
      { from: "2026-10-07T00:00:00.000Z", to: "2026-10-07T00:00:00.001Z" },
    );
    expect(weight.value).toBe(62.5);
    expect(weight.unit).toBe("kg");
  });

  it("reads every page past the 1000-row cap", async () => {
    const many = Array.from({ length: 1001 }, (_, i) =>
      record({
        id: `record-${String(i).padStart(4, "0")}`,
        occurred_at: "2026-10-05T00:00:00.000Z",
      }),
    );
    const { client } = makeFake({ app_records: many as unknown as Row[] });
    const records = await new SupabaseAppRecordsService(client).listAppRecords({
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-11-01T00:00:00.000Z",
    });
    expect(records).toHaveLength(1001);
  });
});

describe("listAppRecordSources", () => {
  it("counts each app's last 30 days and finds its newest record", async () => {
    const { client, requests } = makeFake({
      app_records: [
        record({
          id: "r1",
          source_app: "kakeibo",
          occurred_at: "2026-10-10T00:00:00.000Z",
        }),
        record({
          id: "r2",
          source_app: "kakeibo",
          occurred_at: "2026-09-20T00:00:00.000Z",
        }),
        // 31 days before NOW — outside the window, still the app's history.
        record({
          id: "r3",
          source_app: "kakeibo",
          occurred_at: "2026-09-10T00:00:00.000Z",
        }),
        record({
          id: "r4",
          source_app: "claude",
          occurred_at: "2026-10-11T00:00:00.000Z",
        }),
        // An app whose only record is old: listed, with 0 in the window.
        record({
          id: "r5",
          source_app: "sleep-log",
          occurred_at: "2026-06-01T00:00:00.000Z",
        }),
      ] as unknown as Row[],
    });
    const sources = await new SupabaseAppRecordsService(
      client,
    ).listAppRecordSources();
    expect(sources).toEqual([
      {
        sourceApp: "claude",
        lastRecordAt: "2026-10-11T00:00:00.000Z",
        recordsLast30Days: 1,
      },
      {
        sourceApp: "kakeibo",
        lastRecordAt: "2026-10-10T00:00:00.000Z",
        recordsLast30Days: 2,
      },
      {
        sourceApp: "sleep-log",
        lastRecordAt: "2026-06-01T00:00:00.000Z",
        recordsLast30Days: 0,
      },
    ]);
    // The counts are head-only: no record row is transferred to count it.
    const counts = requests.filter((r) => r.head);
    expect(counts).toHaveLength(3);
    expect(
      counts.every((r) =>
        r.filters.some(
          (f) =>
            f.col === "occurred_at" &&
            f.op === "gte" &&
            f.val === "2026-09-11T03:00:00.000Z",
        ),
      ),
    ).toBe(true);
  });

  it("returns nothing when no record has arrived yet", async () => {
    const { client } = makeFake();
    expect(
      await new SupabaseAppRecordsService(client).listAppRecordSources(),
    ).toEqual([]);
  });
});

describe("records are read-only from shared", () => {
  it("no method writes to app_records", async () => {
    const { client, requests } = makeFake({
      app_records: [record({ id: "r1" })] as unknown as Row[],
      extension_apps: [appRow("kakeibo", 0)],
    });
    const service = new SupabaseAppRecordsService(client);
    await service.listAppRecords({
      from: "2026-01-01T00:00:00.000Z",
      to: "2027-01-01T00:00:00.000Z",
    });
    await service.listAppRecordSources();
    await service.listExtensionApps();
    await service.createExtensionApp({ slug: "weight", name: "Weight" });
    await service.updateExtensionApp("weight", { name: "Body weight" });
    await service.deleteExtensionApp("kakeibo");
    expect(
      requests.filter((r) => r.table === "app_records" && r.op !== "select"),
    ).toEqual([]);
  });

  it("deleting a ledger row keeps that app's records", async () => {
    const { client, db } = makeFake({
      app_records: [
        record({ id: "r1", source_app: "kakeibo" }),
      ] as unknown as Row[],
      extension_apps: [appRow("kakeibo", 0)],
    });
    await new SupabaseAppRecordsService(client).deleteExtensionApp("kakeibo");
    expect(db.extension_apps).toEqual([]);
    expect(db.app_records.map((r) => r.id)).toEqual(["r1"]);
  });
});

describe("extension_apps ledger", () => {
  it("lists by sort order, then slug", async () => {
    const { client } = makeFake({
      extension_apps: [
        appRow("weight", 1),
        appRow("sleep", 0),
        appRow("kakeibo", 1),
      ],
    });
    const apps = await new SupabaseAppRecordsService(
      client,
    ).listExtensionApps();
    expect(apps.map((a) => a.slug)).toEqual(["sleep", "kakeibo", "weight"]);
  });

  it("creates at the end of the list without sending user_id", async () => {
    const { client, requests } = makeFake({
      extension_apps: [appRow("kakeibo", 0), appRow("weight", 4)],
    });
    const app = await new SupabaseAppRecordsService(client).createExtensionApp({
      slug: "sleep-log",
      name: "  Sleep  ",
      url: "https://sleep.example.com",
      description: "   ",
    });
    expect(app).toMatchObject({
      slug: "sleep-log",
      name: "Sleep",
      url: "https://sleep.example.com",
      icon: null,
      description: null,
      sortOrder: 5,
    });
    const insert = requests.find((r) => r.op === "insert");
    expect(insert?.payload).not.toHaveProperty("user_id");
  });

  it("keeps an explicit sort order", async () => {
    const { client } = makeFake({ extension_apps: [appRow("kakeibo", 3)] });
    const app = await new SupabaseAppRecordsService(client).createExtensionApp({
      slug: "weight",
      name: "Weight",
      sortOrder: 0,
    });
    expect(app.sortOrder).toBe(0);
  });

  it("refuses a slug the user already registered as `taken`", async () => {
    const { client } = makeFake({ extension_apps: [appRow("kakeibo", 0)] });
    const error = await new SupabaseAppRecordsService(client)
      .createExtensionApp({ slug: "kakeibo", name: "Again" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ExtensionAppValidationError);
    expect(error).toMatchObject({ field: "slug", issue: "taken" });
  });

  it.each([
    [{ slug: "Kakeibo", name: "x" }, "slug", "badSlug"],
    [{ slug: "k", name: "x" }, "slug", "badSlug"],
    [{ slug: "1app", name: "x" }, "slug", "badSlug"],
    [{ slug: "kakeibo", name: "   " }, "name", "empty"],
    [
      { slug: "kakeibo", name: "x", url: "javascript:alert(1)" },
      "url",
      "badUrl",
    ],
    [{ slug: "kakeibo", name: "x", url: "example.com" }, "url", "badUrl"],
  ] as const)(
    "refuses %o before any request (%s %s)",
    async (input, field, issue) => {
      const { client, requests } = makeFake();
      const error = await new SupabaseAppRecordsService(client)
        .createExtensionApp(input)
        .catch((e: unknown) => e);
      expect(error).toMatchObject({ field, issue });
      expect(requests).toEqual([]);
    },
  );

  it("updates only the given fields and always bumps updated_at", async () => {
    const { client, requests } = makeFake({
      extension_apps: [
        {
          ...appRow("kakeibo", 0),
          url: "https://old.example.com",
          icon: "wallet",
        },
      ],
    });
    const app = await new SupabaseAppRecordsService(client).updateExtensionApp(
      "kakeibo",
      { url: "", description: "Household ledger" },
    );
    const update = requests.find((r) => r.op === "update");
    expect(update?.payload).toEqual({
      url: null,
      description: "Household ledger",
      updated_at: NOW.toISOString(),
    });
    expect(app).toMatchObject({
      slug: "kakeibo",
      url: null,
      icon: "wallet",
      description: "Household ledger",
      updatedAt: NOW.toISOString(),
    });
  });

  it("bumps updated_at even for an update that changes only the order", async () => {
    const { client, requests } = makeFake({
      extension_apps: [appRow("kakeibo", 0)],
    });
    await new SupabaseAppRecordsService(client).updateExtensionApp("kakeibo", {
      sortOrder: 2,
    });
    expect(requests.find((r) => r.op === "update")?.payload).toEqual({
      sort_order: 2,
      updated_at: NOW.toISOString(),
    });
  });

  it("refuses an update that would empty the name or break the URL", async () => {
    const { client, requests } = makeFake({
      extension_apps: [appRow("kakeibo", 0)],
    });
    const service = new SupabaseAppRecordsService(client);
    await expect(
      service.updateExtensionApp("kakeibo", { name: "" }),
    ).rejects.toMatchObject({ field: "name", issue: "empty" });
    await expect(
      service.updateExtensionApp("kakeibo", { url: "ftp://x.example.com" }),
    ).rejects.toMatchObject({ field: "url", issue: "badUrl" });
    expect(requests).toEqual([]);
  });

  it("fails loudly when the slug does not exist", async () => {
    const { client } = makeFake();
    await expect(
      new SupabaseAppRecordsService(client).updateExtensionApp("ghost", {
        name: "x",
      }),
    ).rejects.toThrow(/updateExtensionApp \(slug=ghost\) failed/);
  });
});

describe("appRecordMapper", () => {
  it("keeps only scalar dims and reads an odd dims value as empty", () => {
    expect(
      rowToAppRecord(
        record({
          id: "r1",
          dims: {
            category: "cafe",
            count: 2,
            paid: true,
            nested: { a: 1 },
            list: [1],
          },
        }),
      ).dims,
    ).toEqual({ category: "cafe", count: 2, paid: true });
    expect(rowToAppRecord(record({ id: "r2", dims: null })).dims).toEqual({});
    expect(rowToAppRecord(record({ id: "r3", dims: [1, 2] })).dims).toEqual({});
  });

  it("checks only the fields an update carries", () => {
    expect(extensionAppProblems({})).toEqual([]);
    expect(extensionAppProblems({ url: null })).toEqual([]);
    expect(extensionAppProblems({ url: "http://localhost:5173/app" })).toEqual(
      [],
    );
  });

  it("checks the slug with the 0039 CHECK's own pattern", () => {
    const sql = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        "../../supabase/migrations/0039_app_records.sql",
      ),
      "utf8",
    );
    const m = /check \(slug ~ '([^']+)'\)/.exec(sql);
    expect(m?.[1]).toBe(EXTENSION_APP_SLUG_PATTERN.source);
  });

  it("uses the 0039 slug pattern exactly (2 to 32 characters)", () => {
    expect(extensionAppProblems({ slug: "ab" })).toEqual([]);
    expect(extensionAppProblems({ slug: `a${"b".repeat(31)}` })).toEqual([]);
    expect(extensionAppProblems({ slug: `a${"b".repeat(32)}` })).toEqual([
      { field: "slug", issue: "badSlug" },
    ]);
    expect(extensionAppProblems({ slug: "my_app" })).toEqual([
      { field: "slug", issue: "badSlug" },
    ]);
  });
});
