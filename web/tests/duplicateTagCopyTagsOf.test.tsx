import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type {
  ScheduleItem,
  WikiTagAssignmentUnified as WikiTagAssignment,
  WikiTagUnified,
} from "@life-editor/shared";
import { useDuplicateTagCopy } from "../src/schedule/useDuplicateTagCopy";

/*
 * #2397 — the tags the event bubble draws as chips (`tagsOf`).
 *
 * Two rules decide which tags those are, and neither is visible in the
 * bubble's own suite (it is handed the finished list):
 *
 *   - a repeat's tags hang off the series, not the occurrence (#1632 / #1663),
 *     so an occurrence shows both its own and its routine's, once each — the
 *     same owners the duplicate count reads, so the chips and the "with tags"
 *     choice cannot disagree;
 *   - a tag in the trash is not drawn.
 *
 * Only the tag context is faked: the hook reads nothing else.
 */

const state = vi.hoisted(() => ({
  tags: [] as WikiTagUnified[],
  assignments: {} as Record<string, WikiTagAssignment[]>,
}));

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useWikiTagsUnifiedContext: () => ({
    allTags: state.tags,
    getTagsForItem: (id: string) => state.assignments[id] ?? [],
    bulkAssign: vi.fn(),
    bulkUnassign: vi.fn(),
  }),
}));

const NOW = "2026-10-10T00:00:00.000Z";

function tag(id: string, over: Partial<WikiTagUnified> = {}): WikiTagUnified {
  return {
    id,
    name: id,
    color: null,
    icon: null,
    createdAt: NOW,
    updatedAt: NOW,
    isDeleted: false,
    deletedAt: null,
    ...over,
  };
}

function assignment(itemId: string, tagId: string): WikiTagAssignment {
  return {
    id: `a-${itemId}-${tagId}`,
    itemId,
    tagId,
    createdAt: NOW,
    updatedAt: NOW,
    isDisplayColor: false,
    isDeleted: false,
    deletedAt: null,
  };
}

const ITEM: ScheduleItem = {
  id: "event-1",
  date: "2026-10-10",
  title: "ジム",
  startTime: "16:00",
  endTime: "17:00",
  completed: false,
  completedAt: null,
  routineId: null,
  templateId: null,
  memo: null,
  noteId: null,
  content: null,
  createdAt: NOW,
  updatedAt: NOW,
};

function tagsOf(item: ScheduleItem): string[] {
  const { result } = renderHook(() => useDuplicateTagCopy(vi.fn()));
  return result.current.tagsOf(item).map((t) => t.id);
}

describe("useDuplicateTagCopy — tagsOf (#2397)", () => {
  it("returns the item's own tags as the tags themselves", () => {
    state.tags = [tag("t-work", { name: "仕事", color: "#3366ff" })];
    state.assignments = { "event-1": [assignment("event-1", "t-work")] };
    const { result } = renderHook(() => useDuplicateTagCopy(vi.fn()));
    expect(result.current.tagsOf(ITEM)).toEqual([state.tags[0]]);
  });

  it("adds the series' tags on a repeat's occurrence, once each", () => {
    state.tags = [tag("t-own"), tag("t-series"), tag("t-both")];
    state.assignments = {
      "event-1": [assignment("event-1", "t-own"), assignment("event-1", "t-both")],
      "routine-1": [
        assignment("routine-1", "t-series"),
        assignment("routine-1", "t-both"),
      ],
    };
    expect(tagsOf({ ...ITEM, routineId: "routine-1" })).toEqual([
      "t-own",
      "t-both",
      "t-series",
    ]);
    // A plain event does not borrow a series it does not have.
    expect(tagsOf(ITEM)).toEqual(["t-own", "t-both"]);
  });

  it("leaves out a tag in the trash, and one it cannot find", () => {
    state.tags = [tag("t-live"), tag("t-trashed", { isDeleted: true })];
    state.assignments = {
      "event-1": [
        assignment("event-1", "t-live"),
        assignment("event-1", "t-trashed"),
        assignment("event-1", "t-missing"),
      ],
    };
    expect(tagsOf(ITEM)).toEqual(["t-live"]);
  });
});
