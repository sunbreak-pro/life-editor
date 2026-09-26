import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseExportService } from "../src/services/SupabaseExportService";
import {
  USER_DATA_EXPORT_SCHEMA_VERSION,
  USER_DATA_EXPORT_TABLES,
  countUserDataExportRows,
  userDataExportFileName,
} from "../src/services/userDataExport";
import { POSTGREST_PAGE_SIZE } from "../src/services/postgrestFetchAll";

/*
 * #1988 — the whole-account export's read path.
 *
 * The fake client records every query it is asked for, so the suite can see
 * WHICH tables were read, that each read was fenced to the caller's user_id,
 * and that a table longer than one PostgREST page came back whole.
 */

const UID = "11111111-2222-3333-4444-555555555555";

interface Call {
  table: string;
  eq: [string, unknown][];
  order: string[];
  range: [number, number];
}

function makeClient(opts: {
  rows?: Record<string, number>;
  failTable?: string;
  user?: { id: string } | null;
}) {
  const calls: Call[] = [];
  const from = vi.fn((table: string) => {
    const call: Call = { table, eq: [], order: [], range: [0, 0] };
    const builder = {
      select: () => builder,
      eq: (col: string, value: unknown) => {
        call.eq.push([col, value]);
        return builder;
      },
      order: (col: string) => {
        call.order.push(col);
        return builder;
      },
      range: async (lo: number, hi: number) => {
        call.range = [lo, hi];
        calls.push(call);
        if (table === opts.failTable) {
          return { data: null, error: { message: "boom" } };
        }
        const total = opts.rows?.[table] ?? 1;
        const count = Math.max(0, Math.min(hi, total - 1) - lo + 1);
        const data = Array.from({ length: count }, (_, i) => ({
          id: `${table}-${lo + i}`,
          user_id: UID,
        }));
        return { data, error: null };
      },
    };
    return builder;
  });
  const user = opts.user === undefined ? { id: UID } : opts.user;
  const client = {
    from,
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("SupabaseExportService.exportUserData (#1988)", () => {
  it("reads every user table once, fenced to the caller and in a stable order", async () => {
    const { client, calls } = makeClient({});
    const data = await new SupabaseExportService(client).exportUserData();

    expect(calls.map((c) => c.table)).toEqual(
      USER_DATA_EXPORT_TABLES.map((t) => t.table),
    );
    for (const call of calls) {
      expect(call.eq).toContainEqual(["user_id", UID]);
      expect(call.order.length).toBeGreaterThan(0);
    }
    expect(Object.keys(data.tables)).toEqual(
      USER_DATA_EXPORT_TABLES.map((t) => t.table),
    );
    expect(countUserDataExportRows(data)).toBe(USER_DATA_EXPORT_TABLES.length);
  });

  it("puts schemaVersion and exportedAt at the top of the file", async () => {
    const { client } = makeClient({});
    const data = await new SupabaseExportService(client).exportUserData();

    expect(Object.keys(data).slice(0, 2)).toEqual([
      "schemaVersion",
      "exportedAt",
    ]);
    expect(data.schemaVersion).toBe(USER_DATA_EXPORT_SCHEMA_VERSION);
    expect(Number.isNaN(Date.parse(data.exportedAt))).toBe(false);
  });

  it("keeps paging past PostgREST's row cap, so a large table is not cut short", async () => {
    const big = POSTGREST_PAGE_SIZE * 2 + 5;
    const { client, calls } = makeClient({ rows: { notes_payload: big } });
    const data = await new SupabaseExportService(client).exportUserData();

    expect(data.tables.notes_payload).toHaveLength(big);
    expect(calls.filter((c) => c.table === "notes_payload")).toHaveLength(3);
  });

  it("fails the whole export when one table cannot be read", async () => {
    const { client } = makeClient({ failTable: "wiki_tags" });
    await expect(
      new SupabaseExportService(client).exportUserData(),
    ).rejects.toThrow(/exportUserData\(wiki_tags\) failed: boom/);
  });

  it("refuses to run without a signed-in user", async () => {
    const { client, calls } = makeClient({ user: null });
    await expect(
      new SupabaseExportService(client).exportUserData(),
    ).rejects.toThrow(/not authenticated/);
    expect(calls).toHaveLength(0);
  });
});

describe("userDataExportFileName (#1988)", () => {
  it("names the file after the local date", () => {
    expect(userDataExportFileName(new Date(2026, 8, 5, 23, 59))).toBe(
      "life-editor-export-2026-09-05.json",
    );
  });
});

/*
 * Lockstep with account deletion. `delete_my_account()` lists every table that
 * holds a user's rows, and itself raises if one is missed — so it is the most
 * trustworthy roster there is. Tables a later migration dropped are removed
 * from it; what is left must be exactly what the export reads.
 */
describe("export table roster (#1988)", () => {
  const migrationDir = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../supabase/migrations",
  );
  const files = readdirSync(migrationDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  function read(file: string): string {
    return readFileSync(resolve(migrationDir, file), "utf8").replace(
      /\r\n/g,
      "\n",
    );
  }

  it("matches the delete list of delete_my_account() minus dropped tables", () => {
    const deleteFile = files.filter((f) =>
      read(f).includes("function public.delete_my_account()"),
    );
    expect(deleteFile.length).toBeGreaterThan(0);
    const latest = deleteFile[deleteFile.length - 1];
    const deleted = new Set(
      [...read(latest).matchAll(/delete from public\.([a-z_]+)/g)].map(
        (m) => m[1],
      ),
    );
    for (const f of files.filter((f) => f > latest)) {
      for (const m of read(f).matchAll(
        /drop table (?:if exists )?public\.([a-z_]+)/g,
      )) {
        deleted.delete(m[1]);
      }
    }

    expect([...USER_DATA_EXPORT_TABLES.map((t) => t.table)].sort()).toEqual(
      [...deleted].sort(),
    );
  });
});
