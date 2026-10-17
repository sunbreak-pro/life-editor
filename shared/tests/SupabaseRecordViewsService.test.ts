// @vitest-environment node (this suite touches no DOM)
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseRecordViewsService } from "../src/services/SupabaseRecordViewsService";
import {
  RECORD_VIEW_CONFLICT,
  rowToRecordView,
  type RecordViewRow,
} from "../src/services/recordViewMapper";
import { RECORD_VIEW_DEFAULT } from "../src/types/recordView";

/*
 * SupabaseRecordViewsService (#2260) against a recording PostgREST fake. The
 * table comes from 0041, which is not pushed yet — so this suite is the only
 * place the reads and writes run before `supabase db push`.
 *
 * What the suite pins:
 *   - a save is ONE upsert on the 0041 UNIQUE (user_id, kind, unit), sets the
 *     row's own updated_at and never sends user_id (DB default auth.uid());
 *   - "no unit" is '' in the DB and null in the app, both ways;
 *   - a kind or a word the 0041 CHECKs would refuse is refused before any
 *     request;
 *   - the list read pages in (kind, unit) order and creates nothing.
 */

interface Call {
  table: string;
  op: string;
  payload?: Record<string, unknown>;
  options?: Record<string, unknown>;
  orders: string[];
}

function row(over: Partial<RecordViewRow> = {}): RecordViewRow {
  return {
    kind: "weight",
    unit: "kg",
    metric: "latest",
    chart: "line",
    created_at: "2026-10-17T00:00:00.000Z",
    updated_at: "2026-10-17T00:00:00.000Z",
    ...over,
  };
}

function makeClient(rows: RecordViewRow[] = []) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, op: "select", orders: [] };
      calls.push(call);
      const builder = {
        select: () => builder,
        order: (col: string) => {
          call.orders.push(col);
          return builder;
        },
        range: () => Promise.resolve({ data: rows, error: null }),
        upsert: (
          payload: Record<string, unknown>,
          options: Record<string, unknown>,
        ) => {
          call.op = "upsert";
          call.payload = payload;
          call.options = options;
          return builder;
        },
        single: () =>
          Promise.resolve({
            data: row({
              ...(call.payload as Partial<RecordViewRow>),
              created_at: "2026-10-01T00:00:00.000Z",
            }),
            error: null,
          }),
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("SupabaseRecordViewsService.saveRecordView", () => {
  it("upserts on (user_id, kind, unit), bumps updated_at and never sends user_id", async () => {
    const { client, calls } = makeClient();
    const view = await new SupabaseRecordViewsService(client).saveRecordView(
      "weight",
      "kg",
      { metric: "latest", chart: "line" },
    );

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call.table).toBe("record_views");
    expect(call.op).toBe("upsert");
    expect(call.options).toEqual({ onConflict: RECORD_VIEW_CONFLICT });
    expect(RECORD_VIEW_CONFLICT).toBe("user_id,kind,unit");
    expect(call.payload).not.toHaveProperty("user_id");
    expect(Number.isNaN(Date.parse(String(call.payload?.updated_at)))).toBe(
      false,
    );
    expect(view).toMatchObject({
      kind: "weight",
      unit: "kg",
      metric: "latest",
      chart: "line",
    });
  });

  it("stores no unit as '' and reads it back as null", async () => {
    const { client, calls } = makeClient();
    const view = await new SupabaseRecordViewsService(client).saveRecordView(
      "steps",
      null,
      RECORD_VIEW_DEFAULT,
    );
    expect(calls[0].payload?.unit).toBe("");
    expect(view.unit).toBeNull();
  });

  it("refuses a kind or a word the 0041 CHECKs would refuse, before any request", async () => {
    const { client, calls } = makeClient();
    const service = new SupabaseRecordViewsService(client);
    await expect(
      service.saveRecordView("Weight", "kg", RECORD_VIEW_DEFAULT),
    ).rejects.toThrow(/kind/);
    await expect(
      service.saveRecordView("weight", "kg", {
        metric: "median" as never,
        chart: "bar",
      }),
    ).rejects.toThrow(/metric/);
    await expect(
      service.saveRecordView("weight", "kg", {
        metric: "sum",
        chart: "pie" as never,
      }),
    ).rejects.toThrow(/chart/);
    expect(calls).toHaveLength(0);
  });
});

describe("SupabaseRecordViewsService.listRecordViews", () => {
  it("reads in (kind, unit) order and maps '' to null", async () => {
    const { client, calls } = makeClient([
      row(),
      row({ kind: "steps", unit: "", metric: "sum", chart: "bar" }),
    ]);
    const views = await new SupabaseRecordViewsService(
      client,
    ).listRecordViews();

    expect(calls.map((c) => c.op)).toEqual(["select"]);
    expect(calls[0].orders).toEqual(["kind", "unit"]);
    expect(views.map((v) => [v.kind, v.unit])).toEqual([
      ["weight", "kg"],
      ["steps", null],
    ]);
  });
});

describe("rowToRecordView", () => {
  it("fails loudly on a word this build does not know", () => {
    expect(() => rowToRecordView(row({ metric: "median" }))).toThrow(/median/);
  });

  it("starts every kind as today's look: a sum drawn as bars", () => {
    expect(RECORD_VIEW_DEFAULT).toEqual({ metric: "sum", chart: "bar" });
  });
});
