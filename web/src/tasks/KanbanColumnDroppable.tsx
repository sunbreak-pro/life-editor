import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  KanbanColumn,
  type KanbanColumnModel,
  type KanbanLabels,
} from "@life-editor/shared";
import { KanbanCardDraggable } from "./KanbanCardDraggable";

/*
 * Host-side droppable wrapper for a Kanban column (K-DnD). Registers the
 * column as a @dnd-kit droppable (its id IS the column id — `status-<STATUS>`
 * in status view) and wraps its cards in a SortableContext. Feeds the
 * resulting refs/flags into the PURE shared <KanbanColumn> via its `dnd` +
 * `renderCard` props, so @dnd-kit stays entirely in web/.
 */
export function KanbanColumnDroppable({
  column,
  labels,
  showTags,
  onSelectCard,
  onColorChange,
}: {
  column: KanbanColumnModel;
  labels: KanbanLabels;
  showTags: boolean;
  onSelectCard: (id: string) => void;
  onColorChange?: (columnId: string, color: string | null) => void;
}): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const cardIds = column.cards.map((c) => c.id);

  return (
    <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
      <KanbanColumn
        column={column}
        labels={labels}
        showTags={showTags}
        onSelectCard={onSelectCard}
        onColorChange={onColorChange}
        dnd={{ setNodeRef, isOver }}
        renderCard={(card) => (
          <KanbanCardDraggable
            card={card}
            labels={labels}
            showTags={showTags}
            onSelect={onSelectCard}
          />
        )}
      />
    </SortableContext>
  );
}
