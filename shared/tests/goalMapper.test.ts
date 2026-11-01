// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import {
  assertGoalParentKind,
  goalCreateToRows,
  goalUpdatesToPatches,
  rowsToGoal,
  type GoalsPayloadRow,
  type ItemsMetaGoalRow,
} from "../src/services/goalMapper";

/*
 * goalMapper (#2103) — the 2-row split of a goal (0034) and the two rules the
 * DB leaves to the app: the period key's real shape (a week is a Sunday) and
 * the parent order year → month → week. The DB-Q2 bump is asserted on the
 * payload-only patches, which are the ones that would otherwise skip it.
 */

const NOW = "2026-10-06T09:00:00.000Z";

const meta: ItemsMetaGoalRow = {
  id: "goal-1",
  user_id: "u1",
  role: "goal",
  title: "Run 3 times a week",
  is_deleted: false,
  deleted_at: null,
  created_at: "2026-10-04T00:00:00.000Z",
  updated_at: "2026-10-05T00:00:00.000Z",
};

const payload: GoalsPayloadRow = {
  item_id: "goal-1",
  user_id: "u1",
  period_kind: "week",
  period_key: "2026-10-04",
  sort_order: 2,
  parent_goal_id: "goal-m",
  manual_achieved_at: null,
  period_end_decision: "carried",
  decided_at: "2026-10-10T20:00:00.000Z",
  carried_from_goal_id: "goal-0",
  legacy_key: "week:2026-10-04:0",
};

describe("rowsToGoal", () => {
  it("joins the two rows into one Goal", () => {
    expect(rowsToGoal(meta, payload)).toEqual({
      id: "goal-1",
      title: "Run 3 times a week",
      periodKind: "week",
      periodKey: "2026-10-04",
      sortOrder: 2,
      parentGoalId: "goal-m",
      manualAchievedAt: null,
      periodEndDecision: "carried",
      decidedAt: "2026-10-10T20:00:00.000Z",
      carriedFromGoalId: "goal-0",
      legacyKey: "week:2026-10-04:0",
      // A row read before 0044 has neither column (#2366).
      startDate: null,
      endDate: null,
      isDeleted: false,
      createdAt: "2026-10-04T00:00:00.000Z",
      updatedAt: "2026-10-05T00:00:00.000Z",
    });
  });

  it("refuses a pair that is not the same goal", () => {
    expect(() => rowsToGoal(meta, { ...payload, item_id: "goal-2" })).toThrow(
      /row mismatch/,
    );
    expect(() =>
      rowsToGoal({ ...meta, role: "task" as "goal" }, payload),
    ).toThrow(/expected "goal"/);
  });
});

describe("goalCreateToRows", () => {
  it("builds a role=goal meta row and an empty-state payload", () => {
    const { meta: m, payload: p } = goalCreateToRows(
      {
        id: "goal-9",
        title: "Ship goals",
        periodKind: "month",
        periodKey: "2026-10",
      },
      "u1",
    );
    expect(m).toEqual({
      id: "goal-9",
      user_id: "u1",
      role: "goal",
      title: "Ship goals",
      is_deleted: false,
      deleted_at: null,
    });
    expect(p).toMatchObject({
      item_id: "goal-9",
      period_kind: "month",
      period_key: "2026-10",
      sort_order: 0,
      parent_goal_id: null,
      manual_achieved_at: null,
      period_end_decision: null,
      decided_at: null,
    });
  });

  it.each([
    ["week", "2026-10-05"], // a Monday
    ["week", "2026-02-31"],
    ["month", "2026-13"],
    ["year", "26"],
  ] as const)("rejects a %s key %s", (kind, key) => {
    expect(() =>
      goalCreateToRows(
        { id: "g", title: "t", periodKind: kind, periodKey: key },
        "u1",
      ),
    ).toThrow(/period key/);
  });
});

describe("a goal's own date range (#2366)", () => {
  it("reads the 0044 columns", () => {
    const goal = rowsToGoal(meta, {
      ...payload,
      start_date: "2026-10-04",
      end_date: "2026-10-20",
    });
    expect(goal).toMatchObject({
      startDate: "2026-10-04",
      endDate: "2026-10-20",
    });
  });

  it("writes the range only when one is given", () => {
    const base = {
      id: "g",
      title: "t",
      periodKind: "week" as const,
      periodKey: "2026-10-04",
    };
    expect(goalCreateToRows(base, "u1").payload).not.toHaveProperty(
      "start_date",
    );
    expect(
      goalCreateToRows(
        { ...base, startDate: "2026-10-04", endDate: "2026-10-20" },
        "u1",
      ).payload,
    ).toMatchObject({ start_date: "2026-10-04", end_date: "2026-10-20" });
  });

  it("refuses half a range and one that runs backwards", () => {
    const base = {
      id: "g",
      title: "t",
      periodKind: "week" as const,
      periodKey: "2026-10-04",
    };
    expect(() =>
      goalCreateToRows({ ...base, startDate: "2026-10-04" }, "u1"),
    ).toThrow(/both a start and an end/);
    expect(() =>
      goalCreateToRows(
        { ...base, startDate: "2026-10-20", endDate: "2026-10-04" },
        "u1",
      ),
    ).toThrow(/before it starts/);
  });

  it("moves the range as a pair and still bumps the meta row", () => {
    const { metaPatch, payloadPatch } = goalUpdatesToPatches(
      { startDate: "2026-10-04", endDate: "2026-10-20" },
      "2026-10-05T00:00:00.000Z",
    );
    expect(metaPatch).toEqual({ updated_at: "2026-10-05T00:00:00.000Z" });
    expect(payloadPatch).toEqual({
      start_date: "2026-10-04",
      end_date: "2026-10-20",
    });
    expect(
      goalUpdatesToPatches({ startDate: null, endDate: null }, "x")
        .payloadPatch,
    ).toEqual({ start_date: null, end_date: null });
  });
});

describe("goalUpdatesToPatches", () => {
  it("bumps items_meta.updated_at on a payload-only patch (DB-Q2)", () => {
    const { metaPatch, payloadPatch } = goalUpdatesToPatches(
      { sortOrder: 1 },
      NOW,
    );
    expect(metaPatch).toEqual({ updated_at: NOW });
    expect(payloadPatch).toEqual({ sort_order: 1 });
  });

  it("puts the title on items_meta, not on the payload", () => {
    const { metaPatch, payloadPatch } = goalUpdatesToPatches(
      { title: "New" },
      NOW,
    );
    expect(metaPatch).toEqual({ updated_at: NOW, title: "New" });
    expect(payloadPatch).toEqual({});
  });

  it("stamps decided_at with the decision and clears it with it", () => {
    expect(
      goalUpdatesToPatches({ periodEndDecision: "achieved" }, NOW).payloadPatch,
    ).toEqual({ period_end_decision: "achieved", decided_at: NOW });
    expect(
      goalUpdatesToPatches({ periodEndDecision: null }, NOW).payloadPatch,
    ).toEqual({ period_end_decision: null, decided_at: null });
  });

  it("writes an explicit null for a cleared parent / hand mark", () => {
    expect(
      goalUpdatesToPatches({ parentGoalId: null, manualAchievedAt: null }, NOW)
        .payloadPatch,
    ).toEqual({ parent_goal_id: null, manual_achieved_at: null });
  });

  it("treats an undefined value as not mentioned, not as a clear", () => {
    expect(
      goalUpdatesToPatches(
        {
          parentGoalId: undefined,
          manualAchievedAt: undefined,
          periodEndDecision: undefined,
        },
        NOW,
      ),
    ).toEqual({ metaPatch: { updated_at: NOW }, payloadPatch: {} });
  });
});

describe("assertGoalParentKind", () => {
  it("allows only one level up", () => {
    expect(() => assertGoalParentKind("t", "week", "month")).not.toThrow();
    expect(() => assertGoalParentKind("t", "month", "year")).not.toThrow();
    expect(() => assertGoalParentKind("t", "week", "year")).toThrow(
      /expected month/,
    );
    expect(() => assertGoalParentKind("t", "year", "year")).toThrow(
      /has no parent/,
    );
  });
});
