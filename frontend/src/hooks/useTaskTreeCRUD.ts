import { useCallback } from "react";
import type { TaskNode, NodeType, TaskStatus } from "../types/taskTree";
import { getColorByIndex } from "../constants/folderColors";

interface AddNodeOptions {
  scheduledAt?: string;
  scheduledEndAt?: string;
  isAllDay?: boolean;
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
      const siblings = nodes.filter(
        (n) => !n.isDeleted && n.parentId === parentId,
      );
      const folderColor =
        type === "folder"
          ? getColorByIndex(
              nodes.filter((n) => n.type === "folder" && !n.isDeleted).length,
            )
          : undefined;

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
        parentId,
        order: newOrder,
        status: "NOT_STARTED",
        isExpanded: type !== "task" ? true : undefined,
        createdAt: new Date().toISOString(),
        scheduledAt: type === "task" ? options?.scheduledAt : undefined,
        scheduledEndAt: type === "task" ? options?.scheduledEndAt : undefined,
        isAllDay: type === "task" ? options?.isAllDay : undefined,
        color: folderColor,
      };
      persistWithHistory(nodes, [...updatedNodes, newNode]);
      return newNode;
    },
    [nodes, persistWithHistory, generateId],
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

  const toggleTaskStatus = useCallback(
    (id: string) => {
      const target = nodes.find((n) => n.id === id);
      if (!target || target.type !== "task") return;

      // 3-state cycle: NOT_STARTED → IN_PROGRESS → DONE → NOT_STARTED
      const statusCycle: Record<string, TaskStatus> = {
        NOT_STARTED: "IN_PROGRESS",
        IN_PROGRESS: "DONE",
        DONE: "NOT_STARTED",
      };
      const currentStatus = target.status ?? "NOT_STARTED";
      const newStatus: TaskStatus = statusCycle[currentStatus] ?? "NOT_STARTED";

      const siblings = nodes
        .filter(
          (n) => !n.isDeleted && n.parentId === target.parentId && n.id !== id,
        )
        .sort((a, b) => a.order - b.order);

      const incomplete = siblings.filter((n) => n.status !== "DONE");
      const complete = siblings.filter((n) => n.status === "DONE");

      const updatedTarget = {
        ...target,
        status: newStatus,
        completedAt:
          newStatus === "DONE" ? new Date().toISOString() : undefined,
      };

      // DONE: append to end after all complete siblings
      // Otherwise: insert at end of incomplete group (before complete siblings)
      const reordered =
        newStatus === "DONE"
          ? [...incomplete, ...complete, updatedTarget]
          : [...incomplete, updatedTarget, ...complete];

      const orderMap = new Map<string, number>();
      reordered.forEach((n, i) => orderMap.set(n.id, i));

      persistWithHistory(
        nodes,
        nodes.map((n) => {
          if (n.id === id)
            return {
              ...updatedTarget,
              order: orderMap.get(id) ?? updatedTarget.order,
            };
          if (orderMap.has(n.id)) return { ...n, order: orderMap.get(n.id)! };
          return n;
        }),
      );
    },
    [nodes, persistWithHistory],
  );

  const setTaskStatus = useCallback(
    (id: string, newStatus: TaskStatus) => {
      const target = nodes.find((n) => n.id === id);
      if (!target || target.type !== "task") return;
      if (target.status === newStatus) return;

      const siblings = nodes
        .filter(
          (n) => !n.isDeleted && n.parentId === target.parentId && n.id !== id,
        )
        .sort((a, b) => a.order - b.order);

      const incomplete = siblings.filter((n) => n.status !== "DONE");
      const complete = siblings.filter((n) => n.status === "DONE");

      const updatedTarget = {
        ...target,
        status: newStatus,
        completedAt:
          newStatus === "DONE" ? new Date().toISOString() : undefined,
      };

      const reordered =
        newStatus === "DONE"
          ? [...incomplete, ...complete, updatedTarget]
          : [...incomplete, updatedTarget, ...complete];

      const orderMap = new Map<string, number>();
      reordered.forEach((n, i) => orderMap.set(n.id, i));

      persistWithHistory(
        nodes,
        nodes.map((n) => {
          if (n.id === id)
            return {
              ...updatedTarget,
              order: orderMap.get(id) ?? updatedTarget.order,
            };
          if (orderMap.has(n.id)) return { ...n, order: orderMap.get(n.id)! };
          return n;
        }),
      );
    },
    [nodes, persistWithHistory],
  );

  const completeFolderWithChildren = useCallback(
    (folderId: string) => {
      const now = new Date().toISOString();
      const idsToComplete = new Set<string>();

      const collectDescendants = (parentId: string) => {
        idsToComplete.add(parentId);
        for (const n of nodes) {
          if (!n.isDeleted && n.parentId === parentId) {
            if (n.type === "folder") {
              collectDescendants(n.id);
            } else {
              idsToComplete.add(n.id);
            }
          }
        }
      };
      collectDescendants(folderId);

      persistWithHistory(
        nodes,
        nodes.map((n) =>
          idsToComplete.has(n.id) && n.status !== "DONE"
            ? { ...n, status: "DONE" as TaskStatus, completedAt: now }
            : n,
        ),
      );
    },
    [nodes, persistWithHistory],
  );

  const uncompleteFolder = useCallback(
    (folderId: string) => {
      persistWithHistory(
        nodes,
        nodes.map((n) =>
          n.id === folderId
            ? {
                ...n,
                status: "NOT_STARTED" as TaskStatus,
                completedAt: undefined,
              }
            : n,
        ),
      );
    },
    [nodes, persistWithHistory],
  );

  return {
    addNode,
    updateNode,
    toggleExpanded,
    toggleTaskStatus,
    setTaskStatus,
    completeFolderWithChildren,
    uncompleteFolder,
  };
}
