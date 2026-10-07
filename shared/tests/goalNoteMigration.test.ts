import { describe, it, expect } from "vitest";
import {
  GOALS_PER_PERIOD_LIMIT,
  currentNoteGoalLines,
  noteGoalLegacyKey,
  planNoteGoalMigration,
  type ExistingGoal,
} from "../src/components/briefing/goalNoteMigration";

/*
 * #2105 — which lines of the goals note become goals. The I/O and the toast
 * are the web hook's (web/tests/briefingGoalNoteMigration.test.tsx); this
 * suite pins the decision alone.
 *
 * 2026-10-06 is a Tuesday, so its week (Sunday start, D-20260816-briefing-1)
 * is the one keyed 2026-10-04.
 */

const TODAY = "2026-10-06";
const WEEK = "2026-10-04";

function head(text: string) {
  return {
    type: "heading",
    attrs: { level: 2 },
    content: [{ type: "text", text }],
  };
}
function line(text: string) {
  return { type: "paragraph", content: [{ type: "text", text }] };
}
function doc(...nodes: unknown[]): string {
  return JSON.stringify({ type: "doc", content: nodes });
}

function goal(over: Partial<ExistingGoal>): ExistingGoal {
  return {
    periodKind: "week",
    periodKey: WEEK,
    sortOrder: 0,
    legacyKey: null,
    ...over,
  };
}

describe("planNoteGoalMigration", () => {
  it("turns each current-period line into one goal, in order", () => {
    const note = doc(
      head(`週目標 ${WEEK}`),
      line("Ship the block"),
      line("Run twice"),
      head("月目標 2026-10"),
      line("Read one book"),
      head("年目標 2026"),
      line("Live by it"),
    );
    const plans = planNoteGoalMigration(note, TODAY, []);
    expect(plans.map((p) => p.period)).toEqual(["week", "month", "year"]);
    expect(plans[0]?.creates).toEqual([
      {
        title: "Ship the block",
        periodKind: "week",
        periodKey: WEEK,
        sortOrder: 0,
        legacyKey: noteGoalLegacyKey("week", WEEK, 0),
      },
      {
        title: "Run twice",
        periodKind: "week",
        periodKey: WEEK,
        sortOrder: 1,
        legacyKey: noteGoalLegacyKey("week", WEEK, 1),
      },
    ]);
    expect(plans[1]?.creates[0]?.periodKey).toBe("2026-10");
    expect(plans[2]?.creates[0]?.periodKey).toBe("2026");
    expect(plans.every((p) => p.leftInNote === 0)).toBe(true);
  });

  it("moves at most three lines of a period and counts the rest", () => {
    const note = doc(
      head(`週目標 ${WEEK}`),
      ...["a", "b", "c", "d", "e"].map(line),
    );
    const [plan] = planNoteGoalMigration(note, TODAY, []);
    expect(plan?.creates.map((c) => c.title)).toEqual(["a", "b", "c"]);
    expect(plan?.creates).toHaveLength(GOALS_PER_PERIOD_LIMIT);
    expect(plan?.leftInNote).toBe(2);
  });

  it("leaves past periods' sections alone", () => {
    const note = doc(
      head(`週目標 ${WEEK}`),
      line("This week"),
      head("週目標 2026-09-27"),
      line("Last week"),
      head("月目標 2026-09"),
      line("Last month"),
    );
    const plans = planNoteGoalMigration(note, TODAY, []);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.creates.map((c) => c.title)).toEqual(["This week"]);
  });

  it("reads a pre-#957 bare heading as the current period, like the paper does", () => {
    const note = doc(head("週目標"), line("Old shape"));
    expect(currentNoteGoalLines(note, TODAY).week).toEqual(["Old shape"]);
    expect(
      planNoteGoalMigration(note, TODAY, [])[0]?.creates[0]?.periodKey,
    ).toBe(WEEK);
  });

  it("plans only the lines of a section that are not on a live goal yet", () => {
    // A run that stopped after the first line (a failed create) finishes the
    // period on the next open instead of skipping it.
    const note = doc(head(`週目標 ${WEEK}`), line("a"), line("b"), line("c"));
    const existing = [goal({ legacyKey: noteGoalLegacyKey("week", WEEK, 0) })];
    const [plan] = planNoteGoalMigration(note, TODAY, existing);
    expect(
      plan?.creates.map((c) => [c.title, c.sortOrder, c.legacyKey]),
    ).toEqual([
      ["b", 1, noteGoalLegacyKey("week", WEEK, 1)],
      ["c", 2, noteGoalLegacyKey("week", WEEK, 2)],
    ]);
    expect(plan?.leftInNote).toBe(0);
  });

  it("plans nothing once every line of a section is on a live goal", () => {
    const note = doc(head(`週目標 ${WEEK}`), line("a"), line("b"));
    const existing = [0, 1].map((i) =>
      goal({ sortOrder: i, legacyKey: noteGoalLegacyKey("week", WEEK, i) }),
    );
    expect(planNoteGoalMigration(note, TODAY, existing)).toEqual([]);
  });

  it("never moves a line past the third, even when a goal slot opens", () => {
    // Line 2's goal was trashed, so the period has room again. Line 2 is
    // planned (the DB refuses the trashed key); line 3 stays in the note.
    const note = doc(head(`週目標 ${WEEK}`), ...["a", "b", "c", "d"].map(line));
    const existing = [0, 1].map((i) =>
      goal({ sortOrder: i, legacyKey: noteGoalLegacyKey("week", WEEK, i) }),
    );
    const [plan] = planNoteGoalMigration(note, TODAY, existing);
    expect(plan?.creates.map((c) => c.title)).toEqual(["c"]);
    expect(plan?.leftInNote).toBe(1);
  });

  it("counts goals made elsewhere against the limit and orders after them", () => {
    const note = doc(head(`週目標 ${WEEK}`), line("a"), line("b"), line("c"));
    const existing = [goal({ sortOrder: 4 }), goal({ sortOrder: 2 })];
    const [plan] = planNoteGoalMigration(note, TODAY, existing);
    expect(plan?.creates.map((c) => [c.title, c.sortOrder])).toEqual([
      ["a", 5],
    ]);
    expect(plan?.leftInNote).toBe(2);
  });

  it("moves nothing and reports nothing for a period that is already full (no durable place to remember the notice)", () => {
    const note = doc(head(`週目標 ${WEEK}`), line("a"));
    const existing = [goal({}), goal({}), goal({})];
    expect(planNoteGoalMigration(note, TODAY, existing)).toEqual([]);
  });

  it("ignores goals of other periods when counting", () => {
    const note = doc(head(`週目標 ${WEEK}`), line("a"));
    const existing = [
      goal({ periodKey: "2026-09-27" }),
      goal({ periodKind: "month", periodKey: "2026-10" }),
    ];
    expect(
      planNoteGoalMigration(note, TODAY, existing)[0]?.creates,
    ).toHaveLength(1);
  });

  it("returns nothing for a missing or empty note", () => {
    expect(planNoteGoalMigration(null, TODAY, [])).toEqual([]);
    expect(
      planNoteGoalMigration(doc(head(`週目標 ${WEEK}`)), TODAY, []),
    ).toEqual([]);
  });
});
