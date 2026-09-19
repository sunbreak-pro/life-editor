// @vitest-environment node (this suite touches no DOM)
import { describe, it, expect } from "vitest";
import type { TimerSession } from "../src/types/timer";
import {
  ABANDONED_SESSION_SECONDS,
  freeSessionSlot,
  isCountedSession,
  pickWorkHistoryDay,
  sessionTargetId,
  totalWorkMinutesForItem,
} from "../src/utils/timerSessions";

/*
 * #1375 — reading a session's target. A row names at most one item (0029's
 * CHECK), and these two helpers are what every screen unfolds it with, so the
 * edge cases live here rather than being re-argued in each caller's suite.
 */

function session(overrides: Partial<TimerSession> = {}): TimerSession {
  return {
    id: 1,
    todoId: null,
    eventId: null,
    sessionType: "WORK",
    startedAt: new Date("2026-09-01T09:00:00.000Z"),
    completedAt: new Date("2026-09-01T09:25:00.000Z"),
    duration: 1500,
    completed: true,
    label: null,
    ...overrides,
  };
}

describe("sessionTargetId", () => {
  it("returns the todo id when the session names a todo", () => {
    expect(sessionTargetId(session({ todoId: "task-1" }))).toBe("task-1");
  });

  it("returns the event id when the session names an event", () => {
    expect(sessionTargetId(session({ eventId: "event-1" }))).toBe("event-1");
  });

  it("returns null for free measurement (#1116 — neither column set)", () => {
    expect(sessionTargetId(session())).toBeNull();
  });

  /*
   * An empty string is not an attribution. The aggregation treats "no target"
   * and "a target that is not live" completely differently — the first is
   * untagged work, the second is dropped — so a falsy id has to collapse to
   * null here rather than reaching the live-set lookup and missing it.
   */
  it("treats an empty-string id as no target at all", () => {
    expect(sessionTargetId(session({ todoId: "" }))).toBeNull();
    expect(sessionTargetId(session({ todoId: "", eventId: "" }))).toBeNull();
  });

  /*
   * `eventId` is optional on the domain type so the session literals already
   * spread across the suites keep compiling. A row that predates 0029 arrives
   * with the field simply absent, and that must read as "no event".
   */
  it("tolerates a session with no eventId field at all", () => {
    const legacy = { ...session({ todoId: "task-1" }) } as TimerSession;
    delete (legacy as { eventId?: string | null }).eventId;
    expect(sessionTargetId(legacy)).toBe("task-1");
  });
});

describe("totalWorkMinutesForItem", () => {
  it("sums WORK minutes logged against one item", () => {
    const minutes = totalWorkMinutesForItem(
      [
        session({ id: 1, eventId: "event-1", duration: 1500 }), // 25 min
        session({ id: 2, eventId: "event-1", duration: 900 }), // 15 min
      ],
      "event-1",
    );
    expect(minutes).toBeCloseTo(40);
  });

  it("ignores sessions belonging to another item", () => {
    const minutes = totalWorkMinutesForItem(
      [
        session({ id: 1, eventId: "event-1", duration: 1500 }),
        session({ id: 2, eventId: "event-2", duration: 1500 }),
        session({ id: 3, todoId: "task-1", duration: 1500 }),
      ],
      "event-1",
    );
    expect(minutes).toBeCloseTo(25);
  });

  // A break taken during an event is not time spent ON the event, and a
  // session still running has no duration to add yet.
  it("ignores breaks and still-open sessions", () => {
    const minutes = totalWorkMinutesForItem(
      [
        session({
          id: 1,
          eventId: "event-1",
          duration: 600,
          sessionType: "BREAK",
        }),
        session({
          id: 2,
          eventId: "event-1",
          duration: null,
          completed: false,
        }),
        session({ id: 3, eventId: "event-1", duration: 600 }),
      ],
      "event-1",
    );
    expect(minutes).toBeCloseTo(10);
  });

  it("returns 0 when nothing was ever logged against the item", () => {
    expect(totalWorkMinutesForItem([], "event-1")).toBe(0);
  });

  // Fractions survive: the caller rounds for display, and rounding per session
  // would make a list of items add up to less than the total actually logged.
  it("keeps fractional minutes", () => {
    const minutes = totalWorkMinutesForItem(
      [session({ eventId: "event-1", duration: 90 })],
      "event-1",
    );
    expect(minutes).toBeCloseTo(1.5);
  });
});

/*
 * #1475 — start → pause → reset leaves a seconds-long unfinished row behind
 * (pause closes it; reset has nothing left to withdraw). Two of those showed up
 * in the user's analytics as a Todo with logged time and as two sessions in the
 * weekly comparison. This predicate is the single place that decides a row is
 * a scrap rather than work, so the boundary cases live here.
 */
describe("isCountedSession", () => {
  it("drops a seconds-long session that never completed", () => {
    expect(isCountedSession(session({ duration: 12, completed: false }))).toBe(
      false,
    );
  });

  /*
   * The distinction that rules out "just exclude every unfinished row": being
   * interrupted 20 minutes into a phase is the ordinary way a phase ends, and
   * that time was worked.
   */
  it("keeps a long session the user paused and never resumed", () => {
    expect(
      isCountedSession(session({ duration: 20 * 60, completed: false })),
    ).toBe(true);
  });

  it("keeps a short session that ran to its target", () => {
    expect(isCountedSession(session({ duration: 30, completed: true }))).toBe(
      true,
    );
  });

  it("counts an unfinished session exactly at the threshold", () => {
    expect(
      isCountedSession(
        session({ duration: ABANDONED_SESSION_SECONDS, completed: false }),
      ),
    ).toBe(true);
    expect(
      isCountedSession(
        session({ duration: ABANDONED_SESSION_SECONDS - 1, completed: false }),
      ),
    ).toBe(false);
  });

  it("drops a row with no duration yet and a row closed at zero", () => {
    expect(isCountedSession(session({ duration: null }))).toBe(false);
    expect(isCountedSession(session({ duration: 0 }))).toBe(false);
  });

  it("keeps the scrap out of an item's logged minutes", () => {
    const minutes = totalWorkMinutesForItem(
      [
        session({ id: 1, todoId: "task-1", duration: 600 }),
        session({ id: 2, todoId: "task-1", duration: 12, completed: false }),
      ],
      "task-1",
    );
    expect(minutes).toBeCloseTo(10);
  });
});

/*
 * #1666 — which day the Work sidebar's history tab shows. Local-time dates
 * (new Date(y, m, d, h)) on purpose: the helper keys days by the LOCAL
 * calendar, and a UTC literal would move the day on a machine east of UTC.
 */
describe("pickWorkHistoryDay", () => {
  const at = (day: number, hour: number) => new Date(2026, 8, day, hour, 0, 0);

  it("returns today's counted WORK sessions, oldest first", () => {
    const day = pickWorkHistoryDay(
      [
        session({ id: 2, startedAt: at(17, 14) }),
        session({ id: 1, startedAt: at(17, 9) }),
        session({ id: 3, startedAt: at(17, 10), sessionType: "BREAK" }),
        session({
          id: 4,
          startedAt: at(17, 11),
          duration: 12,
          completed: false,
        }),
        session({ id: 5, startedAt: at(16, 9) }),
      ],
      "2026-09-17",
    );
    expect(day?.dateKey).toBe("2026-09-17");
    expect(day?.sessions.map((s) => s.id)).toEqual([1, 2]);
  });

  it("falls back to the most recent worked day when today is empty", () => {
    const day = pickWorkHistoryDay(
      [
        session({ id: 1, startedAt: at(12, 9) }),
        session({ id: 2, startedAt: at(15, 9) }),
        // Only a break today — not work, so today still reads as empty.
        session({ id: 3, startedAt: at(17, 9), sessionType: "BREAK" }),
      ],
      "2026-09-17",
    );
    expect(day?.dateKey).toBe("2026-09-15");
    expect(day?.sessions.map((s) => s.id)).toEqual([2]);
  });

  it("prefers a past day over one after today (clock skew)", () => {
    const day = pickWorkHistoryDay(
      [
        session({ id: 1, startedAt: at(20, 9) }),
        session({ id: 2, startedAt: at(10, 9) }),
      ],
      "2026-09-17",
    );
    expect(day?.dateKey).toBe("2026-09-10");
  });

  it("returns null when nothing has been worked", () => {
    expect(pickWorkHistoryDay([], "2026-09-17")).toBeNull();
    expect(
      pickWorkHistoryDay([session({ duration: null })], "2026-09-17"),
    ).toBeNull();
  });
});

/*
 * #1665 — the Schedule slot a free session is filed under. Local-time dates
 * for the same reason as above: the day and the clock times are the user's,
 * not UTC's.
 */
describe("freeSessionSlot", () => {
  const at = (day: number, hour: number, minute = 0, second = 0) =>
    new Date(2026, 8, day, hour, minute, second);

  it("uses the start day and the clock times that were worked", () => {
    expect(freeSessionSlot(at(17, 9), at(17, 9, 25))).toEqual({
      date: "2026-09-17",
      startTime: "09:00",
      endTime: "09:25",
    });
  });

  // An Event's end is a time on the same day, so a session that ran past
  // midnight has to stop at the end of the day it began on — the alternative
  // is a row whose end is before its start.
  it("clamps a session that crossed midnight to 23:59", () => {
    expect(freeSessionSlot(at(17, 23, 40), at(18, 0, 10))).toEqual({
      date: "2026-09-17",
      startTime: "23:40",
      endTime: "23:59",
    });
  });

  // A phase shorter than the minute grid still counts when it ran to its
  // target, and a zero-length range is not something the calendar can draw.
  it("widens a sub-minute session to one minute", () => {
    expect(freeSessionSlot(at(17, 9, 0, 10), at(17, 9, 0, 50))).toEqual({
      date: "2026-09-17",
      startTime: "09:00",
      endTime: "09:01",
    });
  });

  it("keeps the range inside the day at the very end of it", () => {
    expect(freeSessionSlot(at(17, 23, 59, 5), at(17, 23, 59, 50))).toEqual({
      date: "2026-09-17",
      startTime: "23:58",
      endTime: "23:59",
    });
  });
});
