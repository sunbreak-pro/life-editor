import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createSupabaseStub,
  inFilter,
  type QueryCall,
  type SupabaseStub,
} from "./supabaseStub.js";

let stub: SupabaseStub = createSupabaseStub();
vi.mock("../src/supabase.js", () => ({
  getSupabase: async () => stub,
}));

// Dynamic on purpose: a static import would be hoisted above vi.mock and read
// the real supabase module before the stub exists.
const { getWeekContext } = await import("../src/handlers/briefingHandlers.js");
const { TOOLS } = await import("../src/tools.js");

/*
 * get_week_context (#782 ③) — one weekly-review call instead of seven daily
 * ones.
 *
 * Grouping is what this tool adds, and grouping is what can be wrong without
 * looking wrong: a row on the correct day is indistinguishable from a row on
 * the wrong one unless the test says which day it expected. So every
 * assertion here names the day. The range filters are pinned too — they are
 * the half of "no data from outside the week" that Postgres performs, and a
 * stub cannot enforce them.
 *
 * TZ is pinned to Asia/Tokyo in vitest.config.ts, which is what makes the UTC
 * instants below land on the local days they claim.
 */

type Row = Record<string, unknown>;

interface Fixture {
  events?: Row[];
  scheduled?: Row[];
  carryover?: Row[];
  inProgress?: Row[];
  dailies?: Row[];
  /** Item ids whose items_meta row is gone or trashed. */
  dead?: string[];
}

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const event = (id: string, date: string, startTime: string | null = "09:00") =>
  ({
    item_id: id,
    start_at: date,
    start_time: startTime,
    end_time: startTime === null ? null : "10:00",
    is_all_day: startTime === null,
    done: false,
    memo: null,
  }) as Row;

const scheduledTask = (id: string, instant: string) =>
  ({
    item_id: id,
    scheduled_at: instant,
    scheduled_end_at: null,
    is_all_day: false,
    status: "NOT_STARTED",
  }) as Row;

const openTask = (id: string, over: Row = {}) =>
  ({
    item_id: id,
    due_at: null,
    status: "NOT_STARTED",
    priority: 0,
    scheduled_at: null,
    ...over,
  }) as Row;

const daily = (date: string, text: string) =>
  ({ item_id: `daily-${date}`, date, content_json: doc(text) }) as Row;

/** items_meta answers for every fixture row that is not named in `dead`. */
const titleOf = (id: string) => `title:${id}`;

function install(fixture: Fixture): void {
  const dead = new Set(fixture.dead ?? []);
  stub = createSupabaseStub((call: QueryCall) => {
    switch (call.table) {
      case "events_payload":
        return fixture.events ?? [];
      case "dailies_payload":
        return fixture.dailies ?? [];
      case "tasks_payload":
        // The three task reads, told apart by the filters that differ:
        // in-progress pins a status, and only the scheduled window has a
        // lower bound.
        if (call.filters.status === "IN_PROGRESS")
          return fixture.inProgress ?? [];
        if ("scheduled_at.gte" in call.bounds) return fixture.scheduled ?? [];
        return fixture.carryover ?? [];
      case "items_meta": {
        const ids = inFilter(call, "id") ?? [];
        // fetchDailies' liveness probe vs. the title lookup.
        if (call.filters.role === "daily")
          return ids.map((id) => ({ id, is_deleted: dead.has(id) }));
        return ids
          .filter((id) => !dead.has(id))
          .map((id) => ({ id, title: titleOf(id) }));
      }
      default:
        return [];
    }
  });
}

const MONDAY = "2026-08-10";
const WEEK = [
  "2026-08-10",
  "2026-08-11",
  "2026-08-12",
  "2026-08-13",
  "2026-08-14",
  "2026-08-15",
  "2026-08-16",
];
/** 09:30 JST on Tuesday of that week. */
const TUESDAY_MORNING = "2026-08-11T00:30:00.000Z";

const callTo = (table: string) => stub.calls.find((c) => c.table === table)!;
/** The two task reads that both bound `scheduled_at`, told apart as install does. */
const scheduledCall = () =>
  stub.calls.find(
    (c) => c.table === "tasks_payload" && "scheduled_at.gte" in c.bounds,
  )!;
const carryoverCall = () =>
  stub.calls.find(
    (c) =>
      c.table === "tasks_payload" &&
      "scheduled_at.lt" in c.bounds &&
      !("scheduled_at.gte" in c.bounds),
  )!;

afterEach(() => {
  vi.useRealTimers();
});

describe("the week the caller asked for", () => {
  it("lays out 7 days and puts each row on its own", async () => {
    install({
      events: [
        event("event-mon", "2026-08-10"),
        event("event-wed", "2026-08-12"),
      ],
      scheduled: [scheduledTask("task-tue", TUESDAY_MORNING)],
      dailies: [daily("2026-08-11", "火曜の記録")],
    });

    const week = await getWeekContext({ start_date: MONDAY });

    expect(week.startDate).toBe(MONDAY);
    expect(week.endDate).toBe("2026-08-16");
    expect(week.days.map((d) => d.date)).toEqual(WEEK);
    expect(week.days[0].events.map((e) => e.id)).toEqual(["event-mon"]);
    expect(week.days[2].events.map((e) => e.id)).toEqual(["event-wed"]);
    expect(week.days[1].events).toEqual([]);
    expect(week.days[1].scheduledTasks.map((t) => t.id)).toEqual(["task-tue"]);
    expect(week.days[0].scheduledTasks).toEqual([]);
    expect(week.days[1].daily).toEqual({ exists: true, text: "火曜の記録" });
  });

  it("returns the day shapes get_today_context returns, bodies excluded", async () => {
    install({
      events: [event("event-mon", "2026-08-10")],
      scheduled: [scheduledTask("task-tue", TUESDAY_MORNING)],
    });

    const week = await getWeekContext({ start_date: MONDAY });

    expect(week.days[0].events[0]).toEqual({
      id: "event-mon",
      title: "title:event-mon",
      startTime: "09:00",
      endTime: "10:00",
      isAllDay: false,
      completed: false,
      memo: null,
    });
    // A week of task documents is the context this tool exists to save.
    expect(week.days[1].scheduledTasks[0]).toEqual({
      id: "task-tue",
      title: "title:task-tue",
      scheduledAt: TUESDAY_MORNING,
      scheduledEndAt: null,
      isAllDay: false,
      status: "NOT_STARTED",
    });
  });

  it("says a day has no daily rather than leaving it out", async () => {
    install({ dailies: [daily("2026-08-11", "火曜の記録")] });

    const week = await getWeekContext({ start_date: MONDAY });

    expect(week.days.filter((d) => d.daily.exists)).toHaveLength(1);
    expect(week.days[0].daily).toEqual({ exists: false, text: null });
    expect(week.days[6].daily).toEqual({ exists: false, text: null });
  });

  it("drops a row whose items_meta is gone, on any day", async () => {
    install({
      events: [
        event("event-mon", "2026-08-10"),
        event("event-ghost", "2026-08-10"),
      ],
      dead: ["event-ghost"],
    });

    const week = await getWeekContext({ start_date: MONDAY });

    expect(week.days[0].events.map((e) => e.id)).toEqual(["event-mon"]);
  });
});

describe("nothing from outside the week gets in", () => {
  it("asks the DB for the week and no more", async () => {
    install({});

    await getWeekContext({ start_date: MONDAY });

    expect(callTo("events_payload").bounds).toMatchObject({
      "start_at.gte": MONDAY,
      "start_at.lte": "2026-08-16",
    });
    expect(callTo("events_payload").filters).toEqual({ is_dismissed: false });
    // [00:00 Mon JST, 00:00 next Mon JST) — the 7 local days as one instant
    // window, half-open so the following Monday is not swept in.
    expect(scheduledCall().bounds).toMatchObject({
      "scheduled_at.gte": "2026-08-09T15:00:00.000Z",
      "scheduled_at.lt": "2026-08-16T15:00:00.000Z",
      "scheduled_at.not.is": null,
    });
    expect(callTo("dailies_payload").bounds).toMatchObject({
      "date.gte": MONDAY,
      "date.lte": "2026-08-16",
    });
  });

  it("puts a row from the next week on no day at all", async () => {
    install({
      events: [event("event-next-mon", "2026-08-17")],
      // 00:00 JST on 2026-08-17 — one minute past the window's far edge.
      scheduled: [scheduledTask("task-next-mon", "2026-08-16T15:00:00.000Z")],
    });

    const week = await getWeekContext({ start_date: MONDAY });

    expect(week.days.flatMap((d) => d.events)).toEqual([]);
    expect(week.days.flatMap((d) => d.scheduledTasks)).toEqual([]);
  });
});

describe("open tasks are counted once, against the start of the week", () => {
  it("merges a task that is both carried over and in progress", async () => {
    const carried = openTask("task-1", {
      status: "IN_PROGRESS",
      scheduled_at: "2026-08-05T00:00:00.000Z",
    });
    install({ carryover: [carried], inProgress: [carried] });

    const week = await getWeekContext({ start_date: MONDAY });

    expect(week.openTasks).toEqual([
      {
        id: "task-1",
        title: "title:task-1",
        scheduledAt: "2026-08-05T00:00:00.000Z",
        dueAt: null,
        status: "IN_PROGRESS",
        priority: 0,
        carriedOver: true,
      },
    ]);
  });

  it("flags carry-over by the week's start, not by each day", async () => {
    install({
      carryover: [
        openTask("task-before", { scheduled_at: "2026-08-05T00:00:00.000Z" }),
      ],
      // Scheduled inside the week: in progress, but nothing was carried.
      inProgress: [
        openTask("task-inside", {
          status: "IN_PROGRESS",
          scheduled_at: "2026-08-13T01:00:00.000Z",
        }),
        openTask("task-unscheduled", { status: "IN_PROGRESS" }),
      ],
    });

    const week = await getWeekContext({ start_date: MONDAY });

    const carriedOverById = Object.fromEntries(
      week.openTasks.map((t) => [t.id, t.carriedOver]),
    );
    expect(carriedOverById).toEqual({
      "task-before": true,
      "task-inside": false,
      "task-unscheduled": false,
    });
  });

  it("treats PostgREST's +00:00 rendering of the window's first instant as inside it", async () => {
    install({
      // 00:00 Monday JST exactly, spelled the way PostgREST returns
      // timestamptz. A string compare against toISOString's `.000Z` calls
      // this "before the week" (`+` sorts before `.`).
      inProgress: [
        openTask("task-midnight", {
          status: "IN_PROGRESS",
          scheduled_at: "2026-08-09T15:00:00+00:00",
        }),
      ],
    });

    const week = await getWeekContext({ start_date: MONDAY });

    expect(week.openTasks.map((t) => [t.id, t.carriedOver])).toEqual([
      ["task-midnight", false],
    ]);
  });

  it("keeps the NULL-status escape hatch on the carry-over query", async () => {
    install({});

    await getWeekContext({ start_date: MONDAY });

    // A plain .neq('status','DONE') drops NULL-status rows (three-valued
    // logic) — the same trap getTodayContext documents.
    const carryover = carryoverCall();
    expect(carryover.or).toEqual(["status.neq.DONE,status.is.null"]);
    expect(carryover.filters).toEqual({ task_type: "task" });
    // Measured against the week's first instant, not each day's.
    expect(carryover.bounds["scheduled_at.lt"]).toBe(
      "2026-08-09T15:00:00.000Z",
    );
  });
});

describe("the default week", () => {
  it("starts on the Monday of the week the caller is in", async () => {
    // A Thursday: the answer must be the Monday before it, not that Thursday.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T10:00:00+09:00"));
    install({});

    const week = await getWeekContext({});

    expect(week.startDate).toBe(MONDAY);
    expect(week.endDate).toBe("2026-08-16");
    expect(callTo("events_payload").bounds["start_at.gte"]).toBe(MONDAY);
  });

  it("still refuses a date it cannot read", async () => {
    install({});

    await expect(getWeekContext({ start_date: "2026-8-10" })).rejects.toThrow(
      /Invalid date/,
    );
    // An empty string is a mistake, not "this week" — same rule as
    // get_today_context's date.
    await expect(getWeekContext({ start_date: "" })).rejects.toThrow(
      /Invalid date/,
    );
  });

  it("opens the window on an explicit start_date without snapping to Monday", async () => {
    install({});

    // A Wednesday: the declared contract is 7 days FROM it, not its week.
    const week = await getWeekContext({ start_date: "2026-08-12" });

    expect(week.startDate).toBe("2026-08-12");
    expect(week.endDate).toBe("2026-08-18");
  });
});

describe("what get_week_context publishes", () => {
  const tool = TOOLS.find((t) => t.name === "get_week_context");

  it("asks for nothing, so a bare call means this week", () => {
    expect(tool?.inputSchema.required ?? []).toEqual([]);
    expect(tool?.inputSchema.properties).toHaveProperty("start_date");
  });

  it("names the default and the line it draws, where the caller reads it", () => {
    const description = tool?.description ?? "";
    expect(description).toMatch(/Monday/);
    // The caller cannot guess that bodies are missing, nor what to do about it.
    expect(description).toMatch(/get_task/);
  });
});
