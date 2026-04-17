import type { TaskNode } from "../types/taskTree";
import { walkAncestors } from "./walkAncestors";

export function getFolderTag(
  taskId: string,
  nodeMap: Map<string, TaskNode>,
): string {
  if (!nodeMap.has(taskId)) return "";

  const ancestors: string[] = [];
  for (const ancestor of walkAncestors(taskId, nodeMap)) {
    if (ancestor.type === "folder") {
      ancestors.unshift(ancestor.title);
    }
  }

  return ancestors.join("/");
}

export function truncateFolderTag(tag: string, maxLevels: number = 2): string {
  if (!tag) return tag;
  const parts = tag.split("/");
  if (parts.length <= maxLevels) return tag;
  return parts.slice(-maxLevels).join("/");
}
