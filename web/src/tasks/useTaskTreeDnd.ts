import { useState, useCallback, useRef, useMemo } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragMoveEvent,
} from "@dnd-kit/core";
import {
  computeNoteDropIntent,
  type TaskNode,
  type NoteDropPosition,
  type MoveResult,
  type MoveRejectionReason,
} from "@life-editor/shared";

/*
 * Web-side @dnd-kit glue for the task tree (DU-G). A 1:1 mirror of
 * `web/src/notes/useNoteTreeDnd.ts` for TaskNodes, so both trees share the
 * exact same pointer→intent translation (shared `computeNoteDropIntent`
 * zones). It lives in `web/` (not `shared/`) so the shared package stays
 * UI/dnd-free.
 *
 * life-tags S3 (#225): the Tasks domain no longer has folder nodes. Any task
 * can hold subtasks, so EVERY node offers the 3-zone drop intent — above /
 * below (moveNode sibling reorder) and inside (moveNodeInto = nest as a
 * child). The movement hook's isDescendantOf cycle guard still rejects an
 * illegal parent→descendant move.
 *
 * Web Tasks keep expand/collapse state in a VIEW-LOCAL `collapsed: Set`
 * (an id IN the set = collapsed) rather than on the context, so this hook
 * takes that set plus collapse/expand callbacks instead of the
 * `expandedIds` / `toggleExpanded` pair the Notes hook uses. Rule 1 below
 * is expressed in those terms: grabbing an EXPANDED node that HAS children
 * (= one NOT in `collapsedIds`) adds it to the set for the drag's duration.
 *
 * NOTE: this hook is currently dormant — no web Tasks view imports it (the
 * Kanban board owns Tasks DnD). Kept compiling + semantically sane for a
 * future tree view.
 */

export interface TaskOverInfo {
  overId: string;
  position: NoteDropPosition;
}

interface UseTaskTreeDndParams {
  nodes: TaskNode[];
  collapsedIds: Set<string>;
  collapse: (id: string) => void;
  expand: (id: string) => void;
  moveNode: (
    activeId: string,
    overId: string,
    position?: "above" | "below",
  ) => MoveResult;
  moveNodeInto: (activeId: string, overId: string) => MoveResult;
  moveToRoot: (id: string) => MoveResult;
  onMoveRejected?: (reason: MoveRejectionReason) => void;
}

const getPointerY = (event: DragMoveEvent | DragEndEvent): number | null => {
  if (!(event.activatorEvent instanceof PointerEvent)) return null;
  return event.activatorEvent.clientY + event.delta.y;
};

// Pointer position inside a row, 0 (top edge) .. 1 (bottom edge).
// computeNoteDropIntent clamps, so over-/under-shoot is fine.
const pointerRatioOf = (
  pointerY: number,
  rect: { top: number; height: number },
): number => (pointerY - rect.top) / rect.height;

function handleResult(
  result: MoveResult,
  onMoveRejected?: (reason: MoveRejectionReason) => void,
): void {
  if (!result.success && onMoveRejected) {
    onMoveRejected(result.reason);
  }
}

export interface UseTaskTreeDndResult {
  sensors: ReturnType<typeof useSensors>;
  activeId: string | null;
  activeNode: TaskNode | null;
  overInfo: TaskOverInfo | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragMove: (event: DragMoveEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
}

export function useTaskTreeDnd({
  nodes,
  collapsedIds,
  collapse,
  expand,
  moveNode,
  moveNodeInto,
  moveToRoot,
  onMoveRejected,
}: UseTaskTreeDndParams): UseTaskTreeDndResult {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overInfo, setOverInfo] = useState<TaskOverInfo | null>(null);
  const overInfoRef = useRef<TaskOverInfo | null>(null);
  // Rule 1: if grabbing an expanded node with children collapsed it, remember
  // its id so a cancelled drag can re-expand it (a completed drop leaves it
  // collapsed).
  const collapsedOnDragRef = useRef<string | null>(null);

  const setOver = useCallback((next: TaskOverInfo | null) => {
    const prev = overInfoRef.current;
    if (
      (prev === null && next === null) ||
      (prev !== null &&
        next !== null &&
        prev.overId === next.overId &&
        prev.position === next.position)
    ) {
      return;
    }
    overInfoRef.current = next;
    setOverInfo(next);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = event.active.id as string;
      setActiveId(id);
      // Rule 1: grabbing an EXPANDED node that has children (NOT in
      // collapsedIds) collapses it for the duration of the drag, so it
      // travels as one compact block (and its children stop being drop
      // targets mid-drag). Restored on cancel; left collapsed after a
      // completed drop.
      const node = nodes.find((n) => n.id === id);
      const hasChildren = node ? nodes.some((n) => n.parentId === id) : false;
      if (node && hasChildren && !collapsedIds.has(id)) {
        collapsedOnDragRef.current = id;
        collapse(id);
      } else {
        collapsedOnDragRef.current = null;
      }
    },
    [nodes, collapsedIds, collapse],
  );

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const { over } = event;
      if (!over) {
        setOver(null);
        return;
      }

      const overId = over.id as string;
      const overNode = nodes.find((n) => n.id === overId);
      if (!overNode) {
        setOver(null);
        return;
      }

      // S3: every task node can accept a child (subtask nesting), so the
      // 3-zone intent (above/inside/below) applies to all nodes — pass
      // isFolder:true to enable the "inside" zone uniformly.
      let newPosition: NoteDropPosition;
      const pointerY = getPointerY(event);

      if (!pointerY || !over.rect) {
        newPosition = "inside";
      } else {
        newPosition = computeNoteDropIntent({
          pointerRatio: pointerRatioOf(pointerY, over.rect),
          isFolder: true,
        });
      }

      setOver({ overId, position: newPosition });
    },
    [nodes, setOver],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      setOver(null);
      // A completed drop leaves a Rule 1 folder collapsed; just drop the ref.
      collapsedOnDragRef.current = null;
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeNode = nodes.find((n) => n.id === active.id);
      if (!activeNode) return;
      const overId = over.id as string;

      if (overId === "droppable-task-root") {
        if (activeNode.parentId !== null) {
          handleResult(moveToRoot(active.id as string), onMoveRejected);
        }
        return;
      }

      const overNode = nodes.find((n) => n.id === overId);
      if (!overNode) return;

      // S3: every task node accepts a child, so the same 3-zone intent
      // applies uniformly — "inside" nests via moveNodeInto (skipped when it
      // is already the parent), above/below reorder as siblings. The
      // movement hook's isDescendantOf guard rejects an illegal
      // parent→descendant move.
      const pointerY = getPointerY(event);
      if (!pointerY || !over.rect) {
        if (activeNode.parentId !== overNode.id) {
          handleResult(
            moveNodeInto(active.id as string, over.id as string),
            onMoveRejected,
          );
        }
        return;
      }

      const position = computeNoteDropIntent({
        pointerRatio: pointerRatioOf(pointerY, over.rect),
        isFolder: true,
      });

      if (position === "above") {
        handleResult(
          moveNode(active.id as string, over.id as string, "above"),
          onMoveRejected,
        );
      } else if (position === "below") {
        handleResult(
          moveNode(active.id as string, over.id as string, "below"),
          onMoveRejected,
        );
      } else {
        if (activeNode.parentId !== overNode.id) {
          handleResult(
            moveNodeInto(active.id as string, over.id as string),
            onMoveRejected,
          );
        }
      }
    },
    [nodes, moveNode, moveNodeInto, moveToRoot, setOver, onMoveRejected],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOver(null);
    // Rule 1: a cancelled drag re-expands the folder we collapsed on grab.
    if (collapsedOnDragRef.current) {
      expand(collapsedOnDragRef.current);
      collapsedOnDragRef.current = null;
    }
  }, [setOver, expand]);

  const activeNode = useMemo(
    () => (activeId ? (nodes.find((n) => n.id === activeId) ?? null) : null),
    [activeId, nodes],
  );

  return {
    sensors,
    activeId,
    activeNode,
    overInfo,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
  };
}
