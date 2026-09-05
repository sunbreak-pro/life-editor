// @vitest-environment node (this suite touches no DOM)
import { describe, it, expect } from "vitest";
import type { TimerSession } from "../src/types/timer";
import {
  ABANDONED_SESSION_SECONDS,
  isCountedSession,
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
        session({ id: 2, eventId: "event-1", duration: null, completed: false }),
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
