import { useCallback } from "react";
import type { TaskNode, NodeType, TaskStatus } from "../types/taskTree";

export interface AddNodeOptions {
  scheduledAt?: string;
  scheduledEndAt?: string;
  isAllDay?: boolean;
  skipUndo?: boolean;
}

export function useTaskTreeCRUD(
  nodes: TaskNode[],
  persistWithHistory: (currentNodes: TaskNode[], updated: TaskNode[]) => void,
  persistSilent: (updated: TaskNode[]) => void,
  generateId: (type: NodeType) => string,
) {
  const addNode = useCallback(
    (
      type: NodeType,
      parentId: string | null,
      title: string,
      options?: AddNodeOptions,
    ) => {
      // life-tags S1 retired the default-folder behaviour (folders no longer
      // group tasks); a new task keeps the caller's parent verbatim.
      const effectiveParentId = parentId;

      const siblings = nodes.filter(
        (n) => !n.isDeleted && n.parentId === effectiveParentId,
      );

      let newOrder: number;
      let updatedNodes = nodes;

      if (type === "task") {
        // Insert new task at the top of the task group (order: 0)
        const taskSiblings = siblings.filter(
          (n) => n.type === "task" && n.status !== "DONE",
        );
        newOrder = 0;
        const shiftIds = new Set(taskSiblings.map((n) => n.id));
        updatedNodes = nodes.map((n) =>
          shiftIds.has(n.id) ? { ...n, order: n.order + 1 } : n,
        );
      } else {
        newOrder = siblings.filter((n) => n.type === "folder").length;
      }

      const newNode: TaskNode = {
        id: generateId(type),
        type,
        title,
        parentId: effectiveParentId,
        order: newOrder,
        status: "NOT_STARTED",
        isExpanded: type !== "task" ? true : undefined,
        createdAt: new Date().toISOString(),
        scheduledAt: type === "task" ? options?.scheduledAt : undefined,
        scheduledEndAt: type === "task" ? options?.scheduledEndAt : undefined,
        isAllDay: type === "task" ? options?.isAllDay : undefined,
      };
      if (options?.skipUndo) {
        persistSilent([...updatedNodes, newNode]);
      } else {
        persistWithHistory(nodes, [...updatedNodes, newNode]);
      }
      return newNode;
    },
    [nodes, persistWithHistory, persistSilent, generateId],
  );

  const updateNode = useCallback(
    (id: string, updates: Partial<TaskNode>) => {
      persistSilent(nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)));
    },
    [nodes, persistSilent],
  );

  const toggleExpanded = useCallback(
    (id: string) => {
      persistSilent(
        nodes.map((n) =>
          n.id === id ? { ...n, isExpanded: !n.isExpanded } : n,
        ),
      );
    },
    [nodes, persistSilent],
  );

  /**
   * Apply a status change. Sets status + completedAt and re-sorts the task's
   * siblings so DONE items sink below the incomplete ones. life-tags S1 retired
   * the Complete-folder auto-management (folders no longer group tasks; status
   * = DONE is the successor) — the task keeps its parent verbatim, so subtask
   * hierarchy is untouched.
   */
  const applyStatusChange = useCallback(
    (id: string, newStatus: TaskStatus) => {
      const target = nodes.find((n) => n.id === id);
      if (!target || target.type !== "task") return;
      if (target.status === newStatus) return;

      const targetParentId = target.parentId;
      const updatedTarget: TaskNode = {
        ...target,
        status: newStatus,
        completedAt:
          newStatus === "DONE" ? new Date().toISOString() : undefined,
      };

      // --- Reorder siblings in the SAME parent (DONE sinks to the bottom) ---
      const siblings = nodes
        .filter(
          (n) => !n.isDeleted && n.parentId === targetParentId && n.id !== id,
        )
        .sort((a, b) => a.order - b.order);

      const incomplete = siblings.filter((n) => n.status !== "DONE");
      const complete = siblings.filter((n) => n.status === "DONE");

      const reordered =
        newStatus === "DONE"
          ? [...incomplete, ...complete, updatedTarget]
          : [...incomplete, updatedTarget, ...complete];

      const orderMap = new Map<string, number>();
      reordered.forEach((n, i) => orderMap.set(n.id, i));

      const finalNodes = nodes.map((n) => {
        if (n.id === id)
          return {
            ...updatedTarget,
            order: orderMap.get(id) ?? updatedTarget.order,
          };
        if (orderMap.has(n.id)) return { ...n, order: orderMap.get(n.id)! };
        return n;
      });

      persistWithHistory(nodes, finalNodes);
    },
    [nodes, persistWithHistory],
  );

  const toggleTaskStatus = useCallback(
    (id: string) => {
      const target = nodes.find((n) => n.id === id);
      if (!target || target.type !== "task") return;

      const statusCycle: Record<string, TaskStatus> = {
        NOT_STARTED: "IN_PROGRESS",
        IN_PROGRESS: "DONE",
        DONE: "NOT_STARTED",
      };
      const currentStatus = target.status ?? "NOT_STARTED";
      const newStatus: TaskStatus = statusCycle[currentStatus] ?? "NOT_STARTED";
      applyStatusChange(id, newStatus);
    },
    [nodes, applyStatusChange],
  );

  const setTaskStatus = useCallback(
    (id: string, newStatus: TaskStatus) => {
      applyStatusChange(id, newStatus);
    },
    [applyStatusChange],
  );

  return {
    addNode,
    updateNode,
    toggleExpanded,
    toggleTaskStatus,
    setTaskStatus,
  };
}
