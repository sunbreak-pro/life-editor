// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, expect, it } from "vitest";
import {
  TOMORROW_OTHERS_LIMIT,
  applyEveningNote,
  eveningDayCounts,
  eveningDayWindow,
  eveningEvents,
  eveningIssue,
  goalsMovedToday,
  tomorrowCandidates,
} from "../src/components/briefing/eveningDay";
import type { ScheduleItem } from "../src/types/schedule";
import type { TimerSession } from "../src/types/timer";
import type { TodoNode } from "../src/types/todoTree";
import { goal } from "./fixtures/goalLinkState";
import { makeTodo } from "./helpers/nodeFixtures";

/*
 * The evening paper's numbers and lists (#2107). They are pure functions of
 * the day's rows because the Daily rebuild (#2123) prints the same numbers
 * for any past day — so the day and its start hour are arguments, and every
 * instant below is built in LOCAL time (the window is a local-clock idea).
 */

const DAY = "2026-09-30"; // a Wednesday; its week starts on Sunday 09-27
/** A local instant on DAY (or `day`) as an ISO string. */
const at = (h: number, m = 0, day = 30, month = 9): string =>
  new Date(2026, month - 1, day, h, m).toISOString();

function event(over: Partial<ScheduleItem> & { id: string }): ScheduleItem {
  return {
    date: DAY,
    title: over.id,
    startTime: "09:00",
    endTime: "10:00",
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

function session(over: Partial<TimerSession> & { id: number }): TimerSession {
  return {
    todoId: null,
    eventId: null,
    sessionType: "WORK",
    startedAt: new Date(at(9, 30)),
    completedAt: new Date(at(11, 20)),
    duration: 110 * 60,
    completed: true,
    label: null,
    ...over,
  };
}

const done = (id: string, completedAt: string, title = id): TodoNode =>
  makeTodo({ id, title, status: "DONE", completedAt });
const open = (id: string, over: Partial<TodoNode> = {}): TodoNode =>
  makeTodo({ id, title: id, status: "NOT_STARTED", ...over });

describe("eveningDayWindow", () => {
  it("is the calendar day when the day starts at 0", () => {
    expect(eveningDayWindow(DAY, 0)).toEqual({
      start: new Date(2026, 8, 30, 0).getTime(),
      end: new Date(2026, 9, 1, 0).getTime(),
    });
  });

  it("runs from 4 o'clock to 4 o'clock with a 4 o'clock start (#218)", () => {
    expect(eveningDayWindow(DAY, 4)).toEqual({
      start: new Date(2026, 8, 30, 4).getTime(),
      end: new Date(2026, 9, 1, 4).getTime(),
    });
  });
});

describe("eveningEvents", () => {
  const scheduleItems = [
    event({ id: "dentist", title: "歯科検診", startTime: "14:00" }),
    event({ id: "holiday", title: "祝日", isAllDay: true, startTime: "" }),
    event({ id: "dinner", title: "会食", startTime: "19:00" }),
    event({ id: "gone", startTime: "08:00", isDeleted: true }),
    event({ id: "skipped", startTime: "08:00", isDismissed: true }),
    event({ id: "other-day", date: "2026-09-29", startTime: "08:00" }),
  ];
  const todos = [
    done("t-draft", at(11, 28), "企画書の初稿を仕上げる"),
    done("t-yesterday", at(22, 0, 29)),
    done("t-gone", at(10), "gone"),
    open("t-open"),
    makeTodo({ id: "t-plan", title: "企画書" }),
  ];
  todos[2] = { ...todos[2], isDeleted: true };
  const sessions = [
    session({ id: 1, todoId: "t-plan" }),
    session({
      id: 2,
      startedAt: new Date(at(14)),
      completedAt: null,
      duration: null,
      completed: false,
    }),
    session({ id: 3, sessionType: "BREAK", startedAt: new Date(at(12)) }),
  ];
  const rows = eveningEvents({
    dateKey: DAY,
    dayStartHour: 0,
    scheduleItems,
    todos,
    sessions,
    now: new Date(at(15)),
  });

  it("puts all-day first, then the day in time order", () => {
    expect(rows.map((r) => r.key)).toEqual([
      "event:holiday",
      "session:1",
      "todo:t-draft",
      "event:dentist",
    ]);
  });

  it("prints each kind's own time: HH:MM, a range for work, null all-day", () => {
    expect(rows.map((r) => [r.startTime, r.endTime])).toEqual([
      [null, null],
      ["09:30", "11:20"],
      ["11:28", null],
      ["14:00", null],
    ]);
  });

  it("leaves out events not started yet, open / break sessions, deleted and dismissed rows", () => {
    const keys = rows.map((r) => r.key);
    for (const k of [
      "event:dinner",
      "event:gone",
      "event:skipped",
      "event:other-day",
      "session:2",
      "session:3",
      "todo:t-yesterday",
      "todo:t-gone",
      "todo:t-open",
    ]) {
      expect(keys).not.toContain(k);
    }
  });

  it("keeps an event starting at `now` (「今後の予定」starts strictly after it)", () => {
    const keys = eveningEvents({
      dateKey: DAY,
      dayStartHour: 0,
      scheduleItems: [event({ id: "now", startTime: "15:00" })],
      todos: [],
      sessions: [],
      now: new Date(at(15)),
    }).map((r) => r.key);
    expect(keys).toEqual(["event:now"]);
  });

  it("names a session after its todo, then its event, then its label, else null", () => {
    const named = eveningEvents({
      dateKey: DAY,
      dayStartHour: 0,
      scheduleItems,
      todos,
      sessions: [
        session({ id: 1, todoId: "t-plan" }),
        session({ id: 2, eventId: "dentist", startedAt: new Date(at(10)) }),
        session({ id: 3, label: "読書", startedAt: new Date(at(11)) }),
        session({ id: 4, startedAt: new Date(at(12)) }),
      ],
    }).filter((r) => r.kind === "session");
    expect(named.map((r) => r.title)).toEqual([
      "企画書",
      "歯科検診",
      "読書",
      null,
    ]);
  });

  it("orders a tie event → work → done", () => {
    const tie = eveningEvents({
      dateKey: DAY,
      dayStartHour: 0,
      scheduleItems: [event({ id: "e", startTime: "10:00" })],
      todos: [done("t", at(10))],
      sessions: [session({ id: 9, startedAt: new Date(at(10)) })],
    });
    expect(tie.map((r) => r.kind)).toEqual(["event", "session", "todo"]);
  });

  it("files a 03:00 completion under the previous day with a 4 o'clock start", () => {
    const early = [done("t-night", at(3, 0, 1, 10)), done("t-dawn", at(3))];
    const keys = eveningEvents({
      dateKey: DAY,
      dayStartHour: 4,
      scheduleItems: [],
      todos: early,
      sessions: [],
    }).map((r) => r.key);
    // 10-01 03:00 is still the night of 09-30; 09-30 03:00 belonged to 09-29.
    expect(keys).toEqual(["todo:t-night"]);
  });
});

describe("eveningDayCounts", () => {
  it("counts events, the day's scheduled todos and the work minutes", () => {
    const counts = eveningDayCounts({
      dateKey: DAY,
      dayStartHour: 0,
      scheduleItems: [
        event({ id: "a" }),
        event({ id: "b", startTime: "20:00" }),
        event({ id: "c", isDismissed: true }),
      ],
      todos: [
        open("t1", { scheduledAt: at(9) }),
        open("t2", { scheduledAt: at(0) }),
        { ...done("t3", at(12)), scheduledAt: at(10) },
        { ...done("t4", at(12)), scheduledAt: at(10, 0, 29) },
        { ...open("t5", { scheduledAt: at(10) }), isDeleted: true },
      ],
      sessions: [
        session({ id: 1, duration: 50 * 60 }),
        session({ id: 2, duration: 60 * 60, startedAt: new Date(at(14)) }),
        session({ id: 3, sessionType: "BREAK", duration: 600 }),
        session({ id: 4, duration: 3600, startedAt: new Date(at(9, 0, 29)) }),
      ],
    });
    expect(counts).toEqual({
      events: 2,
      todosDone: 1,
      todosTotal: 3,
      todoRate: 1 / 3,
      workMinutes: 110,
    });
  });

  it("has no rate when nothing was scheduled", () => {
    const counts = eveningDayCounts({
      dateKey: DAY,
      dayStartHour: 0,
      scheduleItems: [],
      todos: [open("t1")],
      sessions: [],
    });
    expect(counts.todoRate).toBeNull();
    expect(counts.todosTotal).toBe(0);
    expect(counts.workMinutes).toBe(0);
  });

  it("files a scheduled todo by the day-start hour, as tomorrowCandidates does (#218)", () => {
    const counts = eveningDayCounts({
      dateKey: DAY,
      dayStartHour: 4,
      scheduleItems: [],
      todos: [
        // 02:00 on the next calendar date: still DAY's night.
        {
          ...done("night", at(2, 30, 1, 10)),
          scheduledAt: at(2, 0, 1, 10),
          isAllDay: false,
        },
        // DAY's own 02:00: the night before DAY.
        open("before", { scheduledAt: at(2), isAllDay: false }),
        open("evening", { scheduledAt: at(20), isAllDay: false }),
        // All-day keeps its calendar date.
        open("all-day", { scheduledAt: at(0), isAllDay: true }),
      ],
      sessions: [],
    });
    expect(counts.todosTotal).toBe(3);
    expect(counts.todosDone).toBe(1);
  });
});

describe("goalsMovedToday", () => {
  const goals = [
    {
      ...goal("w-plan", "企画書を通す", "week", "2026-09-27", "m-deal"),
      sortOrder: 0,
    },
    { ...goal("w-run", "3 回走る", "week", "2026-09-27"), sortOrder: 1 },
    {
      ...goal("w-book", "本を読み切る", "week", "2026-09-27", "m-read"),
      sortOrder: 2,
    },
    goal("m-read", "読書の習慣", "month", "2026-09"),
    goal("m-deal", "秋の案件", "month", "2026-09"),
    goal("w-old", "先週の目標", "week", "2026-09-20"),
    { ...goal("w-del", "消した目標", "week", "2026-09-27"), isDeleted: true },
    goal("w-still", "昨日だけ", "week", "2026-09-27"),
  ];
  const l = (goalId: string, todoId: string) => ({
    goalId,
    todoId,
    isDeleted: false,
  });
  const links = [
    l("w-plan", "plan1"),
    l("w-plan", "plan2"),
    l("w-plan", "plan3"),
    l("w-plan", "plan4"),
    l("w-run", "run1"),
    l("w-run", "run2"),
    l("w-run", "run3"),
    l("w-book", "book1"),
    l("w-book", "book2"),
    l("w-old", "plan3"),
    l("w-del", "plan3"),
    l("w-still", "plan1"),
  ];
  const yesterday = at(20, 0, 29);
  const todos = [
    done("plan1", yesterday),
    done("plan2", yesterday),
    done("plan3", at(11)),
    open("plan4"),
    done("run1", yesterday),
    done("run2", at(7)),
    open("run3"),
    done("book1", yesterday),
    done("book2", at(21)),
  ];
  const moves = goalsMovedToday({
    goals,
    links,
    todos,
    dateKey: DAY,
    dayStartHour: 0,
  });

  it("reads before → after off today's completions (brief §11)", () => {
    const plan = moves.find((m) => m.goalId === "w-plan");
    expect(plan).toMatchObject({
      title: "企画書を通す",
      periodKind: "week",
      before: { done: 2, total: 4, achieved: false },
      after: { done: 3, total: 4, achieved: false },
    });
    expect(moves.find((m) => m.goalId === "w-run")).toMatchObject({
      before: { done: 1, total: 3 },
      after: { done: 2, total: 3 },
    });
  });

  it("reports a goal the day achieved, and the parent it drags along", () => {
    expect(moves.find((m) => m.goalId === "w-book")).toMatchObject({
      before: { done: 1, total: 2, achieved: false },
      after: { done: 2, total: 2, achieved: true },
    });
    expect(moves.find((m) => m.goalId === "m-read")).toMatchObject({
      before: { done: 0, total: 1, achieved: false },
      after: { done: 1, total: 1, achieved: true },
    });
  });

  it("leaves out past periods, deleted goals and goals only yesterday moved", () => {
    const ids = moves.map((m) => m.goalId);
    for (const id of ["w-old", "w-del", "w-still", "m-deal"]) {
      expect(ids).not.toContain(id);
    }
  });

  it("orders weeks before months, by sortOrder within a period", () => {
    expect(moves.map((m) => m.goalId)).toEqual([
      "w-plan",
      "w-run",
      "w-book",
      "m-read",
    ]);
  });

  it("is empty on a day with no completion", () => {
    expect(
      goalsMovedToday({
        goals,
        links,
        todos: todos.filter(
          (t) => t.completedAt === yesterday || t.status !== "DONE",
        ),
        dateKey: DAY,
        dayStartHour: 0,
      }),
    ).toEqual([]);
  });
});

describe("eveningIssue", () => {
  const evening = (mood: number | null) =>
    JSON.stringify({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "夕刊" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: mood === null ? "書いただけ" : `気分: ${mood}/5`,
            },
          ],
        },
      ],
    });
  const day = (date: string, mood: number | null, isDeleted = false) => ({
    date,
    content: evening(mood),
    isDeleted,
  });

  it("keeps the last number and counts the streak from yesterday while today is unpublished", () => {
    expect(
      eveningIssue(
        [day("2026-09-28", 3), day("2026-09-29", 4), day(DAY, null)],
        DAY,
      ),
    ).toEqual({ number: 2, streak: 2, publishedToday: false });
  });

  it("turns N into N+1 once today has its mood line", () => {
    expect(
      eveningIssue(
        [day("2026-09-28", 3), day("2026-09-29", 4), day(DAY, 5)],
        DAY,
      ),
    ).toEqual({ number: 3, streak: 3, publishedToday: true });
  });

  it("breaks the streak at a gap but keeps counting the issues", () => {
    expect(
      eveningIssue(
        [day("2026-09-20", 3), day("2026-09-28", 2), day(DAY, 4)],
        DAY,
      ),
    ).toEqual({ number: 3, streak: 1, publishedToday: true });
  });

  it("ignores future days, deleted days and days without a mood line", () => {
    expect(
      eveningIssue(
        [
          day("2026-10-01", 4),
          day("2026-09-29", 4, true),
          day("2026-09-28", null),
          { date: "2026-09-27", content: "気分: 3/5", isDeleted: false },
        ],
        DAY,
      ),
    ).toEqual({ number: 0, streak: 0, publishedToday: false });
  });

  it("is all zero with no dailies at all", () => {
    expect(eveningIssue([], DAY)).toEqual({
      number: 0,
      streak: 0,
      publishedToday: false,
    });
  });
});

describe("tomorrowCandidates", () => {
  const goals = [
    { ...goal("w-plan", "企画書を通す", "week", "2026-09-27"), sortOrder: 0 },
    goal("m-deal", "秋の案件", "month", "2026-09"),
    goal("w-old", "先週", "week", "2026-09-20"),
  ];
  const l = (goalId: string, todoId: string) => ({
    goalId,
    todoId,
    isDeleted: false,
  });

  it("lists goal-linked todos first, with the goal they serve", () => {
    const rows = tomorrowCandidates({
      todos: [
        open("free"),
        open("for-month"),
        open("for-week"),
        open("for-old"),
      ],
      goals,
      links: [
        l("m-deal", "for-month"),
        l("w-plan", "for-week"),
        l("w-old", "for-old"),
      ],
      todayKey: DAY,
    });
    expect(rows.map((r) => [r.id, r.goalTitle])).toEqual([
      ["for-week", "企画書を通す"],
      ["for-month", "秋の案件"],
      // A past period's goal is no reason to put it first.
      ["free", null],
      ["for-old", null],
    ]);
  });

  it("caps the others, but always lists one already on tomorrow", () => {
    const others = Array.from({ length: 8 }, (_, i) => open(`o${i}`));
    const placed = open("placed", {
      scheduledAt: at(9, 0, 1, 10),
      isAllDay: false,
    });
    const rows = tomorrowCandidates({
      todos: [...others, placed],
      goals,
      links: [],
      todayKey: DAY,
    });
    expect(rows.filter((r) => r.placed === null)).toHaveLength(
      TOMORROW_OTHERS_LIMIT,
    );
    expect(rows.find((r) => r.id === "placed")?.placed).toEqual({
      time: "09:00",
    });
  });

  it("drops done todos and ones booked after tomorrow; reads all-day as no time", () => {
    const rows = tomorrowCandidates({
      todos: [
        done("finished", at(9)),
        open("later", { scheduledAt: at(9, 0, 2, 10) }),
        open("all-day", { scheduledAt: at(0, 0, 1, 10), isAllDay: true }),
        open("today", { scheduledAt: at(9) }),
        { ...open("deleted"), isDeleted: true },
      ],
      goals,
      links: [],
      todayKey: DAY,
    });
    expect(rows.map((r) => [r.id, r.placed])).toEqual([
      ["all-day", { time: null }],
      ["today", null],
    ]);
  });

  it("reads tomorrow by the day-start hour: its 02:00 is the next calendar date (#218)", () => {
    const rows = tomorrowCandidates({
      todos: [
        // Tomorrow night, past midnight: stored on 10-02 by the calendar.
        open("night", { scheduledAt: at(2, 0, 2, 10), isAllDay: false }),
        // 10-02 after the 4 o'clock start: the day after tomorrow.
        open("later", { scheduledAt: at(5, 0, 2, 10), isAllDay: false }),
        // Tomorrow before 4 o'clock by the calendar: still tonight.
        open("tonight", { scheduledAt: at(2, 0, 1, 10), isAllDay: false }),
        open("all-day", { scheduledAt: at(0, 0, 1, 10), isAllDay: true }),
      ],
      goals,
      links: [],
      todayKey: DAY,
      dayStartHour: 4,
    });
    expect(rows.map((r) => [r.id, r.placed])).toEqual([
      ["night", { time: "02:00" }],
      ["tonight", null],
      ["all-day", { time: null }],
    ]);
  });
});

describe("applyEveningNote", () => {
  it("adds a note as one line", () => {
    expect(applyEveningNote(null, "todo:t1", "  良かった\n本当に ")).toEqual({
      "todo:t1": "良かった 本当に",
    });
  });

  it("replaces a note and keeps the others", () => {
    expect(
      applyEveningNote({ "todo:t1": "a", "event:e1": "b" }, "todo:t1", "c"),
    ).toEqual({ "todo:t1": "c", "event:e1": "b" });
  });

  it("removes a key on an empty note", () => {
    expect(
      applyEveningNote({ "todo:t1": "a", "event:e1": "b" }, "todo:t1", "  "),
    ).toEqual({ "event:e1": "b" });
  });

  it("turns the map to null when its last note is removed", () => {
    expect(applyEveningNote({ "todo:t1": "a" }, "todo:t1", "")).toBeNull();
  });

  it("returns the same map (===) when nothing changes", () => {
    const notes = { "todo:t1": "a" };
    expect(applyEveningNote(notes, "todo:t1", " a ")).toBe(notes);
    expect(applyEveningNote(notes, "todo:t2", "")).toBe(notes);
    expect(applyEveningNote(null, "todo:t2", "")).toBeNull();
  });
});
