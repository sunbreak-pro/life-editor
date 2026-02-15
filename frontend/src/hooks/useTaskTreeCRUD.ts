import { useCallback } from "react";
import type { TaskNode, NodeType, TaskStatus } from "../types/taskTree";
import { MAX_FOLDER_DEPTH } from "../types/taskTree";
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
  getNodeDepth: (nodeId: string) => number,
  generateId: (type: NodeType) => string,
) {
  const addNode = useCallback(
    (
      type: NodeType,
      parentId: string | null,
      title: string,
      options?: AddNodeOptions,
    ) => {
      if (type === "folder" && parentId !== null) {
        const parentDepth = getNodeDepth(parentId);
        if (parentDepth + 1 >= MAX_FOLDER_DEPTH) return undefined;
      }

      const siblings = nodes.filter(
        (n) => !n.isDeleted && n.parentId === parentId,
      );
      const folderColor =
        type === "folder"
          ? getColorByIndex(
              nodes.filter((n) => n.type === "folder" && !n.isDeleted).length,
            )
          : undefined;

      const newNode: TaskNode = {
        id: generateId(type),
        type,
        title,
        parentId,
        order: siblings.length,
        status: "TODO",
        isExpanded: type !== "task" ? true : undefined,
        createdAt: new Date().toISOString(),
        scheduledAt: type === "task" ? options?.scheduledAt : undefined,
        scheduledEndAt: type === "task" ? options?.scheduledEndAt : undefined,
        isAllDay: type === "task" ? options?.isAllDay : undefined,
        color: folderColor,
      };
      persistWithHistory(nodes, [...nodes, newNode]);
      return newNode;
    },
    [nodes, persistWithHistory, getNodeDepth, generateId],
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

      const newStatus: TaskStatus = target.status === "TODO" ? "DONE" : "TODO";
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
      // TODO: insert at end of incomplete group (before complete siblings)
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
            ? { ...n, status: "TODO" as TaskStatus, completedAt: undefined }
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
    completeFolderWithChildren,
    uncompleteFolder,
  };
}
