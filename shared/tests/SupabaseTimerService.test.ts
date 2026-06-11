import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseTimerService } from "../src/services/SupabaseTimerService";
import type { TimerSettingsRow } from "../src/services/timerMapper";

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

describe("SupabaseTimerService.fetchTimerSettings (QA #1 singleton-race fix)", () => {
  it("upserts id=1 with ignoreDuplicates, then SELECTs the row", async () => {
    const { client, calls, stage } = makeStub();
    // upsert resolves with no error; the subsequent select(...).eq.single
    // returns the row.
    stage("timer_settings", "upsert", { data: null, error: null });
    stage("timer_settings", "single", { data: ROW, error: null });

    const svc = new SupabaseTimerService(client);
    const result = await svc.fetchTimerSettings();

    // upsert was called with { id: 1 } and the dedupe options.
    const upsert = calls.find((c) => c.op === "upsert");
    expect(upsert).toBeDefined();
    expect(upsert!.args[0]).toEqual({ id: 1 });
    expect(upsert!.args[1]).toMatchObject({
      onConflict: "user_id,id",
      ignoreDuplicates: true,
    });

    // No maybeSingle anywhere (old racy path is gone).
    expect(calls.some((c) => c.op === "maybeSingle")).toBe(false);
    // A single SELECT terminal read happened.
    expect(calls.some((c) => c.op === "single")).toBe(true);

    expect(result.workDuration).toBe(25);
    expect(result.sessionsBeforeLongBreak).toBe(4);
  });

  it("throws a descriptive error when the upsert fails", async () => {
    const { client, stage } = makeStub();
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
