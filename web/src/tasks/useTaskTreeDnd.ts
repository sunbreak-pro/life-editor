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
 * zones, below-folder = sibling reorder, inside = moveNodeInto). It lives
 * in `web/` (not `shared/`) so the shared package stays UI/dnd-free.
 *
 * Web Tasks keep expand/collapse state in a VIEW-LOCAL `collapsed: Set`
 * (a folder id IN the set = collapsed) rather than on the context, so this
 * hook takes that set plus collapse/expand callbacks instead of the
 * `expandedIds` / `toggleExpanded` pair the Notes hook uses. Rule 1 below
 * is expressed in those terms: grabbing an EXPANDED folder (= one NOT in
 * `collapsedIds`) adds it to the set for the drag's duration.
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
  // Rule 1: if grabbing an expanded folder collapsed it, remember its id so
  // a cancelled drag can re-expand it (a completed drop leaves it collapsed).
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
      // Rule 1: grabbing an EXPANDED folder (NOT in collapsedIds) collapses
      // it for the duration of the drag, so it travels as one compact block
      // (and its children stop being drop targets mid-drag). Restored on
      // cancel; left collapsed after a completed drop.
      const node = nodes.find((n) => n.id === id);
      if (node && node.type === "folder" && !collapsedIds.has(id)) {
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

      const isFolder = overNode.type === "folder";
      let newPosition: NoteDropPosition;
      const pointerY = getPointerY(event);

      if (!pointerY || !over.rect) {
        newPosition = isFolder ? "inside" : "below";
      } else {
        newPosition = computeNoteDropIntent({
          pointerRatio: pointerRatioOf(pointerY, over.rect),
          isFolder,
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

      if (overNode.type === "folder") {
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
          // TaskTree parity: below a folder (expanded or not) drops as the
          // folder's sibling, right after it — never "first child". No
          // expanded-folder special case (the old web Tasks DnD had one;
          // dropping it is the whole point of this unification).
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
      } else {
        const pointerY = getPointerY(event);
        if (!pointerY || !over.rect) {
          handleResult(
            moveNode(active.id as string, over.id as string, "below"),
            onMoveRejected,
          );
          return;
        }
        const position = computeNoteDropIntent({
          pointerRatio: pointerRatioOf(pointerY, over.rect),
          isFolder: false,
        });
        // Non-folder intent is only ever "above" | "below".
        handleResult(
          moveNode(
            active.id as string,
            over.id as string,
            position as "above" | "below",
          ),
          onMoveRejected,
        );
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
