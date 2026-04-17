import type { TaskNode } from "../types/taskTree";

export function resolveTaskColor(
  taskId: string,
  nodeMap: Map<string, TaskNode>,
): string | undefined {
  const node = nodeMap.get(taskId);
  if (!node) return undefined;

  if (node.type === "folder" && node.color) return node.color;

  let current = node;
  while (current.parentId) {
    const parent = nodeMap.get(current.parentId);
    if (!parent) break;
    if (parent.type === "folder" && parent.color) return parent.color;
    current = parent;
  }

  return undefined;
}
