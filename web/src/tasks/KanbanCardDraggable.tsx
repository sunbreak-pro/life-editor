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
 * Cards are registered as sortable items so they can both be reordered within
 * a column (folder view) AND act as drop targets that resolve to their column
 * (status/folder cross-column moves) — see useKanbanDnd.ts.
 */
export function KanbanCardDraggable({
  card,
  labels,
  showFolderPill,
  showTags,
  onSelect,
}: {
  card: KanbanCardModel;
  labels: KanbanLabels;
  showFolderPill: boolean;
  showTags: boolean;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  const { setNodeRef, attributes, listeners, isDragging } = useSortable({
    id: card.id,
  });

  return (
    <KanbanCard
      card={card}
      labels={labels}
      showFolderPill={showFolderPill}
      showTags={showTags}
      onSelect={onSelect}
      dnd={{
        setNodeRef,
        attributes: attributes as unknown as Record<string, unknown>,
        listeners: (listeners ?? undefined) as unknown as
          | Record<string, unknown>
          | undefined,
        isDragging,
      }}
    />
  );
}
