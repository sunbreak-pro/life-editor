import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useNoteBodySearch } from "../src/hooks/useNoteBodySearch";
import { stubDataService } from "./helpers/dataServiceStub";
import { makeNote } from "./helpers/nodeFixtures";
import type { DataService } from "../src/services/DataService";
import type { NoteNode } from "../src/types/note";

/*
 * #1837 — the server half of the notes search.
 *
 * The list is body-free, so a word that only appears in a note's body used to
 * match nothing at all. This hook asks the database the same question the box
 * asks and hands back the ids. What has to hold:
 *
 *   - typing does not fire a query per keystroke
 *   - a slow answer to an earlier, broader query never overwrites a newer one
 *   - clearing the box clears the ids AND asks nothing
 *   - a failed search leaves the title matches on screen rather than throwing
 */

function makeDS(search: (q: string) => Promise<NoteNode[]>) {
  const searchNotesUnified = vi.fn(search);
  return {
    ds: stubDataService({ searchNotesUnified }) as DataService,
    searchNotesUnified,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useNoteBodySearch (#1837)", () => {
  it("waits for typing to stop before it asks", async () => {
    vi.useFakeTimers();
    const { ds, searchNotesUnified } = makeDS(async () => []);
    const { rerender } = renderHook(({ q }) => useNoteBodySearch(ds, q), {
      initialProps: { q: "a" },
    });

    rerender({ q: "ab" });
    rerender({ q: "abc" });
    act(() => void vi.advanceTimersByTime(299));
    expect(searchNotesUnified).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(searchNotesUnified).toHaveBeenCalledTimes(1);
    expect(searchNotesUnified).toHaveBeenCalledWith("abc");
  });

  it("keeps the newest query's answer when an older one lands late", async () => {
    const settle: Record<string, (notes: NoteNode[]) => void> = {};
    const { ds } = makeDS(
      (q) =>
        new Promise<NoteNode[]>((resolve) => {
          settle[q] = resolve;
        }),
    );
    const { result, rerender } = renderHook(
      ({ q }) => useNoteBodySearch(ds, q),
      { initialProps: { q: "wide" } },
    );

    await waitFor(() => expect(settle.wide).toBeDefined());
    rerender({ q: "narrow" });
    await waitFor(() => expect(settle.narrow).toBeDefined());

    // The narrow answer arrives first, then the broad one it replaced.
    await act(async () => {
      settle.narrow([makeNote("n-narrow")]);
    });
    await act(async () => {
      settle.wide([makeNote("n-a"), makeNote("n-b")]);
    });

    expect([...(result.current.bodyMatchIds ?? [])]).toEqual(["n-narrow"]);
  });

  it("clears the ids and asks nothing once the box is empty", async () => {
    const { ds, searchNotesUnified } = makeDS(async () => [makeNote("n-a")]);
    const { result, rerender } = renderHook(
      ({ q }) => useNoteBodySearch(ds, q),
      { initialProps: { q: "hit" } },
    );

    await waitFor(() =>
      expect(result.current.bodyMatchIds?.has("n-a")).toBe(true),
    );

    rerender({ q: "  " });
    await waitFor(() => expect(result.current.bodyMatchIds).toBeNull());
    expect(result.current.isSearching).toBe(false);
    expect(searchNotesUnified).toHaveBeenCalledTimes(1);
  });

  it("settles without throwing when the search fails", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds } = makeDS(async () => {
      throw new Error("offline");
    });
    const { result } = renderHook(() => useNoteBodySearch(ds, "boom"));

    await waitFor(() => expect(result.current.isSearching).toBe(false));
    // Null, not empty: the search never answered, so the title filter must
    // keep standing on its own rather than being narrowed to nothing.
    expect(result.current.bodyMatchIds).toBeNull();
    expect(spy).toHaveBeenCalled();
  });
});
