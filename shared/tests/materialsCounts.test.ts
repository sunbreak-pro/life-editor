import { describe, it, expect } from "vitest";
import {
  computeMaterialsCounts,
  EMPTY_MATERIALS_COUNTS,
  type MaterialsCountsInput,
} from "../src/materials/materialsCounts";
import type { TaskNode } from "../src/types/taskTree";
import type { NoteNode } from "../src/types/note";
import type { DailyNode } from "../src/types/daily";
import type { WikiTag as WikiTagUnified } from "../src/types/wikiTagUnified";

/*
 * Materials tab badge counts (plan 2026-07-08 Step 4). Pure derivation, so the
 * cases pin the rules: Tasks counts unfinished leaf tasks only; the other three
 * count live (non-soft-deleted) items; soft-deleted rows and folders never
 * count.
 */

function task(partial: Partial<TaskNode>): TaskNode {
  return {
    id: partial.id ?? "t",
    type: partial.type ?? "task",
    title: partial.title ?? "",
    parentId: partial.parentId ?? null,
    order: partial.order ?? 0,
    createdAt: partial.createdAt ?? "2026-07-08T00:00:00Z",
    status: partial.status,
    isDeleted: partial.isDeleted,
  };
}

function note(id: string, isDeleted: boolean): NoteNode {
  return {
    id,
    type: "note",
    title: id,
    content: "",
    parentId: null,
    order: 0,
    isDeleted,
    createdAt: "2026-07-08T00:00:00Z",
    updatedAt: "2026-07-08T00:00:00Z",
  } as NoteNode;
}

function daily(date: string, isDeleted?: boolean): DailyNode {
  return {
    id: `daily-${date}`,
    date,
    isDeleted,
    createdAt: "2026-07-08T00:00:00Z",
    updatedAt: "2026-07-08T00:00:00Z",
  } as DailyNode;
}

function tag(id: string, isDeleted: boolean): WikiTagUnified {
  return { id, name: id, isDeleted } as WikiTagUnified;
}

describe("computeMaterialsCounts", () => {
  it("returns all-zero counts for empty inputs", () => {
    const input: MaterialsCountsInput = {
      nodes: [],
      notes: [],
      dailies: [],
      tags: [],
    };
    expect(computeMaterialsCounts(input)).toEqual(EMPTY_MATERIALS_COUNTS);
  });

  it("counts only unfinished tasks (skips DONE and deleted)", () => {
    // S3 (#225): folders are gone from the Tasks domain, so the folder-
    // exclusion case is retired — only DONE / soft-deleted are skipped.
    const nodes: TaskNode[] = [
      task({ id: "a", status: "NOT_STARTED" }),
      task({ id: "b", status: "IN_PROGRESS" }),
      task({ id: "c", status: "DONE" }), // done → excluded
      task({ id: "d", status: undefined }), // no status = not done → counts
      task({ id: "e", status: "NOT_STARTED", isDeleted: true }), // deleted → excluded
    ];
    const counts = computeMaterialsCounts({
      nodes,
      notes: [],
      dailies: [],
      tags: [],
    });
    expect(counts.tasks).toBe(3); // a, b, d
  });

  it("counts live notes / dailies / tags and drops soft-deleted ones", () => {
    const counts = computeMaterialsCounts({
      nodes: [],
      notes: [note("n1", false), note("n2", true), note("n3", false)],
      dailies: [daily("2026-07-01"), daily("2026-07-02", true)],
      tags: [tag("g1", false), tag("g2", false), tag("g3", true)],
    });
    expect(counts.notes).toBe(2);
    expect(counts.daily).toBe(1);
    expect(counts.tags).toBe(2);
  });
});
