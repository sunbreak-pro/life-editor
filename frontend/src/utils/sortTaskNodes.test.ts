import { describe, it, expect } from "vitest";
import { sortTaskNodes } from "./sortTaskNodes";
import type { TaskNode } from "../types/taskTree";

function makeTask(overrides: Partial<TaskNode> & { id: string }): TaskNode {
  return {
    type: "task",
    title: overrides.id,
    parentId: null,
    order: 0,
    createdAt: "2024-01-01",
    ...overrides,
  };
}

describe("sortTaskNodes", () => {
  const tasks = [
    makeTask({
      id: "a",
      order: 0,
      priority: 3,
      status: "NOT_STARTED",
      scheduledAt: "2024-03-01",
    }),
    makeTask({
      id: "b",
      order: 1,
      priority: 1,
      status: "DONE",
      scheduledAt: "2024-01-01",
    }),
    makeTask({
      id: "c",
      order: 2,
      priority: 2,
      status: "NOT_STARTED",
      scheduledAt: "2024-02-01",
    }),
  ];

  it("returns items unchanged in manual mode regardless of direction", () => {
    const asc = sortTaskNodes(tasks, "manual", "asc");
    const desc = sortTaskNodes(tasks, "manual", "desc");
    expect(asc.map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(desc.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts by priority ascending (low number = high priority)", () => {
    const result = sortTaskNodes(tasks, "priority", "asc");
    expect(result.map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by priority descending", () => {
    const result = sortTaskNodes(tasks, "priority", "desc");
    expect(result.map((t) => t.id)).toEqual(["a", "c", "b"]);
  });

  it("sorts by status ascending (incomplete first)", () => {
    const result = sortTaskNodes(tasks, "status", "asc");
    expect(result.map((t) => t.id)).toEqual(["a", "c", "b"]);
  });

  it("sorts by status descending (completed first)", () => {
    const result = sortTaskNodes(tasks, "status", "desc");
    expect(result.map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by scheduledAt ascending", () => {
    const result = sortTaskNodes(tasks, "scheduledAt", "asc");
    expect(result.map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by scheduledAt descending", () => {
    const result = sortTaskNodes(tasks, "scheduledAt", "desc");
    expect(result.map((t) => t.id)).toEqual(["a", "c", "b"]);
  });

  it("keeps complete system folders last regardless of direction", () => {
    const withCompleteFolder = [
      ...tasks,
      makeTask({ id: "cf", type: "folder", order: 0, folderType: "complete" }),
    ];
    const asc = sortTaskNodes(withCompleteFolder, "priority", "asc");
    const desc = sortTaskNodes(withCompleteFolder, "priority", "desc");
    expect(asc[asc.length - 1].id).toBe("cf");
    expect(desc[desc.length - 1].id).toBe("cf");
  });

  it("defaults direction to asc when omitted", () => {
    const result = sortTaskNodes(tasks, "priority");
    expect(result.map((t) => t.id)).toEqual(["b", "c", "a"]);
  });
});
