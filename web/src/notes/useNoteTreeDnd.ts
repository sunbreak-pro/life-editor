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
import type {
  NoteNode,
  MoveResult,
  MoveRejectionReason,
} from "@life-editor/shared";

/*
 * Web-side @dnd-kit glue for the note tree (S3). This is the host UI's
 * pointer→intent translator: it maps drag gestures onto the three pure
 * move operations the shared `useNotesUnifiedContext` exposes (moveNode /
 * moveNodeInto / moveToRoot). It lives in `web/` (not `shared/`) so the
 * shared package stays UI/dnd-free — Option A keeps shared at the same
 * UI-free boundary as S1/S2. 1:1 behaviour port of
 * frontend/src/hooks/useNoteTreeDnd.ts (drag-over store + folder
 * above/inside/below zones).
 */

export interface NoteOverInfo {
  overId: string;
  position: "above" | "below" | "inside";
}

interface UseNoteTreeDndParams {
  notes: NoteNode[];
  expandedIds: Set<string>;
  moveNode: (
    activeId: string,
    overId: string,
    position?: "above" | "below",
  ) => MoveResult;
  moveNodeInto: (
    activeId: string,
    overId: string,
    insertIndex?: number,
  ) => MoveResult;
  moveToRoot: (id: string) => MoveResult;
  onMoveRejected?: (reason: MoveRejectionReason) => void;
}

const FOLDER_ZONE_ABOVE = 0.25;
const FOLDER_ZONE_BELOW = 0.75;

const getPointerY = (event: DragMoveEvent | DragEndEvent): number | null => {
  if (!(event.activatorEvent instanceof PointerEvent)) return null;
  return event.activatorEvent.clientY + event.delta.y;
};

function computeFolderPosition(
  pointerY: number,
  rect: { top: number; height: number },
): "above" | "below" | "inside" {
  const ratio = (pointerY - rect.top) / rect.height;
  if (ratio < FOLDER_ZONE_ABOVE) return "above";
  if (ratio > FOLDER_ZONE_BELOW) return "below";
  return "inside";
}

function handleResult(
  result: MoveResult,
  onMoveRejected?: (reason: MoveRejectionReason) => void,
): void {
  if (!result.success && onMoveRejected) {
    onMoveRejected(result.reason);
  }
}

export function useNoteTreeDnd({
  notes,
  expandedIds,
  moveNode,
  moveNodeInto,
  moveToRoot,
  onMoveRejected,
}: UseNoteTreeDndParams) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overInfo, setOverInfo] = useState<NoteOverInfo | null>(null);
  const overInfoRef = useRef<NoteOverInfo | null>(null);

  const setOver = useCallback((next: NoteOverInfo | null) => {
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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const { over } = event;
      if (!over) {
        setOver(null);
        return;
      }

      const overId = over.id as string;
      const overNode = notes.find((n) => n.id === overId);
      if (!overNode) {
        setOver(null);
        return;
      }

      let newPosition: "above" | "below" | "inside";
      const pointerY = getPointerY(event);

      if (!pointerY || !over.rect) {
        newPosition = overNode.type === "folder" ? "inside" : "below";
      } else if (overNode.type === "folder") {
        newPosition = computeFolderPosition(pointerY, over.rect);
        if (newPosition === "below" && expandedIds.has(overId)) {
          newPosition = "inside";
        }
      } else {
        const { top, height } = over.rect;
        const relY = pointerY - top;
        newPosition = relY < height / 2 ? "above" : "below";
      }

      setOver({ overId, position: newPosition });
    },
    [notes, expandedIds, setOver],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      setOver(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeNode = notes.find((n) => n.id === active.id);
      if (!activeNode) return;
      const overId = over.id as string;

      if (overId === "droppable-note-root") {
        if (activeNode.parentId !== null) {
          handleResult(moveToRoot(active.id as string), onMoveRejected);
        }
        return;
      }

      const overNode = notes.find((n) => n.id === overId);
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

        const position = computeFolderPosition(pointerY, over.rect);

        if (position === "above") {
          handleResult(
            moveNode(active.id as string, over.id as string, "above"),
            onMoveRejected,
          );
        } else if (position === "below") {
          if (expandedIds.has(overId)) {
            handleResult(
              moveNodeInto(active.id as string, over.id as string, 0),
              onMoveRejected,
            );
          } else {
            handleResult(
              moveNode(active.id as string, over.id as string, "below"),
              onMoveRejected,
            );
          }
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
        const { top, height } = over.rect;
        const position = pointerY - top < height / 2 ? "above" : "below";
        handleResult(
          moveNode(active.id as string, over.id as string, position),
          onMoveRejected,
        );
      }
    },
    [
      notes,
      expandedIds,
      moveNode,
      moveNodeInto,
      moveToRoot,
      setOver,
      onMoveRejected,
    ],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOver(null);
  }, [setOver]);

  const activeNode = useMemo(
    () => (activeId ? (notes.find((n) => n.id === activeId) ?? null) : null),
    [activeId, notes],
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
