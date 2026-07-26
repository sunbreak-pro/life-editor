import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFrozenNoteSortKey } from "../src/hooks/useFrozenNoteSortKey";
import type { NoteNode } from "../src/types/note";

/*
 * #366 — the sidebar row the user is typing into must not move. The hook
 * snapshots the selected note's sort key so `sortNotesForList` can compare it
 * by the value it had at selection time, while every later `updatedAt` bump
 * (one per debounced save) is ignored until the selection changes.
 */

function makeNote(overrides: Partial<NoteNode> & { id: string }): NoteNode {
  return {
    type: "note",
    title: "",
    content: "",
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("useFrozenNoteSortKey (#366)", () => {
  it("returns null when nothing is selected", () => {
    const notes = [makeNote({ id: "a" })];
    const { result } = renderHook(() => useFrozenNoteSortKey(null, notes));
    expect(result.current).toBeNull();
  });

  it("keeps the key captured at selection while the note keeps saving", () => {
    const initial = [
      makeNote({ id: "a", updatedAt: "2026-02-01T00:00:00.000Z" }),
    ];
    const { result, rerender } = renderHook(
      ({ notes }: { notes: NoteNode[] }) => useFrozenNoteSortKey("a", notes),
      { initialProps: { notes: initial } },
    );
    expect(result.current?.updatedAt).toBe("2026-02-01T00:00:00.000Z");

    // Two debounced saves land — the hold must not follow them.
    rerender({
      notes: [makeNote({ id: "a", updatedAt: "2026-02-01T00:05:00.000Z" })],
    });
    rerender({
      notes: [makeNote({ id: "a", updatedAt: "2026-02-01T00:09:00.000Z" })],
    });
    expect(result.current?.updatedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("re-snapshots when the selection moves to another note", () => {
    const notes = [
      makeNote({ id: "a", updatedAt: "2026-02-01T00:00:00.000Z" }),
      makeNote({ id: "b", updatedAt: "2026-03-01T00:00:00.000Z" }),
    ];
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useFrozenNoteSortKey(id, notes),
      { initialProps: { id: "a" as string | null } },
    );
    expect(result.current?.id).toBe("a");

    rerender({ id: "b" });
    expect(result.current).toEqual({
      id: "b",
      title: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    });

    rerender({ id: null });
    expect(result.current).toBeNull();
  });

  it("captures a note that reaches the list after being selected", () => {
    // A freshly created note is selected before the list state carries it.
    const { result, rerender } = renderHook(
      ({ notes }: { notes: NoteNode[] }) => useFrozenNoteSortKey("new", notes),
      { initialProps: { notes: [] as NoteNode[] } },
    );
    expect(result.current).toBeNull();

    rerender({
      notes: [makeNote({ id: "new", updatedAt: "2026-04-01T00:00:00.000Z" })],
    });
    expect(result.current?.updatedAt).toBe("2026-04-01T00:00:00.000Z");

    // …and from then on it holds, like any other selection.
    rerender({
      notes: [makeNote({ id: "new", updatedAt: "2026-04-01T00:08:00.000Z" })],
    });
    expect(result.current?.updatedAt).toBe("2026-04-01T00:00:00.000Z");
  });
});
