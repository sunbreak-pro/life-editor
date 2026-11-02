// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseTimerService } from "../src/services/SupabaseTimerService";
import type {
  TimerSessionRow,
  TimerSettingsRow,
} from "../src/services/timerMapper";
import { MANUAL_SESSION_LABEL } from "../src/utils/timerSessions";

/*
 * Service-level test for the W3-A→W3-B fixes on SupabaseTimerService. Focus:
 * the QA-W3A申し送り #1 singleton-race fix — fetchTimerSettings now upserts
 * the id=1 row with ignoreDuplicates (a concurrent first-access is a no-op,
 * not a PK violation) then SELECTs the guaranteed row, instead of the old
 * maybeSingle()→insert sequence whose gap could double-insert.
 *
 * Uses the same in-memory query-builder stub style as the other service
 * suites: each chain method records its call and returns the builder; the
 * terminal op (.single / .upsert) consumes a staged { data, error }.
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
    const key = `${table}.${op}`;
    const list = staged.get(key);
    if (!list || list.length === 0) {
      throw new Error(`Stub: no staged result for ${key}`);
    }
    return list.shift()!;
  }

  function builderFor(table: string, terminalOp: string): unknown {
    const builder: Record<string, unknown> = {
      select(_cols?: string) {
        calls.push({ table, op: "select", args: [_cols] });
        return builder;
      },
      eq(_col: string, _val: unknown) {
        calls.push({ table, op: "eq", args: [_col, _val] });
        return builder;
      },
      single() {
        calls.push({ table, op: "single", args: [] });
        return Promise.resolve(consume(table, "single"));
      },
      maybeSingle() {
        calls.push({ table, op: "maybeSingle", args: [] });
        return Promise.resolve(consume(table, "maybeSingle"));
      },
      // upsert resolves directly (no terminal select chained in the fix).
      then(
        onFulfilled: (v: StagedResult) => unknown,
        onRejected?: (e: unknown) => unknown,
      ) {
        return Promise.resolve(consume(table, terminalOp)).then(
          onFulfilled,
          onRejected,
        );
      },
    };
    return builder;
  }

  const client = {
    from(table: string) {
      return {
        select(_cols?: string) {
          calls.push({ table, op: "select", args: [_cols] });
          return builderFor(table, "select");
        },
        upsert(_row: unknown, _opts?: unknown) {
          calls.push({ table, op: "upsert", args: [_row, _opts] });
          return builderFor(table, "upsert");
        },
      };
    },
  } as unknown as SupabaseClient;

  return { client, calls, stage };
}

const ROW: TimerSettingsRow = {
  id: 1,
  user_id: "00000000-0000-0000-0000-000000000000",
  work_duration: 25,
  break_duration: 5,
  long_break_duration: 15,
  sessions_before_long_break: 4,
  auto_start_breaks: false,
  target_sessions: 4,
  created_at: "2026-06-10T10:00:00.000Z",
  updated_at: "2026-06-10T11:00:00.000Z",
};

describe("SupabaseTimerService.fetchTimerSettings", () => {
  /*
   * #499 flipped the order: read first, write only when the row is missing.
   * The unconditional upsert made a READ write on every call, so every
   * Realtime echo — including the one from editing a note — POSTed to
   * timer_settings. The row exists after the first call for the rest of the
   * account's life, so the steady state must be select-only.
   */
  it("returns the existing row without writing anything", async () => {
    const { client, calls, stage } = makeStub();
    stage("timer_settings", "maybeSingle", { data: ROW, error: null });

    const svc = new SupabaseTimerService(client);
    const result = await svc.fetchTimerSettings();

    expect(calls.some((c) => c.op === "upsert")).toBe(false);
    expect(result.workDuration).toBe(25);
    expect(result.sessionsBeforeLongBreak).toBe(4);
  });

  it("materialises the singleton on the miss path only", async () => {
    const { client, calls, stage } = makeStub();
    // First access for this account: nothing there yet.
    stage("timer_settings", "maybeSingle", { data: null, error: null });
    stage("timer_settings", "upsert", { data: null, error: null });
    stage("timer_settings", "single", { data: ROW, error: null });

    const svc = new SupabaseTimerService(client);
    const result = await svc.fetchTimerSettings();

    // QA-W3A申し送り #1 (the singleton race) still has to hold on this path:
    // two concurrent first-accesses must not trip the (user_id, id) PK, so the
    // write stays an ignoreDuplicates upsert rather than an INSERT.
    const upsert = calls.find((c) => c.op === "upsert");
    expect(upsert).toBeDefined();
    expect(upsert!.args[0]).toEqual({ id: 1 });
    expect(upsert!.args[1]).toMatchObject({
      onConflict: "user_id,id",
      ignoreDuplicates: true,
    });
    expect(result.workDuration).toBe(25);
  });

  it("throws a descriptive error when the initial read fails", async () => {
    const { client, stage } = makeStub();
    stage("timer_settings", "maybeSingle", {
      data: null,
      error: { message: "denied" },
    });
    const svc = new SupabaseTimerService(client);
    await expect(svc.fetchTimerSettings()).rejects.toThrow(
      /fetchTimerSettings failed: denied/,
    );
  });

  it("throws a descriptive error when the upsert fails", async () => {
    const { client, stage } = makeStub();
    stage("timer_settings", "maybeSingle", { data: null, error: null });
    stage("timer_settings", "upsert", {
      data: null,
      error: { message: "boom" },
    });
    const svc = new SupabaseTimerService(client);
    await expect(svc.fetchTimerSettings()).rejects.toThrow(
      /fetchTimerSettings upsert failed: boom/,
    );
  });

  it("throws when the post-upsert SELECT fails", async () => {
    const { client, stage } = makeStub();
    stage("timer_settings", "maybeSingle", { data: null, error: null });
    stage("timer_settings", "upsert", { data: null, error: null });
    stage("timer_settings", "single", {
      data: null,
      error: { message: "no row" },
    });
    const svc = new SupabaseTimerService(client);
    await expect(svc.fetchTimerSettings()).rejects.toThrow(
      /fetchTimerSettings failed: no row/,
    );
  });
});

/*
 * #2407 — a typed total becomes one row in the log. An in-memory table rather
 * than staged results, because what is under test is the state the writes leave
 * behind: the timer's rows untouched, and at most one hand-entered row.
 */
describe("SupabaseTimerService.saveEventWorkTotal", () => {
  const EVENT = "event-1";
  const ANCHOR = { date: "2026-08-20", startTime: "10:00", isAllDay: false };

  function row(
    over: Partial<TimerSessionRow> & { id: number },
  ): TimerSessionRow {
    return {
      user_id: "u",
      task_id: null,
      event_id: EVENT,
      session_type: "WORK",
      started_at: "2026-08-20T01:00:00.000Z",
      ended_at: "2026-08-20T01:30:00.000Z",
      duration: 1800,
      completed: true,
      label: null,
      created_at: "2026-08-20T01:00:00.000Z",
      updated_at: "2026-08-20T01:30:00.000Z",
      ...over,
    };
  }

  function makeTable(rows: TimerSessionRow[], failWrites = false) {
    const table = { rows, nextId: 100 };
    const failure = failWrites ? { message: "boom" } : null;
    const client = {
      from() {
        return {
          select() {
            const filters: Array<(r: TimerSessionRow) => boolean> = [];
            const builder = {
              eq(col: keyof TimerSessionRow, val: unknown) {
                filters.push((r) => r[col] === val);
                return builder;
              },
              order() {
                return builder;
              },
              range() {
                return Promise.resolve({
                  data: table.rows.filter((r) => filters.every((f) => f(r))),
                  error: null,
                });
              },
            };
            return builder;
          },
          insert(values: Partial<TimerSessionRow>) {
            if (!failWrites) {
              table.rows.push(row({ id: table.nextId++, ...values }));
            }
            return Promise.resolve({ error: failure });
          },
          update(patch: Partial<TimerSessionRow>) {
            return {
              eq(_col: string, id: number) {
                if (!failWrites) {
                  table.rows = table.rows.map((r) =>
                    r.id === id ? { ...r, ...patch } : r,
                  );
                }
                return Promise.resolve({ error: failure });
              },
            };
          },
          delete() {
            return {
              in(_col: string, ids: number[]) {
                if (!failWrites) {
                  table.rows = table.rows.filter((r) => !ids.includes(r.id));
                }
                return Promise.resolve({ error: failure });
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;
    return { table, svc: new SupabaseTimerService(client) };
  }

  const manual = (rows: TimerSessionRow[]) =>
    rows.filter((r) => r.label === MANUAL_SESSION_LABEL);

  it("inserts a closed WORK row on the event's day for what the timer did not measure", async () => {
    const timer = row({ id: 1 });
    const { table, svc } = makeTable([timer]);
    await svc.saveEventWorkTotal({
      eventId: EVENT,
      anchor: ANCHOR,
      totalMinutes: 45,
    });
    const [added] = manual(table.rows);
    expect(added).toMatchObject({
      session_type: "WORK",
      event_id: EVENT,
      task_id: null,
      completed: true,
      duration: 900,
    });
    const startedAt = new Date(added.started_at);
    expect(startedAt.getTime()).toBe(new Date(2026, 7, 20, 10, 0).getTime());
    expect(new Date(added.ended_at as string).getTime()).toBe(
      startedAt.getTime() + 900_000,
    );
    expect(table.rows.find((r) => r.id === 1)).toEqual(timer);
  });

  it("updates the existing row rather than adding a second", async () => {
    const timer = row({ id: 1 });
    const { table, svc } = makeTable([
      timer,
      row({ id: 2, label: MANUAL_SESSION_LABEL, duration: 60 }),
    ]);
    await svc.saveEventWorkTotal({
      eventId: EVENT,
      anchor: { ...ANCHOR, date: "2026-08-21" },
      totalMinutes: 40,
    });
    const rows = manual(table.rows);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 2, duration: 600 });
    expect(new Date(rows[0].started_at).getDate()).toBe(21);
    expect(table.rows.find((r) => r.id === 1)).toEqual(timer);
  });

  it.each([
    ["the field is emptied", null],
    ["the total comes back to the timer's", 30],
  ])("deletes the row when %s", async (_name, totalMinutes) => {
    const timer = row({ id: 1 });
    const { table, svc } = makeTable([
      timer,
      row({ id: 2, label: MANUAL_SESSION_LABEL, duration: 60 }),
    ]);
    await svc.saveEventWorkTotal({
      eventId: EVENT,
      anchor: ANCHOR,
      totalMinutes,
    });
    expect(table.rows).toEqual([timer]);
  });

  it("refuses a total below the timer's minutes and writes nothing", async () => {
    const { table, svc } = makeTable([row({ id: 1 })]);
    await expect(
      svc.saveEventWorkTotal({
        eventId: EVENT,
        anchor: ANCHOR,
        totalMinutes: 29,
      }),
    ).rejects.toThrow(/below the 30 min/);
    expect(table.rows).toHaveLength(1);
  });

  it.each([1.5, -1])("refuses %d, which is not whole minutes", async (n) => {
    const { table, svc } = makeTable([]);
    await expect(
      svc.saveEventWorkTotal({
        eventId: EVENT,
        anchor: ANCHOR,
        totalMinutes: n,
      }),
    ).rejects.toThrow(/whole number/);
    expect(table.rows).toHaveLength(0);
  });

  it("rejects when the write fails", async () => {
    const { svc } = makeTable([], true);
    await expect(
      svc.saveEventWorkTotal({
        eventId: EVENT,
        anchor: ANCHOR,
        totalMinutes: 10,
      }),
    ).rejects.toThrow(/write failed: boom/);
  });
});
