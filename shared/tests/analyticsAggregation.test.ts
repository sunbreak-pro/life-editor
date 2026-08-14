import { describe, it, expect } from "vitest";
import type { TimerSession } from "../src/types/timer";
import type { TodoNode } from "../src/types/todoTree";
import type {
  WikiTag as WikiTagUnified,
  WikiTagAssignment as WikiTagAssignmentUnified,
} from "../src/types/wikiTagUnified";
import {
  aggregateByDay,
  aggregateByTask,
  computeSummary,
  aggregateWorkTimeByTag,
  aggregateTaskCompletionTrend,
  aggregateTaskStagnation,
} from "../src/utils/analyticsAggregation";

function makeSession(overrides: Partial<TimerSession> = {}): TimerSession {
  return {
    id: 1,
    taskId: "task-1",
    sessionType: "WORK",
    startedAt: new Date(),
    completedAt: new Date(),
    duration: 1500, // 25 minutes in seconds
    completed: true,
    label: null,
    ...overrides,
  };
}

describe("aggregateByDay", () => {
  it("returns buckets for requested number of days", () => {
    const result = aggregateByDay([], 7);
    expect(result).toHaveLength(7);
  });

  it("aggregates session durations correctly", () => {
    const today = new Date();
    const sessions = [
      makeSession({ startedAt: today, duration: 1500 }),
      makeSession({ id: 2, startedAt: today, duration: 600 }),
    ];
    const result = aggregateByDay(sessions, 1);
    expect(result).toHaveLength(1);
    expect(result[0].totalMinutes).toBeCloseTo(35); // (1500+600)/60
    expect(result[0].sessionCount).toBe(2);
  });

  it("filters out non-WORK sessions", () => {
    const today = new Date();
    const sessions = [
      makeSession({ startedAt: today, duration: 1500 }),
      makeSession({
        id: 2,
        startedAt: today,
        duration: 300,
        sessionType: "BREAK",
      }),
    ];
    const result = aggregateByDay(sessions, 1);
    expect(result[0].totalMinutes).toBeCloseTo(25);
    expect(result[0].sessionCount).toBe(1);
  });

  it("filters out sessions with zero duration", () => {
    const today = new Date();
    const sessions = [makeSession({ startedAt: today, duration: 0 })];
    const result = aggregateByDay(sessions, 1);
    expect(result[0].sessionCount).toBe(0);
  });
});

describe("aggregateByTask", () => {
  it("groups sessions by task", () => {
    const sessions = [
      makeSession({ taskId: "task-1", duration: 1500 }),
      makeSession({ id: 2, taskId: "task-2", duration: 600 }),
      makeSession({ id: 3, taskId: "task-1", duration: 300 }),
    ];
    const nameMap = new Map([
      ["task-1", "Task One"],
      ["task-2", "Task Two"],
    ]);
    const result = aggregateByTask(sessions, nameMap);
    expect(result).toHaveLength(2);

    const task1 = result.find((b) => b.taskId === "task-1");
    expect(task1).toBeDefined();
    expect(task1!.totalMinutes).toBeCloseTo(30); // (1500+300)/60
    expect(task1!.sessionCount).toBe(2);
  });

  it("handles sessions without task ID", () => {
    const sessions = [makeSession({ taskId: null, duration: 600 })];
    const result = aggregateByTask(sessions, new Map());
    expect(result).toHaveLength(1);
    expect(result[0].taskName).toBe("No Task");
  });

  it("limits to 10 tasks", () => {
    const sessions = Array.from({ length: 15 }, (_, i) =>
      makeSession({ id: i, taskId: `task-${i}`, duration: 600 }),
    );
    const nameMap = new Map(
      sessions.map((s) => [s.taskId!, `Task ${s.taskId}`]),
    );
    const result = aggregateByTask(sessions, nameMap);
    expect(result.length).toBeLessThanOrEqual(10);
  });
});

describe("computeSummary", () => {
  it("computes total minutes and sessions", () => {
    const sessions = [
      makeSession({ duration: 1500 }),
      makeSession({ id: 2, duration: 600 }),
    ];
    const summary = computeSummary(sessions);
    expect(summary.totalMinutes).toBeCloseTo(35);
    expect(summary.totalSessions).toBe(2);
  });

  it("returns zero for empty sessions", () => {
    const summary = computeSummary([]);
    expect(summary.totalMinutes).toBe(0);
    expect(summary.totalSessions).toBe(0);
    expect(summary.avgMinutesPerDay).toBe(0);
  });

  it("computes average minutes per unique day", () => {
    const day1 = new Date(2025, 0, 1);
    const day2 = new Date(2025, 0, 2);
    const sessions = [
      makeSession({ startedAt: day1, duration: 1500 }),
      makeSession({ id: 2, startedAt: day1, duration: 1500 }),
      makeSession({ id: 3, startedAt: day2, duration: 600 }),
    ];
    const summary = computeSummary(sessions);
    // Total: 3600s = 60min across 2 days → 30 min/day
    expect(summary.avgMinutesPerDay).toBeCloseTo(30);
  });
});

/*
 * The `aggregateTagByEntityType` suite that sat here went with the function in
 * #429. It pinned a V64 rename fix ("memo" → "daily") on the LEGACY assignment
 * shape, which the live unified data no longer has — so the suite was the only
 * thing keeping a function alive that would have returned zeros on real data.
 */

/*
 * #334: the folder-based "Project work time" ring is replaced by tag-based
 * aggregation. These pin the attribution rules (even split across a task's
 * tags, trailing untagged bucket) and — since the retired aggregateByFolder
 * walked `parentId` without a visited guard — that no analytics aggregation
 * hangs on a cyclic task graph (KI-016 class).
 */
function makeUnifiedTag(
  overrides: Partial<WikiTagUnified> = {},
): WikiTagUnified {
  return {
    id: "tag-a",
    name: "Tag A",
    color: "#ff0000",
    icon: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

function makeUnifiedAssignment(
  overrides: Partial<WikiTagAssignmentUnified> = {},
): WikiTagAssignmentUnified {
  return {
    id: "asg-1",
    itemId: "task-1",
    tagId: "tag-a",
    updatedAt: "2025-01-01T00:00:00.000Z",
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

/**
 * Live task tree stand-in (#428): the ring only counts sessions whose task is
 * still in `fetchTodoTree`'s live result, so every fixture has to say which
 * task ids exist. An id left out of this list means "trashed or purged".
 */
function liveTasks(...ids: string[]): TodoNode[] {
  return ids.map((id, i) => ({
    id,
    type: "task",
    title: id,
    parentId: null,
    order: i,
    createdAt: "2025-01-01T00:00:00.000Z",
  }));
}

describe("aggregateWorkTimeByTag", () => {
  it("attributes a task's work time to its tag", () => {
    const result = aggregateWorkTimeByTag(
      [makeSession({ taskId: "task-1", duration: 1500 })],
      [makeUnifiedAssignment()],
      [makeUnifiedTag()],
      liveTasks("task-1"),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      tagId: "tag-a",
      tagName: "Tag A",
      tagColor: "#ff0000",
    });
    expect(result[0].totalMinutes).toBeCloseTo(25);
  });

  it("splits a multi-tag task's minutes evenly so the buckets sum to the real total", () => {
    const result = aggregateWorkTimeByTag(
      [makeSession({ taskId: "task-1", duration: 1800 })], // 30 min
      [
        makeUnifiedAssignment({ id: "asg-1", tagId: "tag-a" }),
        makeUnifiedAssignment({ id: "asg-2", tagId: "tag-b" }),
      ],
      [makeUnifiedTag(), makeUnifiedTag({ id: "tag-b", name: "Tag B" })],
      liveTasks("task-1"),
    );

    expect(result.map((b) => b.totalMinutes)).toEqual([15, 15]);
    const total = result.reduce((sum, b) => sum + b.totalMinutes, 0);
    expect(total).toBeCloseTo(30);
  });

  it("counts a duplicated assignment once (no double weighting)", () => {
    const result = aggregateWorkTimeByTag(
      [makeSession({ taskId: "task-1", duration: 1800 })],
      [
        makeUnifiedAssignment({ id: "asg-1", tagId: "tag-a" }),
        makeUnifiedAssignment({ id: "asg-2", tagId: "tag-a" }),
        makeUnifiedAssignment({ id: "asg-3", tagId: "tag-b" }),
      ],
      [makeUnifiedTag(), makeUnifiedTag({ id: "tag-b", name: "Tag B" })],
      liveTasks("task-1"),
    );

    expect(result.map((b) => b.totalMinutes)).toEqual([15, 15]);
  });

  it("puts untagged work — and work with no task — in a trailing null bucket", () => {
    const result = aggregateWorkTimeByTag(
      [
        makeSession({ id: 1, taskId: "task-1", duration: 1200 }), // tagged, 20 min
        makeSession({ id: 2, taskId: "task-2", duration: 600 }), // untagged, 10 min
        makeSession({ id: 3, taskId: null, duration: 300 }), // no task, 5 min
      ],
      [makeUnifiedAssignment()],
      [makeUnifiedTag()],
      liveTasks("task-1", "task-2"),
    );

    expect(result).toHaveLength(2);
    expect(result[0].tagId).toBe("tag-a");
    // Untagged always comes last so it never crowds out a real tag.
    expect(result[result.length - 1]).toMatchObject({
      kind: "untagged",
      tagId: null,
      tagName: null,
      tagColor: null,
    });
    expect(result[1].totalMinutes).toBeCloseTo(15);
  });

  it("ignores non-WORK sessions and soft-deleted tags / assignments", () => {
    const result = aggregateWorkTimeByTag(
      [
        makeSession({ id: 1, taskId: "task-1", duration: 600 }),
        makeSession({
          id: 2,
          taskId: "task-1",
          duration: 600,
          sessionType: "BREAK",
        }),
      ],
      [
        makeUnifiedAssignment({ id: "asg-1", isDeleted: true }),
        makeUnifiedAssignment({ id: "asg-2", tagId: "tag-gone" }),
      ],
      [makeUnifiedTag({ id: "tag-gone", isDeleted: true })],
      liveTasks("task-1"),
    );

    // Both assignments drop out, so the WORK session reads as untagged and
    // the BREAK session is filtered entirely.
    expect(result).toEqual([
      {
        kind: "untagged",
        tagId: null,
        tagName: null,
        tagColor: null,
        totalMinutes: 10,
      },
    ]);
  });

  it("folds tags past the top-N cap into 'other' instead of dropping them", () => {
    const tags = Array.from({ length: 12 }, (_, i) =>
      makeUnifiedTag({ id: `tag-${i}`, name: `Tag ${i}` }),
    );
    // Tag i gets (i + 1) minutes, so tag-0 (1 min) and tag-1 (2 min) fall
    // outside the top 10.
    const sessions = tags.map((t, i) =>
      makeSession({ id: i + 1, taskId: `task-${i}`, duration: (i + 1) * 60 }),
    );
    const assignments = tags.map((t, i) =>
      makeUnifiedAssignment({
        id: `asg-${i}`,
        itemId: `task-${i}`,
        tagId: t.id,
      }),
    );
    // Plus one untagged session so the trailing bucket is present too.
    sessions.push(makeSession({ id: 99, taskId: "task-none", duration: 60 }));

    const result = aggregateWorkTimeByTag(
      sessions,
      assignments,
      tags,
      liveTasks(...tags.map((_, i) => `task-${i}`), "task-none"),
    );

    expect(result).toHaveLength(12); // 10 tags + other + untagged
    expect(result[0].tagId).toBe("tag-11"); // longest first
    expect(result.map((b) => b.kind).slice(-2)).toEqual(["other", "untagged"]);
    expect(result[10].totalMinutes).toBeCloseTo(3); // tag-0 (1) + tag-1 (2)
    expect(result[11].totalMinutes).toBeCloseTo(1);

    // The invariant that matters: nothing is discarded, so the buckets still
    // sum to the real logged work time (78 tagged + 1 untagged).
    const total = result.reduce((sum, b) => sum + b.totalMinutes, 0);
    expect(total).toBeCloseTo(79);
  });

  it("returns [] when there is no work time at all", () => {
    expect(
      aggregateWorkTimeByTag(
        [],
        [makeUnifiedAssignment()],
        [makeUnifiedTag()],
        liveTasks("task-1"),
      ),
    ).toEqual([]);
  });

  /*
   * #428 decision pin: work on a TRASHED task is dropped, not folded into
   * "untagged". #365 stopped returning a trashed item's assignments, which
   * turned its minutes into phantom untagged work — the ring said "you spent
   * 30 min on something you never tagged" about a task sitting in the bin.
   * Analytics excludes trashed items everywhere else (fetchTodoTree is
   * live-only), so the ring follows. Restoring the task brings the time back.
   */
  it("drops work on a trashed task instead of counting it as untagged", () => {
    const result = aggregateWorkTimeByTag(
      [
        makeSession({ id: 1, taskId: "task-1", duration: 1200 }), // live + tagged, 20 min
        makeSession({ id: 2, taskId: "task-trashed", duration: 1800 }), // trashed, 30 min
      ],
      [makeUnifiedAssignment()],
      [makeUnifiedTag()],
      // "task-trashed" is absent: fetchTodoTree never returns trashed rows,
      // and #365 already withheld its assignments.
      liveTasks("task-1"),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: "tag", tagId: "tag-a" });
    expect(result[0].totalMinutes).toBeCloseTo(20);
  });

  it("still counts task-less work as untagged when tasks are trashed", () => {
    const result = aggregateWorkTimeByTag(
      [
        makeSession({ id: 1, taskId: null, duration: 600 }), // no task, 10 min
        makeSession({ id: 2, taskId: "task-trashed", duration: 600 }),
      ],
      [],
      [makeUnifiedTag()],
      liveTasks(),
    );

    // The null-task session is genuine task-less work and keeps its bucket;
    // only the trashed one disappears.
    expect(result).toEqual([
      {
        kind: "untagged",
        tagId: null,
        tagName: null,
        tagColor: null,
        totalMinutes: 10,
      },
    ]);
  });
});

describe("analytics aggregation over a cyclic task graph (KI-016 class)", () => {
  function cyclicNodes(): TodoNode[] {
    // A -> B -> A plus a self-reference: the shape that made the retired
    // findRootFolder spin forever and freeze the Analytics screen.
    return [
      {
        id: "A",
        type: "task",
        title: "A",
        parentId: "B",
        order: 0,
        createdAt: "2025-01-01T00:00:00.000Z",
      },
      {
        id: "B",
        type: "task",
        title: "B",
        parentId: "A",
        order: 1,
        createdAt: "2025-01-01T00:00:00.000Z",
      },
      {
        id: "C",
        type: "task",
        title: "C",
        parentId: "C",
        order: 2,
        createdAt: "2025-01-01T00:00:00.000Z",
      },
    ];
  }

  it("terminates for every node-driven aggregation", () => {
    const nodes = cyclicNodes();
    const sessions = [
      makeSession({ taskId: "A", duration: 1500 }),
      makeSession({ id: 2, taskId: "C", duration: 600 }),
    ];

    expect(aggregateTaskCompletionTrend(nodes, 7)).toHaveLength(7);
    expect(aggregateTaskStagnation(nodes)).toHaveLength(5);
    // The tag ring reads assignments, not the task tree — a cycle is simply
    // never traversed.
    expect(
      aggregateWorkTimeByTag(
        sessions,
        [makeUnifiedAssignment({ itemId: "A" })],
        [makeUnifiedTag()],
        nodes,
      ),
    ).toHaveLength(2);
  }, 5000);
});
