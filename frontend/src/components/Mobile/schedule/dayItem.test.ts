import { describe, it, expect } from "vitest";
import { buildDayItems, buildMonthItemMap } from "./dayItem";
import type { ScheduleItem } from "../../../types/schedule";
import type { TaskNode } from "../../../types/taskTree";

function makeSchedule(overrides: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: "s1",
    date: "2026-04-18",
    title: "Event",
    startTime: "09:00",
    endTime: "10:00",
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

function makeTask(overrides: Partial<TaskNode>): TaskNode {
  return {
    id: "t1",
    type: "task",
    title: "Task",
    parentId: null,
    order: 0,
    status: "NOT_STARTED",
    createdAt: "",
    ...overrides,
  };
}

describe("buildDayItems", () => {
  it("classifies schedule items with routineId as routine", () => {
    const items = buildDayItems(
      [makeSchedule({ id: "s1", routineId: "r1", title: "朝の散歩" })],
      [],
      "2026-04-18",
    );
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("routine");
    expect(items[0].title).toBe("朝の散歩");
  });

  it("classifies schedule items without routineId as event", () => {
    const items = buildDayItems(
      [makeSchedule({ id: "s1", title: "打合せ" })],
      [],
      "2026-04-18",
    );
    expect(items[0].kind).toBe("event");
  });

  it("marks all-day events", () => {
    const items = buildDayItems(
      [makeSchedule({ id: "s1", isAllDay: true })],
      [],
      "2026-04-18",
    );
    expect(items[0].kind).toBe("event");
    if (items[0].kind === "event") {
      expect(items[0].isAllDay).toBe(true);
    }
  });

  it("classifies scheduled tasks", () => {
    const items = buildDayItems(
      [],
      [
        makeTask({
          id: "t1",
          scheduledAt: "2026-04-18T14:30:00",
          scheduledEndAt: "2026-04-18T15:30:00",
        }),
      ],
      "2026-04-18",
    );
    expect(items[0].kind).toBe("task");
    expect(items[0].start).toBe("14:30");
    expect(items[0].end).toBe("15:30");
  });

  it("filters out items on other dates", () => {
    const items = buildDayItems(
      [
        makeSchedule({ id: "s1", date: "2026-04-17" }),
        makeSchedule({ id: "s2", date: "2026-04-18" }),
      ],
      [makeTask({ id: "t1", scheduledAt: "2026-04-19T09:00:00" })],
      "2026-04-18",
    );
    expect(items.map((i) => i.id)).toEqual(["s2"]);
  });

  it("filters out soft-deleted items", () => {
    const items = buildDayItems(
      [makeSchedule({ id: "s1", isDeleted: true })],
      [
        makeTask({
          id: "t1",
          scheduledAt: "2026-04-18T09:00:00",
          isDeleted: true,
        }),
      ],
      "2026-04-18",
    );
    expect(items).toHaveLength(0);
  });

  it("sorts by start time ascending", () => {
    const items = buildDayItems(
      [
        makeSchedule({ id: "s1", startTime: "14:00" }),
        makeSchedule({ id: "s2", startTime: "09:00" }),
      ],
      [makeTask({ id: "t1", scheduledAt: "2026-04-18T11:30:00" })],
      "2026-04-18",
    );
    expect(items.map((i) => i.id)).toEqual(["s2", "t1", "s1"]);
  });
});

describe("buildMonthItemMap", () => {
  it("groups by date across schedule + tasks", () => {
    const map = buildMonthItemMap(
      [
        makeSchedule({ id: "s1", date: "2026-04-18" }),
        makeSchedule({ id: "s2", date: "2026-04-18" }),
        makeSchedule({ id: "s3", date: "2026-04-19" }),
      ],
      [
        makeTask({ id: "t1", scheduledAt: "2026-04-18T10:00:00" }),
        makeTask({ id: "t2", scheduledAt: "2026-04-20T09:00:00" }),
      ],
    );
    expect(map.get("2026-04-18")?.length).toBe(3);
    expect(map.get("2026-04-19")?.length).toBe(1);
    expect(map.get("2026-04-20")?.length).toBe(1);
  });

  it("skips deleted items", () => {
    const map = buildMonthItemMap(
      [makeSchedule({ id: "s1", isDeleted: true })],
      [],
    );
    expect(map.size).toBe(0);
  });

  it("omits tasks without scheduledAt", () => {
    const map = buildMonthItemMap(
      [],
      [makeTask({ id: "t1", scheduledAt: undefined })],
    );
    expect(map.size).toBe(0);
  });
});
