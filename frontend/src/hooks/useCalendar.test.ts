import { renderHook } from "@testing-library/react";
import { useCalendar, formatDateKey } from "./useCalendar";
import type { TaskNode } from "../types/taskTree";

function makeTask(overrides: Partial<TaskNode> = {}): TaskNode {
  return {
    id: "task-1",
    type: "task",
    title: "Test",
    parentId: null,
    order: 0,
    status: "TODO",
    createdAt: "2026-01-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("useCalendar", () => {
  describe("tasksByDate", () => {
    it("groups tasks by date", () => {
      const tasks = [
        makeTask({ id: "task-1", scheduledAt: "2026-01-15T10:00:00.000Z" }),
        makeTask({ id: "task-2", scheduledAt: "2026-01-15T14:00:00.000Z" }),
        makeTask({ id: "task-3", scheduledAt: "2026-01-20T10:00:00.000Z" }),
      ];
      const { result } = renderHook(() =>
        useCalendar(tasks, 2026, 0, "incomplete"),
      );
      expect(result.current.tasksByDate.get("2026-01-15")?.length).toBe(2);
      expect(result.current.tasksByDate.get("2026-01-20")?.length).toBe(1);
    });

    it("filters incomplete tasks", () => {
      const tasks = [
        makeTask({
          id: "task-1",
          status: "TODO",
          scheduledAt: "2026-01-15T10:00:00.000Z",
        }),
        makeTask({
          id: "task-2",
          status: "DONE",
          scheduledAt: "2026-01-15T10:00:00.000Z",
        }),
      ];
      const { result } = renderHook(() =>
        useCalendar(tasks, 2026, 0, "incomplete"),
      );
      const allTasks = Array.from(result.current.tasksByDate.values()).flat();
      expect(allTasks.length).toBe(1);
      expect(allTasks[0].id).toBe("task-1");
    });

    it("filters completed tasks", () => {
      const tasks = [
        makeTask({
          id: "task-1",
          status: "TODO",
          scheduledAt: "2026-01-15T10:00:00.000Z",
        }),
        makeTask({
          id: "task-2",
          status: "DONE",
          scheduledAt: "2026-01-15T10:00:00.000Z",
        }),
      ];
      const { result } = renderHook(() =>
        useCalendar(tasks, 2026, 0, "completed"),
      );
      const allTasks = Array.from(result.current.tasksByDate.values()).flat();
      expect(allTasks.length).toBe(1);
      expect(allTasks[0].id).toBe("task-2");
    });

    it("excludes tasks without scheduledAt", () => {
      const task = makeTask({ createdAt: "2026-01-15T00:00:00.000Z" });
      const { result } = renderHook(() =>
        useCalendar([task], 2026, 0, "incomplete"),
      );
      expect(result.current.tasksByDate.size).toBe(0);
    });

    it("shows task only on scheduledAt date (no createdAt fallback)", () => {
      const task = makeTask({
        scheduledAt: "2026-02-10T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      const { result } = renderHook(() =>
        useCalendar([task], 2026, 1, "incomplete"),
      );
      expect(result.current.tasksByDate.has("2026-02-10")).toBe(true);
      expect(result.current.tasksByDate.has("2026-01-01")).toBe(false);
    });

    it("excludes folders", () => {
      const folder = makeTask({ id: "folder-1", type: "folder" });
      const { result } = renderHook(() =>
        useCalendar([folder], 2026, 0, "incomplete"),
      );
      expect(result.current.tasksByDate.size).toBe(0);
    });

    it("shows multi-day task on all dates in range", () => {
      const task = makeTask({
        id: "task-multi",
        scheduledAt: "2026-01-15T10:00:00",
        scheduledEndAt: "2026-01-17T16:00:00",
      });
      const { result } = renderHook(() =>
        useCalendar([task], 2026, 0, "incomplete"),
      );
      expect(result.current.tasksByDate.has("2026-01-15")).toBe(true);
      expect(result.current.tasksByDate.has("2026-01-16")).toBe(true);
      expect(result.current.tasksByDate.has("2026-01-17")).toBe(true);
      expect(result.current.tasksByDate.has("2026-01-18")).toBe(false);
    });

    it("handles isAllDay tasks", () => {
      const task = makeTask({
        id: "task-allday",
        scheduledAt: "2026-01-20T00:00:00.000Z",
        isAllDay: true,
      });
      const { result } = renderHook(() =>
        useCalendar([task], 2026, 0, "incomplete"),
      );
      expect(result.current.tasksByDate.has("2026-01-20")).toBe(true);
      const tasks = result.current.tasksByDate.get("2026-01-20")!;
      expect(tasks[0].isAllDay).toBe(true);
    });
  });

  describe("calendarDays", () => {
    it("returns 42 days (6 weeks)", () => {
      const { result } = renderHook(() =>
        useCalendar([], 2026, 0, "incomplete"),
      );
      expect(result.current.calendarDays.length).toBe(42);
    });

    it("marks current month days correctly", () => {
      const { result } = renderHook(() =>
        useCalendar([], 2026, 0, "incomplete"),
      );
      const jan2026Days = result.current.calendarDays.filter(
        (d) => d.isCurrentMonth,
      );
      expect(jan2026Days.length).toBe(31);
    });
  });

  describe("weekDays", () => {
    it("returns 7 days", () => {
      const { result } = renderHook(() =>
        useCalendar([], 2026, 0, "incomplete"),
      );
      expect(result.current.weekDays.length).toBe(7);
    });

    it("starts from Sunday", () => {
      const anchor = new Date(2026, 0, 14); // Wednesday
      const { result } = renderHook(() =>
        useCalendar([], 2026, 0, "incomplete", anchor),
      );
      expect(result.current.weekDays[0].date.getDay()).toBe(0); // Sunday
    });
  });
});

describe("formatDateKey", () => {
  it("formats date as YYYY-MM-DD", () => {
    expect(formatDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("pads single-digit months and days", () => {
    expect(formatDateKey(new Date(2026, 2, 3))).toBe("2026-03-03");
  });
});
