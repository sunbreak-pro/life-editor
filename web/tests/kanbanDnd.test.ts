import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { KanbanColumnModel } from "@life-editor/shared";
import { useKanbanDnd } from "../src/todos/useKanbanDnd";

/*
 * #992 — what a drop DOES. The board's drop resolution had no test at all,
 * which is what made "cards are drop targets" look load-bearing: nothing said
 * out loud that a card drop only ever resolves to a column.
 *
 * The handler is driven directly rather than through the screen (the D-20260812
 * -refactor-2 escape hatch): a real drag needs pointer events over measured
 * rects, and jsdom has no layout, so KanbanView cannot produce a DragEndEvent.
 * The events below are the shape @dnd-kit hands the host — id in, mutation out.
 */

function column(id: string, cardIds: string[]): KanbanColumnModel {
  return {
    id,
    title: id,
    cards: cardIds.map((cardId) => ({
      id: cardId,
      title: cardId,
      status: id === "status-DONE" ? "DONE" : "NOT_STARTED",
    })),
  };
}

const COLUMNS = [
  column("status-NOT_STARTED", ["t-1", "t-2"]),
  column("status-DONE", ["t-3"]),
];

function dragEnd(activeId: string, overId: string | null): DragEndEvent {
  return {
    active: { id: activeId },
    over: overId === null ? null : { id: overId },
  } as unknown as DragEndEvent;
}

function setup(viewMode: "status" | "tag" = "status") {
  const setTodoStatus = vi.fn();
  const hook = renderHook(() =>
    useKanbanDnd({ viewMode, columns: COLUMNS, setTodoStatus }),
  );
  return { setTodoStatus, hook };
}

describe("useKanbanDnd drop resolution (#992)", () => {
  it("moves the todo when it lands on another column", () => {
    const { setTodoStatus, hook } = setup();

    act(() => hook.result.current.handleDragEnd(dragEnd("t-1", "status-DONE")));

    expect(setTodoStatus).toHaveBeenCalledWith("t-1", "DONE");
  });

  it("does nothing when it lands on its own column", () => {
    const { setTodoStatus, hook } = setup();

    act(() =>
      hook.result.current.handleDragEnd(dragEnd("t-1", "status-NOT_STARTED")),
    );

    expect(setTodoStatus).not.toHaveBeenCalled();
  });

  it("still resolves a card-shaped `over` to that card's column", () => {
    // Cards are no longer drop targets, so @dnd-kit stopped producing this —
    // but the fallback is what keeps a re-enabled card droppable from turning
    // every drop into a silent no-op.
    const { setTodoStatus, hook } = setup();

    act(() => hook.result.current.handleDragEnd(dragEnd("t-1", "t-3")));

    expect(setTodoStatus).toHaveBeenCalledWith("t-1", "DONE");
  });

  it("does nothing when the drop misses everything", () => {
    const { setTodoStatus, hook } = setup();

    act(() => hook.result.current.handleDragEnd(dragEnd("t-1", null)));
    act(() => hook.result.current.handleDragEnd(dragEnd("t-1", "nope")));

    expect(setTodoStatus).not.toHaveBeenCalled();
  });

  it("tracks the dragged card so the overlay can draw it", () => {
    const { hook } = setup();

    act(() =>
      hook.result.current.handleDragStart({
        active: { id: "t-2" },
      } as unknown as DragStartEvent),
    );
    expect(hook.result.current.activeCardId).toBe("t-2");

    act(() => hook.result.current.handleDragCancel());
    expect(hook.result.current.activeCardId).toBeNull();
  });

  it("is disabled on the tag view", () => {
    const { hook } = setup("tag");

    expect(hook.result.current.enabled).toBe(false);
  });
});
