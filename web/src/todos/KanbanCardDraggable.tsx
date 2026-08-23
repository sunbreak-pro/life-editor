import { useSortable } from "@dnd-kit/sortable";
import {
  KanbanCard,
  type KanbanCardModel,
  type KanbanLabels,
} from "@life-editor/shared";

/*
 * Host-side draggable wrapper for a Kanban card (K-DnD). Calls @dnd-kit's
 * useSortable and feeds the resulting refs/listeners into the PURE shared
 * <KanbanCard> via its `dnd` adapter prop. This keeps @dnd-kit entirely in
 * web/ (the shared package never imports it).
 *
 * Cards are sortable ITEMS but not drop TARGETS (#992). `disabled.droppable`
 * keeps the half the keyboard sensor needs — `sortableKeyboardCoordinates`
 * looks the ACTIVE id up in the droppable map and gives up when it is missing,
 * so a plain `useDraggable` would silently kill arrow-key dragging — while
 * taking every card out of the drop-target passes. @dnd-kit measures and runs
 * collision detection over the ENABLED containers only, and this board measures
 * with `MeasuringStrategy.Always` (KanbanBoardSurface.tsx), so a drag used to
 * re-measure one rect per card on every frame. Now it measures the columns.
 *
 * Dropping onto a card still lands in that card's column: the column under the
 * card is the drop target, and useKanbanDnd resolves either id to a column.
 */
export function KanbanCardDraggable({
  card,
  labels,
  showTags,
  onSelect,
}: {
  card: KanbanCardModel;
  labels: KanbanLabels;
  showTags: boolean;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  const { setNodeRef, attributes, listeners, isDragging } = useSortable({
    id: card.id,
    disabled: { droppable: true },
  });

  return (
    <KanbanCard
      card={card}
      labels={labels}
      showTags={showTags}
      onSelect={onSelect}
      dnd={{
        setNodeRef,
        attributes: attributes as unknown as Record<string, unknown>,
        listeners: (listeners ?? undefined) as unknown as
          Record<string, unknown> | undefined,
        isDragging,
      }}
    />
  );
}
