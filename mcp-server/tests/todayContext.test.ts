import { describe, it, expect, vi } from "vitest";
import {
  createSupabaseStub,
  fromTables,
  inFilter,
  type QueryCall,
  type StubTables,
  type SupabaseStub,
} from "./supabaseStub.js";

let stub: SupabaseStub = createSupabaseStub();
vi.mock("../src/supabase.js", () => ({
  getSupabase: async () => stub,
}));

// Dynamic on purpose: a static import would be hoisted above vi.mock and read
// the real supabase module before the stub exists.
const { getTodayContext } = await import("../src/handlers/briefingHandlers.js");

/*
 * get_today_context — characterization (#782 ③). The tool has run in
 * production since #256, but nothing in this package ever mounted it; when
 * its formatting moved into helpers shared with get_week_context, "the return
 * value did not change" rested on reading the diff. This pins the whole
 * shape, key for key, so the next refactor gets a red test instead.
 *
 * TZ is pinned to Asia/Tokyo in vitest.config.ts.
 */

type Row = Record<string, unknown>;

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const DATE = "2026-08-13";

interface Fixture {
  events?: Row[];
  scheduled?: Row[];
  carryover?: Row[];
  dailies?: Row[];
  /** Rows for the goal reads (#2104), run through the in-memory layer. */
  goals?: StubTables;
}

function install(fixture: Fixture): void {
  const goalRead = fromTables(fixture.goals ?? {});
  stub = createSupabaseStub((call: QueryCall) => {
    // The goal loader is the only reader that names role goal / task, or
    // asks tasks_payload by id.
    if (
      call.table === "goals_payload" ||
      call.table === "goal_todo_links" ||
      (call.table === "tasks_payload" && inFilter(call, "item_id")) ||
      (call.table === "items_meta" &&
        (call.filters.role === "goal" || call.filters.role === "task"))
    ) {
      return goalRead(call);
    }
    switch (call.table) {
      case "events_payload":
        return fixture.events ?? [];
      case "dailies_payload": {
        // The body pass (#1763) asks by id, with no date window — it reads
        // content_json + morning_comment for the UNLOCKED ids fetchDailies
        // just listed, behind has_password = false.
        const ids = inFilter(call, "item_id");
        if (ids) {
          return (fixture.dailies ?? []).filter(
            (d) =>
              ids.includes(d.item_id as string) &&
              (call.filters.has_password !== false || d.has_password === false),
          );
        }
        // fetchDailies runs twice (recent window, then today) — the bounds
        // are what tells them apart, so honour them.
        const from = call.bounds["date.gte"] as string;
        const to = call.bounds["date.lte"] as string;
        return (fixture.dailies ?? []).filter(
          (d) => (d.date as string) >= from && (d.date as string) <= to,
        );
      }
      case "tasks_payload":
        if ("scheduled_at.gte" in call.bounds) return fixture.scheduled ?? [];
        return fixture.carryover ?? [];
      case "items_meta": {
        const ids = inFilter(call, "id") ?? [];
        if (call.filters.role === "daily")
          return ids.map((id) => ({ id, is_deleted: false }));
        return ids.map((id) => ({ id, title: `title:${id}` }));
      }
      default:
        return [];
    }
  });
}

describe("getTodayContext", () => {
  it("returns the exact briefing shape it has always returned", async () => {
    install({
      events: [
        {
          item_id: "event-1",
          start_at: DATE,
          start_time: "09:00",
          end_time: "10:00",
          is_all_day: false,
          done: false,
          memo: "standup",
        },
      ],
      scheduled: [
        {
          item_id: "task-sched",
          scheduled_at: "2026-08-13T01:00:00.000Z",
          scheduled_end_at: null,
          is_all_day: false,
          status: "NOT_STARTED",
        },
      ],
      carryover: [
        {
          item_id: "task-old",
          due_at: null,
          status: "NOT_STARTED",
          priority: 1,
          scheduled_at: "2026-08-10T00:00:00.000Z",
        },
      ],
      dailies: [daily("2026-08-12", "昨日"), daily("2026-08-13", "今日")],
    });

    const context = await getTodayContext({ date: DATE });

    expect(context).toEqual({
      date: DATE,
      events: [
        {
          id: "event-1",
          title: "title:event-1",
          startTime: "09:00",
          endTime: "10:00",
          isAllDay: false,
          completed: false,
          memo: "standup",
        },
      ],
      scheduledTodos: [
        {
          id: "task-sched",
          title: "title:task-sched",
          scheduledAt: "2026-08-13T01:00:00.000Z",
          scheduledEndAt: null,
          isAllDay: false,
          status: "NOT_STARTED",
        },
      ],
      openTodos: [
        {
          id: "task-old",
          title: "title:task-old",
          scheduledAt: "2026-08-10T00:00:00.000Z",
          dueAt: null,
          status: "NOT_STARTED",
          priority: 1,
          carriedOver: true,
        },
      ],
      recentDailies: [
        {
          date: "2026-08-12",
          locked: false,
          text: "昨日",
          morningComment: null,
        },
      ],
      todayDaily: {
        exists: true,
        locked: false,
        hasBriefing: false,
        morningComment: null,
        text: "今日",
      },
      // #2104: the date's three periods, each listed even when it is empty.
      goals: [
        { kind: "year", key: "2026", goals: [] },
        { kind: "month", key: "2026-08", goals: [] },
        { kind: "week", key: "2026-08-09", goals: [] },
      ],
    });
  });

  it("says a locked day is locked rather than empty", async () => {
    install({
      dailies: [
        lockedDaily(DATE, "SECRET-TODAY"),
        lockedDaily("2026-08-12", "SECRET-YESTERDAY"),
      ],
    });

    const context = await getTodayContext({ date: DATE });

    expect(context.todayDaily).toEqual({
      exists: true,
      locked: true,
      hasBriefing: false,
      morningComment: null,
      text: null,
    });
    expect(context.recentDailies).toEqual([
      { date: "2026-08-12", locked: true, text: null, morningComment: null },
    ]);
    expect(JSON.stringify(context)).not.toContain("SECRET-");
  });

  /*
   * 0035 (D-20261007-briefing-1): the comment moved beside the body. Both
   * today and the recent days hand it back — the column first, an older
   * day's 朝刊 section second — and a locked day hands back neither: its
   * column is read only with the body, which a locked day never sends.
   */
  it("returns the morning comment, column first, body section second", async () => {
    install({
      dailies: [
        {
          ...daily(DATE, "今日"),
          content_json: {
            type: "doc",
            content: [
              {
                type: "heading",
                attrs: { level: 2 },
                content: [{ type: "text", text: "朝刊" }],
              },
              {
                type: "paragraph",
                content: [{ type: "text", text: "本文の講評" }],
              },
            ],
          },
          morning_comment: ["列の講評"],
        },
        {
          ...daily("2026-08-12", "昨日"),
          content_json: {
            type: "doc",
            content: [
              {
                type: "heading",
                attrs: { level: 2 },
                content: [{ type: "text", text: "朝刊" }],
              },
              {
                type: "paragraph",
                content: [{ type: "text", text: "昨日の講評" }],
              },
            ],
          },
          morning_comment: null,
        },
      ],
    });

    const context = await getTodayContext({ date: DATE });

    expect(context.todayDaily.morningComment).toEqual(["列の講評"]);
    expect(context.todayDaily.hasBriefing).toBe(true);
    expect(context.recentDailies[0]?.morningComment).toEqual(["昨日の講評"]);
    // The column rides on the gated body pass, not on the window read.
    expect(gatedCommentReads()).not.toEqual([]);
    expect(ungatedCommentReads()).toEqual([]);
  });

  it("hands back no comment for a locked day, column included", async () => {
    install({
      dailies: [
        { ...lockedDaily(DATE, "SECRET-TODAY"), morning_comment: ["SECRET-C"] },
        {
          ...lockedDaily("2026-08-12", "SECRET-YESTERDAY"),
          morning_comment: ["SECRET-C"],
        },
      ],
    });

    const context = await getTodayContext({ date: DATE });

    expect(context.todayDaily.morningComment).toBeNull();
    expect(context.todayDaily.hasBriefing).toBe(false);
    expect(context.recentDailies[0]?.morningComment).toBeNull();
    expect(JSON.stringify(context)).not.toContain("SECRET-");
    // Never fetched, not fetched and dropped (lockedBody.test.ts's rule):
    // no read names the column without the has_password = false filter.
    expect(ungatedCommentReads()).toEqual([]);
  });

  it("returns the date's goals with their progress (#2104)", async () => {
    install({
      goals: {
        items_meta: [
          { id: "goal-w", role: "goal", title: "3 runs", is_deleted: false },
          { id: "goal-old", role: "goal", title: "old", is_deleted: false },
          { id: "task-1", role: "task", title: "run", is_deleted: false },
          { id: "task-2", role: "task", title: "run", is_deleted: false },
        ],
        goals_payload: [
          goalPayload("goal-w", "2026-08-09"),
          // Last week's goal is not this date's.
          goalPayload("goal-old", "2026-08-02"),
        ],
        goal_todo_links: [
          { id: "l1", goal_id: "goal-w", todo_id: "task-1", is_deleted: false },
          { id: "l2", goal_id: "goal-w", todo_id: "task-2", is_deleted: false },
        ],
        tasks_payload: [
          { item_id: "task-1", status: "DONE" },
          { item_id: "task-2", status: "NOT_STARTED" },
        ],
      },
    });

    const context = await getTodayContext({ date: DATE });

    const week = context.goals.find((p) => p.kind === "week");
    expect(week?.goals.map((g) => g.id)).toEqual(["goal-w"]);
    expect(week?.goals[0].achievement).toEqual({
      achieved: false,
      via: null,
      connected: true,
      todos: { done: 1, total: 2 },
      children: { achieved: 0, total: 0 },
    });
  });

  it("reports an absent today without inventing a daily", async () => {
    install({ dailies: [daily("2026-08-12", "昨日")] });

    const context = await getTodayContext({ date: DATE });

    expect(context.todayDaily).toEqual({
      exists: false,
      locked: false,
      hasBriefing: false,
      morningComment: null,
      text: null,
    });
    expect(context.recentDailies).toEqual([
      { date: "2026-08-12", locked: false, text: "昨日", morningComment: null },
    ]);
  });
});

function daily(date: string, text: string): Row {
  return {
    item_id: `daily-${date}`,
    date,
    content_json: doc(text),
    has_password: false,
  };
}

function goalPayload(id: string, weekKey: string): Row {
  return {
    item_id: id,
    period_kind: "week",
    period_key: weekKey,
    sort_order: 0,
    parent_goal_id: null,
    manual_achieved_at: null,
    period_end_decision: null,
    decided_at: null,
    carried_from_goal_id: null,
  };
}

/** The same day with a password on it — its body is never fetched (#1763). */
function lockedDaily(date: string, text: string): Row {
  return { ...daily(date, text), has_password: true };
}

/** Reads of dailies_payload that name the 0035 comment column. */
function commentReads(): QueryCall[] {
  return stub.calls.filter(
    (c) =>
      c.table === "dailies_payload" &&
      c.op === "select" &&
      (c.columns ?? "").includes("morning_comment"),
  );
}

/** Those that only an unlocked row can answer. */
function gatedCommentReads(): QueryCall[] {
  return commentReads().filter((c) => c.filters.has_password === false);
}

/** Those that could reach a locked row — must always be empty. */
function ungatedCommentReads(): QueryCall[] {
  return commentReads().filter((c) => c.filters.has_password !== false);
}
