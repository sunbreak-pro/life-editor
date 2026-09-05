// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import type { TimerSession } from "../src/types/timer";
import type { TodoNode } from "../src/types/todoTree";
import type { ScheduleItem } from "../src/types/schedule";
import type {
  WikiTag as WikiTagUnified,
  WikiTagAssignment as WikiTagAssignmentUnified,
} from "../src/types/wikiTagUnified";
import {
  aggregateByDay,
  aggregateByTodo,
  aggregateDailyTimeline,
  aggregateWorkBreakBalance,
  computeSummary,
  aggregateWorkTimeByTag,
  aggregateTodoCompletionTrend,
  aggregateTodoStagnation,
  aggregateTagUsage,
  type TagUsageItem,
} from "../src/utils/analyticsAggregation";

function makeSession(overrides: Partial<TimerSession> = {}): TimerSession {
  return {
    id: 1,
    todoId: "task-1",
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

describe("aggregateByTodo", () => {
  it("groups sessions by todo", () => {
    const sessions = [
      makeSession({ todoId: "task-1", duration: 1500 }),
      makeSession({ id: 2, todoId: "task-2", duration: 600 }),
      makeSession({ id: 3, todoId: "task-1", duration: 300 }),
    ];
    const nameMap = new Map([
      ["task-1", "Todo One"],
      ["task-2", "Todo Two"],
    ]);
    const result = aggregateByTodo(sessions, nameMap);
    expect(result).toHaveLength(2);

    const todo1 = result.find((b) => b.todoId === "task-1");
    expect(todo1).toBeDefined();
    expect(todo1!.totalMinutes).toBeCloseTo(30); // (1500+300)/60
    expect(todo1!.sessionCount).toBe(2);
  });

  it("handles sessions without todo ID", () => {
    const sessions = [makeSession({ todoId: null, duration: 600 })];
    const result = aggregateByTodo(sessions, new Map());
    expect(result).toHaveLength(1);
    expect(result[0].todoName).toBe("No Todo");
  });

  it("limits to 10 todos", () => {
    const sessions = Array.from({ length: 15 }, (_, i) =>
      makeSession({ id: i, todoId: `task-${i}`, duration: 600 }),
    );
    const nameMap = new Map(
      sessions.map((s) => [s.todoId!, `Todo ${s.todoId}`]),
    );
    const result = aggregateByTodo(sessions, nameMap);
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
 * aggregation. These pin the attribution rules (even split across a todo's
 * tags, trailing untagged bucket) and — since the retired aggregateByFolder
 * walked `parentId` without a visited guard — that no analytics aggregation
 * hangs on a cyclic todo graph (KI-016 class).
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
 * Live todo tree stand-in (#428): the ring only counts sessions whose todo is
 * still in `fetchTodoTree`'s live result, so every fixture has to say which
 * todo ids exist. An id left out of this list means "trashed or purged".
 */
function liveTodos(...ids: string[]): TodoNode[] {
  return ids.map((id, i) => ({
    id,
    type: "task",
    title: id,
    parentId: null,
    order: i,
    createdAt: "2025-01-01T00:00:00.000Z",
  }));
}

/**
 * Live event stand-in (#1375) — ids absent from the list read as trashed, the
 * same rule `liveTodos` encodes for the todo side. Only `id` and `isDeleted`
 * are ever read (`WorkTimeItem`); the rest is there because ScheduleItem
 * requires it.
 */
function liveEvents(...ids: string[]): ScheduleItem[] {
  return ids.map((id) => ({
    id,
    date: "2025-01-01",
    title: id,
    startTime: "09:00",
    endTime: "10:00",
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    isDeleted: false,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  }));
}

describe("aggregateWorkTimeByTag", () => {
  it("attributes a todo's work time to its tag", () => {
    const result = aggregateWorkTimeByTag(
      [makeSession({ todoId: "task-1", duration: 1500 })],
      [makeUnifiedAssignment()],
      [makeUnifiedTag()],
      liveTodos("task-1"),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      tagId: "tag-a",
      tagName: "Tag A",
      tagColor: "#ff0000",
    });
    expect(result[0].totalMinutes).toBeCloseTo(25);
  });

  it("splits a multi-tag todo's minutes evenly so the buckets sum to the real total", () => {
    const result = aggregateWorkTimeByTag(
      [makeSession({ todoId: "task-1", duration: 1800 })], // 30 min
      [
        makeUnifiedAssignment({ id: "asg-1", tagId: "tag-a" }),
        makeUnifiedAssignment({ id: "asg-2", tagId: "tag-b" }),
      ],
      [makeUnifiedTag(), makeUnifiedTag({ id: "tag-b", name: "Tag B" })],
      liveTodos("task-1"),
    );

    expect(result.map((b) => b.totalMinutes)).toEqual([15, 15]);
    const total = result.reduce((sum, b) => sum + b.totalMinutes, 0);
    expect(total).toBeCloseTo(30);
  });

  it("counts a duplicated assignment once (no double weighting)", () => {
    const result = aggregateWorkTimeByTag(
      [makeSession({ todoId: "task-1", duration: 1800 })],
      [
        makeUnifiedAssignment({ id: "asg-1", tagId: "tag-a" }),
        makeUnifiedAssignment({ id: "asg-2", tagId: "tag-a" }),
        makeUnifiedAssignment({ id: "asg-3", tagId: "tag-b" }),
      ],
      [makeUnifiedTag(), makeUnifiedTag({ id: "tag-b", name: "Tag B" })],
      liveTodos("task-1"),
    );

    expect(result.map((b) => b.totalMinutes)).toEqual([15, 15]);
  });

  it("puts untagged work — and work with no todo — in a trailing null bucket", () => {
    const result = aggregateWorkTimeByTag(
      [
        makeSession({ id: 1, todoId: "task-1", duration: 1200 }), // tagged, 20 min
        makeSession({ id: 2, todoId: "task-2", duration: 600 }), // untagged, 10 min
        makeSession({ id: 3, todoId: null, duration: 300 }), // no todo, 5 min
      ],
      [makeUnifiedAssignment()],
      [makeUnifiedTag()],
      liveTodos("task-1", "task-2"),
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
        makeSession({ id: 1, todoId: "task-1", duration: 600 }),
        makeSession({
          id: 2,
          todoId: "task-1",
          duration: 600,
          sessionType: "BREAK",
        }),
      ],
      [
        makeUnifiedAssignment({ id: "asg-1", isDeleted: true }),
        makeUnifiedAssignment({ id: "asg-2", tagId: "tag-gone" }),
      ],
      [makeUnifiedTag({ id: "tag-gone", isDeleted: true })],
      liveTodos("task-1"),
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
      makeSession({ id: i + 1, todoId: `task-${i}`, duration: (i + 1) * 60 }),
    );
    const assignments = tags.map((t, i) =>
      makeUnifiedAssignment({
        id: `asg-${i}`,
        itemId: `task-${i}`,
        tagId: t.id,
      }),
    );
    // Plus one untagged session so the trailing bucket is present too.
    sessions.push(makeSession({ id: 99, todoId: "task-none", duration: 60 }));

    const result = aggregateWorkTimeByTag(
      sessions,
      assignments,
      tags,
      liveTodos(...tags.map((_, i) => `task-${i}`), "task-none"),
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
        liveTodos("task-1"),
      ),
    ).toEqual([]);
  });

  /*
   * #428 decision pin: work on a TRASHED todo is dropped, not folded into
   * "untagged". #365 stopped returning a trashed item's assignments, which
   * turned its minutes into phantom untagged work — the ring said "you spent
   * 30 min on something you never tagged" about a todo sitting in the bin.
   * Analytics excludes trashed items everywhere else (fetchTodoTree is
   * live-only), so the ring follows. Restoring the todo brings the time back.
   */
  it("drops work on a trashed todo instead of counting it as untagged", () => {
    const result = aggregateWorkTimeByTag(
      [
        makeSession({ id: 1, todoId: "task-1", duration: 1200 }), // live + tagged, 20 min
        makeSession({ id: 2, todoId: "task-trashed", duration: 1800 }), // trashed, 30 min
      ],
      [makeUnifiedAssignment()],
      [makeUnifiedTag()],
      // "task-trashed" is absent: fetchTodoTree never returns trashed rows,
      // and #365 already withheld its assignments.
      liveTodos("task-1"),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: "tag", tagId: "tag-a" });
    expect(result[0].totalMinutes).toBeCloseTo(20);
  });

  it("still counts todo-less work as untagged when todos are trashed", () => {
    const result = aggregateWorkTimeByTag(
      [
        makeSession({ id: 1, todoId: null, duration: 600 }), // no todo, 10 min
        makeSession({ id: 2, todoId: "task-trashed", duration: 600 }),
      ],
      [],
      [makeUnifiedTag()],
      liveTodos(),
    );

    // The null-todo session is genuine todo-less work and keeps its bucket;
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

  /*
   * ────────────────────────────────────────────────────────────────────────
   * #1375 — Events are work-time targets too.
   *
   * The regression half comes first and is the point of the block: every test
   * above this line calls the function the way a Todo-only host does, and they
   * all still pass unchanged. This one pins the SUM explicitly so a future
   * change to the event path cannot quietly move a Todo-only number and be
   * caught only by a `toHaveLength`.
   * ────────────────────────────────────────────────────────────────────────
   */
  it("leaves a Todo-only caller's numbers exactly where they were", () => {
    const result = aggregateWorkTimeByTag(
      [
        makeSession({ id: 1, todoId: "task-1", duration: 1200 }), // 20 min, tagged
        makeSession({ id: 2, todoId: "task-2", duration: 600 }), // 10 min, untagged
      ],
      [makeUnifiedAssignment()],
      [makeUnifiedTag()],
      liveTodos("task-1", "task-2"),
    );

    expect(result).toEqual([
      {
        kind: "tag",
        tagId: "tag-a",
        tagName: "Tag A",
        tagColor: "#ff0000",
        totalMinutes: 20,
      },
      {
        kind: "untagged",
        tagId: null,
        tagName: null,
        tagColor: null,
        totalMinutes: 10,
      },
    ]);
  });

  it("attributes an event's work time to the event's tag", () => {
    const result = aggregateWorkTimeByTag(
      [makeSession({ id: 1, todoId: null, eventId: "event-1", duration: 1800 })],
      [makeUnifiedAssignment({ itemId: "event-1" })],
      [makeUnifiedTag()],
      [...liveTodos(), ...liveEvents("event-1")],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: "tag", tagId: "tag-a" });
    expect(result[0].totalMinutes).toBeCloseTo(30);
  });

  // The reason the two lists are concatenated rather than aggregated apart: a
  // tag sits ABOVE the role split, so an hour on the todo and an hour on the
  // calendar entry are two hours of the same tag — not two half-size slices.
  it("sums todo work and event work into one slice per tag", () => {
    const result = aggregateWorkTimeByTag(
      [
        makeSession({ id: 1, todoId: "task-1", duration: 1200 }), // 20 min
        makeSession({
          id: 2,
          todoId: null,
          eventId: "event-1",
          duration: 600, // 10 min
        }),
      ],
      [
        makeUnifiedAssignment({ id: "asg-1", itemId: "task-1" }),
        makeUnifiedAssignment({ id: "asg-2", itemId: "event-1" }),
      ],
      [makeUnifiedTag()],
      [...liveTodos("task-1"), ...liveEvents("event-1")],
    );

    expect(result).toHaveLength(1);
    expect(result[0].totalMinutes).toBeCloseTo(30);
  });

  it("counts work on an untagged event as untagged, not as a missing item", () => {
    const result = aggregateWorkTimeByTag(
      [makeSession({ id: 1, todoId: null, eventId: "event-1", duration: 600 })],
      [],
      [makeUnifiedTag()],
      [...liveTodos(), ...liveEvents("event-1")],
    );

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

  // #428 parity: the trash rule has to reach the new column too. An event in
  // the bin is exactly as absent from `liveItems` as a trashed todo, and its
  // minutes must vanish rather than pile into "untagged".
  it("drops work on a trashed event instead of counting it as untagged", () => {
    const result = aggregateWorkTimeByTag(
      [
        makeSession({ id: 1, todoId: "task-1", duration: 1200 }), // 20 min, tagged
        makeSession({
          id: 2,
          todoId: null,
          eventId: "event-trashed",
          duration: 1800,
        }),
      ],
      [makeUnifiedAssignment()],
      [makeUnifiedTag()],
      // The trashed event is absent, and so is the soft-deleted one the guard
      // filters out — both routes to "not live" have to behave the same.
      [
        ...liveTodos("task-1"),
        ...liveEvents("event-other").map((e) => ({ ...e, isDeleted: true })),
      ],
    );

    expect(result).toHaveLength(1);
    expect(result[0].totalMinutes).toBeCloseTo(20);
  });
});

describe("analytics aggregation over a cyclic todo graph (KI-016 class)", () => {
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
      makeSession({ todoId: "A", duration: 1500 }),
      makeSession({ id: 2, todoId: "C", duration: 600 }),
    ];

    expect(aggregateTodoCompletionTrend(nodes, 7)).toHaveLength(7);
    expect(aggregateTodoStagnation(nodes)).toHaveLength(5);
    // The tag ring reads assignments, not the todo tree — a cycle is simply
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

/*
 * Tag usage (#1379). The suite's job is the SEPARATION of the two windows:
 * `rangeCount` follows the selected preset, `totalCount` never does. Every
 * timestamp below is midday JST (vitest.config.ts pins TZ=Asia/Tokyo, #449) so
 * the local calendar key the range is sliced on cannot land on the wrong day.
 */
function usageItem(
  id: string,
  createdAt: string,
  isDeleted = false,
): TagUsageItem {
  return { id, createdAt, isDeleted };
}

/** 12:00 JST on the given local date — never near a day boundary. */
function middayOf(dateKey: string): string {
  return `${dateKey}T03:00:00.000Z`;
}

describe("aggregateTagUsage", () => {
  it("reports the range count and the live total as two separate numbers", () => {
    const result = aggregateTagUsage(
      [
        usageItem("task-1", middayOf("2026-07-10")),
        usageItem("task-2", middayOf("2026-07-20")),
        usageItem("task-3", middayOf("2026-08-05")),
      ],
      [
        makeUnifiedAssignment({ id: "asg-1", itemId: "task-1" }),
        makeUnifiedAssignment({ id: "asg-2", itemId: "task-2" }),
        makeUnifiedAssignment({ id: "asg-3", itemId: "task-3" }),
      ],
      [makeUnifiedTag()],
      "2026-07-01",
      "2026-07-31",
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      tagId: "tag-a",
      tagName: "Tag A",
      tagColor: "#ff0000",
      // July only…
      rangeCount: 2,
      // …but the total counts the August item too.
      totalCount: 3,
    });
  });

  it("moves the range count when the window changes and leaves the total alone", () => {
    const items = [
      usageItem("task-1", middayOf("2026-07-10")),
      usageItem("task-2", middayOf("2026-08-05")),
    ];
    const assignments = [
      makeUnifiedAssignment({ id: "asg-1", itemId: "task-1" }),
      makeUnifiedAssignment({ id: "asg-2", itemId: "task-2" }),
    ];
    const tags = [makeUnifiedTag()];

    const july = aggregateTagUsage(
      items,
      assignments,
      tags,
      "2026-07-01",
      "2026-07-31",
    );
    const bothMonths = aggregateTagUsage(
      items,
      assignments,
      tags,
      "2026-07-01",
      "2026-08-31",
    );

    expect(july[0].rangeCount).toBe(1);
    expect(bothMonths[0].rangeCount).toBe(2);
    // The one invariant the card's right-hand column rests on.
    expect(july[0].totalCount).toBe(2);
    expect(bothMonths[0].totalCount).toBe(2);
  });

  it("leaves trashed items, deleted tags and deleted assignments out of both numbers (#428)", () => {
    const result = aggregateTagUsage(
      [
        usageItem("task-1", middayOf("2026-07-10")),
        // Trashed: in the range, tagged, and must count for neither number.
        usageItem("task-2", middayOf("2026-07-11"), true),
        usageItem("task-3", middayOf("2026-07-12")),
        usageItem("task-4", middayOf("2026-07-13")),
      ],
      [
        makeUnifiedAssignment({ id: "asg-1", itemId: "task-1" }),
        makeUnifiedAssignment({ id: "asg-2", itemId: "task-2" }),
        // Assignment itself soft-deleted.
        makeUnifiedAssignment({
          id: "asg-3",
          itemId: "task-3",
          isDeleted: true,
        }),
        // Live assignment, but to a tag that is in the trash.
        makeUnifiedAssignment({
          id: "asg-4",
          itemId: "task-4",
          tagId: "tag-gone",
        }),
      ],
      [makeUnifiedTag(), makeUnifiedTag({ id: "tag-gone", isDeleted: true })],
      "2026-07-01",
      "2026-07-31",
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      tagId: "tag-a",
      rangeCount: 1,
      totalCount: 1,
    });
  });

  it("counts a tag assigned twice to the same item once", () => {
    const result = aggregateTagUsage(
      [usageItem("task-1", middayOf("2026-07-10"))],
      [
        // e.g. an inline "[[ ]]" link plus a manual chip.
        makeUnifiedAssignment({ id: "asg-1", itemId: "task-1" }),
        makeUnifiedAssignment({ id: "asg-2", itemId: "task-1" }),
      ],
      [makeUnifiedTag()],
      "2026-07-01",
      "2026-07-31",
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ rangeCount: 1, totalCount: 1 });
  });

  it("ranks by the range count and omits tags with nothing in the window", () => {
    const result = aggregateTagUsage(
      [
        usageItem("task-1", middayOf("2026-07-10")),
        usageItem("task-2", middayOf("2026-07-11")),
        // Tag B's only item predates the range: it has a live total but no
        // bar to draw, so it must not take a row.
        usageItem("note-1", middayOf("2026-06-01")),
      ],
      [
        makeUnifiedAssignment({ id: "asg-1", itemId: "task-1", tagId: "tag-a" }),
        makeUnifiedAssignment({ id: "asg-2", itemId: "task-2", tagId: "tag-a" }),
        makeUnifiedAssignment({ id: "asg-3", itemId: "note-1", tagId: "tag-b" }),
      ],
      [makeUnifiedTag(), makeUnifiedTag({ id: "tag-b", name: "Tag B" })],
      "2026-07-01",
      "2026-07-31",
    );

    expect(result.map((b) => b.tagId)).toEqual(["tag-a"]);
    expect(result[0].rangeCount).toBe(2);
  });

  it("returns no rows when nothing in the range carries a live tag", () => {
    expect(
      aggregateTagUsage(
        [usageItem("task-1", middayOf("2026-07-10"))],
        [],
        [makeUnifiedTag()],
        "2026-07-01",
        "2026-07-31",
      ),
    ).toEqual([]);
  });
});

/*
 * #1475 — start → pause → reset leaves a seconds-long unfinished row in
 * timer_sessions (pause closes it as a partial; reset has nothing left to
 * withdraw). Two aborted starts put a Todo into "work time by todo" and two
 * sessions into the weekly comparison for 25 seconds of nothing. Every card
 * that reads work time now goes through `isCountedSession`, which also cleans
 * the rows earlier builds already wrote — the user cannot delete them from the
 * app.
 */
describe("abandoned session scraps (#1475)", () => {
  function dayKeyOf(d: Date): string {
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }

  const scraps = [
    makeSession({ id: 18, todoId: "task-1", duration: 12, completed: false }),
    makeSession({ id: 19, todoId: null, duration: 13, completed: false }),
  ];

  it("leaves no todo in the per-todo work time", () => {
    const named = new Map([["task-1", "Write the report"]]);
    expect(aggregateByTodo(scraps, named)).toEqual([]);
  });

  it("counts no sessions and no minutes in the summary", () => {
    const summary = computeSummary(scraps);
    expect(summary.totalSessions).toBe(0);
    expect(summary.totalMinutes).toBe(0);
  });

  // The half that must NOT change: an interrupted phase is real work.
  it("still counts a long session that was paused and never resumed", () => {
    const summary = computeSummary([
      makeSession({ duration: 20 * 60, completed: false }),
    ]);
    expect(summary.totalSessions).toBe(1);
    expect(summary.totalMinutes).toBeCloseTo(20);
  });

  it("adds nothing to the work/break balance", () => {
    const buckets = aggregateWorkBreakBalance(scraps, 7);
    expect(buckets.every((b) => b.workMinutes === 0)).toBe(true);
  });

  it("draws no block on the daily timeline", () => {
    const today = dayKeyOf(scraps[0].startedAt);
    expect(aggregateDailyTimeline(scraps, today)).toEqual([]);
  });
});
