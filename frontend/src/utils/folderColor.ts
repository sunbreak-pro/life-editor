import type { TaskNode } from "../types/taskTree";
import { walkAncestors } from "./walkAncestors";

export function resolveTaskColor(
  taskId: string,
  nodeMap: Map<string, TaskNode>,
): string | undefined {
  const node = nodeMap.get(taskId);
  if (!node) return undefined;

  if (node.type === "folder" && node.color) return node.color;

  for (const ancestor of walkAncestors(taskId, nodeMap)) {
    if (ancestor.type === "folder" && ancestor.color) return ancestor.color;
  }

  return undefined;
}
