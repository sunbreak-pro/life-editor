import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useWikiTagsUnifiedAPI } from "../src/hooks/useWikiTagsUnifiedAPI";
import type { WikiTagAssignment } from "../src/types/wikiTagUnified";
import { createBumpableSync } from "./helpers/bumpableSync";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * The bulk tag writes (#1644): sequential single-row DataService calls with a
 * success / failure count, and a merge that runs assign → unassign → soft
 * delete (plan assumption 4) and keeps the source when anything failed.
 *
 * One ordered log across every write method, so "the order" is asserted as
 * the order the service actually saw — not as three separate call lists that
 * could each be right while interleaved wrongly.
 */

const { wrapper } = createBumpableSync();

const row = (id: string, itemId: string, tagId: string): WikiTagAssignment => ({
  id,
  itemId,
  tagId,
  createdAt: "2026-09-01T00:00:00Z",
  isDisplayColor: false,
  updatedAt: "2026-09-01T00:00:00Z",
  isDeleted: false,
  deletedAt: null,
});

function setup(failAssignFor: readonly string[] = []) {
  const log: string[] = [];
  const ds = stubDataService({
    listAllWikiTagsUnified: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
    listAllTagAssignments: vi
      .fn()
      .mockResolvedValue([
        row("a-1", "note-1", "t-src"),
        row("a-2", "note-2", "t-src"),
        row("a-3", "note-3", "t-src"),
      ]),
    assignTagToItem: vi.fn(
      async (id: string, itemId: string, tagId: string) => {
        log.push(`assign ${itemId}→${tagId}`);
        if (failAssignFor.includes(itemId)) throw new Error("offline");
        return row(id, itemId, tagId);
      },
    ),
    unassignTagFromItem: vi.fn(async (id: string) => {
      log.push(`unassign ${id}`);
    }),
    softDeleteWikiTagUnified: vi.fn(async (id: string) => {
      log.push(`delete ${id}`);
    }),
  });
  const hook = renderHook(() => useWikiTagsUnifiedAPI({ dataService: ds }), {
    wrapper,
  });
  return { hook, log };
}

async function loaded(setupResult: ReturnType<typeof setup>) {
  await waitFor(() =>
    expect(setupResult.hook.result.current.allAssignments).toHaveLength(3),
  );
  return setupResult;
}

describe("useWikiTagsUnifiedAPI — bulk writes (#1644)", () => {
  it("assigns one row per item and counts them", async () => {
    const { hook, log } = await loaded(setup());
    let result;
    await act(async () => {
      result = await hook.result.current.bulkAssign(
        ["note-1", "note-2", "note-3"],
        "t-dst",
      );
    });
    expect(result).toEqual({ succeeded: 3, failed: 0 });
    expect(log).toEqual([
      "assign note-1→t-dst",
      "assign note-2→t-dst",
      "assign note-3→t-dst",
    ]);
  });

  it("keeps going past a failed row and reports it", async () => {
    const { hook } = await loaded(setup(["note-2"]));
    let result;
    await act(async () => {
      result = await hook.result.current.bulkAssign(
        ["note-1", "note-2", "note-3"],
        "t-dst",
      );
    });
    expect(result).toEqual({ succeeded: 2, failed: 1 });
  });

  it("unassigns through the rows the cache holds", async () => {
    const { hook, log } = await loaded(setup());
    await act(async () => {
      await hook.result.current.bulkUnassign(["note-1", "note-3"], "t-src");
    });
    expect(log).toEqual(["unassign a-1", "unassign a-3"]);
  });

  it("merges in the order assign → unassign → soft delete", async () => {
    const { hook, log } = await loaded(setup());
    let result;
    await act(async () => {
      result = await hook.result.current.mergeTags("t-src", "t-dst");
    });
    expect(result).toEqual({ succeeded: 3, failed: 0, sourceDeleted: true });
    expect(log).toEqual([
      "assign note-1→t-dst",
      "assign note-2→t-dst",
      "assign note-3→t-dst",
      "unassign a-1",
      "unassign a-2",
      "unassign a-3",
      "delete t-src",
    ]);
  });

  it("keeps the source, and the failed item's old row, when a move fails", async () => {
    const { hook, log } = await loaded(setup(["note-2"]));
    let result;
    await act(async () => {
      result = await hook.result.current.mergeTags("t-src", "t-dst");
    });
    expect(result).toEqual({ succeeded: 2, failed: 1, sourceDeleted: false });
    expect(log).not.toContain("unassign a-2");
    expect(log.some((line) => line.startsWith("delete"))).toBe(false);
  });
});
