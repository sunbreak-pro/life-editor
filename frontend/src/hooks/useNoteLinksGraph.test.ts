import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createMockDataService } from "../test/mockDataService";
import { setDataServiceForTest } from "../services/dataServiceFactory";
import {
  useNoteLinksGraph,
  dispatchNoteLinksChanged,
} from "./useNoteLinksGraph";
import type { NoteLink } from "../types/noteLink";

function makeLink(overrides: Partial<NoteLink> = {}): NoteLink {
  return {
    id: overrides.id ?? `link-${Math.random().toString(36).slice(2, 8)}`,
    sourceNoteId: overrides.sourceNoteId ?? "note-1",
    sourceMemoDate: overrides.sourceMemoDate ?? null,
    targetNoteId: overrides.targetNoteId ?? "note-2",
    targetHeading: overrides.targetHeading ?? null,
    targetBlockId: overrides.targetBlockId ?? null,
    alias: overrides.alias ?? null,
    linkType: overrides.linkType ?? "inline",
    createdAt: overrides.createdAt ?? "2026-04-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-01T00:00:00.000Z",
    version: overrides.version ?? 1,
    isDeleted: overrides.isDeleted ?? 0,
    deletedAt: overrides.deletedAt ?? null,
  };
}

type MockFn = ReturnType<typeof vi.fn>;

function setup(links: NoteLink[] = []) {
  const mock = createMockDataService();
  (mock as unknown as { fetchAllNoteLinks: MockFn }).fetchAllNoteLinks = vi
    .fn()
    .mockResolvedValue(links);
  setDataServiceForTest(mock);
  return mock as unknown as { fetchAllNoteLinks: MockFn };
}

describe("useNoteLinksGraph", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("fetches note links on mount and populates state", async () => {
    const link = makeLink({ id: "link-a" });
    const mock = setup([link]);
    const { result } = renderHook(() => useNoteLinksGraph());

    await waitFor(() => {
      expect(result.current.noteLinks).toHaveLength(1);
    });
    expect(mock.fetchAllNoteLinks).toHaveBeenCalledTimes(1);
    expect(result.current.noteLinks[0].id).toBe("link-a");
  });

  it("filters out soft-deleted links", async () => {
    const kept = makeLink({ id: "kept" });
    const deleted = makeLink({ id: "gone", isDeleted: 1 });
    setup([kept, deleted]);
    const { result } = renderHook(() => useNoteLinksGraph());

    await waitFor(() => {
      expect(result.current.noteLinks).toHaveLength(1);
    });
    expect(result.current.noteLinks[0].id).toBe("kept");
  });

  it("refetches when dispatchNoteLinksChanged is called", async () => {
    const mock = setup([]);
    const { result } = renderHook(() => useNoteLinksGraph());

    await waitFor(() => {
      expect(mock.fetchAllNoteLinks).toHaveBeenCalledTimes(1);
    });

    const later = makeLink({ id: "added-later" });
    mock.fetchAllNoteLinks.mockResolvedValueOnce([later]);

    act(() => {
      dispatchNoteLinksChanged();
    });

    await waitFor(() => {
      expect(mock.fetchAllNoteLinks).toHaveBeenCalledTimes(2);
      expect(result.current.noteLinks).toEqual([later]);
    });
  });

  it("removes the event listener on unmount", async () => {
    const mock = setup([]);
    const { unmount } = renderHook(() => useNoteLinksGraph());

    await waitFor(() => {
      expect(mock.fetchAllNoteLinks).toHaveBeenCalledTimes(1);
    });

    unmount();

    act(() => {
      dispatchNoteLinksChanged();
    });

    // Give any pending microtasks a chance to flush.
    await new Promise((r) => setTimeout(r, 0));
    expect(mock.fetchAllNoteLinks).toHaveBeenCalledTimes(1);
  });

  it("logs a service error when fetch fails and keeps state empty", async () => {
    const mock = createMockDataService();
    const fetchFn = vi.fn().mockRejectedValue(new Error("db down"));
    (mock as unknown as { fetchAllNoteLinks: MockFn }).fetchAllNoteLinks =
      fetchFn;
    setDataServiceForTest(mock);

    const { result } = renderHook(() => useNoteLinksGraph());

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
    expect(result.current.noteLinks).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });
});
