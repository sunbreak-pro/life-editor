import { useCallback } from "react";
import type { TaskNode, NodeType, TaskStatus } from "../types/taskTree";
import { getColorByIndex } from "../constants/folderColors";

interface AddNodeOptions {
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
      if (options?.skipUndo) {
        persistSilent([...updatedNodes, newNode]);
      } else {
        persistWithHistory(nodes, [...updatedNodes, newNode]);
      }
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

  /** Apply a status change with Complete-folder auto-management */
  const applyStatusChange = useCallback(
    (id: string, newStatus: TaskStatus) => {
      const target = nodes.find((n) => n.id === id);
      if (!target || target.type !== "task") return;
      if (target.status === newStatus) return;

      const currentStatus = target.status ?? "NOT_STARTED";
      let workingNodes = [...nodes];
      let targetParentId = target.parentId;
      let updatedTarget: TaskNode = {
        ...target,
        status: newStatus,
        completedAt:
          newStatus === "DONE" ? new Date().toISOString() : undefined,
      };

      // --- Complete folder logic (only for tasks inside a folder) ---
      if (newStatus === "DONE" && targetParentId !== null) {
        // Find or create a Complete folder inside the parent
        let completeFolder = workingNodes.find(
          (n) =>
            n.parentId === targetParentId &&
            n.folderType === "complete" &&
            !n.isDeleted,
        );
        if (!completeFolder) {
          const parentSiblings = workingNodes.filter(
            (n) => n.parentId === targetParentId && !n.isDeleted,
          );
          completeFolder = {
            id: generateId("folder"),
            type: "folder",
            title: "Complete",
            parentId: targetParentId,
            order: parentSiblings.length,
            status: "NOT_STARTED",
            isExpanded: false,
            folderType: "complete",
            createdAt: new Date().toISOString(),
          };
          workingNodes = [...workingNodes, completeFolder];
        }
        // Move task into Complete folder
        updatedTarget = {
          ...updatedTarget,
          originalParentId: targetParentId,
          parentId: completeFolder.id,
        };
        targetParentId = completeFolder.id;
      } else if (
        currentStatus === "DONE" &&
        newStatus !== "DONE" &&
        target.parentId !== null
      ) {
        // Moving out of DONE: check if currently inside a Complete folder
        const parentFolder = workingNodes.find((n) => n.id === target.parentId);
        if (parentFolder?.folderType === "complete") {
          const restoreParentId =
            target.originalParentId ?? parentFolder.parentId;
          updatedTarget = {
            ...updatedTarget,
            parentId: restoreParentId,
            originalParentId: undefined,
          };
          targetParentId = restoreParentId;

          // Check if Complete folder will be empty after this move
          const remaining = workingNodes.filter(
            (n) =>
              n.parentId === parentFolder.id && !n.isDeleted && n.id !== id,
          );
          if (remaining.length === 0) {
            // Auto-delete the empty Complete folder
            workingNodes = workingNodes.map((n) =>
              n.id === parentFolder.id
                ? {
                    ...n,
                    isDeleted: true,
                    deletedAt: new Date().toISOString(),
                  }
                : n,
            );
          }
        }
      }

      // --- Reorder siblings in destination parent ---
      const siblings = workingNodes
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

      persistWithHistory(
        nodes,
        workingNodes.map((n) => {
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
    [nodes, persistWithHistory, generateId],
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
