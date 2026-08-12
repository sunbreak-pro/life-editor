import { describe, it, expect, vi } from "vitest";
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
  inProgress?: Row[];
  dailies?: Row[];
}

function install(fixture: Fixture): void {
  stub = createSupabaseStub((call: QueryCall) => {
    switch (call.table) {
      case "events_payload":
        return fixture.events ?? [];
      case "dailies_payload": {
        // fetchDailies runs twice (recent window, then today) — the bounds
        // are what tells them apart, so honour them.
        const from = call.bounds["date.gte"] as string;
        const to = call.bounds["date.lte"] as string;
        return (fixture.dailies ?? []).filter(
          (d) => (d.date as string) >= from && (d.date as string) <= to,
        );
      }
      case "tasks_payload":
        if (call.filters.status === "IN_PROGRESS")
          return fixture.inProgress ?? [];
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
      scheduledTasks: [
        {
          id: "task-sched",
          title: "title:task-sched",
          scheduledAt: "2026-08-13T01:00:00.000Z",
          scheduledEndAt: null,
          isAllDay: false,
          status: "NOT_STARTED",
        },
      ],
      openTasks: [
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
      recentDailies: [{ date: "2026-08-12", text: "昨日" }],
      todayDaily: { exists: true, hasBriefing: false, text: "今日" },
    });
  });

  it("reports an absent today without inventing a daily", async () => {
    install({ dailies: [daily("2026-08-12", "昨日")] });

    const context = await getTodayContext({ date: DATE });

    expect(context.todayDaily).toEqual({
      exists: false,
      hasBriefing: false,
      text: null,
    });
    expect(context.recentDailies).toEqual([
      { date: "2026-08-12", text: "昨日" },
    ]);
  });
});

function daily(date: string, text: string): Row {
  return { item_id: `daily-${date}`, date, content_json: doc(text) };
}
