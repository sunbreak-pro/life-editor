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
  FOLDER_ROOT_BUCKET_ID,
  type KanbanColumnModel,
  type KanbanViewMode,
  type TaskStatus,
  type MoveResult,
  type MoveRejectionReason,
} from "@life-editor/shared";

/*
 * Kanban DnD glue (K-DnD), web-side. Owns @dnd-kit so the shared Kanban
 * package stays UI/dnd-free (mirrors useTaskTreeDnd.ts). Translates a card
 * drop into the right Tasks mutation per view:
 *
 *   - status view: dropping a card into another column SETS the task status
 *     (column id = `status-<STATUS>`). Reorder within a column is a no-op for
 *     status (cards are grouped by status, not user-ordered) beyond the
 *     status change.
 *   - folder view: dropping a card into another column MOVES the task into
 *     that folder (column id = folder id → moveNodeInto). Reorder within the
 *     same column reorders siblings (moveNode above/below the over card).
 *   - tag view: not draggable (K2). The host omits DnD wiring there.
 *
 * Drop-target resolution: @dnd-kit's `over` can be either a column (droppable)
 * or a card (sortable item). We resolve the destination COLUMN from either by
 * consulting the column models, so dropping onto a card lands in that card's
 * column. Within-column reorder uses the over CARD id.
 */

const STATUS_COL_PREFIX = "status-";

// Dropping a card onto the synthetic FOLDER_ROOT_BUCKET_ID bucket removes it
// from its folder (moveToRoot) rather than moving it INTO a non-existent
// folder.

function parseStatusColumnId(columnId: string): TaskStatus | null {
  if (!columnId.startsWith(STATUS_COL_PREFIX)) return null;
  const raw = columnId.slice(STATUS_COL_PREFIX.length);
  if (raw === "NOT_STARTED" || raw === "IN_PROGRESS" || raw === "DONE") {
    return raw;
  }
  return null;
}

interface UseKanbanDndParams {
  viewMode: KanbanViewMode;
  columns: KanbanColumnModel[];
  setTaskStatus: (id: string, status: TaskStatus) => void;
  moveNodeInto: (activeId: string, targetFolderId: string) => MoveResult;
  moveToRoot: (activeId: string) => MoveResult;
  moveNode: (
    activeId: string,
    overId: string,
    position?: "above" | "below",
  ) => MoveResult;
  onMoveRejected?: (reason: MoveRejectionReason) => void;
}

export interface UseKanbanDndResult {
  sensors: ReturnType<typeof useSensors>;
  /** True when DnD is active for this view (folder/status). Tag = false. */
  enabled: boolean;
  activeCardId: string | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
}

function handleResult(
  result: MoveResult,
  onMoveRejected?: (reason: MoveRejectionReason) => void,
): void {
  if (!result.success && onMoveRejected) onMoveRejected(result.reason);
}

export function useKanbanDnd({
  viewMode,
  columns,
  setTaskStatus,
  moveNodeInto,
  moveToRoot,
  moveNode,
  onMoveRejected,
}: UseKanbanDndParams): UseKanbanDndResult {
  const enabled = viewMode === "folder" || viewMode === "status";

  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // card id → its column id (so dropping onto a card resolves to that column).
  // Also: column id set, so we can tell a column-drop from a card-drop.
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

      if (viewMode === "status") {
        const targetStatus = parseStatusColumnId(targetColumnId);
        // Cross-column → status change. Same-column reorder is meaningless for
        // status grouping, so it's a no-op.
        if (targetStatus && !sameColumn) {
          setTaskStatus(activeId, targetStatus);
        }
        return;
      }

      // folder view
      if (!sameColumn) {
        // Cross-column → drop onto the synthetic "unfiled" bucket removes the
        // task from its folder (moveToRoot); any other column is a real folder
        // (moveNodeInto).
        if (targetColumnId === FOLDER_ROOT_BUCKET_ID) {
          handleResult(moveToRoot(activeId), onMoveRejected);
        } else {
          handleResult(moveNodeInto(activeId, targetColumnId), onMoveRejected);
        }
        return;
      }

      // Same-column reorder: only when dropped ONTO another card (not the
      // empty column body). Reorder the active card relative to the over card.
      if (overRawId !== activeId && !columnIds.has(overRawId)) {
        const col = columns.find((c) => c.id === targetColumnId);
        if (!col) return;
        const oldIndex = col.cards.findIndex((c) => c.id === activeId);
        const newIndex = col.cards.findIndex((c) => c.id === overRawId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
        // Direction tells moveNode whether to land above or below the target.
        const position = newIndex > oldIndex ? "below" : "above";
        handleResult(moveNode(activeId, overRawId, position), onMoveRejected);
      }
    },
    [
      viewMode,
      columns,
      columnIds,
      cardToColumn,
      resolveOverColumn,
      setTaskStatus,
      moveNodeInto,
      moveToRoot,
      moveNode,
      onMoveRejected,
    ],
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
