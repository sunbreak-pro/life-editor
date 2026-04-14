import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNoteTreeMovement } from "./useNoteTreeMovement";
import type { NoteNode } from "../types/note";

function makeNote(overrides: Partial<NoteNode> = {}): NoteNode {
  return {
    id: "note-1",
    type: "note",
    title: "Test",
    content: "",
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("useNoteTreeMovement", () => {
  describe("moveNodeInto", () => {
    it("moves a node into a folder as last child by default", () => {
      const persist = vi.fn();
      const notes: NoteNode[] = [
        makeNote({ id: "folder-1", type: "folder", parentId: null, order: 0 }),
        makeNote({ id: "child-1", parentId: "folder-1", order: 0 }),
        makeNote({ id: "note-1", parentId: null, order: 1 }),
      ];

      const { result } = renderHook(() => useNoteTreeMovement(notes, persist));

      act(() => {
        const res = result.current.moveNodeInto("note-1", "folder-1");
        expect(res.success).toBe(true);
      });

      expect(persist).toHaveBeenCalledOnce();
      const [, updated] = persist.mock.calls[0];
      const moved = updated.find((n: NoteNode) => n.id === "note-1");
      expect(moved.parentId).toBe("folder-1");
      expect(moved.order).toBe(1); // after child-1
    });

    it("moves a node into a folder at insertIndex 0 (first child)", () => {
      const persist = vi.fn();
      const notes: NoteNode[] = [
        makeNote({ id: "folder-1", type: "folder", parentId: null, order: 0 }),
        makeNote({ id: "child-1", parentId: "folder-1", order: 0 }),
        makeNote({ id: "child-2", parentId: "folder-1", order: 1 }),
        makeNote({ id: "note-1", parentId: null, order: 1 }),
      ];

      const { result } = renderHook(() => useNoteTreeMovement(notes, persist));

      act(() => {
        const res = result.current.moveNodeInto("note-1", "folder-1", 0);
        expect(res.success).toBe(true);
      });

      expect(persist).toHaveBeenCalledOnce();
      const [, updated] = persist.mock.calls[0];
      const moved = updated.find((n: NoteNode) => n.id === "note-1");
      const child1 = updated.find((n: NoteNode) => n.id === "child-1");
      const child2 = updated.find((n: NoteNode) => n.id === "child-2");
      expect(moved.parentId).toBe("folder-1");
      expect(moved.order).toBe(0);
      expect(child1.order).toBe(1);
      expect(child2.order).toBe(2);
    });

    it("rejects moving into a note (non-folder)", () => {
      const persist = vi.fn();
      const notes: NoteNode[] = [
        makeNote({ id: "note-1", parentId: null, order: 0 }),
        makeNote({ id: "note-2", parentId: null, order: 1 }),
      ];

      const { result } = renderHook(() => useNoteTreeMovement(notes, persist));

      act(() => {
        const res = result.current.moveNodeInto("note-1", "note-2");
        expect(res.success).toBe(false);
      });

      expect(persist).not.toHaveBeenCalled();
    });

    it("rejects moving if already in target folder", () => {
      const persist = vi.fn();
      const notes: NoteNode[] = [
        makeNote({ id: "folder-1", type: "folder", parentId: null, order: 0 }),
        makeNote({ id: "note-1", parentId: "folder-1", order: 0 }),
      ];

      const { result } = renderHook(() => useNoteTreeMovement(notes, persist));

      act(() => {
        const res = result.current.moveNodeInto("note-1", "folder-1");
        expect(res.success).toBe(false);
      });

      expect(persist).not.toHaveBeenCalled();
    });

    it("rejects circular reference", () => {
      const persist = vi.fn();
      const notes: NoteNode[] = [
        makeNote({ id: "folder-1", type: "folder", parentId: null, order: 0 }),
        makeNote({
          id: "folder-2",
          type: "folder",
          parentId: "folder-1",
          order: 0,
        }),
      ];

      const { result } = renderHook(() => useNoteTreeMovement(notes, persist));

      act(() => {
        const res = result.current.moveNodeInto("folder-1", "folder-2");
        expect(res.success).toBe(false);
      });

      expect(persist).not.toHaveBeenCalled();
    });
  });
});
