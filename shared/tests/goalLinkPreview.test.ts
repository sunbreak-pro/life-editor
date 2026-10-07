import { describe, it, expect } from "vitest";
import {
  applyLinkDraft,
  goalsForTodoPicker,
  linkDraftOf,
  linkedGoalIds,
  lostAchievementIds,
  previewGoalLinkEdit,
} from "../src/components/briefing/goalLinkPreview";
import { SAMPLE_GOALS, goal, sampleState } from "./fixtures/goalLinkState";

/*
 * #2109 — the numbers the linking screens show BEFORE a save. They are
 * judgeGoals run on the state as it is and as it would be, so these cases
 * pin the diff and the ordering, not the achievement rule (that has its own
 * fixture: goalAchievement.json).
 */

describe("previewGoalLinkEdit", () => {
  it("counts a done todo into the goal: 企画書を通す 2/4 → 3/5", () => {
    const changes = previewGoalLinkEdit(sampleState(), {
      link: [{ goalId: "w-plan", todoId: "t-freedone" }],
    });
    expect(changes).toEqual([
      {
        goalId: "w-plan",
        before: { done: 2, total: 4, achieved: false, connected: true },
        after: { done: 3, total: 5, achieved: false, connected: true },
      },
    ]);
  });

  it("takes the achievement off the week AND every parent above it, week first", () => {
    const changes = previewGoalLinkEdit(sampleState(), {
      link: [{ goalId: "w-run", todoId: "t-free" }],
    });
    expect(changes.map((c) => c.goalId)).toEqual(["w-run", "m-run", "y-run"]);
    expect(changes[0]?.after).toEqual({
      done: 2,
      total: 3,
      achieved: false,
      connected: true,
    });
    expect(lostAchievementIds(changes)).toEqual(["w-run", "m-run", "y-run"]);
  });

  it("achieves a goal whose last open todo is unlinked", () => {
    const changes = previewGoalLinkEdit(sampleState(), {
      unlink: [
        { goalId: "w-plan", todoId: "t-plan3" },
        { goalId: "w-plan", todoId: "t-plan4" },
      ],
    });
    const plan = changes.find((c) => c.goalId === "w-plan");
    expect(plan?.after).toEqual({
      done: 2,
      total: 2,
      achieved: true,
      connected: true,
    });
    // Its month is connected only through it, so it follows.
    expect(changes.find((c) => c.goalId === "m-deal")?.after.achieved).toBe(
      true,
    );
    expect(lostAchievementIds(changes)).toEqual([]);
  });

  it("reads a todo that does not exist yet (the create panel)", () => {
    const changes = previewGoalLinkEdit(sampleState(), {
      todos: [{ id: "new", done: false, isDeleted: false }],
      link: [{ goalId: "w-book", todoId: "new" }],
    });
    expect(changes[0]).toEqual({
      goalId: "w-book",
      before: { done: 0, total: 0, achieved: false, connected: false },
      after: { done: 0, total: 1, achieved: false, connected: true },
    });
  });

  it("previews a status flip (undoing a completion) the same way", () => {
    const changes = previewGoalLinkEdit(sampleState(), {
      todos: [{ id: "t-run1", done: false, isDeleted: false }],
    });
    expect(lostAchievementIds(changes)).toEqual(["w-run", "m-run", "y-run"]);
  });

  it("reports nothing for an edit that changes no number", () => {
    expect(
      previewGoalLinkEdit(sampleState(), {
        link: [{ goalId: "w-plan", todoId: "t-plan1" }],
      }),
    ).toEqual([]);
  });
});

describe("goalsForTodoPicker", () => {
  it("offers this week, month and year — week first — and nothing older", () => {
    const ids = goalsForTodoPicker(SAMPLE_GOALS, "2026-09-30", []).map(
      (g) => g.id,
    );
    expect(ids).toEqual([
      "w-run",
      "w-plan",
      "w-book",
      "m-run",
      "m-deal",
      "y-run",
    ]);
  });

  it("keeps an old goal the todo is still linked to, so it can be unlinked", () => {
    const ids = goalsForTodoPicker(SAMPLE_GOALS, "2026-09-30", ["w-old"]).map(
      (g) => g.id,
    );
    expect(ids).toContain("w-old");
  });

  it("drops deleted goals", () => {
    const deleted = {
      ...goal("w-x", "消した目標", "week", "2026-09-27"),
      isDeleted: true,
    };
    expect(
      goalsForTodoPicker([deleted], "2026-09-30", ["w-x"]).map((g) => g.id),
    ).toEqual([]);
  });
});

describe("linkedGoalIds", () => {
  it("lists only the live links of the todo", () => {
    const state = sampleState();
    expect(linkedGoalIds(state.links, "t-plan1")).toEqual(["w-plan"]);
    expect(
      linkedGoalIds(
        [{ goalId: "w-run", todoId: "t-free", isDeleted: true }],
        "t-free",
      ),
    ).toEqual([]);
  });
});

describe("link drafts", () => {
  it("re-applies the user's change to the latest saved links", () => {
    // The user added A to [] ... then another device linked G.
    const draft = linkDraftOf([], ["A"]);
    expect(applyLinkDraft(["G"], draft)).toEqual(["G", "A"]);
  });

  it("keeps a removal, and reads null as nothing touched", () => {
    const draft = linkDraftOf(["A", "B"], ["B"]);
    expect(draft).toEqual({ add: [], remove: ["A"] });
    expect(applyLinkDraft(["A", "B", "G"], draft)).toEqual(["B", "G"]);
    expect(applyLinkDraft(["A"], null)).toEqual(["A"]);
  });
});
