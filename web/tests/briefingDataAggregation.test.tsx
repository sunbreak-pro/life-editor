import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { localDateTimeToISO, type DataService } from "@life-editor/shared";
import { makeNote, makeTodo, stubDataService } from "./helpers";
import {
  briefingReads,
  createBriefingHarness,
  scheduleItem,
  type BriefingReadSeed,
} from "./helpers/briefingHarness";
import { useBriefingData } from "../src/briefing/hooks/useBriefingData";

/*
 * Briefing's data layer, AGGREGATION half (#892).
 *
 * Everything here is a rule about what belongs on today's paper, and the
 * failure mode of every one of them is a quiet omission: a todo filed under
 * the wrong day, a carryover that never ages out, a purpose chip that stops
 * resolving. Nothing throws — the block just renders one row short, which no
 * gate can notice and the reader has no reason to doubt.
 *
 * Time is pinned (Date only, so waitFor's real timers still run) because two
 * of these rules read the clock: 今後の予定 cuts the day at "now", and the
 * local-day key is what separates today's todos from 持ち越し. The suite runs
 * under TZ=Asia/Tokyo (vitest.config.ts), which is what makes the UTC trap
 * below reproducible.
 */

const TODAY = "2026-08-15";
const TOMORROW = "2026-08-16";
const YESTERDAY = "2026-08-14";
const FOUR_DAYS_AGO = "2026-08-11";

function renderData(seed: BriefingReadSeed = {}) {
  const ds: DataService = stubDataService(briefingReads(seed));
  const harness = createBriefingHarness();
  const view = renderHook(() => useBriefingData(ds, TODAY), {
    wrapper: harness.wrapper,
  });
  return view;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-08-15T12:00:00+09:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useBriefingData — schedule aggregation (#892)", () => {
  it("puts all-day rows first, then orders by start time", async () => {
    const { result } = renderData({
      scheduleByDate: {
        [TODAY]: [
          scheduleItem({ id: "s-late", date: TODAY, startTime: "15:00" }),
          scheduleItem({
            id: "s-allday",
            date: TODAY,
            startTime: "00:00",
            isAllDay: true,
          }),
          scheduleItem({ id: "s-early", date: TODAY, startTime: "08:00" }),
        ],
      },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data.schedule.map((s) => s.id)).toEqual([
      "s-allday",
      "s-early",
      "s-late",
    ]);
  });

  it("drops deleted and dismissed rows, and marks routine origin", async () => {
    const { result } = renderData({
      scheduleByDate: {
        [TODAY]: [
          scheduleItem({ id: "s-gone", date: TODAY, isDeleted: true }),
          scheduleItem({ id: "s-hidden", date: TODAY, isDismissed: true }),
          scheduleItem({ id: "s-routine", date: TODAY, routineId: "r1" }),
          scheduleItem({ id: "s-manual", date: TODAY }),
        ],
      },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const rows = result.current.data.schedule;
    expect(rows.map((s) => s.id)).toEqual(["s-routine", "s-manual"]);
    expect(rows.map((s) => s.isRoutine)).toEqual([true, false]);
  });
});

describe("useBriefingData — todo aggregation (#892)", () => {
  it("files a todo by its LOCAL day, not the UTC one (#413)", async () => {
    // Local midnight in JST is 15:00Z the day BEFORE. Slicing the first ten
    // characters — what this used to do — reads "2026-08-14" and files the row
    // under 持ち越し「2日目」 on the very day it was staged for.
    const { result } = renderData({
      todos: [
        makeTodo({
          id: "t-midnight",
          title: "Staged for today",
          scheduledAt: `${YESTERDAY}T15:00:00Z`,
          isAllDay: true,
        }),
      ],
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data.todos.map((t) => t.id)).toEqual(["t-midnight"]);
    expect(result.current.data.carryover).toEqual([]);
  });

  it("leaves deleted todos out of every block", async () => {
    // The hook also filters on `type === "task"`, which TodoNodeType makes
    // unreachable (it is single-valued — #375). That guard is about rows the
    // DB could hand back, not about anything expressible here, so there is no
    // honest fixture for it: writing one would need a cast that claims the
    // model allows something it does not.
    const { result } = renderData({
      todos: [
        makeTodo({
          id: "t-live",
          scheduledAt: localDateTimeToISO(TODAY, "09:00"),
        }),
        makeTodo({
          id: "t-dead",
          isDeleted: true,
          scheduledAt: localDateTimeToISO(TODAY, "09:00"),
        }),
      ],
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data.todos.map((t) => t.id)).toEqual(["t-live"]);
    expect(result.current.data.todoNodes.map((t) => t.id)).toEqual(["t-live"]);
  });

  it("ages carryover oldest-first and labels it from day 1", async () => {
    const { result } = renderData({
      todos: [
        makeTodo({
          id: "t-yesterday",
          scheduledAt: localDateTimeToISO(YESTERDAY, "09:00"),
        }),
        makeTodo({
          id: "t-old",
          scheduledAt: localDateTimeToISO(FOUR_DAYS_AGO, "09:00"),
        }),
      ],
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // "day N" counts the day it was staged for as day 1 — a todo left over
    // from yesterday is on its second day.
    expect(
      result.current.data.carryover.map((c) => [c.id, c.daysLabel]),
    ).toEqual([
      ["t-old", "day 5"],
      ["t-yesterday", "day 2"],
    ]);
  });

  it("keeps a carryover closed TODAY and drops one closed earlier", async () => {
    const { result } = renderData({
      todos: [
        makeTodo({
          id: "t-closed-today",
          status: "DONE",
          scheduledAt: localDateTimeToISO(YESTERDAY, "09:00"),
          completedAt: localDateTimeToISO(TODAY, "10:00"),
        }),
        makeTodo({
          id: "t-closed-before",
          status: "DONE",
          scheduledAt: localDateTimeToISO(YESTERDAY, "09:00"),
          completedAt: localDateTimeToISO(YESTERDAY, "10:00"),
        }),
      ],
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Ticking a row must not make it vanish under the finger that tapped it,
    // but yesterday's finished work is genuinely gone.
    const carryover = result.current.data.carryover;
    expect(carryover.map((c) => c.id)).toEqual(["t-closed-today"]);
    expect(carryover[0]?.completed).toBe(true);
  });

  it("shows at most five carryover rows", async () => {
    const { result } = renderData({
      todos: Array.from({ length: 7 }, (_, i) =>
        makeTodo({
          id: `t-${i}`,
          scheduledAt: localDateTimeToISO(YESTERDAY, "09:00"),
        }),
      ),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data.carryover).toHaveLength(5);
  });

  it("resolves purpose chips from links in either direction", async () => {
    const { result } = renderData({
      todos: [
        makeTodo({
          id: "t1",
          scheduledAt: localDateTimeToISO(TODAY, "09:00"),
        }),
      ],
      notes: [
        makeNote("n-from", { title: "Ship the migration" }),
        makeNote("n-to", { title: "Learn Postgres" }),
        makeNote("n-dead", { title: "Old goal", isDeleted: true }),
      ],
      connections: [
        { id: "l1", fromItemId: "t1", toItemId: "n-to" },
        { id: "l2", fromItemId: "n-from", toItemId: "t1" },
        { id: "l3", fromItemId: "t1", toItemId: "n-dead" },
        { id: "l4", fromItemId: "someone-else", toItemId: "n-to" },
      ],
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // The link direction is an implementation detail of whoever created it —
    // a goal is a goal from both ends. A deleted note contributes nothing.
    expect(result.current.data.todos[0]?.purposes).toEqual([
      "Learn Postgres",
      "Ship the migration",
    ]);
  });

  it("reads the briefing section out of the stored daily", async () => {
    const daily = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "朝刊" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Today is wide open." }],
        },
      ],
    });
    const { result } = renderData({ dailyContent: daily });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data.briefing).not.toBeNull();
    expect(result.current.dailyContent).toBe(daily);
  });

  it("has no briefing when the day has no daily yet", async () => {
    const { result } = renderData();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data.briefing).toBeNull();
    expect(result.current.dailyContent).toBeNull();
  });

  /*
   * #1369 — the paper's todo rows carried no clock, so the hook dropped the
   * one thing that separates a 09:00 todo from a "sometime today" one. The
   * time comes from `todoScheduleSlot`, the same selector the tray's chips
   * read, and the cases below are exactly where a second, hand-rolled parse
   * would disagree with the grid.
   */
  it("hands the paper HH:MM for a timed todo, an empty label for the rest", async () => {
    const { result } = renderData({
      todos: [
        makeTodo({
          id: "t-timed",
          title: "Timed",
          scheduledAt: localDateTimeToISO(TODAY, "09:30"),
          scheduledEndAt: localDateTimeToISO(TODAY, "10:30"),
          isAllDay: false,
        }),
        makeTodo({
          id: "t-allday",
          title: "All day",
          scheduledAt: localDateTimeToISO(TODAY, "00:00"),
          isAllDay: true,
        }),
        makeTodo({
          // A degenerate span (end <= start) is an all-day CANDIDATE, not a
          // block — todoScheduleSlot folds it, so the paper must not print
          // the 13:00 that instant technically carries (#562).
          id: "t-degenerate",
          title: "Degenerate",
          scheduledAt: localDateTimeToISO(TODAY, "13:00"),
          scheduledEndAt: localDateTimeToISO(TODAY, "13:00"),
          isAllDay: false,
        }),
      ],
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const byId = new Map(
      result.current.data.todos.map((t) => [t.id, t.startTime]),
    );
    expect(byId.get("t-timed")).toBe("09:30");
    // An all-day slot reports "00:00" — the grid's placeholder for a band, not
    // a time the todo has. Printing it would put a fake midnight on the paper.
    expect(byId.get("t-allday")).toBe("");
    expect(byId.get("t-degenerate")).toBe("");
  });

  it("reads the todo's LOCAL clock, not the UTC one", async () => {
    // Same trap as the local-day rule above: 00:30Z is 09:30 in JST. Slicing
    // the ISO string would print 00:30 on a row the grid draws at 09:30.
    const { result } = renderData({
      todos: [
        makeTodo({
          id: "t-utc",
          title: "Morning in Tokyo",
          scheduledAt: `${TODAY}T00:30:00Z`,
          isAllDay: false,
        }),
      ],
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data.todos[0]?.startTime).toBe("09:30");
  });
});

describe("useBriefingData — evening blocks (#892)", () => {
  it("lists today's open todos then the carryover, each with its status", async () => {
    const { result } = renderData({
      todos: [
        makeTodo({
          id: "t-today",
          title: "Write report",
          status: "NOT_STARTED",
          scheduledAt: localDateTimeToISO(TODAY, "09:00"),
        }),
        makeTodo({
          id: "t-done-earlier",
          status: "DONE",
          scheduledAt: localDateTimeToISO(TODAY, "09:00"),
          completedAt: localDateTimeToISO(YESTERDAY, "10:00"),
        }),
        makeTodo({
          id: "t-carry",
          status: "NOT_STARTED",
          scheduledAt: localDateTimeToISO(YESTERDAY, "09:00"),
        }),
      ],
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // The carryover rows carry the paper's own「N日目」meta, and their status
    // is read back off the todo rather than flattened to a boolean (#796).
    expect(
      result.current.remainingTodos.map((r) => [r.id, r.status, r.meta]),
    ).toEqual([
      ["t-today", "NOT_STARTED", undefined],
      ["t-carry", "NOT_STARTED", "day 2"],
    ]);
  });

  it("shows the rest of today and all of tomorrow, in that order", async () => {
    const { result } = renderData({
      scheduleByDate: {
        [TODAY]: [
          scheduleItem({ id: "s-past", date: TODAY, startTime: "08:00" }),
          scheduleItem({ id: "s-future", date: TODAY, startTime: "15:00" }),
          scheduleItem({
            id: "s-allday",
            date: TODAY,
            startTime: "00:00",
            isAllDay: true,
          }),
          scheduleItem({
            id: "s-done",
            date: TODAY,
            startTime: "16:00",
            completed: true,
          }),
        ],
        [TOMORROW]: [
          scheduleItem({
            id: "s-tmr-late",
            date: TOMORROW,
            startTime: "18:00",
          }),
          scheduleItem({
            id: "s-tmr-early",
            date: TOMORROW,
            startTime: "09:00",
          }),
        ],
      },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // 12:00 local: the 08:00 row is behind us, the completed one is settled,
    // and an all-day row belongs to the whole day so it always stands.
    expect(result.current.upcoming.map((u) => [u.id, u.isTomorrow])).toEqual([
      ["s-allday", false],
      ["s-future", false],
      ["s-tmr-early", true],
      ["s-tmr-late", true],
    ]);
  });
});

describe("useBriefingData — today's todo tray (#892)", () => {
  it("splits today's chips into placed and unplaced, and offers the rest", async () => {
    const { result } = renderData({
      todos: [
        makeTodo({
          id: "t-placed",
          title: "Placed",
          scheduledAt: localDateTimeToISO(TODAY, "09:00"),
          scheduledEndAt: localDateTimeToISO(TODAY, "10:00"),
          isAllDay: false,
        }),
        makeTodo({
          id: "t-unplaced",
          title: "Unplaced",
          scheduledAt: localDateTimeToISO(TODAY, "00:00"),
          isAllDay: true,
        }),
        makeTodo({ id: "t-addable", title: "Someday" }),
        makeTodo({ id: "t-done", title: "Finished", status: "DONE" }),
      ],
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.todoPlaced.map((r) => r.id)).toEqual(["t-placed"]);
    expect(result.current.todoPlaced[0]?.timeLabel).toBe("09:00");
    expect(result.current.todoUnplaced.map((r) => r.id)).toEqual([
      "t-unplaced",
    ]);
    // The picker offers undated, unfinished todos only — a finished one is not
    // something you add to today.
    expect(result.current.todoAddable.map((r) => r.id)).toEqual(["t-addable"]);
  });

  it("gives each chip the todo's real status, not a boolean (#796)", async () => {
    const { result } = renderData({
      todos: [
        makeTodo({
          id: "t-progress",
          status: "NOT_STARTED",
          scheduledAt: localDateTimeToISO(TODAY, "00:00"),
          isAllDay: true,
        }),
      ],
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.todoUnplaced[0]?.status).toBe("NOT_STARTED");
  });
});
