// @vitest-environment node (#1079 — the decision is pure, no DOM)
import { describe, it, expect } from "vitest";
import type { ScheduleItem } from "../src/types/schedule";
import {
  dueReminders,
  reminderDueAt,
  reminderKey,
} from "../src/utils/reminderSchedule";

/*
 * #1374 — which event reminders are due, as facts.
 *
 * This is the whole reminder decision: the host's sweep only toasts what comes
 * out of here. Two of the DoD's clauses live entirely in this file — no
 * duplicate across a re-render or a re-sync (the fired set), and what happens
 * to a reminder that came due while the app was closed (the start-time bound).
 *
 * TZ is pinned to Asia/Tokyo in vitest.config.ts, and `dateFromKey` builds
 * LOCAL dates, so the instants below are local wall-clock.
 */

const NO_FIRED = new Set<string>();

function event(over: Partial<ScheduleItem> & { id: string }): ScheduleItem {
  return {
    date: "2026-08-12",
    title: over.id,
    startTime: "10:00",
    endTime: "11:00",
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    reminderOffset: 10,
    ...over,
  };
}

/** Local wall-clock helper — the same frame `dateFromKey` builds in. */
const at = (h: number, m: number, day = 12) =>
  new Date(2026, 7, day, h, m, 0, 0);

describe("reminderDueAt", () => {
  it("is the start minus the offset", () => {
    expect(reminderDueAt(event({ id: "e" }))).toBe(at(9, 50).getTime());
  });

  it("is null for the rows that cannot carry one", () => {
    expect(reminderDueAt(event({ id: "a", reminderOffset: null }))).toBeNull();
    expect(
      reminderDueAt(event({ id: "b", reminderOffset: undefined })),
    ).toBeNull();
    // No clock time to lead.
    expect(reminderDueAt(event({ id: "c", isAllDay: true }))).toBeNull();
    expect(reminderDueAt(event({ id: "d", startTime: "" }))).toBeNull();
    expect(reminderDueAt(event({ id: "e2", isDeleted: true }))).toBeNull();
    expect(reminderDueAt(event({ id: "f", isDismissed: true }))).toBeNull();
  });
});

describe("dueReminders", () => {
  it("says nothing before the due instant", () => {
    expect(dueReminders([event({ id: "e" })], at(9, 49), NO_FIRED)).toEqual([]);
  });

  it("fires exactly once at the due instant", () => {
    const out = dueReminders([event({ id: "e" })], at(9, 50), NO_FIRED);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "e", startTime: "10:00" });
  });

  it("says nothing when the key has already fired (re-render / re-sync)", () => {
    const first = dueReminders([event({ id: "e" })], at(9, 50), NO_FIRED);
    const fired = new Set(first.map((r) => r.key));
    // The same rows arriving again from a Realtime bump must be a no-op.
    expect(dueReminders([event({ id: "e" })], at(9, 51), fired)).toEqual([]);
  });

  it("still fires for a reminder missed while the app was closed", () => {
    // Due at 09:50, opened at 09:58, the event has not started: this is the
    // catch-up the DoD asks for.
    expect(
      dueReminders([event({ id: "e" })], at(9, 58), NO_FIRED),
    ).toHaveLength(1);
  });

  it("goes quiet once the event has started", () => {
    // "It is about to start" cannot be true at 10:05, and the Schedule screen
    // is already showing it. Silence rather than a stale toast.
    expect(dueReminders([event({ id: "e" })], at(10, 5), NO_FIRED)).toEqual([]);
  });

  it("resolves a due instant that falls on the previous day", () => {
    // 00:20 tomorrow with a 30-minute lead is due at 23:50 today — the case a
    // same-day filter gets wrong.
    const item = event({
      id: "late",
      date: "2026-08-13",
      startTime: "00:20",
      endTime: "01:00",
      reminderOffset: 30,
    });
    expect(dueReminders([item], at(23, 50), NO_FIRED)).toHaveLength(1);
    expect(dueReminders([item], at(23, 49), NO_FIRED)).toEqual([]);
  });

  it("skips the rows reminderDueAt rejects", () => {
    const items = [
      event({ id: "allday", isAllDay: true }),
      event({ id: "none", reminderOffset: null }),
      event({ id: "gone", isDeleted: true }),
      event({ id: "skipped", isDismissed: true }),
    ];
    expect(dueReminders(items, at(9, 50), NO_FIRED)).toEqual([]);
  });
});

describe("the dedupe key", () => {
  it("is stable for the same row and the same instant", () => {
    const a = dueReminders([event({ id: "e" })], at(9, 50), NO_FIRED)[0].key;
    const b = dueReminders([event({ id: "e" })], at(9, 55), NO_FIRED)[0].key;
    expect(a).toBe(b);
  });

  it("changes when the event moves or the lead time changes", () => {
    // Correct rather than unfortunate: that IS a different instant to be
    // reminded about, so it deserves its own notification.
    const base = dueReminders([event({ id: "e" })], at(9, 50), NO_FIRED)[0].key;
    const moved = dueReminders(
      [event({ id: "e", startTime: "10:30", endTime: "11:30" })],
      at(10, 20),
      NO_FIRED,
    )[0].key;
    const relead = dueReminders(
      [event({ id: "e", reminderOffset: 30 })],
      at(9, 30),
      NO_FIRED,
    )[0].key;
    expect(moved).not.toBe(base);
    expect(relead).not.toBe(base);
  });

  it("names the row and the instant", () => {
    expect(reminderKey("e", 1234)).toBe("e@1234");
  });
});
