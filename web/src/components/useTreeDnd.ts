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
  type NoteDropPosition,
  type MoveResult,
  type MoveRejectionReason,
} from "@life-editor/shared";

/*
 * Web-side @dnd-kit glue shared by the task tree (DU-G) and the note tree
 * (S3). Both trees map drag gestures onto the same three pure move
 * operations their shared context exposes (moveNode / moveNodeInto /
 * moveToRoot) using the same pointer→intent translation (shared
 * `computeNoteDropIntent` zones, below-folder = sibling reorder, inside =
 * moveNodeInto). It lives in `web/` (not `shared/`) so the shared package
 * stays UI/dnd-free.
 *
 * The two trees differ only in how they store expand state: Tasks keep a
 * VIEW-LOCAL `collapsed: Set` (id IN set = collapsed) while Notes keep an
 * `expandedIds: Set` (id IN set = expanded). That inversion is absorbed by
 * the three `isExpanded` / `collapseForDrag` / `expandAfterCancel`
 * callbacks below — Rule 1 (grabbing an expanded folder collapses it for
 * the duration of the drag) is expressed purely in those terms.
 */

export interface TreeOverInfo {
  overId: string;
  position: NoteDropPosition;
}

// Minimal node shape both TaskNode and NoteNode satisfy.
interface TreeDndNode {
  id: string;
  type: string;
  parentId: string | null;
}

interface UseTreeDndParams<TNode extends TreeDndNode> {
  nodes: TNode[];
  // The id the host registers for its root drop zone ("droppable-*-root").
  rootDroppableId: string;
  // Expand/collapse seam (absorbs the Tasks collapsed-set vs Notes
  // expanded-set inversion).
  isExpanded: (id: string) => boolean;
  collapseForDrag: (id: string) => void;
  expandAfterCancel: (id: string) => void;
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

export interface UseTreeDndResult<TNode> {
  sensors: ReturnType<typeof useSensors>;
  activeId: string | null;
  activeNode: TNode | null;
  overInfo: TreeOverInfo | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragMove: (event: DragMoveEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
}

export function useTreeDnd<TNode extends TreeDndNode>({
  nodes,
  rootDroppableId,
  isExpanded,
  collapseForDrag,
  expandAfterCancel,
  moveNode,
  moveNodeInto,
  moveToRoot,
  onMoveRejected,
}: UseTreeDndParams<TNode>): UseTreeDndResult<TNode> {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overInfo, setOverInfo] = useState<TreeOverInfo | null>(null);
  const overInfoRef = useRef<TreeOverInfo | null>(null);
  // Rule 1: if grabbing an expanded folder collapsed it, remember its id so
  // a cancelled drag can re-expand it (a completed drop leaves it collapsed).
  const collapsedOnDragRef = useRef<string | null>(null);

  const setOver = useCallback((next: TreeOverInfo | null) => {
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
      // Rule 1: grabbing an EXPANDED folder collapses it for the duration of
      // the drag, so it travels as one compact block (and its children stop
      // being drop targets mid-drag). Restored on cancel; left collapsed
      // after a completed drop.
      const node = nodes.find((n) => n.id === id);
      if (node && node.type === "folder" && isExpanded(id)) {
        collapsedOnDragRef.current = id;
        collapseForDrag(id);
      } else {
        collapsedOnDragRef.current = null;
      }
    },
    [nodes, isExpanded, collapseForDrag],
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

      if (overId === rootDroppableId) {
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
          // Below a folder (expanded or not) drops as the folder's sibling,
          // right after it — never "first child". This is what lets an item
          // land below a folder that itself sits at the tail of another
          // folder.
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
    [nodes, rootDroppableId, moveNode, moveNodeInto, moveToRoot, setOver, onMoveRejected],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOver(null);
    // Rule 1: a cancelled drag re-expands the folder we collapsed on grab.
    if (collapsedOnDragRef.current) {
      expandAfterCancel(collapsedOnDragRef.current);
      collapsedOnDragRef.current = null;
    }
  }, [setOver, expandAfterCancel]);

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
