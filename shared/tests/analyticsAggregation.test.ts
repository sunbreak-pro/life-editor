import { describe, it, expect } from "vitest";
import type { TimerSession } from "../src/types/timer";
import type { WikiTag, WikiTagAssignment } from "../src/types/wikiTag";
import {
  aggregateByDay,
  aggregateByTask,
  computeSummary,
  aggregateTagByEntityType,
} from "../src/utils/analyticsAggregation";

function makeAssignment(
  overrides: Partial<WikiTagAssignment> = {},
): WikiTagAssignment {
  return {
    tagId: "tag-1",
    entityId: "entity-1",
    entityType: "task",
    source: "manual",
    createdAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const TAGS: WikiTag[] = [
  {
    id: "tag-1",
    name: "Tag One",
    color: "#808080",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
];

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

describe("aggregateTagByEntityType (V64 entityType regression)", () => {
  it("counts task / note / daily assignments into the correct buckets", () => {
    const assignments: WikiTagAssignment[] = [
      makeAssignment({ entityId: "t1", entityType: "task" }),
      makeAssignment({ entityId: "t2", entityType: "task" }),
      makeAssignment({ entityId: "n1", entityType: "note" }),
      makeAssignment({ entityId: "d1", entityType: "daily" }),
      makeAssignment({ entityId: "d2", entityType: "daily" }),
      makeAssignment({ entityId: "d3", entityType: "daily" }),
    ];

    const result = aggregateTagByEntityType(TAGS, assignments);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      tagId: "tag-1",
      taskCount: 2,
      noteCount: 1,
      // V64: dailies must come from entityType === "daily" (was the
      // pre-V64 "memo" literal, which never matched post-rename data).
      dailyCount: 3,
    });
  });

  it("daily assignments are no longer silently dropped (pre-V64 bug fixed)", () => {
    const assignments: WikiTagAssignment[] = [
      makeAssignment({ entityId: "d1", entityType: "daily" }),
    ];

    const result = aggregateTagByEntityType(TAGS, assignments);

    // Before the fix this was 0 because the aggregator compared against
    // the stale "memo" literal while V64 writes "daily".
    expect(result[0]?.dailyCount).toBe(1);
  });
});
