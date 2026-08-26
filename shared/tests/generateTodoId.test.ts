import { describe, it, expect } from "vitest";
import { generateId, generateTodoId } from "../src/utils/generateId";

/*
 * #1116 — the CLAUDE.md §4 id invariant, pinned.
 *
 * Two generators live side by side and the wrong one is easy to reach for:
 * `generateId("task")` reads exactly like the right answer but yields
 * `task-<uuid>`. Both the Work timer and the Briefing quick-create picked it,
 * so rows shaped `task-7df08c2d-…` landed next to every other `task-1786…`.
 * The invariant is only worth what it can be checked against, so check it.
 */

const TODO_ID = /^task-\d+$/;

describe("generateTodoId (CLAUDE.md §4 id invariant)", () => {
  it("yields `task-<timestamp+counter>`", () => {
    expect(generateTodoId()).toMatch(TODO_ID);
    expect(generateTodoId("task")).toMatch(TODO_ID);
  });

  it("is monotonic, so ids sort by creation order", () => {
    const a = Number(generateTodoId().slice("task-".length));
    const b = Number(generateTodoId().slice("task-".length));
    expect(b).toBeGreaterThan(a);
  });

  it("is seeded from the clock, not from zero", () => {
    // Guards a fresh session against re-minting ids an earlier one already used.
    const n = Number(generateTodoId().slice("task-".length));
    expect(n).toBeGreaterThan(new Date("2026-01-01").getTime());
  });

  it("is NOT what generateId('task') produces", () => {
    // The whole bug in one line.
    expect(generateId("task")).not.toMatch(TODO_ID);
  });
});
