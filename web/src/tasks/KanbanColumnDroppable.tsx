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
 * column as a @dnd-kit droppable (its id IS the column id — a folder id in
 * folder view, `status-<STATUS>` in status view) and wraps its cards in a
 * SortableContext for within-column reordering. Feeds the resulting refs/flags
 * into the PURE shared <KanbanColumn> via its `dnd` + `renderCard` props, so
 * @dnd-kit stays entirely in web/.
 */
export function KanbanColumnDroppable({
  column,
  labels,
  showFolderPill,
  showTags,
  showFolderAccent,
  onSelectCard,
  onColorChange,
}: {
  column: KanbanColumnModel;
  labels: KanbanLabels;
  showFolderPill: boolean;
  showTags: boolean;
  showFolderAccent: boolean;
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
        showFolderPill={showFolderPill}
        showTags={showTags}
        showFolderAccent={showFolderAccent}
        onSelectCard={onSelectCard}
        onColorChange={onColorChange}
        dnd={{ setNodeRef, isOver }}
        renderCard={(card) => (
          <KanbanCardDraggable
            card={card}
            labels={labels}
            showFolderPill={showFolderPill}
            showTags={showTags}
            onSelect={onSelectCard}
          />
        )}
      />
    </SortableContext>
  );
}
