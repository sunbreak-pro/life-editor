// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import {
  shouldRoutineRunOnDate,
  seedFrequencyPatch,
} from "../src/utils/routineFrequency";
import {
  shouldCreateRoutineItem,
  diffRoutineScheduleItems,
  collectRoutineItemsForDates,
} from "../src/utils/routineScheduleSync";
import type { FrequencyType, RoutineNode } from "../src/types/routine";
import type { ScheduleItem } from "../src/types/schedule";

/*
 * S4-5 generator pure-function parity. These pin the verbatim port of
 * frontend/src/utils/routineScheduleSync.ts + routineFrequency.ts so a
 * future edit that changes a decision (esp. the Issue 017 reject order
 * or the local-date — no-UTC — invariant) fails loudly. The logic is
 * NOT re-implemented here; the cases assert the contract the frontend
 * already ships, so a divergence between the two trees is caught.
 */

function makeRoutine(over: Partial<RoutineNode>): RoutineNode {
  return {
    id: "routine-1",
    title: "R",
    startTime: null,
    endTime: null,
    isArchived: false,
    isVisible: true,
    isDeleted: false,
    deletedAt: null,
    order: 0,
    frequencyType: "daily",
    frequencyDays: [],
    frequencyInterval: null,
    frequencyStartDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function makeItem(over: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: "si-1",
    date: "2026-05-17",
    title: "R",
    startTime: "09:00",
    endTime: "09:30",
    completed: false,
    completedAt: null,
    routineId: "routine-1",
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    isDeleted: false,
    deletedAt: null,
    isDismissed: false,
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z",
    ...over,
  };
}

describe("shouldRoutineRunOnDate (frequency parity)", () => {
  it("daily always true", () => {
    expect(shouldRoutineRunOnDate("daily", [], null, null, "2026-05-17")).toBe(
      true,
    );
  });

  it("weekdays matches local getDay (no UTC shift)", () => {
    // 2026-05-17 is a Sunday (getDay()===0) in local time. Parsing as
    // `new Date(d+"T00:00:00")` keeps it local — a UTC parse could roll
    // to Saturday for negative-offset zones; this asserts the invariant.
    expect(
      shouldRoutineRunOnDate("weekdays", [0], null, null, "2026-05-17"),
    ).toBe(true);
    expect(
      shouldRoutineRunOnDate("weekdays", [1], null, null, "2026-05-17"),
    ).toBe(false);
  });

  it("interval: every N days from start, inclusive of start", () => {
    expect(
      shouldRoutineRunOnDate("interval", [], 3, "2026-05-17", "2026-05-17"),
    ).toBe(true);
    expect(
      shouldRoutineRunOnDate("interval", [], 3, "2026-05-17", "2026-05-20"),
    ).toBe(true);
    expect(
      shouldRoutineRunOnDate("interval", [], 3, "2026-05-17", "2026-05-19"),
    ).toBe(false);
    // before start → false
    expect(
      shouldRoutineRunOnDate("interval", [], 3, "2026-05-17", "2026-05-14"),
    ).toBe(false);
  });

  it("interval with no/invalid interval or no start fails CLOSED (#407)", () => {
    // Pre-#407 both guards degraded to true ("fires every day"), so a
    // routine stranded with a bare interval type — e.g. the losing twin of
    // a double Event→Repeats conversion — minted a schedule row every
    // single day. Malformed config must never fire: same runaway-creation
    // defence as the unknown-frequency default branch.
    expect(
      shouldRoutineRunOnDate("interval", [], null, "2026-05-17", "2026-05-19"),
    ).toBe(false);
    expect(
      shouldRoutineRunOnDate("interval", [], 0, "2026-05-17", "2026-05-19"),
    ).toBe(false);
    expect(
      shouldRoutineRunOnDate("interval", [], -2, "2026-05-17", "2026-05-19"),
    ).toBe(false);
    expect(shouldRoutineRunOnDate("interval", [], 3, null, "2026-05-19")).toBe(
      false,
    );
    // The empty string an editor's cleared date input emits is "no start".
    expect(shouldRoutineRunOnDate("interval", [], 3, "", "2026-05-19")).toBe(
      false,
    );
  });

  it("unknown frequency → false (runaway-creation guard)", () => {
    // The retired "group" type (#352) can still arrive from the DB — the
    // 0008 CHECK outlives the removed code. It must never fire.
    expect(
      shouldRoutineRunOnDate(
        "group" as unknown as FrequencyType,
        [],
        null,
        null,
        "2026-05-17",
      ),
    ).toBe(false);
  });
});

describe("seedFrequencyPatch (#352 — bare type switches)", () => {
  // 2026-05-17 is a Sunday (getDay() === 0).
  const SUNDAY = "2026-05-17";
  const current = {
    frequencyDays: [] as number[],
    frequencyInterval: null,
    frequencyStartDate: null,
  };

  it("gives a weekdays switch the anchor's own weekday (else it fires NEVER)", () => {
    // The segmented control sends the type alone. Unseeded, weekdays with an
    // empty day set matches no date at all — and since #352 the reconcile
    // acts on that immediately, sweeping the series' future.
    expect(
      seedFrequencyPatch({ frequencyType: "weekdays" }, current, SUNDAY),
    ).toEqual({ frequencyType: "weekdays", frequencyDays: [0] });
  });

  it("gives an interval switch a concrete interval + start (else it fires NEVER)", () => {
    // Unseeded, the interval guards in shouldRoutineRunOnDate fail closed
    // (#407), so one click would read as "fires never" and the reconcile
    // wired to this patch (#352) would sweep the series' future.
    expect(
      seedFrequencyPatch({ frequencyType: "interval" }, current, SUNDAY),
    ).toEqual({
      frequencyType: "interval",
      frequencyInterval: 1,
      frequencyStartDate: SUNDAY,
    });
  });

  it("never overwrites what the caller or the routine already set", () => {
    expect(
      seedFrequencyPatch(
        { frequencyType: "weekdays", frequencyDays: [2] },
        current,
        SUNDAY,
      ),
    ).toEqual({ frequencyType: "weekdays", frequencyDays: [2] });
    expect(
      seedFrequencyPatch(
        { frequencyType: "interval" },
        {
          frequencyDays: [],
          frequencyInterval: 3,
          frequencyStartDate: "2026-05-01",
        },
        SUNDAY,
      ),
    ).toEqual({ frequencyType: "interval" });
    expect(
      seedFrequencyPatch(
        { frequencyType: "weekdays" },
        { ...current, frequencyDays: [1, 5] },
        SUNDAY,
      ),
    ).toEqual({ frequencyType: "weekdays" });
  });

  it("leaves a patch without a type switch alone (clearing every weekday is the user's choice)", () => {
    const patch = { frequencyDays: [] };
    expect(
      seedFrequencyPatch(patch, { ...current, frequencyDays: [1] }, SUNDAY),
    ).toBe(patch);
  });

  it("repairs a non-positive interval", () => {
    expect(
      seedFrequencyPatch(
        { frequencyType: "interval" },
        { ...current, frequencyInterval: 0, frequencyStartDate: SUNDAY },
        SUNDAY,
      ),
    ).toEqual({ frequencyType: "interval", frequencyInterval: 1 });
  });

  it("repairs an empty-string start date (#407 — cleared date input legacy)", () => {
    // "" is what a cleared <input type=date> used to persist. Under the
    // fail-closed guard it reads as "fires never", so a type switch that
    // inherits it must re-seed from the anchor.
    expect(
      seedFrequencyPatch(
        { frequencyType: "interval" },
        { ...current, frequencyInterval: 3, frequencyStartDate: "" },
        SUNDAY,
      ),
    ).toEqual({ frequencyType: "interval", frequencyStartDate: SUNDAY });
  });

  it("daily needs no seeding", () => {
    expect(
      seedFrequencyPatch({ frequencyType: "daily" }, current, SUNDAY),
    ).toEqual({
      frequencyType: "daily",
    });
  });
});

describe("shouldCreateRoutineItem (Issue 017 reject order)", () => {
  it("isDeleted short-circuits before anything else", () => {
    const r = makeRoutine({ isDeleted: true, frequencyType: "daily" });
    expect(shouldCreateRoutineItem(r, "2026-05-17")).toBe(false);
  });

  it("archived or invisible → false", () => {
    expect(
      shouldCreateRoutineItem(makeRoutine({ isArchived: true }), "2026-05-17"),
    ).toBe(false);
    expect(
      shouldCreateRoutineItem(makeRoutine({ isVisible: false }), "2026-05-17"),
    ).toBe(false);
  });

  it("a retired group-typed row (DB legacy) never fires", () => {
    const r = makeRoutine({
      frequencyType: "group" as unknown as FrequencyType,
    });
    expect(shouldCreateRoutineItem(r, "2026-05-17")).toBe(false);
  });
});

describe("diffRoutineScheduleItems", () => {
  it("creates a row when none exists for a matching routine", () => {
    const { toCreate } = diffRoutineScheduleItems(
      [],
      [makeRoutine({ title: "Workout", startTime: "07:00", endTime: "07:45" })],
      "2026-05-17",
    );
    expect(toCreate).toHaveLength(1);
    expect(toCreate[0]).toMatchObject({
      date: "2026-05-17",
      title: "Workout",
      startTime: "07:00",
      endTime: "07:45",
      routineId: "routine-1",
    });
    expect(toCreate[0].id).toMatch(/^si-/);
  });

  it("creation-only: a drifted existing row is left alone (#279 rules 1-2)", () => {
    // Pre-#279 this emitted a toUpdate that rewrote the row back to the
    // template — reverting 「この予定のみ」 edits and done records. The
    // bucket is gone; the row must simply not be re-created either.
    const existing = makeItem({ title: "Old", startTime: "08:00" });
    const { toCreate } = diffRoutineScheduleItems(
      [existing],
      [makeRoutine({ title: "New", startTime: "09:00", endTime: "09:30" })],
      "2026-05-17",
    );
    expect(toCreate).toEqual([]);
  });

  it("no-op when an item already exists for the slot", () => {
    const existing = makeItem({
      title: "R",
      startTime: "09:00",
      endTime: "09:30",
    });
    const { toCreate } = diffRoutineScheduleItems(
      [existing],
      [makeRoutine({})],
      "2026-05-17",
    );
    expect(toCreate).toEqual([]);
  });

  it("does not create for a soft-deleted routine (Issue 017 (b)/(d))", () => {
    const { toCreate } = diffRoutineScheduleItems(
      [],
      [makeRoutine({ isDeleted: true })],
      "2026-05-17",
    );
    expect(toCreate).toEqual([]);
  });
});

describe("collectRoutineItemsForDates", () => {
  it("walks an inclusive local-day range and skips existing pairs", () => {
    const out = collectRoutineItemsForDates(
      new Date("2026-05-17T00:00:00"),
      new Date("2026-05-19T00:00:00"),
      [makeRoutine({ frequencyType: "daily" })],
      new Set(["routine-1:2026-05-18"]),
    );
    const dates = out.map((c) => c.date).sort();
    expect(dates).toEqual(["2026-05-17", "2026-05-19"]);
  });

  it("terminates on a single-day range (no infinite loop)", () => {
    const out = collectRoutineItemsForDates(
      new Date("2026-05-17T00:00:00"),
      new Date("2026-05-17T00:00:00"),
      [makeRoutine({ frequencyType: "daily" })],
    );
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe("2026-05-17");
  });

  it("emits nothing for an end-before-start range (bounded)", () => {
    const out = collectRoutineItemsForDates(
      new Date("2026-05-20T00:00:00"),
      new Date("2026-05-17T00:00:00"),
      [makeRoutine({ frequencyType: "daily" })],
    );
    expect(out).toEqual([]);
  });
});
