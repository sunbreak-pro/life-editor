import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

/*
 * #507 — the task body's "[[" wiring. The graph half is what has logic worth
 * pinning: a resolved link becomes an item_links edge from the task, so a link
 * written in a task reaches Connect and the target's backlinks the same way a
 * link written in a note does.
 *
 * The three guards below each stand for a way the edge write can go wrong, and
 * they are the same ones useNoteLinking carries — this hook exists so the task
 * side cannot quietly grow a different answer to them.
 */

const createItemLink = vi.fn(() => Promise.resolve());
let outgoing: { toItemId: string; isDeleted?: boolean }[] = [];

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useWikiTagsUnifiedContext: () => ({
    createItemLink,
    getLinksForItem: () => ({ incoming: [], outgoing }),
  }),
  useSyncDomains: () => 0,
}));

const { useTaskLinking } = await import("../src/tasks/hooks/useTaskLinking");

function link(from: string, to: string) {
  const { result } = renderHook(() => useTaskLinking({}));
  result.current.handleResolvedLinkInserted(from, to);
}

beforeEach(() => {
  createItemLink.mockClear();
  outgoing = [];
});

describe("useTaskLinking edge mirroring", () => {
  it("writes an edge from the task to the link target", () => {
    link("task-1", "note-9");
    expect(createItemLink).toHaveBeenCalledExactlyOnceWith("task-1", "note-9");
  });

  it("skips an edge that already exists", () => {
    outgoing = [{ toItemId: "note-9" }];
    link("task-1", "note-9");
    expect(createItemLink).not.toHaveBeenCalled();
  });

  // A deleted edge is not a live one: re-linking has to write again, or a link
  // removed once could never be restored by typing it back.
  it("writes again when the existing edge is deleted", () => {
    outgoing = [{ toItemId: "note-9", isDeleted: true }];
    link("task-1", "note-9");
    expect(createItemLink).toHaveBeenCalledExactlyOnceWith("task-1", "note-9");
  });

  it("skips a self-link", () => {
    link("task-1", "task-1");
    expect(createItemLink).not.toHaveBeenCalled();
  });
});
