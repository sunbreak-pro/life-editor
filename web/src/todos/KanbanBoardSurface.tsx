import { useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  closestCorners,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import {
  KanbanBoard,
  KanbanCard,
  useTranslation,
  type KanbanCardModel,
  type KanbanColumnModel,
  type KanbanLabels,
  type KanbanViewMode,
} from "@life-editor/shared";
import { KanbanColumnDroppable } from "./KanbanColumnDroppable";
import { type useKanbanDnd } from "./useKanbanDnd";

interface KanbanBoardSurfaceProps {
  columns: KanbanColumnModel[];
  labels: KanbanLabels;
  viewMode: KanbanViewMode;
  onViewModeChange: (mode: KanbanViewMode) => void;
  onSelectCard: (id: string) => void;
  onColorChange: (columnId: string, color: string | null) => void;
  /** Opens the host's add dialog — the toolbar's only trailing action. */
  onAdd: () => void;
  dnd: ReturnType<typeof useKanbanDnd>;
}

/*
 * The board itself (#896, out of KanbanView): the toolbar's "+ Add", and the
 * choice between the plain board and the DnD one.
 *
 * K-DnD (status view only): drag a card between status columns to SET the todo
 * status. The tag view is NOT draggable — a column IS an assignment there, so
 * reassigning a multi-tag card by drag is ambiguous, and editing tags on a card
 * would move it out from under the pointer mid-interaction. The host renders
 * the plain board in that mode, which is what `dnd.enabled` reports.
 *
 * @dnd-kit lives only in web/ (here + useKanbanDnd + KanbanColumnDroppable +
 * KanbanCardDraggable); the shared Kanban package never imports it.
 */
export function KanbanBoardSurface({
  columns,
  labels,
  viewMode,
  onViewModeChange,
  onSelectCard,
  onColorChange,
  onAdd,
  dnd,
}: KanbanBoardSurfaceProps): React.JSX.Element {
  const { t } = useTranslation();

  // The card currently being dragged, for the DragOverlay ghost.
  const activeCard = useMemo<KanbanCardModel | null>(() => {
    if (!dnd.activeCardId) return null;
    for (const col of columns) {
      const found = col.cards.find((c) => c.id === dnd.activeCardId);
      if (found) return found;
    }
    return null;
  }, [dnd.activeCardId, columns]);

  // "+ Add" entry point in the board toolbar — opens the add dialog. Accent
  // pill (mock): Plus 14 + 13px medium label, 8px radius.
  const headerActions = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-lumen-accent px-3.5 py-1.5 text-[0.8125rem] font-medium text-lumen-on-accent shadow-lumen-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
      >
        <Plus size={14} aria-hidden />
        {t("kanban.addTodo")}
      </button>
    </div>
  );

  // Shared between both branches so the two boards cannot drift apart.
  const boardProps = {
    columns,
    labels,
    viewMode,
    onViewModeChange,
    onSelectCard,
    onColorChange,
    headerActions,
  };

  // Tag view (read-only DnD) → plain board; status view → DnD board.
  if (!dnd.enabled) return <KanbanBoard {...boardProps} />;

  return (
    <DndContext
      sensors={dnd.sensors}
      collisionDetection={closestCorners}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={dnd.handleDragStart}
      onDragEnd={dnd.handleDragEnd}
      onDragCancel={dnd.handleDragCancel}
    >
      <KanbanBoard
        {...boardProps}
        renderColumn={({ column, showTags, fluidWidth }) => (
          <KanbanColumnDroppable
            column={column}
            labels={labels}
            showTags={showTags}
            fluidWidth={fluidWidth}
            onSelectCard={onSelectCard}
            onColorChange={onColorChange}
          />
        )}
        overlay={
          <DragOverlay>
            {activeCard ? (
              <div className="w-[316px] px-2.5">
                <KanbanCard
                  card={activeCard}
                  labels={labels}
                  showTags={viewMode !== "tag"}
                  onSelect={() => undefined}
                />
              </div>
            ) : null}
          </DragOverlay>
        }
      />
    </DndContext>
  );
}
