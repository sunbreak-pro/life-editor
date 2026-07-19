import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseScheduleItemsService } from "../src/services/SupabaseDataService";

/*
 * updateFutureScheduleItemsByRoutine (#279 scope dialog "今後" / "すべて") —
 * series-edit propagation over materialised occurrences. The tier-1 §Schedule
 * conflict rules must hold:
 *   1. done / dismissed occurrences are the user's life record → never
 *      patched, whatever the scope.
 *   2. manual edits win: when the caller passes the routine's PRE-edit
 *      template, rows deviating from it (individually edited title or times)
 *      are skipped.
 * Mock style mirrors detachRoutine.test.ts: a single-use thenable PostgREST
 * builder over an in-memory row set, recording UPDATEs for assertions.
 */

interface EventRow {
  item_id: string;
  routine_item_id: string;
  is_deleted_cache: boolean;
  done: boolean;
  is_dismissed: boolean;
  start_at: string; // YYYY-MM-DD
  start_time: string;
  end_time: string;
}

interface MetaRow {
  id: string;
  title: string;
}

interface UpdateRecord {
  table: string;
  patch: Record<string, unknown>;
  filter: { op: "in" | "eq"; col: string; val: unknown };
}

interface Filter {
  op: "eq" | "gte" | "in";
  col: string;
  val: unknown;
}

class Builder implements PromiseLike<{ data?: unknown; error: unknown }> {
  mode: "select" | "update" | null = null;
  columns = "";
  patch: Record<string, unknown> = {};
  filters: Filter[] = [];
  rangeArgs: [number, number] | null = null;

  constructor(
    private readonly table: string,
    private readonly events: EventRow[],
    private readonly metas: MetaRow[],
    private readonly updates: UpdateRecord[],
  ) {}

  select(columns = ""): this {
    this.mode = "select";
    this.columns = columns;
    return this;
  }
  update(patch: Record<string, unknown>): this {
    this.mode = "update";
    this.patch = patch;
    return this;
  }
  eq(col: string, val: unknown): this {
    this.filters.push({ op: "eq", col, val });
    return this;
  }
  gte(col: string, val: unknown): this {
    this.filters.push({ op: "gte", col, val });
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
      if (f.op === "gte") return (cell as string) >= (f.val as string);
      return (f.val as unknown[]).includes(cell);
    });
  }

  private resolve(): { data?: unknown; error: unknown } {
    if (this.mode === "select") {
      const source: Array<Record<string, unknown>> =
        this.table === "events_payload"
          ? (this.events as unknown as Array<Record<string, unknown>>)
          : (this.metas as unknown as Array<Record<string, unknown>>);
      let rows = source.filter((r) => this.matches(r));
      const key = this.table === "events_payload" ? "item_id" : "id";
      rows = rows
        .slice()
        .sort((a, b) => ((a[key] as string) < (b[key] as string) ? -1 : 1));
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
    const filter = this.filters.find((f) => f.op === "in" || f.op === "eq");
    if (filter) {
      this.updates.push({
        table: this.table,
        patch: this.patch,
        filter: {
          op: filter.op as "in" | "eq",
          col: filter.col,
          val: filter.val,
        },
      });
    }
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

function makeClient(events: EventRow[], metas: MetaRow[]) {
  const updates: UpdateRecord[] = [];
  const client = {
    from: (table: string) => new Builder(table, events, metas, updates),
  } as unknown as SupabaseClient;
  return { client, updates };
}

const ROUTINE = "routine-1";
const TEMPLATE = { title: "Gym", startTime: "19:00", endTime: "20:30" };

function row(item_id: string, over: Partial<EventRow> = {}): EventRow {
  return {
    item_id,
    routine_item_id: ROUTINE,
    is_deleted_cache: false,
    done: false,
    is_dismissed: false,
    start_at: "2026-07-20",
    start_time: TEMPLATE.startTime,
    end_time: TEMPLATE.endTime,
    ...over,
  };
}

function patchedIds(updates: UpdateRecord[], table: string): string[] {
  const out: string[] = [];
  for (const u of updates) {
    if (u.table === table && u.filter.op === "in") {
      out.push(...(u.filter.val as string[]));
    }
  }
  return out.sort();
}

describe("updateFutureScheduleItemsByRoutine — conflict-rule filtering (#279)", () => {
  it("skips done and dismissed occurrences (実績不可侵)", async () => {
    const events = [
      row("e-plain"),
      row("e-done", { done: true }),
      row("e-dismissed", { is_dismissed: true }),
    ];
    const metas: MetaRow[] = [
      { id: "e-plain", title: TEMPLATE.title },
      { id: "e-done", title: TEMPLATE.title },
      { id: "e-dismissed", title: TEMPLATE.title },
    ];
    const { client, updates } = makeClient(events, metas);
    const svc = new SupabaseScheduleItemsService(client);

    const count = await svc.updateFutureScheduleItemsByRoutine(
      ROUTINE,
      { startTime: "20:00" },
      "2026-07-19",
      TEMPLATE,
    );

    expect(count).toBe(1);
    expect(patchedIds(updates, "events_payload")).toEqual(["e-plain"]);
    expect(patchedIds(updates, "items_meta")).toEqual(["e-plain"]);
  });

  it("skips manually edited occurrences when the template is supplied (手動編集優先)", async () => {
    const events = [
      row("e-clean"),
      row("e-movedtime", { start_time: "07:00", end_time: "08:00" }),
      row("e-renamed"),
    ];
    const metas: MetaRow[] = [
      { id: "e-clean", title: TEMPLATE.title },
      { id: "e-movedtime", title: TEMPLATE.title },
      { id: "e-renamed", title: "Gym (special)" },
    ];
    const { client, updates } = makeClient(events, metas);
    const svc = new SupabaseScheduleItemsService(client);

    const count = await svc.updateFutureScheduleItemsByRoutine(
      ROUTINE,
      { title: "Training", startTime: "20:00" },
      "2026-07-19",
      TEMPLATE,
    );

    expect(count).toBe(1);
    expect(patchedIds(updates, "events_payload")).toEqual(["e-clean"]);
    const meta = updates.find((u) => u.table === "items_meta");
    expect(meta?.patch.title).toBe("Training");
    expect(typeof meta?.patch.updated_at).toBe("string");
  });

  it("patches every unedited live row without a template (no manual-edit guard)", async () => {
    const events = [
      row("e-a"),
      row("e-b", { start_time: "07:00" }),
      row("e-done", { done: true }),
    ];
    const metas: MetaRow[] = [
      { id: "e-a", title: TEMPLATE.title },
      { id: "e-b", title: TEMPLATE.title },
      { id: "e-done", title: TEMPLATE.title },
    ];
    const { client, updates } = makeClient(events, metas);
    const svc = new SupabaseScheduleItemsService(client);

    const count = await svc.updateFutureScheduleItemsByRoutine(
      ROUTINE,
      { endTime: "21:00" },
      "2026-07-19",
    );

    // done is still protected even without a template; the hand-moved row is
    // not (manual-edit protection requires the caller to pass the template).
    expect(count).toBe(2);
    expect(patchedIds(updates, "events_payload")).toEqual(["e-a", "e-b"]);
  });

  it("honours fromDate (今後) and reaches past rows for the epoch anchor (すべて)", async () => {
    const events = [
      row("e-past", { start_at: "2026-07-01" }),
      row("e-future", { start_at: "2026-07-25" }),
    ];
    const metas: MetaRow[] = [
      { id: "e-past", title: TEMPLATE.title },
      { id: "e-future", title: TEMPLATE.title },
    ];

    {
      const { client, updates } = makeClient(events, metas);
      const svc = new SupabaseScheduleItemsService(client);
      const count = await svc.updateFutureScheduleItemsByRoutine(
        ROUTINE,
        { startTime: "20:00" },
        "2026-07-19",
        TEMPLATE,
      );
      expect(count).toBe(1);
      expect(patchedIds(updates, "events_payload")).toEqual(["e-future"]);
    }
    {
      const { client, updates } = makeClient(events, metas);
      const svc = new SupabaseScheduleItemsService(client);
      const count = await svc.updateFutureScheduleItemsByRoutine(
        ROUTINE,
        { startTime: "20:00" },
        "0000-01-01",
        TEMPLATE,
      );
      expect(count).toBe(2);
      expect(patchedIds(updates, "events_payload")).toEqual([
        "e-future",
        "e-past",
      ]);
    }
  });

  it("matches a time-less template against the materialised defaults, not everything", async () => {
    // A routine with startTime/endTime = null materialises at the generator
    // defaults (09:00–09:30). The template match must compare against those
    // effective values: default-time rows are unedited (patched), a
    // hand-moved row keeps manual-edit protection.
    const events = [
      row("e-default", { start_time: "09:00", end_time: "09:30" }),
      row("e-moved", { start_time: "07:00", end_time: "08:00" }),
    ];
    const metas: MetaRow[] = [
      { id: "e-default", title: TEMPLATE.title },
      { id: "e-moved", title: TEMPLATE.title },
    ];
    const { client, updates } = makeClient(events, metas);
    const svc = new SupabaseScheduleItemsService(client);

    const count = await svc.updateFutureScheduleItemsByRoutine(
      ROUTINE,
      { startTime: "20:00" },
      "2026-07-19",
      { title: TEMPLATE.title, startTime: null, endTime: null },
    );

    expect(count).toBe(1);
    expect(patchedIds(updates, "events_payload")).toEqual(["e-default"]);
  });

  it("returns 0 and writes nothing when every candidate is filtered out", async () => {
    const events = [
      row("e-done", { done: true }),
      row("e-edited", { start_time: "05:00" }),
    ];
    const metas: MetaRow[] = [
      { id: "e-done", title: TEMPLATE.title },
      { id: "e-edited", title: TEMPLATE.title },
    ];
    const { client, updates } = makeClient(events, metas);
    const svc = new SupabaseScheduleItemsService(client);

    const count = await svc.updateFutureScheduleItemsByRoutine(
      ROUTINE,
      { startTime: "20:00" },
      "2026-07-19",
      TEMPLATE,
    );

    expect(count).toBe(0);
    expect(updates).toHaveLength(0);
  });
});
