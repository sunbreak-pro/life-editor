import type { TaskNode } from "../types/taskTree";

export function getFolderTag(
  taskId: string,
  nodeMap: Map<string, TaskNode>,
): string {
  const node = nodeMap.get(taskId);
  if (!node) return "";

  const ancestors: string[] = [];
  let current = node;
  while (current.parentId) {
    const parent = nodeMap.get(current.parentId);
    if (!parent) break;
    if (parent.type === "folder") {
      ancestors.unshift(parent.title);
    }
    current = parent;
  }

  return ancestors.join("/");
}

export function truncateFolderTag(tag: string, maxLevels: number = 2): string {
  if (!tag) return tag;
  const parts = tag.split("/");
  if (parts.length <= maxLevels) return tag;
  return parts.slice(-maxLevels).join("/");
}
