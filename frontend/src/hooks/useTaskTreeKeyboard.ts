import { useEffect, useCallback } from "react";
import type { TaskNode } from "../types/taskTree";
import type { MoveResult, MoveRejectionReason } from "../types/moveResult";

interface UseTaskTreeKeyboardParams {
  selectedTaskId: string | null | undefined;
  visibleNodes: TaskNode[];
  nodes: TaskNode[];
  onSelectTask?: (id: string) => void;
  toggleExpanded: (id: string) => void;
  toggleTaskStatus: (id: string) => void;
  moveNodeInto: (nodeId: string, targetId: string) => MoveResult;
  moveToRoot: (id: string) => MoveResult;
  onMoveRejected?: (reason: MoveRejectionReason) => void;
}

export function useTaskTreeKeyboard({
  selectedTaskId,
  visibleNodes,
  nodes,
  onSelectTask,
  toggleExpanded,
  toggleTaskStatus,
  moveNodeInto,
  moveToRoot,
  onMoveRejected,
}: UseTaskTreeKeyboardParams) {
  const indentNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const siblings = nodes
        .filter((n) => !n.isDeleted && n.parentId === node.parentId)
        .sort((a, b) => a.order - b.order);
      const idx = siblings.findIndex((n) => n.id === nodeId);
      for (let i = idx - 1; i >= 0; i--) {
        if (siblings[i].type === "folder") {
          const result = moveNodeInto(nodeId, siblings[i].id);
          if (!result.success && onMoveRejected) {
            onMoveRejected(result.reason);
          }
          return;
        }
      }
    },
    [nodes, moveNodeInto, onMoveRejected],
  );

  const outdentNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node || !node.parentId) return;
      const parent = nodes.find((n) => n.id === node.parentId);
      if (!parent) return;
      if (parent.parentId === null) {
        const result = moveToRoot(nodeId);
        if (!result.success && onMoveRejected) {
          onMoveRejected(result.reason);
        }
      } else {
        const result = moveNodeInto(nodeId, parent.parentId);
        if (!result.success && onMoveRejected) {
          onMoveRejected(result.reason);
        }
      }
    },
    [nodes, moveNodeInto, moveToRoot, onMoveRejected],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = e.target as Element | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (el?.getAttribute("contenteditable") === "true") return;
      if (el?.closest?.('[contenteditable="true"]')) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!selectedTaskId || visibleNodes.length === 0) {
          if (visibleNodes.length > 0) onSelectTask?.(visibleNodes[0].id);
          return;
        }
        const idx = visibleNodes.findIndex((n) => n.id === selectedTaskId);
        if (idx < visibleNodes.length - 1) {
          onSelectTask?.(visibleNodes[idx + 1].id);
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!selectedTaskId || visibleNodes.length === 0) {
          if (visibleNodes.length > 0)
            onSelectTask?.(visibleNodes[visibleNodes.length - 1].id);
          return;
        }
        const idx = visibleNodes.findIndex((n) => n.id === selectedTaskId);
        if (idx > 0) {
          onSelectTask?.(visibleNodes[idx - 1].id);
        }
        return;
      }

      if (!selectedTaskId) return;
      const selected = nodes.find((n) => n.id === selectedTaskId);
      if (!selected) return;

      if (
        e.key === "ArrowRight" &&
        selected.type === "folder" &&
        !selected.isExpanded
      ) {
        e.preventDefault();
        toggleExpanded(selected.id);
        return;
      }
      if (
        e.key === "ArrowLeft" &&
        selected.type === "folder" &&
        selected.isExpanded
      ) {
        e.preventDefault();
        toggleExpanded(selected.id);
        return;
      }

      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "Enter" &&
        selected.type === "task"
      ) {
        e.preventDefault();
        toggleTaskStatus(selected.id);
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          outdentNode(selected.id);
        } else {
          indentNode(selected.id);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedTaskId,
    visibleNodes,
    nodes,
    onSelectTask,
    toggleExpanded,
    toggleTaskStatus,
    indentNode,
    outdentNode,
  ]);
}
