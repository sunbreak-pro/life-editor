import { useState, useCallback, useRef, useMemo } from "react";
import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragMoveEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { DatabaseRow } from "../types/database";

export interface DbRowOverInfo {
  overId: string;
  position: "above" | "below";
}

export interface DbRowDragOverStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => DbRowOverInfo | null;
}

interface UseDatabaseRowDndParams {
  rows: DatabaseRow[];
  onReorderRows: (rowIds: string[]) => void;
}

export function useDatabaseRowDnd({
  rows,
  onReorderRows,
}: UseDatabaseRowDndParams) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const overInfoRef = useRef<DbRowOverInfo | null>(null);
  const listenersRef = useRef<Set<() => void>>(new Set());

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const getSnapshot = useCallback(() => overInfoRef.current, []);

  const notify = useCallback(() => {
    listenersRef.current.forEach((l) => l());
  }, []);

  const dragOverStore = useMemo<DbRowDragOverStore>(
    () => ({ subscribe, getSnapshot }),
    [subscribe, getSnapshot],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const { over } = event;
      if (!over) {
        if (overInfoRef.current !== null) {
          overInfoRef.current = null;
          notify();
        }
        return;
      }

      const overId = over.id as string;
      if (!rows.some((r) => r.id === overId)) {
        if (overInfoRef.current !== null) {
          overInfoRef.current = null;
          notify();
        }
        return;
      }

      let newPosition: "above" | "below";
      if (!(event.activatorEvent instanceof PointerEvent) || !over.rect) {
        newPosition = "below";
      } else {
        const pointerY = event.activatorEvent.clientY + event.delta.y;
        const { top, height } = over.rect;
        newPosition = pointerY - top < height / 2 ? "above" : "below";
      }

      const prev = overInfoRef.current;
      if (prev?.overId === overId && prev?.position === newPosition) {
        return;
      }

      overInfoRef.current = { overId, position: newPosition };
      notify();
    },
    [rows, notify],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      overInfoRef.current = null;
      notify();

      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = rows.findIndex((r) => r.id === active.id);
      const overIndex = rows.findIndex((r) => r.id === over.id);
      if (oldIndex === -1 || overIndex === -1) return;

      const newOrder = arrayMove(
        rows.map((r) => r.id),
        oldIndex,
        overIndex,
      );
      onReorderRows(newOrder);
    },
    [rows, onReorderRows, notify],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    overInfoRef.current = null;
    notify();
  }, [notify]);

  const activeRow = activeId
    ? (rows.find((r) => r.id === activeId) ?? null)
    : null;

  return {
    sensors,
    activeId,
    activeRow,
    dragOverStore,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
  };
}
