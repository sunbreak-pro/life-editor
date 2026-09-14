import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSupabaseStub,
  fromTables,
  type StubTables,
  type SupabaseStub,
} from "./supabaseStub.js";
import { configureTimeZone } from "../src/utils/localDate.js";

let stub: SupabaseStub = createSupabaseStub();
vi.mock("../src/supabase.js", () => ({
  getSupabase: async () => stub,
}));

// Dynamic on purpose: a static import would be hoisted above vi.mock and read
// the real supabase module before the stub exists.
const { listWorkSessions } = await import("../src/handlers/workHandlers.js");

/*
 * list_work_sessions — the time actually spent.
 *
 * Two things here are easy to get wrong and invisible once wrong.
 *
 * The DAY BOUNDARY: `started_at` is a timestamptz, so "2026-09-14" has to be
 * turned into the user's local midnight, not UTC's. A session at 08:00 JST is
 * 23:00 the PREVIOUS day in UTC — read the naive way, the morning's work
 * belongs to yesterday and nothing looks broken.
 *
 * The TOTALS: they cover the whole range while `sessions` is capped, so a
 * total computed from the page would quietly under-report a busy week. Both
 * halves are pinned below.
 */

const TZ = "Asia/Tokyo"; // UTC+9, no DST — the offset stays put all year.

const session = (over: Record<string, unknown> = {}) => ({
  id: 1,
  task_id: null,
  event_id: null,
  session_type: "WORK",
  started_at: "2026-09-14T01:00:00.000Z", // 10:00 JST
  ended_at: "2026-09-14T02:00:00.000Z",
  duration: 3600,
  completed: true,
  label: null,
  ...over,
});

const withRows = (tables: StubTables) => {
  stub = createSupabaseStub(fromTables(tables));
};

beforeEach(() => {
  configureTimeZone(TZ);
});

describe("listWorkSessions", () => {
  it("reports minutes, the item worked on, and range totals", async () => {
    withRows({
      timer_sessions: [
        session({ id: 1, task_id: "task-1", duration: 1500 }),
        session({
          id: 2,
          task_id: "task-1",
          duration: 900,
          started_at: "2026-09-14T03:00:00.000Z",
        }),
        session({
          id: 3,
          session_type: "BREAK",
          duration: 300,
          started_at: "2026-09-14T04:00:00.000Z",
        }),
      ],
      items_meta: [{ id: "task-1", role: "task", title: "write the thing" }],
    });

    const result = await listWorkSessions({ date: "2026-09-14" });

    expect(result.range).toEqual({ start: "2026-09-14", end: "2026-09-14" });
    expect(result.totals.minutesByType).toEqual({ WORK: 40, BREAK: 5 });
    expect(result.totals.totalMinutes).toBe(45);
    expect(result.totals.byItem).toEqual([
      { id: "task-1", role: "task", title: "write the thing", minutes: 40 },
    ]);
    expect(result.sessions[0]).toMatchObject({
      durationMinutes: 5,
      item: null, // the BREAK, newest first
    });
  });

  it("counts the local day, not the UTC one", async () => {
    withRows({
      timer_sessions: [
        // 08:00 JST on the 14th = 23:00 UTC on the 13th. A naive UTC range
        // would file this under the 13th and lose the morning.
        session({
          id: 1,
          started_at: "2026-09-13T23:00:00.000Z",
          duration: 600,
        }),
        // 08:00 JST on the 15th — the next local day, and out of range.
        session({
          id: 2,
          started_at: "2026-09-14T23:00:00.000Z",
          duration: 600,
        }),
      ],
    });

    const result = await listWorkSessions({ date: "2026-09-14" });

    expect(result.sessions.map((s) => s.id)).toEqual([1]);
    expect(result.totals.totalMinutes).toBe(10);
  });

  it("totals the whole range even when the page is capped", async () => {
    withRows({
      timer_sessions: [
        session({ id: 1, duration: 600 }),
        session({
          id: 2,
          duration: 600,
          started_at: "2026-09-14T03:00:00.000Z",
        }),
        session({
          id: 3,
          duration: 600,
          started_at: "2026-09-14T05:00:00.000Z",
        }),
      ],
    });

    const result = await listWorkSessions({ date: "2026-09-14", limit: 1 });

    expect(result.sessions).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    // 30, not 10: the cap trims rows, never the arithmetic.
    expect(result.totals.totalMinutes).toBe(30);
    expect(result.totals.sessionCount).toBe(3);
  });

  it("keeps a running session out of the totals and says how many there are", async () => {
    withRows({
      timer_sessions: [
        session({ id: 1, duration: 1200 }),
        session({
          id: 2,
          ended_at: null,
          duration: null,
          started_at: "2026-09-14T05:00:00.000Z",
        }),
      ],
    });

    const result = await listWorkSessions({ date: "2026-09-14" });

    expect(result.totals.totalMinutes).toBe(20);
    expect(result.totals.openSessions).toBe(1);
    expect(result.sessions[0]).toMatchObject({ id: 2, durationMinutes: null });
  });

  it("spans a multi-day range inclusively", async () => {
    withRows({
      timer_sessions: [
        session({
          id: 1,
          started_at: "2026-09-14T01:00:00.000Z",
          duration: 600,
        }),
        session({
          id: 2,
          started_at: "2026-09-15T01:00:00.000Z",
          duration: 600,
        }),
        session({
          id: 3,
          started_at: "2026-09-16T01:00:00.000Z",
          duration: 600,
        }),
      ],
    });

    const result = await listWorkSessions({
      start_date: "2026-09-14",
      end_date: "2026-09-15",
    });

    expect(result.sessions.map((s) => s.id)).toEqual([2, 1]);
    expect(result.totals.totalMinutes).toBe(20);
  });

  it("treats one open-ended date as that single day", async () => {
    withRows({ timer_sessions: [] });

    const result = await listWorkSessions({ start_date: "2026-09-14" });

    expect(result.range).toEqual({ start: "2026-09-14", end: "2026-09-14" });
  });

  it("refuses a backwards range", async () => {
    withRows({ timer_sessions: [] });

    await expect(
      listWorkSessions({ start_date: "2026-09-15", end_date: "2026-09-14" }),
    ).rejects.toThrow(/end_date 2026-09-14 is before 2026-09-15/);
  });

  it("filters by session type when asked", async () => {
    withRows({
      timer_sessions: [
        session({ id: 1, duration: 600 }),
        session({
          id: 2,
          session_type: "FREE",
          duration: 600,
          started_at: "2026-09-14T03:00:00.000Z",
        }),
      ],
    });

    const result = await listWorkSessions({
      date: "2026-09-14",
      session_type: "FREE",
    });

    expect(result.sessions.map((s) => s.id)).toEqual([2]);
  });

  it("writes nothing — this tool only reads", async () => {
    withRows({ timer_sessions: [session()] });

    await listWorkSessions({ date: "2026-09-14" });

    expect(stub.writes()).toEqual([]);
  });
});
