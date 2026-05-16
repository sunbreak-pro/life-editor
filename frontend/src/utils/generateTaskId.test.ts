import { describe, it, expect } from "vitest";
import { generateTaskId } from "./generateTaskId";

describe("generateTaskId", () => {
  it("returns a task-prefixed id", () => {
    expect(generateTaskId()).toMatch(/^task-\d+$/);
  });

  it("produces unique, monotonically increasing ids even within the same ms", () => {
    const ids = Array.from({ length: 1000 }, () => generateTaskId());
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);

    const counters = ids.map((id) => Number(id.slice("task-".length)));
    for (let i = 1; i < counters.length; i++) {
      expect(counters[i]).toBeGreaterThan(counters[i - 1]);
    }
  });
});
