import { useCallback, useMemo, useState } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  type KanbanColumnModel,
  type KanbanViewMode,
  type TodoStatus,
} from "@life-editor/shared";

/*
 * Kanban DnD glue (K-DnD), web-side. Owns @dnd-kit so the shared Kanban
 * package stays UI/dnd-free. Translates a card drop into a Todos mutation:
 *
 *   - status view: dropping a card into another column SETS the todo status
 *     (column id = `status-<STATUS>`). Same-column reorder is meaningless for
 *     status grouping (cards are grouped by status, not user-ordered), so it
 *     is a no-op.
 *   - tag view: not draggable (reassigning a multi-tag card by drag is
 *     ambiguous). The host omits DnD wiring there.
 *
 * (life-tags S1 retired the folder view + its move-into-folder / move-to-root
 * drop paths.)
 *
 * Drop-target resolution: `over` is the column droppable — cards stopped being
 * drop targets in #992, so a card dropped onto another card resolves through
 * the column underneath it. The card-id branch below stays anyway: it costs one
 * Map lookup, and it is the only thing standing between a card droppable that
 * gets re-enabled and a drop that silently does nothing.
 */

const STATUS_COL_PREFIX = "status-";

function parseStatusColumnId(columnId: string): TodoStatus | null {
  if (!columnId.startsWith(STATUS_COL_PREFIX)) return null;
  const raw = columnId.slice(STATUS_COL_PREFIX.length);
  if (raw === "NOT_STARTED" || raw === "DONE") {
    return raw;
  }
  return null;
}

interface UseKanbanDndParams {
  viewMode: KanbanViewMode;
  columns: KanbanColumnModel[];
  setTodoStatus: (id: string, status: TodoStatus) => void;
}

export interface UseKanbanDndResult {
  sensors: ReturnType<typeof useSensors>;
  /** True when DnD is active for this view (status). Tag = false. */
  enabled: boolean;
  activeCardId: string | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
}

export function useKanbanDnd({
  viewMode,
  columns,
  setTodoStatus,
}: UseKanbanDndParams): UseKanbanDndResult {
  const enabled = viewMode === "status";

  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // card id → its column id (the drop's SOURCE column, and the fallback for a
  // card-shaped `over`). Also: column id set, so we can tell the two apart.
  const { cardToColumn, columnIds } = useMemo(() => {
    const cardToColumn = new Map<string, string>();
    const columnIds = new Set<string>();
    for (const col of columns) {
      columnIds.add(col.id);
      for (const card of col.cards) cardToColumn.set(card.id, col.id);
    }
    return { cardToColumn, columnIds };
  }, [columns]);

  const resolveOverColumn = useCallback(
    (overId: string | null): string | null => {
      if (overId === null) return null;
      if (columnIds.has(overId)) return overId;
      return cardToColumn.get(overId) ?? null;
    },
    [columnIds, cardToColumn],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeId = event.active.id as string;
      setActiveCardId(null);

      const overRawId = event.over ? (event.over.id as string) : null;
      if (overRawId === null) return;

      const targetColumnId = resolveOverColumn(overRawId);
      if (targetColumnId === null) return;

      const sourceColumnId = cardToColumn.get(activeId) ?? null;
      const sameColumn = sourceColumnId === targetColumnId;

      // status view: cross-column drop SETS the todo status. Same-column
      // reorder is meaningless for status grouping, so it's a no-op.
      const targetStatus = parseStatusColumnId(targetColumnId);
      if (targetStatus && !sameColumn) {
        setTodoStatus(activeId, targetStatus);
      }
    },
    [cardToColumn, resolveOverColumn, setTodoStatus],
  );

  const handleDragCancel = useCallback(() => {
    setActiveCardId(null);
  }, []);

  return {
    sensors,
    enabled,
    activeCardId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  };
}
