import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DndContext, useDndContext } from "@dnd-kit/core";
import type { KanbanColumnModel, KanbanLabels } from "@life-editor/shared";
import { KanbanColumnDroppable } from "../src/todos/KanbanColumnDroppable";

/*
 * #992 — how many drop targets a board registers.
 *
 * Cards are draggable, and they used to be droppable too (`useSortable`
 * registers both halves). Nothing needed that: a card drop resolves to the
 * card's COLUMN either way (useKanbanDnd), and the board measures with
 * `MeasuringStrategy.Always`, so every enabled droppable was re-measured on
 * every frame of every drag — one rect per card.
 *
 * The count is invisible in the DOM (@dnd-kit renders attributes for
 * draggables but nothing for droppables), so this reads it from
 * `useDndContext`, which is public API. The suite owns the DndContext for that
 * reason — the board keeps its own inside KanbanBoardSurface, where no probe
 * can be handed in.
 *
 * The assertion is on the INVARIANT ("the enabled drop targets are exactly the
 * columns"), not on how it is reached, so switching cards to `useDraggable`
 * later would keep this green.
 */

const LABELS: KanbanLabels = {
  viewStatus: "Status",
  viewTag: "Tag",
  segmentedGroupLabel: "Group by",
  statusNotStarted: "Not started",
  statusDone: "Done",
  cardAriaLabel: (title, statusText) => `${title} (${statusText})`,
  emptyColumn: "Empty",
  placeholderHint: "Coming soon",
  countAriaLabel: (n) => `${n} cards`,
  untagged: "Untagged",
  colorPickerLabel: "Color",
  colorClearLabel: "Default",
  colorCustomLabel: "Custom",
};

function column(id: string, cardIds: string[]): KanbanColumnModel {
  return {
    id,
    title: id,
    statusKind: id === "status-DONE" ? "DONE" : "NOT_STARTED",
    cards: cardIds.map((cardId) => ({
      id: cardId,
      title: cardId,
      status: id === "status-DONE" ? "DONE" : "NOT_STARTED",
    })),
  };
}

const COLUMNS = [
  column("status-NOT_STARTED", ["t-1", "t-2", "t-3", "t-4"]),
  column("status-DONE", ["t-5", "t-6"]),
];

/** Records the enabled drop targets on every render of the context. */
function DropTargetProbe({ sink }: { sink: string[][] }): null {
  const { droppableContainers } = useDndContext();
  sink.push(droppableContainers.getEnabled().map((c) => String(c.id)));
  return null;
}

function renderBoard(): { enabled: string[]; container: HTMLElement } {
  const sink: string[][] = [];
  const { container } = render(
    <DndContext>
      {COLUMNS.map((col) => (
        <KanbanColumnDroppable
          key={col.id}
          column={col}
          labels={LABELS}
          showTags={false}
          onSelectCard={() => undefined}
        />
      ))}
      <DropTargetProbe sink={sink} />
    </DndContext>,
  );
  // Registration happens in an effect, so the last render is the settled one.
  return { enabled: sink[sink.length - 1] ?? [], container };
}

describe("Kanban drop targets (#992)", () => {
  it("registers one enabled drop target per column, none per card", () => {
    const { enabled } = renderBoard();

    expect([...enabled].sort()).toEqual(["status-DONE", "status-NOT_STARTED"]);
    // Said again as a count, because the failure this guards against is
    // "6 cards came back as drop targets", not "a column went missing".
    expect(enabled).toHaveLength(COLUMNS.length);
  });

  it("keeps every card draggable", () => {
    const { container } = renderBoard();

    const cardCount = COLUMNS.reduce((n, c) => n + c.cards.length, 0);
    expect(
      container.querySelectorAll("[aria-roledescription=sortable]"),
    ).toHaveLength(cardCount);
  });
});
