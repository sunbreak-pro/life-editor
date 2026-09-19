import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { UNTAGGED_GROUP_KEY } from "@life-editor/shared";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  useNoteTagDnd,
  noteDraggableId,
  tagDroppableId,
  planTagMove,
  UNTAGGED_DROP_ID,
  type NoteTagMove,
} from "../src/notes/useNoteTagDnd";

/*
 * #1687 — a drop in the Notes side list MOVES the note between headings.
 *
 * The gesture itself cannot be driven here: jsdom has no layout, so @dnd-kit
 * has no rects to collide (CLAUDE.md §7.1). The two halves that DECIDE are
 * pure and are what these cover — `handleDragEnd` (which move a drop is) and
 * `planTagMove` (which writes that move comes down to). Together they are the
 * five cases the Issue lists.
 */

const NOTE = "note-a";

function endEvent(dragId: string, overId: string | null): DragEndEvent {
  return {
    active: { id: dragId },
    over: overId === null ? null : { id: overId },
  } as unknown as DragEndEvent;
}

function drop(dragId: string, overId: string | null): NoteTagMove | null {
  const onMove = vi.fn();
  const { result } = renderHook(() => useNoteTagDnd({ notes: [], onMove }));
  act(() => result.current.handleDragEnd(endEvent(dragId, overId)));
  return (onMove.mock.calls[0]?.[0] as NoteTagMove) ?? null;
}

describe("useNoteTagDnd — which move a drop is (#1687)", () => {
  it("reads the source tag off the row that was dragged", () => {
    expect(
      drop(noteDraggableId("tag-a", NOTE), tagDroppableId("tag-b")),
    ).toEqual({ noteId: NOTE, fromTagId: "tag-a", toTagId: "tag-b" });
  });

  it("treats a row dragged out of the untagged bucket as having no source", () => {
    expect(
      drop(noteDraggableId(UNTAGGED_GROUP_KEY, NOTE), tagDroppableId("tag-b")),
    ).toEqual({ noteId: NOTE, fromTagId: null, toTagId: "tag-b" });
  });

  it("accepts the untagged bucket as a target", () => {
    // Before #1687 it was not a droppable at all, which is why a note could
    // never be dragged back out of a tag.
    expect(drop(noteDraggableId("tag-a", NOTE), UNTAGGED_DROP_ID)).toEqual({
      noteId: NOTE,
      fromTagId: "tag-a",
      toTagId: null,
    });
  });

  it("does nothing when the row lands back on its own heading", () => {
    expect(drop(noteDraggableId("tag-a", NOTE), tagDroppableId("tag-a"))).toBe(
      null,
    );
    expect(
      drop(noteDraggableId(UNTAGGED_GROUP_KEY, NOTE), UNTAGGED_DROP_ID),
    ).toBe(null);
  });

  it("does nothing when the drop lands on nothing", () => {
    expect(drop(noteDraggableId("tag-a", NOTE), null)).toBe(null);
    expect(drop(noteDraggableId("tag-a", NOTE), "something-else")).toBe(null);
  });
});

describe("planTagMove — which writes a move comes down to (#1687)", () => {
  const assignment = (id: string, tagId: string, isDeleted = false) => ({
    id,
    tagId,
    isDeleted,
  });

  it("removes the source tag and adds the target one", () => {
    expect(
      planTagMove({ noteId: NOTE, fromTagId: "tag-a", toTagId: "tag-b" }, [
        assignment("asg-1", "tag-a"),
      ]),
    ).toEqual({ unassignId: "asg-1", assignTagId: "tag-b" });
  });

  it("only adds when the note came from the untagged bucket", () => {
    expect(
      planTagMove({ noteId: NOTE, fromTagId: null, toTagId: "tag-b" }, []),
    ).toEqual({ unassignId: null, assignTagId: "tag-b" });
  });

  it("only removes the source tag when dropped on untagged", () => {
    // The note's OTHER tags stay — "remove every tag" is not this gesture.
    expect(
      planTagMove({ noteId: NOTE, fromTagId: "tag-a", toTagId: null }, [
        assignment("asg-1", "tag-a"),
        assignment("asg-2", "tag-c"),
      ]),
    ).toEqual({ unassignId: "asg-1", assignTagId: null });
  });

  it("only removes when the note already carries the target tag", () => {
    expect(
      planTagMove({ noteId: NOTE, fromTagId: "tag-a", toTagId: "tag-b" }, [
        assignment("asg-1", "tag-a"),
        assignment("asg-2", "tag-b"),
      ]),
    ).toEqual({ unassignId: "asg-1", assignTagId: null });
  });

  it("still adds when the source assignment is already gone", () => {
    // A drag that outlived a sync: swallowing the add too would leave the
    // note where it was with no sign the drop happened.
    expect(
      planTagMove({ noteId: NOTE, fromTagId: "tag-a", toTagId: "tag-b" }, [
        assignment("asg-1", "tag-a", true),
      ]),
    ).toEqual({ unassignId: null, assignTagId: "tag-b" });
  });
});
